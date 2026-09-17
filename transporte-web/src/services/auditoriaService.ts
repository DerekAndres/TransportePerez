import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  type WriteBatch,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import type { Auditoria, CambioAuditado, ColeccionAuditada } from "../types/models";

// ============================================
// AUDITORÍA DE CAMBIOS SENSIBLES
// ============================================
// Algunos cambios del panel no pueden quedar sin rastro: quién es el padre de un
// niño (decide quién ve su mapa y recibe sus avisos), dónde se lo deja, quién
// maneja una unidad, qué niños van en una ruta, dar de baja una cuenta. Cada una
// de esas escrituras va en un LOTE junto con un documento nuevo en `auditoria`
// que dice quién lo hizo, cuándo (con la hora del servidor) y qué cambió.
//
// No depende de acordarse: las REGLAS de Firestore rechazan el cambio si el
// registro no viaja en el mismo lote (firestore.rules → "AUDITORÍA DE CAMBIOS
// SENSIBLES"). Y un registro de auditoría no se puede editar ni borrar, ni
// siquiera desde el panel.

function actorActual(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("No hay una sesión de administrador activa");
  return uid;
}

// Agrega al lote el registro de auditoría y devuelve su id. El documento que se
// modifica en ese mismo lote tiene que llevar ese id en su campo `auditoriaId`.
export function auditar(
  lote: WriteBatch,
  coleccion: ColeccionAuditada,
  accion: string,
  docIds: string[],
  detalle: string,
  cambios: CambioAuditado[] = []
): string {
  const ref = doc(collection(db, "auditoria"));
  lote.set(ref, {
    actorId: actorActual(),
    accion,
    coleccion,
    docIds,
    detalle,
    ...(cambios.length > 0 ? { cambios } : {}),
    hora: serverTimestamp(),
  });
  return ref.id;
}

// Un borrado no deja un documento donde anotar el id, así que su registro lleva
// un id que las reglas pueden deducir solas: "borrado-<colección>-<id>".
export function auditarBorrado(
  lote: WriteBatch,
  coleccion: ColeccionAuditada,
  docId: string,
  detalle: string
): void {
  lote.set(doc(db, "auditoria", `borrado-${coleccion}-${docId}`), {
    actorId: actorActual(),
    accion: "borrar",
    coleccion,
    docIds: [docId],
    detalle,
    hora: serverTimestamp(),
  });
}

// --- Qué campos cambian entre la versión guardada y la nueva ---
// Solo mira los `campos` que se le piden, y solo los que vienen en `despues`
// (lo que no se envía, no cambia). Los valores quedan en texto legible para
// poder mostrarlos tal cual en la pantalla de Auditoría.
export function compararCampos(
  antes: Record<string, unknown>,
  despues: Record<string, unknown>,
  campos: string[]
): CambioAuditado[] {
  return campos
    .filter((campo) => campo in despues && estable(antes[campo]) !== estable(despues[campo]))
    .map((campo) => ({ campo, antes: legible(antes[campo]), despues: legible(despues[campo]) }));
}

// JSON con las claves ordenadas: dos objetos iguales escritos en otro orden
// (como vuelven de Firestore) no deben contar como un cambio
function estable(valor: unknown): string {
  if (valor === undefined || valor === null || valor === "") return "null";
  if (Array.isArray(valor)) return `[${valor.map(estable).join(",")}]`;
  if (typeof valor === "object") {
    const objeto = valor as Record<string, unknown>;
    return `{${Object.keys(objeto)
      .sort()
      .map((k) => `${k}:${estable(objeto[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(valor);
}

function legible(valor: unknown): string {
  if (valor === undefined || valor === null || valor === "") return "—";
  if (typeof valor === "boolean") return valor ? "sí" : "no";
  if (Array.isArray(valor)) return `${valor.length} elemento${valor.length === 1 ? "" : "s"}`;
  if (typeof valor === "object") {
    const lugar = valor as { nombre?: string; lat?: number; lng?: number; referencia?: string };
    if (typeof lugar.lat === "number" && typeof lugar.lng === "number") {
      return (
        `${lugar.nombre ?? "Lugar"} (${lugar.lat.toFixed(5)}, ${lugar.lng.toFixed(5)})` +
        (lugar.referencia ? ` — ${lugar.referencia}` : "")
      );
    }
    return JSON.stringify(valor);
  }
  return String(valor);
}

// --- Los últimos movimientos, más recientes primero (pantalla Auditoría) ---
export async function listarAuditoria(cantidad = 300): Promise<Auditoria[]> {
  const snap = await getDocs(
    query(collection(db, "auditoria"), orderBy("hora", "desc"), limit(cantidad))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Auditoria);
}
