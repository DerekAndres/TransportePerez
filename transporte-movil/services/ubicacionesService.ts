import { deleteDoc, doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

// --- Sobreescribe la ubicación actual del viaje ---
// Es UN solo documento por viaje (id del doc = id del viaje) que se pisa en
// cada actualización. Así el tracking en vivo no acumula miles de escrituras
// históricas y no agota la cuota del plan gratuito de Firestore.
//
// `padreIds` son los padres de los niños de la ruta. Las reglas de Firestore
// solo les dejan ver este documento a ellos: un padre no puede seguir a un bus
// que no lleva a su hijo. Va en cada escritura porque setDoc reemplaza el
// documento entero.
export async function actualizarUbicacion(
  viajeId: string,
  lat: number,
  lng: number,
  padreIds: string[]
): Promise<void> {
  await setDoc(doc(db, "ubicaciones", viajeId), {
    viajeId,
    lat,
    lng,
    timestamp: Timestamp.now(),
    padreIds,
  });
}

// --- Borra el doc de ubicación al finalizar el viaje (el bus ya no está en vivo) ---
export async function limpiarUbicacion(viajeId: string): Promise<void> {
  await deleteDoc(doc(db, "ubicaciones", viajeId));
}
