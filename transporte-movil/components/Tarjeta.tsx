import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import Vidrio, { type NivelVidrio } from '@/components/Vidrio';
import { RADIO } from '@/constants/estilos';

// La lámina sobre la que se apoya todo el contenido de la app. Es una capa
// finita sobre `Vidrio` que existe por dos razones:
//
//   1. Le pone nombre de DOMINIO a la pieza. Las pantallas hablan de "tarjetas",
//      no de "láminas de vidrio de nivel ambiente" — el material es un detalle
//      del sistema de diseño, no algo que cada pantalla deba elegir.
//   2. Fija los valores por defecto correctos (nivel ambiente, radio de tarjeta,
//      sólido). Así ninguna pantalla puede inventar una tarjeta distinta a las
//      demás, que es lo que pasaba cuando cada una usaba el <Card> de Paper con
//      sus propias props.
//
// Reemplaza al <Card> de React Native Paper para tener control del radio, del
// relleno y del material desde los tokens (constants/estilos.ts).
interface Props {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  // Quita el relleno interno: para tarjetas cuyo contenido llega hasta el borde
  // (una foto de portada, un mapa embebido)
  sinRelleno?: boolean;
  // Enciende el desenfoque de verdad. Solo tiene sentido si detrás de la
  // tarjeta HAY algo que desenfocar — un mapa, una foto. En una lista sobre el
  // fondo liso de la pantalla no cambia nada y cuesta caro en teléfonos de gama
  // baja, así que por defecto va apagado (ver la nota sobre VIDRIO en
  // constants/estilos.ts).
  translucida?: boolean;
  // Sube la tarjeta a otro nivel del sistema de vidrio: 'flotante' para lo que
  // se despega del resto, 'superpuesto' para lo que tapa a todo lo demás
  nivel?: NivelVidrio;
}

export default function Tarjeta({
  children,
  onPress,
  style,
  sinRelleno,
  translucida,
  nivel = 'ambiente',
}: Props) {
  return (
    <Vidrio
      nivel={nivel}
      radio={RADIO.tarjeta}
      onPress={onPress}
      translucido={translucida}
      elevado={nivel !== 'ambiente'}
      sinRelleno={sinRelleno}
      style={style}
    >
      {children}
    </Vidrio>
  );
}
