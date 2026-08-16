// ============================================
// Exportación a CSV — sin librerías externas (Fase 8)
// ============================================
// El informe pide "exportación CSV mínimo viable". Se genera a mano en vez de
// instalar papaparse: es poco código, no agrega dependencias y Derek lo puede
// explicar entero. El formato sigue RFC 4180.

// Escapa una celda: si contiene coma, comillas o salto de línea, se envuelve en
// comillas dobles y las comillas internas se duplican.
function celda(valor: string | number): string {
  const texto = String(valor ?? "");
  return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

// Arma el CSV y dispara la descarga en el navegador.
export function descargarCSV(
  nombreArchivo: string,
  encabezados: string[],
  filas: (string | number)[][]
): void {
  const lineas = [encabezados, ...filas].map((fila) => fila.map(celda).join(","));
  // El BOM (código 0xFEFF) al inicio hace que Excel interprete los acentos como
  // UTF-8 en vez de romperlos. Se arma con fromCharCode para no dejar un carácter
  // invisible en el código fuente.
  const bom = String.fromCharCode(0xfeff);
  const contenido = bom + lineas.join("\r\n");
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
}
