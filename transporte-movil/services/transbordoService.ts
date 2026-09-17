import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { guardarRegistros } from "./colaRegistros";
import type { EventoRegistro, Registro, Ruta } from "../types/models";

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
  // Copiados por quien ENTREGA (que sí puede leer al niño): el bus que lo recibe
  // quizá no tenga permiso de leerlo si no está en su ruta.
  ninoNombre?: string;
  ninoEscuelaId?: string;
}

// --- La ruta por id (para leer ruta.ninos y ruta.escuelaIds) ---
export async function obtenerRuta(rutaId: string): Promise<Ruta | null> {
  const snap = await getDoc(doc(db, "rutas", rutaId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Ruta;
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
// corrección, no se edita. Pasan por la cola del teléfono igual que la
// asistencia normal (ver colaRegistros.ts), así que no se pierden sin señal.
export function registrarTransbordo(
  ctx: ContextoTransbordo,
  items: EventoTransbordo[]
): Promise<Registro[]> {
  const horaMs = Date.now();
  return guardarRegistros(
    items.map((it) => ({
      viajeId: ctx.viajeId,
      ninoId: it.ninoId,
      evento: it.evento,
      horaMs,
      paradaId: "",
      fecha: ctx.fecha,
      lugarTipo: "punto" as const,
      lugarId: ctx.puntoId,
      rutaId: ctx.rutaId,
      busId: ctx.busId,
      conductorId: ctx.conductorId,
      ...(it.excepcion ? { excepcion: true } : {}),
      ...(it.discrepancia ? { discrepancia: true } : {}),
      ...(it.motivo ? { motivo: it.motivo } : {}),
      ...(it.ninoNombre ? { ninoNombre: it.ninoNombre } : {}),
      ...(it.ninoEscuelaId ? { ninoEscuelaId: it.ninoEscuelaId } : {}),
    }))
  );
}

// --- Contingencia "Esperar": marca el viaje como demorado ---
export async function marcarViajeDemorado(viajeId: string): Promise<void> {
  await updateDoc(doc(db, "viajes", viajeId), { demorado: true });
}
