import { Fragment, useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Collapse,
  Flex,
  Group,
  Modal,
  MultiSelect,
  Paper,
  Progress,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowsExchange,
  IconChevronDown,
  IconChevronRight,
  IconDeviceFloppy,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";
import MapaArmador, { type CandidatoEnMapa } from "./MapaArmador";
import { guardarRutaConReceptoras, type CambioReceptora } from "../services/rutasService";
import { derivarRecorrido } from "../utils/recorrido";
import { distanciaAlMasCercano, formatearDistancia, type Coordenada } from "../utils/geo";
import { TURNOS, etiquetaTurno, viajaEnTurno } from "../utils/turnos";
import type {
  Bus,
  Escuela,
  LugarRef,
  Nino,
  NinoEnRuta,
  Punto,
  Ruta,
  Turno,
} from "../types/models";

// ============================================================================
// ARMADOR DE RUTAS
// ============================================================================
// Es una PÁGINA (no un modal): el menú lateral del panel queda a la vista, así
// el admin no siente que entró en otro programa y puede salir por donde entró.
//
// Se lee de izquierda a derecha, como se arma una ruta de verdad:
//   1. Los datos del bus (unidad, turno, escuelas).
//   2. Los niños que se pueden subir — por defecto SOLO los que no tienen bus,
//      agrupados por zona y ordenados por cercanía a lo que el bus ya lleva.
//      Con más de 100 niños, una lista plana de todos es inusable.
//   3. El recorrido que va quedando, numerado IGUAL que el mapa de abajo, tal
//      como después lo ve el conductor en su teléfono.

// Un transbordo se configura SOLO desde la ruta que ENTREGA al niño: el admin elige
// el niño, el punto donde cambia de bus, y el bus (ruta del mismo turno) que lo
// sigue. La ruta receptora se actualiza sola al guardar — el admin nunca edita las
// dos rutas a mano, así no pueden quedar desparejas.
export interface Transbordo {
  ninoId: string;
  puntoId: string;
  rutaDestinoId: string; // ruta (mismo turno, otro bus) que recibe al niño en el punto
}

// Extremos del caso directo según el turno: mañana casa→escuela, tarde escuela→casa.
function extremosDirecto(
  ninoId: string,
  turno: Turno,
  ninosPorId: Map<string, Nino>
): { origen: LugarRef; destino: LugarRef } {
  const casa: LugarRef = { tipo: "casa", id: ninoId };
  const escuela: LugarRef = { tipo: "escuela", id: ninosPorId.get(ninoId)?.escuelaId ?? "" };
  return turno === "tarde" ? { origen: escuela, destino: casa } : { origen: casa, destino: escuela };
}

// Niño directo: sube en su origen normal y baja en su destino normal.
function directoEnRuta(ninoId: string, turno: Turno, ninosPorId: Map<string, Nino>): NinoEnRuta {
  const { origen, destino } = extremosDirecto(ninoId, turno, ninosPorId);
  return { ninoId, subeEn: origen, bajaEn: destino };
}

// En la ruta que ENTREGA: el niño sube en su origen normal y baja en el punto.
function entregaEnRuta(t: Transbordo, turno: Turno, ninosPorId: Map<string, Nino>): NinoEnRuta {
  return {
    ninoId: t.ninoId,
    subeEn: extremosDirecto(t.ninoId, turno, ninosPorId).origen,
    bajaEn: { tipo: "punto", id: t.puntoId },
  };
}

// En la ruta que RECIBE: el niño sube en el punto y baja en su destino normal.
function receptorEnRuta(t: Transbordo, turno: Turno, ninosPorId: Map<string, Nino>): NinoEnRuta {
  return {
    ninoId: t.ninoId,
    subeEn: { tipo: "punto", id: t.puntoId },
    bajaEn: extremosDirecto(t.ninoId, turno, ninosPorId).destino,
  };
}

// Reconstruye los transbordos que ENTREGA esta ruta (para editar). El bus receptor
// no se guarda en la ruta: se encuentra buscando qué otra ruta del mismo turno
// recibe al niño (subeEn = el mismo punto). Como las dos rutas se escriben juntas
// al guardar, siempre están apareadas.
function derivarTransbordos(ruta: Ruta, todas: Ruta[]): Transbordo[] {
  return (ruta.ninos ?? [])
    .filter((n) => n.bajaEn.tipo === "punto")
    .map((n) => {
      const destino = todas.find(
        (r) =>
          r.id !== ruta.id &&
          r.turno === ruta.turno &&
          (r.ninos ?? []).some(
            (x) =>
              x.ninoId === n.ninoId && x.subeEn.tipo === "punto" && x.subeEn.id === n.bajaEn.id
          )
      );
      return { ninoId: n.ninoId, puntoId: n.bajaEn.id, rutaDestinoId: destino?.id ?? "" };
    });
}

// Los niños que esta ruta RECIBE en un punto. Se muestran solo lectura: el
// transbordo se configura (y se quita) desde la ruta que lo entrega.
function derivarRecibidos(ruta: Ruta): NinoEnRuta[] {
  return (ruta.ninos ?? []).filter((n) => n.subeEn.tipo === "punto");
}

// Cómo quedan las rutas RECEPTORAS después de los cambios de transbordo.
// Es una función pura: devuelve las escrituras que hay que hacer, y quien la
// llama las manda todas juntas en un lote (ver guardarRutaConReceptoras).
// Trabaja sobre una copia local por ruta para que varios cambios sobre la MISMA
// receptora se acumulen en una sola escritura.
function calcularCambiosReceptoras(
  previos: Transbordo[],
  actuales: Transbordo[],
  rutas: Ruta[],
  turno: Turno,
  ninosPorId: Map<string, Nino>
): CambioReceptora[] {
  const rutasPorId = new Map(rutas.map((r) => [r.id, r]));
  const borrador = new Map<string, { ninoIds: string[]; ninos: NinoEnRuta[] }>();
  const tomar = (rutaId: string) => {
    let actual = borrador.get(rutaId);
    if (!actual) {
      const r = rutasPorId.get(rutaId);
      actual = { ninoIds: [...(r?.ninoIds ?? [])], ninos: [...(r?.ninos ?? [])] };
      borrador.set(rutaId, actual);
    }
    return actual;
  };
  const igual = (a: Transbordo, b: Transbordo) =>
    a.ninoId === b.ninoId && a.puntoId === b.puntoId && a.rutaDestinoId === b.rutaDestinoId;

  // Bajas y cambios: sacar al niño de la receptora que ya no corresponde
  for (const p of previos) {
    if (actuales.some((a) => igual(a, p)) || !rutasPorId.has(p.rutaDestinoId)) continue;
    const destino = tomar(p.rutaDestinoId);
    destino.ninos = destino.ninos.filter(
      (n) => !(n.ninoId === p.ninoId && n.subeEn.tipo === "punto")
    );
    // El id se quita solo si el niño no quedó en la receptora por otro motivo
    if (!destino.ninos.some((n) => n.ninoId === p.ninoId)) {
      destino.ninoIds = destino.ninoIds.filter((id) => id !== p.ninoId);
    }
  }

  // Altas y cambios: agregar al niño como receptor en la ruta nueva
  for (const a of actuales) {
    if (previos.some((p) => igual(p, a)) || !rutasPorId.has(a.rutaDestinoId)) continue;
    const destino = tomar(a.rutaDestinoId);
    destino.ninos = [
      ...destino.ninos.filter((n) => n.ninoId !== a.ninoId),
      receptorEnRuta(a, turno, ninosPorId),
    ];
    destino.ninoIds = [...new Set([...destino.ninoIds, a.ninoId])];
  }

  return [...borrador].map(([rutaId, datos]) => ({ rutaId, ...datos }));
}

// Clave para agrupar por zona: la colonia que el admin escribió al marcar la
// casa. Se normaliza (sin mayúsculas ni espacios de más) para que "Bella Vista"
// y "bella vista " caigan en el mismo grupo.
const claveZona = (nino: Nino) => nino.parada?.nombre.trim().toLowerCase() ?? "";

const SIN_CASA = "__sin_casa";
const SIN_ESCUELA = "__sin_escuela";

const EMOJI_LUGAR = { casa: "🏠", escuela: "🏫", punto: "🔄" } as const;

// Un niño de la lista de candidatos, con todo lo que hace falta para decidir
interface ItemCandidato {
  nino: Nino;
  ocupadaPor?: Ruta; // ya viaja en otra ruta de este turno
  distancia: number; // metros a lo más cercano que ya lleva el bus
  sinCasa: boolean;
}

interface GrupoCandidatos {
  clave: string;
  titulo: string;
  aviso?: string;
  items: ItemCandidato[];
  distancia: number;
  agregables: string[]; // ids que se pueden sumar de una sola vez
}

interface Props {
  ruta: Ruta | null; // null = ruta nueva
  rutas: Ruta[];
  buses: Bus[];
  ninos: Nino[];
  escuelas: Escuela[];
  puntos: Punto[];
  onCerrar: () => void;
  onGuardado: () => void;
}

export default function ArmadorRuta({
  ruta,
  rutas,
  buses,
  ninos,
  escuelas,
  puntos,
  onCerrar,
  onGuardado,
}: Props) {
  const ninosPorId = useMemo(() => new Map(ninos.map((n) => [n.id, n])), [ninos]);
  const escuelasPorId = useMemo(() => new Map(escuelas.map((e) => [e.id, e])), [escuelas]);

  // Los niños que esta ruta RECIBE de otro bus. No se editan acá: los administra
  // la ruta que los entrega. Salen de la ruta guardada, no del estado en pantalla.
  const recibidos = useMemo(() => (ruta ? derivarRecibidos(ruta) : []), [ruta]);
  const idsRecibidos = useMemo(() => new Set(recibidos.map((n) => n.ninoId)), [recibidos]);

  // --- Estado del formulario ---
  // El componente se monta de cero cada vez que se entra (la pantalla lo monta
  // con key), así que el estado inicial se calcula directo de las props y no
  // hace falta ningún efecto de "reset".
  const form = useForm({
    initialValues: {
      nombre: ruta?.nombre ?? "",
      busId: ruta?.busId ?? "",
      turno: (ruta?.turno ?? "") as Turno | "",
    },
    validate: {
      nombre: (v) => (v.trim() ? null : "El nombre es obligatorio"),
      busId: (v) => (v ? null : "Elegí la unidad"),
      turno: (v) => (v ? null : "Elegí el turno"),
    },
  });

  const [escuelaIds, setEscuelaIds] = useState<string[]>(ruta?.escuelaIds ?? []);
  // Los niños que VIAJAN en este bus: directos y los que esta ruta entrega en un
  // punto. Los recibidos no están acá (los maneja la ruta de origen).
  const [miembros, setMiembros] = useState<string[]>(() => [
    ...new Set(
      ruta?.ninos
        ? ruta.ninos.filter((n) => n.subeEn.tipo !== "punto").map((n) => n.ninoId)
        : (ruta?.ninoIds ?? []) // ruta vieja sin 'ninos': todos son directos
    ),
  ]);
  const transbordosIniciales = useMemo(
    () => (ruta ? derivarTransbordos(ruta, rutas) : []),
    [ruta, rutas]
  );
  const [transbordos, setTransbordos] = useState<Transbordo[]>(transbordosIniciales);

  const [busqueda, setBusqueda] = useState("");
  const [agrupacion, setAgrupacion] = useState<"zona" | "escuela">("zona");
  const [soloSinRuta, setSoloSinRuta] = useState(true);
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = useState(false);

  // Diálogo de transbordo (se abre desde la fila del niño en el recorrido)
  const [transbordoDe, setTransbordoDe] = useState<string | null>(null);
  const [tbPunto, setTbPunto] = useState("");
  const [tbRutaDestino, setTbRutaDestino] = useState("");

  const turno = form.values.turno as Turno | "";
  const bus = buses.find((b) => b.id === form.values.busId);

  const nombreEscuela = (id?: string) => escuelasPorId.get(id ?? "")?.nombre ?? "Sin escuela";
  const nombrePunto = (id: string) => puntos.find((p) => p.id === id)?.nombre ?? id;
  const nombreNino = (id: string) => ninosPorId.get(id)?.nombre ?? id;
  const placaBus = (id: string) => buses.find((b) => b.id === id)?.placa ?? "(sin bus)";

  const transbordoPorNino = useMemo(
    () => new Map(transbordos.map((t) => [t.ninoId, t])),
    [transbordos]
  );

  // Si el admin cambia el TURNO después de haber elegido niños, los que no
  // viajan en el turno nuevo dejan de contar: no se guardan en la ruta ni suman
  // asientos. Se filtra acá (en vez de vaciar la selección al cambiar el turno)
  // para que volver al turno anterior recupere lo que ya había marcado.
  const miembrosDelTurno = useMemo(
    () => miembros.filter((id) => viajaEnTurno(ninosPorId.get(id)?.turno, turno)),
    [miembros, ninosPorId, turno]
  );
  const descartadosPorTurno = miembros.length - miembrosDelTurno.length;

  // --- En qué OTRA ruta activa del turno viaja ya cada niño ---
  // Un niño no puede ir en dos buses a la vez. Las entradas de RECEPTOR (sube en
  // un punto) no cuentan como ocupación: esa pertenencia la administra la ruta
  // de origen del transbordo.
  const rutaDondeViaja = useMemo(() => {
    const mapa = new Map<string, Ruta>();
    rutas
      .filter((r) => r.activa && r.turno === turno && r.id !== ruta?.id)
      .forEach((r) => {
        (r.ninoIds ?? []).forEach((id) => {
          const esReceptor = (r.ninos ?? []).some(
            (n) => n.ninoId === id && n.subeEn.tipo === "punto"
          );
          if (!esReceptor) mapa.set(id, r);
        });
      });
    return mapa;
  }, [rutas, turno, ruta?.id]);

  // --- Anclas: lo que el bus YA toca, para medir cercanía ---
  // Son las casas de los niños que ya lleva más las escuelas elegidas. Con las
  // escuelas alcanza para que la primera asignación ya salga ordenada por zona,
  // aunque la ruta esté vacía.
  const anclas = useMemo<Coordenada[]>(() => {
    const puntosAncla: Coordenada[] = [];
    for (const id of miembrosDelTurno) {
      const casa = ninosPorId.get(id)?.parada;
      if (casa) puntosAncla.push({ lat: casa.lat, lng: casa.lng });
    }
    for (const id of escuelaIds) {
      const e = escuelasPorId.get(id);
      if (e) puntosAncla.push({ lat: e.lat, lng: e.lng });
    }
    return puntosAncla;
  }, [miembrosDelTurno, escuelaIds, ninosPorId, escuelasPorId]);

  const distanciaDe = (nino: Nino) =>
    nino.parada
      ? distanciaAlMasCercano({ lat: nino.parada.lat, lng: nino.parada.lng }, anclas)
      : Infinity;

  // --- Candidatos: los que podrían sumarse a esta ruta ---
  const candidatos = useMemo<ItemCandidato[]>(() => {
    if (!turno) return [];
    const yaEstan = new Set([...miembrosDelTurno, ...idsRecibidos]);
    return ninos
      .filter((n) => viajaEnTurno(n.turno, turno) && !yaEstan.has(n.id))
      .map((n) => ({
        nino: n,
        ocupadaPor: rutaDondeViaja.get(n.id),
        distancia: distanciaDe(n),
        sinCasa: !n.parada,
      }));
    // distanciaDe depende de anclas; se recalcula al cambiar miembros/escuelas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ninos, turno, miembrosDelTurno, idsRecibidos, rutaDondeViaja, anclas]);

  const totalSinRuta = candidatos.filter((c) => !c.ocupadaPor).length;

  // --- Agrupación y orden de los candidatos ---
  // Acá está el arreglo de fondo al problema de los 100 niños: en vez de una
  // lista plana se muestran grupos (zona o escuela) ordenados por cercanía a lo
  // que el bus ya lleva, cerrados por defecto y con un botón para sumar el grupo
  // entero. El admin ve primero lo que le queda de paso.
  const grupos = useMemo<GrupoCandidatos[]>(() => {
    const texto = busqueda.trim().toLowerCase();
    const visibles = candidatos.filter((c) => {
      if (soloSinRuta && c.ocupadaPor) return false;
      if (!texto) return true;
      const zona = c.nino.parada?.nombre ?? "";
      return `${c.nino.nombre} ${nombreEscuela(c.nino.escuelaId)} ${zona}`
        .toLowerCase()
        .includes(texto);
    });

    const porClave = new Map<string, GrupoCandidatos>();
    for (const item of visibles) {
      const esZona = agrupacion === "zona";
      const clave = esZona
        ? claveZona(item.nino) || SIN_CASA
        : (item.nino.escuelaId ?? SIN_ESCUELA);

      let grupo = porClave.get(clave);
      if (!grupo) {
        const escuelaDelGrupo = !esZona && clave !== SIN_ESCUELA ? clave : undefined;
        grupo = {
          clave,
          titulo: esZona
            ? clave === SIN_CASA
              ? "Sin casa marcada"
              : (item.nino.parada?.nombre ?? "")
            : nombreEscuela(escuelaDelGrupo),
          aviso:
            clave === SIN_CASA
              ? "Sin la casa marcada el conductor no sabe dónde recogerlos. Marcala en la sección Niños."
              : escuelaDelGrupo && !escuelaIds.includes(escuelaDelGrupo)
                ? "Esta ruta no pasa por esa escuela: agregala arriba o marcales transbordo."
                : undefined,
          items: [],
          distancia: Infinity,
          agregables: [],
        };
        porClave.set(clave, grupo);
      }
      grupo.items.push(item);
      if (item.distancia < grupo.distancia) grupo.distancia = item.distancia;
      if (!item.ocupadaPor && !item.sinCasa) grupo.agregables.push(item.nino.id);
    }

    // Dentro del grupo: primero los libres y más cercanos
    for (const grupo of porClave.values()) {
      grupo.items.sort(
        (a, b) =>
          Number(!!a.ocupadaPor) - Number(!!b.ocupadaPor) ||
          a.distancia - b.distancia ||
          a.nino.nombre.localeCompare(b.nino.nombre)
      );
    }

    // Los grupos, por cercanía. "Sin casa marcada" siempre al final.
    return [...porClave.values()].sort((a, b) => {
      if (a.clave === SIN_CASA) return 1;
      if (b.clave === SIN_CASA) return -1;
      return a.distancia - b.distancia || a.titulo.localeCompare(b.titulo);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatos, busqueda, soloSinRuta, agrupacion, escuelaIds, escuelasPorId]);

  // --- La ruta como va quedando, para el recorrido y el mapa ---
  const entradas = useMemo<NinoEnRuta[]>(() => {
    if (!turno) return [];
    const propios = miembrosDelTurno.map((id) => {
      const t = transbordoPorNino.get(id);
      return t ? entregaEnRuta(t, turno, ninosPorId) : directoEnRuta(id, turno, ninosPorId);
    });
    // Un niño no puede tener dos entradas en la misma ruta: si por datos viejos
    // figurara a la vez como propio y como recibido, gana el propio.
    const idsPropios = new Set(miembrosDelTurno);
    return [...propios, ...recibidos.filter((n) => !idsPropios.has(n.ninoId))];
  }, [miembrosDelTurno, transbordoPorNino, turno, ninosPorId, recibidos]);

  const recorrido = useMemo(() => {
    if (!turno) return [];
    // Ruta "virtual": la ruta tal como va quedando en pantalla, todavía sin
    // guardar. derivarRecorrido solo lee 'ninos' y 'ninoIds', así que el nombre
    // y el bus van vacíos a propósito — si se pasaran, el recorrido se
    // recalcularía con cada tecla que el admin escribe en el nombre.
    const rutaVirtual: Ruta = {
      id: ruta?.id ?? "nueva",
      nombre: "",
      busId: "",
      activa: true,
      turno,
      escuelaIds,
      ninoIds: entradas.map((n) => n.ninoId),
      ninos: entradas,
    };
    return derivarRecorrido(rutaVirtual, ninos, escuelas, puntos, turno);
  }, [entradas, escuelaIds, turno, ninos, escuelas, puntos, ruta?.id]);

  // --- Ocupación del bus ---
  const aBordo = miembrosDelTurno.length + recibidos.length;
  const capacidad = bus?.capacidad ?? 0;
  const excedido = capacidad > 0 && aBordo > capacidad;
  const porcentaje = capacidad > 0 ? Math.min(100, (aBordo / capacidad) * 100) : 0;

  // --- Avisos por niño: lo que antes solo se descubría al guardar ---
  // Un niño sin transbordo cuya escuela no está en la ruta no tiene dónde
  // bajarse. Antes eso saltaba recién al apretar Guardar; ahora se marca en su
  // fila apenas se lo agrega, con las dos salidas a un clic.
  const escuelaFueraDeRuta = (ninoId: string) => {
    if (transbordoPorNino.has(ninoId)) return null;
    const escuelaId = ninosPorId.get(ninoId)?.escuelaId;
    if (!escuelaId) return "sin_escuela" as const;
    return escuelaIds.includes(escuelaId) ? null : ("fuera" as const);
  };

  const conProblema = miembrosDelTurno.filter((id) => escuelaFueraDeRuta(id) !== null);

  // Rutas que pueden recibir un transbordo: mismo turno, otro bus, activas
  const rutasDestino = rutas.filter(
    (r) => r.activa && r.turno === turno && r.id !== ruta?.id && r.busId !== form.values.busId
  );

  const sirveEscuelaDelNino = (r: Ruta, ninoId: string) => {
    const escuelaId = ninosPorId.get(ninoId)?.escuelaId;
    return !!escuelaId && (r.escuelaIds ?? []).includes(escuelaId);
  };

  // --- Acciones ---
  const agregar = (ids: string[]) => {
    setMiembros((prev) => [...new Set([...prev, ...ids])]);
  };

  const quitar = (id: string) => {
    setMiembros((prev) => prev.filter((x) => x !== id));
    // Si tenía transbordo marcado, se va con él
    setTransbordos((prev) => prev.filter((t) => t.ninoId !== id));
  };

  const agregarEscuelaALaRuta = (escuelaId: string) => {
    setEscuelaIds((prev) => [...new Set([...prev, escuelaId])]);
  };

  const abrirTransbordo = (ninoId: string) => {
    const existente = transbordoPorNino.get(ninoId);
    const nino = ninosPorId.get(ninoId);
    const escuelaDelNino = escuelasPorId.get(nino?.escuelaId ?? "");

    // Preselección útil: el punto más cercano a la escuela del niño y la primera
    // ruta que sí pasa por esa escuela. El admin confirma en vez de buscar.
    const puntoSugerido =
      existente?.puntoId ??
      (escuelaDelNino && puntos.length > 0
        ? [...puntos].sort(
            (a, b) =>
              distanciaAlMasCercano({ lat: a.lat, lng: a.lng }, [escuelaDelNino]) -
              distanciaAlMasCercano({ lat: b.lat, lng: b.lng }, [escuelaDelNino])
          )[0].id
        : "");
    const rutaSugerida =
      existente?.rutaDestinoId ?? rutasDestino.find((r) => sirveEscuelaDelNino(r, ninoId))?.id ?? "";

    setTbPunto(puntoSugerido);
    setTbRutaDestino(rutaSugerida);
    setTransbordoDe(ninoId);
  };

  const confirmarTransbordo = () => {
    if (!transbordoDe || !tbPunto || !tbRutaDestino) return;
    const nuevo: Transbordo = {
      ninoId: transbordoDe,
      puntoId: tbPunto,
      rutaDestinoId: tbRutaDestino,
    };
    // Un transbordo por niño: si ya tenía, se reemplaza
    setTransbordos((prev) => [...prev.filter((t) => t.ninoId !== nuevo.ninoId), nuevo]);
    setTransbordoDe(null);
  };

  const quitarTransbordo = (ninoId: string) => {
    setTransbordos((prev) => prev.filter((t) => t.ninoId !== ninoId));
  };

  const guardar = form.onSubmit(async (valores) => {
    if (escuelaIds.length === 0) {
      notifications.show({ color: "orange", message: "Elegí al menos una escuela." });
      return;
    }
    const turnoElegido = valores.turno as Turno;
    const rutasPorId = new Map(rutas.map((r) => [r.id, r]));

    // Los transbordos tienen que apuntar a una ruta que siga existiendo en ESTE
    // turno (puede haber quedado despareja si el admin cambió el turno después).
    for (const t of transbordos) {
      if (!miembrosDelTurno.includes(t.ninoId)) continue;
      const destino = rutasPorId.get(t.rutaDestinoId);
      if (!destino || destino.turno !== turnoElegido) {
        notifications.show({
          color: "orange",
          message: `El transbordo de ${nombreNino(t.ninoId)} no tiene un bus receptor válido en el turno ${etiquetaTurno(turnoElegido)}. Volvé a marcarlo.`,
        });
        return;
      }
    }

    // Todo niño SIN transbordo tiene que ir a una escuela de esta ruta — si no,
    // el conductor no tendría dónde entregarlo.
    if (conProblema.length > 0) {
      notifications.show({
        color: "orange",
        message: `${conProblema.map(nombreNino).join(", ")}: su escuela no está en esta ruta. Agregá la escuela o marcales transbordo.`,
      });
      return;
    }

    setGuardando(true);
    try {
      const transbordosValidos = transbordos.filter((t) => miembrosDelTurno.includes(t.ninoId));
      const datos = {
        nombre: valores.nombre.trim(),
        busId: valores.busId,
        turno: turnoElegido,
        escuelaIds,
        ninoIds: entradas.map((n) => n.ninoId),
        ninos: entradas,
      };
      const receptoras = calcularCambiosReceptoras(
        transbordosIniciales,
        transbordosValidos,
        rutas,
        turnoElegido,
        ninosPorId
      );
      // La ruta y las receptoras de sus transbordos, en un solo lote atómico
      await guardarRutaConReceptoras(ruta?.id ?? null, datos, receptoras);
      notifications.show({
        color: "green",
        message: ruta ? "Ruta actualizada." : "Ruta creada.",
      });
      onGuardado();
    } catch {
      notifications.show({ color: "red", message: "No se pudo guardar la ruta." });
    } finally {
      setGuardando(false);
    }
  });

  // Candidatos que se pueden tocar en el mapa: los libres con casa marcada
  const candidatosEnMapa = useMemo<CandidatoEnMapa[]>(
    () =>
      candidatos
        .filter((c) => !c.ocupadaPor && c.nino.parada)
        .map((c) => ({
          id: c.nino.id,
          nombre: c.nino.nombre,
          escuela: nombreEscuela(c.nino.escuelaId),
          lat: c.nino.parada!.lat,
          lng: c.nino.parada!.lng,
          distancia: c.distancia,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidatos, escuelasPorId]
  );

  const escuelasDeLaRuta = escuelaIds
    .map((id) => escuelasPorId.get(id))
    .filter((e): e is Escuela => !!e);

  const hayBusqueda = busqueda.trim().length > 0;
  const ninoDelDialogo = transbordoDe ? ninosPorId.get(transbordoDe) : null;

  // Nombre del lugar donde un niño sube o baja, para la columna de la tabla.
  // Sigue la misma regla que el recorrido del conductor: en la tarde, la
  // entrega puede ser en 'paradaTarde' si el niño se deja en otro lado.
  const nombreLugar = (ref: LugarRef, esBajada: boolean) => {
    if (ref.tipo === "casa") {
      const n = ninosPorId.get(ref.id);
      const casa = esBajada && turno === "tarde" ? (n?.paradaTarde ?? n?.parada) : n?.parada;
      return { emoji: "🏠", texto: casa?.nombre ?? "sin casa marcada" };
    }
    if (ref.tipo === "escuela") return { emoji: "🏫", texto: nombreEscuela(ref.id) };
    return { emoji: "🔄", texto: nombrePunto(ref.id) };
  };

  // Placa del bus que sigue al niño después del punto de transbordo
  const busQueSigue = (t: Transbordo) =>
    placaBus(rutas.find((r) => r.id === t.rutaDestinoId)?.busId ?? "");

  // Las filas de la tabla, EN EL ORDEN EN QUE EL BUS LOS RECOGE. El recorrido ya
  // está ordenado, así que alcanza con recorrerlo y sacar de cada parada a los
  // que suben ahí. Los que no aparecen (por ejemplo, sin casa marcada) van al
  // final para que no se pierdan de vista.
  const filasTabla = useMemo(() => {
    const porNino = new Map(entradas.map((e) => [e.ninoId, e]));
    const ordenados = recorrido.flatMap((p) => p.suben.map((n) => n.id));
    const vistos = new Set(ordenados);
    const rezagados = entradas.map((e) => e.ninoId).filter((id) => !vistos.has(id));
    return [...ordenados, ...rezagados]
      .map((id) => porNino.get(id))
      .filter((e): e is NinoEnRuta => !!e);
  }, [entradas, recorrido]);

  // ---------------------------------------------------------------------------
  // Una fila de la tabla = UN niño. Antes cada niño aparecía dos veces (donde
  // sube y donde baja) con una frase explicando el transbordo debajo; era mucho
  // texto para leer. En la tabla, "Sube en" y "Baja en" son dos columnas y el
  // transbordo se ve solo: el 🔄 en la columna "Baja en".
  // ---------------------------------------------------------------------------
  const filaTabla = (entrada: NinoEnRuta) => {
    const ninoId = entrada.ninoId;
    const nino = ninosPorId.get(ninoId);
    const t = transbordoPorNino.get(ninoId);
    const esRecibido = idsRecibidos.has(ninoId);
    const problema = escuelaFueraDeRuta(ninoId);
    const escuelaId = nino?.escuelaId;
    const sube = nombreLugar(entrada.subeEn, false);
    const baja = nombreLugar(entrada.bajaEn, true);

    return (
      <Fragment key={ninoId}>
        <Table.Tr bg={t ? "grape.0" : esRecibido ? "cyan.0" : undefined}>
        <Table.Td>
          <Text size="sm" fw={600}>
            {nino?.nombre ?? ninoId}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="xs" c="dimmed">
            {nombreEscuela(escuelaId)}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm">
            {sube.emoji} {sube.texto}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm">
            {baja.emoji} {baja.texto}
          </Text>
          {t && (
            <Text size="xs" c="grape" fw={600}>
              sigue en el bus {busQueSigue(t)}
            </Text>
          )}
        </Table.Td>
        <Table.Td>
          {esRecibido ? (
            <Badge variant="light" color="cyan">
              Lo trae otro bus
            </Badge>
          ) : (
            <Group gap="xs" wrap="nowrap" justify="flex-end">
              <Button
                size="xs"
                variant={t ? "filled" : "light"}
                color="grape"
                leftSection={<IconArrowsExchange size={14} />}
                onClick={() => abrirTransbordo(ninoId)}
              >
                {t ? "Cambiar" : "Transbordo"}
              </Button>
              <Button size="xs" variant="light" color="red" onClick={() => quitar(ninoId)}>
                Quitar
              </Button>
            </Group>
          )}
        </Table.Td>
        </Table.Tr>

        {/* El aviso va en su propia fila para no apretar las columnas. Solo
            aparece cuando hay algo mal, así la tabla normal se mantiene limpia. */}
        {problema && (
          <Table.Tr bg="orange.0">
            <Table.Td colSpan={5}>
              <Group gap="xs" wrap="wrap">
                <Text size="xs" c="orange.9">
                  <IconAlertTriangle
                    size={12}
                    style={{ verticalAlign: "-2px", marginRight: 4 }}
                  />
                  {problema === "sin_escuela"
                    ? "No tiene escuela asignada: no hay dónde bajarlo."
                    : "Su escuela no está en esta ruta: no tiene dónde bajarse."}
                </Text>
                {problema === "fuera" && escuelaId && (
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => agregarEscuelaALaRuta(escuelaId)}
                  >
                    Agregar {nombreEscuela(escuelaId)} a la ruta
                  </Button>
                )}
                {problema === "fuera" && !esRecibido && (
                  <Button
                    size="xs"
                    variant="light"
                    color="grape"
                    onClick={() => abrirTransbordo(ninoId)}
                  >
                    O hacer transbordo
                  </Button>
                )}
              </Group>
            </Table.Td>
          </Table.Tr>
        )}
      </Fragment>
    );
  };

  return (
    <form onSubmit={guardar}>
      <Stack gap="sm">
        {/* ---------- Encabezado ---------- */}
        <Group justify="space-between" wrap="wrap">
          <Group gap="xs">
            <Tooltip label="Volver a la lista de rutas">
              <ActionIcon variant="subtle" size="lg" onClick={onCerrar}>
                <IconArrowLeft size={20} />
              </ActionIcon>
            </Tooltip>
            <Title order={3}>{ruta ? `Editar ruta · ${ruta.nombre}` : "Nueva ruta"}</Title>
          </Group>
          <Group gap="sm">
            {/* Ocupación del bus: el dato que antes no existía en ningún lado */}
            <Stack gap={2} w={140}>
              <Group gap={6} justify="space-between">
                <Text size="xs" c="dimmed">
                  Niños a bordo
                </Text>
                <Text size="xs" fw={700} c={excedido ? "red" : undefined}>
                  {aBordo}
                  {capacidad > 0 ? ` / ${capacidad}` : ""}
                </Text>
              </Group>
              <Progress
                value={porcentaje}
                color={excedido ? "red" : porcentaje > 85 ? "orange" : "blue"}
                size="sm"
              />
            </Stack>
            <Button variant="default" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" loading={guardando} leftSection={<IconDeviceFloppy size={16} />}>
              {ruta ? "Guardar cambios" : "Crear ruta"}
            </Button>
          </Group>
        </Group>

        {/* ---------- Datos de la ruta ---------- */}
        <Paper withBorder p="sm">
          <Flex gap="sm" wrap="wrap" align="flex-end">
            <TextInput
              label="Nombre de la ruta"
              required
              style={{ flex: "2 1 220px" }}
              {...form.getInputProps("nombre")}
            />
            <Select
              label="Unidad (bus)"
              required
              searchable
              style={{ flex: "1 1 170px" }}
              data={buses.map((b) => ({
                value: b.id,
                label: `${b.placa} · ${b.capacidad} asientos`,
              }))}
              {...form.getInputProps("busId")}
            />
            <Select
              label="Turno"
              required
              style={{ flex: "1 1 140px" }}
              data={TURNOS}
              {...form.getInputProps("turno")}
            />
            <MultiSelect
              label="Escuela(s) a las que llega este bus"
              placeholder={escuelas.length ? "Elegí una o varias" : "No hay escuelas activas"}
              searchable
              style={{ flex: "2 1 260px" }}
              disabled={escuelas.length === 0}
              value={escuelaIds}
              onChange={setEscuelaIds}
              data={escuelas.map((e) => ({ value: e.id, label: e.nombre }))}
            />
          </Flex>

          {excedido && (
            <Text size="xs" c="orange" mt={8}>
              <IconAlertTriangle size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
              La ruta lleva {aBordo} niños y la unidad {bus?.placa} tiene {capacidad} asientos. Se
              puede guardar igual, pero revisá la capacidad.
            </Text>
          )}

          {descartadosPorTurno > 0 && (
            <Text size="xs" c="dimmed" mt={8}>
              {descartadosPorTurno} niño{descartadosPorTurno === 1 ? "" : "s"} que habías marcado
              no viaja{descartadosPorTurno === 1 ? "" : "n"} en el turno{" "}
              {etiquetaTurno(turno || undefined)}, así que no se guardará
              {descartadosPorTurno === 1 ? "" : "n"} en esta ruta. Si volvés al turno anterior,
              reaparece{descartadosPorTurno === 1 ? "" : "n"}.
            </Text>
          )}
        </Paper>

        {!turno ? (
          <Alert color="blue" variant="light">
            Elegí el <strong>turno</strong> para ver qué niños pueden viajar en esta ruta.
          </Alert>
        ) : (
          <>
            <Flex gap="sm" align="stretch" direction={{ base: "column", lg: "row" }}>
              {/* ============ IZQUIERDA: a quién subir ============ */}
              <Paper withBorder p="sm" style={{ flex: "1 1 380px", minWidth: 0 }}>
                <Group justify="space-between" mb={2}>
                  <Text fw={600}>1. ¿A quién sube este bus?</Text>
                  <Badge variant="light" color={totalSinRuta > 0 ? "orange" : "gray"}>
                    {totalSinRuta} sin bus
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" mb={8}>
                  Tocá <strong>+</strong> para subir un niño, o el botón del grupo para subirlos a
                  todos. También podés tocar una casa en el mapa.
                </Text>

                <SegmentedControl
                  size="xs"
                  fullWidth
                  value={soloSinRuta ? "sin" : "todos"}
                  onChange={(v) => setSoloSinRuta(v === "sin")}
                  data={[
                    { value: "sin", label: `Sin bus (${totalSinRuta})` },
                    { value: "todos", label: `Todos (${candidatos.length})` },
                  ]}
                />

                <Group gap={6} mt={8} wrap="nowrap">
                  <TextInput
                    placeholder="Buscar por nombre, escuela o zona…"
                    size="xs"
                    style={{ flex: 1 }}
                    leftSection={<IconSearch size={13} />}
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.currentTarget.value)}
                  />
                  <SegmentedControl
                    size="xs"
                    value={agrupacion}
                    onChange={(v) => setAgrupacion(v as "zona" | "escuela")}
                    data={[
                      { value: "zona", label: "Por zona" },
                      { value: "escuela", label: "Por escuela" },
                    ]}
                  />
                </Group>

                <ScrollArea.Autosize mah={430} mt={8} type="auto">
                  <Stack gap={2} pr="xs">
                    {grupos.length === 0 && (
                      <Stack gap="xs" align="center" py="lg">
                        <Text size="sm" c="dimmed" ta="center">
                          {candidatos.length === 0
                            ? `Todos los niños del turno ${etiquetaTurno(turno)} ya están en esta ruta.`
                            : soloSinRuta && totalSinRuta === 0
                              ? "Todos los niños del turno ya tienen un bus asignado."
                              : "Ningún niño coincide con la búsqueda."}
                        </Text>
                        {/* Sin esto, la lista queda vacía y no se ve que hay más
                            niños detrás de la otra pestaña. */}
                        {soloSinRuta && totalSinRuta === 0 && candidatos.length > 0 && (
                          <Button size="xs" variant="light" onClick={() => setSoloSinRuta(false)}>
                            Ver los {candidatos.length} del turno igual
                          </Button>
                        )}
                      </Stack>
                    )}

                    {grupos.map((grupo, indice) => {
                      // Abierto: el primero (el más cercano) y todos si hay búsqueda
                      const abierto = hayBusqueda || (gruposAbiertos[grupo.clave] ?? indice === 0);
                      return (
                        <div key={grupo.clave}>
                          <UnstyledButton
                            w="100%"
                            onClick={() =>
                              setGruposAbiertos((prev) => ({ ...prev, [grupo.clave]: !abierto }))
                            }
                            style={{ borderRadius: 6, padding: "5px 6px" }}
                          >
                            <Group gap={6} wrap="nowrap" justify="space-between">
                              <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
                                {abierto ? (
                                  <IconChevronDown size={14} />
                                ) : (
                                  <IconChevronRight size={14} />
                                )}
                                <Text size="sm" fw={600} truncate>
                                  {grupo.titulo}
                                </Text>
                                <Badge size="xs" variant="light">
                                  {grupo.items.length}
                                </Badge>
                              </Group>
                              {isFinite(grupo.distancia) && (
                                <Text size="xs" c="dimmed">
                                  a {formatearDistancia(grupo.distancia)}
                                </Text>
                              )}
                            </Group>
                          </UnstyledButton>

                          {/* keepMounted={false}: un grupo cerrado NO queda en el
                              DOM. Es lo que permite que la lista aguante cientos
                              de niños sin volverse pesada. */}
                          <Collapse expanded={abierto} keepMounted={false}>
                            <Stack gap={4} pl={18} pb={8}>
                              {grupo.aviso && (
                                <Text size="xs" c="orange">
                                  {grupo.aviso}
                                </Text>
                              )}

                              {grupo.items.map(({ nino, ocupadaPor, distancia, sinCasa }) => (
                                <Group key={nino.id} gap={8} wrap="nowrap" align="center">
                                  <Tooltip
                                    label={
                                      ocupadaPor
                                        ? "Ya viaja en otra ruta de este turno"
                                        : sinCasa
                                          ? "Primero marcale la casa en la sección Niños"
                                          : "Subir a este bus"
                                    }
                                  >
                                    <div>
                                      <ActionIcon
                                        variant="light"
                                        size="lg"
                                        disabled={!!ocupadaPor || sinCasa}
                                        onClick={() => agregar([nino.id])}
                                      >
                                        <IconPlus size={18} />
                                      </ActionIcon>
                                    </div>
                                  </Tooltip>
                                  <div style={{ minWidth: 0 }}>
                                    <Text size="sm" truncate c={ocupadaPor ? "dimmed" : undefined}>
                                      {nino.nombre}
                                    </Text>
                                    <Text size="xs" c="dimmed" truncate>
                                      {agrupacion === "zona"
                                        ? nombreEscuela(nino.escuelaId)
                                        : (nino.parada?.nombre ?? "sin casa")}
                                      {ocupadaPor
                                        ? ` · ya viaja en ${ocupadaPor.nombre}`
                                        : isFinite(distancia)
                                          ? ` · a ${formatearDistancia(distancia)}`
                                          : ""}
                                    </Text>
                                  </div>
                                </Group>
                              ))}

                              {grupo.agregables.length > 1 && (
                                <Button
                                  size="xs"
                                  variant="light"
                                  mt={4}
                                  w="fit-content"
                                  leftSection={<IconPlus size={14} />}
                                  onClick={() => agregar(grupo.agregables)}
                                >
                                  Subir los {grupo.agregables.length}
                                </Button>
                              )}
                            </Stack>
                          </Collapse>
                        </div>
                      );
                    })}
                  </Stack>
                </ScrollArea.Autosize>
              </Paper>

              {/* ============ DERECHA: los niños de la ruta, en tabla ============ */}
              <Paper withBorder p="sm" style={{ flex: "1.6 1 620px", minWidth: 0 }}>
                <Group justify="space-between" mb={2}>
                  <Text fw={600}>2. Niños de esta ruta ({entradas.length})</Text>
                  {transbordos.length + recibidos.length > 0 && (
                    <Badge variant="light" color="grape" leftSection="🔄">
                      {transbordos.length + recibidos.length} cambian de bus
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed" mb={8}>
                  En el orden en que el bus los recoge. Un <strong>🔄</strong> en «Baja en»
                  significa que ahí cambia de bus.
                </Text>

                <ScrollArea.Autosize mah={430} type="auto">
                  {entradas.length === 0 ? (
                    <Text size="sm" c="dimmed" ta="center" py="lg">
                      Todavía no hay niños en esta ruta. Agregalos desde la lista de la izquierda.
                    </Text>
                  ) : (
                    <Table.ScrollContainer minWidth={620}>
                      <Table highlightOnHover verticalSpacing="xs" horizontalSpacing="sm">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Niño</Table.Th>
                            <Table.Th>Escuela</Table.Th>
                            <Table.Th>Sube en</Table.Th>
                            <Table.Th>Baja en</Table.Th>
                            <Table.Th ta="right" />
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>{filasTabla.map(filaTabla)}</Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  )}
                </ScrollArea.Autosize>

                {/* El orden de las paradas, compacto: los mismos números del mapa */}
                {recorrido.length > 0 && (
                  <>
                    <Text size="xs" c="dimmed" mt="sm" mb={4}>
                      Paradas, en orden (los números son los del mapa):
                    </Text>
                    <Group gap={4}>
                      {recorrido.map((parada, i) => (
                        <Badge
                          key={`parada-${parada.lat},${parada.lng},${i}`}
                          variant="light"
                          color={
                            parada.tipo === "punto"
                              ? "red"
                              : parada.tipo === "escuela"
                                ? "indigo"
                                : "blue"
                          }
                        >
                          {i + 1}. {EMOJI_LUGAR[parada.tipo]} {parada.nombre}
                        </Badge>
                      ))}
                    </Group>
                  </>
                )}
              </Paper>
            </Flex>

            {/* ---------- Mapa ---------- */}
            <Paper withBorder p={6}>
              <div style={{ height: 400 }}>
                <MapaArmador
                  recorrido={recorrido}
                  escuelasRuta={escuelasDeLaRuta}
                  candidatos={candidatosEnMapa}
                  onAgregar={agregar}
                  claveVista={`${ruta?.id ?? "nueva"}|${turno}|${escuelaIds.join(",")}`}
                />
              </div>
            </Paper>
          </>
        )}
      </Stack>

      {/* ---------- Diálogo de transbordo ---------- */}
      <Modal
        opened={!!transbordoDe}
        onClose={() => setTransbordoDe(null)}
        title="El niño cambia de bus"
        size="lg"
      >
        {ninoDelDialogo && (
          <Stack gap="sm">
            <Text size="sm">
              <strong>{ninoDelDialogo.nombre}</strong> va a{" "}
              <strong>{nombreEscuela(ninoDelDialogo.escuelaId)}</strong>
              {ninoDelDialogo.escuelaId && escuelaIds.includes(ninoDelDialogo.escuelaId)
                ? ", que esta ruta sí sirve. El transbordo es opcional."
                : ", que esta ruta no sirve: por eso necesita cambiar de bus."}
            </Text>

            {rutasDestino.length === 0 ? (
              <Alert color="orange" variant="light">
                No hay otra ruta activa en el turno {etiquetaTurno(turno || undefined)} con otra
                unidad que pueda recibirlo. Creá primero la ruta del otro bus.
              </Alert>
            ) : puntos.length === 0 ? (
              <Alert color="orange" variant="light">
                No hay puntos de transbordo activos. Creá uno en la sección Puntos.
              </Alert>
            ) : (
              <>
                <Select
                  label="¿Dónde cambia de bus?"
                  searchable
                  value={tbPunto}
                  onChange={(v) => setTbPunto(v ?? "")}
                  data={puntos.map((p) => ({ value: p.id, label: p.nombre }))}
                />

                {/* Las rutas que SÍ pasan por su escuela van primero y marcadas */}
                <Select
                  label="¿Qué bus lo sigue desde ahí?"
                  searchable
                  value={tbRutaDestino}
                  onChange={(v) => setTbRutaDestino(v ?? "")}
                  data={[...rutasDestino]
                    .sort(
                      (a, b) =>
                        Number(sirveEscuelaDelNino(b, ninoDelDialogo.id)) -
                        Number(sirveEscuelaDelNino(a, ninoDelDialogo.id))
                    )
                    .map((r) => {
                      const sirve = sirveEscuelaDelNino(r, ninoDelDialogo.id);
                      const busDestino = buses.find((b) => b.id === r.busId);
                      const ocupacion = `${r.ninoIds?.length ?? 0}${busDestino ? `/${busDestino.capacidad}` : ""}`;
                      return {
                        value: r.id,
                        label:
                          `${placaBus(r.busId)} — ${r.nombre} · ${ocupacion} · ` +
                          (sirve ? "✓ pasa por su escuela" : "⚠ no pasa por su escuela"),
                      };
                    })}
                />

                {tbPunto && tbRutaDestino && (
                  <Alert color="grape" variant="light">
                    <Text size="sm">
                      {placaBus(form.values.busId)} lo recoge{" "}
                      {turno === "tarde" ? "en su escuela" : "en su casa"} y lo deja en{" "}
                      <strong>{nombrePunto(tbPunto)}</strong>. Ahí lo sube{" "}
                      <strong>
                        {placaBus(rutas.find((r) => r.id === tbRutaDestino)?.busId ?? "")}
                      </strong>{" "}
                      y lo lleva {turno === "tarde" ? "a su casa" : "a su escuela"}.
                    </Text>
                  </Alert>
                )}
              </>
            )}

            <Group justify="space-between">
              {transbordoPorNino.has(ninoDelDialogo.id) ? (
                <Button
                  variant="light"
                  color="red"
                  onClick={() => {
                    quitarTransbordo(ninoDelDialogo.id);
                    setTransbordoDe(null);
                  }}
                >
                  Quitar transbordo
                </Button>
              ) : (
                <span />
              )}
              <Group gap="xs">
                <Button variant="default" onClick={() => setTransbordoDe(null)}>
                  Cancelar
                </Button>
                <Button disabled={!tbPunto || !tbRutaDestino} onClick={confirmarTransbordo}>
                  Confirmar
                </Button>
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>
    </form>
  );
}
