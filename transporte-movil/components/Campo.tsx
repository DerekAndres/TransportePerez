import { StyleSheet } from 'react-native';
import { TextInput } from 'react-native-paper';
import type { ComponentProps } from 'react';

import { RADIO } from '@/constants/estilos';

// Campo de texto de TODOS los formularios de la app. Es el TextInput de React
// Native Paper con el borde redondeado del sistema de diseño ya aplicado, para
// que ningún formulario quede con esquinas distintas a los demás.
// Acepta las mismas props que el TextInput original.
type Props = ComponentProps<typeof TextInput>;

export default function Campo(props: Props) {
  return <TextInput mode="outlined" outlineStyle={styles.borde} {...props} />;
}

const styles = StyleSheet.create({
  borde: { borderRadius: RADIO.control },
});
