import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BarraBurbuja from '@/components/BarraBurbuja';
import Degradado from '@/components/Degradado';
import { useAlturaTeclado } from '@/hooks/use-teclado';
import { ALTURA, ESPACIO, RADIO, VIDRIO, estilosBase, respiroInferior } from '@/constants/estilos';
import { NOCHE_OBSIDIANA, ZAFIRO } from '@/constants/tema';

// ============================================
// ESQUELETO COMÚN DE TODAS LAS PANTALLAS
// ============================================
// Todas las pantallas de la app se arman con este componente, y por eso todas
// se ven igual: el mismo encabezado, el mismo margen lateral y el mismo aire
// entre bloques.
//
// Hay dos formas de la pantalla, y se elige sola según se pase o no `alVolver`:
//
//   - SECCIÓN (Inicio, Mensajes, Avisos…): el título va grande y pegado a la
//     izquierda, con el subtítulo debajo y la acción (el avatar) a la derecha.
//     Es la cabecera de las apps modernas de consumo: el nombre de la pantalla
//     hace de titular, no de etiqueta centrada en una barra. Estas pantallas
//     muestran la BARRA FLOTANTE de abajo para cambiar de sección.
//
//   - APILADA (un formulario, el perfil de un hijo, un chat): flecha de volver
//     a la izquierda y título centrado, que es lo que el usuario espera de una
//     pantalla "hija". No lleva barra de abajo: de una pantalla apilada se sale
//     volviendo, no saltando a otra sección.
//
// ⚠️ NO LE PASES `alVolver` A UNA PANTALLA DE SECCIÓN. Pasa que parece
// inofensivo —"le pongo una flecha por las dudas"— y rompe dos cosas a la vez:
//   1. esconde la barra de abajo, o sea la ÚNICA forma de salir de ahí;
//   2. la flecha no hace nada, porque a las secciones se llega con
//      `router.replace()` (ver BarraBurbuja) y replace NO apila historial:
//      `router.back()` no tiene a dónde volver.
// El usuario queda encerrado en la pantalla. Ya pasó con Mensajes y Avisos del
// admin. Las secciones de cada rol están en constants/navegacion.ts: ninguna
// de esas lleva `alVolver`.
//
// ADAPTACIÓN AL TELÉFONO (importante): la app dibuja de borde a borde
// (obligatorio desde Expo SDK 57, ver AGENTS.md), así que el contenido pasaría por DEBAJO de
// la barra de estado de arriba y de la barra de navegación de abajo. Acá se
// compensan las dos con los insets del sistema, que valen distinto en cada
// teléfono: un Android con los tres botones de abajo (atrás/inicio/recientes)
// reserva ~48 px, uno con gestos ~12 px, y un iPhone con notch ~34 px. Por eso
// no hay ningún número fijo: se lee del sistema y la app se acomoda sola.

interface Props {
  // Lo que dice el encabezado. Por defecto, el nombre de la empresa.
  titulo?: string;
  // Renglón chico bajo el título (ej. "Últimos 7 días")
  subtitulo?: string;
  // Si se pasa, la pantalla es APILADA: flecha de volver y sin barra de abajo
  alVolver?: () => void;
  // Contenido opcional de la esquina derecha (avatar, botón de acción)
  accionDerecha?: ReactNode;
  // false para pantallas que manejan su propio scroll o que ocupan todo el alto
  // (el mapa a pantalla completa, un chat con su lista invertida). En ese caso
  // la pantalla se encarga ella misma del espacio de la barra de abajo, con el
  // ayudante `espacioBarra()` de constants/estilos.
  scroll?: boolean;
  // Escape para una pantalla de sección que NO deba mostrar la barra flotante
  // (por ejemplo, un mapa a pantalla completa donde taparía el contenido)
  sinBarra?: boolean;
  // Quita el encabezado por completo: el contenido empieza pegado al borde de
  // arriba, por DEBAJO de la barra de estado. Lo usa el inicio del padre cuando
  // hay un viaje en curso, para que el mapa llegue hasta arriba de todo. La
  // pantalla que lo pide se hace cargo de su propio inset superior y de poner
  // ahí lo que necesite (el avatar flotando, por ejemplo).
  sinEncabezado?: boolean;
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
  sinBarra,
  sinEncabezado,
  refrescando,
  onRefrescar,
  children,
}: Props) {
  const tema = useTheme();
  const insets = useSafeAreaInsets();
  const altoTeclado = useAlturaTeclado();

  // La barra de abajo es la navegación entre SECCIONES: no tiene sentido en una
  // pantalla apilada, de la que se sale volviendo.
  const muestraBarra = !alVolver && !sinBarra;

  const contenido = scroll ? (
    <ScrollView
      contentContainerStyle={[
        estilosBase.scroll,
        // Aire final por encima de la barra de navegación del teléfono y de la
        // barra flotante, más lo que ocupe el teclado si está abierto: así, en
        // CUALQUIER formulario de la app, el campo que se está llenando se
        // puede desplazar hasta quedar a la vista en lugar de esconderse detrás
        // del teclado, y la última tarjeta nunca queda debajo de la barra.
        { paddingBottom: respiroInferior(insets.bottom, muestraBarra) + altoTeclado },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefrescar ? (
          <RefreshControl
            refreshing={!!refrescando}
            onRefresh={onRefrescar}
            // Sobre un fondo negro, la ruedita blanca por defecto de Android
            // aparece dentro de un disco blanco que corta la pantalla en dos
            tintColor={tema.colors.primary}
            colors={[tema.colors.primary]}
            progressBackgroundColor={tema.colors.elevation.level3}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={estilosBase.pantalla}>{children}</View>
  );

  return (
    // ⚠️ EL FONDO ES UNA CAPA DETRÁS, NUNCA EL CONTENEDOR DEL CONTENIDO.
    // Esto parece un detalle y no lo es. El degradado lo dibuja un componente
    // NATIVO (`expo-linear-gradient`). Si ese módulo no está en el binario que
    // está corriendo —pasa siempre que se agrega una dependencia nativa y se
    // sigue usando un APK viejo— React Native no puede crear la vista y no
    // dibuja NADA. Cuando el contenido de la pantalla colgaba adentro del
    // degradado, se iba junto con él: todas las pantallas quedaban en blanco y
    // solo se veía el fondo del tema de navegación (un azul oscuro).
    //
    // Con el degradado como hermano absoluto y el contenido aparte, lo peor que
    // puede pasar es que la app se vea sobre un fondo plano. Nunca vacía.
    //
    // El color plano de respaldo es el primer tono del degradado, así que
    // mientras la capa nativa carga tampoco se ve un salto.
    <View style={[estilosBase.pantalla, { backgroundColor: NOCHE_OBSIDIANA[1] }]}>
      {/* El fondo va acá, en el contenedor de la pantalla y NO dentro del
          scroll, para que quede quieto mientras el contenido se desplaza — un
          degradado que se mueve con el scroll se nota y se ve barato. */}
      <Degradado
        colores={NOCHE_OBSIDIANA}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* EL RESPLANDOR DE ZAFIRO: una mancha de luz de marca detrás del
          encabezado, muy tenue. Es lo que impide que la parte de arriba de la
          pantalla se lea como un rectángulo negro muerto, y da el "atmospheric
          depth" que pide el diseño. Es decorativo y no recibe toques. */}
      <Degradado
        colores={['rgba(37, 99, 235, 0.20)', 'rgba(37, 99, 235, 0.06)', 'transparent']}
        style={styles.resplandor}
        pointerEvents="none"
      />

      {!sinEncabezado && (
        <View style={[styles.encabezado, { paddingTop: insets.top + ESPACIO.interno }]}>
          {/* Pantalla apilada: círculo de vidrio con la flecha de volver */}
          {!!alVolver && (
            <TouchableRipple
              onPress={alVolver}
              borderless
              style={[
                styles.botonCircular,
                { backgroundColor: 'rgba(255, 255, 255, 0.07)', borderColor: VIDRIO.bordeFuerte },
              ]}
              accessibilityLabel="Volver"
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color={tema.colors.onSurface} />
            </TouchableRipple>
          )}

          <View style={alVolver ? styles.centro : styles.titulos}>
            <Text
              // En una sección el título es un titular grande en Outfit; en una
              // pantalla apilada, una etiqueta normal centrada
              variant={alVolver ? 'titleMedium' : 'headlineMedium'}
              numberOfLines={1}
            >
              {titulo}
            </Text>
            {!!subtitulo && (
              <Text variant="bodySmall" numberOfLines={1} style={estilosBase.tenue}>
                {subtitulo}
              </Text>
            )}
          </View>

          {/* Ancho fijo a la derecha: en la pantalla apilada mantiene el título
              centrado de verdad (si no, el texto se corre hacia un lado) */}
          <View style={styles.ranuraDerecha}>{accionDerecha}</View>
        </View>
      )}

      {contenido}

      {muestraBarra && <BarraBurbuja />}
    </View>
  );
}

const styles = StyleSheet.create({
  // La mancha de luz ocupa el tercio de arriba y se desvanece hacia abajo
  resplandor: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ALTURA.encabezado,
    paddingHorizontal: ESPACIO.pantalla,
    paddingBottom: ESPACIO.interno,
    gap: ESPACIO.interno,
  },
  // Círculo de vidrio alrededor del ícono: se ve como un botón de verdad y da
  // una superficie más grande para el dedo
  botonCircular: {
    width: 42,
    height: 42,
    borderRadius: RADIO.pastilla,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    // El color de marca se declara acá aunque no se dibuje, para que quede
    // explícito de dónde sale el resplandor de arriba
    shadowColor: ZAFIRO,
  },
  // Sección: el titular manda desde la izquierda
  titulos: { flex: 1, gap: 1 },
  // Apilada: título centrado entre la flecha y la ranura derecha
  centro: { flex: 1, alignItems: 'center' },
  ranuraDerecha: { minWidth: 42, alignItems: 'flex-end', justifyContent: 'center' },
});
