import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import Campo from '@/components/Campo';
import ChipFiltro from '@/components/ChipFiltro';
import { listarEscuelas, listarHijos } from '@/services/padreService';
import { crearSolicitudEscuela } from '@/services/solicitudesService';
import { ESPACIO, estilosBase } from '@/constants/estilos';
import type { Escuela, Nino } from '@/types/models';

// ============================================
// PEDIDO: CAMBIO DE ESCUELA
// ============================================
// Al padre solo se le pregunta a qué escuela se va su hijo y desde cuándo. Todo
// lo demás lo resuelve la administración al aprobar.
//
// Por qué esto NO es inmediato como el aviso de ausencia: una ruta sirve a
// escuelas concretas, así que el niño puede quedar en un bus que ya no pasa por
// su colegio nuevo. Hay que reacomodarlo, y eso lo decide quien arma las rutas.

export default function NuevaSolicitudEscuelaScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();

  const [hijos, setHijos] = useState<Nino[]>([]);
  const [escuelas, setEscuelas] = useState<Escuela[]>([]);
  const [ninoId, setNinoId] = useState<string | null>(null);
  const [escuelaId, setEscuelaId] = useState<string | null>(null);
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
    listarEscuelas().then(setEscuelas).catch(() => setEscuelas([]));
  }, [usuario]);

  const hijo = hijos.find((h) => h.id === ninoId) ?? null;
  // No tiene sentido ofrecer la escuela donde el niño ya está
  const opcionesEscuela = escuelas.filter((e) => e.id !== hijo?.escuelaId);
  const escuelaActual = escuelas.find((e) => e.id === hijo?.escuelaId)?.nombre;

  // Formato "YYYY-MM-DD" — se valida a mano para no sumar un selector de fechas
  const fechaValida = desde === '' || /^\d{4}-\d{2}-\d{2}$/.test(desde);

  const enviar = async () => {
    if (!usuario || !ninoId || !escuelaId) return;
    setEnviando(true);
    setError('');
    try {
      await crearSolicitudEscuela(usuario.id, {
        ninoId,
        nuevaEscuelaId: escuelaId,
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
            Un cambio de escuela puede significar cambiar de bus, así que primero tienen que
            revisar las rutas. Vas a ver la respuesta en Solicitudes.
          </Text>
        </Tarjeta>
        <Button mode="contained" onPress={() => router.back()}>
          Volver
        </Button>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase titulo="Cambio de escuela" alVolver={() => router.back()}>
      <Tarjeta>
        <Text style={estilosBase.tenue}>
          Pedí que tu hijo pase a otro centro educativo. La administración revisa qué ruta le
          corresponde y te responde.
        </Text>
      </Tarjeta>

      {hijos.length > 1 && (
        <View style={styles.bloque}>
          <Text variant="titleSmall" style={estilosBase.negrita}>
            ¿Qué hijo cambia de escuela?
          </Text>
          <ChipFiltro
            opciones={hijos.map((h) => ({ id: h.id, etiqueta: h.nombre }))}
            seleccionadaId={ninoId}
            onSeleccionar={(id) => {
              setNinoId(id);
              setEscuelaId(null); // la escuela elegida ya no aplica a otro hijo
            }}
          />
        </View>
      )}

      {!!escuelaActual && (
        <Text variant="bodySmall" style={estilosBase.tenue}>
          Escuela actual: {escuelaActual}
        </Text>
      )}

      <View style={styles.bloque}>
        <Text variant="titleSmall" style={estilosBase.negrita}>
          Nueva escuela
        </Text>
        {opcionesEscuela.length === 0 ? (
          <Text variant="bodySmall" style={estilosBase.tenue}>
            No hay otras escuelas cargadas en el sistema. Escribile a la administración por
            Mensajes.
          </Text>
        ) : (
          <ChipFiltro
            opciones={opcionesEscuela.map((e) => ({ id: e.id, etiqueta: e.nombre }))}
            seleccionadaId={escuelaId}
            onSeleccionar={setEscuelaId}
          />
        )}
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
        placeholder="Ej.: nos cambiamos de colegio el próximo mes"
      />

      <HelperText type="error" visible={!!error}>
        {error}
      </HelperText>

      <Button
        mode="contained"
        icon="school-outline"
        onPress={enviar}
        loading={enviando}
        disabled={enviando || !ninoId || !escuelaId || !fechaValida}
        contentStyle={styles.contenidoBoton}
      >
        Enviar solicitud
      </Button>

      <Text variant="bodySmall" style={{ color: tema.colors.onSurfaceVariant }}>
        Mientras no la aprueben, tu hijo sigue viajando como hasta ahora.
      </Text>
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  bloque: { gap: ESPACIO.interno },
  contenidoBoton: { paddingVertical: 8 },
});
