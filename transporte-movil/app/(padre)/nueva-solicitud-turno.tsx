import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, SegmentedButtons, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import Campo from '@/components/Campo';
import ChipFiltro from '@/components/ChipFiltro';
import { listarHijos } from '@/services/padreService';
import { crearSolicitudTurno } from '@/services/solicitudesService';
import { ESPACIO, estilosBase } from '@/constants/estilos';
import type { Nino, TurnoNino } from '@/types/models';

// ============================================
// PEDIDO: CAMBIO DE TURNO
// ============================================
// Mañana (casa → escuela), tarde (escuela → casa) o los dos.
//
// Igual que el cambio de escuela, esto lo aprueba la administración: cada ruta
// tiene su turno, así que pasar de "solo mañana" a "ambos" significa sumar al
// niño a una ruta de la tarde, y puede no haber lugar.

const ETIQUETA_TURNO: Record<TurnoNino, string> = {
  manana: 'Solo mañana',
  tarde: 'Solo tarde',
  ambos: 'Mañana y tarde',
};

const EXPLICACION_TURNO: Record<TurnoNino, string> = {
  manana: 'El bus lo lleva de la casa a la escuela. La vuelta corre por tu cuenta.',
  tarde: 'El bus lo trae de la escuela a la casa. La ida corre por tu cuenta.',
  ambos: 'El bus lo lleva a la escuela y lo trae de vuelta.',
};

export default function NuevaSolicitudTurnoScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();

  const [hijos, setHijos] = useState<Nino[]>([]);
  const [ninoId, setNinoId] = useState<string | null>(null);
  const [turno, setTurno] = useState<TurnoNino>('ambos');
  const [desde, setDesde] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    listarHijos(usuario.id)
      .then((lista) => {
        setHijos(lista);
        if (lista.length === 1) setNinoId(lista[0].id);
      })
      .catch(() => setError('No se pudieron cargar tus hijos.'));
  }, [usuario]);

  const hijo = hijos.find((h) => h.id === ninoId) ?? null;
  const turnoActualDelNino = hijo?.turno;
  const sinCambio = !!turnoActualDelNino && turnoActualDelNino === turno;

  const fechaValida = desde === '' || /^\d{4}-\d{2}-\d{2}$/.test(desde);

  const enviar = async () => {
    if (!usuario || !ninoId) return;
    setEnviando(true);
    setError('');
    try {
      await crearSolicitudTurno(usuario.id, {
        ninoId,
        nuevoTurno: turno,
        ...(desde ? { fechaAplicacion: desde } : {}),
        ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
      });
      setListo(true);
    } catch {
      setError('No se pudo enviar la solicitud. Revisá tu conexión.');
    } finally {
      setEnviando(false);
    }
  };

  if (listo) {
    return (
      <PantallaBase titulo="Solicitud enviada" alVolver={() => router.back()}>
        <Tarjeta>
          <Text variant="titleMedium" style={estilosBase.negrita}>
            La administración la va a revisar
          </Text>
          <Text style={estilosBase.tenue}>
            Cambiar de turno significa entrar en otra ruta, así que primero tienen que ver si hay
            lugar. Vas a ver la respuesta en Solicitudes.
          </Text>
        </Tarjeta>
        <Button mode="contained" onPress={() => router.back()}>
          Volver
        </Button>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase titulo="Cambio de turno" alVolver={() => router.back()}>
      <Tarjeta>
        <Text style={estilosBase.tenue}>
          Cambiá si tu hijo usa el bus de ida, de vuelta o las dos veces.
        </Text>
      </Tarjeta>

      {hijos.length > 1 && (
        <View style={styles.bloque}>
          <Text variant="titleSmall" style={estilosBase.negrita}>
            ¿Qué hijo?
          </Text>
          <ChipFiltro
            opciones={hijos.map((h) => ({ id: h.id, etiqueta: h.nombre }))}
            seleccionadaId={ninoId}
            onSeleccionar={setNinoId}
          />
        </View>
      )}

      {!!turnoActualDelNino && (
        <Text variant="bodySmall" style={estilosBase.tenue}>
          Turno actual: {ETIQUETA_TURNO[turnoActualDelNino]}
        </Text>
      )}

      <View style={styles.bloque}>
        <Text variant="titleSmall" style={estilosBase.negrita}>
          Nuevo turno
        </Text>
        <SegmentedButtons
          value={turno}
          onValueChange={(v) => setTurno(v as TurnoNino)}
          buttons={[
            { value: 'manana', label: 'Mañana' },
            { value: 'tarde', label: 'Tarde' },
            { value: 'ambos', label: 'Ambos' },
          ]}
        />
        {/* Se explica en palabras qué significa cada turno: "mañana" y "tarde"
            solos no dicen si el bus lo lleva, lo trae, o las dos cosas */}
        <Text variant="bodySmall" style={estilosBase.tenue}>
          {EXPLICACION_TURNO[turno]}
        </Text>
      </View>

      <Campo
        label="Desde cuándo (opcional)"
        value={desde}
        onChangeText={setDesde}
        placeholder="AAAA-MM-DD"
        keyboardType="numbers-and-punctuation"
      />
      {!fechaValida && (
        <HelperText type="error" visible>
          Escribí la fecha como 2026-09-15.
        </HelperText>
      )}

      <Campo
        label="Motivo (opcional)"
        value={motivo}
        onChangeText={setMotivo}
        multiline
        placeholder="Ej.: ahora sale a las 12:40"
      />

      <HelperText type="error" visible={!!error}>
        {error}
      </HelperText>

      <Button
        mode="contained"
        icon="clock-outline"
        onPress={enviar}
        loading={enviando}
        disabled={enviando || !ninoId || !fechaValida || sinCambio}
        contentStyle={styles.contenidoBoton}
      >
        Enviar solicitud
      </Button>

      {sinCambio && (
        <Text variant="bodySmall" style={{ color: tema.colors.error, textAlign: 'center' }}>
          Ese ya es el turno de {hijo?.nombre}. Elegí otro.
        </Text>
      )}
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  bloque: { gap: ESPACIO.interno },
  contenidoBoton: { paddingVertical: 8 },
});
