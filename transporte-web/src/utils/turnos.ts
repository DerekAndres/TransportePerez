import type { Turno, TurnoNino } from "../types/models";

// ============================================
// TURNOS (mañana / tarde)
// ============================================
// Viven en su propio archivo porque los usan tanto la pantalla de Rutas como el
// armador, y las constantes compartidas no pueden salir de un archivo de
// componente (rompe el recargado en caliente de Vite).

export const TURNOS: { value: Turno; label: string }[] = [
  { value: "manana", label: "Mañana" },
  { value: "tarde", label: "Tarde" },
];

export const etiquetaTurno = (t?: Turno) => TURNOS.find((x) => x.value === t)?.label ?? "—";

// Un niño es candidato de una ruta si viaja en ese turno (o en ambos)
export const viajaEnTurno = (turnoNino: TurnoNino | undefined, turnoRuta: string) =>
  !!turnoNino && (turnoNino === turnoRuta || turnoNino === "ambos");
