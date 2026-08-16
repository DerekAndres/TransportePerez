import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
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

// --- Trae los viajes de hoy de este conductor (puede tener el de mañana y el de tarde) ---
export async function listarViajesDeHoy(conductorId: string): Promise<Viaje[]> {
  const snap = await getDocs(
    query(
      collection(db, "viajes"),
      where("conductorId", "==", conductorId),
      where("fecha", "==", fechaDeHoy())
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Viaje);
}

// --- Inicia un viaje: lo crea directamente en estado 'en_curso' ---
export async function iniciarViaje(datos: {
  rutaId: string;
  conductorId: string;
  busId: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, "viajes"), {
    ...datos,
    fecha: fechaDeHoy(),
    estado: "en_curso",
    horaInicio: Timestamp.now(),
  });
  return ref.id;
}

// --- Finaliza un viaje ---
export async function finalizarViaje(viajeId: string): Promise<void> {
  await updateDoc(doc(db, "viajes", viajeId), {
    estado: "finalizado",
    horaFin: Timestamp.now(),
  });
}

// --- Registra que un niño subió o bajó del bus ---
export async function registrarEvento(datos: {
  viajeId: string;
  ninoId: string;
  evento: EventoRegistro;
}): Promise<void> {
  await addDoc(collection(db, "registros"), {
    ...datos,
    hora: Timestamp.now(),
  });
}

// --- Registra varios eventos de una sola vez, de forma atómica ---
// Se usa para "marcar todos" (hermanos en una parada) y para "Llegué a la escuela"
// (todos los niños de esa escuela bajan). writeBatch está disponible en el plan
// gratuito y no requiere backend.
export async function registrarEventos(
  viajeId: string,
  items: { ninoId: string; evento: EventoRegistro }[]
): Promise<void> {
  if (items.length === 0) return;
  const lote = writeBatch(db);
  const hora = Timestamp.now();
  for (const it of items) {
    lote.set(doc(collection(db, "registros")), {
      viajeId,
      ninoId: it.ninoId,
      evento: it.evento,
      hora,
    });
  }
  await lote.commit();
}

// --- Trae todos los registros de un viaje (para reconstruir el estado de cada niño) ---
export async function listarRegistrosDeViaje(viajeId: string): Promise<Registro[]> {
  const snap = await getDocs(
    query(collection(db, "registros"), where("viajeId", "==", viajeId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Registro);
}
