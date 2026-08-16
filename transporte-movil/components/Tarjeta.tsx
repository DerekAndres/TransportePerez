import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { TouchableRipple, useTheme } from 'react-native-paper';

import { RADIO, estilosBase, fondoTarjeta } from '@/constants/estilos';

// La tarjeta blanca sobre la que se apoya todo el contenido de la app.
// Reemplaza al <Card> de React Native Paper para tener control del radio, del
// relleno y de la sombra desde los tokens de diseño (constants/estilos.ts), y
// que así todas las tarjetas de la app sean idénticas.
//
// Si recibe `onPress` se vuelve tocable, con el efecto de onda de Material
// recortado a las esquinas redondeadas.
interface Props {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  // Quita el relleno interno: para tarjetas cuyo contenido llega hasta el borde
  // (una foto de portada, un mapa embebido)
  sinRelleno?: boolean;
}

export default function Tarjeta({ children, onPress, style, sinRelleno }: Props) {
  const tema = useTheme();

  const estilo = [
    estilosBase.tarjeta,
    { backgroundColor: fondoTarjeta(tema) },
    sinRelleno && styles.sinRelleno,
    style,
  ];

  if (!onPress) return <View style={estilo}>{children}</View>;

  return (
    <TouchableRipple onPress={onPress} borderless style={estilo}>
      {/* TouchableRipple exige UN solo hijo: esta View agrupa el contenido */}
      <View style={styles.contenido}>{children}</View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  sinRelleno: { padding: 0, overflow: 'hidden', borderRadius: RADIO.tarjeta },
  contenido: { gap: 12 },
});
