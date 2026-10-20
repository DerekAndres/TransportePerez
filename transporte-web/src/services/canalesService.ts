import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Aviso, Canal, Nino } from "../types/models";

// ============================================
// CANALES INFORMATIVOS POR ESCUELA (lado admin)
// ============================================
// Un canal pertenece a UNA escuela y es de una sola vía: solo el admin publica.
//
// Decisión clave: la MEMBRESÍA NO SE GUARDA en ningún lado. Es miembro del canal
// quien tenga un hijo activo en esa escuela, y eso se calcula leyendo `ninos`.
// Ventajas: un padre con dos hijos en escuelas distintas queda en los dos
// canales sin hacer nada; si un niño cambia de escuela, su padre entra y sale
// del canal solo; y no hay listas de miembros que se desincronicen.

// --- Todos los canales, ordenados por nombre ---
export async function listarCanales(): Promise<Canal[]> {
  const snap = await getDocs(collection(db, "canales"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Canal)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// --- Crea un canal para una escuela ---
export async function crearCanal(datos: {
  nombre: string;
  escuelaId: string;
  descripcion?: string;
  foto?: string;
}): Promise<void> {
  await addDoc(collection(db, "canales"), {
    ...datos,
    activo: true,
    creadoEn: Timestamp.now(),
  });
}

// --- Actualiza los datos de un canal (nombre, descripción, portada) ---
export async function actualizarCanal(
  id: string,
  datos: { nombre: string; descripcion?: string; foto?: string }
): Promise<void> {
  await updateDoc(doc(db, "canales", id), datos);
}

// --- Activa o desactiva un canal (no se borra: conserva el historial de avisos) ---
export async function cambiarActivoCanal(id: string, activo: boolean): Promise<void> {
  await updateDoc(doc(db, "canales", id), { activo });
}

// --- Publica un aviso en el canal (solo el admin puede, por reglas) ---
export async function publicarAviso(
  canalId: string,
  texto: string,
  adminId: string
): Promise<void> {
  const limpio = texto.trim();
  if (!limpio) return;
  await addDoc(collection(db, "avisos"), {
    canalId,
    texto: limpio,
    de: adminId,
    hora: Timestamp.now(),
  });
}

// --- Borra un aviso publicado ---
//
// Acá SÍ se borra de verdad, a diferencia del resto del sistema (usuarios,
// buses, rutas y niños usan borrado lógico con un switch `activo`, para
// conservar el historial). El motivo es la diferencia de naturaleza: un aviso
// no es un dato que se consulte después, es un mensaje que se está mostrando
// ahora mismo en el teléfono de decenas de familias. Si el admin publicó algo
// equivocado —una fecha mal, un aviso que ya no aplica—, dejarlo archivado no
// sirve de nada y seguiría ocupando lugar en la pantalla del padre.
//
// ⚠️ Lo que NO se puede deshacer es la notificación: si el aviso ya salió al
// teléfono, ese push ya llegó y no hay forma de retirarlo. Borrar quita el
// aviso de la app, no el aviso que la persona ya leyó. La pantalla lo advierte.
export async function borrarAviso(avisoId: string): Promise<void> {
  await deleteDoc(doc(db, "avisos", avisoId));
}

// --- Escucha EN VIVO los avisos de un canal, del más nuevo al más viejo ---
// Filtro de igualdad simple (canalId) y orden en cliente: sin índice compuesto.
export function escucharAvisos(
  canalId: string,
  callback: (avisos: Aviso[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "avisos"), where("canalId", "==", canalId)),
    (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Aviso);
      lista.sort((a, b) => b.hora.toMillis() - a.hora.toMillis());
      callback(lista);
    },
    () => callback([])
  );
}

// --- Ids de los padres que reciben el canal de una escuela ---
// Se derivan de los niños activos de esa escuela (ver la nota de arriba). Si un
// padre tiene dos hijos en la misma escuela aparece una sola vez (es un Set).
export function padresDeEscuela(ninos: Nino[], escuelaId: string): Set<string> {
  const ids = new Set<string>();
  ninos.forEach((n) => {
    if (n.activo && n.escuelaId === escuelaId && n.padreId) ids.add(n.padreId);
  });
  return ids;
}
