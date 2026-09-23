import { useEffect, useMemo, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  View,
  useAnimatedValue,
} from 'react-native';
import { Modal, Portal } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Vidrio from '@/components/Vidrio';
import { useAlturaTeclado } from '@/hooks/use-teclado';
import { ESPACIO, RADIO } from '@/constants/estilos';

// ============================================
// HOJA QUE SUBE DESDE ABAJO
// ============================================
// El "pop up" de esta app no es un cuadro en el medio de la pantalla: es una
// hoja de vidrio que sube desde abajo. La razón es física y no estética — con
// una sola mano, el pulgar llega cómodo a la parte de abajo de la pantalla y no
// a la de arriba; y es el patrón que el usuario ya conoce de cualquier app.
//
// Acá vive SOLO el marco de la hoja (el velo de fondo, la entrada animada, el
// asa y el gesto de arrastrar para cerrar). Lo que va adentro lo pone cada
// pantalla. Existe como componente aparte porque ese marco ya estaba escrito
// dos veces en cuanto apareció la segunda hoja, y la mecánica de un gesto es
// justo lo que no conviene tener duplicado.
//
// SE CIERRA DE CUATRO FORMAS, las cuatro que la gente prueba sin pensar: tocar
// afuera, deslizar la hoja hacia abajo, el botón "atrás" de Android y el botón
// de cancelar o cerrar que agregue el contenido.

// Cuánto sube la hoja al entrar, y cuánto hay que arrastrarla para cerrarla
const DESPLAZAMIENTO_ENTRADA = 28;
const DISTANCIA_PARA_CERRAR = 110;
const VELOCIDAD_PARA_CERRAR = 1.1;

// El velo que oscurece la pantalla de atrás. Más oscuro que el de Paper: sobre
// un mapa claro, un velo tenue deja que las calles compitan con la hoja.
const VELO_FONDO = 'rgba(4, 7, 14, 0.74)';

interface Props {
  visible: boolean;
  onCerrar: () => void;
  children: ReactNode;
  // Para las hojas que tienen un campo de texto: la hoja se levanta lo que mida
  // el teclado, así el campo nunca queda debajo de él
  conTeclado?: boolean;
}

export default function HojaInferior({ visible, onCerrar, children, conTeclado }: Props) {
  const insets = useSafeAreaInsets();
  const altoTeclado = useAlturaTeclado();
  // El valor que mueve la hoja hacia arriba y hacia abajo. `useAnimatedValue`
  // lo crea UNA vez y lo conserva mientras la pantalla está montada (es la forma
  // que recomienda React Native; el viejo `useRef(new Animated.Value()).current`
  // hace lo mismo pero confunde a las reglas del compilador de React).
  const desplazamiento = useAnimatedValue(DESPLAZAMIENTO_ENTRADA);

  // --- La entrada: la hoja sube un poco mientras aparece ---
  // El fundido lo pone el Modal de Paper; acá solo se agrega el movimiento. Si
  // el teléfono tiene activado "reducir movimiento" (accesibilidad), la hoja
  // aparece quieta, sin subir.
  useEffect(() => {
    if (!visible) return;
    let cancelado = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reducir) => {
        if (cancelado) return;
        if (reducir) {
          desplazamiento.setValue(0);
          return;
        }
        desplazamiento.setValue(DESPLAZAMIENTO_ENTRADA);
        Animated.timing(desplazamiento, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    return () => {
      cancelado = true;
    };
  }, [visible, desplazamiento]);

  // --- Deslizar hacia abajo para cerrar ---
  // Se engancha SOLO al asa de arriba, no a toda la hoja: así un arrastre nunca
  // compite con la lista de adentro ni con un campo de texto. Si se la suelta
  // antes de la distancia (o sin velocidad), vuelve a su lugar.
  const arrastre = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evento, gesto) =>
          gesto.dy > 6 && Math.abs(gesto.dy) > Math.abs(gesto.dx),
        onPanResponderMove: (_evento, gesto) => desplazamiento.setValue(Math.max(0, gesto.dy)),
        onPanResponderRelease: (_evento, gesto) => {
          if (gesto.dy > DISTANCIA_PARA_CERRAR || gesto.vy > VELOCIDAD_PARA_CERRAR) {
            Animated.timing(desplazamiento, {
              toValue: 700,
              duration: 180,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }).start(() => onCerrar());
          } else {
            Animated.spring(desplazamiento, {
              toValue: 0,
              bounciness: 4,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () =>
          Animated.spring(desplazamiento, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [desplazamiento, onCerrar]
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onCerrar}
        // El Modal de Paper centra su contenido y reserva los bordes seguros:
        // acá se lo lleva abajo, y el borde de abajo lo maneja la propia hoja
        style={styles.envoltorio}
        theme={{ colors: { backdrop: VELO_FONDO } }}
      >
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.hoja,
            {
              marginBottom:
                conTeclado && altoTeclado > 0
                  ? altoTeclado + ESPACIO.interno
                  : insets.bottom + ESPACIO.interno,
              transform: [{ translateY: desplazamiento }],
            },
          ]}
        >
          <Vidrio nivel="superpuesto" radio={RADIO.lamina} elevado sinRelleno>
            <View style={styles.cuerpo}>
              <View
                {...arrastre.panHandlers}
                style={styles.zonaAsa}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View style={styles.asa} />
              </View>

              {children}
            </View>
          </Vidrio>
        </Animated.View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  // Lleva la hoja al pie de la pantalla (el Modal de Paper la centra)
  envoltorio: { justifyContent: 'flex-end', marginBottom: 0 },
  // Separada de los bordes y con ancho tope: en una tablet no se estira de
  // punta a punta
  hoja: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: ESPACIO.interno,
  },
  cuerpo: { padding: ESPACIO.interno, gap: ESPACIO.interno },
  // Zona generosa alrededor del asa: es lo que se agarra para arrastrar, así
  // que tiene que perdonar la puntería
  zonaAsa: { alignItems: 'center', paddingTop: 2, paddingBottom: ESPACIO.minimo + 2 },
  asa: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.28)' },
});
