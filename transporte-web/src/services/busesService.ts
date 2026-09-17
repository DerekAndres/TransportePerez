import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { auditar, compararCampos } from "./auditoriaService";
import type { Bus } from "../types/models";

// Quién maneja una unidad decide qué niños puede ver ese conductor en su app,
// así que dar de alta, cambiar de conductor o apagar una unidad va siempre con
// su registro de auditoría (ver auditoriaService.ts).

// --- Lista todos los buses, ordenados por placa ---
export async function listarBuses(): Promise<Bus[]> {
  const snap = await getDocs(query(collection(db, "buses"), orderBy("placa")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Bus);
}

// --- Crea un bus ---
// La foto de la unidad es opcional: base64 comprimida (~60 KB), guardada en el
// documento porque Firebase Storage exige plan Blaze y el proyecto es Spark.
export async function crearBus(datos: {
  placa: string;
  capacidad: number;
  conductorId: string;
  foto?: string;
}): Promise<void> {
  const lote = writeBatch(db);
  const ref = doc(collection(db, "buses"));
  const auditoriaId = auditar(lote, "buses", "crear", [ref.id], `Alta de la unidad ${datos.placa}`);
  lote.set(ref, { ...datos, activo: true, auditoriaId });
  await lote.commit();
}

// --- Actualiza un bus existente ---
export async function actualizarBus(
  id: string,
  datos: { placa: string; capacidad: number; conductorId: string; foto?: string }
): Promise<void> {
  const previo = await getDoc(doc(db, "buses", id));
  const cambios = compararCampos(previo.data() ?? {}, { ...datos }, ["placa", "conductorId", "capacidad"]);
  const lote = writeBatch(db);
  const auditoriaId = auditar(lote, "buses", "editar", [id], `Editó la unidad ${datos.placa}`, cambios);
  lote.update(doc(db, "buses", id), { ...datos, auditoriaId });
  await lote.commit();
}

// --- Activa o desactiva un bus ---
export async function cambiarActivoBus(id: string, activo: boolean): Promise<void> {
  const lote = writeBatch(db);
  const auditoriaId = auditar(
    lote,
    "buses",
    activo ? "activar" : "desactivar",
    [id],
    activo ? "Unidad reactivada" : "Unidad desactivada"
  );
  lote.update(doc(db, "buses", id), { activo, auditoriaId });
  await lote.commit();
}
