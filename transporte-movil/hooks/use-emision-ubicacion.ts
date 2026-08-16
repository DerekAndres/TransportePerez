import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

import { actualizarUbicacion } from '@/services/ubicacionesService';

export type EstadoGps = 'inactivo' | 'activo' | 'sin_permiso' | 'error';

// Emite la ubicación del bus mientras haya un viaje en curso.
// Recibe el id del viaje activo (o null si no hay ninguno) y devuelve el
// estado del GPS para mostrarlo en pantalla.
//
// Throttle: aunque el sistema entregue posiciones seguido, solo se escribe en
// Firestore como máximo una vez cada 15 segundos — el tracking no necesita más
// precisión y así no se agota la cuota de escrituras del plan gratuito.
const INTERVALO_MINIMO_MS = 15000;

// `onPosicion` (opcional) se llama con cada posición emitida (misma cadencia que
// la escritura, cada ~15 s). Fase 6 lo usa para el aviso de proximidad.
export function useEmisionUbicacion(
  viajeId: string | null,
  onPosicion?: (lat: number, lng: number) => void
): EstadoGps {
  const [estado, setEstado] = useState<EstadoGps>('inactivo');
  const ultimaEscritura = useRef(0);

  // El callback vive en un ref para usar siempre la versión más reciente sin
  // reiniciar el watcher del GPS (el efecto de abajo solo depende del viaje)
  const onPosicionRef = useRef(onPosicion);
  useEffect(() => {
    onPosicionRef.current = onPosicion;
  });

  useEffect(() => {
    if (!viajeId) {
      setEstado('inactivo');
      return;
    }

    let subscripcion: Location.LocationSubscription | null = null;
    let cancelado = false; // evita setState si el efecto ya se limpió

    const iniciar = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!cancelado) setEstado('sin_permiso');
        return;
      }

      try {
        subscripcion = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 20000, // pista para el sistema operativo (Android)
            distanceInterval: 20, // metros mínimos entre lecturas (iOS)
          },
          (posicion) => {
            const ahora = Date.now();
            if (ahora - ultimaEscritura.current < INTERVALO_MINIMO_MS) return;
            ultimaEscritura.current = ahora;
            actualizarUbicacion(
              viajeId,
              posicion.coords.latitude,
              posicion.coords.longitude
            ).catch(() => {
              // Si una escritura falla (ej. sin señal), la próxima lectura reintenta
            });
            onPosicionRef.current?.(posicion.coords.latitude, posicion.coords.longitude);
          }
        );
        if (!cancelado) setEstado('activo');
      } catch {
        if (!cancelado) setEstado('error');
      }
    };

    iniciar();

    return () => {
      cancelado = true;
      subscripcion?.remove();
      setEstado('inactivo');
    };
  }, [viajeId]);

  return estado;
}
