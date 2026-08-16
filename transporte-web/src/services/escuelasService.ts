import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Escuela } from "../types/models";

// --- Lista todas las escuelas, ordenadas por nombre ---
export async function listarEscuelas(): Promise<Escuela[]> {
  const snap = await getDocs(query(collection(db, "escuelas"), orderBy("nombre")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Escuela);
}

// --- Crea una escuela ---
export async function crearEscuela(datos: {
  nombre: string;
  lat: number;
  lng: number;
}): Promise<void> {
  await addDoc(collection(db, "escuelas"), { ...datos, activa: true });
}

// --- Actualiza una escuela existente ---
export async function actualizarEscuela(
  id: string,
  datos: { nombre: string; lat: number; lng: number }
): Promise<void> {
  await updateDoc(doc(db, "escuelas", id), datos);
}

// --- Activa o desactiva una escuela ---
export async function cambiarActivaEscuela(id: string, activa: boolean): Promise<void> {
  await updateDoc(doc(db, "escuelas", id), { activa });
}

// --- Cuenta cuántos niños activos van a cada escuela ---
// Lee los niños activos una sola vez y los agrupa por escuelaId en el cliente
// (volúmenes chicos; evita una consulta por escuela). Devuelve { escuelaId: cantidad }.
// Nota: hasta que los niños tengan escuelaId (Fase 3.5, sub-etapa 4) los conteos son 0.
export async function contarNinosPorEscuela(): Promise<Record<string, number>> {
  const snap = await getDocs(query(collection(db, "ninos"), where("activo", "==", true)));
  const conteo: Record<string, number> = {};
  snap.docs.forEach((d) => {
    const escuelaId = d.data().escuelaId as string | undefined;
    if (escuelaId) conteo[escuelaId] = (conteo[escuelaId] ?? 0) + 1;
  });
  return conteo;
}
