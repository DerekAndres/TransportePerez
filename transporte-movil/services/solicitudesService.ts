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
import type { AlcanceCambio, DatosInscripcion, ParadaNino, Solicitud } from "../types/models";

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
