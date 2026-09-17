import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { fechaDeHoy } from "../utils/fechas";
import type { Bus, Nino, Ruta, Suplencia, Usuario } from "../types/models";

// ============================================
// QUÉ NIÑOS PUEDE VER CADA CONDUCTOR
// ============================================
// Un conductor solo puede leer a los niños que lleva: las reglas de Firestore
// exigen que su uid esté en `nino.conductorIds`. Esa lista no la escribe nadie a
// mano; se DERIVA de la configuración con esta cadena:
//
//   ruta activa → su unidad (activa) → quién la maneja → los niños de la ruta
//
// y "quién la maneja" es el conductor titular de la unidad MÁS el suplente de
// cada suplencia de hoy en adelante que no esté cancelada.
//
// Por qué se guarda derivada y no se calcula en las reglas: una regla no puede
// recorrer rutas y unidades por cada niño de una consulta (Firestore limita los
// get() por petición). Guardada en el niño, la regla es una sola comparación y
// la app consulta con un filtro simple (array-contains).
//
// Cuándo se recalcula:
//   1. Después de guardar algo que cambia quién lleva a quién: una ruta, una
//      unidad, una cuenta de conductor o una suplencia.
//   2. Al abrir el panel, si hoy todavía no se hizo. Así una suplencia que ya
//      pasó deja de dar acceso al día siguiente sin que nadie tenga que acordarse.
//   3. A mano, desde Herramientas → Migración.

const DOC_MARCA = doc(db, "sistema", "accesoConductores");
const CLAVE_PENDIENTE = "panel.accesoConductoresPendiente";

// Escrituras por lote. El tope de Firestore es 500; se deja margen.
const TAMANO_LOTE = 450;

// Lo que se muestra cuando el cambio se guardó pero el recálculo no pudo
// terminar (se cortó internet). Es un objeto simple para que cada pantalla lo
// pase tal cual a notifications.show.
export const AVISO_ACCESOS_PENDIENTES = {
  color: "orange",
  autoClose: 12000,
  message:
    "Se guardó, pero no se pudo actualizar qué niños ve cada conductor en su app. " +
    "Se va a reintentar solo al volver a abrir el panel, o podés hacerlo ahora desde Herramientas → Migración.",
};

function mismaLista(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function marcarPendiente(pendiente: boolean): void {
  try {
    if (pendiente) localStorage.setItem(CLAVE_PENDIENTE, "1");
    else localStorage.removeItem(CLAVE_PENDIENTE);
  } catch {
    // Sin almacenamiento local (modo privado estricto): se recalcula igual al día siguiente
  }
}

export async function recalcularAccesosConductores(): Promise<{ actualizados: number }> {
  const hoy = fechaDeHoy();
  const [snapRutas, snapBuses, snapConductores, snapSuplencias, snapNinos] = await Promise.all([
    getDocs(collection(db, "rutas")),
    getDocs(collection(db, "buses")),
    getDocs(query(collection(db, "usuarios"), where("rol", "==", "conductor"))),
    getDocs(query(collection(db, "suplencias"), where("fecha", ">=", hoy))),
    getDocs(collection(db, "ninos")),
  ]);

  // Una cuenta de conductor dada de baja no recibe acceso a nadie
  const activos = new Set(
    snapConductores.docs.filter((d) => (d.data() as Usuario).activo !== false).map((d) => d.id)
  );

  // Quién maneja cada unidad activa: el titular y los suplentes vigentes
  const conductoresPorBus = new Map<string, Set<string>>();
  const agregar = (busId: string, conductorId: string) => {
    if (!activos.has(conductorId)) return;
    const conjunto = conductoresPorBus.get(busId) ?? new Set<string>();
    conjunto.add(conductorId);
    conductoresPorBus.set(busId, conjunto);
  };

  const busesActivos = new Set<string>();
  snapBuses.docs.forEach((d) => {
    const bus = d.data() as Bus;
    if (!bus.activo) return;
    busesActivos.add(d.id);
    if (bus.conductorId) agregar(d.id, bus.conductorId);
  });
  snapSuplencias.docs.forEach((d) => {
    const suplencia = d.data() as Suplencia;
    if (!suplencia.cancelada && busesActivos.has(suplencia.busId)) {
      agregar(suplencia.busId, suplencia.conductorId);
    }
  });

  // Cada niño recibe a los conductores de TODAS sus rutas activas. Se miran las
  // dos listas de la ruta (ninoIds y ninos) para cubrir también a los que se
  // reciben por transbordo.
  const porNino = new Map<string, Set<string>>();
  snapRutas.docs.forEach((d) => {
    const ruta = d.data() as Ruta;
    const conductores = ruta.activa ? conductoresPorBus.get(ruta.busId) : undefined;
    if (!conductores) return;
    const ninoIds = new Set([...(ruta.ninoIds ?? []), ...(ruta.ninos ?? []).map((n) => n.ninoId)]);
    ninoIds.forEach((ninoId) => {
      const conjunto = porNino.get(ninoId) ?? new Set<string>();
      conductores.forEach((c) => conjunto.add(c));
      porNino.set(ninoId, conjunto);
    });
  });

  // Solo se escribe lo que cambió (ordenado, para poder comparar)
  const cambios = snapNinos.docs
    .map((d) => ({
      id: d.id,
      nuevo: [...(porNino.get(d.id) ?? [])].sort(),
      actual: [...((d.data() as Nino).conductorIds ?? [])].sort(),
    }))
    .filter((c) => !mismaLista(c.nuevo, c.actual));

  for (let desde = 0; desde < cambios.length; desde += TAMANO_LOTE) {
    const lote = writeBatch(db);
    cambios
      .slice(desde, desde + TAMANO_LOTE)
      .forEach((c) => lote.update(doc(db, "ninos", c.id), { conductorIds: c.nuevo }));
    await lote.commit();
  }

  await setDoc(DOC_MARCA, { fecha: hoy, hora: serverTimestamp(), actualizados: cambios.length });
  return { actualizados: cambios.length };
}

// Después de guardar algo que cambia quién lleva a quién. Devuelve false si no
// se pudo (y deja la marca para reintentar al abrir el panel): la pantalla
// avisa con AVISO_ACCESOS_PENDIENTES, porque mientras no se recalcule, el
// conductor no ve a los niños nuevos de su ruta.
export async function recalcularAccesosDespuesDeGuardar(): Promise<boolean> {
  marcarPendiente(true);
  try {
    await recalcularAccesosConductores();
    marcarPendiente(false);
    return true;
  } catch {
    return false;
  }
}

// Al abrir el panel: recalcula si quedó algo pendiente o si hoy no se hizo.
export async function recalcularAccesosSiHaceFalta(): Promise<void> {
  let pendiente = false;
  try {
    pendiente = localStorage.getItem(CLAVE_PENDIENTE) === "1";
  } catch {
    // sin almacenamiento local
  }
  const marca = await getDoc(DOC_MARCA);
  if (pendiente || !marca.exists() || marca.data().fecha !== fechaDeHoy()) {
    await recalcularAccesosConductores();
    marcarPendiente(false);
  }
}
