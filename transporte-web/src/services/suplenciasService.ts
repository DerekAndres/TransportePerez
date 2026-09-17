import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { auditar } from "./auditoriaService";
import { fechaISO } from "../utils/fechas";
import type { Bus, Suplencia, Usuario } from "../types/models";

// ============================================
// SUPLENCIAS (lado del admin)
// ============================================
// Cómo funciona, de punta a punta:
//
//   1. El titular de una unidad avisa que mañana no puede manejar.
//   2. El admin entra a Suplencias, elige la unidad, el conductor que lo cubre
//      y la fecha. Se guarda UN documento "<busId>_<fecha>" (con su auditoría).
//   3. El panel recalcula qué niños ve cada conductor: el suplente pasa a poder
//      leer a los niños de las rutas de esa unidad.
//   4. Ese día, en la app:
//        - el SUPLENTE ve las rutas de la unidad en "Mi ruta de hoy" y es quien
//          inicia los viajes (las reglas de Firestore solo lo dejan a él);
//        - el TITULAR ve "Hoy te cubre …" y no puede iniciarlos;
//        - el PADRE ve al suplente en la tarjeta de quién lleva a su hijo, con
//          su teléfono para llamarlo.
//   5. Al día siguiente no hay nada que deshacer: la asignación permanente de la
//      unidad nunca se tocó, y al abrir el panel se recalculan los accesos, con
//      lo que el suplente deja de ver a esos niños.
//
// Una suplencia no se borra: se CANCELA (queda en el historial y en la auditoría).

export function idSuplencia(busId: string, fecha: string): string {
  return `${busId}_${fecha}`;
}

// --- Suplencias desde hace una semana en adelante ---
// Las más viejas quedan guardadas, pero no hacen falta en la pantalla. Un solo
// filtro de rango sobre `fecha`: no requiere índice compuesto.
export async function listarSuplenciasRecientes(): Promise<Suplencia[]> {
  const desde = fechaISO(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const snap = await getDocs(query(collection(db, "suplencias"), where("fecha", ">=", desde)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Suplencia)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.busPlaca.localeCompare(b.busPlaca));
}

// --- Asigna (o reasigna) el suplente de una unidad para una fecha ---
// Si ya había una suplencia ese día para esa unidad —vigente o cancelada— se
// reemplaza: el id es el mismo y queda anotado en la auditoría.
export async function asignarSuplente(datos: {
  bus: Bus;
  titular: Usuario | undefined;
  suplente: Usuario;
  fecha: string;
}): Promise<void> {
  const { bus, titular, suplente, fecha } = datos;
  const id = idSuplencia(bus.id, fecha);
  const lote = writeBatch(db);
  const auditoriaId = auditar(
    lote,
    "suplencias",
    "asignar_suplente",
    [id],
    `${suplente.nombre} cubre la unidad ${bus.placa} el ${fecha} (titular: ${titular?.nombre ?? "—"})`
  );
  lote.set(doc(db, "suplencias", id), {
    busId: bus.id,
    busPlaca: bus.placa,
    fecha,
    titularId: bus.conductorId,
    titularNombre: titular?.nombre ?? "",
    conductorId: suplente.id,
    conductorNombre: suplente.nombre,
    cancelada: false,
    creadaEn: serverTimestamp(),
    auditoriaId,
  });
  await lote.commit();
}

// --- Cancela una suplencia: ese día vuelve a manejar el titular ---
export async function cancelarSuplencia(suplencia: Suplencia): Promise<void> {
  const lote = writeBatch(db);
  const auditoriaId = auditar(
    lote,
    "suplencias",
    "cancelar_suplencia",
    [suplencia.id],
    `Canceló la suplencia de ${suplencia.conductorNombre} en la unidad ${suplencia.busPlaca} el ${suplencia.fecha}`
  );
  lote.update(doc(db, "suplencias", suplencia.id), { cancelada: true, auditoriaId });
  await lote.commit();
}
