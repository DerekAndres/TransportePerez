import { createTheme, type MantineColorsTuple } from "@mantine/core";

// ============================================
// TEMA DEL PANEL — "AURORA CARIBE"
// ============================================
// Los mismos colores que la app móvil (transporte-movil/constants/tema.ts), para
// que un botón del panel y un botón del teléfono sean del mismo color y las dos
// mitades del sistema se lean como un solo producto.
//
// De dónde sale la paleta: Inversiones Perez opera en La Ceiba, El Porvenir, El
// Pino y La Unión, todas sobre la costa atlántica de Honduras. El turquesa es el
// mar y el verde es la vegetación. Es una identidad del LUGAR donde el servicio
// existe, no una elección estética.
//
// Mantine pide una escala de 10 tonos por color, del más claro (0) al más
// oscuro (9), y usa el índice 6 como el color "principal". Por eso el 6 es
// exactamente el mismo valor que usa la app móvil.

// 🌊 Turquesa del mar — la marca y el estado "en curso"
const marca: MantineColorsTuple = [
  "#E6F7F5",
  "#C6EDE8",
  "#98DDD5",
  "#66CBC0",
  "#3FB8AC",
  "#1E9A8F",
  "#0A6E67", // ← principal, el mismo de la app móvil (6.10:1 sobre blanco)
  "#08574F",
  "#06423C",
  "#042E2A",
];

// 🌿 Verde pasto — el estado "completado", para badges y etiquetas.
// Es amarillento a propósito: con una marca turquesa, un verde azulado quedaría
// a pocos grados de tono del color principal y los dos estados se confundirían.
const completado: MantineColorsTuple = [
  "#F0F8E6",
  "#D3EFC0",
  "#B6E098",
  "#98D072",
  "#7CBF51",
  "#5E9739",
  "#44712B", // ← el mismo verde que la app móvil (5.76:1 sobre blanco)
  "#365A22",
  "#284219",
  "#1A2C10",
];

export const temaPanel = createTheme({
  primaryColor: "marca",
  colors: { marca, completado },
  defaultRadius: "lg",

  // --- Esquinas ---
  // Más redondas que las de Mantine por defecto, pero MENOS que las del móvil
  // (que usa 28 px en las tarjetas). En un teléfono esa redondez se siente
  // amable; en una tabla o un formulario denso se ve inflada. Es la adaptación
  // consciente entre las dos mitades del sistema.
  radius: { xs: "6px", sm: "10px", md: "14px", lg: "18px", xl: "24px" },

  // --- Sombras ---
  // Teñidas de VERDE PROFUNDO (#04322F), igual que en el móvil: sobre un fondo
  // aturquesado una sombra negra se ve gris sucio. Muy difusas y de poca
  // opacidad, para que la tarjeta parezca apoyada y no recortada.
  shadows: {
    xs: "0 1px 2px rgba(4, 50, 47, 0.05)",
    sm: "0 2px 10px -2px rgba(4, 50, 47, 0.08)",
    md: "0 6px 22px -8px rgba(4, 50, 47, 0.13)",
    lg: "0 12px 34px -12px rgba(4, 50, 47, 0.17)",
    xl: "0 20px 48px -16px rgba(4, 50, 47, 0.2)",
  },

  // --- Tipografía ---
  // Titulares grandes y APRETADOS, como en el móvil: el aire lo ponen los
  // márgenes, no el espacio entre letras.
  headings: {
    fontWeight: "700",
    sizes: {
      h1: { fontSize: "2rem", lineHeight: "1.15" },
      h2: { fontSize: "1.55rem", lineHeight: "1.2" },
      h3: { fontSize: "1.28rem", lineHeight: "1.25" },
      h4: { fontSize: "1.08rem", lineHeight: "1.3" },
      h5: { fontSize: "0.98rem", lineHeight: "1.35" },
      h6: { fontSize: "0.88rem", lineHeight: "1.4" },
    },
  },

  components: {
    // Las tarjetas flotan con sombra en vez de recortarse con un borde, que es
    // la decisión que se tomó en el móvil. Las pantallas que piden `withBorder`
    // explícitamente lo conservan: el borde quedó casi invisible desde
    // index.css, así que no rompe el conjunto.
    Card: { defaultProps: { radius: "xl", shadow: "md" } },
    Paper: { defaultProps: { radius: "xl", shadow: "sm" } },
    Modal: { defaultProps: { radius: "xl", centered: true } },
    Button: { defaultProps: { radius: "xl" } },
    TextInput: { defaultProps: { radius: "md" } },
    Textarea: { defaultProps: { radius: "md" } },
    Select: { defaultProps: { radius: "md" } },
    Badge: { defaultProps: { radius: "xl" } },
    // Los destinos del menú se ven como las pastillas de la barra flotante del
    // móvil: redondas, y la activa pintada del turquesa de marca.
    NavLink: { defaultProps: { color: "marca" } },
  },
});
