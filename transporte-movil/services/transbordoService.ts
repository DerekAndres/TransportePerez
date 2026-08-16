import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { EventoRegistro, Nino, Registro, Ruta } from "../types/models";

// Contexto del transbordo (viene de la pantalla del conductor)
export interface ContextoTransbordo {
  viajeId: string;
  rutaId: string;
  busId: string;
  conductorId: string;
  puntoId: string;
  fecha: string; // "YYYY-MM-DD"
}

// Un ítem a registrar en el transbordo
export interface EventoTransbordo {
  ninoId: string;
  evento: EventoRegistro; // 'bajo' = entrega en el punto; 'subio' = recepción en el punto
  excepcion?: boolean; // niño no planificado / continuar sin transbordo
  discrepancia?: boolean; // el receptor confirmó sin que el emisor lo hubiera entregado
  motivo?: string;
}

// --- La ruta por id (para leer ruta.ninos y ruta.escuelaIds) ---
export async function obtenerRuta(rutaId: string): Promise<Ruta | null> {
  const snap = await getDoc(doc(db, "rutas", rutaId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Ruta;
}

// --- Todos los niños activos (para resolver nombres y escuela) ---
// El conductor puede leer todos los niños (regla actual). Necesita nombres de
// niños que quizá no están en su propia ruta (excepciones del otro bus).
export async function listarNinosActivos(): Promise<Nino[]> {
  const snap = await getDocs(query(collection(db, "ninos"), where("activo", "==", true)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Nino);
}

// --- Escucha EN TIEMPO REAL los registros de transbordo de un punto en una fecha ---
// Solo filtros de igualdad (fecha + lugarTipo + lugarId): NO requiere índice
// compuesto. El bus RECEPTOR usa esto para ver, en vivo, a quién dejó el EMISOR en
// el punto — sin leer la ruta del otro bus (solo consulta 'registros' del punto).
export function escucharRegistrosDelPunto(
  fecha: string,
  puntoId: string,
  callback: (registros: Registro[]) => void
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, "registros"),
      where("fecha", "==", fecha),
      where("lugarTipo", "==", "punto"),
      where("lugarId", "==", puntoId)
    ),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Registro)),
    () => callback([])
  );
}

// --- Registra entregas/recepciones de transbordo (append-only, atómico) ---
// Los registros son INMUTABLES: si hubo un error, se crea un registro de
// corrección, no se edita. Por eso siempre es 'set' de docs nuevos en un batch.
export async function registrarTransbordo(
  ctx: ContextoTransbordo,
  items: EventoTransbordo[]
): Promise<void> {
  if (items.length === 0) return;
  const lote = writeBatch(db);
  const hora = Timestamp.now();
  for (const it of items) {
    const datos: Record<string, unknown> = {
      viajeId: ctx.viajeId,
      ninoId: it.ninoId,
      evento: it.evento,
      hora,
      paradaId: "",
      fecha: ctx.fecha,
      lugarTipo: "punto",
      lugarId: ctx.puntoId,
      rutaId: ctx.rutaId,
      busId: ctx.busId,
      conductorId: ctx.conductorId,
    };
    if (it.excepcion) datos.excepcion = true;
    if (it.discrepancia) datos.discrepancia = true;
    if (it.motivo) datos.motivo = it.motivo;
    lote.set(doc(collection(db, "registros")), datos);
  }
  await lote.commit();
}

// --- Contingencia "Esperar": marca el viaje como demorado ---
export async function marcarViajeDemorado(viajeId: string): Promise<void> {
  await updateDoc(doc(db, "viajes", viajeId), { demorado: true });
}
