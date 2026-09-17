import { StyleSheet } from "react-native";
import type { MD3Theme } from "react-native-paper";

import { FUENTES } from "@/constants/tema";

// ============================================
// TOKENS DE DISEÑO — el lenguaje visual de la app
// ============================================
// Un solo lugar donde viven las medidas que se repiten en todas las pantallas.
// Si todas leen de acá, la app se ve como UNA sola app y un cambio de estilo se
// hace en un archivo, no en veinticinco. Los colores salen del tema
// (constants/tema.ts); acá solo hay medidas, bordes y sombras.
//
// El material de esta app es el VIDRIO sobre OBSIDIANA: láminas translúcidas
// con un filo de luz en el borde de arriba, flotando sobre un fondo casi negro.
// Nada se separa del fondo por tener otro color de relleno — se separa por su
// borde iluminado y por el desenfoque de lo que tiene detrás.

// --- Espaciado ---
// Base de 8 puntos, con medios pasos de 4 para las pastillas (lo que el design
// system llama "8pt base grid with a 4pt sub-grid for badges").
export const ESPACIO = {
  // Margen lateral de TODAS las pantallas (margin-mobile: 1.25rem)
  pantalla: 20,
  // Separación entre bloques grandes (tarjeta y tarjeta, sección y sección)
  seccion: 20,
  // Separación entre elementos dentro de un mismo bloque (gutter-mobile: 1rem)
  canal: 16,
  interno: 12,
  // Separación mínima (ícono y su texto, etiqueta y su valor)
  minimo: 6,
} as const;

// --- Esquinas redondeadas ---
// El design system define tres escalones y una REGLA que los relaciona:
// "cuando una tarjeta va adentro de otra, el radio de la hija tiene que ser el
// de la madre MENOS el relleno". Así los arcos quedan concéntricos y no se ve
// ese efecto de esquinas peleándose que delata una interfaz armada a ojo.
// Ejemplo real: la lámina de una parada (24) con relleno de 12 lleva adentro
// filas de niños de radio 12.
export const RADIO = {
  lamina: 24, // láminas grandes, hojas flotantes, modales (rounded-2xl)
  tarjeta: 16, // tarjetas y módulos de datos (rounded-xl)
  boton: 16, // el botón principal: rectángulo suave, no cápsula
  control: 12, // campos de texto y contenedores chicos
  pastilla: 999, // pastillas de estado e insignias (cápsula perfecta)
} as const;

// --- Alturas de referencia ---
export const ALTURA = {
  encabezado: 56, // la barra superior con el título
  mapaPrevia: 190, // el mapa embebido dentro de una tarjeta
  heroMapa: 280, // el mapa embebido cuando NO ocupa la mitad de la pantalla
  portada: 120, // la foto que corona una tarjeta (canal, unidad)
  botonPrincipal: 58, // el botón grande de acción (iniciar/finalizar viaje)
  barraBurbuja: 66, // la barra de navegación flotante de abajo
  // Alto mínimo de la fila de un niño en la lista de asistencia. El design
  // system lo fija en 72 y explica por qué: con el bus en movimiento, filas más
  // juntas hacen que el conductor marque al hermano equivocado.
  filaNino: 72,
} as const;

// ============================================
// EL VIDRIO
// ============================================
// Las tres capas de vidrio del design system, traducidas a React Native.
//
// ⚠️ DOS COSAS QUE REACT NATIVE NO SABE HACER, Y CÓMO SE RESUELVEN ACÁ:
//
//   1. NO EXISTE la sombra interior (`inset`). El diseño pide un filo de luz
//      DENTRO del borde de arriba de cada lámina — es el reflejo especular, la
//      firma visual de todo el sistema. Se resuelve dibujando una línea de 1 px
//      pegada al borde superior, por dentro (ver `components/Vidrio.tsx`). Es
//      literalmente lo mismo que hace el `inset 0 1px 0` de CSS.
//
//   2. NO SE PUEDEN APILAR VARIAS SOMBRAS. El diseño pide dos por lámina (una
//      difusa que cae y otra que ilumina el borde). Se conserva la que cae —
//      que es la que da la altura — y la del borde se reemplaza por el borde
//      de 1 px, que sobre negro cumple la misma función.
//
// CUÁNDO SE USA VIDRIO DE VERDAD Y CUÁNDO NO (regla de la app):
// el desenfoque solo tiene sentido si HAY ALGO DETRÁS que desenfocar — el mapa,
// una foto, el contenido que pasa por debajo de la barra flotante. Sobre el
// fondo liso de una pantalla con scroll, desenfocar un color plano da el mismo
// color plano, pero cuesta caro en teléfonos de gama baja, que es justo lo que
// tienen los padres (CLAUDE.md §2). Por eso: `Vidrio` con desenfoque real donde
// hay algo detrás, y el tono sólido equivalente (`fondoTarjeta`) en las listas.
// Los tonos sólidos de `tema.colors.elevation` se calcularon justamente como
// "cómo se ve este vidrio apoyado sobre la obsidiana".
export const VIDRIO = {
  // Cuánto desenfoca cada capa (0-100, lo que espera expo-blur).
  // Equivalen a los backdrop-blur de 12 / 24 / 32 px del diseño.
  desenfoqueAmbiente: 40,
  desenfoqueFlotante: 70,
  desenfoqueSuperpuesto: 90,

  // El velo de color que va ENCIMA del desenfoque. Sin él, el vidrio toma el
  // color de lo que tiene detrás y un mapa claro lo volvería blanco.
  tinteAmbiente: "rgba(15, 23, 42, 0.60)",
  tinteFlotante: "rgba(30, 41, 59, 0.72)",
  tinteSuperpuesto: "rgba(15, 23, 42, 0.85)",

  // El contorno de un pelo que rodea toda la lámina
  borde: "rgba(255, 255, 255, 0.10)",
  bordeFuerte: "rgba(255, 255, 255, 0.16)",

  // EL FILO ESPECULAR: la línea de luz del borde de arriba. Es lo que hace que
  // la lámina parezca vidrio cortado y no un rectángulo gris. Va sola en el
  // borde superior porque la luz del diseño viene de arriba: si rodeara toda la
  // tarjeta se vería como un marco, no como un reflejo.
  filo: "rgba(255, 255, 255, 0.22)",
  filoSuave: "rgba(255, 255, 255, 0.14)",
} as const;

// Sombra de una tarjeta apoyada. Sobre un fondo casi negro una sombra se ve
// poco — su trabajo acá no es "oscurecer debajo" sino apagar el fondo alrededor
// de la lámina para que el filo de luz del borde resalte por contraste.
export const SOMBRA_TARJETA = {
  shadowColor: "#000000",
  shadowOpacity: 0.4,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
} as const;

// Sombra de lo que de verdad FLOTA sobre el resto: el botón principal, la barra
// de navegación de abajo, las pastillas que van encima de un mapa.
export const SOMBRA_FLOTANTE = {
  shadowColor: "#000000",
  shadowOpacity: 0.7,
  shadowRadius: 40,
  shadowOffset: { width: 0, height: 16 },
  elevation: 14,
} as const;

// El halo de luz de color: lo que envuelve al botón principal y a los puntos de
// estado encendidos. En el diseño es `0 4px 20px rgba(37,99,235,0.40)` — una
// sombra del MISMO color del objeto, que no oscurece sino que ilumina.
// Se usa pasándole el color del objeto: `...halo(tema.colors.primaryContainer)`.
export function halo(color: string) {
  return {
    shadowColor: color,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  } as const;
}

// ============================================
// ESTILOS REPETIDOS
// ============================================
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
    padding: ESPACIO.canal,
    gap: ESPACIO.interno,
    ...SOMBRA_TARJETA,
  },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  // Texto secundario: el gris azulado de las etiquetas y las aclaraciones
  tenue: { opacity: 0.65 },
  // ⚠️ El grosor se cambia CAMBIANDO DE FAMILIA, nunca con `fontWeight`: con una
  // fuente cargada de archivo, `fontWeight` no busca otro archivo sino que le
  // aplica negrita sintética a la que ya está, y el texto sale engordado y
  // sucio. La explicación larga está en constants/tema.ts, sobre FUENTES.
  negrita: { fontFamily: FUENTES.textoNegrita },
  seminegrita: { fontFamily: FUENTES.textoFuerte },
  // Titulares y cifras van en Outfit, la geométrica
  titular: { fontFamily: FUENTES.titular },
  // CIFRAS DE TELEMETRÍA: horas, contadores, distancias, placas. `tabular-nums`
  // hace que todos los dígitos ocupen exactamente lo mismo, así un contador que
  // pasa de 09 a 10 no empuja el texto de al lado. Con números que se
  // actualizan en vivo, sin esto la pantalla "tiembla".
  cifra: { fontFamily: FUENTES.titularFuerte, fontVariant: ["tabular-nums"] as const },
  filaEntre: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});

// Cuánto de la pantalla se lleva el mapa en el inicio del padre ("panel
// dividido"): un 46 % del alto total, contando la barra de estado.
//
// Va como PROPORCIÓN y no como un número de píxeles a propósito. Con una altura
// fija, el mismo mapa ocupa media pantalla en un teléfono chico y apenas un
// tercio en uno grande — y entonces la división en dos mitades, que es toda la
// idea de esta pantalla, se pierde justo en los teléfonos más comunes hoy.
export const PROPORCION_MAPA_INICIO = 0.46;

// Espacio que ocupa la barra de navegación flotante, contando lo que el
// teléfono reserva abajo. Toda pantalla que dibuje algo fijo en el borde
// inferior (el botón "Iniciar viaje" del conductor, por ejemplo) tiene que
// separarse esto para no quedar tapada por la barra.
export function espacioBarra(insetInferior: number): number {
  return ALTURA.barraBurbuja + insetInferior + ESPACIO.interno * 2;
}

// Aire que se deja al final de una pantalla con scroll, POR ENCIMA de lo que
// ocupe la barra de navegación del teléfono. Es la clave para que la app se vea
// bien en los dos tipos de Android que hay hoy:
//   - con barra de 3 botones (atrás/inicio/recientes) → inset grande (~48 px)
//   - con navegación por gestos → inset chico (~12 px)
// y en los iPhone con notch (~34 px). Sin esto, la última tarjeta queda debajo
// de los botones del sistema y no se puede tocar.
export function respiroInferior(insetInferior: number, conBarra = false): number {
  return insetInferior + 32 + (conBarra ? ALTURA.barraBurbuja + ESPACIO.interno : 0);
}

// Fondo SÓLIDO de una tarjeta: el tono equivalente a la lámina de vidrio
// ambiente apoyada sobre la obsidiana. Se usa en las listas largas, donde
// desenfocar de verdad no cambiaría nada (detrás solo hay fondo liso) y costaría
// caro en teléfonos de gama baja. Ver la nota sobre VIDRIO, más arriba.
export function fondoTarjeta(tema: MD3Theme): string {
  return tema.colors.elevation.level2;
}

// Borde de una tarjeta: el contorno de un pelo del vidrio. A diferencia de la
// identidad anterior (donde en modo claro no hacía falta), acá el borde es
// OBLIGATORIO en todas: sobre un fondo casi negro, sin él la tarjeta no tiene
// dónde terminar.
export function bordeTarjeta(_tema: MD3Theme): string {
  return VIDRIO.borde;
}

// Velo translúcido para los paneles que van ENCIMA de una foto o un mapa (la
// pastilla de estado sobre el mapa del padre, el nombre del lugar sobre la
// imagen). Con `Vidrio` encima queda el efecto completo; solos, sirven de
// respaldo cuando no se puede desenfocar.
export const VIDRIO_OSCURO = "rgba(10, 14, 24, 0.72)";
export const VIDRIO_CLARO = "rgba(255, 255, 255, 0.10)";
