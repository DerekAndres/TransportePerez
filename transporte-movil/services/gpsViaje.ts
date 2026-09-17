import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { auth } from './firebase';
import { actualizarUbicacion } from './ubicacionesService';
import { agregarPuntoRecorrido } from './recorridosService';

// ============================================
// EL GPS DEL VIAJE, TAMBIÉN CON LA APP EN SEGUNDO PLANO
// ============================================
// Antes el GPS escuchaba solo con la app ABIERTA (watchPositionAsync): si el
// conductor contestaba un WhatsApp o se le apagaba la pantalla, el bus quedaba
// congelado en el mapa del padre.
//
// Ahora el viaje en curso corre como TAREA DE FONDO (expo-task-manager) con un
// servicio en primer plano de Android: la notificación fija "Viaje en curso"
// que avisa que se está compartiendo la ubicación. Esa notificación no es un
// adorno: es lo que Android exige para dejar que una app use el GPS con la
// pantalla apagada, y con ella alcanza el permiso normal de ubicación. NO hace
// falta pedirle al conductor "Permitir siempre".
//
// Si la tarea no puede arrancar (Expo Go no la soporta, o el teléfono la
// rechaza), se cae al modo de antes: GPS con la app abierta. La pastilla del GPS
// en la pantalla del conductor dice en qué modo quedó.
//
// La tarea vive FUERA de React: Android la puede despertar aunque la pantalla
// del conductor no esté montada. Por eso lo que necesita (qué viaje, qué
// padres) se guarda en AsyncStorage, y por eso la tarea se define acá, al cargar
// el módulo, que se importa desde app/_layout.tsx.

export const TAREA_GPS = 'gps-viaje-en-curso';
const CLAVE_VIAJE = 'gpsViajeActivo';

// Cada cuánto se escribe la posición en vivo, y cada cuánto un punto del recorrido
const INTERVALO_UBICACION_MS = 15 * 1000;
const INTERVALO_RECORRIDO_MS = 60 * 1000;

export type ModoGps = 'segundo_plano' | 'solo_app_abierta';

export interface ViajeConGps {
  viajeId: string;
  rutaId: string;
  busId: string;
  conductorId: string;
  fecha: string;
  // Los padres de los niños de la ruta: los únicos que pueden ver la posición
  padreIds: string[];
}

// undefined = todavía no se leyó del teléfono; null = no hay viaje con GPS
let viajeEnMemoria: ViajeConGps | null | undefined;
let ultimaUbicacion = 0;
let ultimoPunto = 0;
let suscripcionAppAbierta: Location.LocationSubscription | null = null;

// Quien quiere enterarse de cada posición emitida: la pantalla del conductor, que
// la usa para el aviso "el bus está cerca"
type Escucha = (lat: number, lng: number) => void;
const escuchas = new Set<Escucha>();

export function escucharPosiciones(escucha: Escucha): () => void {
  escuchas.add(escucha);
  return () => {
    escuchas.delete(escucha);
  };
}

async function viajeActivo(): Promise<ViajeConGps | null> {
  if (viajeEnMemoria !== undefined) return viajeEnMemoria;
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_VIAJE);
    viajeEnMemoria = crudo ? (JSON.parse(crudo) as ViajeConGps) : null;
  } catch {
    viajeEnMemoria = null;
  }
  return viajeEnMemoria;
}

// Lo que se hace con cada posición, venga de la tarea de fondo o del modo con la
// app abierta. Las escrituras no se esperan: si una falla (sin señal), la
// siguiente posición vuelve a intentar.
async function procesarPosicion(lat: number, lng: number): Promise<void> {
  const viaje = await viajeActivo();
  if (!viaje) return;
  const ahora = Date.now();

  if (ahora - ultimaUbicacion >= INTERVALO_UBICACION_MS) {
    ultimaUbicacion = ahora;
    actualizarUbicacion(viaje.viajeId, lat, lng, viaje.padreIds).catch(() => {});
    escuchas.forEach((escucha) => escucha(lat, lng));
  }
  if (ahora - ultimoPunto >= INTERVALO_RECORRIDO_MS) {
    ultimoPunto = ahora;
    agregarPuntoRecorrido(viaje, lat, lng).catch(() => {});
  }
}

// La tarea de fondo. Tiene que quedar definida al cargar el módulo, no dentro
// de un componente: Android la busca por nombre cuando despierta la app.
TaskManager.defineTask(TAREA_GPS, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations?: Location.LocationObject[] };
  const ultima = locations?.[locations.length - 1];
  if (!ultima) return;
  // Si Android despertó la app solo para esto, la sesión de Firebase todavía se
  // está recuperando del teléfono: sin esperarla, la escritura sería rechazada
  await auth.authStateReady();
  await procesarPosicion(ultima.coords.latitude, ultima.coords.longitude);
});

function detenerModoAppAbierta(): void {
  suscripcionAppAbierta?.remove();
  suscripcionAppAbierta = null;
}

export type ResultadoGps = ModoGps | 'sin_permiso' | 'error';

// --- Empieza (o actualiza) la emisión de la ubicación de un viaje ---
export async function iniciarGps(viaje: ViajeConGps): Promise<ResultadoGps> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return 'sin_permiso';

  viajeEnMemoria = viaje;
  ultimaUbicacion = 0;
  ultimoPunto = 0;
  await AsyncStorage.setItem(CLAVE_VIAJE, JSON.stringify(viaje)).catch(() => {});

  try {
    if (!(await TaskManager.isAvailableAsync())) throw new Error('Sin tareas de fondo');
    if (!(await Location.hasStartedLocationUpdatesAsync(TAREA_GPS))) {
      await Location.startLocationUpdatesAsync(TAREA_GPS, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: INTERVALO_UBICACION_MS,
        distanceInterval: 20,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Viaje en curso',
          notificationBody: 'Compartiendo la ubicación del bus con los padres.',
          notificationColor: '#2563EB',
        },
      });
    }
    detenerModoAppAbierta();
    return 'segundo_plano';
  } catch {
    // Expo Go, o un teléfono que no deja: GPS con la app abierta, como antes
    try {
      if (!suscripcionAppAbierta) {
        suscripcionAppAbierta = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 20000, // pista para el sistema operativo (Android)
            distanceInterval: 20, // metros mínimos entre lecturas (iOS)
          },
          (posicion) => {
            procesarPosicion(posicion.coords.latitude, posicion.coords.longitude).catch(() => {});
          }
        );
      }
      return 'solo_app_abierta';
    } catch {
      return 'error';
    }
  }
}

// --- Deja de emitir (al finalizar el viaje) ---
export async function detenerGps(): Promise<void> {
  viajeEnMemoria = null;
  await AsyncStorage.removeItem(CLAVE_VIAJE).catch(() => {});
  detenerModoAppAbierta();
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TAREA_GPS)) {
      await Location.stopLocationUpdatesAsync(TAREA_GPS);
    }
  } catch {
    // Sin tareas de fondo (Expo Go): no había nada que detener
  }
}
