import {
  Timestamp,
  addDoc,
  serverTimestamp,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { notificarIncidencia } from "./notificacionesService";
import type { Incidencia, TipoIncidencia } from "../types/models";

// ============================================
// NOVEDADES DEL VIAJE
// ============================================
// Lo que el conductor reporta a mitad de camino y no es una marca de
// asistencia: se pinchó una rueda, hay un tranque, se largó a llover.
//
// El circuito completo, que es lo que hay que poder explicar:
//   1. el conductor elige un tipo y, si quiere, escribe un renglón;
//   2. se guarda un documento en `incidencias` con TODO el contexto copiado
//      (ruta, unidad, conductor) — así el admin lee un solo documento;
//   3. se manda una notificación a los padres de los niños que en ese momento
//      van ARRIBA del bus, y otra a la administración.
//
// El paso 3 NUNCA hace fallar al paso 2: si no hay señal para enviar los
// avisos, la novedad igual queda registrada. Al revés sería peor — el padre se
// entera y no queda constancia.

// Qué dice cada tipo, en la app del conductor y en el aviso que le llega al
// padre. Están acá y no en la pantalla para que el texto que ve el conductor y
// el que recibe el padre no puedan desincronizarse.
export const TIPOS_INCIDENCIA: {
  tipo: TipoIncidencia;
  etiqueta: string;
  icono: string;
  // Lo que se le dice al PADRE. Es distinto de la etiqueta a propósito: el
  // conductor elige "Avería" y el padre tiene que leer algo que lo tranquilice
  // y le diga qué significa para su hijo, no una palabra suelta.
  avisoAlPadre: string;
}[] = [
  {
    tipo: "averia",
    etiqueta: "Problema con la unidad",
    icono: "car-wrench",
    avisoAlPadre: "El bus tuvo un problema mecánico. Los niños están bien; la ruta va a demorarse.",
  },
  {
    tipo: "trafico",
    etiqueta: "Tráfico o tranque",
    icono: "traffic-light",
    avisoAlPadre: "Hay mucho tráfico en la ruta. El bus va a llegar más tarde de lo normal.",
  },
  {
    tipo: "clima",
    etiqueta: "Lluvia o mal tiempo",
    icono: "weather-pouring",
    avisoAlPadre: "El mal tiempo está retrasando la ruta. El bus avanza con precaución.",
  },
  {
    tipo: "demora",
    etiqueta: "Voy con retraso",
    icono: "clock-alert-outline",
    avisoAlPadre: "El bus va con retraso respecto del horario habitual.",
  },
  {
    tipo: "otro",
    etiqueta: "Otra novedad",
    icono: "alert-circle-outline",
    avisoAlPadre: "El conductor reportó una novedad en la ruta.",
  },
];

export function descripcionDeTipo(tipo: TipoIncidencia): string {
  return TIPOS_INCIDENCIA.find((t) => t.tipo === tipo)?.etiqueta ?? "Novedad";
}

// --- El conductor reporta una novedad ---
// Devuelve `avisados`: a cuántos padres se les pudo mandar la notificación. Se
// devuelve para poder DECÍRSELO al conductor: "avisamos a 8 padres" es una
// confirmación de verdad; "listo" no dice si sirvió de algo.
export async function reportarIncidencia(datos: {
  viajeId: string | null;
  rutaId: string;
  rutaNombre: string;
  busId: string;
  busPlaca: string;
  conductorId: string;
  conductorNombre: string;
  tipo: TipoIncidencia;
  texto: string;
  // Los niños que van ARRIBA del bus en este momento. Se usan para saber a qué
  // padres avisar; en el documento solo queda la CANTIDAD.
  ninoIdsABordo: string[];
}): Promise<{ avisados: number }> {
  const incidencia = {
    viajeId: datos.viajeId,
    rutaId: datos.rutaId,
    rutaNombre: datos.rutaNombre,
    busId: datos.busId,
    busPlaca: datos.busPlaca,
    conductorId: datos.conductorId,
    conductorNombre: datos.conductorNombre,
    tipo: datos.tipo,
    texto: datos.texto.trim(),
    hora: Timestamp.now(),
    // La del servidor es la que vale como constancia (la exigen las reglas)
    horaServidor: serverTimestamp(),
    ninosABordo: datos.ninoIdsABordo.length,
  };

  // Primero queda registrado. Si esto falla, se propaga el error y el conductor
  // lo ve: no tiene sentido avisar de algo que no se guardó.
  await addDoc(collection(db, "incidencias"), incidencia);

  // Y recién después se avisa. Los errores de envío se tragan a propósito: la
  // novedad YA quedó registrada, y dejar la pantalla en rojo por una
  // notificación que no salió haría que el conductor la reporte dos veces.
  try {
    return await notificarIncidencia({
      ...incidencia,
      ninoIdsABordo: datos.ninoIdsABordo,
    });
  } catch {
    return { avisados: 0 };
  }
}

// --- Las novedades de hoy, en vivo (panel del admin) ---
// Se filtra por fecha en el cliente: en servidor haría falta un campo `fecha`
// aparte o un índice compuesto, y el volumen de un día son unas pocas.
export function escucharIncidenciasDeHoy(
  callback: (lista: Incidencia[]) => void
): Unsubscribe {
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);

  return onSnapshot(
    query(
      collection(db, "incidencias"),
      where("hora", ">=", Timestamp.fromDate(desde)),
      orderBy("hora", "desc")
    ),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Incidencia)),
    () => callback([])
  );
}

// --- Las novedades de un viaje (para el reporte del admin) ---
export async function listarIncidenciasDeViaje(viajeId: string): Promise<Incidencia[]> {
  const snap = await getDocs(
    query(collection(db, "incidencias"), where("viajeId", "==", viajeId))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Incidencia)
    .sort((a, b) => a.hora.toMillis() - b.hora.toMillis());
}
