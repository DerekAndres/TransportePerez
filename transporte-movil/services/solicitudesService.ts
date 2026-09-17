import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  Timestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  AlcanceCambio,
  DatosInscripcion,
  ParadaNino,
  Solicitud,
  TurnoNino,
} from "../types/models";

// ============================================
// SOLICITUDES (lado del padre / conductor)
// ============================================
// El padre PIDE (inscribir un hijo, cambiar una ubicación) y el admin APRUEBA
// desde el panel web — así el sistema sigue siendo de registro cerrado.
// Consultas solo con igualdades (sin índices compuestos), como todo el proyecto.

// --- Crea la solicitud de inscripción de un hijo ---
export async function crearSolicitudInscripcion(
  padreId: string,
  datosNino: DatosInscripcion
): Promise<void> {
  await addDoc(collection(db, "solicitudes"), {
    tipo: "inscripcion",
    padreId,
    estado: "pendiente",
    creadaEn: Timestamp.now(),
    datosNino,
  });
}

// --- Crea la solicitud de cambio de ubicación (mudanza o de un solo día) ---
export async function crearSolicitudCambio(
  padreId: string,
  datos: {
    ninoId: string;
    permanente: boolean;
    fechaAplicacion?: string; // solo si !permanente; con 24 h de anticipación
    alcance: AlcanceCambio; // recogida, entrega o ambas
    nuevaUbicacion: ParadaNino; // incluye el punto de referencia
    motivo?: string;
  }
): Promise<void> {
  await addDoc(collection(db, "solicitudes"), {
    tipo: "cambio_ubicacion",
    padreId,
    estado: "pendiente",
    creadaEn: Timestamp.now(),
    ...datos,
  });
}

// --- Cambio de escuela ---
// Solo pide a qué escuela se va y desde cuándo. El resto (que la ruta deje de
// servirle, que haya que reasignarlo) lo resuelve el admin al aprobar: al padre
// no se le pide entender nada de rutas.
export async function crearSolicitudEscuela(
  padreId: string,
  datos: {
    ninoId: string;
    nuevaEscuelaId: string;
    fechaAplicacion?: string; // desde cuándo empieza en la escuela nueva
    motivo?: string;
  }
): Promise<void> {
  await addDoc(collection(db, "solicitudes"), {
    tipo: "cambio_escuela",
    padreId,
    estado: "pendiente",
    creadaEn: Timestamp.now(),
    ...datos,
  });
}

// --- Cambio de turno (mañana / tarde / ambos) ---
export async function crearSolicitudTurno(
  padreId: string,
  datos: {
    ninoId: string;
    nuevoTurno: TurnoNino;
    fechaAplicacion?: string;
    motivo?: string;
  }
): Promise<void> {
  await addDoc(collection(db, "solicitudes"), {
    tipo: "cambio_turno",
    padreId,
    estado: "pendiente",
    creadaEn: Timestamp.now(),
    ...datos,
  });
}

// --- AVISO de ausencia: "hoy (o tal día) no viaja" ---
// Nace 'aprobada' porque no hay nada que aprobar, y sobre todo porque tiene que
// servir el MISMO DÍA (ver el comentario de TipoSolicitud en models.ts). El
// conductor lo lee al abrir su ruta y no espera a ese niño — que es, además, la
// forma más barata de evitar un registro de "no estaba" que no corresponde.
export async function crearAvisoAusencia(
  padreId: string,
  datos: { ninoId: string; fechaAplicacion: string; motivo?: string }
): Promise<void> {
  await addDoc(collection(db, "solicitudes"), {
    tipo: "ausencia_dia",
    padreId,
    estado: "aprobada",
    creadaEn: Timestamp.now(),
    ...datos,
  });
}

// --- Ausencias avisadas para una fecha (las lee el conductor) ---
// El filtro por estado "aprobada" parece de más (una ausencia nace aprobada),
// pero las reglas lo EXIGEN: al conductor solo le dejan leer avisos aprobados de
// estos días, y en una consulta eso tiene que estar escrito en los filtros.
export async function listarAusenciasDeFecha(fecha: string): Promise<Solicitud[]> {
  const snap = await getDocs(
    query(
      collection(db, "solicitudes"),
      where("tipo", "==", "ausencia_dia"),
      where("estado", "==", "aprobada"),
      where("fechaAplicacion", "==", fecha)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Solicitud);
}

// --- Escucha EN VIVO las solicitudes del padre (así ve cuando el admin resuelve) ---
// El filtro por padreId con igualdad es lo que las reglas exigen para permitirle
// la consulta al padre.
export function escucharMisSolicitudes(
  padreId: string,
  callback: (solicitudes: Solicitud[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "solicitudes"), where("padreId", "==", padreId)),
    (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Solicitud);
      lista.sort((a, b) => b.creadaEn.toMillis() - a.creadaEn.toMillis()); // recientes primero
      callback(lista);
    },
    () => callback([])
  );
}

// --- Cambios de UN SOLO DÍA aprobados para hoy (los lee el conductor) ---
// Su pantalla los muestra como aviso destacado sobre el niño afectado.
export async function listarCambiosPuntualesDeHoy(fecha: string): Promise<Solicitud[]> {
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
