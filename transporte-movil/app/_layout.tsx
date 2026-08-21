import { StyleSheet, View } from 'react-native';
import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { PaperProvider, Text } from 'react-native-paper';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNavegacionPorNotificacion } from '@/hooks/use-navegacion-notificacion';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CONFIGURACION_COMPLETA, CREDENCIALES_FALTANTES } from '@/services/firebase';
import { navegacionClara, navegacionOscura, temaClaro, temaOscuro } from '@/constants/tema';

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

// Escucha el toque sobre una notificación y abre la pantalla que corresponde.
// Va en un componente aparte porque necesita `useAuth`, que solo existe dentro
// del AuthProvider — y esperar a la sesión evita rebotar al login.
function NavegacionPorNotificacion() {
  const { usuario, cargando } = useAuth();
  useNavegacionPorNotificacion(!cargando && !!usuario);
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const esOscuro = colorScheme === 'dark';

  // Si el APK se compiló sin las credenciales de Firebase, la app no puede
  // hacer absolutamente nada: no hay login ni datos. En vez de cerrarse sola
  // (que es lo que pasaba y no decía nada), lo dice.
  if (!CONFIGURACION_COMPLETA) {
    return (
      <PaperProvider theme={esOscuro ? temaOscuro : temaClaro}>
        <View style={[styles.aviso, { backgroundColor: temaClaro.colors.background }]}>
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
        <StatusBar style="auto" />
      </PaperProvider>
    );
  }

  return (
    <AuthProvider>
      <PaperProvider theme={esOscuro ? temaOscuro : temaClaro}>
        <ThemeProvider value={esOscuro ? navegacionOscura : navegacionClara}>
          {/* Transición deslizante también entre los grupos de rutas (login →
              inicio → chat), para que no haya cortes secos en ningún salto */}
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
          <NavegacionPorNotificacion />
          <StatusBar style="auto" />
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
