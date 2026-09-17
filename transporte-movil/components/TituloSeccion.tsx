import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ESPACIO, RADIO } from '@/constants/estilos';

// Encabezado de una sección del inicio: el título a la izquierda y, opcional,
// un "Ver todo" a la derecha que lleva a la pantalla completa de esa sección.
// Es lo que le da ritmo a la pantalla de inicio y evita que se lea como una
// lista larga de tarjetas sueltas.
export default function TituloSeccion({
  titulo,
  onVerTodo,
  textoAccion = 'Ver todo',
  detalle,
}: {
  titulo: string;
  onVerTodo?: () => void;
  textoAccion?: string;
  // Etiqueta PASIVA a la derecha, cuando no hay a dónde ir ("2 inscritos").
  // Es distinta de `textoAccion`: aquélla lleva a otra pantalla y se ve como un
  // enlace; ésta solo informa, así que va tenue y no invita a tocarla. Sin esa
  // diferencia, el usuario toca un texto que no hace nada.
  detalle?: string;
}) {
  const tema = useTheme();

  return (
    <View style={styles.fila}>
      <Text variant="titleLarge">{titulo}</Text>
      {!onVerTodo && !!detalle && (
        <Text variant="labelMedium" style={styles.detalle}>
          {detalle}
        </Text>
      )}
      {onVerTodo && (
        <TouchableRipple onPress={onVerTodo} borderless style={styles.accion}>
          <View style={styles.filaAccion}>
            <Text variant="labelLarge" style={{ color: tema.colors.primary }}>
              {textoAccion}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={tema.colors.primary} />
          </View>
        </TouchableRipple>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Pega el título a la tarjeta que va justo debajo
    marginBottom: -ESPACIO.interno,
  },
  accion: { borderRadius: RADIO.pastilla, paddingVertical: 4, paddingHorizontal: 6 },
  detalle: { opacity: 0.6 },
  filaAccion: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
