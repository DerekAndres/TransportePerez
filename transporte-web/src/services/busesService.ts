import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Bus } from "../types/models";

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
  await addDoc(collection(db, "buses"), { ...datos, activo: true });
}

// --- Actualiza un bus existente ---
export async function actualizarBus(
  id: string,
  datos: { placa: string; capacidad: number; conductorId: string; foto?: string }
): Promise<void> {
  await updateDoc(doc(db, "buses", id), datos);
}

// --- Activa o desactiva un bus ---
export async function cambiarActivoBus(id: string, activo: boolean): Promise<void> {
  await updateDoc(doc(db, "buses", id), { activo });
}
