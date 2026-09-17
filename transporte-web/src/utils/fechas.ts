// Fecha LOCAL en formato "YYYY-MM-DD", el mismo que usan Viaje.fecha y
// Suplencia.fecha. Local y no UTC a propósito: a las 7 de la noche en La Ceiba,
// en UTC ya es el día siguiente.
export function fechaISO(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export function fechaDeHoy(): string {
  return fechaISO(new Date());
}

// "2026-09-11" → "vie 11/09/2026", para mostrar una fecha guardada como texto
export function fechaLegible(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const d = new Date(anio, mes - 1, dia);
  const dias = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  return `${dias[d.getDay()]} ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${anio}`;
}
