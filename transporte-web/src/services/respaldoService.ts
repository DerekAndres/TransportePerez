import { collection, getCountFromServer, getDocs, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

// ============================================
// RESPALDO DE LA BASE DE DATOS
// ============================================
// En el plan gratuito (Spark) Firebase NO hace copias de seguridad: la
// exportación y los respaldos programados de Firestore exigen facturación. Si
// un documento se borra por error, no hay de dónde recuperarlo.
//
// Esta es la salida mínima y sin costo: el admin descarga desde el panel un
// archivo JSON con las colecciones, y lo guarda donde la empresa guarde sus
// papeles importantes. Cada documento queda con su id, y las fechas de Firestore
// se escriben de forma que se puedan reconstruir ({ "__tipo": "timestamp" }).
//
// Límite honesto: restaurar desde este archivo no está automatizado; habría que
// hacerlo con un script. Lo que sí garantiza es que la información no se pierde.
//
// `ubicaciones` no se incluye: es la posición en vivo de los viajes en curso y
// se borra sola al terminar cada viaje.

export const COLECCIONES_RESPALDO: { id: string; etiqueta: string }[] = [
  { id: "usuarios", etiqueta: "Cuentas (padres, conductores y administración)" },
  { id: "ninos", etiqueta: "Niños" },
  { id: "buses", etiqueta: "Unidades" },
  { id: "escuelas", etiqueta: "Escuelas" },
  { id: "puntos", etiqueta: "Puntos de transbordo" },
  { id: "rutas", etiqueta: "Rutas" },
  { id: "suplencias", etiqueta: "Suplencias" },
  { id: "solicitudes", etiqueta: "Solicitudes de los padres" },
  { id: "canales", etiqueta: "Canales de avisos" },
  { id: "avisos", etiqueta: "Avisos publicados" },
  { id: "viajes", etiqueta: "Viajes" },
  { id: "registros", etiqueta: "Registros de asistencia" },
  { id: "incidencias", etiqueta: "Novedades de los viajes" },
  { id: "recorridos", etiqueta: "Recorridos de los viajes" },
  { id: "mensajes", etiqueta: "Mensajes" },
  { id: "auditoria", etiqueta: "Auditoría" },
];

// --- Cuántos documentos tiene cada colección ---
// getCountFromServer cuenta en el servidor sin descargar nada: sirve para
// avisar ANTES cuántas lecturas del plan gratuito va a gastar el respaldo.
export async function contarDocumentos(ids: string[]): Promise<Record<string, number>> {
  const pares = await Promise.all(
    ids.map(async (id) => [id, (await getCountFromServer(collection(db, id))).data().count] as const)
  );
  return Object.fromEntries(pares);
}

// Los tipos de Firestore que JSON no conoce, a un formato reconstruible
function aJson(valor: unknown): unknown {
  if (valor instanceof Timestamp) return { __tipo: "timestamp", iso: valor.toDate().toISOString() };
  if (Array.isArray(valor)) return valor.map(aJson);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, aJson(v)]));
  }
  return valor;
}

// --- Arma el archivo con las colecciones elegidas ---
export async function armarRespaldo(
  ids: string[],
  alAvanzar: (listas: number, total: number) => void
): Promise<Blob> {
  const colecciones: Record<string, Record<string, unknown>> = {};
  for (let i = 0; i < ids.length; i++) {
    const snap = await getDocs(collection(db, ids[i]));
    colecciones[ids[i]] = Object.fromEntries(snap.docs.map((d) => [d.id, aJson(d.data())]));
    alAvanzar(i + 1, ids.length);
  }
  const respaldo = {
    sistema: "Transporte escolar Inversiones Perez",
    proyecto: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    creadoEn: new Date().toISOString(),
    colecciones,
  };
  return new Blob([JSON.stringify(respaldo, null, 2)], { type: "application/json" });
}
