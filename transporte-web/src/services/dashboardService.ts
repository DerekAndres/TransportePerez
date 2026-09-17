import { collection, getCountFromServer, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";
import type { Registro, Viaje } from "../types/models";

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

// ============================================
// RESUMEN DE HOY (lo que el dashboard usa arriba)
// ============================================
// Un tablero de cinco contadores dice cuánto hay, pero no dice QUÉ HACER. Esto
// responde lo otro: cómo viene el día y qué está esperando al admin.
//
// Costo en lecturas: los viajes de hoy (unos pocos) más los registros de cada
// uno. Con diez rutas son del orden de 200 lecturas por carga del tablero.
// Es aceptable para una pantalla que se abre unas pocas veces al día, pero por
// eso NO se deja en tiempo real con un listener: eso multiplicaría el gasto por
// cada cambio de asistencia (ver el análisis de cuota en el informe, §5.7.2).
export interface ResumenHoy {
  enCurso: number;
  finalizados: number;
  // Rutas activas que hoy todavía no salieron
  rutasSinSalir: number;
  // Niños distintos que efectivamente subieron hoy
  ninosTransportados: number;
  // Niños que el bus no pudo recoger porque no estaban en la parada
  noRecogidos: number;
  // Solicitudes de padres esperando respuesta
  solicitudesPendientes: number;
}

export async function obtenerResumenHoy(): Promise<ResumenHoy> {
  const hoy = fechaDeHoy();

  const [snapViajes, contRutas, contSolicitudes] = await Promise.all([
    getDocs(query(collection(db, "viajes"), where("fecha", "==", hoy))),
    getCountFromServer(query(collection(db, "rutas"), where("activa", "==", true))),
    getCountFromServer(query(collection(db, "solicitudes"), where("estado", "==", "pendiente"))),
  ]);

  const viajes = snapViajes.docs.map((d) => ({ id: d.id, ...d.data() }) as Viaje);
  const enCurso = viajes.filter((v) => v.estado === "en_curso").length;
  const finalizados = viajes.filter((v) => v.estado === "finalizado").length;

  // Rutas que hoy no tienen ningún viaje. Se cuentan rutas DISTINTAS porque una
  // ruta podría tener más de un viaje en el día.
  const rutasConViaje = new Set(viajes.map((v) => v.rutaId));
  const rutasSinSalir = Math.max(0, contRutas.data().count - rutasConViaje.size);

  // Asistencia real de hoy. Se procesa niño por niño y en orden porque un
  // registro 'anulado' TACHA al anterior: sin esto, una marca que el conductor
  // deshizo contaría como un niño transportado (misma lógica que
  // registrosEfectivos en el móvil).
  const transportados = new Set<string>();
  const noRecogidos = new Set<string>();

  const porViaje = await Promise.all(
    viajes.map((v) => getDocs(query(collection(db, "registros"), where("viajeId", "==", v.id))))
  );

  porViaje.forEach((snap) => {
    const registros = snap.docs
      .map((d) => d.data() as Registro)
      .sort((a, b) => a.hora.toMillis() - b.hora.toMillis());

    const pilaPorNino = new Map<string, Registro[]>();
    registros.forEach((r) => {
      const pila = pilaPorNino.get(r.ninoId) ?? [];
      if (r.evento === "anulado") pila.pop();
      else pila.push(r);
      pilaPorNino.set(r.ninoId, pila);
    });

    pilaPorNino.forEach((pila, ninoId) => {
      if (pila.some((r) => r.evento === "subio")) transportados.add(ninoId);
      // "No estaba" solo cuenta si además NO terminó subiendo: si el niño
      // apareció corriendo y el conductor lo marcó, el día salió bien.
      else if (pila.some((r) => r.evento === "no_estaba")) noRecogidos.add(ninoId);
    });
  });

  return {
    enCurso,
    finalizados,
    rutasSinSalir,
    ninosTransportados: transportados.size,
    noRecogidos: noRecogidos.size,
    solicitudesPendientes: contSolicitudes.data().count,
  };
}
