import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { PaperProvider } from 'react-native-paper';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/context/AuthContext';
import { navegacionClara, navegacionOscura, temaClaro, temaOscuro } from '@/constants/tema';

// Fase 6: cómo mostrar una notificación que llega con la app ABIERTA.
// En segundo plano el sistema la muestra solo; en primer plano hay que
// pedirlo explícitamente, si no el aviso se pierde en silencio.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const esOscuro = colorScheme === 'dark';

  return (
    <AuthProvider>
      <PaperProvider theme={esOscuro ? temaOscuro : temaClaro}>
        <ThemeProvider value={esOscuro ? navegacionOscura : navegacionClara}>
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style="auto" />
        </ThemeProvider>
      </PaperProvider>
    </AuthProvider>
  );
}
