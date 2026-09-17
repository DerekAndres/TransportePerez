import { StyleSheet } from 'react-native';
import { TextInput, useTheme } from 'react-native-paper';
import type { ComponentProps } from 'react';

import { RADIO, VIDRIO } from '@/constants/estilos';
import { OBSIDIANA_PROFUNDA, ZAFIRO } from '@/constants/tema';

// Campo de texto de TODOS los formularios de la app. Acepta las mismas props
// que el TextInput de React Native Paper; lo que agrega es el aspecto del
// sistema de diseño, para que ningún formulario invente el suyo.
//
// EL CAMPO ES UNA "ZANJA", no una lámina: mientras las tarjetas FLOTAN sobre la
// obsidiana, un campo de texto se HUNDE en ella. Por eso su fondo es más oscuro
// que el de la pantalla (`#0A0E18`, el tono más profundo de la paleta) — el
// contraste invertido es lo que hace leer "acá se escribe adentro" sin ningún
// texto de ayuda. Al enfocarlo, el contorno se enciende en zafiro.
//
// Nota: React Native no dibuja sombras interiores, que es como el diseño
// original hunde el campo. El fondo más oscuro cumple la misma función y no
// necesita ninguna capa extra (la explicación larga está en constants/estilos.ts).
type Props = ComponentProps<typeof TextInput>;

export default function Campo(props: Props) {
  const tema = useTheme();

  return (
    <TextInput
      mode="outlined"
      outlineStyle={styles.borde}
      // El fondo de la "zanja". Va como `style` y no dentro de `theme` porque
      // Paper usa este color también para tapar la línea del contorno detrás de
      // la etiqueta flotante — si no coincidieran, se vería un escalón ahí.
      style={styles.campo}
      outlineColor={VIDRIO.borde}
      activeOutlineColor={ZAFIRO}
      placeholderTextColor={tema.colors.onSurfaceVariant}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  borde: { borderRadius: RADIO.control, borderWidth: 1.5 },
  campo: { backgroundColor: OBSIDIANA_PROFUNDA },
});
