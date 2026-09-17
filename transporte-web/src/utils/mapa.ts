// ============================================
// DE DÓNDE SALEN LAS TESELAS DE LOS MAPAS DEL PANEL
// ============================================
// Los mapas del panel pedían las teselas a tile.openstreetmap.org, el mismo
// servidor que bloqueó a la app móvil ("Access blocked": la política de uso de
// OSM no permite el consumo sistemático de una aplicación; ver
// transporte-movil/constants/mapa.ts). Ahora el panel usa EXACTAMENTE los mismos
// proveedores que la app:
//
//   · Principal: OpenStreetMap Alemania (FOSSGIS e.V.), el estilo clásico de OSM.
//   · Respaldo automático: Esri World Street Map, si el principal falla.
//
// Si mañana hay que cambiar de proveedor, se cambia acá y los mapas del panel lo
// siguen solos.
//
// ⚠️ Al cambiar de proveedor hay que agregar su dominio a `img-src` en la
// Content-Security-Policy de firebase.json: si no, el navegador bloquea las
// teselas y el mapa sale gris.
export const TESELAS = {
  url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
  atribucion:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · estilo OSM Deutschland',
  // Ojo: Esri ordena las coordenadas {y}/{x}, al revés que OSM. Confundirlas no da
  // error: carga teselas de otro lugar del mundo.
  urlRespaldo:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  atribucionRespaldo: "&copy; Esri, HERE, Garmin, &copy; OpenStreetMap",
  maxZoom: 19,
} as const;

// Después de cuántas teselas fallidas SEGUIDAS se pasa al respaldo
export const ERRORES_PARA_RESPALDO = 5;
