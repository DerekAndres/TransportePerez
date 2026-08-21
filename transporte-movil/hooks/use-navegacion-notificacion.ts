import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';

import type { DatosPush } from '@/services/notificacionesService';

// ============================================
// TOCAR EL AVISO Y CAER EN LA PANTALLA CORRECTA
// ============================================
// La notificación llega con la app cerrada; al tocarla, la app se abre. Sin
// esto se abriría en la pantalla de siempre y el padre tendría que buscar a
// mano de qué le hablaban — justo lo contrario de para qué sirve un aviso.
//
// `useLastNotificationResponse` es el hook que recomienda Expo porque cubre los
// DOS casos de una sola vez: la app estaba abierta o en segundo plano, y la app
// estaba COMPLETAMENTE CERRADA y se abrió por tocar el aviso (ahí el evento ya
// ocurrió antes de que existiera cualquier listener, así que un
// `addNotificationResponseReceivedListener` solo se lo perdería).
//
// A dónde lleva cada tipo lo decide el campo `data` del push, que arma
// notificacionesService (ver DatosPush).
export function useNavegacionPorNotificacion(listo: boolean): void {
  const respuesta = Notifications.useLastNotificationResponse();

  // El hook conserva la última respuesta y la vuelve a entregar en cada montaje.
  // Sin esta marca, volver a la pantalla inicial reabriría el mismo chat una y
  // otra vez. Se guarda el id de la notificación ya atendida.
  const yaAtendida = useRef<string | null>(null);

  useEffect(() => {
    // `listo` espera a que la sesión esté resuelta: navegar a un chat antes de
    // saber quién está logueado termina en un rebote al login
    if (!listo || !respuesta) return;

    // Solo el toque sobre la notificación en sí (no los botones de acción)
    if (respuesta.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    const identificador = respuesta.notification.request.identifier;
    if (yaAtendida.current === identificador) return;
    yaAtendida.current = identificador;

    const datos = respuesta.notification.request.content.data as DatosPush | undefined;
    if (!datos?.tipo) return;

    // Por qué el retraso: cuando la app venía CERRADA y se abre por tocar el
    // aviso, en este mismo instante `app/index.tsx` está mandando al usuario a
    // la pantalla de su rol. Las dos navegaciones caerían juntas y la del rol,
    // que reemplaza la ruta, se llevaría puesta a esta. Con esta pausa el
    // destino del aviso queda ENCIMA de la pantalla de inicio, que además es lo
    // correcto: al volver atrás, el usuario cae en su inicio y no en la nada.
    const salto = setTimeout(() => {
      switch (datos.tipo) {
        case 'mensaje':
          router.push({
            pathname: '/conversacion',
            params: { otroId: datos.otroId, otroNombre: datos.otroNombre },
          });
          break;
        case 'aviso':
          router.push({
            pathname: '/canal',
            params: { canalId: datos.canalId, canalNombre: datos.canalNombre },
          });
          break;
        case 'hijos':
          // Subió / bajó / el bus está cerca: todo se ve en "Mis hijos"
          router.push('/hijos');
          break;
      }
    }, 400);

    return () => clearTimeout(salto);
  }, [listo, respuesta]);
}
