import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  HelperText,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import Campo from '@/components/Campo';
import { useAlturaTeclado } from '@/hooks/use-teclado';
import { completarRegistro } from '@/services/authService';
import { elegirFotoComprimida } from '@/utils/fotos';
import { ESPACIO, RADIO, SOMBRA_TARJETA, fondoTarjeta } from '@/constants/estilos';
import { FRANJA_TROPICAL } from '@/constants/tema';

// Alta del usuario, primera vez que entra. La contraseña ya la definió con el
// enlace que le envió Firebase; acá completa lo que ese enlace no puede pedirle:
// su teléfono (lo necesita el conductor) y su foto. Hasta que no lo termine, la
// app no lo deja pasar a su sección — por eso no hay botón de "volver".
export default function CompletarPerfilScreen() {
  const { usuario, cargando, logout, refrescarPerfil } = useAuth();
  const tema = useTheme();
  const insets = useSafeAreaInsets();
  const altoTeclado = useAlturaTeclado();

  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [telefono, setTelefono] = useState(usuario?.telefono ?? '');
  const [foto, setFoto] = useState<string | null>(usuario?.foto ?? null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  if (cargando) return null;
  if (!usuario) return <Redirect href="/login" />;
  // Si ya lo completó, no tiene nada que hacer acá
  if (!usuario.debeCompletarPerfil) return <Redirect href="/" />;

  const elegirFoto = async () => {
    const f = await elegirFotoComprimida();
    if (f) setFoto(f);
  };

  const guardar = async () => {
    setError('');
    if (!nombre.trim()) {
      setError('Escribí tu nombre completo.');
      return;
    }
    if (!telefono.trim()) {
      setError('Escribí tu teléfono: lo necesita el conductor para contactarte.');
      return;
    }
    setGuardando(true);
    try {
      await completarRegistro(usuario.id, {
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        ...(foto ? { foto } : {}),
      });
      // Al refrescar, debeCompletarPerfil queda en false y el despachador lo
      // manda a su sección según el rol
      await refrescarPerfil();
    } catch {
      setError('No se pudo guardar. Revisá tu conexión e intentá de nuevo.');
      setGuardando(false);
    }
  };

  return (
    <View style={styles.contenedor}>
      {/* El espacio de abajo crece con el teclado: el formulario se puede
          desplazar hasta el botón de guardar en cualquier teléfono */}
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + altoTeclado }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.encabezado,
            { backgroundColor: tema.colors.primary, paddingTop: insets.top + 36 },
          ]}
        >
          <Text variant="headlineSmall" style={[styles.titulo, { color: tema.colors.onPrimary }]}>
            Completá tu perfil
          </Text>
          <Text variant="bodyMedium" style={[styles.lema, { color: tema.colors.onPrimary }]}>
            {usuario.rol === 'conductor' ? 'Conductor' : 'Padre / Madre'} · solo esta vez
          </Text>
        </View>
        {/* Franja de marca coral · mango · aqua */}
        <View style={styles.franja}>
          {FRANJA_TROPICAL.map((color) => (
            <View key={color} style={[styles.tramoFranja, { backgroundColor: color }]} />
          ))}
        </View>

        <View style={[styles.tarjeta, { backgroundColor: fondoTarjeta(tema), borderColor: tema.colors.outlineVariant }]}>
          {/* Foto de perfil */}
          <View style={styles.filaFoto}>
            <View>
              {foto ? (
                <Avatar.Image size={72} source={{ uri: foto }} />
              ) : (
                <Avatar.Text
                  size={72}
                  label={nombre.trim().charAt(0).toUpperCase() || '?'}
                  style={{ backgroundColor: tema.colors.primaryContainer }}
                  color={tema.colors.onPrimaryContainer}
                />
              )}
              <IconButton
                icon="camera"
                mode="contained"
                size={16}
                style={styles.botonCamara}
                onPress={elegirFoto}
                accessibilityLabel="Elegir foto de perfil"
              />
            </View>
            <Text variant="bodySmall" style={styles.ayuda}>
              Tu foto ayuda a que el conductor y la administración te reconozcan.
            </Text>
          </View>

          <Campo
            label="Nombre completo"
            value={nombre}
            onChangeText={setNombre}
            left={<TextInput.Icon icon="account-outline" />}
          />

          <Campo
            label="Teléfono"
            placeholder="9999-9999"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
            left={<TextInput.Icon icon="phone-outline" />}
          />

          <Text variant="bodySmall" style={styles.seccion}>
            Tu contraseña ya quedó definida. Esto es lo único que falta y no te lo
            volvemos a pedir.
          </Text>

          <HelperText type="error" visible={!!error}>
            {error}
          </HelperText>

          <Button
            mode="contained"
            icon="check"
            onPress={guardar}
            loading={guardando}
            disabled={guardando}
            contentStyle={styles.contenidoBoton}
          >
            Guardar y entrar
          </Button>

          <Button mode="text" onPress={() => logout()} disabled={guardando}>
            Cancelar y salir
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  scroll: { flexGrow: 1 },
  encabezado: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  titulo: { fontWeight: '700' },
  lema: { opacity: 0.85 },
  franja: { flexDirection: 'row', height: 6 },
  tramoFranja: { flex: 1 },
  tarjeta: {
    margin: ESPACIO.pantalla,
    marginTop: 24,
    marginBottom: 40,
    padding: ESPACIO.pantalla,
    borderRadius: RADIO.tarjeta,
    gap: 10,
    ...SOMBRA_TARJETA,
    borderWidth: 1,
  },
  filaFoto: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 4 },
  botonCamara: { position: 'absolute', bottom: -10, right: -14 },
  ayuda: { flex: 1, opacity: 0.6 },
  seccion: { opacity: 0.7, marginTop: 6 },
  contenidoBoton: { paddingVertical: 6 },
});
