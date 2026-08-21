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
// El estilo buscado es el de las apps modernas de consumo: mucho aire, tarjetas
// blancas de esquinas MUY suaves, sombras difusas apenas perceptibles (nada de
// bordes duros) y tipografía con jerarquía clara — un título grande y bien
// marcado, un dato chico y gris debajo. Los colores salen del tema
// (constants/tema.ts); acá solo hay medidas.

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
// Redondez generosa: es lo que más define el "se siente suave" de una app.
export const RADIO = {
  tarjeta: 26, // tarjetas y contenedores grandes
  control: 18, // botones tonales, tiles de acción, campos
  pastilla: 999, // chips de estado y badges (cápsula perfecta)
} as const;

// --- Alturas de referencia ---
export const ALTURA = {
  encabezado: 56, // la barra superior con el menú y el nombre
  mapaPrevia: 190, // el mapa embebido dentro de una tarjeta
  heroMapa: 280, // el mapa grande que corona el inicio del padre
  portada: 120, // la foto que corona una tarjeta (canal, unidad)
  botonPrincipal: 58, // el botón grande de acción (iniciar/finalizar viaje)
} as const;

// Sombra suave y común a todas las tarjetas. En Android se usa `elevation`;
// en iOS, las cuatro propiedades de sombra. Se define una sola vez para que
// ninguna tarjeta quede con una sombra más dura que las demás.
// Es a propósito MUY difusa y de poca opacidad: la tarjeta tiene que parecer
// apoyada sobre el fondo, no recortada con un borde.
// El color de la sombra es MARRÓN CÁLIDO, no negro ni azul: sobre el blanco de
// la app, una sombra fría se ve sucia (gris verdoso). Va muy tenue porque el
// contorno de la tarjeta ya lo dibuja el borde de un pelo (ver `bordeTarjeta`);
// la sombra solo aporta la sensación de que la tarjeta está apoyada.
export const SOMBRA_TARJETA = {
  shadowColor: "#5A1F0A",
  shadowOpacity: 0.07,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

// Sombra un poco más presente, para lo que "flota" sobre el resto: el botón
// principal de una pantalla y las pastillas que van encima de un mapa.
export const SOMBRA_FLOTANTE = {
  shadowColor: "#5A1F0A",
  shadowOpacity: 0.22,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
} as const;

// Estilos que se repiten literalmente igual en todas las pantallas.
// Se crean con StyleSheet.create para que React Native los cachee.
export const estilosBase = StyleSheet.create({
  pantalla: { flex: 1 },
  // Contenido de un ScrollView de pantalla completa. El espacio de abajo lo
  // agrega PantallaBase según el teléfono (ver `respiroInferior`).
  scroll: {
    paddingHorizontal: ESPACIO.pantalla,
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
  negrita: { fontWeight: "700" },
  filaEntre: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});

// Aire que se deja al final de una pantalla con scroll, POR ENCIMA de lo que
// ocupe la barra de navegación del teléfono. Es la clave para que la app se vea
// bien en los dos tipos de Android que hay hoy:
//   - con barra de 3 botones (atrás/inicio/recientes) → inset grande (~48 px)
//   - con navegación por gestos → inset chico (~12 px)
// y en los iPhone con notch (~34 px). Sin esto, la última tarjeta queda debajo
// de los botones del sistema y no se puede tocar.
export function respiroInferior(insetInferior: number): number {
  return insetInferior + 32;
}

// Fondo de una tarjeta según el tema. Se usa como
// `[estilosBase.tarjeta, { backgroundColor: fondoTarjeta(tema) }]`.
export function fondoTarjeta(tema: MD3Theme): string {
  return tema.dark ? tema.colors.elevation.level2 : "#FFFFFF";
}

// Borde de una tarjeta. La app es blanca sobre blanco, así que la sombra sola
// no alcanza para saber dónde empieza y termina una tarjeta: este borde de un
// pelo, en un gris cálido apenas visible, es el que dibuja el contorno. En modo
// oscuro cumple el mismo papel separando superficies.
export function bordeTarjeta(tema: MD3Theme): string {
  return tema.colors.outlineVariant;
}
