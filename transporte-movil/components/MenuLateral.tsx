import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Divider, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter, type Href } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { ESPACIO, RADIO } from '@/constants/estilos';

// ============================================
// MENÚ LATERAL — la navegación de toda la app
// ============================================
// Reemplaza a la barra de pestañas de abajo: se abre con el botón ☰ de la
// esquina izquierda del encabezado y muestra TODAS las secciones del rol.
//
// Por qué un panel propio y no una librería de "drawer": agregar
// @react-navigation/drawer sumaba una dependencia nueva al proyecto para algo
// que acá son 100 líneas — un Modal transparente y una animación de
// desplazamiento. Además así el menú se ve exactamente igual en Android y en
// iOS y Derek puede explicar cada línea.

const ANCHO_MAXIMO = 320;

interface Destino {
  etiqueta: string;
  icono: keyof typeof MaterialCommunityIcons.glyphMap;
  // Href y no string: Expo Router valida en tiempo de compilación que la ruta
  // exista de verdad (rutas tipadas), así un enlace roto no llega al teléfono
  ruta: Href;
}

// Las secciones de cada rol. El padre navega entre sus cosas; el conductor
// tiene una sola pantalla operativa (su ruta del día) más mensajes.
const DESTINOS_PADRE: Destino[] = [
  { etiqueta: 'Inicio', icono: 'home-variant', ruta: '/hijos' },
  { etiqueta: 'Mensajes', icono: 'message-text', ruta: '/mensajes' },
  { etiqueta: 'Avisos', icono: 'bullhorn', ruta: '/canales' },
  { etiqueta: 'Solicitudes', icono: 'file-document-edit', ruta: '/solicitudes' },
  { etiqueta: 'Configuración', icono: 'cog', ruta: '/configuracion' },
];

const DESTINOS_CONDUCTOR: Destino[] = [
  { etiqueta: 'Mi ruta de hoy', icono: 'bus', ruta: '/hoy' },
  { etiqueta: 'Mensajes', icono: 'message-text', ruta: '/mensajes' },
  { etiqueta: 'Configuración', icono: 'cog', ruta: '/configuracion' },
];

export default function MenuLateral({
  visible,
  onCerrar,
}: {
  visible: boolean;
  onCerrar: () => void;
}) {
  const tema = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const rutaActual = usePathname();
  const { usuario, logout } = useAuth();

  const ancho = Math.min(Dimensions.get('window').width * 0.82, ANCHO_MAXIMO);

  // El panel entra deslizándose desde la izquierda y el fondo se oscurece.
  // useNativeDriver: la animación corre en el hilo nativo, así no se traba
  // aunque la pantalla de atrás esté cargando datos.
  const desplazamiento = useRef(new Animated.Value(-ancho)).current;
  const opacidadFondo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(desplazamiento, {
        toValue: visible ? 0 : -ancho,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacidadFondo, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, ancho, desplazamiento, opacidadFondo]);

  const destinos = usuario?.rol === 'conductor' ? DESTINOS_CONDUCTOR : DESTINOS_PADRE;

  const ir = (ruta: Href) => {
    onCerrar();
    // replace y no push: el menú cambia de sección, no apila pantallas — así el
    // botón físico "atrás" del teléfono no recorre todo lo que el usuario visitó
    if (ruta !== rutaActual) router.replace(ruta);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCerrar} statusBarTranslucent>
      {/* Fondo oscuro: tocarlo cierra el menú */}
      <Animated.View style={[styles.fondo, { opacity: opacidadFondo }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} accessibilityLabel="Cerrar menú" />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            width: ancho,
            paddingTop: insets.top + ESPACIO.pantalla,
            paddingBottom: insets.bottom + ESPACIO.interno,
            backgroundColor: tema.colors.surface,
            transform: [{ translateX: desplazamiento }],
          },
        ]}
      >
        {/* Quién está usando la app */}
        <TouchableRipple onPress={() => ir('/configuracion')} style={styles.bloqueUsuario}>
          <View style={styles.filaUsuario}>
            {usuario?.foto ? (
              <Avatar.Image size={52} source={{ uri: usuario.foto }} />
            ) : (
              <Avatar.Text
                size={52}
                label={usuario?.nombre.trim().charAt(0).toUpperCase() || '?'}
                style={{ backgroundColor: tema.colors.primaryContainer }}
                color={tema.colors.onPrimaryContainer}
              />
            )}
            <View style={styles.datosUsuario}>
              <Text variant="titleMedium" numberOfLines={1} style={styles.negrita}>
                {usuario?.nombre ?? ''}
              </Text>
              <Text variant="bodySmall" style={styles.tenue}>
                {usuario?.rol === 'conductor' ? 'Conductor' : 'Padre de familia'}
              </Text>
            </View>
          </View>
        </TouchableRipple>

        <Divider style={styles.divisor} />

        <ScrollView contentContainerStyle={styles.lista}>
          {destinos.map((destino) => {
            const activo = rutaActual === destino.ruta;
            return (
              <TouchableRipple
                key={destino.etiqueta}
                onPress={() => ir(destino.ruta)}
                style={[
                  styles.item,
                  activo && { backgroundColor: tema.colors.primaryContainer },
                ]}
                borderless
              >
                <View style={styles.filaItem}>
                  <MaterialCommunityIcons
                    name={destino.icono}
                    size={22}
                    color={activo ? tema.colors.onPrimaryContainer : tema.colors.onSurfaceVariant}
                  />
                  <Text
                    variant="bodyLarge"
                    style={{
                      color: activo ? tema.colors.onPrimaryContainer : tema.colors.onSurface,
                      fontWeight: activo ? '700' : '400',
                    }}
                  >
                    {destino.etiqueta}
                  </Text>
                </View>
              </TouchableRipple>
            );
          })}
        </ScrollView>

        <Divider style={styles.divisor} />

        <TouchableRipple
          onPress={() => {
            onCerrar();
            logout();
          }}
          style={styles.item}
          borderless
        >
          <View style={styles.filaItem}>
            <MaterialCommunityIcons name="logout" size={22} color={tema.colors.error} />
            <Text variant="bodyLarge" style={{ color: tema.colors.error }}>
              Cerrar sesión
            </Text>
          </View>
        </TouchableRipple>

        <Text variant="bodySmall" style={[styles.tenue, styles.pie]}>
          Transportes Perez
        </Text>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(9, 20, 38, 0.45)' },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderTopRightRadius: RADIO.tarjeta,
    borderBottomRightRadius: RADIO.tarjeta,
    paddingHorizontal: ESPACIO.interno,
  },
  bloqueUsuario: { borderRadius: RADIO.control, padding: ESPACIO.interno },
  filaUsuario: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
  datosUsuario: { flex: 1, gap: 2 },
  negrita: { fontWeight: '700' },
  tenue: { opacity: 0.6 },
  divisor: { marginVertical: ESPACIO.interno },
  lista: { gap: 4 },
  item: { borderRadius: RADIO.control, paddingVertical: 14, paddingHorizontal: ESPACIO.interno },
  filaItem: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  pie: { textAlign: 'center', paddingTop: ESPACIO.interno },
});
