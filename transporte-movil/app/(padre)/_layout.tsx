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
    if (!uid) return;
    registrarTokenPush(uid).catch(() => {});
    // Al abrir la app se reintenta lo que haya quedado sin enviar por falta de
    // señal (ver COLA DE AVISOS PENDIENTES en notificacionesService)
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

  // Todavía no terminó su registro: no puede entrar a la app hasta completarlo
  if (usuario.debeCompletarPerfil) {
    return <Redirect href="/completar-perfil" />;
  }

  if (usuario.rol !== 'padre') {
    return <Redirect href="/" />;
  }

  // Por defecto, la transición APILADA; las pantallas de sección (las de
  // la barra de abajo) se cruzan con un fundido. Ver constants/navegacion.ts
  return (
    <Stack screenOptions={{ headerShown: false, ...TRANSICION_APILADA }}>
      <Stack.Screen name="hijos" options={TRANSICION_SECCION} />
      <Stack.Screen name="mensajes" options={TRANSICION_SECCION} />
      <Stack.Screen name="canales" options={TRANSICION_SECCION} />
      <Stack.Screen name="solicitudes" options={TRANSICION_SECCION} />
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
