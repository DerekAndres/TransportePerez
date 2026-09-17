import { configureFonts, MD3DarkTheme, type MD3Theme } from "react-native-paper";
import {
  DarkTheme as NavegacionOscura,
  type Theme as TemaNavegacion,
} from "expo-router/react-navigation";

// ============================================
// TEMA VISUAL — "LIQUID OBSIDIAN & SPECULAR GLASS"
// ============================================
// La app se apoya en dos materiales: una OBSIDIANA líquida — un negro azulado
// profundo que hace de fondo de todo — y láminas de VIDRIO esmerilado que
// flotan encima, con un filo de luz en el borde de arriba, como el reflejo de
// una luz cenital sobre un cristal cortado.
//
// De dónde sale (esto es lo que hay que poder defender):
// el diseño se generó en Google Stitch para este proyecto, en el design system
// "Liquid Obsidian & Specular Glass" (proyecto "RutaEscolar Ceiba",
// assets/f3c88cbb22754c7fab5a3dbeda3c934b). Su referencia declarada son los
// tableros de los autos de gama alta (Porsche, Polestar) cruzados con el vidrio
// espacial de Apple: superficies frías, tipografía de precisión y luz que se
// refleja en los bordes en vez de sombras que caen. La intención es que seguir
// a un niño en un bus se sienta CALMO y de precisión — no una app de alarmas.
//
// ⚠️ EL CAMBIO GRANDE RESPECTO DE LA PALETA ANTERIOR ("Aurora Caribe"):
// la app pasa de CLARA a OSCURA, y de turquesa a zafiro. No es una variante del
// tema anterior: es otra identidad. Y hay una consecuencia honesta que conviene
// dejar escrita para el informe: un fondo negro se lee PEOR que uno blanco bajo
// el sol del mediodía, que es justamente la condición en que el conductor usa
// la app. La decisión se toma igual (es el diseño elegido), y se compensa donde
// más importa: los botones de asistencia del conductor NO van en vidrio
// translúcido sino con relleno SÓLIDO y saturado (verde de "subió", rojo de "no
// estaba"), que es lo que sobrevive al reflejo. Ver `components/GrupoAsistencia`.
//
// CADA COLOR TIENE UN TRABAJO ASIGNADO, y eso manda sobre cualquier decisión
// estética — nada es decorativo porque sí:
//
//   🔵 ZAFIRO (#2563EB) — la marca, y lo que está pasando AHORA: el bus en
//      viaje, el niño arriba del bus, el botón de la acción principal, la
//      pastilla activa de la barra de abajo. El diseño lo llama "Royal Sapphire
//      Glass" y lo reserva para telemetría en vivo y rutas confirmadas.
//   🟢 ESMERALDA (#10B981) — lo que ya se cumplió: el niño entregado, la parada
//      completa, el viaje terminado. En el diseño es la "green jewel beacon"
//      del niño que subió sano y salvo.
//   🟡 ÁMBAR (#F59E0B) — "Champagne Amber Flare": avisos, comunicados y
//      ventanas de recogida. Lo que pide atención pero no es una falla.
//   🔴 ROJO (#FF5A52) — alertas de verdad: "no estaba en la parada", finalizar
//      viaje, desvío. Queda lejos de los otros tres en el círculo de color.
//   🩵 CIAN (#38BDF8) — "Liquid Cyan Reflection". NO es un color de estado: es
//      el color de los datos de máquina (señal del GPS, distancia, velocidad).
//      Que la telemetría tenga su propio color evita confundir "el GPS anda"
//      con "el niño está bien", que son cosas distintas.
//
// CONTRASTE sobre la obsidiana #0F131D (mínimo AA para texto = 4.5:1):
//   texto #DFE2F1 15.2:1 · zafiro claro #B4C5FF 9.8:1 · esmeralda #6EE7B7 11.4:1
//   ámbar #FFB95F 10.3:1 · rojo #FFB4AB 8.9:1 · cian #7BD0FF 10.7:1
// Los tonos VIVOS (#2563EB, #10B981, #F59E0B) no se usan nunca para texto sobre
// el fondo: van como RELLENO, con texto blanco o negro encima. Por eso la
// paleta tiene dos versiones de cada color — una clara para escribir y una viva
// para rellenar. Es la convención de Material Design 3 (`primary` vs
// `primaryContainer`) y acá se respeta al pie de la letra.
//
// Todo esto se declara UNA vez acá y React Native Paper lo aplica a todos los
// componentes. Ninguna pantalla escribe un color a mano. La única excepción son
// los mapas: van dentro de un WebView, que es HTML aparte y no ve este tema, así
// que ahí los colores se repiten a mano y un comentario apunta a este archivo.

// ============================================
// LOS COLORES DE MARCA, EN CRUDO
// ============================================
// Los valores VIVOS del design system. Se exportan sueltos porque hay tres
// lugares que no pueden leer el tema de Paper: los degradados, los bordes de
// vidrio (que son rgba con transparencia) y el HTML de los mapas.

/** Royal Sapphire Glass — la marca y lo que está en vivo */
export const ZAFIRO = "#2563EB";
/** El extremo oscuro del degradado del botón principal */
export const ZAFIRO_PROFUNDO = "#1D4ED8";
/** Champagne Amber Flare — avisos y ventanas de recogida */
export const AMBAR = "#F59E0B";
/** La esmeralda de "cumplido": subió, entregado, viaje terminado */
export const ESMERALDA = "#10B981";
/** Liquid Cyan Reflection — datos de máquina: GPS, distancia, velocidad */
export const CIAN = "#38BDF8";
/** Liquid Obsidian — el fondo de todo, el "vacío" sobre el que flota el vidrio */
export const OBSIDIANA = "#0F131D";
/** El tono más profundo de la obsidiana: el pozo del que salen los degradados */
export const OBSIDIANA_PROFUNDA = "#0A0E18";

// Redondez global de Paper. El design system pide 24 px para las láminas
// grandes y 16 px para las tarjetas de adentro; 16 es el valor que más se
// repite, así que es el que va por defecto (ver RADIO en constants/estilos.ts).
const REDONDEZ = 16;

// ============================================
// TIPOGRAFÍA — dos fuentes, dos trabajos
// ============================================
// El design system pide DOS familias, y la división no es capricho:
//
//   OUTFIT (geométrica) — titulares y CIFRAS. Letras construidas con círculos y
//   líneas rectas, sin adornos. Es la que le da el aire de tablero de auto. Va
//   en todo lo que se lee de un vistazo: el título de la pantalla, la hora en
//   que subió el niño, los contadores del conductor.
//
//   PLUS JAKARTA SANS (humanista) — texto corrido y controles. Tiene los
//   agujeros de las letras más abiertos, que es lo que hace que un párrafo se
//   siga leyendo en un teléfono que vibra o con reflejo encima.
//
// ⚠️ POR QUÉ CADA PESO ES UNA "FAMILIA" DISTINTA Y NO SE USA `fontWeight`:
// en React Native, una fuente cargada desde un archivo se registra con UN
// nombre y UN peso. Si se pide `fontFamily: 'Outfit_600SemiBold'` y además
// `fontWeight: '700'`, Android no busca otro archivo: le aplica negrita
// SINTÉTICA al que ya es semibold, y el texto sale engordado y sucio. Por eso
// en toda la app el grosor se elige cambiando de familia, nunca con
// `fontWeight`. El ayudante `estilosBase.negrita` (constants/estilos.ts) hace
// exactamente eso.
export const FUENTES = {
  /** Outfit — titulares y cifras */
  titularMedio: "Outfit_500Medium",
  titular: "Outfit_600SemiBold",
  titularFuerte: "Outfit_700Bold",
  /** Plus Jakarta Sans — texto y controles */
  texto: "PlusJakartaSans_400Regular",
  textoMedio: "PlusJakartaSans_500Medium",
  textoFuerte: "PlusJakartaSans_600SemiBold",
  textoNegrita: "PlusJakartaSans_700Bold",
} as const;

// El design system declara el espaciado entre letras en `em` (proporción del
// tamaño); React Native lo quiere en puntos. Se convierte acá para que los
// números de abajo se puedan comparar contra el diseño original sin cuentas.
const em = (proporcion: number, tamano: number) => Math.round(proporcion * tamano * 100) / 100;

// La escala del design system, adaptada a móvil. Los nombres de la izquierda
// son las variantes de Material Design 3 que usa Paper; entre paréntesis, cómo
// se llama esa misma línea en el diseño de Stitch.
const tipografia = configureFonts({
  config: {
    // display-lg-mobile — el número gigante de una sola métrica
    displayLarge: {
      fontFamily: FUENTES.titular,
      fontSize: 40,
      lineHeight: 48,
      letterSpacing: em(-0.03, 40),
      fontWeight: "normal",
    },
    displayMedium: {
      fontFamily: FUENTES.titular,
      fontSize: 36,
      lineHeight: 44,
      letterSpacing: em(-0.025, 36),
      fontWeight: "normal",
    },
    displaySmall: {
      fontFamily: FUENTES.titular,
      fontSize: 32,
      lineHeight: 40,
      letterSpacing: em(-0.02, 32),
      fontWeight: "normal",
    },
    // headline-xl-mobile — el titular de una pantalla de sección
    headlineLarge: {
      fontFamily: FUENTES.titular,
      fontSize: 28,
      lineHeight: 36,
      letterSpacing: em(-0.02, 28),
      fontWeight: "normal",
    },
    headlineMedium: {
      fontFamily: FUENTES.titular,
      fontSize: 26,
      lineHeight: 34,
      letterSpacing: em(-0.015, 26),
      fontWeight: "normal",
    },
    // headline-md
    headlineSmall: {
      fontFamily: FUENTES.titular,
      fontSize: 22,
      lineHeight: 30,
      letterSpacing: em(-0.01, 22),
      fontWeight: "normal",
    },
    // headline-sm — el título de una tarjeta grande
    titleLarge: {
      fontFamily: FUENTES.titular,
      fontSize: 18,
      lineHeight: 26,
      letterSpacing: em(-0.005, 18),
      fontWeight: "normal",
    },
    // body-lg en semibold — el nombre de un niño, el título de una tarjeta
    titleMedium: {
      fontFamily: FUENTES.textoFuerte,
      fontSize: 16,
      lineHeight: 24,
      letterSpacing: 0,
      fontWeight: "normal",
    },
    titleSmall: {
      fontFamily: FUENTES.textoFuerte,
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0,
      fontWeight: "normal",
    },
    // body-lg / body-md / body-sm — texto corrido
    bodyLarge: {
      fontFamily: FUENTES.texto,
      fontSize: 16,
      lineHeight: 24,
      letterSpacing: 0,
      fontWeight: "normal",
    },
    bodyMedium: {
      fontFamily: FUENTES.texto,
      fontSize: 14,
      lineHeight: 22,
      letterSpacing: em(0.005, 14),
      fontWeight: "normal",
    },
    bodySmall: {
      fontFamily: FUENTES.texto,
      fontSize: 12,
      lineHeight: 18,
      letterSpacing: em(0.01, 12),
      fontWeight: "normal",
    },
    // label-lg / label-md / label-sm — etiquetas y pastillas.
    // Acá el espaciado entre letras es POSITIVO y generoso a propósito: es lo
    // que sostiene la legibilidad de un texto chico en mayúsculas sobre una
    // superficie de vidrio borroso (el diseño lo pide explícitamente).
    labelLarge: {
      fontFamily: FUENTES.textoFuerte,
      fontSize: 13,
      lineHeight: 16,
      letterSpacing: em(0.04, 13),
      fontWeight: "normal",
    },
    labelMedium: {
      fontFamily: FUENTES.textoFuerte,
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: em(0.06, 11),
      fontWeight: "normal",
    },
    labelSmall: {
      fontFamily: FUENTES.textoNegrita,
      fontSize: 10,
      lineHeight: 13,
      letterSpacing: em(0.08, 10),
      fontWeight: "normal",
    },
  },
});

// ============================================
// EL TEMA
// ============================================
// Un solo tema, OSCURO. El design system elegido es `colorMode: DARK` y no
// trae contraparte clara: inventarle una sería inventar diseño, no aplicarlo.
// Por eso la app ya no sigue el modo del teléfono — ver `userInterfaceStyle`
// en app.json, que también se fijó en "dark" para que la pantalla de arranque
// y las barras del sistema no parpadeen en blanco antes de abrir la app.
export const tema: MD3Theme = {
  ...MD3DarkTheme,
  roundness: REDONDEZ,
  fonts: tipografia,
  colors: {
    ...MD3DarkTheme.colors,

    // 🔵 ZAFIRO — la marca y lo que está en vivo.
    // `primary` es el tono CLARO (para texto e íconos sobre la obsidiana) y
    // `primaryContainer` el VIVO (para rellenar un botón o una pastilla).
    primary: "#B4C5FF",
    onPrimary: "#002A78",
    primaryContainer: ZAFIRO,
    onPrimaryContainer: "#EEEFFF",

    // 🟢 ESMERALDA — lo que ya se cumplió (subió, entregado, viaje terminado)
    secondary: "#6EE7B7",
    onSecondary: "#00382A",
    secondaryContainer: ESMERALDA,
    onSecondaryContainer: "#00251B",

    // 🟡 ÁMBAR — avisos, comunicados, "en camino"
    tertiary: "#FFB95F",
    onTertiary: "#472A00",
    tertiaryContainer: "#EE9800",
    onTertiaryContainer: "#2A1700",

    // 🔴 ROJO — alertas: "no estaba", finalizar viaje, desvío
    error: "#FFB4AB",
    onError: "#690005",
    errorContainer: "#C4271F",
    onErrorContainer: "#FFDAD6",

    // La obsidiana: el fondo de la página y el de las superficies planas.
    // Son el MISMO color a propósito — en este diseño una tarjeta no se separa
    // del fondo por ser de otro color, sino por su borde de luz y su desenfoque
    // (ver VIDRIO en constants/estilos.ts). Ese es todo el concepto.
    background: OBSIDIANA,
    onBackground: "#DFE2F1",
    surface: OBSIDIANA,
    onSurface: "#DFE2F1",

    // El gris azulado de los círculos neutros y los chips apagados
    surfaceVariant: "#313540",
    onSurfaceVariant: "#C3C6D7",
    outline: "#8D90A0",
    outlineVariant: "#434655",

    inversePrimary: "#0053DB",
    inverseSurface: "#DFE2F1",
    inverseOnSurface: "#2C303B",

    // La escalera de elevación: cuando una superficie NO puede ser de vidrio
    // (porque lo que tiene detrás no se puede desenfocar), se pinta con el tono
    // sólido equivalente de esta escalera. Son los mismos valores que produce el
    // vidrio del diseño apoyado sobre la obsidiana, calculados una vez acá.
    elevation: {
      level0: "transparent",
      level1: "#171B26",
      level2: "#1C1F2A",
      level3: "#262A35",
      level4: "#2C303B",
      level5: "#313540",
    },
  },
};

// ============================================
// DEGRADADOS
// ============================================

// --- El espejo de zafiro: el botón principal ---
// El diseño lo especifica como `linear-gradient(135deg, #2563EB, #1D4ED8)`, o
// sea en diagonal. Se declara acá para que el botón de "Iniciar viaje", el de
// "Entrar" del login y cualquier acción principal futura sean el mismo azul.
export const ESPEJO_ZAFIRO = [ZAFIRO, ZAFIRO_PROFUNDO] as const;

// --- El fondo de TODAS las pantallas ---
// La obsidiana no es un negro plano: baja de un azul de medianoche arriba al
// pozo casi negro de abajo. El diseño lo llama "atmospheric depth" — es lo que
// impide que la pantalla se vea como un rectángulo negro muerto y hace que las
// láminas de vidrio parezcan estar flotando A UNA ALTURA sobre algo.
//
// ⚠️ EL ÚLTIMO COLOR NO ES CAPRICHO: varias pantallas dibujan barras fijas al
// pie (el botón de iniciar viaje del conductor, el campo de escribir del chat)
// pintadas con `fondoPie()`. Si el degradado terminara en otro tono, se vería
// una costura horizontal justo ahí.
export const NOCHE_OBSIDIANA = ["#151B2B", OBSIDIANA, "#0C1019", OBSIDIANA_PROFUNDA] as const;

// El color con el que hay que pintar cualquier barra FIJA al pie de una
// pantalla. Se calcula en vez de escribirse a mano a propósito: si mañana se
// cambia el degradado, los pies lo siguen solos.
export function fondoPie(): string {
  return NOCHE_OBSIDIANA[NOCHE_OBSIDIANA.length - 1];
}

// --- La franja de la pantalla de entrada ---
// Los tres acentos del sistema en su versión viva, para la franja decorativa
// del login y de "completar perfil": zafiro (en vivo), ámbar (aviso) y cian
// (telemetría). Reemplaza a la franja tropical de la identidad anterior.
// Ahí la franja es decorativa — no sostiene texto encima — así que puede usar
// los tonos saturados que en el resto de la app solo se usan como relleno.
export const FRANJA_ESPECULAR = [ZAFIRO, AMBAR, CIAN] as const;

// Tema equivalente para el navegador de Expo Router (el fondo de las pantallas
// durante las transiciones). Sin esto, al navegar se vería un "flash" blanco
// entre pantalla y pantalla, que sobre un fondo negro es un fogonazo.
export const temaNavegacion: TemaNavegacion = {
  ...NavegacionOscura,
  colors: {
    ...NavegacionOscura.colors,
    primary: tema.colors.primary,
    background: tema.colors.background,
    card: tema.colors.surface,
    text: tema.colors.onSurface,
    border: tema.colors.outlineVariant,
  },
};
