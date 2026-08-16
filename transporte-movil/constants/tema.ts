import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from "react-native-paper";
import {
  DarkTheme as NavegacionOscura,
  DefaultTheme as NavegacionClara,
  type Theme as TemaNavegacion,
} from "@react-navigation/native";

// ============================================
// TEMA VISUAL DE LA APP — azules y rojos
// ============================================
// Identidad de Inversiones Perez: azul como color principal (confianza,
// transporte) y rojo como acento (la franja del bus escolar, avisos y acciones
// de cuidado). Hay versión clara y oscura; la app sigue el modo del teléfono.
//
// Se construye sobre los temas Material Design 3 de React Native Paper: al
// pasar estos objetos al PaperProvider, TODOS los componentes (botones,
// tarjetas, chips, barras, inputs) toman los colores solos — no hay que
// colorear pantalla por pantalla. Roles de color que más se usan:
//   - primary / onPrimary:           botones principales, elementos activos
//   - primaryContainer:              fondos suaves azules (tarjeta de ruta, chips)
//   - secondaryContainer:            botones tonales ("Todos", "Mensajes")
//   - tertiary / tertiaryContainer:  el ROJO de acento (franja, detalles)
//   - error:                         rojo de alertas y acciones destructivas
//   - background / surface:          fondos generales (con tinte azulado)

// Redondez global aumentada (por defecto 4): tarjetas y controles con esquinas
// bien suaves, el look "amable" de las apps modernas de consumo.
const REDONDEZ = 6;

export const temaClaro: MD3Theme = {
  ...MD3LightTheme,
  roundness: REDONDEZ,
  colors: {
    ...MD3LightTheme.colors,
    // Azul principal
    primary: "#1565C0",
    onPrimary: "#FFFFFF",
    primaryContainer: "#D7E3FF",
    onPrimaryContainer: "#001B3F",
    // Azul-gris de apoyo (botones tonales)
    secondary: "#565E71",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#DAE2F9",
    onSecondaryContainer: "#131C2B",
    // Rojo de acento
    tertiary: "#C62828",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#FFDAD6",
    onTertiaryContainer: "#410002",
    // Rojo de errores/alertas
    error: "#BA1A1A",
    onError: "#FFFFFF",
    errorContainer: "#FFDAD6",
    onErrorContainer: "#410002",
    // Fondos con tinte azulado (más cálidos que el blanco puro)
    background: "#F5F8FE",
    onBackground: "#1A1C1F",
    surface: "#FAFCFF",
    onSurface: "#1A1C1F",
    surfaceVariant: "#E0E7F3",
    onSurfaceVariant: "#44474E",
    outline: "#74777F",
    outlineVariant: "#C4C6CF",
    inversePrimary: "#A8C8FF",
    inverseSurface: "#2F3033",
    inverseOnSurface: "#F1F0F4",
    // Niveles de elevación (los fondos de tarjetas): tinte azul, no el lila
    // que trae Material por defecto
    elevation: {
      level0: "transparent",
      level1: "#F0F4FB",
      level2: "#EAF0FA",
      level3: "#E3EBF8",
      level4: "#E1EAF7",
      level5: "#DCE6F6",
    },
  },
};

export const temaOscuro: MD3Theme = {
  ...MD3DarkTheme,
  roundness: REDONDEZ,
  colors: {
    ...MD3DarkTheme.colors,
    // Azul claro sobre fondos marinos
    primary: "#A8C8FF",
    onPrimary: "#003062",
    primaryContainer: "#0D4A8F",
    onPrimaryContainer: "#D6E3FF",
    secondary: "#BEC7DC",
    onSecondary: "#283141",
    secondaryContainer: "#3E4759",
    onSecondaryContainer: "#DAE2F9",
    // Rojo suave (el rojo saturado cansa la vista en fondo oscuro)
    tertiary: "#FFB3AC",
    onTertiary: "#68000B",
    tertiaryContainer: "#8C1D28",
    onTertiaryContainer: "#FFDAD6",
    error: "#FFB4AB",
    onError: "#690005",
    errorContainer: "#93000A",
    onErrorContainer: "#FFDAD6",
    // Azul marino profundo como base
    background: "#0F1522",
    onBackground: "#E2E2E9",
    surface: "#121927",
    onSurface: "#E2E2E9",
    surfaceVariant: "#333B4C",
    onSurfaceVariant: "#C4C6D0",
    outline: "#8E9099",
    outlineVariant: "#44474F",
    inversePrimary: "#1565C0",
    inverseSurface: "#E2E2E9",
    inverseOnSurface: "#2F3036",
    elevation: {
      level0: "transparent",
      level1: "#18202F",
      level2: "#1C2536",
      level3: "#212A3D",
      level4: "#232C40",
      level5: "#273046",
    },
  },
};

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
