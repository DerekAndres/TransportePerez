import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// ============================================
// PORTADA DE LA APP — EL BUSITO ANDANDO
// ============================================
// Es lo primero que se ve al abrir la app, mientras se resuelve la sesión (que
// tarda lo que tarde Firebase en responder). Antes ahí había una rueda de carga
// gris; ahora está la marca y un bus que avanza, que es lo que le dice al
// usuario "esto es el transporte" sin que tenga que leer nada.
//
// CÓMO SE HACE EL MOVIMIENTO. El bus casi no se mueve: lo que se mueve es la
// CARRETERA debajo de él. Es el mismo truco de las caricaturas — el fondo corre
// hacia atrás y el personaje parece avanzar. Se hace así porque un bus que
// cruzara la pantalla se saldría enseguida y habría que reiniciarlo de un salto;
// con la carretera en bucle el movimiento es continuo y nunca se corta.
//
// Se usa `Animated`, que viene incluido en React Native (no se agregó ninguna
// librería). Las tres animaciones corren con `useNativeDriver: true`: eso las
// pasa al hilo nativo, así siguen fluidas aunque JavaScript esté ocupado —
// justo el caso de acá, que estamos esperando a Firebase.

// Ancho de una raya de la carretera más su hueco. La animación desplaza la fila
// exactamente este valor y vuelve a empezar: como todas las rayas son iguales,
// el salto de vuelta es invisible y el movimiento se ve infinito.
const PASO = 28;
const RAYAS = 16;

export default function PortadaAnimada() {
  const tema = useTheme();

  // Valores animados. Se guardan en `useRef` para que sobrevivan a los redibujos
  // sin reiniciarse (si se crearan en cada render, la animación se trabaría).
  const entrada = useRef(new Animated.Value(0)).current; // aparición del logo
  const carretera = useRef(new Animated.Value(0)).current; // rayas corriendo
  const rebote = useRef(new Animated.Value(0)).current; // suspensión del bus

  useEffect(() => {
    // 1. El logo aparece: de transparente y un poco chico, a opaco y tamaño real
    const aparecer = Animated.timing(entrada, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    // 2. La carretera corre en bucle, a velocidad constante (`Easing.linear`):
    // cualquier otra curva haría que el asfalto acelerara y frenara solo
    const rodar = Animated.loop(
      Animated.timing(carretera, {
        toValue: 1,
        duration: 620,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // 3. El bus rebota apenas, como la suspensión en un camino de tierra. Son 2
    // píxeles: lo justo para que parezca vivo sin marear
    const brincar = Animated.loop(
      Animated.sequence([
        Animated.timing(rebote, {
          toValue: 1,
          duration: 320,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rebote, {
          toValue: 0,
          duration: 320,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    aparecer.start();
    rodar.start();
    brincar.start();

    // Al salir de la portada se detienen: una animación en bucle que nadie ve
    // sigue consumiendo batería
    return () => {
      aparecer.stop();
      rodar.stop();
      brincar.stop();
    };
  }, [entrada, carretera, rebote]);

  return (
    <View style={[styles.fondo, { backgroundColor: tema.colors.background }]}>
      <Animated.View
        style={{
          opacity: entrada,
          transform: [
            { scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
          ],
        }}
      >
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
          // Se anuncia como imagen de marca para los lectores de pantalla
          accessibilityLabel="Inversiones Perez — transporte escolar"
        />
      </Animated.View>

      {/* --- El bus sobre la carretera --- */}
      <View style={styles.escena}>
        <Animated.View
          style={[
            styles.bus,
            {
              transform: [
                { translateY: rebote.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
              ],
            },
          ]}
        >
          <MaterialCommunityIcons name="bus-school" size={54} color={tema.colors.primary} />
        </Animated.View>

        {/* La carretera: una fila de rayas que se desplaza un PASO y reinicia */}
        <View style={styles.carretera}>
          <Animated.View
            style={[
              styles.rayas,
              {
                transform: [
                  {
                    translateX: carretera.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -PASO],
                    }),
                  },
                ],
              },
            ]}
          >
            {Array.from({ length: RAYAS }).map((_, i) => (
              <View
                key={i}
                style={[styles.raya, { backgroundColor: tema.colors.outlineVariant }]}
              />
            ))}
          </Animated.View>
        </View>
      </View>

      <Animated.View style={{ opacity: entrada }}>
        <Text variant="labelLarge" style={{ color: tema.colors.onSurfaceVariant }}>
          Preparando tu viaje…
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 },
  logo: { width: 168, height: 168, borderRadius: 34 },
  escena: { alignItems: 'center', gap: 6 },
  bus: { alignItems: 'center' },
  // `overflow: hidden` recorta la fila de rayas: sin esto se verían asomar por
  // los lados mientras se desplazan
  carretera: { width: 220, height: 4, overflow: 'hidden', justifyContent: 'center' },
  rayas: { flexDirection: 'row', alignItems: 'center' },
  raya: { width: PASO - 12, height: 4, borderRadius: 2, marginRight: 12 },
});
