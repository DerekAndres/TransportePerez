import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { Redirect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';

// Pantalla "despachadora": según quién esté logueado, redirige a su sección.
export default function IndexScreen() {
  const { usuario, cargando, logout } = useAuth();

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!usuario) {
    return <Redirect href="/login" />;
  }

  // Cuenta recién invitada: primero define su contraseña y completa sus datos.
  // Cubre los dos caminos de entrada: canjear el código en "Registrarse" o
  // entrar por el login normal tras el correo de restablecer contraseña.
  if (usuario.debeCompletarPerfil) {
    return <Redirect href="/completar-perfil" />;
  }

  if (usuario.rol === 'conductor') {
    return <Redirect href="/hoy" />;
  }

  if (usuario.rol === 'padre') {
    return <Redirect href="/hijos" />;
  }

  // rol === 'admin': la app móvil no es para administradores
  return (
    <View style={styles.centrado}>
      <Text variant="titleMedium" style={styles.aviso}>
        Los administradores usan el panel web.
      </Text>
      <Text variant="bodyMedium" style={styles.aviso}>
        Esta app es para conductores y padres.
      </Text>
      <Button mode="contained" onPress={() => logout()} style={styles.boton}>
        Cerrar sesión
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  centrado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  aviso: {
    textAlign: 'center',
  },
  boton: {
    marginTop: 12,
  },
});
