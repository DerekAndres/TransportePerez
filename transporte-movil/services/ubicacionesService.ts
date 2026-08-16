import { deleteDoc, doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

// --- Sobreescribe la ubicación actual del viaje ---
// Es UN solo documento por viaje (id del doc = id del viaje) que se pisa en
// cada actualización. Así el tracking en vivo no acumula miles de escrituras
// históricas y no agota la cuota del plan gratuito de Firestore.
export async function actualizarUbicacion(
  viajeId: string,
  lat: number,
  lng: number
): Promise<void> {
  await setDoc(doc(db, "ubicaciones", viajeId), {
    viajeId,
    lat,
    lng,
    timestamp: Timestamp.now(),
  });
}

// --- Borra el doc de ubicación al finalizar el viaje (el bus ya no está en vivo) ---
export async function limpiarUbicacion(viajeId: string): Promise<void> {
  await deleteDoc(doc(db, "ubicaciones", viajeId));
}
