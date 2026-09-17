import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// ⚠️ CADA PESO SE IMPORTA DE SU PROPIA SUBCARPETA, NO DEL PAQUETE ENTERO.
// `import { Outfit_500Medium } from '@expo-google-fonts/outfit'` parece más
// prolijo, pero el índice del paquete hace `require` de LOS NUEVE pesos, y
// Metro no los descarta: terminan los nueve adentro del APK aunque se usen
// tres. Medido en este proyecto, la diferencia era de 16 archivos de fuente a
// 7 — cerca de un mega de APK de más, justo en los teléfonos de gama baja que
// tienen los padres (CLAUDE.md §2).
import { Outfit_500Medium } from '@expo-google-fonts/outfit/500Medium';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PaperProvider, Text } from 'react-native-paper';
import 'react-native-reanimated';
// Define la tarea de GPS en segundo plano al arrancar la app: Android la busca
// por nombre cuando la despierta durante un viaje (ver services/gpsViaje.ts)
import '@/services/gpsViaje';

import { useNavegacionPorNotificacion } from '@/hooks/use-navegacion-notificacion';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CONFIGURACION_COMPLETA, CREDENCIALES_FALTANTES } from '@/services/firebase';
import { tema, temaNavegacion } from '@/constants/tema';
import { TRANSICION_APILADA, TRANSICION_SECCION } from '@/constants/navegacion';

// Fase 6: cómo mostrar una notificación que llega con la app ABIERTA.
// En segundo plano y con la app cerrada la muestra el sistema operativo solo
// (por eso los avisos llegan igual); en primer plano hay que pedirlo
// explícitamente, si no el aviso se pierde en silencio.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Cuánto se espera a las fuentes antes de arrancar igual con la del sistema.
// Cuatro segundos: más que de sobra para leer siete archivos del propio
// paquete, y poco como para que nadie crea que la app se colgó.
const ESPERA_MAXIMA_FUENTES = 4000;

// La pantalla de arranque se queda puesta hasta que estén cargadas las fuentes.
// Sin esto, la app se dibuja un instante con la letra del sistema y salta a la
// letra propia cuando termina de cargarla — un parpadeo feo y evitable.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Escucha el toque sobre una notificación y abre la pantalla que corresponde.
// Va en un componente aparte porque necesita `useAuth`, que solo existe dentro
// del AuthProvider — y esperar a la sesión evita rebotar al login.
function NavegacionPorNotificacion() {
  const { usuario, cargando } = useAuth();
  useNavegacionPorNotificacion(!cargando && !!usuario);
  return null;
}

export default function RootLayout() {
  // ============================================
  // LAS FUENTES DE LA IDENTIDAD
  // ============================================
  // Se carga UN archivo por cada peso que la app usa de verdad, y ni uno más:
  // cada archivo suma al tamaño del APK y a lo que tarda el arranque. Los pesos
  // salen de la escala tipográfica de constants/tema.ts.
  //
  // OUTFIT — titulares y cifras (la geométrica, "de tablero de auto")
  // PLUS JAKARTA SANS — texto corrido y controles (la humanista, la que se lee)
  //
  // La clave de cada entrada es el nombre con el que después se pide la fuente
  // en `fontFamily`. Por eso en el tema no se usa nunca `fontWeight`: el grosor
  // ES el nombre de la familia (la explicación completa está en tema.ts).
  const [fuentesListas, errorFuentes] = useFonts({
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  // ⚠️ LA APP TIENE QUE ARRANCAR SÍ O SÍ, CARGUEN O NO LAS FUENTES.
  // Si una fuente no carga, se arranca con la letra del sistema: se ve
  // distinta, pero funciona. Quedarse en la pantalla de arranque para siempre
  // por una tipografía sería mucho peor, y es una falla real y silenciosa —
  // `useFonts` puede no resolver nunca si el paquete de assets no llega (por
  // ejemplo, con el teléfono conectado por LAN a un Metro que se cayó).
  //
  // Por eso hay DOS salidas: que las fuentes terminen (bien o mal), o que se
  // acabe el tiempo. Sin la segunda, un problema de red deja al usuario
  // mirando la pantalla de arranque sin ninguna explicación.
  const [seAcaboLaEspera, setSeAcaboLaEspera] = useState(false);

  useEffect(() => {
    const reloj = setTimeout(() => setSeAcaboLaEspera(true), ESPERA_MAXIMA_FUENTES);
    return () => clearTimeout(reloj);
  }, []);

  const puedeArrancar = fuentesListas || !!errorFuentes || seAcaboLaEspera;

  useEffect(() => {
    if (puedeArrancar) SplashScreen.hideAsync().catch(() => {});
  }, [puedeArrancar]);

  if (!puedeArrancar) return null;

  // Si el APK se compiló sin las credenciales de Firebase, la app no puede
  // hacer absolutamente nada: no hay login ni datos. En vez de cerrarse sola
  // (que es lo que pasaba y no decía nada), lo dice.
  if (!CONFIGURACION_COMPLETA) {
    return (
      <PaperProvider theme={tema}>
        <View style={[styles.aviso, { backgroundColor: tema.colors.background }]}>
          <Text variant="headlineSmall" style={styles.centrado}>
            Falta configuración
          </Text>
          <Text variant="bodyMedium" style={styles.centrado}>
            Esta versión de la app se compiló sin las credenciales de Firebase, así que no puede
            conectarse. Avisale a la administración.
          </Text>
          <Text variant="bodySmall" style={[styles.centrado, styles.detalle]}>
            Faltan: {CREDENCIALES_FALTANTES.join(', ')}
          </Text>
        </View>
        <StatusBar style="light" />
      </PaperProvider>
    );
  }

  return (
    <AuthProvider>
      {/* UN SOLO TEMA, OSCURO. El design system elegido ("Liquid Obsidian &
          Specular Glass") es oscuro y no trae contraparte clara: inventarle una
          sería inventar diseño, no aplicarlo. Por eso la app ya no sigue el modo
          del teléfono — y `userInterfaceStyle: "dark"` en app.json hace que las
          barras del sistema tampoco parpadeen en blanco al arrancar. */}
      <PaperProvider theme={tema}>
        <ThemeProvider value={temaNavegacion}>
          {/* Por defecto la transición apilada (el chat, "completar perfil").
              El despachador y el login se cruzan con un fundido: entrar o salir
              de la sesión no es "ir más adentro" de ninguna pantalla, así que
              deslizar de costado ahí se sentía como un pase de diapositivas. */}
          <Stack screenOptions={{ headerShown: false, ...TRANSICION_APILADA }}>
            <Stack.Screen name="index" options={TRANSICION_SECCION} />
            <Stack.Screen name="login" options={TRANSICION_SECCION} />
          </Stack>
          <NavegacionPorNotificacion />
          {/* Sobre la obsidiana, los íconos de la barra de estado (hora, señal,
              batería) van SIEMPRE claros: "auto" los pondría negros si el
              teléfono está en modo claro y desaparecerían contra el fondo */}
          <StatusBar style="light" />
        </ThemeProvider>
      </PaperProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  aviso: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  centrado: { textAlign: 'center' },
  detalle: { opacity: 0.6 },
});
