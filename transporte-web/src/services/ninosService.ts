import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { auditar, compararCampos } from "./auditoriaService";
import type { Nino, ParadaNino, TurnoNino } from "../types/models";

// Toda escritura sobre un niño deja su registro de auditoría en el mismo lote.
// Las reglas lo EXIGEN para lo sensible (su padre, su casa, si está activo); acá
// se registra siempre, porque cualquier cambio en la ficha de un niño es algo
// que la empresa tiene que poder rastrear.

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

// Los campos que se muestran campo por campo en la auditoría de una edición
const CAMPOS_AUDITADOS = ["nombre", "padreId", "parada", "escuelaId", "turno", "grado"];

// --- Crea un niño ---
export async function crearNino(datos: DatosNino): Promise<void> {
  const lote = writeBatch(db);
  const ref = doc(collection(db, "ninos"));
  const auditoriaId = auditar(lote, "ninos", "crear", [ref.id], `Alta de ${datos.nombre}`);
  lote.set(ref, { ...datos, activo: true, auditoriaId });
  await lote.commit();
}

// --- Actualiza un niño existente ---
// Lee la versión guardada para dejar anotado qué cambió (por ejemplo, de qué
// padre a qué padre): es lo que hace falta el día que alguien pregunte.
export async function actualizarNino(id: string, datos: DatosNino): Promise<void> {
  const previo = await getDoc(doc(db, "ninos", id));
  const cambios = compararCampos(previo.data() ?? {}, { ...datos }, CAMPOS_AUDITADOS);
  const lote = writeBatch(db);
  const auditoriaId = auditar(lote, "ninos", "editar", [id], `Editó la ficha de ${datos.nombre}`, cambios);
  lote.update(doc(db, "ninos", id), { ...datos, auditoriaId });
  await lote.commit();
}

// --- Activa o desactiva un niño ---
export async function cambiarActivoNino(id: string, activo: boolean): Promise<void> {
  const lote = writeBatch(db);
  const auditoriaId = auditar(
    lote,
    "ninos",
    activo ? "activar" : "desactivar",
    [id],
    activo ? "Niño reactivado" : "Niño desactivado"
  );
  lote.update(doc(db, "ninos", id), { activo, auditoriaId });
  await lote.commit();
}

// --- Archiva un niño ("eliminar") ---
// No borra el documento: lo marca y lo desactiva, para que salga de las listas
// pero sus viajes y registros pasados sigan mostrando su nombre. Queda visible
// en la pantalla de Historial. Ver "BORRADO LÓGICO" en models.ts.
export async function eliminarNino(id: string, motivo: string): Promise<void> {
  const lote = writeBatch(db);
  const auditoriaId = auditar(lote, "ninos", "archivar", [id], `Archivado. Motivo: ${motivo || "—"}`);
  lote.update(doc(db, "ninos", id), {
    eliminado: true,
    eliminadoEn: Timestamp.now(),
    motivoEliminacion: motivo,
    activo: false,
    auditoriaId,
  });
  await lote.commit();
}

// --- Restaura un niño archivado ---
export async function restaurarNino(id: string): Promise<void> {
  const lote = writeBatch(db);
  const auditoriaId = auditar(lote, "ninos", "restaurar", [id], "Niño restaurado desde Historial");
  lote.update(doc(db, "ninos", id), {
    eliminado: deleteField(),
    eliminadoEn: deleteField(),
    motivoEliminacion: deleteField(),
    activo: true,
    auditoriaId,
  });
  await lote.commit();
}
