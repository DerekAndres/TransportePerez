import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { RADIO, VIDRIO } from '@/constants/estilos';
import { CIAN } from '@/constants/tema';

// ============================================
// PASTILLA DE ESTADO — la "joya" del sistema
// ============================================
// La cápsula chica que dice en qué estado está algo: EN VIVO, A BORDO,
// ENTREGADO, ESPERANDO, NO ESTABA. Es el único elemento de la app que aparece
// en las tres apps (padre, conductor, admin), así que vale la pena que sea uno
// solo y no quince versiones parecidas.
//
// El design system la llama "Gleaming Badge Pill" y pide tres cosas:
//   - fondo de vidrio muy tenue con un contorno claro de un pelo,
//   - un punto de 6 px que BRILLA con el color del estado,
//   - y, en los estados VIVOS, un pulso de radar alrededor de ese punto.
//
// El pulso no es decoración: es la diferencia entre "el bus está transmitiendo
// AHORA" y "esta es la última posición conocida". Un punto quieto y uno que
// late dicen cosas distintas sin que nadie tenga que leer nada. Por eso solo lo
// llevan los estados en curso — si latiera siempre, no significaría nada.
//
// Sobre el texto en MAYÚSCULAS: el diseño lo reserva exclusivamente para estos
// indicadores cortos, con las letras bien separadas. Es lo que permite leerlos
// de un vistazo sin que compitan con los nombres propios de la pantalla.

export type TonoEstado =
  | 'vivo' // zafiro — está pasando ahora (bus en viaje, niño a bordo)
  | 'cumplido' // esmeralda — ya se cumplió (entregado, parada completa)
  | 'aviso' // ámbar — pide atención (en camino, comunicado, demorado)
  | 'alerta' // rojo — algo falló (no estaba, sin señal, desvío)
  | 'espera' // gris — todavía no pasó nada (esperando en la parada)
  | 'dato'; // cian — telemetría, no es un estado del niño (GPS, distancia)

export default function PastillaEstado({
  texto,
  tono = 'espera',
  icono,
  pulso,
  style,
}: {
  texto: string;
  tono?: TonoEstado;
  icono?: keyof typeof MaterialCommunityIcons.glyphMap;
  // Enciende el pulso de radar. Solo para lo que está ocurriendo en vivo.
  pulso?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const tema = useTheme();

  // Cada tono usa el tono CLARO de su color (no el vivo): la pastilla tiene
  // fondo translúcido, así que el texto va sobre la obsidiana y necesita el
  // tono que contrasta contra negro. Ver la nota de contraste en tema.ts.
  const colores: Record<TonoEstado, string> = {
    vivo: tema.colors.primary,
    cumplido: tema.colors.secondary,
    aviso: tema.colors.tertiary,
    alerta: tema.colors.error,
    espera: tema.colors.onSurfaceVariant,
    dato: CIAN,
  };
  const color = colores[tono];

  return (
    <View style={[styles.pastilla, style]}>
      {icono ? (
        <MaterialCommunityIcons name={icono} size={12} color={color} />
      ) : (
        <Punto color={color} pulso={pulso} />
      )}
      <Text variant="labelSmall" style={[styles.texto, { color }]}>
        {texto.toUpperCase()}
      </Text>
    </View>
  );
}

// --- El punto que late ---
// Son dos círculos superpuestos: el de abajo se agranda y se desvanece en bucle
// (el "radar"), el de arriba queda fijo y encendido. Si no hay pulso, solo se
// dibuja el fijo.
//
// La animación corre con `useNativeDriver`, o sea en el hilo nativo: sigue
// latiendo aunque la pantalla esté cargando datos de Firestore, que es
// exactamente cuando el usuario está mirando si el bus transmite o no.
function Punto({ color, pulso }: { color: string; pulso?: boolean }) {
  const onda = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pulso) return;
    const bucle = Animated.loop(
      Animated.timing(onda, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    bucle.start();
    // Se detiene al desmontar: una animación en bucle que queda viva después de
    // salir de la pantalla sigue gastando batería sin que nadie la vea
    return () => bucle.stop();
  }, [pulso, onda]);

  return (
    <View style={styles.puntoCaja}>
      {pulso && (
        <Animated.View
          style={[
            styles.onda,
            {
              backgroundColor: color,
              opacity: onda.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
              transform: [
                { scale: onda.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) },
              ],
            },
          ]}
        />
      )}
      {/* El halo del punto fijo: una sombra del MISMO color, que no oscurece
          sino que ilumina — el `0 0 8px currentColor` del diseño */}
      <View
        style={[
          styles.punto,
          { backgroundColor: color, shadowColor: color },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pastilla: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIO.pastilla,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: VIDRIO.bordeFuerte,
  },
  texto: { includeFontPadding: false },
  puntoCaja: { width: 6, height: 6, alignItems: 'center', justifyContent: 'center' },
  punto: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  onda: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
});
