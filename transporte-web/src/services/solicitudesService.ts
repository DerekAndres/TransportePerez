import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  Timestamp,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { auditar, compararCampos } from "./auditoriaService";
import type { Solicitud } from "../types/models";

// ============================================
// SOLICITUDES (lado del admin)
// ============================================
// El padre pide desde la app (inscripción de un hijo o cambio de ubicación) y
// acá el admin resuelve. Al aprobar una inscripción se CREA el niño; al aprobar
// una mudanza se actualiza su casa. Todo en un batch: solicitud y efecto quedan
// consistentes (o se aplican los dos, o ninguno). Cuando la aprobación toca la
// ficha de un niño, en el mismo lote va su registro de auditoría.

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
  const auditoriaId = auditar(
    lote,
    "ninos",
    "crear",
    [refNino.id],
    `Alta de ${datos.nombre} por inscripción aprobada`
  );
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
    auditoriaId,
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
      // Dónde se recoge y se deja a un niño es de lo más sensible del sistema
      const previo = await getDoc(doc(db, "ninos", solicitud.ninoId));
      const auditoriaId = auditar(
        lote,
        "ninos",
        "cambiar_ubicacion",
        [solicitud.ninoId],
        "Cambio de ubicación permanente aprobado (lo pidió el padre)",
        compararCampos(previo.data() ?? {}, cambios, ["parada", "paradaTarde"])
      );
      lote.update(doc(db, "ninos", solicitud.ninoId), { ...cambios, auditoriaId });
    }
  }
  lote.update(doc(db, "solicitudes", solicitud.id), {
    estado: "aprobada",
    resueltaEn: Timestamp.now(),
    ...(respuesta ? { respuesta } : {}),
  });
  await lote.commit();
}

// --- Aprueba un CAMBIO DE ESCUELA ---
// Actualiza `nino.escuelaId`. Lo que NO puede hacer sola esta función es
// reacomodar la ruta: una ruta sirve a escuelas concretas (ruta.escuelaIds), así
// que el niño puede quedar en un bus que ya no pasa por su colegio nuevo. El
// panel avisa de eso al aprobar; reasignarlo es una decisión de quien arma las
// rutas, no algo que corresponda automatizar.
//
// Efecto lateral bueno: el canal de avisos se corrige solo, porque la membresía
// se deriva de la escuela del hijo y no de una lista de suscriptores.
export async function aprobarCambioEscuela(
  solicitud: Solicitud,
  respuesta?: string
): Promise<void> {
  const lote = writeBatch(db);
  if (solicitud.ninoId && solicitud.nuevaEscuelaId) {
    const previo = await getDoc(doc(db, "ninos", solicitud.ninoId));
    const auditoriaId = auditar(
      lote,
      "ninos",
      "cambiar_escuela",
      [solicitud.ninoId],
      "Cambio de escuela aprobado (lo pidió el padre)",
      compararCampos(previo.data() ?? {}, { escuelaId: solicitud.nuevaEscuelaId }, ["escuelaId"])
    );
    lote.update(doc(db, "ninos", solicitud.ninoId), {
      escuelaId: solicitud.nuevaEscuelaId,
      auditoriaId,
    });
  }
  lote.update(doc(db, "solicitudes", solicitud.id), {
    estado: "aprobada",
    resueltaEn: Timestamp.now(),
    ...(respuesta ? { respuesta } : {}),
  });
  await lote.commit();
}

// --- Aprueba un CAMBIO DE TURNO ---
// Mismo cuidado que el de escuela: cada ruta tiene su turno, así que pasar de
// "solo mañana" a "ambos" exige sumar al niño a una ruta de la tarde.
export async function aprobarCambioTurno(
  solicitud: Solicitud,
  respuesta?: string
): Promise<void> {
  const lote = writeBatch(db);
  if (solicitud.ninoId && solicitud.nuevoTurno) {
    const previo = await getDoc(doc(db, "ninos", solicitud.ninoId));
    const auditoriaId = auditar(
      lote,
      "ninos",
      "cambiar_turno",
      [solicitud.ninoId],
      "Cambio de turno aprobado (lo pidió el padre)",
      compararCampos(previo.data() ?? {}, { turno: solicitud.nuevoTurno }, ["turno"])
    );
    lote.update(doc(db, "ninos", solicitud.ninoId), { turno: solicitud.nuevoTurno, auditoriaId });
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
