import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { turnoActual } from "./viajesService";
import type { EventoRegistro, Nino, Turno, Usuario } from "../types/models";

// ============================================
// FASE 6 — Notificaciones push
// ============================================
// Estrategia (CLAUDE.md): la app del CONDUCTOR llama directo a la API pública
// de Expo Push con el token del padre, sin backend intermedio. Así todo corre
// en el plan Spark (gratis), sin Cloud Functions.
//
// Limitación conocida: desde SDK 53, Expo Go en ANDROID ya no soporta push
// remotas — para probarlas hace falta el APK (eas build) o un development
// build. La app maneja esa falta de token con gracia: simplemente no notifica.
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// A menos de esta distancia de la casa de un niño se avisa "el bus está cerca".
// El informe pide un umbral de 300-500 m; 400 da margen para que el padre salga.
const UMBRAL_CERCANIA_METROS = 400;

// ============================================
// Registro del token del usuario logueado
// ============================================

// Se llama al entrar a la app (layouts de conductor y padre). Pide permiso de
// notificaciones, obtiene el Expo Push Token y lo guarda en usuarios/{uid},
// de donde lo lee la app del conductor para enviar los avisos.
export async function registrarTokenPush(uid: string): Promise<void> {
  // Solo un dispositivo físico puede recibir push (emulador/web no)
  if (!Device.isDevice) return;

  try {
    // Android 8+ exige un canal para mostrar notificaciones; crearlo es
    // idempotente (si ya existe, no pasa nada)
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Avisos del transporte",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    // Permiso: se pide solo si aún no está concedido
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return; // sin permiso la app sigue normal, solo sin avisos

    // El projectId lo inyecta EAS (queda en app.json al correr `eas init`).
    // Sin él no se puede pedir token — p. ej. antes de configurar EAS.
    const projectId: string | undefined =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await updateDoc(doc(db, "usuarios", uid), { expoPushToken: token });
  } catch {
    // Cualquier falla (Expo Go en Android, sin red) deja al usuario sin push,
    // pero nunca rompe el inicio de sesión
  }
}

// ============================================
// Envío de avisos al padre (desde la app del conductor)
// ============================================

// Cachés en memoria por sesión: el niño y el token del padre no cambian durante
// un viaje, así que se leen de Firestore una sola vez (ahorra cuota de lecturas).
const cacheNinos = new Map<string, Nino | null>();
const cacheTokens = new Map<string, string | null>();

async function obtenerNino(ninoId: string): Promise<Nino | null> {
  if (cacheNinos.has(ninoId)) return cacheNinos.get(ninoId) ?? null;
  const snap = await getDoc(doc(db, "ninos", ninoId));
  const nino = snap.exists() ? ({ id: snap.id, ...snap.data() } as Nino) : null;
  cacheNinos.set(ninoId, nino);
  return nino;
}

async function obtenerTokenDeUsuario(usuarioId: string): Promise<string | null> {
  const enCache = cacheTokens.get(usuarioId);
  if (enCache) return enCache;
  const snap = await getDoc(doc(db, "usuarios", usuarioId));
  const token = snap.exists() ? ((snap.data() as Usuario).expoPushToken ?? null) : null;
  // Solo se cachea si HAY token. Si el padre todavía no abrió la app (sin token
  // guardado), el próximo evento vuelve a consultar: puede que ya lo tenga —
  // cachear el "no tiene" lo dejaría sin avisos por el resto del viaje.
  if (token) cacheTokens.set(usuarioId, token);
  return token;
}

// POST directo a la API de Expo Push. Si Expo rechaza el envío (token vencido,
// etc.) no se reintenta: el aviso es un extra, la asistencia ya quedó registrada.
async function enviarPush(token: string, titulo: string, cuerpo: string): Promise<void> {
  await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: token,
      title: titulo,
      body: cuerpo,
      sound: "default",
      priority: "high",
    }),
  });
}

// Hora local "H:mm" sin depender de Intl (su soporte varía entre dispositivos)
function horaActual(): string {
  const ahora = new Date();
  return `${ahora.getHours()}:${String(ahora.getMinutes()).padStart(2, "0")}`;
}

// Aviso al padre cuando su hijo sube o baja del bus. La llaman las pantallas
// del conductor al registrar asistencia (ya estaba cableado desde la Fase 4).
//
// `enPunto` marca los eventos de TRANSBORDO: para el padre el transbordo es
// invisible (principio de diseño), así que la entrega en el punto manda un
// aviso neutro ("sigue en camino") sin mencionar el cambio de bus.
export async function notificarEventoAlPadre(
  ninoId: string,
  evento: EventoRegistro,
  opciones?: { enPunto?: boolean; turno?: Turno }
): Promise<void> {
  const nino = await obtenerNino(ninoId);
  if (!nino) return;
  const token = await obtenerTokenDeUsuario(nino.padreId);
  if (!token) return; // el padre aún no abrió la app móvil o no dio permiso

  // Mañana el bus va hacia la escuela; en la tarde, de vuelta a casa. El turno
  // lo pasa la pantalla del conductor (el del VIAJE); si no llega, se deduce de
  // la hora — un viaje de mañana atrasado hasta pasado el mediodía no debe
  // avisar "llegó a casa" cuando en realidad llegó a la escuela.
  const destino = (opciones?.turno ?? turnoActual()) === "manana" ? "la escuela" : "casa";

  let titulo: string;
  let cuerpo: string;
  if (opciones?.enPunto) {
    titulo = `${nino.nombre} sigue en camino`;
    cuerpo = `Va rumbo a ${destino}.`;
  } else if (evento === "subio") {
    titulo = `${nino.nombre} subió al bus`;
    cuerpo = `Va en camino a ${destino}.`;
  } else {
    titulo = `${nino.nombre} llegó a ${destino}`;
    cuerpo = `Bajó del bus a las ${horaActual()}.`;
  }
  await enviarPush(token, titulo, cuerpo);
}

// ============================================
// Aviso de proximidad ("el bus está cerca")
// ============================================

// Distancia en metros entre dos coordenadas (fórmula haversine: distancia
// sobre la superficie de la Tierra tomándola como esfera de radio 6371 km).
function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const RADIO_TIERRA_M = 6371000;
  const rad = (grados: number) => (grados * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(a));
}

// A qué niños ya se les avisó "el bus está cerca" en cada viaje, para no
// repetir el aviso cada 15 segundos. Vive en memoria: el conductor mantiene la
// app abierta durante el viaje (restricción ya documentada del GPS).
const avisadosPorViaje = new Map<string, Set<string>>();

// La llama la pantalla del conductor en cada posición emitida del GPS (cada
// ~15 s). `ninosEnCasa` son los niños cuyo próximo evento es en SU casa:
// en la mañana los pendientes de recoger, en la tarde los que van en el bus.
export async function notificarProximidad(
  viajeId: string,
  lat: number,
  lng: number,
  ninosEnCasa: Nino[],
  turno?: Turno // el del viaje; sin él se deduce de la hora
): Promise<void> {
  let avisados = avisadosPorViaje.get(viajeId);
  if (!avisados) {
    avisados = new Set();
    avisadosPorViaje.set(viajeId, avisados);
  }

  // Se agrupa por padre para que hermanos en la misma casa generen UN aviso
  const cercanosPorPadre = new Map<string, Nino[]>();
  for (const nino of ninosEnCasa) {
    if (!nino.parada || avisados.has(nino.id)) continue;
    if (distanciaMetros(lat, lng, nino.parada.lat, nino.parada.lng) > UMBRAL_CERCANIA_METROS) {
      continue;
    }
    // Se marca ANTES de enviar: mejor perder un aviso que mandarlo repetido
    avisados.add(nino.id);
    const lista = cercanosPorPadre.get(nino.padreId);
    if (lista) lista.push(nino);
    else cercanosPorPadre.set(nino.padreId, [nino]);
  }

  const esManana = (turno ?? turnoActual()) === "manana";
  for (const [padreId, hijos] of cercanosPorPadre) {
    const token = await obtenerTokenDeUsuario(padreId);
    if (!token) continue;
    const nombres = hijos.map((n) => n.nombre).join(", ");
    const cuerpo = esManana
      ? `Prepará a ${nombres}, el bus está por llegar.`
      : `El bus está por llegar a casa con ${nombres}.`;
    enviarPush(token, "El bus está cerca", cuerpo).catch(() => {});
  }
}

// ============================================
// Aviso de mensaje nuevo (chat — Fase 7)
// ============================================

// La llama el que ENVÍA un mensaje desde la app (padre o conductor) para avisar
// al destinatario si tiene la app cerrada. Con la app abierta el chat ya se
// actualiza solo (onSnapshot), pero el push hace que se entere igual.
//
// Nota: el admin usa la web (sin token push), así que un mensaje AL admin no
// dispara push — lo ve al abrir el panel. Este envío es siempre desde móvil.
export async function notificarMensajeNuevo(
  destinatarioId: string,
  remitenteNombre: string,
  texto: string
): Promise<void> {
  const token = await obtenerTokenDeUsuario(destinatarioId);
  if (!token) return;
  // El cuerpo se recorta: la notificación no es para leer el mensaje completo,
  // sino para avisar que llegó
  const cuerpo = texto.length > 120 ? `${texto.slice(0, 117)}...` : texto;
  await enviarPush(token, remitenteNombre, cuerpo);
}
