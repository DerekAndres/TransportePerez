import { useCallback, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
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
import { useFocusEffect } from 'expo-router';

import { actualizarMiPerfil, enviarRecuperacionPassword } from '@/services/authService';
import {
  EXPLICACION_PUSH,
  activarNotificaciones,
  consultarEstadoPush,
  type EstadoPush,
} from '@/services/notificacionesService';
import { elegirFotoComprimida } from '@/utils/fotos';
import { ESPACIO, RADIO, estilosBase } from '@/constants/estilos';
import { FUENTES } from '@/constants/tema';

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

  // --- Avisos del teléfono ---
  // Los layouts de los tres roles ya registran el token al entrar. Pero si la
  // persona rechazó el permiso (o lo apagó después), se queda SIN recibir nada
  // y sin ninguna forma de volver atrás desde la app. Esta tarjeta es esa vía.
  const [estadoPush, setEstadoPush] = useState<EstadoPush | null>(null);
  const [activando, setActivando] = useState(false);

  const uid = usuario?.id;
  // Al volver de los ajustes del sistema hay que releer el estado: la persona
  // pudo haber activado el permiso allá, y la tarjeta tiene que reflejarlo sin
  // que haga falta reiniciar la app.
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let cancelado = false;
      consultarEstadoPush(uid)
        .then((e) => {
          if (!cancelado) setEstadoPush(e);
        })
        .catch(() => {
          if (!cancelado) setEstadoPush('error');
        });
      return () => {
        cancelado = true;
      };
    }, [uid])
  );

  if (!usuario) return null;

  const activarAvisos = async () => {
    setError('');
    setMensaje('');
    setActivando(true);
    try {
      const { estado, abrirAjustes } = await activarNotificaciones(usuario.id);
      setEstadoPush(estado);
      if (abrirAjustes) {
        // Ya dijo que no antes: el diálogo del sistema no vuelve a aparecer y
        // la única forma de activarlos es la pantalla de ajustes de la app.
        await Linking.openSettings();
      } else if (estado === 'listo') {
        setMensaje('Listo, ya vas a recibir los avisos.');
      }
    } catch {
      setError('No se pudieron activar los avisos. Intentá de nuevo.');
    } finally {
      setActivando(false);
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

  // Se guarda cadena vacía en vez de borrar el campo: en toda la app la foto se
  // lee como `usuario.foto ? <imagen> : <inicial>`, así que "" ya vuelve a la
  // inicial, y el tipo del campo sigue siendo string en las dos copias de
  // `models.ts`. Borrarlo de verdad obligaría a cambiar esa firma sin ganar nada.
  const quitarFoto = async () => {
    setError('');
    setMensaje('');
    setSubiendoFoto(true);
    try {
      await actualizarMiPerfil(usuario.id, { foto: '' });
      await refrescarPerfil();
      setMensaje('Foto quitada.');
    } catch {
      setError('No se pudo quitar la foto. Revisá tu conexión.');
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
            {/* Solo aparece si hay algo que quitar. Va acá y no como segundo
                botón flotando sobre el avatar: un tacho encima de la foto de
                perfil se lee como "borrar la cuenta". */}
            {!!usuario.foto && (
              <Button
                mode="text"
                icon="trash-can-outline"
                compact
                onPress={quitarFoto}
                disabled={subiendoFoto}
                textColor={tema.colors.onSurfaceVariant}
                style={styles.botonQuitarFoto}
                labelStyle={styles.etiquetaQuitarFoto}
                accessibilityLabel="Quitar la foto de perfil"
              >
                Quitar foto
              </Button>
            )}
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

      {/* Avisos del teléfono.
          Cuando están activados la tarjeta NO ofrece ningún botón: no hay nada
          que hacer, y un botón que no hace falta invita a tocarlo. Cuando no lo
          están, la acción es lo más visible de la tarjeta, porque sin avisos el
          padre no se entera de que su hijo subió al bus. */}
      <Tarjeta>
        <View style={styles.filaOpcion}>
          <MaterialCommunityIcons
            name={estadoPush === 'listo' ? 'bell-check' : 'bell-off-outline'}
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
              Avisos en este teléfono
            </Text>
            <Text variant="bodySmall" style={estilosBase.tenue}>
              {estadoPush === null ? 'Comprobando…' : EXPLICACION_PUSH[estadoPush]}
            </Text>
          </View>
        </View>

        {estadoPush !== null && estadoPush !== 'listo' && (
          <Button
            mode="contained-tonal"
            icon="bell-ring"
            onPress={activarAvisos}
            loading={activando}
            disabled={activando || estadoPush === 'sin_dispositivo'}
          >
            Activar los avisos
          </Button>
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
  // El margen negativo cancela el relleno interno del botón de Paper, para que
  // el texto quede alineado con el nombre y el correo de arriba.
  botonQuitarFoto: { alignSelf: 'flex-start', marginLeft: -8, marginTop: 4 },
  etiquetaQuitarFoto: { fontSize: 12, marginVertical: 0 },
  negrita: { fontFamily: FUENTES.textoNegrita },
  campo: { borderRadius: RADIO.control },
  opcion: { borderRadius: RADIO.control, paddingVertical: 10, paddingHorizontal: 4 },
  filaOpcion: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
  textoOpcion: { flex: 1, gap: 2 },
});
