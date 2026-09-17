import {
  collection,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { auditar, auditarBorrado } from "./auditoriaService";
import { entradaDirecta } from "../utils/recorrido";
import type { CambioAuditado, Nino, NinoEnRuta, Ruta, Turno } from "../types/models";

// Qué niños van en una ruta y en qué unidad deciden a quién ve cada conductor en
// su app, así que toda escritura de rutas va con su registro de auditoría (ver
// auditoriaService.ts). Después de guardar, la pantalla recalcula los accesos de
// los conductores (accesoConductoresService.ts).

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
  // "HH:mm" o vacío. Solo informativa: el conductor la ve como su horario.
  horaSalida: string;
}

// --- Activa o desactiva una ruta ---
export async function cambiarActivaRuta(id: string, activa: boolean): Promise<void> {
  const lote = writeBatch(db);
  const auditoriaId = auditar(
    lote,
    "rutas",
    activa ? "activar" : "desactivar",
    [id],
    activa ? "Ruta reactivada" : "Ruta desactivada"
  );
  lote.update(doc(db, "rutas", id), { activa, auditoriaId });
  await lote.commit();
}

// Resumen de qué cambió en la lista de niños y en la unidad, para la auditoría
function cambiosDeRuta(previa: Partial<Ruta>, datos: DatosRuta): CambioAuditado[] {
  const cambios: CambioAuditado[] = [];
  const antes = new Set(previa.ninoIds ?? []);
  const despues = new Set(datos.ninoIds);
  const agregados = [...despues].filter((id) => !antes.has(id)).length;
  const quitados = [...antes].filter((id) => !despues.has(id)).length;
  if (agregados > 0 || quitados > 0) {
    cambios.push({
      campo: "niños",
      antes: `${antes.size}`,
      despues: `${despues.size} (agregó ${agregados}, quitó ${quitados})`,
    });
  }
  if ((previa.busId ?? "") !== datos.busId) {
    cambios.push({ campo: "busId", antes: previa.busId ?? "—", despues: datos.busId });
  }
  if ((previa.horaSalida ?? "") !== datos.horaSalida) {
    cambios.push({ campo: "horaSalida", antes: previa.horaSalida || "—", despues: datos.horaSalida || "—" });
  }
  return cambios;
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
  // doc() sobre la colección genera el id en el cliente, así la ruta nueva
  // entra en el mismo lote que sus receptoras (addDoc no se puede loteear).
  const ref = rutaId ? doc(db, "rutas", rutaId) : doc(collection(db, "rutas"));
  const previa: Partial<Ruta> = rutaId ? ((await getDoc(ref)).data() ?? {}) : {};

  // UN registro de auditoría para todo el lote: la ruta y las receptoras de sus
  // transbordos cambian juntas, así que quedan anotadas juntas
  const auditoriaId = auditar(
    lote,
    "rutas",
    rutaId ? "editar" : "crear",
    [ref.id, ...receptoras.map((r) => r.rutaId)],
    `${rutaId ? "Editó" : "Creó"} la ruta ${datos.nombre}` +
      (receptoras.length > 0
        ? ` y actualizó ${receptoras.length} ruta(s) que reciben sus transbordos`
        : ""),
    cambiosDeRuta(previa, datos)
  );

  // La hora de salida es opcional: vacía se BORRA del documento (Firestore no
  // acepta undefined, y dejar "" guardado sería un valor que no dice nada)
  const { horaSalida, ...resto } = datos;
  if (rutaId) {
    lote.update(ref, { ...resto, horaSalida: horaSalida || deleteField(), auditoriaId });
  } else {
    lote.set(ref, { ...resto, ...(horaSalida ? { horaSalida } : {}), activa: true, auditoriaId });
  }

  for (const receptora of receptoras) {
    lote.update(doc(db, "rutas", receptora.rutaId), {
      ninoIds: receptora.ninoIds,
      ninos: receptora.ninos,
      auditoriaId,
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
//
// Va con DOS registros de auditoría: el del borrado (con id deducible, porque la
// ruta borrada no tiene dónde anotarlo) y el de las rutas que se tocan.
export async function borrarRuta(
  efectos: EfectoEnOtraRuta[],
  rutaId: string,
  rutaNombre: string
): Promise<void> {
  const lote = writeBatch(db);
  auditarBorrado(
    lote,
    "rutas",
    rutaId,
    `Borró la ruta ${rutaNombre}` +
      (efectos.length > 0 ? ` y deshizo sus transbordos en ${efectos.length} ruta(s)` : "")
  );
  lote.delete(doc(db, "rutas", rutaId));

  if (efectos.length > 0) {
    const auditoriaId = auditar(
      lote,
      "rutas",
      "deshacer_transbordo",
      efectos.map((e) => e.rutaId),
      `Transbordos deshechos al borrar la ruta ${rutaNombre}: ` +
        efectos
          .map((e) => `${e.rutaNombre} (sin bus: ${e.quitados.length}, pasan a directo: ${e.vueltosDirectos.length})`)
          .join("; ")
    );
    for (const efecto of efectos) {
      lote.update(doc(db, "rutas", efecto.rutaId), {
        ninoIds: efecto.ninoIds,
        ninos: efecto.ninos,
        auditoriaId,
      });
    }
  }
  await lote.commit();
}
