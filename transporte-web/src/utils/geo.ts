// ============================================
// DISTANCIAS GEOGRÁFICAS
// ============================================
// Es la MISMA fórmula haversine que usa la app del conductor para el aviso de
// "el bus está cerca" (transporte-movil/services/notificacionesService.ts).
// Acá sirve para otra cosa: ordenar a los niños candidatos por cercanía a lo
// que el bus ya lleva, para que el admin arme la ruta por zonas y no
// alfabéticamente. Con más de 100 niños es la diferencia entre una lista
// utilizable y una pared de nombres.

export interface Coordenada {
  lat: number;
  lng: number;
}

// Distancia en metros entre dos coordenadas, tomando la Tierra como una esfera
// de radio 6371 km. Para distancias urbanas (unos pocos km) el error es
// despreciable y no hace falta nada más caro.
export function distanciaMetros(a: Coordenada, b: Coordenada): number {
  const RADIO_TIERRA_M = 6371000;
  const rad = (grados: number) => (grados * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(h));
}

// Distancia al más cercano de una lista de referencias. Devuelve Infinity si no
// hay ninguna referencia: así, al ordenar, los que no se pueden medir quedan
// naturalmente al final sin necesitar un caso especial.
export function distanciaAlMasCercano(origen: Coordenada, referencias: Coordenada[]): number {
  let minima = Infinity;
  for (const referencia of referencias) {
    const d = distanciaMetros(origen, referencia);
    if (d < minima) minima = d;
  }
  return minima;
}

// Texto corto para mostrar en una etiqueta: "350 m", "1.2 km", "12 km".
export function formatearDistancia(metros: number): string {
  if (!isFinite(metros)) return "";
  if (metros < 1000) return `${Math.round(metros / 10) * 10} m`;
  const km = metros / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
