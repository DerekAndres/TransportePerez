import { doc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { listarRutas } from "./rutasService";
import { listarNinos } from "./ninosService";
import type { LugarRef, Nino, NinoEnRuta, Parada, Ruta } from "../types/models";

// Migra las rutas del formato viejo (ninoIds: string[]) al nuevo (ninos:
// NinoEnRuta[] + paradas: Parada[]), dejando a TODOS los niños como DIRECTOS
// (casa ↔ escuela según el turno; ninguno como transbordo). No toca 'ninoIds'.
// Idempotente: salta las rutas que ya tienen 'ninos'.

export interface ResumenMigracion {
  total: number;
  migradas: number;
  saltadas: number;
  errores: { ruta: string; motivo: string }[];
}

// Firestore permite como máximo 500 operaciones por batch.
const MAX_OPS_BATCH = 500;

// Caso DIRECTO por turno: mañana sube en casa y baja en escuela; tarde al revés.
function derivarNinos(ruta: Ruta, ninosPorId: Map<string, Nino>): NinoEnRuta[] {
  const esTarde = ruta.turno === "tarde";
  return (ruta.ninoIds ?? []).map((ninoId) => {
    const nino = ninosPorId.get(ninoId);
    if (!nino?.escuelaId) {
      throw new Error(`El niño ${nino?.nombre ?? ninoId} no tiene escuela asignada`);
    }
    const casa: LugarRef = { tipo: "casa", id: ninoId };
    const escuela: LugarRef = { tipo: "escuela", id: nino.escuelaId };
    return esTarde
      ? { ninoId, subeEn: escuela, bajaEn: casa }
      : { ninoId, subeEn: casa, bajaEn: escuela };
  });
}

// Paradas ordenadas: primero las subidas, luego las bajadas. Deduplica escuelas y
// puntos por id; las casas por COORDENADAS (dos hermanos en la misma casa → una
// sola parada; se guarda al primer hermano como representante).
function derivarParadas(ninos: NinoEnRuta[], ninosPorId: Map<string, Nino>): Parada[] {
  const claveDe = (l: LugarRef): string => {
    if (l.tipo === "casa") {
      const p = ninosPorId.get(l.id)?.parada;
      return p ? `casa:${p.lat},${p.lng}` : `casa:${l.id}`;
    }
    return `${l.tipo}:${l.id}`;
  };
  const vistos = new Set<string>();
  const lugares: LugarRef[] = [];
  const agregar = (l: LugarRef) => {
    const clave = claveDe(l);
    if (!vistos.has(clave)) {
      vistos.add(clave);
      lugares.push(l);
    }
  };
  ninos.forEach((n) => agregar(n.subeEn));
  ninos.forEach((n) => agregar(n.bajaEn));
  return lugares.map((lugar, i) => ({ lugar, orden: i + 1 }));
}

export async function migrarRutas(
  onProgreso: (procesadas: number, total: number) => void
): Promise<ResumenMigracion> {
  const [rutas, ninos] = await Promise.all([listarRutas(), listarNinos()]);
  const ninosPorId = new Map(ninos.map((n) => [n.id, n]));

  const resumen: ResumenMigracion = { total: rutas.length, migradas: 0, saltadas: 0, errores: [] };

  let batch = writeBatch(db);
  let ops = 0;

  for (let i = 0; i < rutas.length; i++) {
    const ruta = rutas[i];
    try {
      if (Array.isArray(ruta.ninos)) {
        // Ya está en formato nuevo → se salta (idempotencia)
        resumen.saltadas++;
      } else {
        const ninosEnRuta = derivarNinos(ruta, ninosPorId);
        const paradas = derivarParadas(ninosEnRuta, ninosPorId);
        batch.update(doc(db, "rutas", ruta.id), { ninos: ninosEnRuta, paradas });
        ops++;
        resumen.migradas++;
        if (ops >= MAX_OPS_BATCH) {
          await batch.commit();
          batch = writeBatch(db);
          ops = 0;
        }
      }
    } catch (e) {
      resumen.errores.push({ ruta: ruta.nombre || ruta.id, motivo: (e as Error).message });
    }
    onProgreso(i + 1, rutas.length);
  }

  if (ops > 0) await batch.commit();
  return resumen;
}
