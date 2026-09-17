import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import type { Recorrido } from "../types/models";

// --- El recorrido de un viaje: por dónde pasó el bus (ver "RECORRIDOS" en models.ts) ---
// La app del conductor guarda un punto por minuto mientras el viaje está en
// curso. Se escucha EN VIVO porque sirve igual para un viaje en curso (el camino
// va creciendo en pantalla) que para uno terminado; es un solo documento, así
// que escucharlo cuesta muy poco.
export function escucharRecorrido(
  viajeId: string,
  callback: (recorrido: Recorrido | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "recorridos", viajeId),
    (snap) => callback(snap.exists() ? (snap.data() as Recorrido) : null),
    () => callback(null)
  );
}
