import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import {
  listarRegistrosDeNino,
  listarRutasDeNino,
  listarViajesDeRutaPorFecha,
} from '@/services/padreService';
import { fechaDeHoy } from '@/services/viajesService';
import { ESPACIO, RADIO, estilosBase } from '@/constants/estilos';
import type { Registro, Ruta, Turno } from '@/types/models';

// Historial de asistencia de un hijo: los ÚLTIMOS 7 DÍAS de una sola vez,
// agrupados por día. Antes se veía un día a la vez con flechas, y el padre caía
// siempre en "hoy": si el bus todavía no había salido, la pantalla se veía vacía
// y había que ir retrocediendo día por día para encontrar algo. Una semana es lo
// que de verdad le sirve (¿a qué hora subió esta semana?) y entra en una sola
// pantalla, sin filtros ni controles nuevos que explicarle.
const DIAS_DE_HISTORIAL = 7;

const ETIQUETA_TURNO: Record<Turno, string> = { manana: 'Mañana', tarde: 'Tarde' };

// Un registro enriquecido con la ruta/turno al que pertenece
interface RegistroConRuta extends Registro {
  rutaNombre: string;
  turno?: Turno;
}

// Los registros de un día, ya ordenados
interface DiaDeHistorial {
  fecha: string;
  registros: RegistroConRuta[];
}

// Suma (o resta) días a una fecha "YYYY-MM-DD" sin librerías externas
function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const d = new Date(anio, mes - 1, dia + dias);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Encabezado de cada día: "Hoy", "Ayer" o el día escrito (ej. "lunes, 4 de agosto")
function etiquetaDia(fecha: string): string {
  const hoy = fechaDeHoy();
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, -1)) return 'Ayer';
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-HN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default function HistorialScreen() {
  const router = useRouter();
  const tema = useTheme();
  const params = useLocalSearchParams<{ ninoId: string; hijoNombre: string }>();

  // null = todavía cargando (distingue "cargando" de "no hay nada")
  const [rutas, setRutas] = useState<Ruta[] | null>(null);
  const [dias, setDias] = useState<DiaDeHistorial[] | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  // Las rutas del niño se traen una sola vez (no dependen de la fecha)
  useEffect(() => {
    if (params.ninoId) {
      listarRutasDeNino(params.ninoId)
        .then(setRutas)
        .catch(() => setRutas([]));
    }
  }, [params.ninoId]);

  const cargar = useCallback(async () => {
    if (!params.ninoId || rutas === null) return;
    if (rutas.length === 0) {
      setDias([]);
      return;
    }
    try {
      // Hoy y los 6 días anteriores. Se piden todos a la vez; cada consulta usa
      // solo igualdades (rutaId+fecha, viajeId+ninoId), así que no hace falta
      // ningún índice compuesto.
      const fechas = Array.from({ length: DIAS_DE_HISTORIAL }, (_, i) =>
        sumarDias(fechaDeHoy(), -i)
      );

      const resultado = await Promise.all(
        fechas.map(async (fecha): Promise<DiaDeHistorial> => {
          const porRuta = await Promise.all(
            rutas.map(async (ruta) => {
              const viajes = await listarViajesDeRutaPorFecha(ruta.id, fecha);
              const porViaje = await Promise.all(
                viajes.map(async (viaje) => {
                  const propios = await listarRegistrosDeNino(viaje.id, params.ninoId);
                  return propios.map(
                    (r): RegistroConRuta => ({
                      ...r,
                      rutaNombre: ruta.nombre,
                      turno: ruta.turno,
                    })
                  );
                })
              );
              return porViaje.flat();
            })
          );
          return {
            fecha,
            registros: porRuta.flat().sort((a, b) => a.hora.toMillis() - b.hora.toMillis()),
          };
        })
      );

      // Los días sin ningún registro no se muestran (fines de semana, feriados):
      // el padre solo quiere ver los días en que su hijo viajó.
      setDias(resultado.filter((d) => d.registros.length > 0));
    } catch {
      setDias([]);
    }
  }, [params.ninoId, rutas]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const formatoHora = (registro: Registro) =>
    registro.hora.toDate().toLocaleTimeString('es-HN', {
      hour: '2-digit',
      minute: '2-digit',
    });

  if (dias === null) {
    return (
      <PantallaBase
        titulo={`Historial de ${params.hijoNombre ?? ''}`}
        subtitulo="Últimos 7 días"
        alVolver={() => router.back()}
        scroll={false}
      >
        <View style={estilosBase.centrado}>
          <ActivityIndicator size="large" />
        </View>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase
      titulo={`Historial de ${params.hijoNombre ?? ''}`}
      subtitulo="Últimos 7 días"
      alVolver={() => router.back()}
      refrescando={refrescando}
      onRefrescar={refrescar}
    >
      {dias.length === 0 && (
        <Tarjeta>
          {rutas?.length === 0 ? (
            // Sin ruta no hay viajes, y por lo tanto nunca va a haber
            // registros: se dice por qué, en vez de mostrar una lista vacía.
            <Text>
              Todavía no está asignado a una ruta, así que no tiene viajes registrados. La
              administración lo asigna cuando arma los recorridos.
            </Text>
          ) : (
            <Text>No hay viajes registrados en los últimos 7 días.</Text>
          )}
        </Tarjeta>
      )}

      {dias.map((dia) => (
        <View key={dia.fecha} style={styles.grupoDia}>
          <Text variant="titleSmall" style={styles.tituloDia}>
            {etiquetaDia(dia.fecha)}
          </Text>
          <Tarjeta>
            {dia.registros.map((registro, indice) => (
              <View
                key={registro.id}
                style={[
                  styles.filaRegistro,
                  indice > 0 && { borderTopWidth: 1, borderTopColor: tema.colors.outlineVariant },
                ]}
              >
                <View
                  style={[
                    styles.circulo,
                    {
                      backgroundColor:
                        registro.evento === 'subio'
                          ? tema.colors.primaryContainer
                          : tema.colors.surfaceVariant,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={registro.evento === 'subio' ? 'bus' : 'home-import-outline'}
                    size={19}
                    color={
                      registro.evento === 'subio'
                        ? tema.colors.onPrimaryContainer
                        : tema.colors.onSurfaceVariant
                    }
                  />
                </View>
                <View style={styles.datos}>
                  <Text variant="bodyLarge">
                    {registro.evento === 'subio' ? 'Subió al bus' : 'Bajó del bus'}
                  </Text>
                  <Text variant="bodySmall" style={estilosBase.tenue}>
                    {formatoHora(registro)} · {registro.rutaNombre}
                  </Text>
                </View>
                {registro.turno && (
                  <View style={[styles.pastilla, { borderColor: tema.colors.outlineVariant }]}>
                    <Text variant="labelSmall" style={estilosBase.tenue}>
                      {ETIQUETA_TURNO[registro.turno]}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </Tarjeta>
        </View>
      ))}
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  grupoDia: { gap: ESPACIO.interno },
  // La primera letra del día viene en minúscula del toLocaleDateString
  tituloDia: { textTransform: 'capitalize', fontWeight: '700' },
  filaRegistro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIO.interno,
    paddingVertical: 10,
  },
  circulo: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  datos: { flex: 1, gap: 1 },
  pastilla: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIO.pastilla,
    borderWidth: 1,
  },
});
