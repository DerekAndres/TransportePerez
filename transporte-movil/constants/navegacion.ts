import type { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Href } from "expo-router";

import type { Rol } from "@/types/models";

// ============================================
// DESTINOS DE NAVEGACIÓN POR ROL
// ============================================
// Las secciones a las que puede ir cada rol, en un solo lugar. Antes esta lista
// vivía dentro del menú lateral; se sacó acá para que la barra de abajo y
// cualquier otra pantalla que necesite saber "a dónde puede ir este usuario"
// lean todas de la misma fuente y no se desincronicen.

export interface Destino {
  // Texto largo, para lectores de pantalla y para cualquier menú
  etiqueta: string;
  // Texto corto que entra debajo del ícono en la barra de abajo
  corto: string;
  icono: keyof typeof MaterialCommunityIcons.glyphMap;
  // Href y no string: Expo Router valida en tiempo de compilación que la ruta
  // exista de verdad (rutas tipadas), así un enlace roto no llega al teléfono
  ruta: Href;
}

// El padre navega entre sus cosas: sus hijos, los mensajes, los avisos de la
// escuela y las solicitudes que le manda al admin.
const DESTINOS_PADRE: Destino[] = [
  { etiqueta: "Inicio", corto: "Inicio", icono: "home-variant", ruta: "/hijos" },
  { etiqueta: "Mensajes", corto: "Mensajes", icono: "message-text", ruta: "/mensajes" },
  { etiqueta: "Avisos", corto: "Avisos", icono: "bullhorn", ruta: "/canales" },
  { etiqueta: "Solicitudes", corto: "Trámites", icono: "file-document-edit", ruta: "/solicitudes" },
  { etiqueta: "Configuración", corto: "Ajustes", icono: "cog", ruta: "/configuracion" },
];

// El conductor tiene una sola pantalla operativa (su ruta del día), los avisos
// de las escuelas a las que lleva, los mensajes y sus ajustes. Sigue siendo la
// lista más corta a propósito: mientras maneja no tiene que elegir nada.
//
// AVISOS ES NUEVO PARA EL CONDUCTOR y no es un capricho de simetría: los
// comunicados que publica la administración ("mañana no hay clases", "salida
// temprano por reunión") le cambian el día de trabajo tanto como al padre, y
// hasta ahora se enteraba por un mensaje suelto o por nadie. Lee los avisos de
// las escuelas de SU ruta, no todos.
const DESTINOS_CONDUCTOR: Destino[] = [
  { etiqueta: "Mi ruta de hoy", corto: "Mi ruta", icono: "bus", ruta: "/hoy" },
  { etiqueta: "Mensajes", corto: "Mensajes", icono: "message-text", ruta: "/mensajes" },
  { etiqueta: "Avisos", corto: "Avisos", icono: "bullhorn", ruta: "/avisos" },
  { etiqueta: "Configuración", corto: "Ajustes", icono: "cog", ruta: "/configuracion" },
];

// El admin en el teléfono solo vigila y comunica: ver cómo van las rutas,
// contestar mensajes y publicar avisos. Administrar (crear usuarios, buses,
// escuelas, niños, rutas) sigue siendo del panel web.
const DESTINOS_ADMIN: Destino[] = [
  { etiqueta: "Monitoreo", corto: "Rutas", icono: "monitor-dashboard", ruta: "/monitoreo" },
  { etiqueta: "Mensajes", corto: "Mensajes", icono: "message-text", ruta: "/mensajes" },
  { etiqueta: "Publicar aviso", corto: "Avisos", icono: "bullhorn", ruta: "/avisos" },
  { etiqueta: "Configuración", corto: "Ajustes", icono: "cog", ruta: "/configuracion" },
];

export function destinosDeRol(rol: Rol | undefined): Destino[] {
  if (rol === "conductor") return DESTINOS_CONDUCTOR;
  if (rol === "admin") return DESTINOS_ADMIN;
  return DESTINOS_PADRE;
}

// ============================================
// CÓMO SE MUEVEN LAS PANTALLAS
// ============================================
// Hay DOS transiciones en la app, y la diferencia no es estética: cada una dice
// algo distinto sobre a dónde fue el usuario.
//
//   APILADA — entrar "más adentro": el perfil de un hijo, un formulario, el
//   chat, el mapa a pantalla completa. La pantalla nueva entra desde la derecha
//   y la anterior se va MÁS LENTO y oscureciéndose, no al mismo tiempo. Ese
//   desfase (el "parallax" de iOS) es lo que hace que se sienta que una queda
//   detrás de la otra en vez de que una empuje a la otra. Además se puede
//   volver deslizando desde el borde, que es el gesto que la gente ya tiene en
//   el dedo.
//
//   SECCIÓN — cambiar de pestaña con la barra de abajo: Inicio, Mensajes,
//   Avisos. Acá NO hay jerarquía: una sección no está "adentro" de la otra, así
//   que deslizar de costado es mentira — y es justo lo que hacía que la app
//   pareciera un pase de diapositivas. Se cruzan con un fundido corto, que es
//   lo que hacen todas las apps con barra inferior.
export const TRANSICION_APILADA = {
  animation: "ios_from_right",
  gestureEnabled: true,
} as const;

export const TRANSICION_SECCION = {
  animation: "fade",
  // Corto a propósito: un fundido lento se siente pesado cuando se cambia de
  // sección muchas veces seguidas
  animationDuration: 180,
} as const;
