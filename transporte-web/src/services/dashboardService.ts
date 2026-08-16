import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { db } from "./firebase";

export interface Totales {
  ninosActivos: number;
  busesActivos: number;
  rutasActivas: number;
  escuelasActivas: number;
  viajesHoy: number;
}

// Devuelve la fecha local de hoy en formato "YYYY-MM-DD" (mismo formato que Viaje.fecha)
function fechaDeHoy(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

// --- Totales para las cards del dashboard ---
// Usamos getCountFromServer: cuenta en el servidor sin descargar los documentos,
// mucho más barato en cuota del plan gratuito que traerlos todos.
export async function obtenerTotales(): Promise<Totales> {
  const [ninos, buses, rutas, escuelas, viajes] = await Promise.all([
    getCountFromServer(query(collection(db, "ninos"), where("activo", "==", true))),
    getCountFromServer(query(collection(db, "buses"), where("activo", "==", true))),
    getCountFromServer(query(collection(db, "rutas"), where("activa", "==", true))),
    getCountFromServer(query(collection(db, "escuelas"), where("activa", "==", true))),
    getCountFromServer(query(collection(db, "viajes"), where("fecha", "==", fechaDeHoy()))),
  ]);

  return {
    ninosActivos: ninos.data().count,
    busesActivos: buses.data().count,
    rutasActivas: rutas.data().count,
    escuelasActivas: escuelas.data().count,
    viajesHoy: viajes.data().count,
  };
}
