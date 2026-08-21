import { createTheme, type MantineColorsTuple } from "@mantine/core";

// ============================================
// TEMA DEL PANEL — LOS COLORES DEL LOGO
// ============================================
// Antes el panel usaba el azul que Mantine trae por defecto, que no es el de la
// empresa. Acá se define la marca real, la misma que usa la app móvil
// (transporte-movil/constants/tema.ts): el azul del cielo del logo.
//
// Mantine pide una escala de 10 tonos por color, del más claro (0) al más
// oscuro (9), y usa el índice 6 como el color "principal". Por eso el 6 es
// exactamente el #12659E de la app: así un botón del panel y un botón del
// teléfono son del mismo azul.
const marca: MantineColorsTuple = [
  "#E7F3FB",
  "#CFE7F8",
  "#A6D2F1",
  "#79BBE9",
  "#52A6E0",
  "#2E90CE",
  "#12659E", // ← principal, el mismo de la app móvil
  "#0E5384",
  "#0A426A",
  "#063151",
];

// El verde de "completado" (el pasto del logo), para estados y badges
const completado: MantineColorsTuple = [
  "#E6F6EF",
  "#C2EBD9",
  "#98DBBF",
  "#68CAA3",
  "#41B98C",
  "#2F9E76",
  "#1B7A5A", // ← el mismo verde que la app móvil
  "#146046",
  "#0E4A35",
  "#083424",
];

export const temaPanel = createTheme({
  primaryColor: "marca",
  colors: { marca, completado },
  defaultRadius: "md",
});
