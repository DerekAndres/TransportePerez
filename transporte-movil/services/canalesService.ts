import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Aviso, Canal } from "../types/models";

// ============================================
// CANALES INFORMATIVOS (lado del padre)
// ============================================
// Son de una sola vía: el admin publica y el padre lee. El padre NO se inscribe
// a nada: recibe el canal de la escuela de cada uno de sus hijos. Con dos hijos
// en escuelas distintas, ve los dos canales; con dos hijos en la misma escuela,
// lo ve una sola vez.

// --- Canales activos de un conjunto de escuelas (las de los hijos del padre) ---
// Se traen todos los canales y se filtra en el cliente: son pocos (uno por
// escuela) y así se evita la consulta por lista de ids, limitada en Firestore.
export async function listarCanalesDeEscuelas(escuelaIds: string[]): Promise<Canal[]> {
  if (escuelaIds.length === 0) return [];
  const snap = await getDocs(collection(db, "canales"));
  const permitidas = new Set(escuelaIds);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Canal)
    .filter((c) => c.activo && permitidas.has(c.escuelaId))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// --- Escucha EN VIVO los avisos de un canal, del más nuevo al más viejo ---
// Filtro de igualdad simple y orden en cliente: sin índices compuestos.
export function escucharAvisos(
  canalId: string,
  callback: (avisos: Aviso[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "avisos"), where("canalId", "==", canalId)),
    (snap) => {
      const lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Aviso);
      lista.sort((a, b) => b.hora.toMillis() - a.hora.toMillis());
      callback(lista);
    },
    () => callback([])
  );
}
