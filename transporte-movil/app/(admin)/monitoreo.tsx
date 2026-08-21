import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import TituloSeccion from '@/components/TituloSeccion';
import TileAccion from '@/components/TileAccion';
import AparicionSuave from '@/components/AparicionSuave';
import {
  armarEstadoDeRutas,
  cargarCatalogo,
  contarAsistencia,
  escucharViajesConSenal,
  escucharViajesDeHoy,
  type CatalogoRutas,
  type EstadoRuta,
} from '@/services/adminService';
import { escucharBandeja, type ResumenConversacion } from '@/services/mensajesService';
import { fechaDeHoy } from '@/services/viajesService';
import { ESPACIO, RADIO, estilosBase } from '@/constants/estilos';
import { saludoDelDia } from '@/utils/tiempo';
import type { Viaje } from '@/types/models';

// ============================================
// MONITOREO — el inicio del admin en el teléfono
// ============================================
// Una sola pregunta contestada de un vistazo: ¿cómo van las rutas de hoy?
// Arriba, tres números (en curso · terminadas · sin salir). Debajo, una fila por
// ruta con su conductor, su unidad, la hora en que arrancó y si el bus está
// mandando su posición.
//
// Todo llega EN VIVO (dos suscripciones: los viajes de hoy y la colección de
// ubicaciones), así que el admin no tiene que refrescar para ver que un bus
// salió. La asistencia (cuántos subieron y bajaron) se cuenta al entrar y al
// deslizar para refrescar — es la única lectura pesada y no cambia tan rápido.

const ETIQUETA_ESTADO: Record<EstadoRuta['estado'], string> = {
  sin_iniciar: 'Sin salir',
  en_curso: 'En curso',
  finalizado: 'Terminada',
};

const ICONO_ESTADO: Record<EstadoRuta['estado'], keyof typeof MaterialCommunityIcons.glyphMap> = {
  sin_iniciar: 'clock-outline',
  en_curso: 'bus-marker',
  finalizado: 'check-circle',
};

export default function MonitoreoScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();

  const [catalogo, setCatalogo] = useState<CatalogoRutas | null>(null);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [conSenal, setConSenal] = useState<Set<string>>(new Set());
  const [conteos, setConteos] = useState<Map<string, { subidos: number; entregados: number }>>(
    new Map()
  );
  const [resumenes, setResumenes] = useState<ResumenConversacion[]>([]);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState('');

  // --- Catálogo (rutas, buses, conductores): se carga una vez ---
  const cargar = useCallback(async () => {
    try {
      setError('');
      setCatalogo(await cargarCatalogo());
    } catch {
      setError('No se pudieron cargar las rutas. Revisá tu conexión.');
      setCatalogo({ rutas: [], buses: new Map(), conductores: new Map() });
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // --- Viajes de hoy y señal de GPS, en vivo ---
  useEffect(() => escucharViajesDeHoy(fechaDeHoy(), setViajes), []);
  useEffect(() => escucharViajesConSenal(setConSenal), []);

  // --- Bandeja de mensajes, en vivo (para el contador de sin leer) ---
  useEffect(() => {
    if (!usuario) return;
    return escucharBandeja(usuario.id, setResumenes);
  }, [usuario]);

  // --- Asistencia: al entrar y al refrescar ---
  // La clave son los ids de los viajes: se recuenta cuando aparece un viaje
  // nuevo, no en cada latido del GPS.
  const clavesViajes = viajes.map((v) => v.id).join(',');
  useEffect(() => {
    const ids = clavesViajes ? clavesViajes.split(',') : [];
    if (ids.length === 0) {
      setConteos(new Map());
      return;
    }
    let cancelado = false;
    contarAsistencia(ids)
      .then((c) => {
        if (!cancelado) setConteos(c);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [clavesViajes]);

  const filas = useMemo(
    () => (catalogo ? armarEstadoDeRutas(catalogo, viajes, conSenal, conteos) : []),
    [catalogo, viajes, conSenal, conteos]
  );

  const enCurso = filas.filter((f) => f.estado === 'en_curso').length;
  const terminadas = filas.filter((f) => f.estado === 'finalizado').length;
  const sinSalir = filas.filter((f) => f.estado === 'sin_iniciar').length;
  const totalNoLeidos = resumenes.reduce((suma, r) => suma + r.noLeidos, 0);

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    const ids = viajes.map((v) => v.id);
    if (ids.length > 0) setConteos(await contarAsistencia(ids).catch(() => new Map()));
    setRefrescando(false);
  };

  // Color de la pastilla de estado: coral = pasando ahora, aqua = cumplido
  const colorEstado: Record<EstadoRuta['estado'], { fondo: string; texto: string }> = {
    sin_iniciar: { fondo: tema.colors.surfaceVariant, texto: tema.colors.onSurfaceVariant },
    en_curso: { fondo: tema.colors.primary, texto: tema.colors.onPrimary },
    finalizado: { fondo: tema.colors.secondaryContainer, texto: tema.colors.onSecondaryContainer },
  };

  const avatarUsuario = (
    <TouchableRipple
      onPress={() => router.push('/configuracion')}
      borderless
      style={styles.avatarToque}
      accessibilityLabel="Ir a configuración"
    >
      {usuario?.foto ? (
        <Avatar.Image size={38} source={{ uri: usuario.foto }} />
      ) : (
        <Avatar.Text
          size={38}
          label={usuario?.nombre.trim().charAt(0).toUpperCase() || '?'}
          style={{ backgroundColor: tema.colors.primaryContainer }}
          color={tema.colors.onPrimaryContainer}
        />
      )}
    </TouchableRipple>
  );

  if (!catalogo) {
    return (
      <PantallaBase scroll={false} accionDerecha={avatarUsuario}>
        <View style={estilosBase.centrado}>
          <ActivityIndicator size="large" />
        </View>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase accionDerecha={avatarUsuario} refrescando={refrescando} onRefrescar={refrescar}>
      <View style={styles.saludo}>
        <Text variant="headlineMedium">
          {saludoDelDia()}, {usuario?.nombre?.split(' ')[0] ?? ''}
        </Text>
        <Text variant="bodyMedium" style={[estilosBase.tenue, styles.fecha]}>
          {new Date().toLocaleDateString('es-HN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Text>
      </View>

      {error !== '' && <Text style={{ color: tema.colors.error }}>{error}</Text>}

      {/* Los tres números del día */}
      <View style={styles.filaCuadros}>
        <Cuadro valor={enCurso} etiqueta="En curso" icono="bus-marker" tono="primario" />
        <Cuadro valor={terminadas} etiqueta="Terminadas" icono="check-circle" tono="cumplido" />
        <Cuadro valor={sinSalir} etiqueta="Sin salir" icono="clock-outline" tono="neutro" />
      </View>

      {/* Estado de cada ruta */}
      <TituloSeccion titulo="Rutas de hoy" />

      {filas.length === 0 && (
        <Tarjeta>
          <Text style={estilosBase.tenue}>
            No hay rutas activas. Se crean desde el panel web.
          </Text>
        </Tarjeta>
      )}

      {filas.map((fila, indice) => (
        <AparicionSuave key={fila.rutaId} indice={indice}>
          <Tarjeta>
            <View style={styles.filaTitulo}>
              <View
                style={[
                  styles.circuloEstado,
                  {
                    backgroundColor:
                      fila.estado === 'en_curso'
                        ? tema.colors.primaryContainer
                        : fila.estado === 'finalizado'
                          ? tema.colors.secondaryContainer
                          : tema.colors.surfaceVariant,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={ICONO_ESTADO[fila.estado]}
                  size={21}
                  color={
                    fila.estado === 'en_curso'
                      ? tema.colors.onPrimaryContainer
                      : fila.estado === 'finalizado'
                        ? tema.colors.onSecondaryContainer
                        : tema.colors.onSurfaceVariant
                  }
                />
              </View>

              <View style={styles.textoFila}>
                <Text variant="titleSmall" numberOfLines={1}>
                  {fila.rutaNombre}
                </Text>
                <Text variant="bodySmall" numberOfLines={1} style={estilosBase.tenue}>
                  {fila.turno === 'tarde' ? 'Tarde' : fila.turno === 'manana' ? 'Mañana' : 'Sin turno'}
                  {' · '}
                  {fila.busPlaca} · {fila.ninosTotal} niños
                </Text>
              </View>

              <View style={[styles.pastilla, { backgroundColor: colorEstado[fila.estado].fondo }]}>
                <Text variant="labelSmall" style={{ color: colorEstado[fila.estado].texto }}>
                  {ETIQUETA_ESTADO[fila.estado]}
                </Text>
              </View>
            </View>

            {/* Detalle del viaje: horas, asistencia y señal */}
            {fila.estado !== 'sin_iniciar' && (
              <View style={[styles.detalle, { borderTopColor: tema.colors.outlineVariant }]}>
                <Dato icono="clock-start" texto={`Salió ${fila.horaInicio ?? '—'}`} />
                {fila.estado === 'finalizado' && (
                  <Dato icono="clock-end" texto={`Terminó ${fila.horaFin ?? '—'}`} />
                )}
                <Dato
                  icono="account-check"
                  texto={`${fila.subidos} subieron · ${fila.entregados} entregados`}
                />
                {fila.estado === 'en_curso' && (
                  <Dato
                    icono={fila.conSenal ? 'access-point' : 'access-point-off'}
                    texto={fila.conSenal ? 'Mandando ubicación' : 'Sin señal del GPS'}
                    alerta={!fila.conSenal}
                  />
                )}
              </View>
            )}

            {/* El conductor, a un toque: chat o llamada */}
            {!!fila.conductorId && (
              <View style={[styles.pieTarjeta, { borderTopColor: tema.colors.outlineVariant }]}>
                <TouchableRipple
                  borderless
                  style={styles.accionPie}
                  onPress={() =>
                    router.push({
                      pathname: '/conversacion',
                      params: {
                        otroId: fila.conductorId,
                        otroNombre: fila.conductorNombre,
                        otroTelefono: fila.conductorTelefono,
                      },
                    })
                  }
                >
                  <View style={styles.filaAccionPie}>
                    <MaterialCommunityIcons
                      name="message-text"
                      size={17}
                      color={tema.colors.primary}
                    />
                    <Text variant="labelLarge" numberOfLines={1} style={{ color: tema.colors.primary }}>
                      {fila.conductorNombre}
                    </Text>
                  </View>
                </TouchableRipple>

                {!!fila.conductorTelefono && (
                  <TouchableRipple
                    borderless
                    style={styles.accionLlamar}
                    onPress={() =>
                      Linking.openURL(`tel:${fila.conductorTelefono}`).catch(() => {})
                    }
                    accessibilityLabel={`Llamar a ${fila.conductorNombre}`}
                  >
                    <MaterialCommunityIcons name="phone" size={19} color={tema.colors.primary} />
                  </TouchableRipple>
                )}
              </View>
            )}
          </Tarjeta>
        </AparicionSuave>
      ))}

      {/* Lo demás que el admin puede hacer desde el teléfono */}
      <View style={styles.filaTiles}>
        <TileAccion
          titulo="Mensajes"
          detalle={resumenes[0]?.ultimoTexto ?? 'Padres y conductores'}
          icono="message-text"
          insignia={totalNoLeidos}
          onPress={() => router.push('/mensajes')}
        />
        <TileAccion
          titulo="Publicar aviso"
          detalle="Comunicado a un canal"
          icono="bullhorn"
          color="acento"
          onPress={() => router.push('/avisos')}
        />
      </View>

      <Tarjeta>
        <View style={styles.filaSimple}>
          <MaterialCommunityIcons name="laptop" size={20} color={tema.colors.onSurfaceVariant} />
          <Text variant="bodySmall" style={[estilosBase.tenue, styles.textoFila]}>
            Crear usuarios, buses, escuelas, niños y rutas se hace desde el panel web.
          </Text>
        </View>
      </Tarjeta>
    </PantallaBase>
  );
}

// Uno de los tres números de arriba
function Cuadro({
  valor,
  etiqueta,
  icono,
  tono,
}: {
  valor: number;
  etiqueta: string;
  icono: keyof typeof MaterialCommunityIcons.glyphMap;
  tono: 'primario' | 'cumplido' | 'neutro';
}) {
  const tema = useTheme();
  const color =
    tono === 'primario'
      ? tema.colors.primary
      : tono === 'cumplido'
        ? tema.colors.secondary
        : tema.colors.onSurfaceVariant;

  return (
    <Tarjeta style={styles.cuadro}>
      <MaterialCommunityIcons name={icono} size={20} color={color} />
      <Text variant="headlineSmall" style={{ color }}>
        {valor}
      </Text>
      <Text variant="labelSmall" style={estilosBase.tenue}>
        {etiqueta}
      </Text>
    </Tarjeta>
  );
}

// Renglón del detalle de un viaje
function Dato({
  icono,
  texto,
  alerta,
}: {
  icono: keyof typeof MaterialCommunityIcons.glyphMap;
  texto: string;
  alerta?: boolean;
}) {
  const tema = useTheme();
  const color = alerta ? tema.colors.error : tema.colors.onSurfaceVariant;
  return (
    <View style={styles.filaDato}>
      <MaterialCommunityIcons name={icono} size={15} color={color} />
      <Text variant="bodySmall" style={{ color }}>
        {texto}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  saludo: { gap: 2 },
  fecha: { textTransform: 'capitalize' },
  avatarToque: { borderRadius: 19 },

  filaCuadros: { flexDirection: 'row', gap: ESPACIO.interno },
  cuadro: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: ESPACIO.interno + 2 },

  filaTitulo: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
  circuloEstado: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoFila: { flex: 1, gap: 2 },
  pastilla: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIO.pastilla },

  detalle: { borderTopWidth: 1, paddingTop: ESPACIO.interno, gap: 5 },
  filaDato: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  pieTarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    marginHorizontal: -ESPACIO.pantalla,
    marginBottom: -ESPACIO.pantalla,
    paddingHorizontal: ESPACIO.interno,
  },
  accionPie: { flex: 1, paddingVertical: 13 },
  filaAccionPie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  accionLlamar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  filaTiles: { flexDirection: 'row', gap: ESPACIO.interno },
  filaSimple: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
});
