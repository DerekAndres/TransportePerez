import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  Button,
  HelperText,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { Redirect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import Campo from '@/components/Campo';
import { enviarRecuperacionPassword } from '@/services/authService';
import { ESPACIO, RADIO, SOMBRA_TARJETA, fondoTarjeta } from '@/constants/estilos';

export default function LoginScreen() {
  const { usuario, cargando, login } = useAuth();
  const tema = useTheme();

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
    <KeyboardAvoidingView
      style={styles.contenedor}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Encabezado de marca: azul con el bus, y la franja roja de bus escolar */}
        <View style={[styles.encabezado, { backgroundColor: tema.colors.primary }]}>
          <Avatar.Icon
            size={84}
            icon="bus-school"
            style={{ backgroundColor: tema.colors.onPrimary }}
            color={tema.colors.primary}
          />
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
        <View style={[styles.franjaRoja, { backgroundColor: tema.colors.tertiary }]} />

        <View style={[styles.tarjeta, { backgroundColor: fondoTarjeta(tema) }]}>
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
    </KeyboardAvoidingView>
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
  encabezado: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 96,
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  titulo: {
    fontWeight: '700',
  },
  lema: {
    opacity: 0.85,
  },
  franjaRoja: {
    height: 6,
  },
  tarjeta: {
    margin: ESPACIO.pantalla,
    marginTop: 28,
    padding: ESPACIO.pantalla,
    borderRadius: RADIO.tarjeta,
    gap: 8,
    ...SOMBRA_TARJETA,
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
