import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ESPACIO } from '@/constants/estilos';

// ============================================
// LÍNEA DEL VIAJE — de dónde sale y a dónde va
// ============================================
// Muestra el viaje del niño como un recorrido con tres hitos: de dónde sale,
// el bus en el medio y a dónde llega. Es la forma más rápida de entender el
// estado sin leer: la parte recorrida va en azul y la que falta en gris.
//
//   ●━━━━━━━🚌┈┈┈┈┈┈┈○
//   Casa                Escuela
//
// El padre no tiene que aprender nada nuevo: ve el mismo dibujo que ya conoce
// de cualquier app de envíos.

export type EtapaViaje = 'pendiente' | 'en_camino' | 'completado';

export default function LineaViaje({
  origen,
  destino,
  etapa,
  horaOrigen,
  horaDestino,
}: {
  origen: string;
  destino: string;
  etapa: EtapaViaje;
  horaOrigen?: string | null;
  horaDestino?: string | null;
}) {
  const tema = useTheme();

  const activo = tema.colors.primary;
  const inactivo = tema.colors.outlineVariant;

  // Qué tramos ya se recorrieron: al subir se completa el primero; al bajar,
  // los dos.
  const primerTramoHecho = etapa === 'en_camino' || etapa === 'completado';
  const segundoTramoHecho = etapa === 'completado';

  return (
    <View style={styles.contenedor}>
      <View style={styles.riel}>
        {/* Origen: se marca en azul apenas el niño sube */}
        <View
          style={[
            styles.nodo,
            {
              borderColor: primerTramoHecho ? activo : inactivo,
              backgroundColor: primerTramoHecho ? activo : 'transparent',
            },
          ]}
        />
        <View style={[styles.tramo, { backgroundColor: primerTramoHecho ? activo : inactivo }]} />

        {/* El bus: lleno mientras viaja, y con check cuando ya entregó */}
        <View
          style={[
            styles.burbujaBus,
            {
              backgroundColor: primerTramoHecho ? activo : tema.colors.surfaceVariant,
              borderColor: tema.colors.surface,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={segundoTramoHecho ? 'check' : 'bus'}
            size={16}
            color={primerTramoHecho ? tema.colors.onPrimary : tema.colors.onSurfaceVariant}
          />
        </View>

        <View style={[styles.tramo, { backgroundColor: segundoTramoHecho ? activo : inactivo }]} />
        <View
          style={[
            styles.nodo,
            {
              borderColor: segundoTramoHecho ? activo : inactivo,
              backgroundColor: segundoTramoHecho ? activo : 'transparent',
            },
          ]}
        />
      </View>

      {/* Etiquetas de los extremos */}
      <View style={styles.filaEtiquetas}>
        <View style={styles.extremo}>
          <Text variant="labelLarge" numberOfLines={1}>
            {origen}
          </Text>
          {!!horaOrigen && (
            <Text variant="bodySmall" style={styles.tenue}>
              {horaOrigen}
            </Text>
          )}
        </View>
        <View style={[styles.extremo, styles.derecha]}>
          <Text variant="labelLarge" numberOfLines={1}>
            {destino}
          </Text>
          {!!horaDestino && (
            <Text variant="bodySmall" style={styles.tenue}>
              {horaDestino}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: ESPACIO.minimo },
  riel: { flexDirection: 'row', alignItems: 'center' },
  nodo: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  tramo: { flex: 1, height: 2 },
  burbujaBus: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filaEtiquetas: { flexDirection: 'row', justifyContent: 'space-between', gap: ESPACIO.interno },
  extremo: { flex: 1, gap: 1 },
  derecha: { alignItems: 'flex-end' },
  tenue: { opacity: 0.6 },
});
