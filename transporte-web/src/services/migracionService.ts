import { doc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { auditar } from "./auditoriaService";
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

// Firestore permite como máximo 500 operaciones por lote; cada lote lleva además
// su registro de auditoría, así que se deja margen.
const TAMANO_LOTE = 450;

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

  // Primero se calcula todo y recién después se escribe: así cada lote puede
  // llevar su registro de auditoría con la lista exacta de rutas que toca
  // (cambiar los niños de una ruta es un cambio sensible).
  const actualizaciones: { id: string; ninos: NinoEnRuta[]; paradas: Parada[] }[] = [];

  for (let i = 0; i < rutas.length; i++) {
    const ruta = rutas[i];
    try {
      if (Array.isArray(ruta.ninos)) {
        // Ya está en formato nuevo → se salta (idempotencia)
        resumen.saltadas++;
      } else {
        const ninosEnRuta = derivarNinos(ruta, ninosPorId);
        actualizaciones.push({
          id: ruta.id,
          ninos: ninosEnRuta,
          paradas: derivarParadas(ninosEnRuta, ninosPorId),
        });
        resumen.migradas++;
      }
    } catch (e) {
      resumen.errores.push({ ruta: ruta.nombre || ruta.id, motivo: (e as Error).message });
    }
    onProgreso(i + 1, rutas.length);
  }

  for (let desde = 0; desde < actualizaciones.length; desde += TAMANO_LOTE) {
    const tanda = actualizaciones.slice(desde, desde + TAMANO_LOTE);
    const batch = writeBatch(db);
    const auditoriaId = auditar(
      batch,
      "rutas",
      "migrar",
      tanda.map((a) => a.id),
      "Migración al formato con paradas y transbordo (todos los niños quedan directos)"
    );
    tanda.forEach((a) =>
      batch.update(doc(db, "rutas", a.id), { ninos: a.ninos, paradas: a.paradas, auditoriaId })
    );
    await batch.commit();
  }

  return resumen;
}
