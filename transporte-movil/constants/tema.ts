import { configureFonts, MD3DarkTheme, MD3LightTheme, type MD3Theme } from "react-native-paper";
import {
  DarkTheme as NavegacionOscura,
  DefaultTheme as NavegacionClara,
  type Theme as TemaNavegacion,
} from "@react-navigation/native";

// ============================================
// TEMA VISUAL — BLANCO CON LOS COLORES DEL LOGO
// ============================================
// La app es BLANCA. El blanco es el color principal: fondos, tarjetas y barras.
// Eso es lo que la hace ver limpia y hace que se lea rápido con el teléfono al
// sol, que es como se usa acá.
//
// Encima de ese blanco entran tres acentos, y los tres salen DEL LOGO de la
// empresa (el bus escolar en la carretera). No son colores elegidos por gusto:
// se sacaron midiendo el logo con un histograma de color, para que la app y el
// ícono que el padre ve en su teléfono se sientan la misma cosa. El azul del
// cielo ocupa el 19.6% de la imagen — es, con diferencia, el color de la marca.
//
// Cada uno tiene además un trabajo, y eso es lo que manda cuando hay que decidir
// dónde usarlo — nada es decorativo porque sí:
//
//   🚌 AZUL CIELO (#12659E) — el cielo del logo, en su versión profunda para que
//      se lea sobre blanco. Marca lo que está pasando AHORA: el bus en viaje, el
//      niño arriba del bus, el botón de la acción principal.
//   🌿 VERDE CAMPO (#1B7A5A) — el pasto del logo. Marca lo que ya se cumplió: el
//      niño entregado, la parada completa, el viaje terminado.
//   🟡 ÁMBAR BUS (#8A5B00) — el amarillo del bus escolar, profundizado. Es el
//      acento de los avisos y los comunicados.
//
// Que AZUL sea "en curso" y VERDE sea "terminado" es, además, la convención que
// casi todo el mundo ya conoce, así que el estado se entiende sin leer el texto.
//
// ⚠️ Un límite conocido de esta paleta: el azul y el verde tienen casi la misma
// LUMINANCIA (el contraste entre ellos es 1.12:1), o sea que se distinguen por el
// tono pero no por lo claro u oscuro. Por eso, en las pantallas donde el estado
// importa, el color nunca va solo: siempre lo acompaña un ícono o una palabra.
// Los cuatro colores sí pasan el mínimo AA (4.5:1) contra el blanco, que es lo
// que garantiza que el texto encima se lea.
//
// La regla es que el color aparece SOLO donde significa algo. Una pantalla del
// padre sin viaje en curso es casi enteramente blanca; cuando el bus sale, el
// azul entra y se nota. Si todo estuviera pintado, nada llamaría la atención.
//
// Todo esto se declara UNA vez acá y React Native Paper lo aplica a todos los
// componentes (botones, chips, campos, barras). Ninguna pantalla escribe un
// color a mano — si mañana la empresa cambia de identidad, se cambia este
// archivo y listo. La única excepción son los mapas: van dentro de un WebView,
// que es HTML aparte y no ve este tema, así que ahí los colores se repiten a
// mano y un comentario apunta a este archivo.
//
// Roles de Material Design 3 que más se usan en la app:
//   - primary / onPrimary:           acción principal, estado "en curso"
//   - primaryContainer:              fondos suaves de azul (tarjeta de ruta)
//   - secondary / secondaryContainer: el verde de "completado"
//   - tertiary / tertiaryContainer:  el ámbar de avisos
//   - error:                         rojo de alertas y de finalizar viaje
//   - background / surface:          el blanco

// Redondez global (por defecto 4): tarjetas y controles con esquinas muy
// suaves, el look amable de las apps modernas de consumo.
const REDONDEZ = 6;

// --- Tipografía ---
// No se agregan fuentes externas (serían archivos nuevos y más peso de APK); lo
// que se hace es ajustar la escala tipográfica del sistema para que la app tenga
// voz propia: titulares MÁS grandes y apretados (el aire lo ponen los márgenes,
// no las letras) y etiquetas con un poco más de separación entre letras, que es
// lo que hace que un texto chico se lea "de marca" y no de formulario.
const tipografia = configureFonts({
  config: {
    displaySmall: { fontSize: 34, lineHeight: 40, letterSpacing: -0.5, fontWeight: "700" },
    headlineMedium: { fontSize: 29, lineHeight: 35, letterSpacing: -0.4, fontWeight: "700" },
    headlineSmall: { fontSize: 24, lineHeight: 30, letterSpacing: -0.3, fontWeight: "700" },
    titleLarge: { fontSize: 21, lineHeight: 27, letterSpacing: -0.2, fontWeight: "700" },
    titleMedium: { fontSize: 16.5, lineHeight: 23, letterSpacing: 0, fontWeight: "700" },
    labelLarge: { fontSize: 14, lineHeight: 20, letterSpacing: 0.2, fontWeight: "600" },
    labelSmall: { fontSize: 11.5, lineHeight: 16, letterSpacing: 0.5, fontWeight: "600" },
  },
});

export const temaClaro: MD3Theme = {
  ...MD3LightTheme,
  roundness: REDONDEZ,
  fonts: tipografia,
  colors: {
    ...MD3LightTheme.colors,
    // 🚌 Azul cielo — lo que está pasando ahora
    primary: "#12659E",
    onPrimary: "#FFFFFF",
    primaryContainer: "#CFE7F8",
    onPrimaryContainer: "#04324F",
    // 🌿 Verde campo — lo que ya se cumplió
    secondary: "#1B7A5A",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#C2EBD9",
    onSecondaryContainer: "#00261A",
    // 🟡 Ámbar bus — avisos y comunicados
    tertiary: "#8A5B00",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#FFDFA8",
    onTertiaryContainer: "#2B1B00",
    // Rojo de alertas: queda lejos del azul y del verde, no se confunde con nada
    error: "#9F1218",
    onError: "#FFFFFF",
    errorContainer: "#FFDAD6",
    onErrorContainer: "#410003",
    // BLANCO como base de todo. Los grises ahora son FRÍOS (tienen una gota de
    // azul): sobre una marca azul, un gris cálido se ve sucio.
    background: "#FFFFFF",
    onBackground: "#17212A",
    surface: "#FFFFFF",
    onSurface: "#17212A",
    // El gris clarísimo de los chips apagados y los círculos de ícono neutros
    surfaceVariant: "#F1F4F7",
    onSurfaceVariant: "#51606B",
    outline: "#77848D",
    outlineVariant: "#E2E8ED",
    inversePrimary: "#97CBF0",
    inverseSurface: "#2A343C",
    inverseOnSurface: "#EDF3F8",
    // Elevación: del blanco a un gris frío apenas perceptible
    elevation: {
      level0: "transparent",
      level1: "#FFFFFF",
      level2: "#F9FBFD",
      level3: "#F5F8FB",
      level4: "#F3F7FA",
      level5: "#EFF4F9",
    },
  },
};

export const temaOscuro: MD3Theme = {
  ...MD3DarkTheme,
  roundness: REDONDEZ,
  fonts: tipografia,
  colors: {
    ...MD3DarkTheme.colors,
    // Azul claro sobre fondo oscuro (el azul profundo se pierde de noche)
    primary: "#92CCF2",
    onPrimary: "#00344F",
    primaryContainer: "#0E5384",
    onPrimaryContainer: "#CFE7F8",
    secondary: "#86D6B4",
    onSecondary: "#00382A",
    secondaryContainer: "#005640",
    onSecondaryContainer: "#C2EBD9",
    tertiary: "#F1BE6C",
    onTertiary: "#472B00",
    tertiaryContainer: "#684100",
    onTertiaryContainer: "#FFDFA8",
    error: "#FFB4AB",
    onError: "#690005",
    errorContainer: "#93000A",
    onErrorContainer: "#FFDAD6",
    // El equivalente oscuro del blanco: gris muy oscuro con una gota de azul,
    // nunca negro puro (el negro puro sobre AMOLED hace que los bordes de las
    // tarjetas desaparezcan)
    background: "#101619",
    onBackground: "#E2EAF0",
    surface: "#151C21",
    onSurface: "#E2EAF0",
    surfaceVariant: "#333F47",
    onSurfaceVariant: "#C3CED6",
    outline: "#8C99A2",
    outlineVariant: "#333F47",
    inversePrimary: "#12659E",
    inverseSurface: "#E2EAF0",
    inverseOnSurface: "#2A343C",
    elevation: {
      level0: "transparent",
      level1: "#1B242A",
      level2: "#1F2930",
      level3: "#242F37",
      level4: "#26323A",
      level5: "#2A373F",
    },
  },
};

// Los tres colores de la marca, en orden, para la franja del encabezado y
// cualquier detalle que quiera repetir la identidad. Acá van en su versión VIVA
// (no la profunda que usan los textos): la franja es decorativa y no sostiene
// texto encima, así que puede parecerse más al logo.
export const FRANJA_TROPICAL = ["#2E90CE", "#F0C24E", "#2F9E76"] as const;

// Temas equivalentes para el navegador de Expo Router (fondo de las pantallas
// durante las transiciones). Sin esto, al navegar se vería un "flash" blanco o
// gris que no coincide con los fondos del tema de Paper.
export const navegacionClara: TemaNavegacion = {
  ...NavegacionClara,
  colors: {
    ...NavegacionClara.colors,
    primary: temaClaro.colors.primary,
    background: temaClaro.colors.background,
    card: temaClaro.colors.surface,
    text: temaClaro.colors.onSurface,
    border: temaClaro.colors.outlineVariant,
  },
};

export const navegacionOscura: TemaNavegacion = {
  ...NavegacionOscura,
  colors: {
    ...NavegacionOscura.colors,
    primary: temaOscuro.colors.primary,
    background: temaOscuro.colors.background,
    card: temaOscuro.colors.surface,
    text: temaOscuro.colors.onSurface,
    border: temaOscuro.colors.outlineVariant,
  },
};
