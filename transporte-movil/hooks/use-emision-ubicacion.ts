import { useEffect, useRef, useState } from 'react';

import { escucharPosiciones, iniciarGps, type ViajeConGps } from '@/services/gpsViaje';

// 'solo_app_abierta' = el GPS funciona, pero únicamente con la app en pantalla
// (Expo Go, o un teléfono que no dejó arrancar la tarea de fondo)
export type EstadoGps = 'inactivo' | 'activo' | 'solo_app_abierta' | 'sin_permiso' | 'error';

// Emite la ubicación del bus mientras haya un viaje en curso (ver
// services/gpsViaje.ts: tarea de fondo con respaldo en primer plano). Recibe el
// viaje (o null si no hay ninguno) y devuelve el estado del GPS para mostrarlo.
//
// A propósito NO detiene el GPS cuando la pantalla se desmonta: el conductor
// puede ir a Mensajes o bloquear el teléfono con el viaje en curso y el bus
// tiene que seguir apareciendo en el mapa del padre. Se detiene solo al
// FINALIZAR el viaje (detenerGps, desde la pantalla del conductor).
//
// `onPosicion` (opcional) se llama con cada posición emitida (~cada 15 s)
// mientras la pantalla está montada. Fase 6 lo usa para el aviso de proximidad.
export function useEmisionUbicacion(
  viaje: ViajeConGps | null,
  onPosicion?: (lat: number, lng: number) => void
): EstadoGps {
  const [estado, setEstado] = useState<EstadoGps>('inactivo');

  // El callback vive en un ref para usar siempre la versión más reciente sin
  // volver a suscribirse en cada dibujo de la pantalla
  const onPosicionRef = useRef(onPosicion);
  useEffect(() => {
    onPosicionRef.current = onPosicion;
  });

  useEffect(() => escucharPosiciones((lat, lng) => onPosicionRef.current?.(lat, lng)), []);

  // El objeto `viaje` se arma de nuevo en cada dibujo; lo que importa es su
  // contenido: el viaje y la lista de padres que pueden ver la posición
  const clave = viaje ? `${viaje.viajeId}|${viaje.padreIds.join(',')}` : '';

  useEffect(() => {
    if (!viaje) {
      setEstado('inactivo');
      return;
    }
    let cancelado = false;
    iniciarGps(viaje)
      .then((resultado) => {
        if (cancelado) return;
        setEstado(resultado === 'segundo_plano' ? 'activo' : resultado);
      })
      .catch(() => {
        if (!cancelado) setEstado('error');
      });
    return () => {
      cancelado = true;
    };
    // `viaje` entra por `clave`: alcanza con reaccionar a su contenido
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  return estado;
}
