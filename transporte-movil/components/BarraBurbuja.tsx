import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter, type Href } from 'expo-router';

import Vidrio from '@/components/Vidrio';
import { useAuth } from '@/context/AuthContext';
import { destinosDeRol, type Destino } from '@/constants/navegacion';
import { ALTURA, ESPACIO, RADIO, halo } from '@/constants/estilos';
import { ESPEJO_ZAFIRO, ZAFIRO } from '@/constants/tema';

// ============================================
// BARRA DE NAVEGACIÓN FLOTANTE ("burbuja")
// ============================================
// La navegación de la app. Las secciones del rol están SIEMPRE a la vista, a un
// toque, sin abrir nada. Para el padre y el conductor eso importa más que
// ahorrar espacio — un menú lateral obliga a descubrir que existe.
//
// Se llama "burbuja" por dos razones, y las dos se ven:
//   1. La barra entera es una cápsula que FLOTA: no toca los bordes de la
//      pantalla, se despega del fondo con una sombra amplia y deja ver el
//      contenido pasar por debajo.
//   2. La sección activa se marca con una burbuja de zafiro alrededor del ícono.
//
// ES EL ÚNICO LUGAR DE LA APP CON DESENFOQUE SIEMPRE ENCENDIDO, y está
// justificado: acá SÍ pasa contenido por detrás mientras el usuario hace scroll,
// así que el vidrio tiene algo que desenfocar y el efecto se ve de verdad. En
// las listas, en cambio, detrás solo hay fondo liso y las tarjetas usan el tono
// sólido equivalente (ver la nota sobre VIDRIO en constants/estilos.ts).
//
// Debajo del ícono va SIEMPRE la etiqueta, incluso en la sección activa. Es
// deliberado: una barra de solo íconos obliga a adivinar, y el padre de familia
// no tiene que aprender nada para usar la app (CLAUDE.md §1-bis). El texto es
// chico para no robar protagonismo, pero está.

export default function BarraBurbuja() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const rutaActual = usePathname();
  const { usuario } = useAuth();

  const destinos = destinosDeRol(usuario?.rol);

  const ir = (ruta: Href) => {
    // replace y no push: la barra cambia de sección, no apila pantallas — así
    // el botón físico "atrás" del teléfono no recorre todo lo que el usuario
    // visitó dentro de la app
    if (ruta !== rutaActual) router.replace(ruta);
  };

  return (
    <Vidrio
      nivel="flotante"
      radio={RADIO.pastilla}
      // El único desenfoque siempre encendido de la app: acá SÍ pasa contenido
      // por detrás mientras el usuario hace scroll (ver la nota del componente)
      translucido
      elevado
      sinRelleno
      style={[styles.barra, { bottom: insets.bottom + ESPACIO.interno }]}
    >
      {/* La barra es una sola cosa para el lector de pantalla */}
      <View style={styles.fila} accessibilityRole="tablist">
        {destinos.map((destino) => (
          <ItemBarra
            key={destino.etiqueta}
            destino={destino}
            activo={rutaActual === destino.ruta}
            onPress={() => ir(destino.ruta)}
          />
        ))}
      </View>
    </Vidrio>
  );
}

// --- Un destino de la barra ---
// Se separa en su propio componente porque cada uno tiene su propia animación:
// al volverse activo, la burbuja crece desde el 80 % hasta su tamaño. Es un
// detalle chico pero es lo que hace que cambiar de sección se sienta suave en
// vez de un salto seco.
function ItemBarra({
  destino,
  activo,
  onPress,
}: {
  destino: Destino;
  activo: boolean;
  onPress: () => void;
}) {
  const tema = useTheme();
  const escala = useRef(new Animated.Value(activo ? 1 : 0.8)).current;

  useEffect(() => {
    Animated.spring(escala, {
      toValue: activo ? 1 : 0.8,
      useNativeDriver: true, // corre en el hilo nativo: no se traba aunque la pantalla esté cargando datos
      friction: 7,
      tension: 90,
    }).start();
  }, [activo, escala]);

  return (
    <TouchableRipple
      onPress={onPress}
      borderless
      style={styles.item}
      accessibilityRole="tab"
      accessibilityState={{ selected: activo }}
      accessibilityLabel={destino.etiqueta}
    >
      <View style={styles.contenidoItem}>
        <Animated.View
          style={[
            styles.burbuja,
            { transform: [{ scale: escala }] },
            // El halo va en ESTA vista y no en una capa aparte: en iOS una
            // sombra necesita que su vista tenga fondo opaco para dibujarse, y
            // el zafiro de abajo es justamente ese fondo (el degradado que va
            // encima lo tapa, pero la sombra ya salió del color correcto).
            activo && { backgroundColor: ZAFIRO, ...halo(ZAFIRO) },
          ]}
        >
          {/* La burbuja activa es el mismo espejo de zafiro del botón principal:
              la sección donde estás parado es lo único encendido de la barra */}
          {activo && (
            <LinearGradient
              colors={ESPEJO_ZAFIRO}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, styles.redonda]}
              pointerEvents="none"
            />
          )}
          <MaterialCommunityIcons
            name={destino.icono}
            size={21}
            color={activo ? '#FFFFFF' : tema.colors.onSurfaceVariant}
          />
        </Animated.View>
        <Text
          variant="labelSmall"
          numberOfLines={1}
          style={[
            styles.etiqueta,
            { color: activo ? tema.colors.primary : tema.colors.onSurfaceVariant },
          ]}
        >
          {destino.corto}
        </Text>
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  barra: {
    position: 'absolute',
    left: ESPACIO.pantalla,
    right: ESPACIO.pantalla,
  },
  fila: {
    height: ALTURA.barraBurbuja,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ESPACIO.minimo,
  },
  // flex:1 reparte el ancho en partes iguales, así la barra se ve igual con 3
  // destinos (conductor) que con 5 (padre) y en cualquier ancho de teléfono
  item: { flex: 1, height: '100%', borderRadius: RADIO.pastilla, justifyContent: 'center' },
  contenidoItem: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  burbuja: {
    width: 38,
    height: 38,
    borderRadius: RADIO.pastilla,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  redonda: { borderRadius: RADIO.pastilla },
  etiqueta: { includeFontPadding: false },
});
