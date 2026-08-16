import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  HelperText,
  IconButton,
  Menu,
  SegmentedButtons,
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
import { listarHijos } from '@/services/padreService';
import { crearSolicitudCambio } from '@/services/solicitudesService';
import { ESPACIO, RADIO, estilosBase } from '@/constants/estilos';
import type { AlcanceCambio, Nino } from '@/types/models';

// Formatea una fecha a "YYYY-MM-DD"
function formatoFecha(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Suma días a una fecha "YYYY-MM-DD" (mismo helper que el historial)
function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return formatoFecha(new Date(anio, mes - 1, dia + dias));
}

// REGLA DE LAS 24 HORAS: un cambio de un día se pide con al menos 24 h de
// anticipación, para que la administración lo apruebe y el conductor lo vea
// antes de salir. La fecha más cercana posible es el primer día que EMPIEZA
// (00:00) al menos 24 h después de este momento — en la práctica, pasado
// mañana. Se calcula acá y la pantalla no deja elegir nada anterior.
function fechaMinimaCambio(): string {
  const limite = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dia = new Date(limite.getFullYear(), limite.getMonth(), limite.getDate());
  if (dia.getTime() < limite.getTime()) dia.setDate(dia.getDate() + 1);
  return formatoFecha(dia);
}

// Escribe "YYYY-MM-DD" como "miércoles 12 de agosto"
function fechaEscrita(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-HN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// Solicitud de CAMBIO DE UBICACIÓN: mudanza (permanente) o "solo por un día"
// (ej. hoy recogerlo donde la abuela). La aprueba el admin; si es de un día,
// el conductor ve un aviso destacado ese día.
export default function NuevaSolicitudCambioScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();

  const fechaMinima = fechaMinimaCambio();

  const [hijos, setHijos] = useState<Nino[]>([]);
  const [ninoId, setNinoId] = useState('');
  const [menuHijo, setMenuHijo] = useState(false);
  const [permanente, setPermanente] = useState<'permanente' | 'un_dia'>('un_dia');
  const [fecha, setFecha] = useState(fechaMinima); // la primera fecha permitida
  const [alcance, setAlcance] = useState<AlcanceCambio>('ambas');
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null);
  const [nombreLugar, setNombreLugar] = useState('');
  const [referencia, setReferencia] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    listarHijos(usuario.id)
      .then((lista) => {
        setHijos(lista);
        if (lista.length === 1) setNinoId(lista[0].id); // con un solo hijo, preseleccionado
      })
      .catch(() => setHijos([]));
  }, [usuario]);

  const hijoElegido = hijos.find((h) => h.id === ninoId);

  const enviar = async () => {
    setError('');
    if (!usuario) return;
    if (!ninoId) {
      setError('Elegí a cuál de tus hijos aplica el cambio.');
      return;
    }
    if (!ubicacion) {
      setError('Marcá en el mapa el nuevo lugar.');
      return;
    }
    if (!referencia.trim()) {
      setError('Escribí un punto de referencia para que el conductor ubique el lugar.');
      return;
    }
    // Refuerzo de la regla de las 24 h (además de que las flechas no dejan bajar)
    if (permanente === 'un_dia' && fecha < fechaMinima) {
      setError(
        `Los cambios se piden con 24 horas de anticipación. La fecha más cercana es ${fechaMinima}.`
      );
      return;
    }
    setEnviando(true);
    try {
      await crearSolicitudCambio(usuario.id, {
        ninoId,
        permanente: permanente === 'permanente',
        ...(permanente === 'un_dia' ? { fechaAplicacion: fecha } : {}),
        alcance,
        nuevaUbicacion: {
          nombre: nombreLugar.trim() || 'Nuevo lugar',
          lat: ubicacion.lat,
          lng: ubicacion.lng,
          referencia: referencia.trim(),
        },
        ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
      });
      router.back();
    } catch {
      setError('No se pudo enviar la solicitud. Revisá tu conexión.');
      setEnviando(false);
    }
  };

  return (
    <PantallaBase titulo="Cambio de ubicación" alVolver={() => router.back()}>
      {/* --- Para quién --- */}
      <TituloSeccion titulo="¿Para cuál de tus hijos?" />
      <Tarjeta>
        <Menu
          visible={menuHijo}
          onDismiss={() => setMenuHijo(false)}
          anchor={
            <Campo
              label="Hijo"
              value={hijoElegido?.nombre ?? ''}
              editable={false}
              right={<TextInput.Icon icon="chevron-down" onPress={() => setMenuHijo(true)} />}
              onPressIn={() => setMenuHijo(true)}
            />
          }
        >
          {hijos.map((h) => (
            <Menu.Item
              key={h.id}
              title={h.nombre}
              onPress={() => {
                setNinoId(h.id);
                setMenuHijo(false);
              }}
            />
          ))}
        </Menu>
      </Tarjeta>

      {/* --- Por cuánto tiempo --- */}
      <TituloSeccion titulo="¿Por cuánto tiempo?" />
      <Tarjeta>
        <SegmentedButtons
          value={permanente}
          onValueChange={(v) => setPermanente(v as 'permanente' | 'un_dia')}
          buttons={[
            { value: 'un_dia', label: 'Solo un día' },
            { value: 'permanente', label: 'Permanente' },
          ]}
        />

        {permanente === 'un_dia' ? (
          <>
            <View style={[styles.filaFecha, { backgroundColor: tema.colors.surfaceVariant }]}>
              <IconButton
                icon="chevron-left"
                // La regla de 24 h: no se puede elegir antes de la fecha mínima
                disabled={fecha <= fechaMinima}
                onPress={() => setFecha((f) => sumarDias(f, -1))}
                accessibilityLabel="Día anterior"
              />
              <Text variant="titleSmall" style={styles.textoFecha}>
                {fechaEscrita(fecha)}
              </Text>
              <IconButton
                icon="chevron-right"
                onPress={() => setFecha((f) => sumarDias(f, 1))}
                accessibilityLabel="Día siguiente"
              />
            </View>
            <Text variant="bodySmall" style={styles.aviso}>
              Los cambios se piden con 24 horas de anticipación: la fecha más cercana que podés
              elegir es {fechaEscrita(fechaMinima)}. Ese día el conductor verá el cambio y al día
              siguiente todo vuelve a la normalidad.
            </Text>
          </>
        ) : (
          <Text variant="bodySmall" style={styles.aviso}>
            El cambio queda fijo para todos los viajes, desde que la administración lo apruebe.
          </Text>
        )}
      </Tarjeta>

      {/* --- Qué lado cambia --- */}
      <TituloSeccion titulo="¿Qué cambia?" />
      <Tarjeta>
        <SegmentedButtons
          value={alcance}
          onValueChange={(v) => setAlcance(v as AlcanceCambio)}
          buttons={[
            { value: 'recogida', label: 'Recogida' },
            { value: 'entrega', label: 'Entrega' },
            { value: 'ambas', label: 'Ambas' },
          ]}
        />
        <Text variant="bodySmall" style={estilosBase.tenue}>
          {alcance === 'recogida'
            ? 'Cambia solo dónde se recoge al niño en la mañana.'
            : alcance === 'entrega'
              ? 'Cambia solo dónde se entrega al niño en la tarde.'
              : 'Se recoge y se entrega en el nuevo lugar (lo normal en una mudanza).'}
        </Text>
      </Tarjeta>

      {/* --- El nuevo lugar --- */}
      <TituloSeccion titulo="El nuevo lugar" />
      <Tarjeta>
        <SelectorUbicacion valor={ubicacion} onCambio={(lat, lng) => setUbicacion({ lat, lng })} />
        <Campo
          label="Nombre del lugar (ej. casa de la abuela)"
          value={nombreLugar}
          onChangeText={setNombreLugar}
        />
        <Campo
          label="Punto de referencia"
          placeholder="Ej. portón negro frente a la pulpería Doña Mari"
          value={referencia}
          onChangeText={setReferencia}
          multiline
        />
        <Text variant="bodySmall" style={estilosBase.tenue}>
          El conductor lo ve en el mapa al tocar la parada: ayuda a ubicar el lugar exacto.
        </Text>
        <Campo label="Motivo (opcional)" value={motivo} onChangeText={setMotivo} multiline />
      </Tarjeta>

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
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  filaFecha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADIO.control,
    paddingHorizontal: ESPACIO.minimo,
  },
  textoFecha: { flex: 1, textAlign: 'center', textTransform: 'capitalize' },
  aviso: { opacity: 0.8, fontStyle: 'italic' },
  botonAlto: { paddingVertical: 6 },
});
