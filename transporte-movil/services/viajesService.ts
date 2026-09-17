import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { guardarRegistros } from "./colaRegistros";
import type { EventoRegistro, Registro, Turno, Viaje } from "../types/models";

// --- Fecha local de hoy en formato "YYYY-MM-DD" (mismo formato que Viaje.fecha) ---
export function fechaDeHoy(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

// --- Turno según la hora del sistema: antes del mediodía es la mañana ---
export function turnoActual(): Turno {
  return new Date().getHours() < 12 ? "manana" : "tarde";
}

// --- Los viajes de hoy de una lista de rutas ---
// Se buscan por RUTA y no por conductor: en un día de suplencia, el titular
// tiene que ver que el viaje de su unidad ya lo inició el suplente (y al revés),
// para que nadie arranque la misma ruta dos veces. Dos igualdades por consulta:
// no requiere índice compuesto.
export async function listarViajesDeHoyDeRutas(rutaIds: string[]): Promise<Viaje[]> {
  const hoy = fechaDeHoy();
  const resultados = await Promise.all(
    rutaIds.map((rutaId) =>
      getDocs(
        query(collection(db, "viajes"), where("rutaId", "==", rutaId), where("fecha", "==", hoy))
      )
    )
  );
  return resultados.flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Viaje));
}

// --- Inicia un viaje: lo crea directamente en estado 'en_curso' ---
// Las reglas verifican que quien lo inicia maneja esa unidad HOY (el titular, o
// el suplente si hay una suplencia) y exigen la hora del servidor.
export async function iniciarViaje(datos: {
  rutaId: string;
  conductorId: string;
  busId: string;
}): Promise<Viaje> {
  const ref = doc(collection(db, "viajes"));
  const viaje = {
    ...datos,
    fecha: fechaDeHoy(),
    estado: "en_curso" as const,
    horaInicio: Timestamp.now(),
  };
  await setDoc(ref, { ...viaje, horaInicioServidor: serverTimestamp() });
  return { id: ref.id, ...viaje };
}

// --- Finaliza un viaje ---
export async function finalizarViaje(viajeId: string): Promise<void> {
  await updateDoc(doc(db, "viajes", viajeId), {
    estado: "finalizado",
    horaFin: Timestamp.now(),
    horaFinServidor: serverTimestamp(),
  });
}

// --- Registra uno o varios eventos de asistencia ---
// "Marcar todos" (hermanos en una parada, "Llegué a la escuela") va en un solo
// lote atómico. Todo pasa por la cola del teléfono (colaRegistros.ts): la marca
// queda guardada aunque no haya señal y aunque la app se cierre, y se devuelve
// al instante para mostrarla sin esperar al servidor.
export function registrarEventos(
  viajeId: string,
  items: { ninoId: string; evento: EventoRegistro }[]
): Promise<Registro[]> {
  const horaMs = Date.now();
  return guardarRegistros(
    items.map((it) => ({ viajeId, ninoId: it.ninoId, evento: it.evento, horaMs }))
  );
}

// --- Trae todos los registros de un viaje (para reconstruir el estado de cada niño) ---
export async function listarRegistrosDeViaje(viajeId: string): Promise<Registro[]> {
  const snap = await getDocs(
    query(collection(db, "registros"), where("viajeId", "==", viajeId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Registro);
}
