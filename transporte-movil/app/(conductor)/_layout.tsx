import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import {
  registrarTokenPush,
  reintentarAvisosPendientes,
} from '@/services/notificacionesService';

// Layout protegido: solo un conductor logueado puede ver las pantallas de este grupo.
//
// Es un Stack plano, sin barra de pestañas: igual que en el grupo del padre, la
// navegación entre secciones vive en el MENÚ LATERAL del encabezado
// (components/PantallaBase.tsx). Al conductor le deja la pantalla entera para
// la lista de asistencia, que es lo único que usa mientras maneja.
export default function ConductorLayout() {
  const { usuario, cargando } = useAuth();
  const uid = usuario?.rol === 'conductor' ? usuario.id : null;

  // Fase 6: al entrar, registrar el token push del conductor (le servirá para
  // recibir mensajes del chat en la Fase 7)
  useEffect(() => {
    if (!uid) return;
    registrarTokenPush(uid).catch(() => {});
    // Al abrir la app se reintentan los avisos que no salieron por falta de
    // señal en la ruta (ver COLA DE AVISOS PENDIENTES en notificacionesService).
    // Es el caso más común de los tres roles: el bus pierde cobertura seguido.
    reintentarAvisosPendientes().catch(() => {});
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

  if (usuario.rol !== 'conductor') {
    return <Redirect href="/" />;
  }

  // Misma transición deslizante que en el grupo del padre, para que la app se
  // sienta igual en los dos roles
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}

const styles = StyleSheet.create({
  centrado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
