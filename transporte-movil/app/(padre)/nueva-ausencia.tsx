import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, IconButton, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import Campo from '@/components/Campo';
import ChipFiltro from '@/components/ChipFiltro';
import { listarHijos } from '@/services/padreService';
import { crearAvisoAusencia } from '@/services/solicitudesService';
import { fechaDeHoy } from '@/services/viajesService';
import { ESPACIO, estilosBase } from '@/constants/estilos';
import { FUENTES } from '@/constants/tema';
import type { Nino } from '@/types/models';

// ============================================
// AVISO: "HOY NO VIAJA"
// ============================================
// Es un AVISO, no un pedido: no espera aprobación de nadie. Y esa es toda la
// razón de que exista — un niño se enferma a las cinco de la mañana y el bus
// pasa a las 6:40. Cualquier cosa que dependa de que la administración lo lea
// y lo apruebe llegaría tarde y nadie la usaría.
//
// Sirve para dos cosas a la vez: el conductor no pierde tiempo esperando, y al
// niño no le queda registrado un "no estaba en la parada" que no corresponde.

// Suma días a una fecha "YYYY-MM-DD" sin depender de zonas horarias
function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const d = new Date(anio, mes - 1, dia + dias);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function enPalabras(fecha: string): string {
  const hoy = fechaDeHoy();
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, 1)) return 'Mañana';
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-HN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default function NuevaAusenciaScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();

  const [hijos, setHijos] = useState<Nino[]>([]);
  const [ninoId, setNinoId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(fechaDeHoy());
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!usuario) return;
    listarHijos(usuario.id)
      .then((lista) => {
        setHijos(lista);
        // Con un solo hijo no tiene sentido preguntar de quién se trata
        if (lista.length === 1) setNinoId(lista[0].id);
      })
      .catch(() => setError('No se pudieron cargar tus hijos.'));
  }, [usuario]);

  // No se puede avisar por un día que ya pasó
  const esPasado = fecha < fechaDeHoy();

  const enviar = async () => {
    if (!usuario || !ninoId) return;
    setEnviando(true);
    setError('');
    try {
      await crearAvisoAusencia(usuario.id, {
        ninoId,
        fechaAplicacion: fecha,
        ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
      });
      setListo(true);
    } catch {
      setError('No se pudo enviar el aviso. Revisá tu conexión.');
    } finally {
      setEnviando(false);
    }
  };

  const nombre = hijos.find((h) => h.id === ninoId)?.nombre ?? 'tu hijo';

  if (listo) {
    return (
      <PantallaBase titulo="Aviso enviado" alVolver={() => router.back()}>
        <Tarjeta>
          <Text variant="titleMedium" style={estilosBase.negrita}>
            Listo, el conductor ya lo sabe
          </Text>
          <Text style={estilosBase.tenue}>
            {enPalabras(fecha)} el bus no va a pasar por {nombre}. No hace falta que nadie lo
            apruebe.
          </Text>
        </Tarjeta>
        <Button mode="contained" onPress={() => router.back()}>
          Volver
        </Button>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase titulo="Hoy no viaja" alVolver={() => router.back()}>
      <Tarjeta>
        <Text style={estilosBase.tenue}>
          Avisá que tu hijo no va a usar el bus ese día. El conductor lo ve al salir y no lo
          espera.
        </Text>
        <Text variant="bodySmall" style={{ color: tema.colors.primary, fontFamily: FUENTES.textoNegrita }}>
          No necesita aprobación: se avisa y listo.
        </Text>
      </Tarjeta>

      {hijos.length > 1 && (
        <View style={styles.bloque}>
          <Text variant="titleSmall" style={estilosBase.negrita}>
            ¿Quién no viaja?
          </Text>
          <ChipFiltro
            opciones={hijos.map((h) => ({ id: h.id, etiqueta: h.nombre }))}
            seleccionadaId={ninoId}
            onSeleccionar={setNinoId}
          />
        </View>
      )}

      <View style={styles.bloque}>
        <Text variant="titleSmall" style={estilosBase.negrita}>
          ¿Qué día?
        </Text>
        <View style={styles.filaFecha}>
          <IconButton
            icon="chevron-left"
            mode="contained-tonal"
            disabled={fecha <= fechaDeHoy()}
            onPress={() => setFecha(sumarDias(fecha, -1))}
            accessibilityLabel="Día anterior"
          />
          <Text variant="titleMedium" style={[estilosBase.negrita, styles.fecha]}>
            {enPalabras(fecha)}
          </Text>
          <IconButton
            icon="chevron-right"
            mode="contained-tonal"
            onPress={() => setFecha(sumarDias(fecha, 1))}
            accessibilityLabel="Día siguiente"
          />
        </View>
      </View>

      <Campo
        label="Motivo (opcional)"
        value={motivo}
        onChangeText={setMotivo}
        multiline
        placeholder="Ej.: está enfermo, viaje familiar…"
      />

      <HelperText type="error" visible={!!error}>
        {error}
      </HelperText>

      <Button
        mode="contained"
        icon="bus-alert"
        onPress={enviar}
        loading={enviando}
        disabled={enviando || !ninoId || esPasado}
        contentStyle={styles.contenidoBoton}
      >
        Avisar que no viaja
      </Button>

      {!ninoId && hijos.length > 1 && (
        <Text variant="bodySmall" style={{ color: tema.colors.error, textAlign: 'center' }}>
          Elegí de qué hijo se trata.
        </Text>
      )}
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  bloque: { gap: ESPACIO.interno },
  filaFecha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fecha: { flex: 1, textAlign: 'center', textTransform: 'capitalize' },
  contenidoBoton: { paddingVertical: 8 },
});
