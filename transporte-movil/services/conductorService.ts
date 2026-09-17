import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { fechaDeHoy } from "./viajesService";
import type {
  Bus,
  Escuela,
  LugarRef,
  Nino,
  NinoEnRuta,
  Punto,
  Ruta,
  Solicitud,
  Suplencia,
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

// ============================================
// QUÉ UNIDADES MANEJA HOY (SUPLENCIAS)
// ============================================
// Normalmente un conductor maneja SU unidad. Un día de suplencia cambia:
//   - si a su unidad hoy la cubre otro conductor, él NO la maneja (`meCubre`);
//   - si hoy cubre la unidad de otro, la maneja ADEMÁS de la suya (`cubro`).
// La asignación permanente (Bus.conductorId) nunca se toca: al día siguiente
// todo vuelve solo a la normalidad. Ver "SUPLENCIAS" en models.ts.
export interface UnidadesDelDia {
  buses: Bus[]; // las unidades que maneja HOY
  meCubre: Suplencia | null; // quién cubre hoy su unidad, si alguien la cubre
  cubro: Suplencia[]; // las unidades de otros que cubre hoy
}

// --- Las suplencias vigentes de hoy (una colección chica: pocas por día) ---
export async function listarSuplenciasDeHoy(): Promise<Suplencia[]> {
  const snap = await getDocs(
    query(collection(db, "suplencias"), where("fecha", "==", fechaDeHoy()))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Suplencia)
    .filter((s) => !s.cancelada);
}

export async function obtenerUnidadesDelDia(conductorId: string): Promise<UnidadesDelDia> {
  const [propia, suplencias] = await Promise.all([
    obtenerBusDelConductor(conductorId),
    listarSuplenciasDeHoy(),
  ]);

  const meCubre = propia
    ? (suplencias.find((s) => s.busId === propia.id && s.conductorId !== conductorId) ?? null)
    : null;
  const cubro = suplencias.filter((s) => s.conductorId === conductorId && s.busId !== propia?.id);

  // Las unidades que cubre se leen por id (cualquier cuenta activa puede leer buses)
  const ajenas = await Promise.all(cubro.map((s) => getDoc(doc(db, "buses", s.busId))));
  const busesCubiertos = ajenas
    .filter((d) => d.exists())
    .map((d) => ({ id: d.id, ...d.data() }) as Bus)
    .filter((b) => b.activo);

  return {
    buses: [...(propia && !meCubre ? [propia] : []), ...busesCubiertos],
    meCubre,
    cubro,
  };
}

// ============================================
// POR QUÉ EL CONDUCTOR NO VE SU RUTA
// ============================================
// Cuando la pantalla del conductor queda vacía hay CUATRO causas posibles, y
// hasta ahora las cuatro mostraban el mismo mensaje ("no tenés un bus
// asignado"), porque las consultas devolvían `null` o `[]` tanto si no había
// nada como si la consulta había fallado. Eso convertía un problema de cinco
// segundos en una búsqueda a ciegas entre el panel y la app.
//
// Ojo con un detalle de Firestore que causa exactamente este síntoma: un filtro
// de igualdad EXCLUYE los documentos que no tienen ese campo. Una ruta sin el
// campo `activa` no es "una ruta inactiva": es una ruta invisible para
// `where("activa","==",true)`, y sin embargo el panel la lista igual, porque
// allá no hay filtro. De ahí que el admin jure que la ruta existe y el conductor
// no la vea.
//
// Esta función repite las mismas consultas SIN los filtros de estado y compara,
// para poder decir qué pasó de verdad. Solo se llama cuando ya falló el camino
// normal, así que no cuesta lecturas en el uso diario.
export type DiagnosticoAsignacion =
  | { causa: "sin_bus" }
  | { causa: "bus_inactivo"; placa: string }
  | { causa: "sin_rutas"; placa: string }
  | { causa: "rutas_inactivas"; placa: string; cuantas: number }
  | { causa: "sin_permiso" }
  | { causa: "error" };

export async function diagnosticarAsignacion(
  conductorId: string,
  // Si el que llama YA tiene un error de Firestore (por ejemplo, el que devolvió
  // la suscripción a las rutas), se pasa acá: vale más que cualquier deducción.
  errorPrevio?: unknown
): Promise<DiagnosticoAsignacion> {
  if (errorPrevio) return causaDeError(errorPrevio);
  try {
    // Todos los buses de este conductor, ACTIVOS O NO
    const buses = await getDocs(
      query(collection(db, "buses"), where("conductorId", "==", conductorId))
    );
    if (buses.empty) return { causa: "sin_bus" };

    // Si hay varios, importa si alguno está activo
    const docsBus = buses.docs.map((d) => ({ id: d.id, ...d.data() }) as Bus);
    const activo = docsBus.find((b) => b.activo === true);
    if (!activo) return { causa: "bus_inactivo", placa: docsBus[0].placa ?? "(sin placa)" };

    // Todas las rutas de ese bus, ACTIVAS O NO
    const rutas = await getDocs(
      query(collection(db, "rutas"), where("busId", "==", activo.id))
    );
    if (rutas.empty) return { causa: "sin_rutas", placa: activo.placa };

    // Llegar acá significa que las rutas existen pero ninguna pasa el filtro
    // `activa == true` — porque están desactivadas o porque les falta el campo
    return { causa: "rutas_inactivas", placa: activo.placa, cuantas: rutas.size };
  } catch (e) {
    return causaDeError(e);
  }
}

// Las reglas de Firestore devuelven 'permission-denied'. Distinguirlo de un
// corte de internet importa: uno se arregla en las reglas y el otro esperando.
function causaDeError(e: unknown): DiagnosticoAsignacion {
  const codigo = (e as { code?: string })?.code ?? "";
  if (codigo.includes("permission")) return { causa: "sin_permiso" };
  return { causa: "error" };
}

// Traduce el diagnóstico a algo que el conductor pueda leerle por teléfono al
// administrador. Cada mensaje dice QUÉ pasa y QUÉ hay que tocar en el panel.
export function mensajeDeDiagnostico(d: DiagnosticoAsignacion): string {
  switch (d.causa) {
    case "sin_bus":
      return "Tu cuenta todavía no tiene una unidad asignada. En el panel: Buses → elegí la unidad → asignate como conductor.";
    case "bus_inactivo":
      return `Tu unidad ${d.placa} está DESACTIVADA en el panel. En Buses, prendé su interruptor para que vuelva a aparecer.`;
    case "sin_rutas":
      return `Tu unidad ${d.placa} no tiene ninguna ruta. En el panel: Rutas → Nueva ruta → asignale la unidad ${d.placa}.`;
    case "rutas_inactivas":
      return `Tu unidad ${d.placa} tiene ${d.cuantas} ${d.cuantas === 1 ? "ruta" : "rutas"}, pero ${d.cuantas === 1 ? "está desactivada" : "todas están desactivadas"}. En el panel: Rutas → prendé su interruptor.`;
    case "sin_permiso":
      return "La app no tiene permiso para leer las rutas. Avisale al administrador: hay que revisar las reglas de seguridad.";
    default:
      return "No se pudo consultar tu ruta. Revisá tu conexión y tocá Reintentar.";
  }
}

// --- Escucha EN TIEMPO REAL las rutas activas de varias unidades ---
// Un listener por unidad (normalmente es una sola; en un día de suplencia
// pueden ser dos), combinados en una lista. onSnapshot dispara en cada cambio:
// si el admin edita una ruta desde el panel, el conductor lo ve sin recargar.
// El segundo parámetro del callback llega SOLO si una consulta falló, para que
// un permiso denegado no se confunda con "esta unidad no tiene rutas".
export function escucharRutasDeBuses(
  busIds: string[],
  callback: (rutas: Ruta[], error?: unknown) => void
): Unsubscribe {
  const porBus = new Map<string, Ruta[]>();
  let ultimoError: unknown;

  const emitir = () => {
    if (porBus.size < busIds.length) return; // espera la primera respuesta de todas
    callback([...porBus.values()].flat(), ultimoError);
  };

  const desuscripciones = busIds.map((busId) =>
    onSnapshot(
      query(collection(db, "rutas"), where("busId", "==", busId), where("activa", "==", true)),
      (snap) => {
        porBus.set(busId, snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Ruta));
        emitir();
      },
      (error) => {
        ultimoError = error;
        porBus.set(busId, []);
        emitir();
      }
    )
  );

  return () => desuscripciones.forEach((desuscribir) => desuscribir());
}

// --- Los niños que lleva este conductor ---
// Las reglas de Firestore solo le dejan leer a los niños que tienen su uid en
// `conductorIds` (los de las rutas de las unidades que maneja, que el panel
// recalcula). La consulta tiene que decirlo con el mismo filtro: pedir "todos
// los niños activos" sería rechazado entero.
export async function listarNinosQueLlevo(conductorId: string): Promise<Nino[]> {
  const snap = await getDocs(
    query(collection(db, "ninos"), where("conductorIds", "array-contains", conductorId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Nino).filter((n) => n.activo);
}

// --- Los niños asignados a una ruta (ruta.ninoIds) ---
// Se traen los que lleva el conductor y se filtra en el cliente por los ids de
// la ruta. Devuelve además cuántos niños de la ruta NO se pudieron leer: eso
// quiere decir que el panel todavía no recalculó los accesos, y la pantalla lo
// AVISA (hoy.tsx) en vez de mostrar una lista incompleta en silencio, que es
// como se deja a un niño esperando en la parada.
export async function listarNinosDeRuta(
  conductorId: string,
  ninoIds: string[]
): Promise<{ ninos: Nino[]; sinAcceso: number }> {
  if (ninoIds.length === 0) return { ninos: [], sinAcceso: 0 };
  // Sin filtrar por activo en la consulta: un niño archivado que sigue en la
  // ruta se puede leer (no es un problema de acceso), solo no se muestra
  const snap = await getDocs(
    query(collection(db, "ninos"), where("conductorIds", "array-contains", conductorId))
  );
  const legibles = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Nino);
  const idsLegibles = new Set(legibles.map((n) => n.id));
  const pedidos = new Set(ninoIds);
  return {
    ninos: legibles.filter((n) => pedidos.has(n.id) && n.activo),
    sinAcceso: [...pedidos].filter((id) => !idsLegibles.has(id)).length,
  };
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
// Son los padres de los niños que lleva (los de sus rutas y los de la unidad
// que cubre si tiene una suplencia), más la administración. Se leen SOLO esos
// perfiles, uno por uno: las reglas no dejan descargar la lista de usuarios, y
// además es mucho más barato en lecturas.
export async function listarContactosConductor(
  conductorId: string
): Promise<{ padres: Usuario[]; admin: Usuario | null }> {
  const [ninos, snapAdmin] = await Promise.all([
    listarNinosQueLlevo(conductorId),
    getDocs(query(collection(db, "usuarios"), where("rol", "==", "admin"))),
  ]);

  const admin =
    snapAdmin.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Usuario)
      .find((u) => u.activo !== false) ?? null;

  const padreIds = [...new Set(ninos.map((n) => n.padreId).filter(Boolean))];
  const perfiles = await Promise.all(
    padreIds.map((id) => getDoc(doc(db, "usuarios", id)).catch(() => null))
  );
  const padres = perfiles
    .filter((snap) => !!snap?.exists())
    .map((snap) => ({ id: snap!.id, ...snap!.data() }) as Usuario);

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
