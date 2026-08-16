import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  HelperText,
  Menu,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import TituloSeccion from '@/components/TituloSeccion';
import Campo from '@/components/Campo';
import SelectorUbicacion from '@/components/SelectorUbicacion';
import { listarEscuelas } from '@/services/padreService';
import { crearSolicitudInscripcion } from '@/services/solicitudesService';
import { elegirFotoComprimida } from '@/utils/fotos';
import { ESPACIO, estilosBase } from '@/constants/estilos';
import type { Escuela, TurnoNino } from '@/types/models';

// Formulario de INSCRIPCIÓN de un hijo (lo llena el padre; lo aprueba el admin).
// Es condicional según el turno:
//   - Solo mañana:  casa donde se recoge + escuela donde se deja.
//   - Solo tarde / ambos: además pregunta si en la tarde se entrega en el mismo
//     lugar de la casa o en OTRO lugar (ej. casa de la abuela).
//
// Se arma en bloques (tarjetas): quién es el niño, cuándo viaja y dónde. Así el
// formulario largo se lee como tres preguntas cortas en vez de una lista de
// campos.
export default function NuevaInscripcionScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();

  const [nombre, setNombre] = useState('');
  const [grado, setGrado] = useState('');
  const [escuelas, setEscuelas] = useState<Escuela[]>([]);
  const [escuelaId, setEscuelaId] = useState('');
  const [menuEscuela, setMenuEscuela] = useState(false);
  const [turno, setTurno] = useState<TurnoNino>('ambos');
  const [casa, setCasa] = useState<{ lat: number; lng: number } | null>(null);
  const [nombreCasa, setNombreCasa] = useState('');
  const [referenciaCasa, setReferenciaCasa] = useState('');
  const [mismaEntrega, setMismaEntrega] = useState(true);
  const [entrega, setEntrega] = useState<{ lat: number; lng: number } | null>(null);
  const [nombreEntrega, setNombreEntrega] = useState('');
  const [referenciaEntrega, setReferenciaEntrega] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    listarEscuelas()
      .then(setEscuelas)
      .catch(() => setEscuelas([]));
  }, []);

  const viajaTarde = turno === 'tarde' || turno === 'ambos';
  const escuelaElegida = escuelas.find((e) => e.id === escuelaId);

  const elegirFoto = async () => {
    const f = await elegirFotoComprimida();
    if (f) setFoto(f);
  };

  const enviar = async () => {
    setError('');
    if (!usuario) return;
    if (!nombre.trim() || !grado.trim() || !escuelaId) {
      setError('Completá el nombre, el grado y la escuela.');
      return;
    }
    if (!casa) {
      setError('Marcá en el mapa dónde se recoge a tu hijo (su casa).');
      return;
    }
    if (!referenciaCasa.trim()) {
      setError('Escribí un punto de referencia para que el conductor ubique la casa.');
      return;
    }
    if (viajaTarde && !mismaEntrega && !entrega) {
      setError('Marcá en el mapa dónde se entrega en la tarde.');
      return;
    }
    if (viajaTarde && !mismaEntrega && !referenciaEntrega.trim()) {
      setError('Escribí un punto de referencia del lugar de entrega de la tarde.');
      return;
    }
    setEnviando(true);
    try {
      await crearSolicitudInscripcion(usuario.id, {
        nombre: nombre.trim(),
        grado: grado.trim(),
        escuelaId,
        turno,
        casa: {
          nombre: nombreCasa.trim() || 'Casa',
          lat: casa.lat,
          lng: casa.lng,
          referencia: referenciaCasa.trim(),
        },
        ...(viajaTarde && !mismaEntrega && entrega
          ? {
              entregaTarde: {
                nombre: nombreEntrega.trim() || 'Entrega de la tarde',
                lat: entrega.lat,
                lng: entrega.lng,
                referencia: referenciaEntrega.trim(),
              },
            }
          : {}),
        ...(foto ? { foto } : {}),
      });
      router.back(); // la solicitud aparece en la lista con estado "Pendiente"
    } catch {
      setError('No se pudo enviar la solicitud. Revisá tu conexión.');
      setEnviando(false);
    }
  };

  return (
    <PantallaBase titulo="Inscribir a un hijo" alVolver={() => router.back()}>
      {/* --- Quién es --- */}
      <TituloSeccion titulo="Datos del niño" />
      <Tarjeta>
        <View style={styles.filaFoto}>
          {foto ? (
            <Avatar.Image size={64} source={{ uri: foto }} />
          ) : (
            <Avatar.Icon
              size={64}
              icon="account-child"
              style={{ backgroundColor: tema.colors.primaryContainer }}
              color={tema.colors.onPrimaryContainer}
            />
          )}
          <Button mode="text" icon="camera" onPress={elegirFoto}>
            {foto ? 'Cambiar foto' : 'Agregar foto (opcional)'}
          </Button>
        </View>

        <Campo label="Nombre del niño" value={nombre} onChangeText={setNombre} />
        <Campo label="Grado (ej. 4to)" value={grado} onChangeText={setGrado} />

        <Menu
          visible={menuEscuela}
          onDismiss={() => setMenuEscuela(false)}
          anchor={
            <Campo
              label="Escuela a la que asiste"
              value={escuelaElegida?.nombre ?? ''}
              editable={false}
              right={<TextInput.Icon icon="chevron-down" onPress={() => setMenuEscuela(true)} />}
              onPressIn={() => setMenuEscuela(true)}
            />
          }
        >
          {escuelas.map((e) => (
            <Menu.Item
              key={e.id}
              title={e.nombre}
              onPress={() => {
                setEscuelaId(e.id);
                setMenuEscuela(false);
              }}
            />
          ))}
        </Menu>
      </Tarjeta>

      {/* --- Cuándo viaja --- */}
      <TituloSeccion titulo="¿Cuándo necesita el transporte?" />
      <Tarjeta>
        <SegmentedButtons
          value={turno}
          onValueChange={(v) => setTurno(v as TurnoNino)}
          buttons={[
            { value: 'manana', label: 'Mañana' },
            { value: 'tarde', label: 'Tarde' },
            { value: 'ambos', label: 'Ambos' },
          ]}
        />
      </Tarjeta>

      {/* --- Dónde se recoge --- */}
      <TituloSeccion
        titulo={turno === 'tarde' ? '¿Dónde se entrega en la tarde?' : '¿Dónde se recoge?'}
      />
      <Tarjeta>
        <SelectorUbicacion valor={casa} onCambio={(lat, lng) => setCasa({ lat, lng })} />
        <Campo
          label="Nombre del lugar (ej. Col. El Sauce)"
          value={nombreCasa}
          onChangeText={setNombreCasa}
        />
        <Campo
          label="Punto de referencia"
          placeholder="Ej. casa verde de dos pisos, frente a la pulpería Doña Mari"
          value={referenciaCasa}
          onChangeText={setReferenciaCasa}
          multiline
        />
        <Text variant="bodySmall" style={estilosBase.tenue}>
          El conductor lo ve en el mapa al tocar la parada. Mientras más claro, más rápido
          encuentra la casa.
        </Text>
      </Tarjeta>

      {/* --- Entrega de la tarde: solo si viaja en la tarde --- */}
      {viajaTarde && turno !== 'tarde' && (
        <>
          <TituloSeccion titulo="Entrega de la tarde" />
          <Tarjeta>
            <View style={styles.filaSwitch}>
              <Text style={styles.textoSwitch}>
                En la tarde se entrega en el mismo lugar donde se recoge
              </Text>
              <Switch value={mismaEntrega} onValueChange={setMismaEntrega} />
            </View>
            {!mismaEntrega && (
              <>
                <SelectorUbicacion
                  valor={entrega}
                  onCambio={(lat, lng) => setEntrega({ lat, lng })}
                  etiqueta="¿Dónde se entrega en la tarde?"
                />
                <Campo
                  label="Nombre del lugar de entrega"
                  value={nombreEntrega}
                  onChangeText={setNombreEntrega}
                />
                <Campo
                  label="Punto de referencia de la entrega"
                  placeholder="Ej. casa esquinera con portón blanco"
                  value={referenciaEntrega}
                  onChangeText={setReferenciaEntrega}
                  multiline
                />
              </>
            )}
          </Tarjeta>
        </>
      )}

      <HelperText type="error" visible={!!error}>
        {error}
      </HelperText>

      <Button
        mode="contained"
        icon="send"
        onPress={enviar}
        loading={enviando}
        disabled={enviando}
        contentStyle={styles.botonAlto}
      >
        Enviar solicitud
      </Button>
      <Text variant="bodySmall" style={[estilosBase.tenue, styles.centrado]}>
        La administración revisa la solicitud y asigna la ruta. Vas a ver el estado en
        Solicitudes.
      </Text>
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  filaFoto: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
  filaSwitch: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
  textoSwitch: { flex: 1 },
  botonAlto: { paddingVertical: 6 },
  centrado: { textAlign: 'center' },
});
