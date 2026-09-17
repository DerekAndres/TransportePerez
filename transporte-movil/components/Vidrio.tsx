import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { TouchableRipple } from 'react-native-paper';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { ESPACIO, RADIO, SOMBRA_FLOTANTE, SOMBRA_TARJETA, VIDRIO } from '@/constants/estilos';

// ============================================
// LÁMINA DE VIDRIO — el material de toda la app
// ============================================
// Es EL componente del rediseño: la superficie sobre la que se apoya todo el
// contenido. Cada lámina se arma con cuatro capas apiladas, y cada una tiene un
// trabajo distinto:
//
//   1. EL DESENFOQUE — lo que hay detrás (un mapa, una foto, el contenido que
//      pasa por debajo) se ve borroso a través de la lámina. Es lo que convierte
//      un rectángulo gris en algo que parece vidrio esmerilado de verdad.
//   2. EL VELO DE COLOR — un degradado oscuro encima del desenfoque. Sin él la
//      lámina tomaría el color de lo que tiene detrás, y sobre un mapa claro se
//      volvería blanca. El degradado va apenas inclinado (no perfectamente
//      vertical), que es lo que simula una superficie curva tomando la luz.
//   3. EL FILO ESPECULAR — una línea de luz de 1 px pegada al borde de ARRIBA,
//      que se apaga hacia los costados. Es el reflejo de una luz cenital sobre
//      un canto de vidrio cortado, y es la firma visual del sistema. Va solo
//      arriba: si rodeara toda la lámina se leería como un marco, no como un
//      reflejo.
//   4. EL CONTORNO — un borde blanco de un pelo, casi transparente, alrededor
//      de todo. Sobre un fondo casi negro es lo que le dice al ojo dónde
//      termina la lámina.
//
// POR QUÉ DOS VISTAS ANIDADAS Y NO UNA: la de afuera lleva la sombra, la de
// adentro lleva `overflow: 'hidden'` para recortar las capas a las esquinas
// redondeadas. En iOS las dos cosas no pueden convivir en la misma vista —
// recortar el contenido recorta también la sombra y desaparece.

export type NivelVidrio = 'ambiente' | 'flotante' | 'superpuesto';

// Los tres niveles del design system. `tinte` es el par de colores del velo:
// arriba más claro, abajo más oscuro.
// `fondo` es el color SÓLIDO equivalente a ese vidrio apoyado sobre la
// obsidiana. Va debajo del degradado por dos motivos: mientras la capa nativa
// dibuja no se ve un hueco, y si el módulo nativo no estuviera en el binario
// (pasa con un APK viejo después de sumar una dependencia nativa), la lámina
// sigue siendo una superficie y no un recuadro transparente.
const NIVELES: Record<
  NivelVidrio,
  {
    desenfoque: number;
    tinte: readonly [string, string];
    fondo: string;
    borde: string;
    filo: string;
  }
> = {
  // Paneles apoyados: tarjetas, tiles, filas de una lista
  ambiente: {
    desenfoque: VIDRIO.desenfoqueAmbiente,
    tinte: ['rgba(30, 41, 59, 0.62)', 'rgba(15, 23, 42, 0.78)'],
    fondo: '#1C1F2A',
    borde: VIDRIO.borde,
    filo: VIDRIO.filoSuave,
  },
  // Lo que flota: la barra de navegación, la hoja de acción sobre el mapa
  flotante: {
    desenfoque: VIDRIO.desenfoqueFlotante,
    tinte: ['rgba(30, 41, 59, 0.72)', 'rgba(15, 23, 42, 0.84)'],
    fondo: '#20242F',
    borde: VIDRIO.bordeFuerte,
    filo: VIDRIO.filo,
  },
  // Lo que tapa: menús, diálogos, avisos que se superponen a todo
  superpuesto: {
    desenfoque: VIDRIO.desenfoqueSuperpuesto,
    tinte: ['rgba(30, 41, 59, 0.88)', 'rgba(10, 14, 24, 0.94)'],
    fondo: '#161A25',
    borde: VIDRIO.bordeFuerte,
    filo: VIDRIO.filo,
  },
};

interface Props {
  children: ReactNode;
  nivel?: NivelVidrio;
  radio?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  // ENCIENDE el desenfoque de verdad. Va apagado por defecto, y el default
  // importa: detrás de casi toda lámina de la app solo hay el fondo liso de la
  // pantalla, y desenfocar un color plano devuelve el mismo color plano —
  // gastando una vista desenfocada por tarjeta en los teléfonos de gama baja
  // que tienen los padres (CLAUDE.md §2). El resultado se ve idéntico porque
  // los tonos sólidos del tema se calcularon justamente como "este vidrio
  // apoyado sobre la obsidiana".
  //
  // Se enciende SOLO donde hay algo real que desenfocar: la barra flotante de
  // abajo (pasa el contenido por detrás al hacer scroll) y las láminas que se
  // apoyan sobre un mapa o una foto.
  translucido?: boolean;
  // Sombra más amplia, para lo que de verdad flota sobre el resto
  elevado?: boolean;
  // Quita el relleno interno: para láminas cuyo contenido llega hasta el borde
  // (un mapa embebido, una foto de portada)
  sinRelleno?: boolean;
}

export default function Vidrio({
  children,
  nivel = 'ambiente',
  radio = RADIO.tarjeta,
  style,
  onPress,
  translucido,
  elevado,
  sinRelleno,
}: Props) {
  const config = NIVELES[nivel];

  const capas = (
    <>
      {/* 1. El desenfoque de lo que hay detrás (solo si se pidió) */}
      {translucido && (
        <BlurView
          intensity={config.desenfoque}
          tint="dark"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

      {/* 2. El velo de color, apenas inclinado (el 165° del diseño) */}
      <LinearGradient
        colors={config.tinte}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* 3. El filo especular del borde de arriba. Se apaga hacia los extremos
             para que se lea como un reflejo que recorre el canto, y no como una
             línea dibujada de punta a punta. */}
      <LinearGradient
        colors={['transparent', config.filo, config.filo, 'transparent']}
        locations={[0, 0.25, 0.75, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.filo}
        pointerEvents="none"
      />

      {children}
    </>
  );

  // La vista de ADENTRO: recorta las capas a las esquinas redondeadas
  const interior = (
    <View
      style={[
        styles.interior,
        { borderRadius: radio, borderColor: config.borde },
        // El respaldo sólido va SOLO cuando no hay desenfoque real. Con
        // `translucido`, un fondo opaco acá abajo sería justamente lo que el
        // BlurView terminaría desenfocando, y el vidrio dejaría de dejar pasar
        // lo que tiene detrás — o sea, se perdería el efecto entero.
        !translucido && { backgroundColor: config.fondo },
        !sinRelleno && styles.relleno,
      ]}
    >
      {capas}
    </View>
  );

  // La vista de AFUERA: lleva la sombra (que no se puede recortar)
  return (
    <View style={[{ borderRadius: radio }, elevado ? SOMBRA_FLOTANTE : SOMBRA_TARJETA, style]}>
      {onPress ? (
        <TouchableRipple onPress={onPress} borderless style={{ borderRadius: radio }}>
          {interior}
        </TouchableRipple>
      ) : (
        interior
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  interior: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  relleno: { padding: ESPACIO.canal, gap: ESPACIO.interno },
  filo: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
});
