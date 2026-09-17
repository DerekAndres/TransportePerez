import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { ALTURA, RADIO, VIDRIO, halo } from '@/constants/estilos';
import { ESPEJO_ZAFIRO } from '@/constants/tema';

// ============================================
// BOTÓN PRINCIPAL — la acción grande de una pantalla
// ============================================
// Es el botón que el usuario tiene que ver primero y poder tocar sin mirar:
// ancho completo, alto generoso (58 px, muy por encima del mínimo de 48 que
// recomienda Android para el dedo), texto grande y un ícono a la izquierda.
//
// Lo usan las acciones que DEFINEN la pantalla: "Iniciar viaje" y "Finalizar
// viaje" del conductor, "Entrar" del login. Para todo lo demás siguen los
// botones normales de Paper — si TODO fuera un botón grande, ninguno destacaría.
//
// EL "ESPEJO DE ZAFIRO": el diseño no pide un botón de color plano sino una
// superficie pulida, y eso se arma con tres capas que hay que poner en orden:
//   1. un degradado en diagonal, de zafiro a zafiro profundo — es lo que hace
//      que la superficie parezca curva y no un rectángulo pintado;
//   2. una línea de luz de 1 px sobre el borde de arriba — el reflejo de la luz
//      cenital sobre el canto (el mismo recurso que las láminas de vidrio);
//   3. un halo del MISMO color alrededor, que no oscurece sino que ilumina el
//      fondo negro de alrededor. Es lo que hace que el botón parezca encendido.
//
// El tono 'suave' es la otra cara del sistema: vidrio de obsidiana, casi
// transparente. Se usa para la acción secundaria que acompaña a la principal,
// y la diferencia entre las dos tiene que ser obvia de un vistazo.

type Tono = 'principal' | 'peligro' | 'suave';

export default function BotonPrincipal({
  texto,
  icono,
  onPress,
  tono = 'principal',
  cargando,
  deshabilitado,
  accesibilidad,
}: {
  texto: string;
  icono: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  // 'principal' = espejo de zafiro · 'peligro' = rojo (finalizar) · 'suave' = vidrio
  tono?: Tono;
  cargando?: boolean;
  deshabilitado?: boolean;
  // Lo que lee el lector de pantalla, cuando el texto visible solo no alcanza
  // ("Llamar" → "Llamar a Carlos al 9999-9999"). Sin esto, lee el texto.
  accesibilidad?: string;
}) {
  const tema = useTheme();

  // Cada tono es un par de colores (el degradado) más el color del texto.
  // El rojo de 'peligro' va SÓLIDO y saturado, no en vidrio: finalizar un viaje
  // por error es caro, así que ese botón tiene que verse distinto a todo lo
  // demás incluso con el sol pegando en la pantalla.
  const estilos: Record<Tono, { degradado: readonly [string, string]; texto: string }> = {
    principal: { degradado: ESPEJO_ZAFIRO, texto: '#FFFFFF' },
    peligro: { degradado: ['#E0463C', '#B3231B'], texto: '#FFFFFF' },
    suave: {
      degradado: ['rgba(255, 255, 255, 0.10)', 'rgba(255, 255, 255, 0.05)'],
      texto: tema.colors.onSurface,
    },
  };

  const { degradado, texto: color } = estilos[tono];
  const inactivo = deshabilitado || cargando;
  const esVidrio = tono === 'suave';

  // Vibración corta al tocar: confirma en la mano que el toque se registró.
  // Sirve de verdad acá — el conductor toca "Iniciar viaje" sin mirar, con el
  // teléfono en el soporte. Si el teléfono no tiene motor háptico, no pasa nada.
  const tocar = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onPress();
  };

  return (
    // La vista de afuera lleva el halo; la de adentro recorta el degradado a
    // las esquinas. Separadas porque en iOS `overflow: 'hidden'` también
    // recortaría la sombra y el halo desaparecería.
    <View
      style={[
        styles.contenedor,
        // El halo solo en los botones de color: un botón de vidrio no está
        // encendido, así que iluminar alrededor sería mentir sobre su jerarquía
        !esVidrio && halo(degradado[0]),
        inactivo && styles.inactivo,
      ]}
    >
      <TouchableRipple
        onPress={tocar}
        disabled={inactivo}
        borderless
        style={styles.boton}
        accessibilityLabel={accesibilidad ?? texto}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!inactivo }}
      >
        {/* El color sólido va DEBAJO del degradado: si la capa nativa no
            dibujara, el botón sigue siendo un botón de color y no un recuadro
            transparente con texto blanco encima */}
        <View style={[styles.interior, { backgroundColor: degradado[0] }]}>
          <LinearGradient
            colors={degradado}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* El filo de luz del borde de arriba */}
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.35)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.filo}
            pointerEvents="none"
          />

          <View style={styles.contenido}>
            {cargando ? (
              <ActivityIndicator color={color} size={20} />
            ) : (
              <MaterialCommunityIcons name={icono} size={22} color={color} />
            )}
            <Text variant="titleMedium" style={{ color }}>
              {texto}
            </Text>
          </View>
        </View>
      </TouchableRipple>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { borderRadius: RADIO.boton },
  boton: { borderRadius: RADIO.boton },
  interior: {
    minHeight: ALTURA.botonPrincipal,
    borderRadius: RADIO.boton,
    overflow: 'hidden',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: VIDRIO.bordeFuerte,
  },
  // Atenuado en vez de gris: se sigue leyendo qué botón es, solo que todavía
  // no se puede tocar
  inactivo: { opacity: 0.4 },
  filo: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  contenido: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 17,
  },
});
