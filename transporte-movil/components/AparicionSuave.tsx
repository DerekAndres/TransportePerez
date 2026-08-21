import type { ReactNode } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

// ============================================
// APARICIÓN SUAVE DE UN BLOQUE
// ============================================
// Envuelve una tarjeta para que entre desde abajo con un fundido, en vez de
// aparecer de golpe cuando terminan de llegar los datos de Firestore. Con el
// `indice` de la lista, cada tarjeta entra un instante después de la anterior
// (efecto "cascada"), que es lo que hace que una pantalla que se llena de datos
// se sienta fluida y no brusca.
//
// La animación la corre react-native-reanimated en el hilo de UI: no se traba
// aunque la pantalla esté cargando datos al mismo tiempo. Es solo estética — si
// se quitara, la app funciona exactamente igual.

// Cuánto espera cada tarjeta respecto de la anterior
const ESCALON_MS = 55;
// Tope del retraso: con muchas tarjetas, las últimas no pueden hacerse esperar
const RETRASO_MAXIMO_MS = 300;

export default function AparicionSuave({
  children,
  indice = 0,
}: {
  children: ReactNode;
  indice?: number;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(300).delay(Math.min(indice * ESCALON_MS, RETRASO_MAXIMO_MS))}
    >
      {children}
    </Animated.View>
  );
}
