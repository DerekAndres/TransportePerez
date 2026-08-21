import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { ALTURA, RADIO, SOMBRA_FLOTANTE } from '@/constants/estilos';

// ============================================
// BOTÓN PRINCIPAL — la acción grande de una pantalla
// ============================================
// Es el botón que el usuario tiene que ver primero y poder tocar sin mirar:
// ancho completo, alto generoso (58 px, muy por encima del mínimo de 48 que
// recomienda Android para el dedo), texto grande y un ícono a la derecha.
//
// Lo usan las acciones que definen la pantalla: "Iniciar viaje" y "Finalizar
// viaje" del conductor. Para todo lo demás siguen los botones normales de
// React Native Paper — si TODO fuera un botón grande, ninguno destacaría.

type Tono = 'principal' | 'peligro' | 'suave';

export default function BotonPrincipal({
  texto,
  icono,
  onPress,
  tono = 'principal',
  cargando,
  deshabilitado,
}: {
  texto: string;
  icono: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  // 'principal' = coral de marca · 'peligro' = rojo (finalizar) · 'suave' = tonal
  tono?: Tono;
  cargando?: boolean;
  deshabilitado?: boolean;
}) {
  const tema = useTheme();

  const colores: Record<Tono, { fondo: string; texto: string }> = {
    principal: { fondo: tema.colors.primary, texto: tema.colors.onPrimary },
    peligro: { fondo: tema.colors.error, texto: tema.colors.onError },
    suave: { fondo: tema.colors.secondaryContainer, texto: tema.colors.onSecondaryContainer },
  };

  const { fondo, texto: color } = colores[tono];
  const inactivo = deshabilitado || cargando;

  // Vibración corta al tocar: confirma en la mano que el toque se registró.
  // Sirve de verdad acá — el conductor toca "Iniciar viaje" sin mirar, con el
  // teléfono en el soporte. Si el teléfono no tiene motor háptico, no pasa nada.
  const tocar = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  };

  return (
    <TouchableRipple
      onPress={tocar}
      disabled={inactivo}
      borderless
      style={[
        styles.boton,
        { backgroundColor: fondo },
        // Atenuado en vez de gris: se sigue leyendo qué botón es, solo que no
        // se puede tocar todavía
        inactivo && styles.inactivo,
        tono !== 'suave' && SOMBRA_FLOTANTE,
        { shadowColor: fondo },
      ]}
      accessibilityLabel={texto}
    >
      <View style={styles.contenido}>
        {cargando ? (
          <ActivityIndicator color={color} size={20} />
        ) : (
          <MaterialCommunityIcons name={icono} size={22} color={color} />
        )}
        <Text variant="titleMedium" style={[styles.texto, { color }]}>
          {texto}
        </Text>
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  boton: {
    minHeight: ALTURA.botonPrincipal,
    borderRadius: RADIO.control,
    justifyContent: 'center',
  },
  inactivo: { opacity: 0.45 },
  contenido: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 17,
  },
  texto: { fontWeight: '700' },
});
