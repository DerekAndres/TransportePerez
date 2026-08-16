import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { registrarTokenPush } from '@/services/notificacionesService';

// Layout protegido: solo un padre logueado puede ver las pantallas de este grupo.
//
// Es un Stack plano, sin barra de pestañas: la navegación entre secciones vive
// ahora en el MENÚ LATERAL que abre el botón ☰ del encabezado (ver
// components/PantallaBase.tsx). Se quitó la barra de abajo porque duplicaba al
// menú y le robaba espacio a la pantalla — con el menú y los atajos del inicio
// alcanza, y la app se ve más limpia.
export default function PadreLayout() {
  const { usuario, cargando } = useAuth();
  const uid = usuario?.rol === 'padre' ? usuario.id : null;

  // Fase 6: al entrar, pedir permiso y registrar el token push del padre —
  // acá llegan los avisos de subió/bajó y "el bus está cerca"
  useEffect(() => {
    if (uid) registrarTokenPush(uid).catch(() => {});
  }, [uid]);

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

  // Todavía no terminó su registro: no puede entrar a la app hasta completarlo
  if (usuario.debeCompletarPerfil) {
    return <Redirect href="/completar-perfil" />;
  }

  if (usuario.rol !== 'padre') {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  centrado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
