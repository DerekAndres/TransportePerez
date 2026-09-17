import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { TRANSICION_APILADA, TRANSICION_SECCION } from '@/constants/navegacion';
import {
  registrarTokenPush,
  reintentarAvisosPendientes,
} from '@/services/notificacionesService';
import CargandoBus from '@/components/CargandoBus';

// Layout protegido del ADMIN en la app móvil.
//
// Ojo con el alcance: esta sección NO administra el sistema. Crear usuarios,
// buses, escuelas, niños y rutas sigue siendo del panel web — ahí hay pantalla
// grande, teclado y mapas para armar recorridos. Acá el admin tiene solo lo que
// sirve estando en la calle: ver cómo van las rutas, contestar mensajes y
// publicar un aviso.
export default function AdminLayout() {
  const { usuario, cargando } = useAuth();
  const uid = usuario?.rol === 'admin' ? usuario.id : null;

  // Con la app instalada, el admin ahora SÍ recibe push (antes no tenía token
  // porque solo usaba la web): le llegan los mensajes de padres y conductores.
  useEffect(() => {
    if (!uid) return;
    registrarTokenPush(uid).catch(() => {});
    // Al abrir la app se reintenta lo que quedó sin enviar por falta de señal
    // (ver COLA DE AVISOS PENDIENTES en notificacionesService)
    reintentarAvisosPendientes().catch(() => {});
  }, [uid]);

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <CargandoBus />
      </View>
    );
  }

  if (!usuario) {
    return <Redirect href="/login" />;
  }

  if (usuario.debeCompletarPerfil) {
    return <Redirect href="/completar-perfil" />;
  }

  if (usuario.rol !== 'admin') {
    return <Redirect href="/" />;
  }

  // Por defecto, la transición APILADA; las pantallas de sección (las de
  // la barra de abajo) se cruzan con un fundido. Ver constants/navegacion.ts
  return (
    <Stack screenOptions={{ headerShown: false, ...TRANSICION_APILADA }}>
      <Stack.Screen name="monitoreo" options={TRANSICION_SECCION} />
      <Stack.Screen name="mensajes" options={TRANSICION_SECCION} />
      <Stack.Screen name="avisos" options={TRANSICION_SECCION} />
      <Stack.Screen name="configuracion" options={TRANSICION_SECCION} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  centrado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
