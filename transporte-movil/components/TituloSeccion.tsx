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
}: {
  titulo: string;
  onVerTodo?: () => void;
  textoAccion?: string;
}) {
  const tema = useTheme();

  return (
    <View style={styles.fila}>
      <Text variant="titleMedium" style={styles.titulo}>
        {titulo}
      </Text>
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
  titulo: { fontWeight: '700' },
  accion: { borderRadius: RADIO.pastilla, paddingVertical: 4, paddingHorizontal: 6 },
  filaAccion: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
