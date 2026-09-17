import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Avatar, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import PastillaEstado, { type TonoEstado } from '@/components/PastillaEstado';
import Metrica, { FilaMetricas } from '@/components/Metrica';
import {
  descripcionDeTipo,
  escucharIncidenciasDeHoy,
} from '@/services/incidenciasService';
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
import FichaConductor from '@/components/FichaConductor';
import { ESPACIO, estilosBase } from '@/constants/estilos';
import { saludoDelDia } from '@/utils/tiempo';
import type { Bus, Incidencia, Usuario, Viaje } from '@/types/models';
import CargandoBus from '@/components/CargandoBus';

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
  // Las novedades que reportaron los conductores hoy (rueda pinchada, tranque,
  // lluvia). Llegan en vivo: si algo pasa mientras Francis mira la pantalla,
  // aparece sin que tenga que refrescar.
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  // La ficha de quien maneja una ruta hoy. Los datos se quedan guardados aunque
  // la ficha se cierre, para que no se vacíe de golpe durante el fundido de
  // salida (mismo patrón que en el inicio del padre).
  const [ficha, setFicha] = useState<{
    conductor: Usuario;
    bus?: Bus;
    rutaNombre: string;
    esSuplente: boolean;
    titularNombre?: string;
  } | null>(null);
  const [fichaAbierta, setFichaAbierta] = useState(false);

  // --- Catálogo (rutas, buses, conductores): se carga una vez ---
  const cargar = useCallback(async () => {
    try {
      setError('');
      setCatalogo(await cargarCatalogo());
    } catch {
      setError('No se pudieron cargar las rutas. Revisá tu conexión.');
      setCatalogo({ rutas: [], buses: new Map(), conductores: new Map(), suplencias: new Map() });
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

  // Las novedades de hoy, en vivo. El efecto va acá arriba con el resto de los
  // hooks: más abajo hay un return condicional (la pantalla de carga), y un
  // hook después de un return se ejecuta unas veces sí y otras no — que es
  // justo lo que las reglas de React prohíben.
  useEffect(() => escucharIncidenciasDeHoy(setIncidencias), []);

  const enCurso = filas.filter((f) => f.estado === 'en_curso').length;
  const terminadas = filas.filter((f) => f.estado === 'finalizado').length;
  const sinSalir = filas.filter((f) => f.estado === 'sin_iniciar').length;
  // Los niños del día, sumados sobre todas las rutas
  const totalSubidos = filas.reduce((suma, f) => suma + (f.subidos ?? 0), 0);
  const totalEntregados = filas.reduce((suma, f) => suma + (f.entregados ?? 0), 0);
  const totalNoLeidos = resumenes.reduce((suma, r) => suma + r.noLeidos, 0);

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    const ids = viajes.map((v) => v.id);
    if (ids.length > 0) setConteos(await contarAsistencia(ids).catch(() => new Map()));
    setRefrescando(false);
  };

  // Color de la pastilla de estado: coral = pasando ahora, aqua = cumplido
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
          <CargandoBus texto="Buscando los buses…" />
        </View>
      </PantallaBase>
    );
  }

  // Abre la ficha completa de quien maneja la ruta: la MISMA que ve el padre en
  // su inicio (components/FichaConductor.tsx), con los textos del admin. Es la
  // respuesta a "¿a quién llamo por esta ruta y en qué unidad anda?", que antes
  // obligaba a cruzar la fila del monitoreo con la lista de unidades del panel.
  const abrirFicha = (fila: EstadoRuta) => {
    const conductor = catalogo.conductores.get(fila.conductorId);
    if (!conductor) return;
    setFicha({
      conductor,
      bus: catalogo.buses.get(fila.busId),
      rutaNombre: fila.rutaNombre,
      esSuplente: fila.esSuplente,
      titularNombre: catalogo.suplencias.get(fila.busId)?.titularNombre,
    });
    setFichaAbierta(true);
  };

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

      {/* ================================================================
          RESUMEN DE LA OPERACIÓN — el tablero del día
          ================================================================
          Es lo primero que Francis mira desde la calle, así que va todo junto
          en UNA lámina y no en tres tarjetas sueltas: el título dice de qué
          turno se está hablando, la pastilla dice si hay algo rodando ahora
          mismo, y las tres casillas dan los números.

          El renglón de niños está debajo de las rutas y no arriba a propósito:
          la pregunta del dueño es primero "¿salieron todas las rutas?" y
          recién después "¿cuántos niños van arriba?". */}
      <Tarjeta>
        <View style={estilosBase.filaEntre}>
          <View style={styles.tituloResumen}>
            <Text variant="titleLarge">Operación de hoy</Text>
            <Text variant="bodySmall" style={estilosBase.tenue}>
              {filas.length} {filas.length === 1 ? 'ruta programada' : 'rutas programadas'}
            </Text>
          </View>
          <PastillaEstado
            texto={enCurso > 0 ? 'En vivo' : 'Sin viajes'}
            tono={enCurso > 0 ? 'vivo' : 'espera'}
            pulso={enCurso > 0}
          />
        </View>

        <FilaMetricas>
          <Metrica
            etiqueta="En curso"
            valor={enCurso}
            de={filas.length}
            pie="Rodando"
            icono="bus-marker"
            tono="vivo"
          />
          <Metrica
            etiqueta="Terminadas"
            valor={terminadas}
            pie="Del día"
            icono="check-circle"
            tono="cumplido"
          />
          <Metrica
            etiqueta="Sin salir"
            valor={sinSalir}
            pie="Pendientes"
            icono="clock-outline"
            tono="neutro"
          />
        </FilaMetricas>

        {/* Los niños del día, sumando lo que ya reportó cada ruta. Solo aparece
            cuando hay algo que contar: un renglón de ceros no informa nada. */}
        {(totalSubidos > 0 || totalEntregados > 0) && (
          <View style={estilosBase.filaEntre}>
            <Text variant="labelMedium" style={estilosBase.tenue}>
              ALUMNOS DE HOY
            </Text>
            <View style={styles.filaAlumnos}>
              <Text variant="labelMedium" style={{ color: tema.colors.primary }}>
                <Text style={estilosBase.cifra}>{totalSubidos}</Text> subieron
              </Text>
              <Text variant="labelMedium" style={{ color: tema.colors.secondary }}>
                <Text style={estilosBase.cifra}>{totalEntregados}</Text> entregados
              </Text>
            </View>
          </View>
        )}
      </Tarjeta>

      {/* ================================================================
          NOVEDADES DE HOY
          ================================================================
          Lo que los conductores reportaron desde la calle. Va ARRIBA de las
          rutas y no al final: si un bus se quedó con una rueda pinchada, eso
          es lo primero que Francis tiene que ver al abrir la app — antes que
          cualquier contador.

          Solo aparece cuando hay algo. Una sección vacía que dice "sin
          novedades" ocupa lugar todos los días para no informar nada. */}
      {incidencias.length > 0 && (
        <>
          <TituloSeccion
            titulo="Novedades de hoy"
            detalle={`${incidencias.length} ${incidencias.length === 1 ? 'aviso' : 'avisos'}`}
          />
          {incidencias.map((inc) => (
            <Tarjeta key={inc.id}>
              <View style={styles.filaTitulo}>
                <View
                  style={[
                    styles.circuloEstado,
                    { backgroundColor: 'rgba(245, 158, 11, 0.18)' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="alert-outline"
                    size={21}
                    color={tema.colors.tertiary}
                  />
                </View>
                <View style={styles.textoFila}>
                  <Text variant="titleSmall" numberOfLines={1}>
                    {descripcionDeTipo(inc.tipo)}
                  </Text>
                  {/* Todo el contexto en un renglón: quién, en qué unidad y en
                      qué ruta. Es exactamente lo que hace falta para levantar
                      el teléfono y resolver, sin abrir nada más. */}
                  <Text variant="bodySmall" numberOfLines={2} style={estilosBase.tenue}>
                    {inc.conductorNombre} · Unidad {inc.busPlaca} · {inc.rutaNombre}
                  </Text>
                </View>
                <PastillaEstado
                  texto={inc.hora.toDate().toLocaleTimeString('es-HN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  tono="aviso"
                />
              </View>

              {!!inc.texto && (
                <Text variant="bodyMedium" style={styles.textoIncidencia}>
                  “{inc.texto}”
                </Text>
              )}

              <Text variant="labelMedium" style={estilosBase.tenue}>
                {inc.ninosABordo === 0
                  ? 'Sin niños a bordo en ese momento'
                  : `${inc.ninosABordo} ${inc.ninosABordo === 1 ? 'niño iba' : 'niños iban'} a bordo · a sus padres ya se les avisó`}
              </Text>
            </Tarjeta>
          ))}
        </>
      )}

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
                  {fila.horaSalida ? ` · sale ${fila.horaSalida}` : ''}
                </Text>
              </View>

              <PastillaEstado
                texto={ETIQUETA_ESTADO[fila.estado]}
                tono={TONO_ESTADO[fila.estado]}
                // Late solo la ruta que está en la calle ahora mismo: en una
                // lista de ocho rutas, eso es lo que Francis busca de un vistazo
                pulso={fila.estado === 'en_curso'}
              />
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
                {/* Tocar el nombre abre su ficha (foto, unidad, teléfono, y
                    desde ahí llamar o escribir). Antes esto iba directo al chat:
                    era un atajo más corto, pero dejaba fuera lo que el dueño
                    necesita cuando pregunta por una ruta — qué unidad anda y
                    quién la está cubriendo hoy. */}
                <TouchableRipple
                  borderless
                  style={styles.accionPie}
                  onPress={() => abrirFicha(fila)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver la ficha de ${fila.conductorNombre}`}
                >
                  <View style={styles.filaAccionPie}>
                    <MaterialCommunityIcons
                      name="card-account-details-outline"
                      size={17}
                      color={tema.colors.primary}
                    />
                    <Text variant="labelLarge" numberOfLines={1} style={{ color: tema.colors.primary }}>
                      {/* Un día de suplencia se llama al que maneja, no al titular */}
                      {fila.conductorNombre}
                      {fila.esSuplente ? ' · suplente' : ''}
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

      {/* La ficha de quien maneja la ruta: la misma hoja que ve el padre */}
      <FichaConductor
        visible={fichaAbierta}
        conductor={ficha?.conductor ?? null}
        bus={ficha?.bus}
        rutaNombre={ficha?.rutaNombre ?? null}
        vista="admin"
        esSuplente={ficha?.esSuplente}
        titularNombre={ficha?.titularNombre}
        onCerrar={() => setFichaAbierta(false)}
        onEscribir={(conductor) => {
          setFichaAbierta(false);
          router.push({
            pathname: '/conversacion',
            params: {
              otroId: conductor.id,
              otroNombre: conductor.nombre,
              otroTelefono: conductor.telefono,
            },
          });
        }}
      />
    </PantallaBase>
  );
}

// Uno de los tres números de arriba
// Qué tono del sistema le toca a cada estado de una ruta. Los mismos cuatro de
// toda la app: gris lo que no empezó, ZAFIRO lo que está pasando, ESMERALDA lo
// que se cumplió.
const TONO_ESTADO: Record<EstadoRuta['estado'], TonoEstado> = {
  sin_iniciar: 'espera',
  en_curso: 'vivo',
  finalizado: 'cumplido',
};

// Un dato suelto de la ficha de una ruta: un ícono chico y su texto.
// `alerta` lo pinta en rojo — lo usa la señal del GPS cuando se cortó.
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

  cuadro: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: ESPACIO.interno + 2 },

  tituloResumen: { gap: 1 },
  // Lo que escribió el conductor, en cursiva y entre comillas: se lee como una
  // cita textual y no como texto de la app
  textoIncidencia: { fontStyle: 'italic' },
  filaAlumnos: { flexDirection: 'row', gap: ESPACIO.interno },
  filaTitulo: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
  circuloEstado: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoFila: { flex: 1, gap: 2 },

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
