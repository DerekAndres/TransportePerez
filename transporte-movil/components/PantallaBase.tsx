import { useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MenuLateral from '@/components/MenuLateral';
import { useAlturaTeclado } from '@/hooks/use-teclado';
import { ALTURA, ESPACIO, RADIO, estilosBase, respiroInferior } from '@/constants/estilos';
import { FRANJA_TROPICAL } from '@/constants/tema';

// ============================================
// ESQUELETO COMÚN DE TODAS LAS PANTALLAS
// ============================================
// Todas las pantallas de la app se arman con este componente, y por eso todas
// se ven igual: el mismo encabezado ("Transportes Perez" al centro, el menú ☰ a
// la izquierda), el mismo margen lateral y el mismo aire entre bloques.
//
// Hay dos formas de la barra de arriba:
//   - Sección (Inicio, Mensajes, Avisos…): botón ☰ que abre el menú lateral.
//   - Pantalla apilada (un formulario, el perfil de un hijo): flecha de volver.
// Se elige sola según se pase o no `alVolver`.
//
// ADAPTACIÓN AL TELÉFONO (importante): la app dibuja de borde a borde
// ("edgeToEdgeEnabled" en app.json), así que el contenido pasaría por DEBAJO de
// la barra de estado de arriba y de la barra de navegación de abajo. Acá se
// compensan las dos con los insets del sistema, que valen distinto en cada
// teléfono: un Android con los tres botones de abajo (atrás/inicio/recientes)
// reserva ~48 px, uno con gestos ~12 px, y un iPhone con notch ~34 px. Por eso
// no hay ningún número fijo: se lee del sistema y la app se acomoda sola.

interface Props {
  // Lo que dice el centro del encabezado. Por defecto, el nombre de la empresa.
  titulo?: string;
  // Renglón chico bajo el título (ej. "Últimos 7 días")
  subtitulo?: string;
  // Si se pasa, la izquierda muestra la flecha de volver en vez del menú ☰
  alVolver?: () => void;
  // Contenido opcional de la esquina derecha (avatar, botón de acción)
  accionDerecha?: ReactNode;
  // false para pantallas que manejan su propio scroll o que ocupan todo el alto
  // (el mapa a pantalla completa, un chat con su lista invertida). En ese caso
  // la pantalla se encarga ella misma del espacio de la barra de navegación.
  scroll?: boolean;
  // Deslizar para refrescar (solo con scroll)
  refrescando?: boolean;
  onRefrescar?: () => void;
  children: ReactNode;
}

export default function PantallaBase({
  titulo = 'Transportes Perez',
  subtitulo,
  alVolver,
  accionDerecha,
  scroll = true,
  refrescando,
  onRefrescar,
  children,
}: Props) {
  const tema = useTheme();
  const insets = useSafeAreaInsets();
  const altoTeclado = useAlturaTeclado();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const contenido = scroll ? (
    <ScrollView
      contentContainerStyle={[
        estilosBase.scroll,
        // Aire final por encima de la barra de navegación del teléfono, más lo
        // que ocupe el teclado si está abierto: así, en CUALQUIER formulario de
        // la app, el campo que se está llenando se puede desplazar hasta quedar
        // a la vista en lugar de esconderse detrás del teclado.
        { paddingBottom: respiroInferior(insets.bottom) + altoTeclado },
      ]}
      showsVerticalScrollIndicator={false}
      // El rebote de iOS y el "overscroll" de Android hacen que el scroll se
      // sienta más suave al llegar a los extremos
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefrescar ? (
          <RefreshControl refreshing={!!refrescando} onRefresh={onRefrescar} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={estilosBase.pantalla}>{children}</View>
  );

  return (
    <View style={[estilosBase.pantalla, { backgroundColor: tema.colors.background }]}>
      {/* Encabezado: menú/volver · nombre · acción */}
      <View style={[styles.encabezado, { paddingTop: insets.top + 8 }]}>
        <TouchableRipple
          onPress={alVolver ?? (() => setMenuAbierto(true))}
          borderless
          style={[styles.botonIzquierda, { backgroundColor: tema.colors.surfaceVariant }]}
          accessibilityLabel={alVolver ? 'Volver' : 'Abrir menú'}
        >
          <MaterialCommunityIcons
            name={alVolver ? 'arrow-left' : 'menu'}
            size={22}
            color={tema.colors.onSurfaceVariant}
          />
        </TouchableRipple>

        <View style={styles.centro}>
          <Text variant="titleMedium" numberOfLines={1} style={estilosBase.negrita}>
            {titulo}
          </Text>
          {!!subtitulo && (
            <Text variant="bodySmall" numberOfLines={1} style={estilosBase.tenue}>
              {subtitulo}
            </Text>
          )}
        </View>

        {/* Ancho fijo a la derecha para que el título quede centrado de verdad,
            haya o no acción (si no, el texto se corre hacia un lado) */}
        <View style={styles.ranuraDerecha}>{accionDerecha}</View>
      </View>

      {/* Franja de marca: coral · mango · aqua. Es el guiño a la franja pintada
          de los buses escolares y hace que cualquier captura de la app se
          reconozca al instante como de Transportes Perez. */}
      <View style={styles.franja}>
        {FRANJA_TROPICAL.map((color) => (
          <View key={color} style={[styles.tramoFranja, { backgroundColor: color }]} />
        ))}
      </View>

      {contenido}

      <MenuLateral visible={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ALTURA.encabezado,
    paddingHorizontal: ESPACIO.interno,
    paddingBottom: ESPACIO.interno,
    gap: ESPACIO.minimo,
  },
  // Círculo suave alrededor del ícono: se ve como un botón de verdad y da
  // una superficie más grande para el dedo
  botonIzquierda: {
    width: 42,
    height: 42,
    borderRadius: RADIO.pastilla,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centro: { flex: 1, alignItems: 'center' },
  ranuraDerecha: { width: 42, alignItems: 'flex-end', justifyContent: 'center' },
  // Los tres colores de la marca, del ancho de la pantalla y muy finos: se
  // notan sin robar atención al contenido
  franja: { flexDirection: 'row', height: 3, marginBottom: ESPACIO.interno },
  tramoFranja: { flex: 1 },
});
