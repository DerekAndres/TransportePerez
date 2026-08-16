import { StyleSheet } from "react-native";
import type { MD3Theme } from "react-native-paper";

// ============================================
// TOKENS DE DISEÑO — lenguaje visual de la app
// ============================================
// Un solo lugar donde viven las medidas que se repiten en todas las pantallas.
// La idea es que ninguna pantalla invente su propio margen o su propia esquina
// redondeada: si todas leen de acá, la app se ve como UNA sola app y un cambio
// de estilo se hace en un archivo, no en quince.
//
// El estilo buscado es minimalista: mucho aire, tarjetas blancas de esquinas
// muy suaves, sombras apenas perceptibles y tipografía con jerarquía clara
// (un título grande, un dato chico y gris). Los colores salen del tema
// (constants/tema.ts) — acá solo hay medidas.

// --- Espaciado ---
export const ESPACIO = {
  // Margen lateral de TODAS las pantallas (el "canal" de lectura)
  pantalla: 20,
  // Separación entre bloques grandes (tarjeta y tarjeta, sección y sección)
  seccion: 22,
  // Separación entre elementos dentro de un mismo bloque
  interno: 12,
  // Separación mínima (ícono y su texto, etiqueta y su valor)
  minimo: 6,
} as const;

// --- Esquinas redondeadas ---
export const RADIO = {
  tarjeta: 22, // tarjetas y contenedores grandes
  control: 16, // botones tonales, tiles de acción, campos
  pastilla: 999, // chips de estado y badges (cápsula perfecta)
} as const;

// --- Alturas de referencia ---
export const ALTURA = {
  encabezado: 56, // la barra superior con el menú y el nombre
  mapaPrevia: 190, // el mapa embebido dentro de una tarjeta
  portada: 120, // la foto que corona una tarjeta (canal, unidad)
} as const;

// Sombra suave y común a todas las tarjetas. En Android se usa `elevation`;
// en iOS, las cuatro propiedades de sombra. Se define una sola vez para que
// ninguna tarjeta quede con una sombra más dura que las demás.
export const SOMBRA_TARJETA = {
  shadowColor: "#0D2854",
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

// Estilos que se repiten literalmente igual en todas las pantallas.
// Se crean con StyleSheet.create para que React Native los cachee.
export const estilosBase = StyleSheet.create({
  pantalla: { flex: 1 },
  // Contenido de un ScrollView de pantalla completa
  scroll: {
    paddingHorizontal: ESPACIO.pantalla,
    paddingBottom: 40,
    gap: ESPACIO.seccion,
  },
  tarjeta: {
    borderRadius: RADIO.tarjeta,
    padding: ESPACIO.pantalla,
    gap: ESPACIO.interno,
    ...SOMBRA_TARJETA,
  },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  // Texto secundario: el gris de las etiquetas y las aclaraciones
  tenue: { opacity: 0.6 },
  filaEntre: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});

// Fondo de una tarjeta según el tema (claro: blanco puro sobre el fondo
// azulado; oscuro: la superficie elevada del tema). Se usa como
// `[estilosBase.tarjeta, { backgroundColor: fondoTarjeta(tema) }]`.
export function fondoTarjeta(tema: MD3Theme): string {
  return tema.dark ? tema.colors.elevation.level2 : "#FFFFFF";
}
