import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ESPACIO, RADIO, SOMBRA_TARJETA, bordeTarjeta, fondoTarjeta } from '@/constants/estilos';

// Atajo grande de la pantalla de inicio (van de a dos por fila). Es un botón
// que se lee de un vistazo: un ícono con fondo de color, un título corto y una
// aclaración. Sirve para las acciones que el padre hace de vez en cuando
// (inscribir un hijo, pedir un cambio) sin obligarlo a buscarlas en el menú.
export default function TileAccion({
  titulo,
  detalle,
  icono,
  onPress,
  color,
  insignia,
}: {
  titulo: string;
  detalle: string;
  icono: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  // 'acento' usa el mango de la identidad; por defecto, el coral principal
  color?: 'primario' | 'acento';
  // Número sobre el ícono (ej. mensajes sin leer). Se oculta si es 0.
  insignia?: number;
}) {
  const tema = useTheme();

  const fondoIcono =
    color === 'acento' ? tema.colors.tertiaryContainer : tema.colors.primaryContainer;
  const colorIcono =
    color === 'acento' ? tema.colors.onTertiaryContainer : tema.colors.onPrimaryContainer;

  return (
    <TouchableRipple
      onPress={onPress}
      borderless
      style={[
        styles.tile,
        { backgroundColor: fondoTarjeta(tema), borderWidth: 1, borderColor: bordeTarjeta(tema) },
      ]}
    >
      <View style={styles.contenido}>
        <View style={[styles.circulo, { backgroundColor: fondoIcono }]}>
          <MaterialCommunityIcons name={icono} size={22} color={colorIcono} />
          {/* La insignia se monta sobre la esquina del círculo, como en el
              ícono de cualquier app con mensajes pendientes */}
          {!!insignia && insignia > 0 && (
            <View style={[styles.insignia, { backgroundColor: tema.colors.error }]}>
              <Text variant="labelSmall" style={{ color: tema.colors.onError }}>
                {insignia > 9 ? '9+' : insignia}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.textos}>
          <Text variant="titleSmall" numberOfLines={2} style={styles.titulo}>
            {titulo}
          </Text>
          <Text variant="bodySmall" numberOfLines={2} style={styles.tenue}>
            {detalle}
          </Text>
        </View>
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: RADIO.tarjeta,
    padding: ESPACIO.interno + 2,
    ...SOMBRA_TARJETA,
  },
  contenido: { gap: ESPACIO.interno },
  circulo: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  insignia: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { gap: 2 },
  titulo: { fontWeight: '700' },
  tenue: { opacity: 0.6 },
});
