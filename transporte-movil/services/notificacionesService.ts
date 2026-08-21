import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
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

// Expo acepta hasta 100 mensajes por POST. Se usa para los avisos de canal, que
// van a todos los padres de una escuela: 80 padres son 1 request, no 80.
const MAX_POR_LOTE = 100;

// ============================================
// A DÓNDE LLEVA LA NOTIFICACIÓN AL TOCARLA
// ============================================
// Viaja en el campo `data` del push (Expo lo entrega intacto al teléfono) y lo
// lee el listener de app/_layout.tsx. Sin esto, tocar el aviso abre la app en la
// pantalla de siempre y el padre tiene que buscar a mano de qué le hablaban —
// que es justo lo que un aviso tiene que evitar.
export type DatosPush =
  | { tipo: "mensaje"; otroId: string; otroNombre: string }
  | { tipo: "aviso"; canalId: string; canalNombre: string }
  | { tipo: "hijos" };

// ============================================
// Registro del token del usuario logueado
// ============================================

// En qué punto quedó el registro del token. Se devuelve para poder MOSTRARLO en
// Configuración: sin esto, cuando los avisos no llegan no hay forma de saber si
// el problema es el permiso, la configuración de EAS o el envío. La app nunca
// se rompe por ninguno de estos estados — simplemente no manda avisos.
export type EstadoPush =
  | "listo" // token guardado, todo en orden
  | "sin_dispositivo" // emulador o navegador: no existen las push
  | "sin_permiso" // el usuario no dio permiso de notificaciones
  | "sin_projectid" // falta `eas init` (no hay extra.eas.projectId en app.json)
  | "sin_soporte" // Expo Go en Android (SDK 53+): hace falta el APK
  | "error"; // red caída u otro fallo

// Texto para el usuario de cada estado, y qué hacer al respecto.
export const EXPLICACION_PUSH: Record<EstadoPush, string> = {
  listo: "Vas a recibir los avisos aunque tengas la app cerrada.",
  sin_dispositivo: "Las notificaciones solo funcionan en un teléfono real.",
  sin_permiso:
    "No diste permiso de notificaciones. Activalo en los ajustes del teléfono para recibir los avisos.",
  sin_projectid:
    "La app todavía no está vinculada a Expo (falta `eas init`). Sin eso no se puede pedir el token.",
  sin_soporte:
    "Expo Go en Android no recibe notificaciones remotas. Hace falta instalar el APK de la app.",
  error: "No se pudo registrar el aviso. Revisá tu conexión e intentá de nuevo.",
};

// Se llama al entrar a la app (layouts de los tres roles). Pide permiso de
// notificaciones, obtiene el Expo Push Token y lo guarda en usuarios/{uid},
// de donde lo lee quien envía los avisos.
export async function registrarTokenPush(uid: string): Promise<EstadoPush> {
  // Solo un dispositivo físico puede recibir push (emulador/web no)
  if (!Device.isDevice) return "sin_dispositivo";

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
    if (status !== "granted") return "sin_permiso";

    // El projectId lo inyecta EAS (queda en app.json al correr `eas init`).
    // Sin él no se puede pedir token — p. ej. antes de configurar EAS.
    const projectId: string | undefined =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return "sin_projectid";

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await updateDoc(doc(db, "usuarios", uid), { expoPushToken: token });
    return "listo";
  } catch (e) {
    // Expo Go en Android (SDK 53+) falla justamente acá al pedir el token
    const mensaje = e instanceof Error ? e.message : String(e);
    if (/Expo Go|remote notifications|not supported/i.test(mensaje)) return "sin_soporte";
    return "error";
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

// ============================================
// COLA DE AVISOS PENDIENTES
// ============================================
// El aviso lo manda la app del conductor en el momento de marcar la asistencia.
// Si justo en ese momento el bus está sin señal, el envío falla — y antes ese
// aviso se perdía para siempre, aunque la asistencia sí quedaba guardada
// (Firestore la sincroniza sola al volver la señal).
//
// Con esta cola, un aviso que no se pudo mandar se guarda EN EL TELÉFONO
// (AsyncStorage, así sobrevive a que se cierre la app) y se reintenta al
// recuperar la conexión o al volver a abrir la app. Es la pieza que hace que
// "al padre le tienen que llegar los avisos" se cumpla también con mala señal,
// que en las rutas de El Porvenir y El Pino es lo normal.
const CLAVE_COLA = "avisosPendientes";

// Después de este tiempo un aviso deja de tener sentido: al padre no le sirve
// enterarse a las 6 de la tarde de que su hijo subió al bus a las 6 de la mañana.
const VIGENCIA_AVISO_MS = 3 * 60 * 60 * 1000; // 3 horas

// Tope de la cola. Un aviso de canal a toda una escuela encola un pendiente por
// padre; sin tope, un teléfono sin señal toda la mañana llenaría AsyncStorage.
// Al pasarse se descartan los MÁS VIEJOS (son los que están más cerca de vencer).
const MAX_EN_COLA = 300;

interface AvisoPendiente {
  token: string;
  titulo: string;
  cuerpo: string;
  destinatarioId?: string;
  datos?: DatosPush;
  creadoEn: number;
}

async function leerCola(): Promise<AvisoPendiente[]> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_COLA);
    return crudo ? (JSON.parse(crudo) as AvisoPendiente[]) : [];
  } catch {
    return [];
  }
}

async function guardarCola(cola: AvisoPendiente[]): Promise<void> {
  try {
    // Se recorta por el frente: si sobra, lo que se tira es lo más viejo
    const recortada = cola.length > MAX_EN_COLA ? cola.slice(cola.length - MAX_EN_COLA) : cola;
    await AsyncStorage.setItem(CLAVE_COLA, JSON.stringify(recortada));
  } catch {
    // Si no se puede escribir, se pierde el reintento pero la app sigue
  }
}

async function encolar(...avisos: AvisoPendiente[]): Promise<void> {
  if (avisos.length === 0) return;
  const cola = await leerCola();
  cola.push(...avisos);
  await guardarCola(cola);
}

// Evita que dos llamadas simultáneas (el layout al abrir + la pantalla del
// conductor al marcar asistencia) manden la cola dos veces y el padre reciba
// todo duplicado.
let reintentoEnCurso = false;

// Reintenta todo lo que quedó pendiente. La llaman los layouts de los tres roles
// al abrir la app y la pantalla del conductor cada vez que registra asistencia
// (ahí se sabe que hay conexión, porque la escritura a Firestore funcionó).
export async function reintentarAvisosPendientes(): Promise<void> {
  if (reintentoEnCurso) return;
  const cola = await leerCola();
  if (cola.length === 0) return;

  reintentoEnCurso = true;
  try {
    const ahora = Date.now();
    const quedan: AvisoPendiente[] = [];

    for (const aviso of cola) {
      if (ahora - aviso.creadoEn > VIGENCIA_AVISO_MS) continue; // venció, se descarta
      const resultado = await enviarPush(aviso.token, aviso.titulo, aviso.cuerpo, {
        destinatarioId: aviso.destinatarioId,
        datos: aviso.datos,
        // No se vuelve a encolar acá: si falla de nuevo, se conserva abajo
        sinEncolar: true,
        creadoEn: aviso.creadoEn,
      });
      if (!resultado.ok && resultado.error === "sin_conexion") quedan.push(aviso);
    }

    await guardarCola(quedan);
  } finally {
    reintentoEnCurso = false;
  }
}

// POST directo a la API de Expo Push.
//
// Devuelve el motivo del rechazo cuando lo hay. Los que importan:
//   - "sin_conexion": no hubo red. El aviso se guarda para reintentarlo.
//   - "DeviceNotRegistered": el token ya no vale (el usuario desinstaló la app).
//     Se borra de su ficha para no seguir enviando a la nada.
//   - "InvalidCredentials": faltan las credenciales de FCM subidas a EAS.
async function enviarPush(
  token: string,
  titulo: string,
  cuerpo: string,
  opciones?: {
    destinatarioId?: string;
    sinEncolar?: boolean;
    creadoEn?: number;
    datos?: DatosPush;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const respuesta = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: token,
        title: titulo,
        body: cuerpo,
        sound: "default",
        // `priority: high` + canal de importancia MAX es lo que hace que Android
        // despierte el teléfono y muestre el aviso aunque la app esté CERRADA,
        // en vez de guardarlo para la próxima vez que se abra.
        priority: "high",
        channelId: "default",
        data: opciones?.datos,
      }),
    });

    // La API responde { data: { status: 'ok' | 'error', details?: { error } } }
    const cuerpoRespuesta = await respuesta.json();
    const datos = cuerpoRespuesta?.data;

    if (datos?.status === "error") {
      const error = datos?.details?.error ?? datos?.message ?? "desconocido";
      // Token muerto: se limpia para que los siguientes eventos no lo intenten
      if (error === "DeviceNotRegistered" && opciones?.destinatarioId) {
        cacheTokens.delete(opciones.destinatarioId);
        await updateDoc(doc(db, "usuarios", opciones.destinatarioId), {
          expoPushToken: deleteField(),
        }).catch(() => {});
      }
      return { ok: false, error };
    }
    return { ok: true };
  } catch {
    // Sin red: se guarda para reintentar cuando vuelva
    if (!opciones?.sinEncolar) {
      await encolar({
        token,
        titulo,
        cuerpo,
        destinatarioId: opciones?.destinatarioId,
        datos: opciones?.datos,
        creadoEn: opciones?.creadoEn ?? Date.now(),
      });
    }
    return { ok: false, error: "sin_conexion" };
  }
}

// Envío EN LOTE: un solo POST con muchos mensajes. Es lo que usan los avisos de
// canal, que van a todos los padres de una escuela — mandarlos de a uno serían
// decenas de requests seguidos desde el teléfono del admin.
//
// Si el lote no sale por falta de red, se encola COMPLETO para reintentarlo:
// que el admin publique un aviso sin señal no puede significar que la escuela
// entera se quede sin enterarse.
async function enviarPushMultiple(
  mensajes: { token: string; titulo: string; cuerpo: string; destinatarioId?: string }[],
  datos?: DatosPush
): Promise<void> {
  for (let i = 0; i < mensajes.length; i += MAX_POR_LOTE) {
    const lote = mensajes.slice(i, i + MAX_POR_LOTE);
    try {
      const respuesta = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          lote.map((m) => ({
            to: m.token,
            title: m.titulo,
            body: m.cuerpo,
            sound: "default",
            priority: "high",
            channelId: "default",
            data: datos,
          }))
        ),
      });

      // Con un lote, `data` es un ARRAY de resultados en el mismo orden que se
      // mandó. Se recorre para limpiar los tokens muertos, igual que en el
      // envío individual.
      const cuerpoRespuesta = await respuesta.json();
      const resultados = cuerpoRespuesta?.data;
      if (!Array.isArray(resultados)) continue;

      resultados.forEach((resultado, indice) => {
        if (resultado?.status !== "error") return;
        const destinatarioId = lote[indice]?.destinatarioId;
        if (resultado?.details?.error === "DeviceNotRegistered" && destinatarioId) {
          cacheTokens.delete(destinatarioId);
          updateDoc(doc(db, "usuarios", destinatarioId), {
            expoPushToken: deleteField(),
          }).catch(() => {});
        }
      });
    } catch {
      const creadoEn = Date.now();
      await encolar(
        ...lote.map((m) => ({
          token: m.token,
          titulo: m.titulo,
          cuerpo: m.cuerpo,
          destinatarioId: m.destinatarioId,
          datos,
          creadoEn,
        }))
      );
    }
  }
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
  await enviarPush(token, titulo, cuerpo, {
    destinatarioId: nino.padreId,
    datos: { tipo: "hijos" },
  });
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
    enviarPush(token, "El bus está cerca", cuerpo, {
      destinatarioId: padreId,
      datos: { tipo: "hijos" },
    }).catch(() => {});
  }
}

// ============================================
// Aviso de mensaje nuevo (chat — Fase 7)
// ============================================

// La llama el que ENVÍA un mensaje desde la app (padre o conductor) para avisar
// al destinatario si tiene la app cerrada. Con la app abierta el chat ya se
// actualiza solo (onSnapshot), pero el push hace que se entere igual.
//
// El admin también recibe: desde que existe su sección en la app móvil, al
// entrar registra su token igual que los demás roles, así que un mensaje de un
// padre o de un conductor le llega al teléfono. Si el admin solo usara la web,
// no tendría token y este envío simplemente no hace nada (lo vería al abrir el
// panel). Los mensajes que el admin escribe DESDE la web no disparan push: el
// navegador no puede llamar al endpoint de Expo por CORS.
export async function notificarMensajeNuevo(
  destinatarioId: string,
  remitenteId: string,
  remitenteNombre: string,
  texto: string
): Promise<void> {
  const token = await obtenerTokenDeUsuario(destinatarioId);
  if (!token) return;
  // El cuerpo se recorta: la notificación no es para leer el mensaje completo,
  // sino para avisar que llegó
  const cuerpo = texto.length > 120 ? `${texto.slice(0, 117)}...` : texto;
  await enviarPush(token, remitenteNombre, cuerpo, {
    destinatarioId,
    // Al tocarla se abre la conversación CON QUIEN ESCRIBIÓ (el remitente es el
    // "otro" desde el punto de vista de quien recibe el aviso)
    datos: { tipo: "mensaje", otroId: remitenteId, otroNombre: remitenteNombre },
  });
}

// ============================================
// Aviso de canal nuevo (comunicados — Fase 7)
// ============================================

// La llama la app del admin al publicar un aviso, para que a los padres les
// llegue al teléfono aunque tengan la app cerrada. Sin esto el aviso solo se ve
// entrando a la app, que es justo lo contrario de lo que sirve un comunicado
// ("mañana no hay clases" tiene que llegar hoy).
//
// Quiénes lo reciben se DERIVA, no se guarda: son los padres con un hijo activo
// en la escuela del canal (misma regla que usa la app para mostrar los canales,
// ver canalesService). Así nadie se suscribe a nada y un cambio de escuela
// mueve al padre de canal solo.
export async function notificarAvisoNuevo(
  canalId: string,
  canalNombre: string,
  escuelaId: string,
  texto: string
): Promise<void> {
  // Niños activos de esa escuela (filtro de igualdad: sin índice compuesto)
  const snap = await getDocs(
    query(collection(db, "ninos"), where("escuelaId", "==", escuelaId))
  );

  // Un padre con dos hijos en la misma escuela recibe UN solo aviso (es un Set)
  const padreIds = new Set<string>();
  snap.docs.forEach((d) => {
    const nino = d.data() as Nino;
    if (nino.activo && !nino.eliminado && nino.padreId) padreIds.add(nino.padreId);
  });
  if (padreIds.size === 0) return;

  // Los tokens se piden en paralelo (y el caché evita releer los ya conocidos)
  const destinatarios = await Promise.all(
    [...padreIds].map(async (padreId) => ({
      padreId,
      token: await obtenerTokenDeUsuario(padreId),
    }))
  );

  const cuerpo = texto.length > 120 ? `${texto.slice(0, 117)}...` : texto;
  const mensajes = destinatarios
    .filter((d): d is { padreId: string; token: string } => !!d.token)
    .map((d) => ({
      token: d.token,
      titulo: canalNombre,
      cuerpo,
      destinatarioId: d.padreId,
    }));

  await enviarPushMultiple(mensajes, { tipo: "aviso", canalId, canalNombre });
}

// ============================================
// Prueba de notificaciones (Configuración)
// ============================================
// Manda una notificación al PROPIO usuario para comprobar el circuito completo
// de una sola vez: que su token esté guardado en Firestore, que la API de Expo
// lo acepte y que el teléfono la muestre. Sin esto, "no me llegan los avisos"
// es una caja negra: puede ser el permiso, la vinculación con EAS, las
// credenciales de FCM o el teléfono. Acá se ve cuál de las cuatro es.
export async function enviarPruebaPush(uid: string): Promise<{ ok: boolean; mensaje: string }> {
  // Se lee directo de Firestore (sin el caché de tokens) para probar lo que
  // realmente está guardado hoy
  const snap = await getDoc(doc(db, "usuarios", uid));
  const token = snap.exists() ? ((snap.data() as Usuario).expoPushToken ?? null) : null;

  if (!token) {
    return {
      ok: false,
      mensaje:
        "Todavía no hay un token guardado para tu usuario. Revisá el estado de arriba: sin token no se puede enviar nada.",
    };
  }

  const resultado = await enviarPush(
    token,
    "Prueba de notificaciones",
    "Si ves este aviso, las notificaciones funcionan.",
    { destinatarioId: uid }
  );

  if (resultado.ok) {
    return {
      ok: true,
      mensaje: "Enviada. Debería llegarte en unos segundos, incluso con la app cerrada.",
    };
  }

  // Traducción de los errores que devuelve Expo a algo accionable
  if (resultado.error === "InvalidCredentials") {
    return {
      ok: false,
      mensaje:
        "Expo rechazó el envío: faltan las credenciales de Firebase Cloud Messaging subidas a EAS (ver docs/notificaciones.md).",
    };
  }
  if (resultado.error === "DeviceNotRegistered") {
    return {
      ok: false,
      mensaje:
        "El token guardado ya no es válido (se reinstaló la app). Cerrá sesión, volvé a entrar y probá de nuevo.",
    };
  }
  if (resultado.error === "sin_conexion") {
    return { ok: false, mensaje: "No hay conexión con el servidor de Expo." };
  }
  return { ok: false, mensaje: `Expo rechazó el envío: ${resultado.error}` };
}
