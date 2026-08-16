import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import TileAccion from '@/components/TileAccion';
import TituloSeccion from '@/components/TituloSeccion';
import { escucharMisSolicitudes } from '@/services/solicitudesService';
import { ESPACIO, RADIO, estilosBase } from '@/constants/estilos';
import type { EstadoSolicitud, Solicitud } from '@/types/models';

const ETIQUETA_ESTADO: Record<EstadoSolicitud, string> = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
};

// Bandeja de solicitudes del padre: acá inscribe hijos y pide cambios de
// ubicación; el admin resuelve desde el panel web y el estado se ve en vivo.
export default function SolicitudesScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);

  useEffect(() => {
    if (!usuario) return;
    return escucharMisSolicitudes(usuario.id, setSolicitudes);
  }, [usuario]);

  const colorEstado: Record<EstadoSolicitud, { fondo: string; texto: string }> = {
    pendiente: { fondo: tema.colors.secondaryContainer, texto: tema.colors.onSecondaryContainer },
    aprobada: { fondo: tema.colors.primaryContainer, texto: tema.colors.onPrimaryContainer },
    rechazada: { fondo: tema.colors.errorContainer, texto: tema.colors.onErrorContainer },
  };

  const describir = (s: Solicitud): { titulo: string; detalle: string } => {
    if (s.tipo === 'inscripcion') {
      return {
        titulo: `Inscripción de ${s.datosNino?.nombre ?? '—'}`,
        detalle: 'Alta de un nuevo hijo en el transporte',
      };
    }
    return {
      titulo: s.permanente
        ? 'Cambio de ubicación (permanente)'
        : `Cambio por un día (${s.fechaAplicacion})`,
      detalle: s.alcance === 'recogida' ? 'Cambia dónde se recoge' : 'Cambia dónde se entrega',
    };
  };

  return (
    <PantallaBase titulo="Solicitudes">
      <View style={styles.filaTiles}>
        <TileAccion
          titulo="Inscribir un hijo"
          detalle="Pedir el alta en el transporte"
          icono="account-child"
          onPress={() => router.push('/nueva-inscripcion')}
        />
        <TileAccion
          titulo="Cambio de lugar"
          detalle="Mudanza o solo por un día"
          icono="map-marker-right"
          color="acento"
          onPress={() => router.push('/nueva-solicitud-cambio')}
        />
      </View>

      <TituloSeccion titulo="Lo que pediste" />
      <Text variant="bodySmall" style={estilosBase.tenue}>
        La administración las revisa y te avisa el resultado en esta misma pantalla.
      </Text>

      {solicitudes.length === 0 && (
        <Tarjeta>
          <Text style={estilosBase.tenue}>Todavía no enviaste ninguna solicitud.</Text>
        </Tarjeta>
      )}

      {solicitudes.map((s) => {
        const d = describir(s);
        return (
          <Tarjeta key={s.id}>
            <View style={styles.fila}>
              <View style={styles.datos}>
                <Text variant="titleSmall" style={styles.negrita}>
                  {d.titulo}
                </Text>
                <Text variant="bodySmall" style={estilosBase.tenue}>
                  {d.detalle}
                </Text>
                <Text variant="bodySmall" style={estilosBase.tenue}>
                  Enviada el {s.creadaEn.toDate().toLocaleDateString('es-HN')}
                </Text>
              </View>
              <View style={[styles.pastilla, { backgroundColor: colorEstado[s.estado].fondo }]}>
                <Text variant="labelSmall" style={{ color: colorEstado[s.estado].texto }}>
                  {ETIQUETA_ESTADO[s.estado]}
                </Text>
              </View>
            </View>
            {!!s.respuesta && (
              <Text variant="bodySmall" style={styles.respuesta}>
                Respuesta: {s.respuesta}
              </Text>
            )}
          </Tarjeta>
        );
      })}
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  filaTiles: { flexDirection: 'row', gap: ESPACIO.interno },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: ESPACIO.interno },
  datos: { flex: 1, gap: 2 },
  negrita: { fontWeight: '700' },
  pastilla: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIO.pastilla },
  respuesta: { fontStyle: 'italic', opacity: 0.8 },
});
