import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';

import { ESPACIO, RADIO } from '@/constants/estilos';

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
              {
                backgroundColor: activa ? tema.colors.primary : tema.colors.surfaceVariant,
              },
            ]}
          >
            <View style={styles.contenidoChip}>
              <Text
                variant="labelLarge"
                numberOfLines={1}
                style={{
                  color: activa ? tema.colors.onPrimary : tema.colors.onSurfaceVariant,
                  fontWeight: activa ? '700' : '500',
                }}
              >
                {opcion.etiqueta}
              </Text>
              {!!opcion.detalle && (
                <Text
                  variant="labelSmall"
                  style={{
                    color: activa ? tema.colors.onPrimary : tema.colors.onSurfaceVariant,
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
  chip: { borderRadius: RADIO.pastilla },
  contenidoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
});
