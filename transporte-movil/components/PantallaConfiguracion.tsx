import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  Divider,
  HelperText,
  IconButton,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import { actualizarMiPerfil, enviarRecuperacionPassword } from '@/services/authService';
import {
  EXPLICACION_PUSH,
  enviarPruebaPush,
  registrarTokenPush,
  type EstadoPush,
} from '@/services/notificacionesService';
import { elegirFotoComprimida } from '@/utils/fotos';
import { ESPACIO, RADIO, estilosBase } from '@/constants/estilos';

// Pantalla de Configuración, compartida por padre y conductor (es idéntica para
// ambos: foto y teléfono propios, cambio de contraseña y cierre de sesión).
// El nombre, correo y rol los administra el admin — acá se muestran solamente.
export default function PantallaConfiguracion() {
  const { usuario, logout, refrescarPerfil } = useAuth();
  const tema = useTheme();

  const [telefono, setTelefono] = useState(usuario?.telefono ?? '');
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [correoEnviado, setCorreoEnviado] = useState(false);

  // --- Diagnóstico de notificaciones ---
  // Se consulta al abrir la pantalla. `registrarTokenPush` es idempotente: si
  // ya hay permiso y token, no molesta al usuario; si falta algo, devuelve
  // exactamente qué falta.
  const [estadoPush, setEstadoPush] = useState<EstadoPush | null>(null);
  const [probando, setProbando] = useState(false);
  const [resultadoPrueba, setResultadoPrueba] = useState<{ ok: boolean; mensaje: string } | null>(
    null
  );

  const uid = usuario?.id;
  useEffect(() => {
    if (!uid) return;
    let cancelado = false;
    registrarTokenPush(uid)
      .then((estado) => {
        if (!cancelado) setEstadoPush(estado);
      })
      .catch(() => {
        if (!cancelado) setEstadoPush('error');
      });
    return () => {
      cancelado = true;
    };
  }, [uid]);

  if (!usuario) return null;

  const probarNotificaciones = async () => {
    setProbando(true);
    setResultadoPrueba(null);
    try {
      setResultadoPrueba(await enviarPruebaPush(usuario.id));
    } catch {
      setResultadoPrueba({ ok: false, mensaje: 'No se pudo enviar la prueba.' });
    } finally {
      setProbando(false);
    }
  };

  const cambiarFoto = async () => {
    setError('');
    setSubiendoFoto(true);
    try {
      const foto = await elegirFotoComprimida();
      if (foto) {
        await actualizarMiPerfil(usuario.id, { foto });
        await refrescarPerfil();
        setMensaje('Foto actualizada.');
      }
    } catch {
      setError('No se pudo actualizar la foto. Revisá tu conexión.');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const guardarTelefono = async () => {
    setError('');
    setMensaje('');
    setGuardando(true);
    try {
      await actualizarMiPerfil(usuario.id, { telefono: telefono.trim() });
      await refrescarPerfil();
      setMensaje('Teléfono actualizado.');
    } catch {
      setError('No se pudo guardar. Revisá tu conexión.');
    } finally {
      setGuardando(false);
    }
  };

  const cambiarPassword = async () => {
    setError('');
    setMensaje('');
    try {
      await enviarRecuperacionPassword(usuario.email);
      setCorreoEnviado(true);
    } catch {
      setError('No se pudo enviar el correo. Intentá de nuevo.');
    }
  };

  return (
    <PantallaBase titulo="Configuración">
      {/* Foto + identidad */}
      <Tarjeta>
        <View style={styles.filaPerfil}>
          <View>
            {usuario.foto ? (
              <Avatar.Image size={76} source={{ uri: usuario.foto }} />
            ) : (
              <Avatar.Text
                size={76}
                label={usuario.nombre.trim().charAt(0).toUpperCase() || '?'}
                style={{ backgroundColor: tema.colors.primaryContainer }}
                color={tema.colors.onPrimaryContainer}
              />
            )}
            <IconButton
              icon="camera"
              mode="contained"
              size={16}
              style={styles.botonCamara}
              onPress={cambiarFoto}
              disabled={subiendoFoto}
              accessibilityLabel="Cambiar foto de perfil"
            />
          </View>
          <View style={styles.datosPerfil}>
            <Text variant="titleMedium" style={styles.negrita}>
              {usuario.nombre}
            </Text>
            <Text variant="bodySmall" style={estilosBase.tenue}>
              {usuario.email}
            </Text>
            <Text variant="bodySmall" style={estilosBase.tenue}>
              {usuario.rol === 'conductor'
                ? 'Conductor'
                : usuario.rol === 'admin'
                  ? 'Administración'
                  : 'Padre de familia'}
            </Text>
          </View>
        </View>
      </Tarjeta>

      {/* Teléfono editable */}
      <Tarjeta>
        <Text variant="titleSmall" style={styles.negrita}>
          Mi teléfono
        </Text>
        <Text variant="bodySmall" style={estilosBase.tenue}>
          Es el número al que llaman desde el chat.
        </Text>
        <TextInput
          mode="outlined"
          value={telefono}
          onChangeText={setTelefono}
          keyboardType="phone-pad"
          placeholder="Ej. 9999-9999"
          outlineStyle={styles.campo}
          left={<TextInput.Icon icon="phone" />}
        />
        <Button
          mode="contained-tonal"
          onPress={guardarTelefono}
          loading={guardando}
          disabled={guardando || telefono.trim() === usuario.telefono}
        >
          Guardar teléfono
        </Button>
      </Tarjeta>

      {/* Notificaciones: estado real + prueba.
          Está a la vista del usuario a propósito. "No me llegan los avisos" es
          el reclamo más difícil de diagnosticar a distancia; con esta tarjeta,
          quien sea que tenga el teléfono en la mano puede decir en qué punto se
          corta. */}
      <Tarjeta>
        <View style={styles.filaOpcion}>
          <MaterialCommunityIcons
            name={estadoPush === 'listo' ? 'bell-check' : 'bell-alert'}
            size={22}
            color={
              estadoPush === 'listo'
                ? tema.colors.secondary
                : estadoPush === null
                  ? tema.colors.onSurfaceVariant
                  : tema.colors.error
            }
          />
          <View style={styles.textoOpcion}>
            <Text variant="titleSmall" style={styles.negrita}>
              Notificaciones
            </Text>
            <Text variant="bodySmall" style={estilosBase.tenue}>
              {estadoPush === null ? 'Comprobando…' : EXPLICACION_PUSH[estadoPush]}
            </Text>
          </View>
        </View>

        <Button
          mode="contained-tonal"
          icon="bell-ring"
          onPress={probarNotificaciones}
          loading={probando}
          disabled={probando || estadoPush === null}
        >
          Enviar una notificación de prueba
        </Button>

        {!!resultadoPrueba && (
          <View style={styles.filaOpcion}>
            <MaterialCommunityIcons
              name={resultadoPrueba.ok ? 'check-circle' : 'alert-circle'}
              size={17}
              color={resultadoPrueba.ok ? tema.colors.secondary : tema.colors.error}
            />
            <Text
              variant="bodySmall"
              style={[
                styles.textoOpcion,
                { color: resultadoPrueba.ok ? tema.colors.secondary : tema.colors.error },
              ]}
            >
              {resultadoPrueba.mensaje}
            </Text>
          </View>
        )}
      </Tarjeta>

      {/* Cuenta */}
      <Tarjeta>
        <Text variant="titleSmall" style={styles.negrita}>
          Cuenta
        </Text>

        <TouchableRipple
          onPress={cambiarPassword}
          disabled={correoEnviado}
          borderless
          style={styles.opcion}
        >
          <View style={styles.filaOpcion}>
            <MaterialCommunityIcons
              name="lock-reset"
              size={22}
              color={tema.colors.onSurfaceVariant}
            />
            <View style={styles.textoOpcion}>
              <Text variant="bodyLarge">Cambiar contraseña</Text>
              <Text variant="bodySmall" style={estilosBase.tenue}>
                {correoEnviado
                  ? `Correo enviado a ${usuario.email} — revisá tu bandeja`
                  : 'Te llega un correo para definir la nueva'}
              </Text>
            </View>
          </View>
        </TouchableRipple>

        <Divider />

        <TouchableRipple onPress={() => logout()} borderless style={styles.opcion}>
          <View style={styles.filaOpcion}>
            <MaterialCommunityIcons name="logout" size={22} color={tema.colors.error} />
            <Text variant="bodyLarge" style={{ color: tema.colors.error }}>
              Cerrar sesión
            </Text>
          </View>
        </TouchableRipple>
      </Tarjeta>

      <HelperText type="info" visible={!!mensaje}>
        {mensaje}
      </HelperText>
      <HelperText type="error" visible={!!error}>
        {error}
      </HelperText>
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  filaPerfil: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.seccion },
  botonCamara: { position: 'absolute', bottom: -10, right: -14 },
  datosPerfil: { flex: 1, gap: 2 },
  negrita: { fontWeight: '700' },
  campo: { borderRadius: RADIO.control },
  opcion: { borderRadius: RADIO.control, paddingVertical: 10, paddingHorizontal: 4 },
  filaOpcion: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
  textoOpcion: { flex: 1, gap: 2 },
});
