import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import Campo from '@/components/Campo';
import { useAlturaTeclado } from '@/hooks/use-teclado';
import { enviarRecuperacionPassword } from '@/services/authService';
import { ESPACIO, RADIO, SOMBRA_TARJETA, fondoTarjeta } from '@/constants/estilos';
import { FRANJA_TROPICAL } from '@/constants/tema';

export default function LoginScreen() {
  const { usuario, cargando, login } = useAuth();
  const tema = useTheme();
  const insets = useSafeAreaInsets();
  const altoTeclado = useAlturaTeclado();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Si ya hay sesión, index.tsx decide a qué grupo mandarlo según su rol
  if (usuario) {
    return <Redirect href="/" />;
  }

  const handleLogin = async () => {
    setError('');
    setAviso('');
    setEnviando(true);
    try {
      await login(email.trim(), password);
    } catch {
      setError('Correo o contraseña incorrectos.');
    } finally {
      setEnviando(false);
    }
  };

  // Recuperar contraseña: Firebase manda el correo de restablecimiento al
  // correo escrito arriba (el mismo flujo con el que se entregan las cuentas)
  const olvidePassword = async () => {
    setError('');
    setAviso('');
    if (!email.trim()) {
      setError('Escribí tu correo arriba y volvé a tocar el enlace.');
      return;
    }
    try {
      await enviarRecuperacionPassword(email);
      setAviso(`Te enviamos un correo a ${email.trim()} para definir tu contraseña.`);
    } catch {
      setError('No se pudo enviar el correo. Verificá que esté bien escrito.');
    }
  };

  return (
    <View style={styles.contenedor}>
      {/* El espacio de abajo crece con el teclado, así el botón "Ingresar"
          siempre se puede alcanzar desplazando, en cualquier teléfono */}
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + altoTeclado },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Encabezado de marca: coral con el bus, y la franja tropical de la marca.
            El alto de arriba lo marca el sistema (notch / barra de estado). */}
        <View
          style={[
            styles.encabezado,
            { backgroundColor: tema.colors.primary, paddingTop: insets.top + 52 },
          ]}
        >
          {/* El logo va sobre un marco BLANCO a proposito: el encabezado es
              azul y el logo tambien tiene fondo azul, asi que sin el marco uno
              se fundiria con el otro. El blanco lo recorta y lo hace leer como
              una placa, igual que el icono en la pantalla del telefono. */}
          <View style={[styles.marcoLogo, { backgroundColor: tema.colors.onPrimary }]}>
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Inversiones Perez, transporte escolar"
            />
          </View>
          <Text
            variant="headlineMedium"
            style={[styles.titulo, { color: tema.colors.onPrimary }]}
          >
            Transportes Perez
          </Text>
          <Text variant="bodyMedium" style={[styles.lema, { color: tema.colors.onPrimary }]}>
            Transporte escolar · La Ceiba, Atlántida
          </Text>
        </View>
        {/* Franja de marca coral · mango · aqua, como la pintada de un bus */}
        <View style={styles.franja}>
          {FRANJA_TROPICAL.map((color) => (
            <View key={color} style={[styles.tramoFranja, { backgroundColor: color }]} />
          ))}
        </View>

        <View style={[styles.tarjeta, { backgroundColor: fondoTarjeta(tema), borderColor: tema.colors.outlineVariant }]}>
          <Text variant="titleLarge" style={styles.tituloFormulario}>
            Iniciar sesión
          </Text>
          <Text variant="bodySmall" style={styles.ayuda}>
            Ingresá con el correo que registró la administración.
          </Text>

          <Campo
            label="Correo"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            left={<TextInput.Icon icon="email-outline" />}
          />

          <Campo
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!verPassword}
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={verPassword ? 'eye-off' : 'eye'}
                onPress={() => setVerPassword((v) => !v)}
                forceTextInputFocus={false}
              />
            }
          />

          <HelperText type="error" visible={!!error}>
            {error}
          </HelperText>
          <HelperText type="info" visible={!!aviso}>
            {aviso}
          </HelperText>

          <Button
            mode="contained"
            icon="login"
            onPress={handleLogin}
            loading={enviando}
            disabled={enviando}
            contentStyle={styles.contenidoBoton}
          >
            Ingresar
          </Button>

          <Button mode="text" onPress={olvidePassword} disabled={enviando}>
            ¿Olvidaste tu contraseña?
          </Button>
        </View>

        {/* No hay registro público: las cuentas las crea la administración y
            Firebase envía el correo para definir la contraseña. */}
        <Text variant="bodySmall" style={styles.ayudaRegistro}>
          ¿Primera vez? Cuando la administración registre tu correo, vas a recibir un
          mensaje para crear tu contraseña.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  centrado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // El marco blanco y el logo comparten redondez, como el icono de la app
  marcoLogo: { padding: 8, borderRadius: 26 },
  logo: { width: 92, height: 92, borderRadius: 18 },
  encabezado: {
    alignItems: 'center',
    gap: 10,
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  titulo: {
    fontWeight: '700',
  },
  lema: {
    opacity: 0.85,
  },
  franja: {
    flexDirection: 'row',
    height: 6,
  },
  tramoFranja: { flex: 1 },
  tarjeta: {
    margin: ESPACIO.pantalla,
    marginTop: 28,
    padding: ESPACIO.pantalla,
    borderRadius: RADIO.tarjeta,
    gap: 8,
    ...SOMBRA_TARJETA,
    borderWidth: 1,
  },
  tituloFormulario: {
    fontWeight: '700',
  },
  ayuda: {
    opacity: 0.6,
    marginBottom: 8,
  },
  contenidoBoton: {
    paddingVertical: 6,
  },
  ayudaRegistro: {
    marginHorizontal: 28,
    marginBottom: 32,
    opacity: 0.6,
    textAlign: 'center',
  },
});
