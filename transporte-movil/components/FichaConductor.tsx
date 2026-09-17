import { useEffect, useMemo } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Linking,
  PanResponder,
  StyleSheet,
  View,
  useAnimatedValue,
} from 'react-native';
import { Avatar, Modal, Portal, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BotonPrincipal from '@/components/BotonPrincipal';
import Vidrio from '@/components/Vidrio';
import {
  ESPACIO,
  RADIO,
  SOMBRA_TARJETA,
  VIDRIO,
  VIDRIO_OSCURO,
  estilosBase,
} from '@/constants/estilos';
import { FUENTES, OBSIDIANA_PROFUNDA, ZAFIRO } from '@/constants/tema';
import type { Bus, Usuario } from '@/types/models';

// ============================================
// FICHA DE QUIÉN LLEVA A MI HIJO
// ============================================
// Se abre cuando el padre toca la tarjeta del conductor en su inicio. Un padre
// la mira unos diez segundos, muchas veces parado en la vereda esperando el
// bus. Todo el diseño sale de esa escena:
//
// 1. ES UNA HOJA QUE SUBE DESDE ABAJO, NO UN DIÁLOGO EN EL MEDIO. Con una sola
//    mano, el pulgar llega cómodo a la parte de abajo de la pantalla y no a la
//    de arriba; y es el patrón que el padre ya conoce de cualquier app. Flota
//    separada de los bordes, como la barra de navegación de abajo.
//
// 2. PRIMERO LA UNIDAD, GRANDE, CON LA PLACA ENCIMA. El padre no espera a una
//    persona: espera un BUS. Poder comparar la foto y la placa con el bus que
//    dobla la esquina es lo que convierte estos datos en algo útil.
//
// 3. DESPUÉS, LA PERSONA. Su foto se monta sobre el borde de la foto de la
//    unidad (redonda, como toda persona en la app; la unidad es rectangular
//    porque es un objeto), con su nombre grande y su teléfono visible.
//
// 4. DOS DATOS, NO UNA LISTA: la ruta y la capacidad, en dos casillas.
//
// 5. AL FINAL, LAS ACCIONES, GRANDES. "Llamar" es la principal (espejo de
//    zafiro): con el bus llegando tarde, lo urgente es hablar. "Escribir" es la
//    secundaria (vidrio). Antes, llamar era un renglón más de la lista.
//
// SE CIERRA DE CUATRO FORMAS, las cuatro que la gente prueba sin pensar: la X,
// tocar afuera, deslizar la hoja hacia abajo y el botón "atrás" de Android.
//
// RADIOS CONCÉNTRICOS (regla de constants/estilos.ts): la lámina tiene radio 24
// y relleno 12, así que la foto de adentro lleva radio 12. Si no, las dos
// curvas se pelean en la esquina.

// Cuánto sube la hoja al entrar, y cuánto hay que arrastrarla para cerrarla
const DESPLAZAMIENTO_ENTRADA = 28;
const DISTANCIA_PARA_CERRAR = 110;
const VELOCIDAD_PARA_CERRAR = 1.1;

const TAMANO_AVATAR = 72;
// Cuánto se monta la foto del conductor sobre la foto de la unidad
const SOLAPE_AVATAR = 34;
const RADIO_INTERIOR = RADIO.lamina - ESPACIO.interno;

// El velo que oscurece la pantalla de atrás. Más oscuro que el de Paper: sobre
// un mapa claro, un velo tenue deja que las calles compitan con la ficha.
const VELO_FONDO = 'rgba(4, 7, 14, 0.74)';

type Icono = keyof typeof MaterialCommunityIcons.glyphMap;

interface Props {
  visible: boolean;
  conductor: Usuario | null;
  bus?: Bus;
  rutaNombre: string | null;
  // El hijo al que lleva hoy: "LLEVA A ANA HOY" dice más que "CONDUCTOR"
  ninoNombre?: string;
  // QUIÉN ESTÁ MIRANDO. La misma ficha la abre el padre desde su inicio y el
  // admin desde el monitoreo; lo único que cambia son los textos, porque la
  // pregunta es otra: el padre quiere reconocer el bus que viene por su hijo,
  // el admin quiere saber a quién llamar por esta ruta hoy.
  vista?: 'padre' | 'admin';
  // Solo para el admin: si hoy la maneja un suplente y a quién está cubriendo
  esSuplente?: boolean;
  titularNombre?: string;
  onCerrar: () => void;
  onEscribir: (conductor: Usuario) => void;
}

export default function FichaConductor({
  visible,
  conductor,
  bus,
  rutaNombre,
  ninoNombre,
  vista = 'padre',
  esSuplente,
  titularNombre,
  onCerrar,
  onEscribir,
}: Props) {
  const tema = useTheme();
  const insets = useSafeAreaInsets();
  // El valor que mueve la hoja hacia arriba y hacia abajo. `useAnimatedValue`
  // lo crea UNA vez y lo conserva mientras la pantalla está montada (es la forma
  // que recomienda React Native; el viejo `useRef(new Animated.Value()).current`
  // hace lo mismo pero confunde a las reglas del compilador de React).
  const desplazamiento = useAnimatedValue(DESPLAZAMIENTO_ENTRADA);

  // --- La entrada: la hoja sube un poco mientras aparece ---
  // El fundido lo pone el Modal de Paper; acá solo se agrega el movimiento. Si
  // el teléfono tiene activado "reducir movimiento" (accesibilidad), la hoja
  // aparece quieta, sin subir.
  useEffect(() => {
    if (!visible) return;
    let cancelado = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reducir) => {
        if (cancelado) return;
        if (reducir) {
          desplazamiento.setValue(0);
          return;
        }
        desplazamiento.setValue(DESPLAZAMIENTO_ENTRADA);
        Animated.timing(desplazamiento, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    return () => {
      cancelado = true;
    };
  }, [visible, desplazamiento]);

  // --- Deslizar hacia abajo para cerrar ---
  // Se engancha a la parte de arriba de la hoja (el asa y la foto), no a los
  // botones, para que un toque en "Llamar" nunca se confunda con un arrastre.
  // Si se la suelta antes de la distancia (o sin velocidad), vuelve a su lugar.
  const arrastre = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evento, gesto) =>
          gesto.dy > 6 && Math.abs(gesto.dy) > Math.abs(gesto.dx),
        onPanResponderMove: (_evento, gesto) => desplazamiento.setValue(Math.max(0, gesto.dy)),
        onPanResponderRelease: (_evento, gesto) => {
          if (gesto.dy > DISTANCIA_PARA_CERRAR || gesto.vy > VELOCIDAD_PARA_CERRAR) {
            Animated.timing(desplazamiento, {
              toValue: 700,
              duration: 180,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }).start(() => onCerrar());
          } else {
            Animated.spring(desplazamiento, {
              toValue: 0,
              bounciness: 4,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () =>
          Animated.spring(desplazamiento, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [desplazamiento, onCerrar]
  );

  if (!conductor) return null;

  const telefono = conductor.telefono?.trim();
  const placa = bus?.placa;
  const primerNombreNino = ninoNombre?.trim().split(' ')[0];

  const llamar = () => {
    if (telefono) Linking.openURL(`tel:${telefono}`).catch(() => {});
  };

  // El rótulo chico de arriba del nombre: lo primero que ubica de quién se está
  // hablando y por qué aparece en esta pantalla
  const etiqueta =
    vista === 'admin'
      ? esSuplente
        ? 'SUPLENTE DE HOY'
        : 'CONDUCTOR DE LA RUTA'
      : primerNombreNino
        ? `LLEVA A ${primerNombreNino.toUpperCase()} HOY`
        : 'CONDUCTOR DE LA RUTA';

  // El renglón de contexto del final. Al padre le dice PARA QUÉ sirve todo lo
  // de arriba (reconocer el bus en la calle). Al admin le dice lo único que no
  // está en la fila del monitoreo: a quién está cubriendo hoy este conductor.
  const pista: { icono: Icono; texto: string } | null =
    vista === 'admin'
      ? esSuplente
        ? {
            icono: 'account-switch',
            texto: `Hoy cubre a ${titularNombre ?? 'el conductor titular'}.`,
          }
        : null
      : bus?.foto
        ? {
            icono: 'eye-outline',
            texto: 'Compará la foto y la placa con el bus que llega a tu parada.',
          }
        : placa
          ? { icono: 'eye-outline', texto: 'Fijate en la placa del bus que llega a tu parada.' }
          : null;

  const datos: { icono: Icono; etiqueta: string; valor: string }[] = [];
  if (rutaNombre) datos.push({ icono: 'map-marker-path', etiqueta: 'Ruta', valor: rutaNombre });
  if (bus?.capacidad) {
    datos.push({ icono: 'seat-passenger', etiqueta: 'Capacidad', valor: `${bus.capacidad} asientos` });
  }

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onCerrar}
        // El Modal de Paper centra su contenido y reserva los bordes seguros:
        // acá se lo lleva abajo, y el borde de abajo lo maneja la propia hoja
        style={styles.envoltorio}
        theme={{ colors: { backdrop: VELO_FONDO } }}
      >
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.hoja,
            {
              marginBottom: insets.bottom + ESPACIO.interno,
              transform: [{ translateY: desplazamiento }],
            },
          ]}
        >
          <Vidrio nivel="superpuesto" radio={RADIO.lamina} elevado sinRelleno>
            <View style={styles.cuerpo}>
              {/* ============ 1. LA UNIDAD (y la zona para arrastrar) ============ */}
              <View {...arrastre.panHandlers}>
                <View
                  style={styles.zonaAsa}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <View style={styles.asa} />
                </View>

                <View style={[styles.portada, !bus?.foto && styles.portadaSinFoto]}>
                  {bus?.foto ? (
                    <>
                      <Image
                        source={{ uri: bus.foto }}
                        style={StyleSheet.absoluteFill}
                        resizeMode="cover"
                        accessibilityLabel={`Foto de la unidad${placa ? ` ${placa}` : ''}`}
                      />
                      {/* Velo arriba: la placa y la X van en blanco sobre una foto
                          que puede ser muy clara (un bus amarillo al sol) */}
                      <LinearGradient
                        colors={['rgba(10, 14, 24, 0.6)', 'rgba(10, 14, 24, 0)']}
                        style={styles.veloSuperior}
                        pointerEvents="none"
                      />
                    </>
                  ) : (
                    // Sin foto cargada: se degrada con dignidad, sin hueco vacío,
                    // y la placa sigue siendo lo más visible
                    <>
                      <LinearGradient
                        colors={['rgba(37, 99, 235, 0.24)', 'rgba(37, 99, 235, 0.04)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                        pointerEvents="none"
                      />
                      <MaterialCommunityIcons name="bus-school" size={44} color={tema.colors.primary} />
                      <Text variant="bodySmall" style={estilosBase.tenue}>
                        La unidad todavía no tiene foto
                      </Text>
                    </>
                  )}

                  {/* La placa, como se nombra la unidad por radio y como se la
                      reconoce en la calle. En la fuente de cifras. */}
                  {!!placa && (
                    <View style={styles.placa} accessibilityLabel={`Unidad ${placa}`}>
                      <Text variant="labelSmall" style={styles.placaEtiqueta}>
                        UNIDAD
                      </Text>
                      <Text style={styles.placaNumero}>{placa}</Text>
                    </View>
                  )}

                  <TouchableRipple
                    onPress={onCerrar}
                    borderless
                    hitSlop={8}
                    style={styles.cerrar}
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar la ficha"
                  >
                    <MaterialCommunityIcons name="close" size={20} color="#FFFFFF" />
                  </TouchableRipple>
                </View>
              </View>

              {/* ============ 2. LA PERSONA ============ */}
              <View style={styles.identidad}>
                <View
                  style={styles.anillo}
                  accessible
                  accessibilityLabel={`Foto de ${conductor.nombre}`}
                >
                  {conductor.foto ? (
                    <Avatar.Image size={TAMANO_AVATAR} source={{ uri: conductor.foto }} />
                  ) : (
                    <Avatar.Text
                      size={TAMANO_AVATAR}
                      label={conductor.nombre.trim().charAt(0).toUpperCase() || '?'}
                      style={{ backgroundColor: ZAFIRO }}
                      color="#FFFFFF"
                    />
                  )}
                </View>
                <View style={styles.textoIdentidad}>
                  <Text variant="labelSmall" style={{ color: tema.colors.primary }}>
                    {etiqueta}
                  </Text>
                  <Text variant="headlineSmall" numberOfLines={2}>
                    {conductor.nombre}
                  </Text>
                  {!!telefono && (
                    <Text variant="bodyMedium" style={[estilosBase.cifra, estilosBase.tenue]}>
                      {telefono}
                    </Text>
                  )}
                </View>
              </View>

              {/* ============ 3. LOS DATOS ============ */}
              {datos.length > 0 && (
                <View style={styles.filaDatos}>
                  {datos.map((dato) => (
                    <View key={dato.etiqueta} style={styles.dato}>
                      <View style={styles.encabezadoDato}>
                        <MaterialCommunityIcons
                          name={dato.icono}
                          size={14}
                          color={tema.colors.onSurfaceVariant}
                        />
                        <Text variant="labelMedium" style={estilosBase.tenue}>
                          {dato.etiqueta.toUpperCase()}
                        </Text>
                      </View>
                      <Text variant="titleSmall" numberOfLines={2}>
                        {dato.valor}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Para qué sirve todo lo de arriba, dicho en una línea */}
              {!!pista && (
                <View style={styles.pista}>
                  <MaterialCommunityIcons
                    name={pista.icono}
                    size={16}
                    color={tema.colors.onSurfaceVariant}
                  />
                  <Text variant="bodySmall" style={[estilosBase.tenue, styles.textoPista]}>
                    {pista.texto}
                  </Text>
                </View>
              )}

              {/* ============ 4. LAS ACCIONES ============ */}
              <View style={styles.acciones}>
                {!!telefono && (
                  <View style={styles.accion}>
                    <BotonPrincipal
                      texto="Llamar"
                      icono="phone"
                      onPress={llamar}
                      accesibilidad={`Llamar a ${conductor.nombre} al ${telefono}`}
                    />
                  </View>
                )}
                <View style={styles.accion}>
                  <BotonPrincipal
                    texto="Escribir"
                    icono="message-text"
                    // Sin teléfono cargado, escribir pasa a ser la acción principal
                    tono={telefono ? 'suave' : 'principal'}
                    onPress={() => onEscribir(conductor)}
                    accesibilidad={`Escribirle a ${conductor.nombre}`}
                  />
                </View>
              </View>
            </View>
          </Vidrio>
        </Animated.View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  // Lleva la hoja al pie de la pantalla (el Modal de Paper la centra)
  envoltorio: { justifyContent: 'flex-end', marginBottom: 0 },
  // Separada de los bordes y con ancho tope: en una tablet no se estira de
  // punta a punta
  hoja: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: ESPACIO.interno,
  },
  cuerpo: { padding: ESPACIO.interno, gap: ESPACIO.interno },

  // --- 1. La unidad ---
  zonaAsa: { alignItems: 'center', paddingBottom: ESPACIO.minimo + 2 },
  asa: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.28)' },
  portada: {
    height: 176,
    borderRadius: RADIO_INTERIOR,
    overflow: 'hidden',
    backgroundColor: OBSIDIANA_PROFUNDA,
    alignItems: 'center',
    justifyContent: 'center',
    gap: ESPACIO.minimo,
  },
  portadaSinFoto: { height: 136, borderWidth: 1, borderColor: VIDRIO.borde },
  veloSuperior: { position: 'absolute', top: 0, left: 0, right: 0, height: 76 },
  placa: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIO.pastilla,
    backgroundColor: VIDRIO_OSCURO,
    borderWidth: 1,
    borderColor: VIDRIO.bordeFuerte,
  },
  placaEtiqueta: { color: 'rgba(255, 255, 255, 0.72)' },
  placaNumero: {
    color: '#FFFFFF',
    fontFamily: FUENTES.titularFuerte,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  // 40 px de círculo más 8 de hitSlop por lado: el área que se toca supera los
  // 48 px que pide Android
  cerrar: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: VIDRIO_OSCURO,
    borderWidth: 1,
    borderColor: VIDRIO.bordeFuerte,
  },

  // --- 2. La persona ---
  // El margen negativo cancela el espacio entre bloques y sube la fila para que
  // la foto del conductor se monte sobre el borde de la foto de la unidad
  identidad: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginTop: -(ESPACIO.interno + SOLAPE_AVATAR),
    paddingHorizontal: ESPACIO.minimo,
  },
  // El aro del color de la lámina separa la foto de la persona de la de la unidad
  anillo: {
    padding: 3,
    borderRadius: RADIO.pastilla,
    backgroundColor: '#1B2131',
    ...SOMBRA_TARJETA,
  },
  // El texto arranca debajo de la foto de la unidad, nunca encima
  textoIdentidad: { flex: 1, gap: 2, marginTop: SOLAPE_AVATAR + 8 },

  // --- 3. Los datos ---
  filaDatos: { flexDirection: 'row', gap: ESPACIO.minimo + 2 },
  dato: {
    flex: 1,
    gap: 4,
    padding: ESPACIO.interno,
    borderRadius: RADIO.control,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: VIDRIO.borde,
  },
  encabezadoDato: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pista: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  textoPista: { flex: 1 },

  // --- 4. Las acciones ---
  acciones: { flexDirection: 'row', gap: 10, marginTop: 2 },
  accion: { flex: 1 },
});
