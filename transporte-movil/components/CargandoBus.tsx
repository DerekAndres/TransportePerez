import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ESPACIO, estilosBase } from '@/constants/estilos';

// ============================================
// EL BUSITO DE CARGANDO
// ============================================
// Reemplaza a la rueda gris de siempre cuando la app está esperando datos.
// No es solo decoración: una rueda no dice nada, y este bus le recuerda al
// usuario qué está usando mientras espera.
//
// Es la misma mecánica que la portada de arranque (`PortadaAnimada`), que
// conserva su propia copia a propósito: allá el bus va más grande, sobre el
// degradado azul y acompañado del logo, y es una pantalla que ya está probada.
// Unificarlas obligaría a llenar este componente de variantes para un solo uso.
// El panel web tiene su gemelo en `transporte-web/src/components/CargandoBus`,
// hecho con CSS, para que esperar se sienta igual en las dos mitades.
//
// CÓMO SE HACE EL MOVIMIENTO. El bus casi no se mueve: lo que se mueve es la
// CARRETERA debajo. Es el truco de las caricaturas — el fondo corre hacia atrás
// y el personaje parece avanzar. Se hace así porque un bus que cruzara la
// pantalla se saldría enseguida y habría que reiniciarlo de un salto; con la
// carretera en bucle el movimiento es continuo y nunca se corta.
//
// Las rayas son todas iguales, así que cuando la fila se desplaza UN PASO y
// vuelve a empezar, el salto es invisible.
//
// Las tres animaciones corren con `useNativeDriver: true`: pasan al hilo
// nativo, así siguen fluidas aunque JavaScript esté ocupado — que es justo lo
// que pasa cuando se está esperando a Firebase.

// Ancho de una raya más su hueco
const PASO = 28;
const RAYAS = 16;

export default function CargandoBus({
  texto,
  tamano = 'normal',
  color,
  colorRaya,
}: {
  // Mensaje opcional debajo ("Cargando tus hijos…"). Decir QUÉ se está
  // esperando hace que la espera se sienta más corta que un texto genérico.
  texto?: string;
  // 'chico' para cargas dentro de una tarjeta; 'normal' para pantalla completa
  tamano?: 'chico' | 'normal';
  // Colores a mano, para cuando el fondo NO es el de la app: la portada de
  // arranque va sobre el degradado azul y ahí los colores del tema (pensados
  // para fondo claro) no se leen.
  color?: string;
  colorRaya?: string;
}) {
  const tema = useTheme();
  const chico = tamano === 'chico';

  const carretera = useRef(new Animated.Value(0)).current; // rayas corriendo
  const rebote = useRef(new Animated.Value(0)).current; // suspensión del bus

  useEffect(() => {
    // La carretera corre a velocidad constante (`Easing.linear`): cualquier
    // otra curva haría que el asfalto acelerara y frenara solo
    const rodar = Animated.loop(
      Animated.timing(carretera, {
        toValue: 1,
        duration: 620,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // El bus rebota apenas, como la suspensión en un camino de tierra. Son 2
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

    rodar.start();
    brincar.start();

    // Una animación en bucle que ya nadie ve sigue gastando batería
    return () => {
      rodar.stop();
      brincar.stop();
    };
  }, [carretera, rebote]);

  return (
    <View style={[styles.centro, chico ? styles.aireChico : styles.aire]}>
      <Animated.View
        style={{
          transform: [
            { translateY: rebote.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
          ],
        }}
      >
        <MaterialCommunityIcons
          name="bus-school"
          size={chico ? 34 : 50}
          color={color ?? tema.colors.primary}
        />
      </Animated.View>

      {/* La carretera: una fila de rayas que se desplaza un PASO y reinicia */}
      <View style={[styles.carretera, { width: chico ? 140 : 210 }]}>
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
            <View key={i} style={[styles.raya, { backgroundColor: colorRaya ?? tema.colors.outlineVariant }]} />
          ))}
        </Animated.View>
      </View>

      {!!texto && (
        <Text variant="bodySmall" style={[estilosBase.tenue, styles.texto]}>
          {texto}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  aire: { flex: 1, padding: ESPACIO.seccion },
  aireChico: { paddingVertical: ESPACIO.seccion },
  // `overflow: hidden` recorta la fila: sin esto las rayas asomarían por los
  // lados mientras se desplazan
  carretera: { height: 4, overflow: 'hidden', justifyContent: 'center' },
  rayas: { flexDirection: 'row', alignItems: 'center' },
  raya: { width: PASO - 12, height: 4, borderRadius: 2, marginRight: 12 },
  texto: { marginTop: 4, textAlign: 'center' },
});
