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
import { reintentarRegistrosPendientes } from '@/services/colaRegistros';
import CargandoBus from '@/components/CargandoBus';

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
    // Y las marcas de asistencia que quedaron guardadas en el teléfono sin
    // llegar al servidor (ver colaRegistros.ts)
    reintentarRegistrosPendientes().catch(() => {});
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

  if (usuario.rol !== 'conductor') {
    return <Redirect href="/" />;
  }

  // Por defecto, la transición APILADA; las pantallas de sección (las de
  // la barra de abajo) se cruzan con un fundido. Ver constants/navegacion.ts
  return (
    <Stack screenOptions={{ headerShown: false, ...TRANSICION_APILADA }}>
      <Stack.Screen name="hoy" options={TRANSICION_SECCION} />
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
