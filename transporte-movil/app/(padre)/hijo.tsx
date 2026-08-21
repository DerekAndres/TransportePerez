import { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import TituloSeccion from '@/components/TituloSeccion';
import {
  actualizarFotoNino,
  listarRutasDeNino,
  listarViajesDeRutaPorFecha,
  obtenerBus,
  obtenerEscuela,
  obtenerNino,
} from '@/services/padreService';
import { fechaDeHoy, turnoActual } from '@/services/viajesService';
import { elegirFotoComprimida } from '@/utils/fotos';
import { ALTURA, ESPACIO, RADIO, estilosBase } from '@/constants/estilos';
import type { Bus, Nino, Ruta, TurnoNino, Viaje } from '@/types/models';

// Perfil de un hijo: todos sus datos en una sola pantalla, para que el padre
// pueda revisar de un vistazo lo que la administración tiene cargado de él (su
// escuela, dónde se lo recoge, en qué unidad viaja) y avisar si algo está mal.
// Es solo de lectura, con una excepción: la foto la puede cambiar él.

const ETIQUETA_TURNO: Record<TurnoNino, string> = {
  manana: 'Viaja en la mañana',
  tarde: 'Viaja en la tarde',
  ambos: 'Viaja mañana y tarde',
};

// Fila "etiqueta / valor" de la ficha de datos
function Dato({
  icono,
  etiqueta,
  valor,
  referencia,
}: {
  icono: keyof typeof MaterialCommunityIcons.glyphMap;
  etiqueta: string;
  valor: string;
  referencia?: string;
}) {
  const tema = useTheme();
  return (
    <View style={styles.filaDato}>
      <View style={[styles.circulo, { backgroundColor: tema.colors.surfaceVariant }]}>
        <MaterialCommunityIcons name={icono} size={19} color={tema.colors.onSurfaceVariant} />
      </View>
      <View style={styles.textoDato}>
        <Text variant="bodySmall" style={estilosBase.tenue}>
          {etiqueta}
        </Text>
        <Text variant="bodyLarge">{valor}</Text>
        {!!referencia && (
          <Text variant="bodySmall" style={styles.referencia}>
            📍 {referencia}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function PerfilHijoScreen() {
  const router = useRouter();
  const tema = useTheme();
  const params = useLocalSearchParams<{ ninoId: string }>();

  const [nino, setNino] = useState<Nino | null>(null);
  const [escuelaNombre, setEscuelaNombre] = useState('—');
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [bus, setBus] = useState<Bus | null>(null);
  const [viajeEnCurso, setViajeEnCurso] = useState<Viaje | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    if (!params.ninoId) return;
    setError('');
    try {
      const datos = await obtenerNino(params.ninoId);
      setNino(datos);
      if (!datos) {
        setError('No se encontró a este niño.');
        return;
      }

      // La escuela y las rutas son independientes entre sí: se piden a la vez
      const [escuela, susRutas] = await Promise.all([
        datos.escuelaId ? obtenerEscuela(datos.escuelaId) : Promise.resolve(null),
        listarRutasDeNino(datos.id),
      ]);
      setEscuelaNombre(escuela?.nombre ?? '—');
      setRutas(susRutas);

      const busId = susRutas.find((r) => r.busId)?.busId;
      setBus(busId ? await obtenerBus(busId) : null);

      // Viaje en curso de hoy en cualquiera de sus rutas: habilita el mapa
      const viajesHoy = (
        await Promise.all(susRutas.map((r) => listarViajesDeRutaPorFecha(r.id, fechaDeHoy())))
      ).flat();
      setViajeEnCurso(viajesHoy.find((v) => v.estado === 'en_curso') ?? null);
    } catch {
      setError('No se pudo cargar el perfil. Revisá tu conexión.');
    } finally {
      setCargando(false);
    }
  }, [params.ninoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const cambiarFoto = async () => {
    if (!nino) return;
    try {
      const foto = await elegirFotoComprimida();
      if (!foto) return;
      await actualizarFotoNino(nino.id, foto);
      setNino({ ...nino, foto });
    } catch {
      // sin drama: la foto es un extra
    }
  };

  const verMapa = () => {
    if (!viajeEnCurso || !nino) return;
    // En la tarde el destino real puede ser la entrega alternativa (paradaTarde)
    const destino = turnoActual() === 'tarde' && nino.paradaTarde ? nino.paradaTarde : nino.parada;
    router.push({
      pathname: '/mapa',
      params: {
        viajeId: viajeEnCurso.id,
        hijoNombre: nino.nombre,
        paradaNombre: destino?.nombre ?? '',
        paradaLat: String(destino?.lat ?? ''),
        paradaLng: String(destino?.lng ?? ''),
      },
    });
  };

  if (cargando) {
    return (
      <PantallaBase titulo="Perfil" alVolver={() => router.back()} scroll={false}>
        <View style={estilosBase.centrado}>
          <ActivityIndicator size="large" />
        </View>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase
      titulo={nino?.nombre ?? 'Perfil'}
      alVolver={() => router.back()}
      refrescando={refrescando}
      onRefrescar={refrescar}
    >
      {error !== '' && <Text style={{ color: tema.colors.error }}>{error}</Text>}

      {nino && (
        <>
          {/* Encabezado: foto grande y datos básicos */}
          <Tarjeta>
            <View style={styles.encabezado}>
              <TouchableRipple
                onPress={cambiarFoto}
                borderless
                style={styles.avatarToque}
                accessibilityLabel={`Cambiar foto de ${nino.nombre}`}
              >
                {nino.foto ? (
                  <Avatar.Image size={92} source={{ uri: nino.foto }} />
                ) : (
                  <Avatar.Text
                    size={92}
                    label={nino.nombre.trim().charAt(0).toUpperCase() || '?'}
                    style={{ backgroundColor: tema.colors.primaryContainer }}
                    color={tema.colors.onPrimaryContainer}
                  />
                )}
              </TouchableRipple>
              <Text variant="headlineSmall" style={styles.negrita}>
                {nino.nombre}
              </Text>
              <Text variant="bodyMedium" style={estilosBase.tenue}>
                {nino.grado} · {escuelaNombre}
              </Text>
              {nino.turno && (
                <View style={[styles.pastilla, { backgroundColor: tema.colors.primaryContainer }]}>
                  <Text variant="labelSmall" style={{ color: tema.colors.onPrimaryContainer }}>
                    {ETIQUETA_TURNO[nino.turno]}
                  </Text>
                </View>
              )}
              <Text variant="bodySmall" style={estilosBase.tenue}>
                Tocá la foto para cambiarla
              </Text>
            </View>
          </Tarjeta>

          {/* Dónde se lo recoge y se lo entrega */}
          <TituloSeccion titulo="Dónde viaja" />
          <Tarjeta>
            <Dato
              icono="home-outline"
              etiqueta="Se recoge en"
              valor={nino.parada?.nombre ?? 'Sin marcar'}
              referencia={nino.parada?.referencia}
            />
            {/* Solo si la entrega de la tarde es en OTRO lugar */}
            {nino.paradaTarde && (
              <Dato
                icono="map-marker-check-outline"
                etiqueta="Se entrega en la tarde en"
                valor={nino.paradaTarde.nombre}
                referencia={nino.paradaTarde.referencia}
              />
            )}
            <Text variant="bodySmall" style={estilosBase.tenue}>
              ¿Cambió el lugar? Pedí el cambio desde Solicitudes.
            </Text>
          </Tarjeta>

          {/* Su unidad y su ruta */}
          <TituloSeccion titulo="Su transporte" />
          <Tarjeta sinRelleno>
            {!!bus?.foto && <Image source={{ uri: bus.foto }} style={styles.portada} />}
            <View style={styles.cuerpoTransporte}>
              {rutas.length === 0 ? (
                // Caso muy real: el niño existe pero todavía no lo metieron en
                // ninguna ruta. Sin este aviso, la pantalla parecería rota.
                <Text variant="bodyMedium">
                  Todavía no está asignado a una ruta. La administración lo asigna cuando arma los
                  recorridos; mientras tanto no vas a ver la unidad ni el historial de viajes.
                </Text>
              ) : (
                <>
                  {bus ? (
                    <Dato icono="bus" etiqueta="Unidad" valor={bus.placa} />
                  ) : (
                    <Text variant="bodyMedium">Su ruta todavía no tiene unidad asignada.</Text>
                  )}
                  {rutas.map((ruta) => (
                    <Dato
                      key={ruta.id}
                      icono="routes"
                      etiqueta={ruta.turno === 'tarde' ? 'Ruta de la tarde' : 'Ruta de la mañana'}
                      valor={ruta.nombre}
                    />
                  ))}
                </>
              )}
            </View>
          </Tarjeta>

          <View style={styles.filaBotones}>
            <Button
              mode="contained"
              icon="map-marker"
              disabled={!viajeEnCurso}
              onPress={verMapa}
              style={styles.boton}
            >
              Ver bus
            </Button>
            <Button
              mode="outlined"
              icon="history"
              style={styles.boton}
              onPress={() =>
                router.push({
                  pathname: '/historial',
                  params: { ninoId: nino.id, hijoNombre: nino.nombre },
                })
              }
            >
              Historial
            </Button>
          </View>
          {!viajeEnCurso && (
            <Text variant="bodySmall" style={[estilosBase.tenue, styles.centrado]}>
              El mapa se habilita cuando el bus está en viaje.
            </Text>
          )}
        </>
      )}
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  encabezado: { alignItems: 'center', gap: ESPACIO.minimo },
  negrita: { fontWeight: '700' },
  avatarToque: { borderRadius: 46 },
  pastilla: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIO.pastilla },
  filaDato: { flexDirection: 'row', alignItems: 'flex-start', gap: ESPACIO.interno },
  circulo: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  textoDato: { flex: 1, gap: 1 },
  referencia: { opacity: 0.8, fontStyle: 'italic' },
  portada: { width: '100%', height: ALTURA.portada },
  cuerpoTransporte: { padding: ESPACIO.pantalla, gap: ESPACIO.interno },
  filaBotones: { flexDirection: 'row', gap: ESPACIO.interno },
  boton: { flex: 1, borderRadius: RADIO.control },
  centrado: { textAlign: 'center' },
});
