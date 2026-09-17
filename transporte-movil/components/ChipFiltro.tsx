import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';

import { ESPACIO, RADIO, VIDRIO, halo } from '@/constants/estilos';
import { ESPEJO_ZAFIRO, ZAFIRO } from '@/constants/tema';

// ============================================
// CHIPS DE SELECCIÓN — elegir entre pocas opciones
// ============================================
// Una fila de pastillas donde la elegida se pinta llena y las demás quedan
// tenues. Es la forma más directa de mostrar "estás viendo esto, podés cambiar
// a aquello" sin abrir un menú ni un desplegable: todas las opciones están a la
// vista y a un toque.
//
// Se usa para que el conductor cambie entre las rutas que tiene asignadas.

export interface OpcionChip {
  id: string;
  etiqueta: string;
  // Texto chico opcional a la derecha de la etiqueta (ej. "12 niños")
  detalle?: string;
}

export default function ChipFiltro({
  opciones,
  seleccionadaId,
  onSeleccionar,
}: {
  opciones: OpcionChip[];
  seleccionadaId: string | null;
  onSeleccionar: (id: string) => void;
}) {
  const tema = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.fila}
      // Se sale del margen de la pantalla y lo repone adentro: así los chips se
      // deslizan de borde a borde, como en las apps de catálogo
      style={styles.carril}
    >
      {opciones.map((opcion) => {
        const activa = opcion.id === seleccionadaId;
        return (
          <TouchableRipple
            key={opcion.id}
            onPress={() => onSeleccionar(opcion.id)}
            borderless
            style={[
              styles.chip,
              // La elegida es el espejo de zafiro, con su halo; las demás son
              // vidrio apagado. El fondo de zafiro va debajo del degradado
              // porque en iOS una sombra necesita fondo opaco para dibujarse.
              activa
                ? { backgroundColor: ZAFIRO, ...halo(ZAFIRO) }
                : { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
            ]}
          >
            <View style={styles.contenidoChip}>
              {activa && (
                <LinearGradient
                  colors={ESPEJO_ZAFIRO}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[StyleSheet.absoluteFill, styles.chip]}
                  pointerEvents="none"
                />
              )}
              <Text
                variant="labelLarge"
                numberOfLines={1}
                style={{ color: activa ? '#FFFFFF' : tema.colors.onSurfaceVariant }}
              >
                {opcion.etiqueta}
              </Text>
              {!!opcion.detalle && (
                <Text
                  variant="labelSmall"
                  style={{
                    color: activa ? '#FFFFFF' : tema.colors.onSurfaceVariant,
                    opacity: 0.75,
                  }}
                >
                  {opcion.detalle}
                </Text>
              )}
            </View>
          </TouchableRipple>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  carril: { marginHorizontal: -ESPACIO.pantalla },
  fila: { paddingHorizontal: ESPACIO.pantalla, gap: 8 },
  chip: {
    borderRadius: RADIO.pastilla,
    borderWidth: 1,
    borderColor: VIDRIO.borde,
  },
  contenidoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    // El degradado de la elegida va como capa absoluta detrás del texto: sin
    // esto quedaría por encima y taparía la etiqueta
    overflow: 'hidden',
    borderRadius: RADIO.pastilla,
  },
});
