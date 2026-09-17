import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ActivityIndicator, Text, TouchableRipple } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { RADIO, SOMBRA_FLOTANTE, VIDRIO, VIDRIO_OSCURO, halo } from '@/constants/estilos';
import { ZAFIRO } from '@/constants/tema';

// ============================================
// BOTÓN QUE FLOTA SOBRE UN MAPA
// ============================================
// El control que acomoda el mapa por el usuario: "centrar" en el mapa del bus,
// "siguiente parada" y "ver toda la ruta" en el del conductor, "estoy acá" en el
// selector de ubicación. Antes cada mapa resolvía esto a su manera (o no lo
// resolvía) y había que arrastrar el mapa con el dedo hasta encontrar el bus.
//
// Es UN componente para los cuatro mapas por la misma razón que los colores del
// mapa viven en constants/mapa.ts: si cada pantalla dibuja su propio botón, en
// dos semanas hay cuatro botones distintos para la misma acción.
//
// POR QUÉ ES OPACO Y NO VIDRIO DE VERDAD: el desenfoque de `Vidrio` no puede
// desenfocar lo que hay detrás acá, porque detrás hay un WebView (una vista
// nativa aparte, que Android no le presta a la capa de blur). Así que se usa el
// tono sólido equivalente —el mismo VIDRIO_OSCURO de las pastillas sobre el
// mapa—, que además cuesta menos en los teléfonos de gama baja.
//
// DOS TONOS, y la diferencia importa:
//   · 'vidrio' — un control disponible, que no pide nada (ver toda la ruta).
//   · 'zafiro' — lo que el mapa está pidiendo AHORA: el padre movió el mapa y
//     perdió al bus, o al conductor le toca una parada. Va encendido, con halo.

// 48 px: el mínimo que Android recomienda para tocar sin mirar, que acá es el
// caso real (el conductor maneja, el padre está parado en la vereda)
const LADO = 48;

interface Props {
  icono: keyof typeof MaterialCommunityIcons.glyphMap;
  // Sin texto el botón queda REDONDO (solo el ícono); con texto, cápsula.
  // Redondo es para lo que se usa seguido; con texto, para lo que hay que leer
  // una vez ("Siguiente · 3. Casa de los López").
  texto?: string;
  tono?: 'vidrio' | 'zafiro';
  cargando?: boolean;
  onPress: () => void;
  // Lo que lee el lector de pantalla. Obligatorio en los redondos: un ícono
  // solo no dice nada.
  accesibilidad?: string;
  estilo?: StyleProp<ViewStyle>;
}

export default function BotonMapa({
  icono,
  texto,
  tono = 'vidrio',
  cargando,
  onPress,
  accesibilidad,
  estilo,
}: Props) {
  const encendido = tono === 'zafiro';

  return (
    // La sombra va afuera y el relleno adentro: en iOS, `overflow: 'hidden'`
    // recorta también la sombra (mismo motivo que en BotonPrincipal)
    <View style={[styles.contenedor, encendido ? halo(ZAFIRO) : SOMBRA_FLOTANTE, estilo]}>
      <TouchableRipple
        onPress={onPress}
        borderless
        style={styles.toque}
        accessibilityRole="button"
        accessibilityLabel={accesibilidad ?? texto}
      >
        <View
          style={[
            styles.interior,
            { backgroundColor: encendido ? ZAFIRO : VIDRIO_OSCURO },
            !texto && styles.redondo,
          ]}
        >
          {cargando ? (
            <ActivityIndicator size={20} color="#FFFFFF" />
          ) : (
            <MaterialCommunityIcons name={icono} size={22} color="#FFFFFF" />
          )}
          {!!texto && (
            <Text variant="labelLarge" numberOfLines={1} style={styles.texto}>
              {texto}
            </Text>
          )}
        </View>
      </TouchableRipple>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { borderRadius: RADIO.pastilla },
  toque: { borderRadius: RADIO.pastilla },
  interior: {
    minHeight: LADO,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: RADIO.pastilla,
    borderWidth: 1,
    borderColor: VIDRIO.bordeFuerte,
    overflow: 'hidden',
  },
  // Redondo perfecto: el ancho iguala al alto y el texto no existe
  redondo: { width: LADO, paddingHorizontal: 0 },
  // `flexShrink` deja que la cápsula se achique cuando el nombre de la parada es
  // largo, en vez de empujar al botón de al lado fuera de la pantalla
  texto: { color: '#FFFFFF', flexShrink: 1 },
});
