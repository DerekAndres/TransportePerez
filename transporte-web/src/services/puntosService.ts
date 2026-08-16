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
import type { Punto } from "../types/models";

// Puntos de transbordo: lugares donde un niño cambia de bus. CRUD idéntico al de
// Escuelas (misma forma de datos y de coordenadas).

// --- Lista todos los puntos, ordenados por nombre ---
export async function listarPuntos(): Promise<Punto[]> {
  const snap = await getDocs(query(collection(db, "puntos"), orderBy("nombre")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Punto);
}

// --- Crea un punto ---
export async function crearPunto(datos: {
  nombre: string;
  lat: number;
  lng: number;
}): Promise<void> {
  await addDoc(collection(db, "puntos"), { ...datos, activo: true });
}

// --- Actualiza un punto existente ---
export async function actualizarPunto(
  id: string,
  datos: { nombre: string; lat: number; lng: number }
): Promise<void> {
  await updateDoc(doc(db, "puntos", id), datos);
}

// --- Activa o desactiva un punto ---
export async function cambiarActivoPunto(id: string, activo: boolean): Promise<void> {
  await updateDoc(doc(db, "puntos", id), { activo });
}
