import {
  Timestamp,
  addDoc,
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

// --- Escucha EN VIVO los avisos de VARIOS canales a la vez ---
// Es lo que necesita el inicio del padre: mostrar los últimos comunicados de
// todas las escuelas de sus hijos mezclados, del más nuevo al más viejo, sin
// que tenga que entrar a cada canal.
//
// Se abre un listener por canal (son pocos: uno por escuela donde tiene un
// hijo, casi siempre uno o dos) y se combinan en memoria. Se hace así, y no con
// una consulta `in` sobre canalId, por dos razones: `in` está limitado a 30
// valores y, sobre todo, mantiene el patrón del resto de la app — solo filtros
// de igualdad y el orden resuelto en el cliente, para no necesitar índices
// compuestos en Firestore.
export function escucharAvisosDeCanales(
  canalIds: string[],
  callback: (avisos: Aviso[]) => void
): Unsubscribe {
  if (canalIds.length === 0) {
    callback([]);
    return () => {};
  }

  // Lo último recibido de cada canal, para poder rearmar la lista combinada
  // cada vez que uno de ellos cambia
  const porCanal = new Map<string, Aviso[]>();

  const emitir = () => {
    const todos = [...porCanal.values()].flat();
    todos.sort((a, b) => b.hora.toMillis() - a.hora.toMillis());
    callback(todos);
  };

  const bajas = canalIds.map((canalId) =>
    onSnapshot(
      query(collection(db, "avisos"), where("canalId", "==", canalId)),
      (snap) => {
        porCanal.set(
          canalId,
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Aviso)
        );
        emitir();
      },
      () => {
        // Un canal que falla no puede dejar sin avisos a los demás
        porCanal.set(canalId, []);
        emitir();
      }
    )
  );

  return () => bajas.forEach((baja) => baja());
}

// ============================================
// LADO DEL ADMIN (app móvil)
// ============================================
// El admin administra los canales desde la web; desde el teléfono solo publica
// avisos en los que ya existen. Es lo que necesita estando fuera de la oficina
// ("mañana no hay clases", "el bus va con retraso").

// --- Todos los canales activos, para elegir dónde publicar ---
export async function listarCanales(): Promise<Canal[]> {
  const snap = await getDocs(collection(db, "canales"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Canal)
    .filter((c) => c.activo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// --- Publicar un aviso ---
// `de` tiene que ser el uid del admin: la regla de Firestore exige que coincida
// con quien está autenticado (avisos: create if esAdmin() && de == request.auth.uid).
export async function publicarAviso(
  canalId: string,
  texto: string,
  de: string
): Promise<void> {
  await addDoc(collection(db, "avisos"), {
    canalId,
    texto: texto.trim(),
    de,
    hora: Timestamp.now(),
  });
}
