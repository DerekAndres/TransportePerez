import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";
import type { Registro, Viaje } from "../types/models";

// ============================================
// FASE 8 — Reportes (admin)
// ============================================
// Consultas con filtros de igualdad o un solo rango sobre 'fecha' (sin índices
// compuestos). Los filtros finos (ruta, conductor) y el orden se resuelven en el
// cliente, como en el resto del proyecto.

// --- Viajes entre dos fechas (inclusive), formato "YYYY-MM-DD" ---
// El rango es sobre un solo campo (fecha) → no requiere índice compuesto. Los
// filtros por ruta o conductor se aplican después en el cliente.
export async function listarViajesEnRango(desde: string, hasta: string): Promise<Viaje[]> {
  const snap = await getDocs(
    query(collection(db, "viajes"), where("fecha", ">=", desde), where("fecha", "<=", hasta))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Viaje);
}

// --- Niños transportados en un viaje ---
// = niños DISTINTOS que subieron al bus en ese viaje. Se leen los 'registros' del
// viaje (igualdad por viajeId) y se cuentan los ninoId únicos con evento 'subio'.
//
// ⚠️ Hay que descartar las marcas que el conductor DESHIZO. Si marcó "subió" por
// error y lo corrigió, ese niño nunca viajó: contarlo inflaría el reporte, que
// es justamente el número que la empresa mira. Un registro 'anulado' tacha al
// anterior del mismo niño, así que se procesa cada niño por separado y en orden
// (misma lógica que `registrosEfectivos` del móvil).
export async function contarNinosTransportados(viajeId: string): Promise<number> {
  const snap = await getDocs(query(collection(db, "registros"), where("viajeId", "==", viajeId)));
  const registros = snap.docs
    .map((d) => d.data() as Registro)
    .sort((a, b) => a.hora.toMillis() - b.hora.toMillis());

  const porNino = new Map<string, Registro[]>();
  registros.forEach((r) => {
    const pila = porNino.get(r.ninoId) ?? [];
    if (r.evento === "anulado") pila.pop();
    else pila.push(r);
    porNino.set(r.ninoId, pila);
  });

  let subieron = 0;
  porNino.forEach((pila) => {
    if (pila.some((r) => r.evento === "subio")) subieron += 1;
  });
  return subieron;
}

// --- Historial de asistencia de un niño: todos sus registros ---
// Igualdad por ninoId (mismo requisito que las reglas le imponen al padre; el
// admin igual lee todo). El orden por hora se hace en el cliente.
export async function listarRegistrosDeNino(ninoId: string): Promise<Registro[]> {
  const snap = await getDocs(query(collection(db, "registros"), where("ninoId", "==", ninoId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Registro)
    .sort((a, b) => a.hora.toMillis() - b.hora.toMillis());
}
