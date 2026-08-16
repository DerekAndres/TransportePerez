import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Bus, Escuela, Nino, Registro, Ruta, Usuario, UbicacionActual, Viaje } from "../types/models";

// Solo filtros de igualdad / array-contains (sin orderBy en servidor) para no
// requerir índices compuestos. El orden se resuelve en cliente.

// --- Lista los hijos activos de este padre ---
export async function listarHijos(padreId: string): Promise<Nino[]> {
  const snap = await getDocs(
    query(
      collection(db, "ninos"),
      where("padreId", "==", padreId),
      where("activo", "==", true)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Nino);
}

// --- Rutas activas a las que está asignado un niño (ruta.ninoIds lo contiene) ---
// array-contains sin el filtro de 'activa' para no requerir índice compuesto; el
// filtro de activas se hace en el cliente.
//
// TODO (transbordo): cuando un niño haga transbordo, va a estar en DOS rutas del
// MISMO turno (ej. bus A: casa → punto; bus B: punto → escuela), así que esta
// consulta devolverá dos rutas donde hoy devuelve una. Al implementar el
// transbordo hay que encadenar/ordenar esos tramos (por ahora se asume una sola).
export async function listarRutasDeNino(ninoId: string): Promise<Ruta[]> {
  const snap = await getDocs(
    query(collection(db, "rutas"), where("ninoIds", "array-contains", ninoId))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Ruta)
    .filter((r) => r.activa);
}

// --- Trae UN hijo por id (para su pantalla de perfil) ---
// Las reglas dejan pasar esta lectura porque comparan el padreId del propio
// documento con el uid de quien consulta: si no es su hijo, no lo lee.
export async function obtenerNino(ninoId: string): Promise<Nino | null> {
  const snap = await getDoc(doc(db, "ninos", ninoId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Nino;
}

// --- Trae una escuela por id (para mostrar su nombre) ---
export async function obtenerEscuela(escuelaId: string): Promise<Escuela | null> {
  const snap = await getDoc(doc(db, "escuelas", escuelaId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Escuela;
}

// --- Todas las escuelas activas (para el formulario de inscripción) ---
export async function listarEscuelas(): Promise<Escuela[]> {
  const snap = await getDocs(query(collection(db, "escuelas"), where("activa", "==", true)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Escuela)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// --- Trae un bus por id (para mostrarle al padre la unidad: placa y foto) ---
export async function obtenerBus(busId: string): Promise<Bus | null> {
  const snap = await getDoc(doc(db, "buses", busId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Bus;
}

// --- Cambia la foto de un hijo ---
// Las reglas permiten al padre editar SOLO el campo 'foto' de sus propios hijos
// (el resto del perfil del niño lo administra el admin).
export async function actualizarFotoNino(ninoId: string, foto: string): Promise<void> {
  await updateDoc(doc(db, "ninos", ninoId), { foto });
}

// --- Viajes de una ruta en una fecha dada ("YYYY-MM-DD") ---
export async function listarViajesDeRutaPorFecha(
  rutaId: string,
  fecha: string
): Promise<Viaje[]> {
  const snap = await getDocs(
    query(collection(db, "viajes"), where("rutaId", "==", rutaId), where("fecha", "==", fecha))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Viaje);
}

// --- Escucha EN VIVO los viajes de una ruta en una fecha ---
// Para que la pantalla del padre reaccione sola cuando el conductor inicia o
// finaliza un viaje, sin que el padre tenga que refrescar.
export function escucharViajesDeRuta(
  rutaId: string,
  fecha: string,
  callback: (viajes: Viaje[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "viajes"), where("rutaId", "==", rutaId), where("fecha", "==", fecha)),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Viaje)),
    () => callback([])
  );
}

// --- Escucha EN VIVO los registros de UN niño en UN viaje ---
// Es la versión en tiempo real de listarRegistrosDeNino: con esto el estado
// (en casa / en el bus / entregado) cambia solo cuando el conductor marca
// subió/bajó. Igual que allá, el ninoId va fijo con igualdad — requisito de
// las reglas para demostrar que el padre solo lee registros de sus hijos.
export function escucharRegistrosDeNino(
  viajeId: string,
  ninoId: string,
  callback: (registros: Registro[]) => void
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, "registros"),
      where("viajeId", "==", viajeId),
      where("ninoId", "==", ninoId)
    ),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Registro)),
    () => callback([])
  );
}

// --- Registros de UN niño en UN viaje ---
// Siempre se filtra por ninoId con igualdad — las reglas de Firestore solo le
// permiten al padre leer registros de sus propios hijos, y eso solo es demostrable
// si la consulta fija el ninoId.
export async function listarRegistrosDeNino(
  viajeId: string,
  ninoId: string
): Promise<Registro[]> {
  const snap = await getDocs(
    query(
      collection(db, "registros"),
      where("viajeId", "==", viajeId),
      where("ninoId", "==", ninoId)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Registro);
}

// --- Contactos de chat del padre (Fase 7): con quién puede escribirse ---
// Son el/los conductor(es) de las rutas de sus hijos, más la administración. El
// conductor de una ruta se deriva por su bus (ruta.busId → bus.conductorId).
export async function listarContactosPadre(
  padreId: string
): Promise<{ conductores: Usuario[]; admin: Usuario | null }> {
  const hijos = await listarHijos(padreId);

  // Rutas de todos los hijos, sin repetir (un hijo puede tener mañana y tarde)
  const rutasPorHijo = await Promise.all(hijos.map((h) => listarRutasDeNino(h.id)));
  const rutas = [...new Map(rutasPorHijo.flat().map((r) => [r.id, r])).values()];
  const busIds = new Set(rutas.map((r) => r.busId).filter(Boolean));

  // Buses (para saber el conductor de cada uno) y usuarios (para nombres/teléfonos)
  const [busesSnap, usuarios] = await Promise.all([
    getDocs(collection(db, "buses")),
    listarUsuariosDelSistema(),
  ]);
  const conductorIds = new Set<string>();
  busesSnap.docs.forEach((d) => {
    const bus = d.data() as Bus;
    if (busIds.has(d.id) && bus.conductorId) conductorIds.add(bus.conductorId);
  });

  const conductores = usuarios.filter((u) => u.rol === "conductor" && conductorIds.has(u.id));
  const admin = usuarios.find((u) => u.rol === "admin" && u.activo) ?? null;
  return { conductores, admin };
}

// --- Todos los usuarios del sistema (para resolver contactos) ---
async function listarUsuariosDelSistema(): Promise<Usuario[]> {
  const snap = await getDocs(collection(db, "usuarios"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Usuario);
}

// --- Escucha en tiempo real la ubicación del bus de un viaje ---
export function escucharUbicacion(
  viajeId: string,
  callback: (ubicacion: UbicacionActual | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "ubicaciones", viajeId),
    (snap) => callback(snap.exists() ? (snap.data() as UbicacionActual) : null),
    () => callback(null)
  );
}
