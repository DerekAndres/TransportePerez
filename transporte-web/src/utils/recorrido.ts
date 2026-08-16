import type {
  Escuela,
  LugarRef,
  Nino,
  NinoEnRuta,
  Punto,
  Ruta,
  Solicitud,
  TipoLugar,
  Turno,
} from "../types/models";

// ============================================
// RECORRIDO DE UNA RUTA (para el mapa del admin)
// ============================================
// Es la MISMA derivación que usa la app del conductor
// (transporte-movil/services/conductorService.ts → derivarRecorrido), copiada
// acá para que el admin vea en Supervisión exactamente el mismo recorrido que
// ve el conductor en su teléfono. Los dos proyectos son independientes y ya
// duplican models.ts por la misma razón: si se cambia la lógica de un lado, hay
// que cambiarla del otro.

export interface NinoEnParada {
  id: string;
  nombre: string;
  foto?: string;
}

// Cómo viaja un niño DIRECTO (el caso normal, sin transbordo): en la mañana
// sube en su casa y baja en su escuela; en la tarde, al revés. Vive acá porque
// lo necesitan tanto la derivación del recorrido como la limpieza que hace el
// borrado de una ruta cuando deshace un transbordo.
export function entradaDirecta(nino: Nino, turno: Turno): NinoEnRuta {
  const casa: LugarRef = { tipo: "casa", id: nino.id };
  const escuela: LugarRef = { tipo: "escuela", id: nino.escuelaId ?? "" };
  return turno === "tarde"
    ? { ninoId: nino.id, subeEn: escuela, bajaEn: casa }
    : { ninoId: nino.id, subeEn: casa, bajaEn: escuela };
}

export interface ParadaRecorrido {
  nombre: string;
  lat: number;
  lng: number;
  tipo: TipoLugar;
  referencia?: string; // punto de referencia escrito por el padre
  ninos: NinoEnParada[]; // quiénes suben o bajan en esta parada (todos)
  // Los mismos niños separados por lado del viaje. El mapa muestra `ninos`
  // (le da igual el lado), pero el armador de rutas necesita distinguirlos para
  // mostrar "Recoge" y "Entrega" por separado. Una parada puede tener las dos
  // cosas: un punto de transbordo donde el bus deja a unos y recoge a otros.
  suben: NinoEnParada[];
  bajan: NinoEnParada[];
}

// Arma el recorrido ordenado: primero las subidas, después las bajadas, con el
// punto de transbordo en el medio. Mañana: casas → punto → escuelas; tarde: al
// revés. Es el orden sugerido de visita, no una optimización del camino.
//
// `cambiosHoy` (ninoId → solicitud) son los cambios de ubicación de UN DÍA
// aprobados para hoy: mueven la parada al lugar nuevo solo en esa fecha.
export function derivarRecorrido(
  ruta: Ruta,
  ninos: Nino[],
  escuelas: Escuela[],
  puntos: Punto[],
  turno: Turno,
  cambiosHoy?: Map<string, Solicitud>
): ParadaRecorrido[] {
  const ninosPorId = new Map(ninos.map((n) => [n.id, n]));
  const escuelasPorId = new Map(escuelas.map((e) => [e.id, e]));
  const puntosPorId = new Map(puntos.map((p) => [p.id, p]));

  // Solo los niños que están en esta ruta
  const idsDeRuta = new Set(ruta.ninoIds ?? []);
  const ninosDeRuta = ninos.filter((n) => idsDeRuta.has(n.id));

  // Ruta vieja sin 'ninos': todos van directos (casa↔escuela según el turno)
  const entradas: NinoEnRuta[] =
    ruta.ninos ?? ninosDeRuta.map((n) => entradaDirecta(n, turno));

  const porClave = new Map<string, ParadaRecorrido>();
  const orden: string[] = [];

  const resolver = (
    ref: LugarRef,
    esBajada: boolean
  ): { clave: string; parada: ParadaRecorrido } | null => {
    if (ref.tipo === "casa") {
      const nino = ninosPorId.get(ref.id);
      const habitual =
        esBajada && turno === "tarde" ? (nino?.paradaTarde ?? nino?.parada) : nino?.parada;

      // ¿Hay un cambio aprobado para hoy que afecte este lado del viaje?
      const cambio = cambiosHoy?.get(ref.id);
      const afectaEsteLado =
        cambio?.alcance === "ambas" ||
        (esBajada ? cambio?.alcance === "entrega" : cambio?.alcance === "recogida");
      const casa = afectaEsteLado && cambio?.nuevaUbicacion ? cambio.nuevaUbicacion : habitual;
      if (!casa) return null;
      return {
        clave: `casa:${casa.lat},${casa.lng}`,
        parada: {
          nombre: afectaEsteLado ? `${casa.nombre} (solo hoy)` : casa.nombre,
          lat: casa.lat,
          lng: casa.lng,
          tipo: "casa",
          referencia: casa.referencia,
          ninos: [],
          suben: [],
          bajan: [],
        },
      };
    }
    if (ref.tipo === "escuela") {
      const e = escuelasPorId.get(ref.id);
      if (!e) return null;
      return {
        clave: `escuela:${e.id}`,
        parada: {
          nombre: e.nombre,
          lat: e.lat,
          lng: e.lng,
          tipo: "escuela",
          ninos: [],
          suben: [],
          bajan: [],
        },
      };
    }
    const p = puntosPorId.get(ref.id);
    if (!p) return null;
    return {
      clave: `punto:${p.id}`,
      parada: {
        nombre: p.nombre,
        lat: p.lat,
        lng: p.lng,
        tipo: "punto",
        ninos: [],
        suben: [],
        bajan: [],
      },
    };
  };

  // Se recorre por ENTRADA para saber qué niño corresponde a cada parada
  const agregar = (items: { ninoId: string; ref: LugarRef }[], esBajada: boolean) =>
    items.forEach(({ ninoId, ref }) => {
      const r = resolver(ref, esBajada);
      if (!r) return;
      let parada = porClave.get(r.clave);
      if (!parada) {
        parada = r.parada;
        porClave.set(r.clave, parada);
        orden.push(r.clave);
      }
      const nino = ninosPorId.get(ninoId);
      if (!nino) return;
      const entrada: NinoEnParada = { id: nino.id, nombre: nino.nombre, foto: nino.foto };
      if (!parada.ninos.some((x) => x.id === nino.id)) parada.ninos.push(entrada);
      const lado = esBajada ? parada.bajan : parada.suben;
      if (!lado.some((x) => x.id === nino.id)) lado.push(entrada);
    });

  const subidas = entradas.map((n) => ({ ninoId: n.ninoId, ref: n.subeEn }));
  const bajadas = entradas.map((n) => ({ ninoId: n.ninoId, ref: n.bajaEn }));
  agregar(subidas.filter((x) => x.ref.tipo !== "punto"), false); // recoger
  agregar(subidas.filter((x) => x.ref.tipo === "punto"), false); // recibir en el punto
  agregar(bajadas.filter((x) => x.ref.tipo === "punto"), true); // entregar en el punto
  agregar(bajadas.filter((x) => x.ref.tipo !== "punto"), true); // dejar

  return orden.map((clave) => porClave.get(clave)!);
}
