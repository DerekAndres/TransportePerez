import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Bus,
  Escuela,
  LugarRef,
  Nino,
  NinoEnRuta,
  Punto,
  Ruta,
  Solicitud,
  TipoLugar,
  Turno,
  Usuario,
} from "../types/models";

// Nota: estas consultas usan solo filtros de igualdad (sin orderBy en servidor)
// a propósito: así Firestore no exige índices compuestos. El filtrado fino y el
// orden se resuelven en el cliente, que para estos volúmenes (decenas de docs)
// es barato.

// --- Busca el bus activo asignado a este conductor ---
export async function obtenerBusDelConductor(conductorId: string): Promise<Bus | null> {
  const snap = await getDocs(
    query(
      collection(db, "buses"),
      where("conductorId", "==", conductorId),
      where("activo", "==", true)
    )
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Bus;
}

// --- Escucha EN TIEMPO REAL las rutas activas de un bus ---
// onSnapshot dispara el callback en cada cambio (el admin edita la ruta desde el
// panel → el conductor lo ve sin recargar). Devuelve la función para desuscribir.
export function escucharRutasDelBus(
  busId: string,
  callback: (rutas: Ruta[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "rutas"), where("busId", "==", busId), where("activa", "==", true)),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Ruta)),
    () => callback([])
  );
}

// --- Los niños asignados a la ruta (ruta.ninoIds) ---
// Trae los niños activos y filtra por los ids de la ruta en el cliente (evita
// consultar por lista de ids, que en Firestore es limitado).
export async function listarNinosDeRuta(ninoIds: string[]): Promise<Nino[]> {
  if (ninoIds.length === 0) return [];
  const snap = await getDocs(query(collection(db, "ninos"), where("activo", "==", true)));
  const permitidos = new Set(ninoIds);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Nino)
    .filter((n) => permitidos.has(n.id));
}

// --- Las escuelas de la ruta (ruta.escuelaIds), para nombres y "Llegué a la escuela" ---
export async function listarEscuelasDeRuta(escuelaIds: string[]): Promise<Escuela[]> {
  if (escuelaIds.length === 0) return [];
  const snap = await getDocs(collection(db, "escuelas"));
  const permitidos = new Set(escuelaIds);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Escuela)
    .filter((e) => permitidos.has(e.id));
}

// --- Ids de los puntos de transbordo que aparecen en la ruta (en subeEn o bajaEn) ---
// Si la lista vuelve vacía, la ruta no tiene transbordo (el caso normal).
export function puntoIdsDeRuta(ruta: Ruta): string[] {
  const ids = new Set<string>();
  (ruta.ninos ?? []).forEach((n) => {
    if (n.subeEn.tipo === "punto") ids.add(n.subeEn.id);
    if (n.bajaEn.tipo === "punto") ids.add(n.bajaEn.id);
  });
  return [...ids];
}

// --- Los puntos de transbordo por id (para mostrar su nombre) ---
export async function listarPuntosPorIds(ids: string[]): Promise<Punto[]> {
  if (ids.length === 0) return [];
  const snap = await getDocs(collection(db, "puntos"));
  const permitidos = new Set(ids);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Punto)
    .filter((p) => permitidos.has(p.id));
}

// --- Contactos de chat del conductor (Fase 7): con quién puede escribirse ---
// Son los padres de los niños de sus rutas activas (mañana y tarde), más la
// administración. Se lee todo con filtros de igualdad, sin índices compuestos.
export async function listarContactosConductor(
  conductorId: string
): Promise<{ padres: Usuario[]; admin: Usuario | null }> {
  const [usuariosSnap, bus] = await Promise.all([
    getDocs(collection(db, "usuarios")),
    obtenerBusDelConductor(conductorId),
  ]);
  const usuarios = usuariosSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Usuario);
  const admin = usuarios.find((u) => u.rol === "admin" && u.activo) ?? null;

  if (!bus) return { padres: [], admin };

  // Niños de todas las rutas activas del bus → sus padres (sin repetir)
  const [rutasSnap, ninosSnap] = await Promise.all([
    getDocs(query(collection(db, "rutas"), where("busId", "==", bus.id), where("activa", "==", true))),
    getDocs(query(collection(db, "ninos"), where("activo", "==", true))),
  ]);
  const ninoIds = new Set<string>();
  rutasSnap.docs.forEach((d) => (d.data() as Ruta).ninoIds?.forEach((id) => ninoIds.add(id)));
  const padreIds = new Set<string>();
  ninosSnap.docs.forEach((d) => {
    const nino = d.data() as Nino;
    if (ninoIds.has(d.id) && nino.padreId) padreIds.add(nino.padreId);
  });

  const padres = usuarios.filter((u) => u.rol === "padre" && padreIds.has(u.id));
  return { padres, admin };
}

// --- Una parada del recorrido para el mapa ---
// En el mapa el marcador muestra SOLO el número de orden (el conductor va en
// orden, no necesita leer nada mientras maneja). Al tocarlo se abre la ficha con
// todo esto: nombre del lugar, punto de referencia y los niños que suben o bajan
// ahí, con su foto — para que el conductor confirme a quién está buscando.
export interface NinoEnParada {
  id: string;
  nombre: string;
  foto?: string;
}

export interface ParadaRecorrido {
  nombre: string;
  lat: number;
  lng: number;
  tipo: TipoLugar;
  referencia?: string; // punto de referencia escrito por el padre
  ninos: NinoEnParada[]; // quiénes suben o bajan en esta parada
}

// --- Deriva el recorrido ordenado de la ruta para mostrarlo en el mapa ---
// Se arma con dónde sube y dónde baja cada niño: primero las subidas, después las
// bajadas, con el punto de transbordo en el medio (ahí se encuentran los dos buses
// entre recoger y entregar). Mañana: casas → punto → escuelas; tarde: al revés.
// Es el orden sugerido de visita, no una optimización del camino.
// `cambiosHoy` son las solicitudes de cambio de UN DÍA aprobadas para hoy
// (ninoId → solicitud). Si un niño tiene una, el mapa muestra el lugar NUEVO en
// el lado que corresponda, no el de su perfil. Como no se guarda nada en el
// niño, al día siguiente el recorrido vuelve solo a la normalidad.
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

  // Ruta vieja sin 'ninos': todos van directos (casa↔escuela según el turno)
  const entradas: NinoEnRuta[] =
    ruta.ninos ??
    ninos.map((n) => {
      const casa: LugarRef = { tipo: "casa", id: n.id };
      const escuela: LugarRef = { tipo: "escuela", id: n.escuelaId ?? "" };
      return turno === "tarde"
        ? { ninoId: n.id, subeEn: escuela, bajaEn: casa }
        : { ninoId: n.id, subeEn: casa, bajaEn: escuela };
    });

  // Las paradas se acumulan por clave (hermanos en la misma casa = una parada) y
  // `orden` conserva el orden en que aparecieron
  const porClave = new Map<string, ParadaRecorrido>();
  const orden: string[] = [];

  // Resuelve una referencia de lugar a coordenadas + una clave para no repetir.
  // Hermanos en la misma casa = una sola parada (dedup por coordenadas).
  // `esBajada` importa para las casas: en la TARDE un niño puede entregarse en
  // un lugar distinto de donde se recoge (nino.paradaTarde, ej. donde la abuela).
  const resolver = (ref: LugarRef, esBajada: boolean): { clave: string; parada: ParadaRecorrido } | null => {
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
        },
      };
    }
    if (ref.tipo === "escuela") {
      const e = escuelasPorId.get(ref.id);
      if (!e) return null;
      return {
        clave: `escuela:${e.id}`,
        parada: { nombre: e.nombre, lat: e.lat, lng: e.lng, tipo: "escuela", ninos: [] },
      };
    }
    const p = puntosPorId.get(ref.id);
    if (!p) return null;
    return {
      clave: `punto:${p.id}`,
      parada: { nombre: p.nombre, lat: p.lat, lng: p.lng, tipo: "punto", ninos: [] },
    };
  };

  // Se recorre por ENTRADA (no por referencia suelta) para saber qué niño
  // corresponde a cada parada y poder mostrarlo en la ficha del mapa
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
      if (nino && !parada.ninos.some((x) => x.id === nino.id)) {
        parada.ninos.push({ id: nino.id, nombre: nino.nombre, foto: nino.foto });
      }
    });

  const subidas = entradas.map((n) => ({ ninoId: n.ninoId, ref: n.subeEn }));
  const bajadas = entradas.map((n) => ({ ninoId: n.ninoId, ref: n.bajaEn }));
  agregar(subidas.filter((x) => x.ref.tipo !== "punto"), false); // recoger (casas o escuelas)
  agregar(subidas.filter((x) => x.ref.tipo === "punto"), false); // recibir en el punto
  agregar(bajadas.filter((x) => x.ref.tipo === "punto"), true); // entregar en el punto
  agregar(bajadas.filter((x) => x.ref.tipo !== "punto"), true); // dejar (escuelas o casas)

  const recorrido = orden.map((clave) => porClave.get(clave)!);
  return recorrido;
}
