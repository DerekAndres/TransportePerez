import {
  collection,
  doc,
  onSnapshot,
  Timestamp,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Solicitud } from "../types/models";

// ============================================
// SOLICITUDES (lado del admin)
// ============================================
// El padre pide desde la app (inscripción de un hijo o cambio de ubicación) y
// acá el admin resuelve. Al aprobar una inscripción se CREA el niño; al aprobar
// una mudanza se actualiza su casa. Todo en un batch: solicitud y efecto quedan
// consistentes (o se aplican los dos, o ninguno).

// --- Escucha EN VIVO todas las solicitudes (el admin ve llegar las nuevas) ---
export function escucharSolicitudes(
  callback: (solicitudes: Solicitud[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, "solicitudes"),
    (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Solicitud);
      lista.sort((a, b) => b.creadaEn.toMillis() - a.creadaEn.toMillis());
      callback(lista);
    },
    () => callback([])
  );
}

// --- Aprueba una INSCRIPCIÓN: crea el niño y marca la solicitud ---
// El niño nace activo pero SIN ruta: asignarlo a una ruta sigue siendo trabajo
// del armador de rutas (el admin conoce capacidad y recorridos).
export async function aprobarInscripcion(
  solicitud: Solicitud,
  respuesta?: string
): Promise<void> {
  const datos = solicitud.datosNino;
  if (!datos) throw new Error("La solicitud no tiene datos del niño");

  const lote = writeBatch(db);
  const refNino = doc(collection(db, "ninos"));
  lote.set(refNino, {
    nombre: datos.nombre,
    grado: datos.grado,
    padreId: solicitud.padreId,
    activo: true,
    escuelaId: datos.escuelaId,
    turno: datos.turno,
    parada: datos.casa,
    ...(datos.entregaTarde ? { paradaTarde: datos.entregaTarde } : {}),
    ...(datos.foto ? { foto: datos.foto } : {}),
    // Campos legacy del modelo viejo (requeridos por el tipo; se limpian al final)
    centroEducativo: "",
    rutaId: "",
    paradaId: "",
  });
  lote.update(doc(db, "solicitudes", solicitud.id), {
    estado: "aprobada",
    resueltaEn: Timestamp.now(),
    ...(respuesta ? { respuesta } : {}),
  });
  await lote.commit();
}

// --- Aprueba un CAMBIO DE UBICACIÓN ---
// Permanente: actualiza el perfil del niño según el alcance —
//   'recogida' → parada (donde se recoge en la mañana)
//   'entrega'  → paradaTarde (donde se entrega en la tarde)
//   'ambas'    → las dos (el caso típico de una mudanza: se recoge y se entrega
//                en la casa nueva; al escribir las dos, la entrega deja de ser
//                un lugar aparte).
// De un solo día: NO se toca el perfil. Basta marcarla aprobada — la app del
// conductor la lee ese día y muestra el aviso; al día siguiente, todo vuelve a
// la normalidad solo, sin ninguna tarea de limpieza.
export async function aprobarCambio(
  solicitud: Solicitud,
  respuesta?: string
): Promise<void> {
  const lote = writeBatch(db);
  if (solicitud.permanente && solicitud.ninoId && solicitud.nuevaUbicacion) {
    const cambios: Record<string, unknown> = {};
    if (solicitud.alcance === "recogida" || solicitud.alcance === "ambas") {
      cambios.parada = solicitud.nuevaUbicacion;
    }
    if (solicitud.alcance === "entrega" || solicitud.alcance === "ambas") {
      cambios.paradaTarde = solicitud.nuevaUbicacion;
    }
    if (Object.keys(cambios).length > 0) {
      lote.update(doc(db, "ninos", solicitud.ninoId), cambios);
    }
  }
  lote.update(doc(db, "solicitudes", solicitud.id), {
    estado: "aprobada",
    resueltaEn: Timestamp.now(),
    ...(respuesta ? { respuesta } : {}),
  });
  await lote.commit();
}

// --- Rechaza cualquier solicitud (con nota opcional para el padre) ---
export async function rechazarSolicitud(
  solicitudId: string,
  respuesta?: string
): Promise<void> {
  const lote = writeBatch(db);
  lote.update(doc(db, "solicitudes", solicitudId), {
    estado: "rechazada",
    resueltaEn: Timestamp.now(),
    ...(respuesta ? { respuesta } : {}),
  });
  await lote.commit();
}
