import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Usuario } from "../types/models";

// ============================================
// NOTIFICACIONES PUSH DESDE EL PANEL WEB
// ============================================
// Mismo destino que en la app móvil (la API pública de Expo Push, sin backend),
// pero desde el navegador hay una vuelta que hay que entender para defenderla.
//
// EL PROBLEMA — CORS. El servidor de Expo NO devuelve la cabecera
// `Access-Control-Allow-Origin`. Un `fetch` normal con
// `Content-Type: application/json` dispara una petición "preflight" (OPTIONS)
// que el navegador exige antes de mandar el POST; como la respuesta no trae esa
// cabecera, el navegador CANCELA el envío. Por eso, hasta ahora, un mensaje o
// un aviso escrito desde la web no le llegaba a nadie al teléfono.
//
// LA SOLUCIÓN. El estándar de CORS considera "seguros" tres tipos de contenido
// que NO disparan preflight: `text/plain`, `application/x-www-form-urlencoded` y
// `multipart/form-data`. Y la API de Expo parsea el cuerpo como JSON aunque se
// declare `text/plain` (comprobado contra el servidor real). Entonces:
//
//   - `Content-Type: text/plain`  → no hay preflight, el POST sale de verdad.
//   - `mode: "no-cors"`           → el navegador no intenta leer la respuesta,
//                                   así que no marca error en la consola.
//
// EL PRECIO. Con `no-cors` la respuesta es "opaca": no se puede leer. Es decir,
// desde la web se envía A CIEGAS — no sabemos si Expo aceptó cada token. Es un
// intercambio aceptable acá: el aviso es un extra sobre el dato, que ya quedó
// guardado en Firestore (el padre lo ve igual al abrir la app). Y la limpieza de
// tokens muertos la sigue haciendo la app móvil, que sí lee la respuesta.
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Expo acepta hasta 100 mensajes por POST
const MAX_POR_LOTE = 100;

// Mismo contrato que en el móvil (services/notificacionesService.ts): dice a qué
// pantalla salta la app al tocar el aviso. Los dos archivos deben coincidir.
export type DatosPush =
  | { tipo: "mensaje"; otroId: string; otroNombre: string }
  | { tipo: "aviso"; canalId: string; canalNombre: string }
  | { tipo: "hijos" };

interface MensajePush {
  to: string;
  title: string;
  body: string;
  sound: "default";
  priority: "high";
  channelId: "default";
  data?: DatosPush;
}

// Envía un lote. No devuelve nada porque no hay nada que leer (respuesta opaca).
async function enviarLote(mensajes: MensajePush[]): Promise<void> {
  for (let i = 0; i < mensajes.length; i += MAX_POR_LOTE) {
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        mode: "no-cors",
        // Ver la explicación de arriba: text/plain es lo que evita el preflight
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(mensajes.slice(i, i + MAX_POR_LOTE)),
      });
    } catch {
      // Sin conexión: el aviso se pierde, pero el mensaje/aviso ya está en
      // Firestore. A diferencia del móvil no hay cola de reintento: la web se
      // usa desde la oficina, con conexión estable, y el admin ve en pantalla
      // si el dato se guardó.
    }
  }
}

function armar(token: string, titulo: string, cuerpo: string, datos?: DatosPush): MensajePush {
  return {
    to: token,
    title: titulo,
    // El cuerpo se recorta: la notificación avisa que llegó algo, no reemplaza
    // a abrir la app para leerlo
    body: cuerpo.length > 120 ? `${cuerpo.slice(0, 117)}...` : cuerpo,
    sound: "default",
    // `priority: high` es lo que hace que el teléfono despierte y muestre el
    // aviso aunque la app esté cerrada
    priority: "high",
    channelId: "default",
    data: datos,
  };
}

// --- Token push de un usuario (lo guarda su app móvil al iniciar sesión) ---
async function obtenerToken(usuarioId: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, "usuarios", usuarioId));
    return snap.exists() ? ((snap.data() as Usuario).expoPushToken ?? null) : null;
  } catch {
    return null;
  }
}

// --- Aviso de mensaje nuevo escrito DESDE LA WEB ---
// La llama la pantalla de mensajes del admin. Sin esto, un padre solo se entera
// de la respuesta del admin si abre la app por su cuenta.
export async function notificarMensajeNuevo(
  destinatarioId: string,
  remitenteId: string,
  remitenteNombre: string,
  texto: string
): Promise<void> {
  const token = await obtenerToken(destinatarioId);
  if (!token) return; // el destinatario nunca abrió la app móvil
  await enviarLote([
    armar(token, remitenteNombre, texto, {
      tipo: "mensaje",
      // Al tocarlo se abre la conversación con quien escribió
      otroId: remitenteId,
      otroNombre: remitenteNombre,
    }),
  ]);
}

// --- Aviso de canal publicado DESDE LA WEB ---
// Recibe los usuarios que ya tiene cargados la pantalla de canales (los padres
// con un hijo activo en esa escuela), así que no cuesta ninguna lectura extra.
export async function notificarAvisoNuevo(
  canalId: string,
  canalNombre: string,
  miembros: Usuario[],
  texto: string
): Promise<void> {
  const mensajes = miembros
    .map((u) => u.expoPushToken)
    .filter((t): t is string => !!t)
    .map((token) => armar(token, canalNombre, texto, { tipo: "aviso", canalId, canalNombre }));

  if (mensajes.length === 0) return;
  await enviarLote(mensajes);
}
