import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import Vidrio from '@/components/Vidrio';
import { ESPACIO, RADIO, estilosBase, halo } from '@/constants/estilos';

// Atajo grande de la pantalla de inicio (van de a dos por fila). Es un botón
// que se lee de un vistazo: un ícono encendido, un título corto y una
// aclaración. Sirve para las acciones que el padre hace de vez en cuando
// (inscribir un hijo, pedir un cambio) sin obligarlo a buscarlas en el menú.
//
// El ícono va dentro de un círculo con un HALO de su propio color. En un fondo
// negro, un círculo de color plano se ve apagado; con el halo parece una fuente
// de luz, que es lo que el diseño llama "jewel beacon". Es el mismo recurso del
// punto de las pastillas de estado y del botón principal — tres piezas
// distintas, un solo lenguaje.
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
  // 'acento' usa el ámbar de los avisos; por defecto, el zafiro de marca
  color?: 'primario' | 'acento';
  // Número sobre el ícono (ej. mensajes sin leer). Se oculta si es 0.
  insignia?: number;
}) {
  const tema = useTheme();

  // El tono CLARO para el ícono (va sobre fondo oscuro) y el VIVO para el halo
  const colorIcono = color === 'acento' ? tema.colors.tertiary : tema.colors.primary;
  const fondoIcono =
    color === 'acento' ? 'rgba(245, 158, 11, 0.16)' : 'rgba(37, 99, 235, 0.20)';

  return (
    <Vidrio onPress={onPress} radio={RADIO.tarjeta} style={styles.tile} sinRelleno>
      <View style={styles.contenido}>
        <View style={[styles.circulo, { backgroundColor: fondoIcono, ...halo(colorIcono) }]}>
          <MaterialCommunityIcons name={icono} size={22} color={colorIcono} />
          {/* La insignia se monta sobre la esquina del círculo, como en el
              ícono de cualquier app con mensajes pendientes */}
          {!!insignia && insignia > 0 && (
            <View style={[styles.insignia, { backgroundColor: tema.colors.errorContainer }]}>
              <Text variant="labelSmall" style={{ color: tema.colors.onErrorContainer }}>
                {insignia > 9 ? '9+' : insignia}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.textos}>
          <Text variant="titleSmall" numberOfLines={2}>
            {titulo}
          </Text>
          <Text variant="bodySmall" numberOfLines={2} style={estilosBase.tenue}>
            {detalle}
          </Text>
        </View>
      </View>
    </Vidrio>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1 },
  contenido: { gap: ESPACIO.interno, padding: ESPACIO.canal },
  circulo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
});
