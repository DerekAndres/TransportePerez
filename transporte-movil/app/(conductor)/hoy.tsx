import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useEmisionUbicacion, type EstadoGps } from '@/hooks/use-emision-ubicacion';
import GrupoAsistencia, { type ItemAsistencia } from '@/components/GrupoAsistencia';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import TituloSeccion from '@/components/TituloSeccion';
import {
  derivarRecorrido,
  escucharRutasDelBus,
  listarEscuelasDeRuta,
  listarNinosDeRuta,
  listarPuntosPorIds,
  obtenerBusDelConductor,
  puntoIdsDeRuta,
} from '@/services/conductorService';
import {
  fechaDeHoy,
  finalizarViaje,
  iniciarViaje,
  listarRegistrosDeViaje,
  listarViajesDeHoy,
  registrarEvento,
  registrarEventos,
  turnoActual,
} from '@/services/viajesService';
import { listarCambiosPuntualesDeHoy } from '@/services/solicitudesService';
import { limpiarUbicacion } from '@/services/ubicacionesService';
import { notificarEventoAlPadre, notificarProximidad } from '@/services/notificacionesService';
import { ESPACIO, RADIO, estilosBase } from '@/constants/estilos';
import type {
  Bus,
  Escuela,
  EventoRegistro,
  Nino,
  Punto,
  Registro,
  Ruta,
  Solicitud,
  Turno,
  Viaje,
} from '@/types/models';

const ETIQUETA_GPS: Record<EstadoGps, string> = {
  inactivo: 'GPS inactivo',
  activo: 'Ubicación en vivo activa',
  sin_permiso: 'Sin permiso de ubicación',
  error: 'Error de GPS',
};

const ETIQUETA_TURNO: Record<Turno, string> = { manana: 'Mañana', tarde: 'Tarde' };

type EstadoNino = 'pendiente' | 'en_bus' | 'entregado';

// Agrupa niños por el nombre de su parada (casa). Hermanos que comparten el
// nombre de casa quedan juntos. Con `entregaTarde`, la ENTREGA de la tarde usa
// nino.paradaTarde si existe (el niño se deja en otro lugar, ej. la abuela).
function agruparPorParada(
  ninos: Nino[],
  entregaTarde = false
): { titulo: string; ninos: Nino[] }[] {
  const mapa = new Map<string, Nino[]>();
  ninos.forEach((n) => {
    const parada = entregaTarde ? (n.paradaTarde ?? n.parada) : n.parada;
    const clave = parada?.nombre ?? 'Sin casa';
    const arr = mapa.get(clave);
    if (arr) arr.push(n);
    else mapa.set(clave, [n]);
  });
  return [...mapa.entries()].map(([titulo, ninos]) => ({ titulo, ninos }));
}

export default function MiRutaDeHoyScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();

  const [cargando, setCargando] = useState(true);
  const [sinAsignacion, setSinAsignacion] = useState('');
  const [bus, setBus] = useState<Bus | null>(null);
  // TODAS las rutas activas del bus, sin filtrar por hora: el conductor elige
  // cuál va a manejar (puede arrancar la de la tarde antes del mediodía, o
  // rehacer la de la mañana si salió tarde).
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [rutaElegidaId, setRutaElegidaId] = useState<string | null>(null);
  const [ninos, setNinos] = useState<Nino[]>([]);
  const [escuelas, setEscuelas] = useState<Escuela[]>([]);
  const [puntos, setPuntos] = useState<Punto[]>([]);
  // Todos los viajes de hoy de este conductor (a lo sumo uno por ruta)
  const [viajesHoy, setViajesHoy] = useState<Viaje[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [registrando, setRegistrando] = useState(false);

  const [intento, setIntento] = useState(0);

  // Cambios de ubicación "por un día" aprobados para HOY (solicitudes del padre):
  // se muestran como aviso rojo sobre el niño afectado
  const [avisosHoy, setAvisosHoy] = useState<Map<string, Solicitud>>(new Map());
  useEffect(() => {
    listarCambiosPuntualesDeHoy(fechaDeHoy())
      .then((lista) =>
        setAvisosHoy(new Map(lista.filter((s) => s.ninoId).map((s) => [s.ninoId as string, s])))
      )
      .catch(() => {});
  }, [intento]);

  // --- Derivados de la ruta elegida ---
  const ruta = rutas.find((r) => r.id === rutaElegidaId) ?? null;
  const viaje = viajesHoy.find((v) => v.rutaId === rutaElegidaId) ?? null;
  // El turno lo define LA RUTA elegida, no el reloj. (Una ruta vieja sin turno
  // cae en la deducción por hora, como antes.)
  const turno: Turno = ruta?.turno ?? turnoActual();
  // Un bus no puede estar en dos viajes a la vez: si hay uno en curso en otra
  // ruta, no se deja iniciar este hasta finalizarlo.
  const viajeEnCursoOtraRuta =
    viajesHoy.find((v) => v.estado === 'en_curso' && v.rutaId !== rutaElegidaId) ?? null;

  // Aviso de cambio puntual para un niño en un lado (recogida/entrega), si aplica
  // hoy. El alcance 'ambas' afecta los dos lados. Se incluye el punto de
  // referencia: es lo que el conductor necesita para encontrar el lugar nuevo.
  const avisoDe = (n: Nino, lado: 'recogida' | 'entrega'): Partial<ItemAsistencia> => {
    const s = avisosHoy.get(n.id);
    if (!s || (s.alcance !== lado && s.alcance !== 'ambas')) return {};
    const lugar = s.nuevaUbicacion?.nombre ?? 'otro lugar';
    const referencia = s.nuevaUbicacion?.referencia;
    return {
      detalle:
        `⚠ HOY ${lado === 'recogida' ? 'se recoge' : 'se deja'} en: ${lugar}` +
        (referencia ? ` (${referencia})` : ''),
      alerta: true,
    };
  };

  // Estado de un niño (pendiente → en_bus → entregado) según su último registro
  const estadoNino = (ninoId: string): EstadoNino => {
    const propios = registros
      .filter((r) => r.ninoId === ninoId)
      .sort((a, b) => a.hora.toMillis() - b.hora.toMillis());
    if (propios.length === 0) return 'pendiente';
    return propios[propios.length - 1].evento === 'subio' ? 'en_bus' : 'entregado';
  };

  // El GPS emite solo mientras el viaje está en curso. Con cada posición emitida
  // (cada ~15 s) se revisa si el bus está cerca de la casa de algún niño para
  // avisarle al padre (Fase 6): en la mañana los pendientes de recoger; en la
  // tarde los que van en el bus rumbo a casa.
  const estadoGps = useEmisionUbicacion(
    viaje?.estado === 'en_curso' ? viaje.id : null,
    (lat, lng) => {
      if (!viaje) return;
      const entradas = new Map((ruta?.ninos ?? []).map((n) => [n.ninoId, n]));
      const ninosEnCasa = ninos
        .filter((n) => {
          if (turno === 'manana') {
            // Sin entrada en ruta.ninos (ruta vieja) el niño es directo: sube en casa
            const sube = entradas.get(n.id)?.subeEn.tipo ?? 'casa';
            return sube === 'casa' && estadoNino(n.id) === 'pendiente';
          }
          const baja = entradas.get(n.id)?.bajaEn.tipo ?? 'casa';
          return baja === 'casa' && estadoNino(n.id) === 'en_bus';
        })
        // En la tarde, el aviso de cercanía apunta a la ENTREGA real del niño
        // (paradaTarde si se deja en otro lugar)
        .map((n) => (turno === 'tarde' && n.paradaTarde ? { ...n, parada: n.paradaTarde } : n));
      notificarProximidad(viaje.id, lat, lng, ninosEnCasa, turno).catch(() => {});
    }
  );

  // Suscripción EN TIEMPO REAL a las rutas del bus: si el admin edita una ruta
  // (agrega/quita niños o escuelas) desde el panel, se refleja acá sin recargar.
  useEffect(() => {
    if (!usuario) return;
    let unsub: (() => void) | undefined;
    let cancelado = false;

    (async () => {
      const busAsignado = await obtenerBusDelConductor(usuario.id).catch(() => null);
      if (cancelado) return;
      if (!busAsignado) {
        setSinAsignacion('No tenés un bus asignado. Contactá al administrador.');
        setCargando(false);
        return;
      }
      setBus(busAsignado);
      unsub = escucharRutasDelBus(busAsignado.id, (lista) => {
        if (cancelado) return;
        setRutas(lista);
        setSinAsignacion(
          lista.length === 0 ? 'Tu bus no tiene rutas asignadas. Contactá al administrador.' : ''
        );
        setCargando(false);
      });
    })();

    return () => {
      cancelado = true;
      if (unsub) unsub();
    };
  }, [usuario, intento]);

  // Viajes de hoy de este conductor: con esto se sabe qué ruta ya arrancó o
  // terminó, y se puede volver al viaje en curso si cerró la app.
  useEffect(() => {
    if (!usuario) return;
    let cancelado = false;
    listarViajesDeHoy(usuario.id)
      .then((lista) => {
        if (!cancelado) setViajesHoy(lista);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [usuario, intento]);

  // Selección automática cuando no hay nada que decidir: si quedó un viaje en
  // curso, esa ruta (aunque haya cerrado la app); si el bus tiene una sola ruta,
  // esa. Con varias rutas y ninguna en curso, se muestra el selector.
  useEffect(() => {
    if (rutaElegidaId && rutas.some((r) => r.id === rutaElegidaId)) return;
    const enCurso = viajesHoy.find((v) => v.estado === 'en_curso');
    if (enCurso && rutas.some((r) => r.id === enCurso.rutaId)) {
      setRutaElegidaId(enCurso.rutaId);
    } else if (rutas.length === 1) {
      setRutaElegidaId(rutas[0].id);
    }
  }, [rutas, viajesHoy, rutaElegidaId]);

  // Detalle de la ruta elegida (niños, escuelas y puntos de transbordo). La
  // clave cambia al elegir otra ruta o si el admin editó su contenido, así no se
  // re-consulta en cada snapshot que no aporta nada.
  const claveDetalle = ruta
    ? [
        ruta.id,
        (ruta.ninoIds ?? []).join(','),
        (ruta.escuelaIds ?? []).join(','),
        puntoIdsDeRuta(ruta).join(','),
      ].join('|')
    : '';

  useEffect(() => {
    if (!ruta) {
      setNinos([]);
      setEscuelas([]);
      setPuntos([]);
      return;
    }
    let cancelado = false;
    Promise.all([
      listarNinosDeRuta(ruta.ninoIds ?? []),
      listarEscuelasDeRuta(ruta.escuelaIds ?? []),
      listarPuntosPorIds(puntoIdsDeRuta(ruta)),
    ])
      .then(([ninosRuta, escuelasRuta, puntosRuta]) => {
        if (cancelado) return;
        setNinos(ninosRuta);
        setEscuelas(escuelasRuta);
        setPuntos(puntosRuta);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
    // `ruta` entra por claveDetalle: alcanza con reaccionar a su contenido
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveDetalle]);

  // Registros del viaje en curso, para reconstruir el estado de cada niño al
  // abrir la app o al cambiar de ruta
  const viajeEnCursoId = viaje?.estado === 'en_curso' ? viaje.id : null;
  useEffect(() => {
    if (!viajeEnCursoId) {
      setRegistros([]);
      return;
    }
    let cancelado = false;
    listarRegistrosDeViaje(viajeEnCursoId)
      .then((regs) => {
        if (!cancelado) setRegistros(regs);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [viajeEnCursoId]);

  const manejarIniciar = async () => {
    if (!usuario || !bus || !ruta) return;
    setProcesando(true);
    try {
      const viajeId = await iniciarViaje({
        rutaId: ruta.id,
        conductorId: usuario.id,
        busId: bus.id,
      });
      setViajesHoy((previos) => [
        ...previos,
        {
          id: viajeId,
          rutaId: ruta.id,
          conductorId: usuario.id,
          busId: bus.id,
          fecha: fechaDeHoy(),
          estado: 'en_curso',
          horaInicio: Timestamp.now(),
        },
      ]);
      setRegistros([]);
    } catch {
      Alert.alert('Error', 'No se pudo iniciar el viaje.');
    } finally {
      setProcesando(false);
    }
  };

  const manejarFinalizar = () => {
    if (!viaje) return;
    Alert.alert('Finalizar viaje', '¿Seguro que querés finalizar el viaje?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Finalizar',
        style: 'destructive',
        onPress: async () => {
          setProcesando(true);
          try {
            await finalizarViaje(viaje.id);
            await limpiarUbicacion(viaje.id).catch(() => {});
            setViajesHoy((previos) =>
              previos.map((v) => (v.id === viaje.id ? { ...v, estado: 'finalizado' } : v))
            );
          } catch {
            Alert.alert('Error', 'No se pudo finalizar el viaje.');
          } finally {
            setProcesando(false);
          }
        },
      },
    ]);
  };

  // Registra uno o varios eventos y refleja el cambio localmente (sin re-consultar)
  const registrar = async (items: { ninoId: string; evento: EventoRegistro }[]) => {
    if (!viaje || items.length === 0) return;
    setRegistrando(true);
    try {
      if (items.length === 1) {
        await registrarEvento({
          viajeId: viaje.id,
          ninoId: items[0].ninoId,
          evento: items[0].evento,
        });
      } else {
        await registrarEventos(viaje.id, items);
      }
      const hora = Timestamp.now();
      setRegistros((previos) => [
        ...previos,
        ...items.map((it, i) => ({
          id: `local-${Date.now()}-${i}`,
          viajeId: viaje.id,
          ninoId: it.ninoId,
          evento: it.evento,
          hora,
          paradaId: '',
        })),
      ]);
      // Punto de integración Fase 6 (push al padre)
      items.forEach((it) =>
        notificarEventoAlPadre(it.ninoId, it.evento, { turno }).catch(() => {})
      );
    } catch {
      Alert.alert('Error', 'No se pudo guardar el registro.');
    } finally {
      setRegistrando(false);
    }
  };

  // Avatar propio en el encabezado; lleva a Configuración
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

  if (cargando) {
    return (
      <PantallaBase scroll={false} accionDerecha={avatarUsuario}>
        <View style={estilosBase.centrado}>
          <ActivityIndicator size="large" />
        </View>
      </PantallaBase>
    );
  }

  const enBus = ninos.filter((n) => estadoNino(n.id) === 'en_bus').length;
  const entregados = ninos.filter((n) => estadoNino(n.id) === 'entregado').length;

  // Paradas ordenadas de la ruta (casas → punto → escuelas según el turno), para
  // el mapa. Los cambios de un día aprobados para hoy mueven la parada al lugar
  // nuevo solo en esta fecha.
  const recorrido = ruta ? derivarRecorrido(ruta, ninos, escuelas, puntos, turno, avisosHoy) : [];

  // Grupos de recogida y entrega según el turno.
  // Mañana: se recoge en las casas (paradas) y se entrega en las escuelas.
  // Tarde: se recoge en las escuelas y se entrega en las casas.
  // Un niño que sube o baja en un PUNTO de transbordo no aparece en la
  // recogida/entrega normal para ese extremo: lo maneja la pantalla de Transbordo.
  const porId = new Map((ruta?.ninos ?? []).map((n) => [n.ninoId, n]));
  const subeNormal = (id: string) => (porId.get(id)?.subeEn.tipo ?? 'casa') !== 'punto';
  const bajaNormal = (id: string) => (porId.get(id)?.bajaEn.tipo ?? 'escuela') !== 'punto';
  const ninosSuben = ninos.filter((n) => subeNormal(n.id));
  const ninosBajan = ninos.filter((n) => bajaNormal(n.id));

  // La entrega de la tarde agrupa por paradaTarde cuando existe (entrega distinta)
  const gruposParadaSuben = agruparPorParada(ninosSuben);
  const gruposParadaBajan = agruparPorParada(ninosBajan, turno === 'tarde');
  const gruposEscuelaSuben = escuelas
    .map((e) => ({ escuela: e, ninos: ninosSuben.filter((n) => n.escuelaId === e.id) }))
    .filter((g) => g.ninos.length > 0);
  const gruposEscuelaBajan = escuelas
    .map((e) => ({ escuela: e, ninos: ninosBajan.filter((n) => n.escuelaId === e.id) }))
    .filter((g) => g.ninos.length > 0);

  // Un niño está "hecho" para la recogida si ya no está pendiente (subió o más).
  const itemsRecogida = (grupo: Nino[]): ItemAsistencia[] =>
    grupo.map((n) => ({
      id: n.id,
      nombre: n.nombre,
      hecho: estadoNino(n.id) !== 'pendiente',
      ...avisoDe(n, 'recogida'),
    }));

  // Para la entrega, "hecho" = entregado; solo se puede accionar si está en el bus.
  const itemsEntrega = (grupo: Nino[]): ItemAsistencia[] =>
    grupo.map((n) => {
      const e = estadoNino(n.id);
      return {
        id: n.id,
        nombre: n.nombre,
        hecho: e === 'entregado',
        habilitado: e === 'en_bus',
        detalle: e === 'pendiente' ? 'Aún no subió' : undefined,
        ...avisoDe(n, 'entrega'), // el aviso de "hoy se deja en..." pisa el detalle
      };
    });

  const marcar = (ids: string[], evento: EventoRegistro) =>
    registrar(ids.map((id) => ({ ninoId: id, evento })));

  return (
    <PantallaBase accionDerecha={avatarUsuario}>
      <View style={styles.saludo}>
        <Text variant="headlineMedium" style={styles.negrita}>
          Hola, {usuario?.nombre?.split(' ')[0] ?? ''}
        </Text>
        <Text variant="bodyMedium" style={estilosBase.tenue}>
          {ruta ? 'Tu ruta de hoy' : 'Tus rutas asignadas'}
        </Text>
      </View>

      {sinAsignacion ? (
        <Tarjeta>
          <Text>{sinAsignacion}</Text>
          <Button
            onPress={() => {
              setCargando(true);
              setIntento((i) => i + 1);
            }}
          >
            Reintentar
          </Button>
        </Tarjeta>
      ) : !ruta ? (
        /* --- Selector: el conductor elige la ruta que va a manejar. No se
           filtra por hora; puede arrancar la que corresponda cuando toque. --- */
        <>
          <TituloSeccion titulo="Elegí la ruta que vas a manejar" />
          {rutas.map((r) => {
            const viajeDeRuta = viajesHoy.find((v) => v.rutaId === r.id);
            return (
              <Tarjeta key={r.id} onPress={() => setRutaElegidaId(r.id)}>
                <View style={styles.filaHero}>
                  <Avatar.Icon
                    size={46}
                    icon="bus-school"
                    style={{ backgroundColor: tema.colors.primaryContainer }}
                    color={tema.colors.onPrimaryContainer}
                  />
                  <View style={styles.datosHero}>
                    <Text variant="titleMedium" style={styles.negrita}>
                      {r.nombre}
                    </Text>
                    <Text variant="bodySmall" style={estilosBase.tenue}>
                      {r.turno ? `Turno ${ETIQUETA_TURNO[r.turno]} · ` : ''}
                      {(r.ninoIds ?? []).length} niños
                    </Text>
                  </View>
                  {viajeDeRuta && (
                    <View
                      style={[
                        styles.pastilla,
                        {
                          backgroundColor:
                            viajeDeRuta.estado === 'en_curso'
                              ? tema.colors.primary
                              : tema.colors.secondaryContainer,
                        },
                      ]}
                    >
                      <Text
                        variant="labelSmall"
                        style={{
                          color:
                            viajeDeRuta.estado === 'en_curso'
                              ? tema.colors.onPrimary
                              : tema.colors.onSecondaryContainer,
                        }}
                      >
                        {viajeDeRuta.estado === 'en_curso' ? 'En curso' : 'Finalizado'}
                      </Text>
                    </View>
                  )}
                </View>
              </Tarjeta>
            );
          })}
        </>
      ) : (
        <>
          {/* Tarjeta principal de la ruta, en azul de marca */}
          <Tarjeta style={{ backgroundColor: tema.colors.primaryContainer }}>
            <View style={styles.filaHero}>
              <Avatar.Icon
                size={52}
                icon="bus-school"
                style={{ backgroundColor: tema.colors.primary }}
                color={tema.colors.onPrimary}
              />
              <View style={styles.datosHero}>
                <Text
                  variant="titleMedium"
                  style={{ color: tema.colors.onPrimaryContainer, fontWeight: '700' }}
                >
                  {ruta.nombre}
                </Text>
                <Text variant="bodySmall" style={{ color: tema.colors.onPrimaryContainer }}>
                  {ruta.turno ? `Turno ${ETIQUETA_TURNO[ruta.turno]} · ` : ''}Bus {bus?.placa}
                </Text>
                <Text variant="bodySmall" style={{ color: tema.colors.onPrimaryContainer }}>
                  {ninos.length} niños · {escuelas.length} escuela
                  {escuelas.length === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
          </Tarjeta>

          {/* Con varias rutas asignadas se puede volver al selector, siempre que
              no haya un viaje en curso (ahí lo que toca es finalizarlo) */}
          {rutas.length > 1 && viaje?.estado !== 'en_curso' && (
            <Button mode="text" icon="swap-horizontal" onPress={() => setRutaElegidaId(null)}>
              Cambiar de ruta
            </Button>
          )}

          {/* Mapa con las paradas numeradas en orden: dónde recoger, el punto de
              transbordo (si hay) y a qué escuela ir. Disponible antes y durante el viaje. */}
          <Button
            mode="outlined"
            icon="map-marker-path"
            disabled={recorrido.length === 0}
            onPress={() =>
              router.push({
                pathname: '/recorrido',
                params: { rutaNombre: ruta.nombre, paradas: JSON.stringify(recorrido) },
              })
            }
          >
            Ver recorrido en el mapa
          </Button>

          {!viaje && (
            <>
              <Button
                mode="contained"
                icon="play"
                onPress={manejarIniciar}
                loading={procesando}
                disabled={procesando || !!viajeEnCursoOtraRuta}
                contentStyle={styles.contenidoBotonGrande}
              >
                Iniciar viaje{ruta.turno ? ` ${ETIQUETA_TURNO[ruta.turno]}` : ''}
              </Button>
              {!!viajeEnCursoOtraRuta && (
                <Text variant="bodySmall" style={{ color: tema.colors.error }}>
                  Tenés un viaje en curso en otra ruta. Finalizalo antes de iniciar este.
                </Text>
              )}
            </>
          )}

          {viaje?.estado === 'finalizado' && (
            <Tarjeta style={{ backgroundColor: tema.colors.secondaryContainer }}>
              <View style={styles.filaHero}>
                <Avatar.Icon
                  size={40}
                  icon="check-bold"
                  style={{ backgroundColor: tema.colors.primary }}
                  color={tema.colors.onPrimary}
                />
                <View style={styles.datosHero}>
                  <Text variant="titleMedium" style={{ color: tema.colors.onSecondaryContainer }}>
                    {ruta.turno ? `Viaje de ${ETIQUETA_TURNO[ruta.turno]}` : 'Viaje'} finalizado
                  </Text>
                  <Text variant="bodySmall" style={{ color: tema.colors.onSecondaryContainer }}>
                    La asistencia quedó registrada.
                  </Text>
                </View>
              </View>
            </Tarjeta>
          )}

          {viaje?.estado === 'en_curso' && (
            <>
              <View style={styles.filaEstado}>
                {/* GPS bien = azul suave; GPS con problema = rojo de alerta */}
                <View
                  style={[
                    styles.pastillaAncha,
                    {
                      backgroundColor:
                        estadoGps === 'activo'
                          ? tema.colors.secondaryContainer
                          : tema.colors.errorContainer,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={estadoGps === 'activo' ? 'crosshairs-gps' : 'crosshairs-question'}
                    size={15}
                    color={
                      estadoGps === 'activo'
                        ? tema.colors.onSecondaryContainer
                        : tema.colors.onErrorContainer
                    }
                  />
                  <Text
                    variant="labelMedium"
                    style={{
                      color:
                        estadoGps === 'activo'
                          ? tema.colors.onSecondaryContainer
                          : tema.colors.onErrorContainer,
                    }}
                  >
                    {ETIQUETA_GPS[estadoGps]}
                  </Text>
                </View>
                <View
                  style={[
                    styles.pastillaAncha,
                    { backgroundColor: tema.colors.secondaryContainer },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="account-group"
                    size={15}
                    color={tema.colors.onSecondaryContainer}
                  />
                  <Text
                    variant="labelMedium"
                    style={{ color: tema.colors.onSecondaryContainer }}
                  >
                    En bus: {enBus} · Entregados: {entregados}
                  </Text>
                </View>
              </View>

              {turno === 'manana' ? (
                <>
                  <TituloSeccion titulo="Recoger en casa" />
                  {gruposParadaSuben.map((g) => (
                    <GrupoAsistencia
                      key={`p-${g.titulo}`}
                      titulo={g.titulo}
                      items={itemsRecogida(g.ninos)}
                      etiquetaAccion="Subió"
                      etiquetaGrupo="Todos subieron"
                      onAccion={(ids) => marcar(ids, 'subio')}
                      ocupado={registrando}
                    />
                  ))}

                  <TituloSeccion titulo="Dejar en la escuela" />
                  {gruposEscuelaBajan.map((g) => (
                    <GrupoAsistencia
                      key={`e-${g.escuela.id}`}
                      titulo={g.escuela.nombre}
                      items={itemsEntrega(g.ninos)}
                      etiquetaAccion="Bajó"
                      etiquetaGrupo="Llegué (bajan todos)"
                      onAccion={(ids) => marcar(ids, 'bajo')}
                      ocupado={registrando}
                    />
                  ))}
                </>
              ) : (
                <>
                  <TituloSeccion titulo="Recoger en la escuela" />
                  {gruposEscuelaSuben.map((g) => (
                    <GrupoAsistencia
                      key={`e-${g.escuela.id}`}
                      titulo={g.escuela.nombre}
                      items={itemsRecogida(g.ninos)}
                      etiquetaAccion="Subió"
                      etiquetaGrupo="Salí (suben todos)"
                      onAccion={(ids) => marcar(ids, 'subio')}
                      ocupado={registrando}
                    />
                  ))}

                  <TituloSeccion titulo="Dejar en casa" />
                  {gruposParadaBajan.map((g) => (
                    <GrupoAsistencia
                      key={`p-${g.titulo}`}
                      titulo={g.titulo}
                      items={itemsEntrega(g.ninos)}
                      etiquetaAccion="Bajó"
                      etiquetaGrupo="Todos bajaron"
                      onAccion={(ids) => marcar(ids, 'bajo')}
                      ocupado={registrando}
                    />
                  ))}
                </>
              )}

              {/* Transbordo: solo aparece si la ruta pasa por un punto de transbordo */}
              {puntos.length > 0 && viaje && bus && (
                <>
                  <TituloSeccion titulo="Transbordo" />
                  {puntos.map((p) => (
                    <Button
                      key={p.id}
                      mode="contained-tonal"
                      icon="swap-horizontal"
                      onPress={() =>
                        router.push({
                          pathname: '/transbordo',
                          params: {
                            puntoId: p.id,
                            puntoNombre: p.nombre,
                            viajeId: viaje.id,
                            rutaId: ruta.id,
                            busId: bus.id,
                          },
                        })
                      }
                    >
                      Transbordo en {p.nombre}
                    </Button>
                  ))}
                </>
              )}

              <Button
                mode="contained"
                icon="flag-checkered"
                buttonColor={tema.colors.error}
                textColor={tema.colors.onError}
                onPress={manejarFinalizar}
                loading={procesando}
                disabled={procesando}
                contentStyle={styles.contenidoBotonGrande}
              >
                Finalizar viaje
              </Button>
            </>
          )}
        </>
      )}
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  saludo: { gap: 2 },
  negrita: { fontWeight: '700' },
  avatarToque: { borderRadius: 19 },
  filaEstado: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filaHero: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno + 2 },
  datosHero: { flex: 1, gap: 2 },
  contenidoBotonGrande: { paddingVertical: 8 },
  pastilla: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIO.pastilla },
  pastillaAncha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIO.pastilla,
  },
});
