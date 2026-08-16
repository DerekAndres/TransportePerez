import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Nino, ParadaNino, TurnoNino } from "../types/models";

// --- Lista todos los niños, ordenados por nombre ---
export async function listarNinos(): Promise<Nino[]> {
  const snap = await getDocs(query(collection(db, "ninos"), orderBy("nombre")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Nino);
}

// A cada niño se le asigna su escuela, su turno (cuándo viaja) y su parada (la
// casa, marcada en el mapa del perfil). La asignación a rutas NO vive acá: se hace
// desde Rutas (marcando al niño en ruta.ninoIds).
interface DatosNino {
  nombre: string;
  grado: string;
  padreId: string;
  escuelaId: string;
  turno: TurnoNino;
  parada: ParadaNino;
  foto?: string; // base64 comprimida (también puede subirla el padre desde la app)
}

// --- Crea un niño ---
export async function crearNino(datos: DatosNino): Promise<void> {
  await addDoc(collection(db, "ninos"), { ...datos, activo: true });
}

// --- Actualiza un niño existente ---
export async function actualizarNino(id: string, datos: DatosNino): Promise<void> {
  await updateDoc(doc(db, "ninos", id), { ...datos });
}

// --- Activa o desactiva un niño ---
export async function cambiarActivoNino(id: string, activo: boolean): Promise<void> {
  await updateDoc(doc(db, "ninos", id), { activo });
}

// --- Archiva un niño ("eliminar") ---
// No borra el documento: lo marca y lo desactiva, para que salga de las listas
// pero sus viajes y registros pasados sigan mostrando su nombre. Queda visible
// en la pantalla de Historial. Ver "BORRADO LÓGICO" en models.ts.
export async function eliminarNino(id: string, motivo: string): Promise<void> {
  await updateDoc(doc(db, "ninos", id), {
    eliminado: true,
    eliminadoEn: Timestamp.now(),
    motivoEliminacion: motivo,
    activo: false,
  });
}

// --- Restaura un niño archivado ---
export async function restaurarNino(id: string): Promise<void> {
  await updateDoc(doc(db, "ninos", id), {
    eliminado: deleteField(),
    eliminadoEn: deleteField(),
    motivoEliminacion: deleteField(),
    activo: true,
  });
}
