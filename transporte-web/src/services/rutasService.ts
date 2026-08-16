import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { entradaDirecta } from "../utils/recorrido";
import type { Nino, NinoEnRuta, Ruta, Turno } from "../types/models";

// --- Lista todas las rutas, ordenadas por nombre ---
export async function listarRutas(): Promise<Ruta[]> {
  const snap = await getDocs(query(collection(db, "rutas"), orderBy("nombre")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Ruta);
}

// Una ruta = una unidad (bus) + un turno (mañana/tarde) + una o varias escuelas +
// los niños marcados. El recorrido lo arma el conductor con las casas de esos niños.
// 'ninos' (NinoEnRuta[]) guarda, por niño, dónde sube y dónde baja EN ESTA RUTA —
// por defecto directo (casa↔escuela), o un punto de transbordo si el admin lo marca.
// Se mantiene 'ninoIds' en paralelo (lo usan el móvil y la consulta del padre).
interface DatosRuta {
  nombre: string;
  busId: string;
  turno: Turno;
  escuelaIds: string[];
  ninoIds: string[];
  ninos: NinoEnRuta[];
}

// --- Crea una ruta ---
export async function crearRuta(datos: DatosRuta): Promise<void> {
  await addDoc(collection(db, "rutas"), { ...datos, activa: true });
}

// --- Actualiza una ruta existente ---
export async function actualizarRuta(id: string, datos: DatosRuta): Promise<void> {
  await updateDoc(doc(db, "rutas", id), { ...datos });
}

// --- Activa o desactiva una ruta ---
export async function cambiarActivaRuta(id: string, activa: boolean): Promise<void> {
  await updateDoc(doc(db, "rutas", id), { activa });
}

// --- Actualiza SOLO los niños de una ruta ---
// Se usa al sincronizar un transbordo: cuando el admin guarda la ruta que ENTREGA
// al niño en un punto, la ruta del bus que lo RECIBE se actualiza sola con esta
// función (el admin nunca edita las dos rutas a mano).
export async function actualizarNinosDeRuta(
  id: string,
  ninoIds: string[],
  ninos: NinoEnRuta[]
): Promise<void> {
  await updateDoc(doc(db, "rutas", id), { ninoIds, ninos });
}

// Cómo queda la lista de niños de una ruta RECEPTORA después de un transbordo.
export interface CambioReceptora {
  rutaId: string;
  ninoIds: string[];
  ninos: NinoEnRuta[];
}

// --- Guarda la ruta Y las rutas receptoras de sus transbordos, TODO JUNTO ---
//
// Por qué un lote (writeBatch) y no varias escrituras seguidas: un transbordo
// toca DOS rutas — la que entrega al niño en el punto y la que lo recoge ahí.
// Si se escribieran por separado y la segunda fallara (se cortó internet a
// mitad de camino), quedaría un niño al que un bus deja en un punto donde no lo
// recoge nadie. El lote es atómico: o se guardan las dos rutas, o no se guarda
// ninguna. El tope de Firestore es de 500 operaciones por lote y acá son la
// ruta editada más un puñado de receptoras, así que nunca se acerca.
//
// `rutaId` en null significa "es una ruta nueva".
export async function guardarRutaConReceptoras(
  rutaId: string | null,
  datos: DatosRuta,
  receptoras: CambioReceptora[]
): Promise<void> {
  const lote = writeBatch(db);

  if (rutaId) {
    lote.update(doc(db, "rutas", rutaId), { ...datos });
  } else {
    // doc() sobre la colección genera el id en el cliente, así la ruta nueva
    // entra en el mismo lote que sus receptoras (addDoc no se puede loteear).
    lote.set(doc(collection(db, "rutas")), { ...datos, activa: true });
  }

  for (const receptora of receptoras) {
    lote.update(doc(db, "rutas", receptora.rutaId), {
      ninoIds: receptora.ninoIds,
      ninos: receptora.ninos,
    });
  }

  await lote.commit();
}

// ============================================================================
// BORRAR UNA RUTA
// ============================================================================
// Borrar una ruta no es solo borrar su documento: si la ruta participa de un
// TRANSBORDO, la ruta apareada queda rota. Hay dos casos y cada uno se arregla
// distinto:
//
//   A) La ruta que se borra ENTREGA a un niño en un punto, y otra ruta lo
//      RECIBE ahí. Al borrarla, nadie deja al niño en el punto → el otro bus lo
//      estaría esperando para siempre. Se lo saca de la ruta receptora y el
//      niño queda sin bus (aparece en el aviso de "niños sin ruta").
//
//   B) La ruta que se borra RECIBE a un niño en un punto, y otra ruta lo
//      ENTREGA ahí. Al borrarla, el otro bus deja al niño en un punto donde no
//      lo recoge nadie. Si esa ruta emisora pasa por la escuela del niño, se lo
//      deja DIRECTO (la mejor salida: sigue viajando). Si no pasa, se lo saca.
//
// Todo se escribe en un solo lote: o se borra la ruta y se arreglan las otras,
// o no pasa nada.

// Cómo queda otra ruta después de deshacer el transbordo que la unía a esta
export interface EfectoEnOtraRuta {
  rutaId: string;
  rutaNombre: string;
  quitados: string[]; // ninoIds que se quedan sin bus
  vueltosDirectos: string[]; // ninoIds que pasan a viajar directo en esa ruta
  ninoIds: string[]; // cómo queda la lista final
  ninos: NinoEnRuta[];
}

export interface ImpactoBorradoRuta {
  viajes: number; // viajes históricos que quedarían sin su ruta
  otrasRutas: EfectoEnOtraRuta[];
}

// Calcula qué pasaría al borrar la ruta. Es una función pura para poder
// mostrarla en la confirmación ANTES de tocar nada.
export function calcularEfectosEnOtrasRutas(
  ruta: Ruta,
  rutas: Ruta[],
  ninos: Nino[]
): EfectoEnOtraRuta[] {
  const turno = ruta.turno;
  if (!turno) return [];
  const ninosPorId = new Map(ninos.map((n) => [n.id, n]));
  const propias = ruta.ninos ?? [];

  // Puntos donde ESTA ruta entrega, y puntos donde ESTA ruta recibe
  const entregaEn = propias.filter((n) => n.bajaEn.tipo === "punto");
  const recibeEn = propias.filter((n) => n.subeEn.tipo === "punto");

  const efectos: EfectoEnOtraRuta[] = [];

  for (const otra of rutas) {
    if (otra.id === ruta.id || otra.turno !== turno) continue;
    const entradas = otra.ninos ?? [];
    const quitados: string[] = [];
    const vueltosDirectos: string[] = [];

    const nuevas = entradas.flatMap((entrada): NinoEnRuta[] => {
      // Caso A: la otra ruta lo RECIBE en un punto donde esta lo entregaba
      const perdioQuienLoTrae =
        entrada.subeEn.tipo === "punto" &&
        entregaEn.some(
          (e) => e.ninoId === entrada.ninoId && e.bajaEn.id === entrada.subeEn.id
        );
      if (perdioQuienLoTrae) {
        quitados.push(entrada.ninoId);
        return [];
      }

      // Caso B: la otra ruta lo ENTREGA en un punto donde esta lo recibía
      const perdioQuienLoSigue =
        entrada.bajaEn.tipo === "punto" &&
        recibeEn.some(
          (r) => r.ninoId === entrada.ninoId && r.subeEn.id === entrada.bajaEn.id
        );
      if (perdioQuienLoSigue) {
        const nino = ninosPorId.get(entrada.ninoId);
        const sirveSuEscuela =
          !!nino?.escuelaId && (otra.escuelaIds ?? []).includes(nino.escuelaId);
        if (nino && sirveSuEscuela) {
          vueltosDirectos.push(entrada.ninoId);
          return [entradaDirecta(nino, turno)];
        }
        quitados.push(entrada.ninoId);
        return [];
      }

      return [entrada];
    });

    if (quitados.length === 0 && vueltosDirectos.length === 0) continue;

    efectos.push({
      rutaId: otra.id,
      rutaNombre: otra.nombre,
      quitados,
      vueltosDirectos,
      ninos: nuevas,
      ninoIds: nuevas.map((n) => n.ninoId),
    });
  }

  return efectos;
}

// Consulta cuántos viajes históricos tiene la ruta. getCountFromServer cuenta en
// el servidor: no descarga los documentos, así que es barato en cuota.
export async function contarViajesDeRuta(rutaId: string): Promise<number> {
  const snap = await getCountFromServer(
    query(collection(db, "viajes"), where("rutaId", "==", rutaId))
  );
  return snap.data().count;
}

// Todo el análisis junto, para armar la pantalla de confirmación
export async function analizarBorradoDeRuta(
  ruta: Ruta,
  rutas: Ruta[],
  ninos: Nino[]
): Promise<ImpactoBorradoRuta> {
  return {
    viajes: await contarViajesDeRuta(ruta.id),
    otrasRutas: calcularEfectosEnOtrasRutas(ruta, rutas, ninos),
  };
}

// --- Borra la ruta y deshace sus transbordos, todo en un lote atómico ---
// Los VIAJES históricos NO se borran: son el registro de un servicio que sí
// ocurrió y los reportes se apoyan en ellos. Quedan apuntando a una ruta que ya
// no existe, y por eso la confirmación avisa cuántos son.
export async function borrarRuta(efectos: EfectoEnOtraRuta[], rutaId: string): Promise<void> {
  const lote = writeBatch(db);
  lote.delete(doc(db, "rutas", rutaId));
  for (const efecto of efectos) {
    lote.update(doc(db, "rutas", efecto.rutaId), {
      ninoIds: efecto.ninoIds,
      ninos: efecto.ninos,
    });
  }
  await lote.commit();
}
