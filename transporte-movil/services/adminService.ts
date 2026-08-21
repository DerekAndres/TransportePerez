import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { listarRegistrosDeViaje } from "./viajesService";
import type { Bus, Ruta, Usuario, Viaje } from "../types/models";

// ============================================
// APP DEL ADMIN — SOLO VIGILANCIA
// ============================================
// La app móvil del admin NO administra nada: no crea usuarios, ni rutas, ni
// niños. Todo eso sigue viviendo en el panel web, donde hay pantalla grande y
// teclado. Acá el admin solo tiene lo que necesita estando fuera de la oficina:
//   1. ver cómo van las rutas del día (en curso / terminadas / sin salir),
//   2. responder mensajes,
//   3. publicar un aviso en un canal.
//
// Por eso este servicio solo LEE (y la única escritura, publicar un aviso, vive
// en canalesService). Las reglas de Firestore ya permiten todo esto sin cambios:
// viajes, ubicaciones, rutas, buses y usuarios son legibles por cualquier
// usuario autenticado.

// Cómo viene una ruta hoy. Es la fila que se muestra en el monitoreo.
export interface EstadoRuta {
  rutaId: string;
  rutaNombre: string;
  turno?: "manana" | "tarde";
  busPlaca: string;
  conductorNombre: string;
  conductorTelefono: string;
  conductorId: string;
  ninosTotal: number;
  estado: "sin_iniciar" | "en_curso" | "finalizado";
  viajeId?: string;
  horaInicio?: string;
  horaFin?: string;
  // true si el bus está mandando su posición ahora (hay doc en 'ubicaciones')
  conSenal: boolean;
  // Asistencia del viaje (se cuenta desde 'registros')
  subidos: number;
  entregados: number;
}

// Catálogo que casi no cambia durante el día: se carga una vez y se reutiliza
// en cada actualización de los viajes.
export interface CatalogoRutas {
  rutas: Ruta[];
  buses: Map<string, Bus>;
  conductores: Map<string, Usuario>;
}

// --- Rutas activas + sus buses y conductores ---
export async function cargarCatalogo(): Promise<CatalogoRutas> {
  const [snapRutas, snapBuses, snapUsuarios] = await Promise.all([
    getDocs(query(collection(db, "rutas"), where("activa", "==", true))),
    getDocs(collection(db, "buses")),
    getDocs(query(collection(db, "usuarios"), where("rol", "==", "conductor"))),
  ]);

  const rutas = snapRutas.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Ruta)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const buses = new Map(
    snapBuses.docs.map((d) => [d.id, { id: d.id, ...d.data() } as Bus])
  );
  const conductores = new Map(
    snapUsuarios.docs.map((d) => [d.id, { id: d.id, ...d.data() } as Usuario])
  );

  return { rutas, buses, conductores };
}

// --- Viajes de HOY, en vivo ---
// Filtro de igualdad sobre 'fecha': auto-indexado, sin índice compuesto.
export function escucharViajesDeHoy(
  fecha: string,
  callback: (viajes: Viaje[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "viajes"), where("fecha", "==", fecha)),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Viaje)),
    () => callback([])
  );
}

// --- Qué buses están mandando posición ahora mismo ---
// La colección 'ubicaciones' tiene UN documento por viaje activo (se borra al
// finalizar), así que es chica y se puede escuchar entera. Devuelve los ids de
// viaje con señal.
export function escucharViajesConSenal(
  callback: (viajeIds: Set<string>) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, "ubicaciones"),
    (snap) => callback(new Set(snap.docs.map((d) => d.id))),
    () => callback(new Set())
  );
}

// --- Asistencia de varios viajes ---
// Una consulta por viaje (son pocos: como mucho uno por ruta y por turno). Se
// llama al entrar y al deslizar para refrescar, no en cada snapshot, para no
// gastar lecturas de más.
export async function contarAsistencia(
  viajeIds: string[]
): Promise<Map<string, { subidos: number; entregados: number }>> {
  const conteos = new Map<string, { subidos: number; entregados: number }>();

  await Promise.all(
    viajeIds.map(async (viajeId) => {
      try {
        const registros = await listarRegistrosDeViaje(viajeId);
        // Se cuentan NIÑOS distintos, no eventos: si un niño quedó registrado
        // dos veces, sigue siendo un niño.
        const subidos = new Set(
          registros.filter((r) => r.evento === "subio").map((r) => r.ninoId)
        );
        const entregados = new Set(
          registros.filter((r) => r.evento === "bajo").map((r) => r.ninoId)
        );
        conteos.set(viajeId, { subidos: subidos.size, entregados: entregados.size });
      } catch {
        // Sin conteo la fila igual sirve: muestra el estado del viaje
      }
    })
  );

  return conteos;
}

// --- Arma las filas del monitoreo cruzando todo lo anterior ---
// Está separado de las suscripciones a propósito: es una función pura, fácil de
// leer y de explicar (entra data, sale la lista que se dibuja).
export function armarEstadoDeRutas(
  catalogo: CatalogoRutas,
  viajes: Viaje[],
  conSenal: Set<string>,
  conteos: Map<string, { subidos: number; entregados: number }>
): EstadoRuta[] {
  return catalogo.rutas.map((ruta) => {
    // De los viajes de hoy de esta ruta interesa el que está en curso; si no
    // hay, el último finalizado.
    const deRuta = viajes.filter((v) => v.rutaId === ruta.id);
    const viaje =
      deRuta.find((v) => v.estado === "en_curso") ??
      [...deRuta]
        .sort((a, b) => (a.horaInicio?.toMillis() ?? 0) - (b.horaInicio?.toMillis() ?? 0))
        .pop();

    const bus = catalogo.buses.get(ruta.busId);
    const conductor = bus ? catalogo.conductores.get(bus.conductorId) : undefined;
    const conteo = viaje ? conteos.get(viaje.id) : undefined;

    return {
      rutaId: ruta.id,
      rutaNombre: ruta.nombre,
      turno: ruta.turno,
      busPlaca: bus?.placa ?? "Sin unidad",
      conductorNombre: conductor?.nombre ?? "Sin conductor",
      conductorTelefono: conductor?.telefono ?? "",
      conductorId: conductor?.id ?? "",
      ninosTotal: (ruta.ninoIds ?? []).length,
      estado: !viaje ? "sin_iniciar" : viaje.estado === "en_curso" ? "en_curso" : "finalizado",
      viajeId: viaje?.id,
      horaInicio: viaje?.horaInicio ? horaCorta(viaje.horaInicio.toDate()) : undefined,
      horaFin: viaje?.horaFin ? horaCorta(viaje.horaFin.toDate()) : undefined,
      conSenal: !!viaje && viaje.estado === "en_curso" && conSenal.has(viaje.id),
      subidos: conteo?.subidos ?? 0,
      entregados: conteo?.entregados ?? 0,
    };
  });
}

function horaCorta(fecha: Date): string {
  return `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, "0")}`;
}
