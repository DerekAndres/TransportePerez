import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Registro, Solicitud, UbicacionActual, Viaje } from "../types/models";

// ============================================
// FASE 8 — Supervisión en vivo (admin)
// ============================================
// El mapa del admin muestra TODOS los buses con viaje en curso a la vez. Se arma
// cruzando dos suscripciones en vivo: los viajes en curso y las ubicaciones. Los
// nombres (ruta, conductor, bus) los resuelve la pantalla con datos que carga una
// sola vez (cambian rara vez), así el mapa solo escucha lo que se mueve.

// --- Viajes en curso, en tiempo real ---
export function escucharViajesEnCurso(callback: (viajes: Viaje[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "viajes"), where("estado", "==", "en_curso")),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Viaje)),
    () => callback([])
  );
}

// --- Ubicaciones (un doc por viaje activo), en tiempo real ---
// Devuelve un mapa viajeId → ubicación (el id del doc es el viajeId). Cuando un
// viaje finaliza, la app del conductor borra su doc y el bus desaparece del mapa.
export function escucharUbicaciones(
  callback: (porViaje: Map<string, UbicacionActual>) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, "ubicaciones"),
    (snap) => {
      const porViaje = new Map<string, UbicacionActual>();
      snap.docs.forEach((d) => porViaje.set(d.id, d.data() as UbicacionActual));
      callback(porViaje);
    },
    () => callback(new Map())
  );
}

// --- TODOS los viajes de una fecha, en tiempo real (en curso y finalizados) ---
// Un solo filtro de igualdad sobre 'fecha': sin índice compuesto. Con esto el
// admin ve el día completo, no solo lo que está pasando ahora.
export function escucharViajesDeFecha(
  fecha: string,
  callback: (viajes: Viaje[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "viajes"), where("fecha", "==", fecha)),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Viaje)),
    () => callback([])
  );
}

// --- Cambios de ubicación de UN DÍA aprobados para una fecha ---
// Los mismos que lee la app del conductor: mueven una parada al lugar nuevo solo
// ese día. Se usan para que el recorrido del mapa del admin sea idéntico al que
// ve el conductor en su teléfono.
export async function listarCambiosPuntuales(fecha: string): Promise<Solicitud[]> {
  const snap = await getDocs(
    query(
      collection(db, "solicitudes"),
      where("tipo", "==", "cambio_ubicacion"),
      where("estado", "==", "aprobada"),
      where("fechaAplicacion", "==", fecha)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Solicitud);
}

// --- Registros (subió/bajó) de UN viaje, en tiempo real ---
// Alimenta la línea de tiempo del detalle: cada evento con su hora exacta, tal
// como quedó guardado cuando el conductor marcó la asistencia. Al ser en vivo,
// el admin ve aparecer los eventos de un viaje en curso sin recargar.
export function escucharRegistrosDeViaje(
  viajeId: string,
  callback: (registros: Registro[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "registros"), where("viajeId", "==", viajeId)),
    (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Registro);
      lista.sort((a, b) => a.hora.toMillis() - b.hora.toMillis()); // orden cronológico
      callback(lista);
    },
    () => callback([])
  );
}
