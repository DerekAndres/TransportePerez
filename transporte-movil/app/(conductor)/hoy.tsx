import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  Dialog,
  Portal,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useEmisionUbicacion, type EstadoGps } from '@/hooks/use-emision-ubicacion';
import BotonPrincipal from '@/components/BotonPrincipal';
import ChipFiltro from '@/components/ChipFiltro';
import GrupoAsistencia, { type ItemAsistencia } from '@/components/GrupoAsistencia';
import PantallaBase from '@/components/PantallaBase';
import PastillaEstado from '@/components/PastillaEstado';
import Campo from '@/components/Campo';
import {
  TIPOS_INCIDENCIA,
  reportarIncidencia,
} from '@/services/incidenciasService';
import Metrica, { FilaMetricas } from '@/components/Metrica';
import Tarjeta from '@/components/Tarjeta';
import TituloSeccion from '@/components/TituloSeccion';
import {
  derivarRecorrido,
  diagnosticarAsignacion,
  escucharRutasDeBuses,
  mensajeDeDiagnostico,
  listarEscuelasDeRuta,
  listarNinosDeRuta,
  listarPuntosPorIds,
  obtenerUnidadesDelDia,
  puntoIdsDeRuta,
} from '@/services/conductorService';
import {
  fechaDeHoy,
  finalizarViaje,
  iniciarViaje,
  listarRegistrosDeViaje,
  listarViajesDeHoyDeRutas,
  registrarEventos,
  turnoActual,
} from '@/services/viajesService';
import { pendientesDeViaje, reintentarRegistrosPendientes } from '@/services/colaRegistros';
import { detenerGps } from '@/services/gpsViaje';
import {
  listarAusenciasDeFecha,
  listarCambiosPuntualesDeHoy,
} from '@/services/solicitudesService';
import { limpiarUbicacion } from '@/services/ubicacionesService';
import {
  notificarEventoAlPadre,
  notificarProximidad,
  reintentarAvisosPendientes,
} from '@/services/notificacionesService';
import { ESPACIO, RADIO, SOMBRA_FLOTANTE, espacioBarra, estilosBase } from '@/constants/estilos';
import { FUENTES, fondoPie } from '@/constants/tema';
import { horaDeTexto, saludoDelDia } from '@/utils/tiempo';
import { registrosEfectivos } from '@/utils/eventos';
import type { Bus, Escuela, EventoRegistro, Nino, Punto, Registro, Ruta, Solicitud, Suplencia, TipoIncidencia, TipoLugar, Turno, Viaje } from '@/types/models';
import CargandoBus from '@/components/CargandoBus';

const ETIQUETA_GPS: Record<EstadoGps, string> = {
  inactivo: 'GPS inactivo',
  activo: 'Ubicación en vivo activa',
  solo_app_abierta: 'GPS solo con la app abierta',
  sin_permiso: 'Sin permiso de ubicación',
  error: 'Error de GPS',
};

const ETIQUETA_TURNO: Record<Turno, string> = { manana: 'Mañana', tarde: 'Tarde' };

// 'ausente' = el bus llegó a su parada y el niño no estaba. Es un final del
// recorrido igual que 'entregado': ya no hay nada más que hacer con ese niño
// en este viaje.
type EstadoNino = 'pendiente' | 'en_bus' | 'entregado' | 'ausente';

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
  const insets = useSafeAreaInsets();

  const [cargando, setCargando] = useState(true);
  const [sinAsignacion, setSinAsignacion] = useState('');
  // Las unidades que maneja HOY: normalmente la suya; un día de suplencia,
  // también (o en su lugar) la que cubre. Ver obtenerUnidadesDelDia.
  const [busesPorId, setBusesPorId] = useState<Map<string, Bus>>(new Map());
  // Si hoy a SU unidad la maneja otro conductor (suplencia)
  const [meCubre, setMeCubre] = useState<Suplencia | null>(null);
  // Las suplencias en las que ÉL cubre la unidad de otro
  const [cubro, setCubro] = useState<Suplencia[]>([]);
  // TODAS las rutas activas de esas unidades, sin filtrar por hora: el conductor
  // elige cuál va a manejar (puede arrancar la de la tarde antes del mediodía, o
  // rehacer la de la mañana si salió tarde).
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [rutaElegidaId, setRutaElegidaId] = useState<string | null>(null);
  // --- Avisar una novedad ---
  const [novedadAbierta, setNovedadAbierta] = useState(false);
  const [tipoNovedad, setTipoNovedad] = useState<TipoIncidencia | null>(null);
  const [textoNovedad, setTextoNovedad] = useState('');
  const [enviandoNovedad, setEnviandoNovedad] = useState(false);
  const [ninos, setNinos] = useState<Nino[]>([]);
  // true cuando ya llegaron los niños de la ruta elegida. El GPS espera a esto:
  // con ellos sabe a qué padres les deja ver la posición del bus.
  const [ninosListos, setNinosListos] = useState(false);
  // Niños de la ruta que la app NO pudo leer (el panel no recalculó los accesos)
  const [ninosSinAcceso, setNinosSinAcceso] = useState(0);
  const [escuelas, setEscuelas] = useState<Escuela[]>([]);
  const [puntos, setPuntos] = useState<Punto[]>([]);
  // Los viajes de hoy de sus rutas (a lo sumo uno por ruta), los haya iniciado
  // él o, un día de suplencia, el otro conductor
  const [viajesHoy, setViajesHoy] = useState<Viaje[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [registrando, setRegistrando] = useState(false);

  const [intento, setIntento] = useState(0);

  // Cambios de ubicación "por un día" aprobados para HOY (solicitudes del padre):
  // se muestran como aviso rojo sobre el niño afectado
  const [avisosHoy, setAvisosHoy] = useState<Map<string, Solicitud>>(new Map());
  // Niños que HOY no viajan porque el padre avisó. No hay que esperarlos ni
  // marcarlos como "no estaba": el padre ya dijo que no iban a estar.
  const [ausenciasHoy, setAusenciasHoy] = useState<Map<string, Solicitud>>(new Map());
  useEffect(() => {
    listarCambiosPuntualesDeHoy(fechaDeHoy())
      .then((lista) =>
        setAvisosHoy(new Map(lista.filter((s) => s.ninoId).map((s) => [s.ninoId as string, s])))
      )
      .catch(() => {});
    listarAusenciasDeFecha(fechaDeHoy())
      .then((lista) =>
        setAusenciasHoy(new Map(lista.filter((s) => s.ninoId).map((s) => [s.ninoId as string, s])))
      )
      .catch(() => {});
  }, [intento]);

  // --- Derivados de la ruta elegida ---
  const ruta = rutas.find((r) => r.id === rutaElegidaId) ?? null;
  const viaje = viajesHoy.find((v) => v.rutaId === rutaElegidaId) ?? null;
  // La unidad de la ruta elegida (un día de suplencia no es siempre la propia)
  const bus = ruta ? (busesPorId.get(ruta.busId) ?? null) : null;
  // Si la ruta es de una unidad que cubre hoy: a quién está cubriendo
  const suplenciaDeRuta = ruta ? cubro.find((s) => s.busId === ruta.busId) : undefined;
  // Un viaje de esta ruta que inició OTRO conductor (por ejemplo, el titular
  // salió antes de que se asignara la suplencia): se ve, pero no se opera
  const viajeDeOtro = !!viaje && !!usuario && viaje.conductorId !== usuario.id;
  // El turno lo define LA RUTA elegida, no el reloj. (Una ruta vieja sin turno
  // cae en la deducción por hora, como antes.)
  const turno: Turno = ruta?.turno ?? turnoActual();
  // Un conductor no puede estar en dos viajes a la vez: si tiene uno en curso en
  // otra ruta, no se deja iniciar este hasta finalizarlo.
  const viajeEnCursoOtraRuta =
    viajesHoy.find(
      (v) => v.estado === 'en_curso' && v.rutaId !== rutaElegidaId && v.conductorId === usuario?.id
    ) ?? null;

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
    // registrosEfectivos descarta las marcas que el conductor deshizo: para el
    // estado del niño solo cuenta lo que quedó en pie
    const propios = registrosEfectivos(registros.filter((r) => r.ninoId === ninoId));
    if (propios.length === 0) return 'pendiente';
    const ultimo = propios[propios.length - 1].evento;
    if (ultimo === 'subio') return 'en_bus';
    if (ultimo === 'no_estaba') return 'ausente';
    return 'entregado';
  };

  // --- El GPS del viaje ---
  // Emite solo mientras el viaje está en curso y lo maneja ÉL, y espera a tener
  // los niños de la ruta: con ellos sabe a qué padres les deja ver la posición
  // (las reglas no se la muestran a nadie más). Sigue emitiendo aunque se cierre
  // esta pantalla o se bloquee el teléfono; se apaga al finalizar el viaje.
  //
  // Con cada posición emitida (cada ~15 s) se revisa si el bus está cerca de la
  // casa de algún niño para avisarle al padre (Fase 6): en la mañana los
  // pendientes de recoger; en la tarde los que van en el bus rumbo a casa.
  const viajeConGps =
    viaje?.estado === 'en_curso' && !viajeDeOtro && ninosListos && ruta && usuario
      ? {
          viajeId: viaje.id,
          rutaId: ruta.id,
          busId: viaje.busId,
          conductorId: usuario.id,
          fecha: viaje.fecha,
          padreIds: [...new Set(ninos.map((n) => n.padreId).filter(Boolean))].sort(),
        }
      : null;
  const estadoGps = useEmisionUbicacion(viajeConGps, (lat, lng) => {
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
  });

  // Las unidades que maneja hoy y, EN TIEMPO REAL, sus rutas: si el admin edita
  // una ruta (agrega/quita niños o escuelas) desde el panel, se refleja acá sin
  // recargar.
  useEffect(() => {
    if (!usuario) return;
    let unsub: (() => void) | undefined;
    let cancelado = false;

    (async () => {
      const unidades = await obtenerUnidadesDelDia(usuario.id).catch(() => null);
      if (cancelado) return;
      setMeCubre(unidades?.meCubre ?? null);
      setCubro(unidades?.cubro ?? []);

      if (!unidades || unidades.buses.length === 0) {
        // Si hoy lo cubre un suplente, no es un problema: la pantalla lo dice
        // (ver avisoSuplencia) y no hace falta ningún diagnóstico.
        //
        // Si no, sin unidades NO significa "no te asignaron una": puede ser que
        // la unidad esté desactivada, que la consulta la hayan bloqueado las
        // reglas o que no haya internet. El diagnóstico distingue los casos y
        // devuelve un mensaje que el conductor le puede leer al administrador
        // tal cual, con el lugar exacto del panel donde se arregla.
        if (unidades?.meCubre) {
          setSinAsignacion('');
        } else {
          const causa = await diagnosticarAsignacion(usuario.id);
          if (cancelado) return;
          setSinAsignacion(mensajeDeDiagnostico(causa));
        }
        setCargando(false);
        return;
      }

      setBusesPorId(new Map(unidades.buses.map((b) => [b.id, b])));
      unsub = escucharRutasDeBuses(
        unidades.buses.map((b) => b.id),
        (lista, errorRutas) => {
          if (cancelado) return;
          setRutas(lista);
          setCargando(false);
          if (lista.length > 0) {
            setSinAsignacion('');
            return;
          }
          // La unidad existe pero no llegó ninguna ruta. Otra vez: puede ser que
          // no haya, que estén desactivadas, o que les falte el campo `activa` —
          // un filtro de igualdad de Firestore descarta los documentos que no
          // tienen el campo, y esas rutas SÍ se ven en el panel. Se pregunta de nuevo.
          diagnosticarAsignacion(usuario.id, errorRutas).then((causa) => {
            if (!cancelado) setSinAsignacion(mensajeDeDiagnostico(causa));
          });
        }
      );
    })();

    return () => {
      cancelado = true;
      if (unsub) unsub();
    };
  }, [usuario, intento]);

  // Viajes de hoy de sus rutas: con esto se sabe qué ruta ya arrancó o terminó
  // —la haya iniciado él o, un día de suplencia, el otro conductor— y se puede
  // volver al viaje en curso si cerró la app.
  const claveRutas = rutas
    .map((r) => r.id)
    .sort()
    .join(',');
  useEffect(() => {
    if (!claveRutas) return;
    let cancelado = false;
    listarViajesDeHoyDeRutas(claveRutas.split(','))
      .then((lista) => {
        if (!cancelado) setViajesHoy(lista);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [claveRutas, intento]);

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
    if (!ruta || !usuario) {
      setNinos([]);
      setNinosListos(false);
      setNinosSinAcceso(0);
      setEscuelas([]);
      setPuntos([]);
      return;
    }
    let cancelado = false;
    Promise.all([
      listarNinosDeRuta(usuario.id, ruta.ninoIds ?? []),
      listarEscuelasDeRuta(ruta.escuelaIds ?? []),
      listarPuntosPorIds(puntoIdsDeRuta(ruta)),
    ])
      .then(([ninosRuta, escuelasRuta, puntosRuta]) => {
        if (cancelado) return;
        setNinos(ninosRuta.ninos);
        setNinosSinAcceso(ninosRuta.sinAcceso);
        setNinosListos(true);
        setEscuelas(escuelasRuta);
        setPuntos(puntosRuta);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
    // `ruta` entra por claveDetalle: alcanza con reaccionar a su contenido.
    // `intento` vuelve a leer los niños al tocar Reintentar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveDetalle, usuario?.id, intento]);

  // Registros del viaje en curso, para reconstruir el estado de cada niño al
  // abrir la app o al cambiar de ruta. Se suman los que siguen en la cola del
  // teléfono sin llegar al servidor: sin eso, al reabrir la app sin señal un
  // niño ya marcado aparecería otra vez como pendiente.
  const viajeEnCursoId = viaje?.estado === 'en_curso' ? viaje.id : null;
  useEffect(() => {
    if (!viajeEnCursoId) {
      setRegistros([]);
      return;
    }
    let cancelado = false;
    Promise.all([
      listarRegistrosDeViaje(viajeEnCursoId).catch(() => [] as Registro[]),
      pendientesDeViaje(viajeEnCursoId),
    ])
      .then(([delServidor, enCola]) => {
        if (cancelado) return;
        const yaEstan = new Set(delServidor.map((r) => r.id));
        setRegistros([...delServidor, ...enCola.filter((r) => !yaEstan.has(r.id))]);
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
      const nuevo = await iniciarViaje({
        rutaId: ruta.id,
        conductorId: usuario.id,
        busId: bus.id,
      });
      setViajesHoy((previos) => [...previos, nuevo]);
      setRegistros([]);
    } catch {
      // Además de un corte de internet, las reglas rechazan iniciar el viaje de
      // una unidad que hoy maneja otro conductor (suplencia)
      Alert.alert(
        'No se pudo iniciar el viaje',
        'Revisá tu conexión. Si hoy hay una suplencia en esta unidad, el viaje lo inicia quien la maneja.'
      );
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
            // El GPS se apaga recién acá: seguía andando aunque se cerrara la
            // pantalla o se bloqueara el teléfono. Primero se apaga y después se
            // borra la ubicación, así una última posición no la vuelve a crear.
            await detenerGps();
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

  // Registra uno o varios eventos. Quedan guardados en el teléfono ANTES de
  // mandarse (ver colaRegistros.ts): la pantalla se actualiza al instante aunque
  // no haya señal, y la marca no se pierde si la app se cierra.
  const registrar = async (items: { ninoId: string; evento: EventoRegistro }[]) => {
    if (!viaje || viajeDeOtro || items.length === 0) return;
    setRegistrando(true);
    try {
      const nuevos = await registrarEventos(viaje.id, items);
      setRegistros((previos) => [...previos, ...nuevos]);
      // Punto de integración Fase 6 (push al padre)
      items.forEach((it) =>
        notificarEventoAlPadre(it.ninoId, it.evento, { turno }).catch(() => {})
      );
      // Se aprovecha para vaciar lo que haya quedado pendiente de un tramo sin
      // cobertura: marcas de asistencia y avisos a los padres
      reintentarRegistrosPendientes().catch(() => {});
      reintentarAvisosPendientes().catch(() => {});
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
          <CargandoBus texto="Cargando tu ruta…" />
        </View>
      </PantallaBase>
    );
  }

  const enBus = ninos.filter((n) => estadoNino(n.id) === 'en_bus').length;
  const entregados = ninos.filter((n) => estadoNino(n.id) === 'entregado').length;
  // Los que el conductor marcó como "no estaba en la parada". Se cuentan aparte
  // porque NO son pendientes: ya se resolvieron, solo que se resolvieron mal.
  const ausentes = ninos.filter((n) => estadoNino(n.id) === 'ausente').length;

  // Paradas ordenadas de la ruta (casas → punto → escuelas según el turno), para
  // el mapa. Los cambios de un día aprobados para hoy mueven la parada al lugar
  // nuevo solo en esta fecha.
  const recorrido = ruta ? derivarRecorrido(ruta, ninos, escuelas, puntos, turno, avisosHoy) : [];

  // ============================================
  // CUÁL ES LA PARADA QUE TOCA AHORA
  // ============================================
  // El mapa del recorrido la encuadra con un botón ("Siguiente") para que el
  // conductor no tenga que acomodar el mapa con la mano mientras maneja. El
  // cálculo se hace ACÁ y no en el mapa porque acá es donde se sabe el estado de
  // cada niño; al mapa viaja un número y nada más.
  //
  // Qué se hace en cada parada depende del turno: en la mañana se RECOGE en las
  // casas y se ENTREGA en las escuelas; en la tarde es al revés. En el punto de
  // transbordo se hacen las dos cosas.
  const accionEnParada = (tipo: TipoLugar): 'sube' | 'baja' | 'ambas' => {
    if (tipo === 'punto') return 'ambas';
    if (turno === 'manana') return tipo === 'casa' ? 'sube' : 'baja';
    return tipo === 'casa' ? 'baja' : 'sube';
  };

  // Una parada queda pendiente mientras alguno de sus niños tenga algo por
  // hacer ahí. Los que el padre avisó que hoy no viajan no cuentan: nadie los
  // está esperando. Los marcados como "no estaba" tampoco — están resueltos,
  // aunque se hayan resuelto mal.
  const indiceSiguiente = recorrido.findIndex((parada) => {
    const accion = accionEnParada(parada.tipo);
    return parada.ninos.some((n) => {
      if (ausenciasHoy.has(n.id)) return false;
      const e = estadoNino(n.id);
      if (e === 'entregado' || e === 'ausente') return false;
      if (accion === 'sube') return e === 'pendiente';
      if (accion === 'baja') return e === 'en_bus';
      return true; // punto de transbordo: se resuelve en su propia pantalla
    });
  });

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

  // Un niño está "hecho" para la recogida si subió. Si quedó marcado como
  // AUSENTE no está hecho: está resuelto, pero resuelto mal, y se muestra en
  // rojo. El botón "Subió" sigue habilitado a propósito — si el niño aparece
  // corriendo, el conductor lo marca y el estado se corrige solo, porque manda
  // el último registro (los registros son inmutables: corregir es agregar).
  const itemsRecogida = (grupo: Nino[]): ItemAsistencia[] =>
    grupo.map((n) => {
      const e = estadoNino(n.id);
      const noViaja = ausenciasHoy.get(n.id);
      // Si el padre avisó que hoy no viaja, se bloquean los botones: no hay
      // que esperarlo ni marcarlo como "no estaba". El motivo se muestra si
      // lo escribió, porque al conductor le sirve saber si es algo del día o
      // algo que va a repetirse.
      if (noViaja) {
        return {
          id: n.id,
          nombre: n.nombre,
          hecho: false,
          habilitado: false,
          alerta: true,
          detalle: noViaja.motivo
            ? `HOY NO VIAJA — ${noViaja.motivo}`
            : 'HOY NO VIAJA (avisó el padre)',
        };
      }
      return {
        id: n.id,
        nombre: n.nombre,
        hecho: e === 'en_bus' || e === 'entregado',
        fallo: e === 'ausente',
        ...avisoDe(n, 'recogida'),
      };
    });

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

  // "Deshacer": el conductor marcó algo por error y lo corrige.
  //
  // No borra nada: agrega un registro 'anulado' que tacha al anterior (los
  // registros son inmutables). Avisa al padre, porque si la marca equivocada
  // fue un "subió", el padre ya recibió un aviso que decía que su hijo iba en
  // el bus — dejarlo sin corregir sería peor que el error original.
  const deshacer = (ids: string[]) => {
    const nombres = ids
      .map((id) => ninos.find((n) => n.id === id)?.nombre)
      .filter(Boolean)
      .join(', ');
    Alert.alert(
      'Deshacer la última marca',
      `Se va a corregir la última marca de ${nombres}. Si al padre ya le llegó un aviso, se le manda la corrección.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Deshacer', onPress: () => marcar(ids, 'anulado') },
      ]
    );
  };

  // "No estaba": el bus llegó a la parada y el niño no estaba ahí.
  //
  // Pide confirmación a propósito, y es la ÚNICA acción de esta pantalla que lo
  // hace. El motivo: deja constancia de que el niño se quedó, y eso le llega al
  // padre como aviso en el momento. Es información seria y no puede dispararse
  // por un roce de dedo mientras el bus se mueve.
  const marcarAusente = (ids: string[]) => {
    const nombres = ids
      .map((id) => ninos.find((n) => n.id === id)?.nombre)
      .filter(Boolean)
      .join(', ');
    Alert.alert(
      'Marcar que no estaba',
      `Se va a registrar que ${nombres} no estaba en la parada, y se le avisa al padre ahora mismo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, no estaba',
          style: 'destructive',
          onPress: () => marcar(ids, 'no_estaba'),
        },
      ]
    );
  };

  // Progreso del viaje. Se muestran los dos números que le importan al
  // conductor: cuántos lleva arriba y cuántos ya dejó. El viaje termina cuando
  // todos están entregados, así que esa es la barra que se llena.
  const total = ninos.length;
  const porcentaje = (cantidad: number) => (total === 0 ? 0 : (cantidad / total) * 100);

  // --- Manda la novedad y avisa a padres y administración ---
  // Los niños "a bordo" se calculan en el momento de enviar, no al abrir el
  // diálogo: entre que el conductor lo abre y toca Avisar puede haber marcado a
  // alguien más, y el aviso tiene que reflejar quiénes van arriba DE VERDAD.
  const enviarNovedad = async () => {
    if (!tipoNovedad || !ruta || !bus || !usuario) return;
    setEnviandoNovedad(true);
    try {
      const aBordo = ninos.filter((n) => estadoNino(n.id) === 'en_bus').map((n) => n.id);
      const { avisados } = await reportarIncidencia({
        viajeId: viaje?.id ?? null,
        rutaId: ruta.id,
        rutaNombre: ruta.nombre,
        busId: bus.id,
        busPlaca: bus.placa,
        conductorId: usuario.id,
        conductorNombre: usuario.nombre,
        tipo: tipoNovedad,
        texto: textoNovedad,
        ninoIdsABordo: aBordo,
      });
      setNovedadAbierta(false);
      setTipoNovedad(null);
      setTextoNovedad('');
      // Se dice A CUÁNTOS se avisó, no solo "listo": con cero padres avisados
      // el conductor tiene que saberlo para poder llamar por teléfono.
      Alert.alert(
        'Novedad registrada',
        avisados > 0
          ? `Se avisó a ${avisados} ${avisados === 1 ? 'padre' : 'padres'} y a la administración.`
          : 'Quedó registrada y se avisó a la administración. No se pudo notificar a los padres.'
      );
    } catch {
      Alert.alert('No se pudo avisar', 'Revisá tu conexión y volvé a intentar.');
    } finally {
      setEnviandoNovedad(false);
    }
  };

  const saludo = (
    <View style={styles.saludo}>
      <Text variant="headlineMedium">
        {saludoDelDia()}, {usuario?.nombre?.split(' ')[0] ?? ''} 👋
      </Text>
      <Text variant="bodyMedium" style={estilosBase.tenue}>
        {ruta ? 'Tu ruta de hoy' : 'Tus rutas asignadas'}
      </Text>
    </View>
  );

  // Un día de suplencia: si a su unidad la maneja otro, se le dice claro que hoy
  // no tiene que iniciar esos viajes y quién los hace
  const avisoSuplencia = meCubre ? (
    <Tarjeta>
      <View style={styles.filaHero}>
        <Avatar.Icon
          size={40}
          icon="account-switch"
          style={{ backgroundColor: tema.colors.tertiaryContainer }}
          color={tema.colors.onTertiaryContainer}
        />
        <View style={styles.datosHero}>
          <Text variant="titleSmall" style={styles.negrita}>
            Hoy te cubre {meCubre.conductorNombre}
          </Text>
          <Text variant="bodySmall" style={estilosBase.tenue}>
            Maneja tu unidad {meCubre.busPlaca} durante todo el día. Sus viajes los inicia quien la
            maneja.
          </Text>
        </View>
      </View>
    </Tarjeta>
  ) : null;

  return (
    // scroll={false}: esta pantalla arma su propio layout en tres partes —
    // cabecera fija arriba, lista que se desplaza en el medio y la acción
    // principal clavada abajo. Manejando, el conductor no tiene que buscar el
    // botón de finalizar ni perder de vista cuánto le falta.
    <PantallaBase accionDerecha={avatarUsuario} scroll={false}>
      {sinAsignacion ? (
        <ScrollView contentContainerStyle={styles.lienzo}>
          {saludo}
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
        </ScrollView>
      ) : !ruta ? (
        /* --- Selector: el conductor elige la ruta que va a manejar. No se
           filtra por hora; puede arrancar la que corresponda cuando toque. --- */
        <ScrollView contentContainerStyle={styles.lienzo}>
          {saludo}
          {avisoSuplencia}
          {rutas.length > 0 && <TituloSeccion titulo="Elegí la ruta que vas a manejar" />}
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
                      {r.horaSalida ? `Sale ${horaDeTexto(r.horaSalida)} · ` : ''}
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
        </ScrollView>
      ) : (
        <View style={estilosBase.pantalla}>
          {/* ============================================================
              1. CABECERA FIJA — qué ruta es y cómo viene el viaje
              ============================================================ */}
          <View style={styles.cabecera}>
            {/* Con varias rutas asignadas, se cambia de una a otra tocando su
                pastilla. Con un viaje en curso no se muestran: ahí lo único que
                corresponde es terminar ese viaje. */}
            {rutas.length > 1 && viaje?.estado !== 'en_curso' && (
              <View style={styles.carrilChips}>
                <ChipFiltro
                  opciones={rutas.map((r) => ({
                    id: r.id,
                    etiqueta: r.nombre,
                    detalle: r.turno ? ETIQUETA_TURNO[r.turno] : undefined,
                  }))}
                  seleccionadaId={rutaElegidaId}
                  onSeleccionar={setRutaElegidaId}
                />
              </View>
            )}

            {/* Tarjeta blanca: el color entra solo en el ícono, en la barra de
                progreso y en la pastilla de "en curso" */}
            <Tarjeta>
              <View style={styles.filaHero}>
                <Avatar.Icon
                  size={46}
                  icon="bus-school"
                  style={{ backgroundColor: tema.colors.primary }}
                  color={tema.colors.onPrimary}
                />
                <View style={styles.datosHero}>
                  <Text variant="titleMedium" numberOfLines={1}>
                    {ruta.nombre}
                  </Text>
                  {/* LA UNIDAD, EN SU PROPIO RENGLÓN Y CON LA PLACA DESTACADA.
                      Antes iba perdida en medio de un texto corrido ("Turno
                      mañana · Bus HAB-1234 · 12 niños") y el conductor no la
                      encontraba. Es el dato que tiene que poder leerle a la
                      administración por teléfono sin buscar, así que va con la
                      placa en la fuente de cifras y su propio ícono. */}
                  <View style={styles.filaUnidad}>
                    <MaterialCommunityIcons
                      name="bus"
                      size={13}
                      color={tema.colors.onSurfaceVariant}
                    />
                    <Text variant="labelMedium" style={estilosBase.tenue}>
                      UNIDAD
                    </Text>
                    <Text variant="labelLarge" style={estilosBase.cifra}>
                      {bus?.placa ?? '—'}
                    </Text>
                  </View>
                  {/* La hora de salida que cargó la administración. Es SOLO
                      informativa: no impide iniciar el viaje antes ni después. */}
                  {!!ruta.horaSalida && (
                    <View style={styles.filaUnidad}>
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={13}
                        color={tema.colors.onSurfaceVariant}
                      />
                      <Text variant="labelMedium" style={estilosBase.tenue}>
                        SALIDA
                      </Text>
                      <Text variant="labelLarge" style={estilosBase.cifra}>
                        {horaDeTexto(ruta.horaSalida)}
                      </Text>
                    </View>
                  )}
                  <Text variant="bodySmall" style={estilosBase.tenue}>
                    {ruta.turno ? `Turno ${ETIQUETA_TURNO[ruta.turno]} · ` : ''}
                    {total} niños
                    {suplenciaDeRuta
                      ? ` · Cubrís a ${suplenciaDeRuta.titularNombre || 'otro conductor'}`
                      : ''}
                  </Text>
                </View>
                {viaje?.estado === 'en_curso' && (
                  <PastillaEstado texto="En curso" tono="vivo" pulso />
                )}
              </View>

              {viaje?.estado === 'en_curso' && (
                <>
                  {/* OCUPACIÓN DE CABINA — cuántos lleva de cuántos.
                      Va primero porque es la pregunta que el conductor se hace
                      al subirse al bus: "¿ya están todos?" */}
                  <View style={estilosBase.filaEntre}>
                    <Text variant="labelMedium" style={estilosBase.tenue}>
                      OCUPACIÓN DE CABINA
                    </Text>
                    <Text variant="labelMedium" style={estilosBase.tenue}>
                      <Text style={[estilosBase.cifra, { color: tema.colors.onSurface }]}>
                        {enBus + entregados}
                      </Text>
                      {` / ${total} alumnos`}
                    </Text>
                  </View>

                  {/* La barra tiene dos tramos: lo entregado (esmeralda) y lo
                      que va arriba del bus (zafiro). Juntos dicen en un solo
                      dibujo cuánto del viaje está hecho. */}
                  <View
                    style={[styles.barraFondo, { backgroundColor: 'rgba(255, 255, 255, 0.07)' }]}
                  >
                    <View
                      style={{
                        width: `${porcentaje(entregados)}%`,
                        backgroundColor: tema.colors.secondaryContainer,
                      }}
                    />
                    <View
                      style={{
                        width: `${porcentaje(enBus)}%`,
                        backgroundColor: tema.colors.primaryContainer,
                      }}
                    />
                  </View>

                  {/* LAS TRES MÉTRICAS — en qué va el viaje, de un vistazo.
                      Son los tres estados por los que pasa un niño, en orden.
                      Van en números grandes y no en una frase porque "06" se
                      lee de lejos y "quedan seis por recoger" hay que leerlo.
                      La tercera casilla cambia sola: mientras nadie falte
                      muestra los entregados, y en cuanto hay un niño que no
                      estaba, pasa a mostrar eso — que es lo que el conductor
                      necesita tener a la vista. */}
                  <FilaMetricas>
                    <Metrica
                      etiqueta="Esperando"
                      valor={Math.max(0, total - enBus - entregados - ausentes)}
                      tono="neutro"
                    />
                    <Metrica etiqueta="A bordo" valor={enBus} tono="vivo" />
                    {ausentes > 0 ? (
                      <Metrica etiqueta="No estaban" valor={ausentes} tono="alerta" />
                    ) : (
                      <Metrica etiqueta="Entregados" valor={entregados} tono="cumplido" />
                    )}
                  </FilaMetricas>

                  {/* GPS: si falla, el padre deja de ver el bus — por eso el
                      aviso vive acá arriba y no escondido en la lista. Va en
                      cian, el color de los datos de máquina: que el GPS ande no
                      es lo mismo que que el niño esté bien, y la app no puede
                      dar a entender que sí. Si el viaje lo maneja otro, el GPS
                      es de su teléfono y acá no se muestra. */}
                  {!viajeDeOtro && (
                    <View style={estilosBase.filaEntre}>
                      <PastillaEstado
                        texto={estadoGps === 'activo' ? 'GPS transmitiendo' : ETIQUETA_GPS[estadoGps]}
                        tono={estadoGps === 'activo' ? 'dato' : 'alerta'}
                        pulso={estadoGps === 'activo'}
                      />

                      {/* AVISAR UNA NOVEDAD. Va acá, dentro de la tarjeta del
                          viaje en curso, porque es donde el conductor mira
                          cuando algo se sale de lo normal — y porque solo tiene
                          sentido con el viaje andando: avisar de un tranque sin
                          haber salido no le dice nada a nadie. */}
                      <Button
                        mode="text"
                        compact
                        icon="alert-outline"
                        textColor={tema.colors.tertiary}
                        onPress={() => setNovedadAbierta(true)}
                      >
                        Avisar novedad
                      </Button>
                    </View>
                  )}
                </>
              )}
            </Tarjeta>
          </View>

          {/* ============================================================
              2. LO QUE SE DESPLAZA — la asistencia
              ============================================================ */}
          <ScrollView
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
          >
            {/* Mapa con las paradas numeradas en orden: dónde recoger, el punto
                de transbordo (si hay) y a qué escuela ir. Sirve antes y durante. */}
            <Button
              mode="outlined"
              icon="map-marker-path"
              disabled={recorrido.length === 0}
              style={styles.botonSecundario}
              contentStyle={styles.contenidoBotonGrande}
              onPress={() =>
                router.push({
                  pathname: '/recorrido',
                  params: {
                    rutaNombre: ruta.nombre,
                    paradas: JSON.stringify(recorrido),
                    // Cuál toca ahora: el mapa la encuadra de un toque
                    siguiente: String(indiceSiguiente),
                  },
                })
              }
            >
              Ver recorrido en el mapa
            </Button>

            {/* Si la ruta tiene niños que la app no puede leer, es que el panel
                todavía no actualizó los accesos. Se AVISA en vez de mostrar una
                lista incompleta sin decir nada: así es como se deja a un niño
                esperando en la parada. */}
            {ninosListos && ninosSinAcceso > 0 && (
              <Tarjeta style={{ backgroundColor: tema.colors.errorContainer }}>
                <Text variant="bodyMedium" style={{ color: tema.colors.onErrorContainer }}>
                  {ninosSinAcceso === 1 ? 'Falta 1 niño' : `Faltan ${ninosSinAcceso} niños`} de
                  esta ruta en tu lista. Avisale a la administración: en el panel tiene que tocar
                  «Recalcular accesos ahora» (Herramientas → Migración).
                </Text>
                <Button onPress={() => setIntento((i) => i + 1)}>Volver a cargar</Button>
              </Tarjeta>
            )}

            {/* Un viaje de esta ruta que inició otro conductor (por ejemplo, el
                titular salió antes de que se asignara la suplencia): se ve cómo
                viene, pero solo quien lo inició puede marcar y finalizarlo */}
            {viajeDeOtro && (
              <Tarjeta>
                <Text variant="bodyMedium">
                  Este viaje lo inició otro conductor. Solo quien lo inició puede marcar la asistencia
                  y finalizarlo.
                </Text>
              </Tarjeta>
            )}

            {viaje?.estado === 'finalizado' && (
              <Tarjeta style={{ backgroundColor: tema.colors.secondaryContainer }}>
                <View style={styles.filaHero}>
                  <Avatar.Icon
                    size={40}
                    icon="check-bold"
                    style={{ backgroundColor: tema.colors.secondary }}
                    color={tema.colors.onSecondary}
                  />
                  <View style={styles.datosHero}>
                    <Text
                      variant="titleMedium"
                      style={{ color: tema.colors.onSecondaryContainer }}
                    >
                      {ruta.turno ? `Viaje de ${ETIQUETA_TURNO[ruta.turno]}` : 'Viaje'} finalizado
                    </Text>
                    <Text variant="bodySmall" style={{ color: tema.colors.onSecondaryContainer }}>
                      La asistencia quedó registrada.
                    </Text>
                  </View>
                </View>
              </Tarjeta>
            )}

            {/* Antes de arrancar: a quiénes va a recoger, en gris. Sirve para
                revisar la lista sin poder marcar nada todavía. */}
            {!viaje && (
              <>
                <TituloSeccion
                  titulo={turno === 'manana' ? 'A quiénes vas a recoger' : 'A quiénes vas a llevar'}
                />
                {turno === 'manana'
                  ? gruposParadaSuben.map((g) => (
                      <GrupoAsistencia
                        key={`previa-p-${g.titulo}`}
                        titulo={g.titulo}
                        items={itemsRecogida(g.ninos)}
                        etiquetaAccion="Subió"
                        etiquetaGrupo="Iniciá el viaje"
                        onAccion={() => {}}
                        ocupado
                      />
                    ))
                  : gruposEscuelaSuben.map((g) => (
                      <GrupoAsistencia
                        key={`previa-e-${g.escuela.id}`}
                        titulo={g.escuela.nombre}
                        items={itemsRecogida(g.ninos)}
                        etiquetaAccion="Subió"
                        etiquetaGrupo="Iniciá el viaje"
                        onAccion={() => {}}
                        ocupado
                      />
                    ))}
              </>
            )}

            {viaje?.estado === 'en_curso' && (
              <>
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
                        etiquetaSecundaria="No estaba"
                        onSecundaria={marcarAusente}
                        etiquetaDeshacer="Deshacer"
                        onDeshacer={deshacer}
                        ocupado={registrando || viajeDeOtro}
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
                        etiquetaDeshacer="Deshacer"
                        onDeshacer={deshacer}
                        ocupado={registrando || viajeDeOtro}
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
                        etiquetaSecundaria="No estaba"
                        onSecundaria={marcarAusente}
                        etiquetaDeshacer="Deshacer"
                        onDeshacer={deshacer}
                        ocupado={registrando || viajeDeOtro}
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
                        etiquetaDeshacer="Deshacer"
                        onDeshacer={deshacer}
                        ocupado={registrando || viajeDeOtro}
                      />
                    ))}
                  </>
                )}

                {/* Transbordo: solo aparece si la ruta pasa por un punto */}
                {puntos.length > 0 && viaje && bus && !viajeDeOtro && (
                  <>
                    <TituloSeccion titulo="Transbordo" />
                    {puntos.map((p) => (
                      <Button
                        key={p.id}
                        mode="contained-tonal"
                        icon="swap-horizontal"
                        style={styles.botonSecundario}
                        contentStyle={styles.contenidoBotonGrande}
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
              </>
            )}
          </ScrollView>

          {/* ============================================================
              3. LA ACCIÓN — siempre visible, nunca hay que scrollear
              ============================================================ */}
          {viaje?.estado !== 'finalizado' && !viajeDeOtro && (
            <View
              style={[
                styles.pie,
                {
                  // El último tono del degradado: sin esto se ve una costura
                  backgroundColor: fondoPie(),
                  // Por encima de la barra de navegación del teléfono Y de la
                  // barra flotante de secciones: el botón grande queda arriba,
                  // que es lo que el conductor tiene que tocar sin mirar, y la
                  // navegación queda debajo sin taparlo.
                  paddingBottom: espacioBarra(insets.bottom),
                },
              ]}
            >
              {!!viajeEnCursoOtraRuta && (
                <Text variant="bodySmall" style={[styles.avisoPie, { color: tema.colors.error }]}>
                  Tenés un viaje en curso en otra ruta. Finalizalo antes de iniciar este.
                </Text>
              )}
              {!viaje ? (
                <BotonPrincipal
                  texto={`Iniciar viaje${ruta.turno ? ` ${ETIQUETA_TURNO[ruta.turno]}` : ''}`}
                  icono="play"
                  onPress={manejarIniciar}
                  cargando={procesando}
                  deshabilitado={procesando || !!viajeEnCursoOtraRuta}
                />
              ) : (
                <BotonPrincipal
                  texto="Finalizar viaje"
                  icono="flag-checkered"
                  tono="peligro"
                  onPress={manejarFinalizar}
                  cargando={procesando}
                  deshabilitado={procesando}
                />
              )}
            </View>
          )}
        </View>
      )}

      {/* ================================================================
          AVISAR UNA NOVEDAD
          ================================================================
          Lo que pasa a mitad de viaje y no es una marca de asistencia: se
          pinchó una rueda, hay un tranque, se largó a llover.

          El conductor está manejando, así que la pantalla pide UN toque: elige
          el tipo y listo. El campo de texto es opcional y está abajo, no
          arriba — si fuera obligatorio, nadie avisaría nada.

          Se avisa a los padres de los niños que van ARRIBA del bus (no a
          todos: al que todavía no recogieron, "el bus tuvo un problema" lo
          asusta sin motivo) y a la administración, que recibe además quién, en
          qué unidad y en qué ruta. */}
      <Portal>
        <Dialog
          visible={novedadAbierta}
          onDismiss={() => setNovedadAbierta(false)}
          style={{ backgroundColor: tema.colors.elevation.level3 }}
        >
          <Dialog.Title>Avisar una novedad</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={[estilosBase.tenue, styles.aclaracionNovedad]}>
              Se les avisa a los padres de los {enBus} {enBus === 1 ? 'niño' : 'niños'} que van a
              bordo y a la administración.
            </Text>

            {TIPOS_INCIDENCIA.map((t) => (
              <TouchableRipple
                key={t.tipo}
                onPress={() => setTipoNovedad(t.tipo)}
                borderless
                style={[
                  styles.opcionNovedad,
                  {
                    backgroundColor:
                      tipoNovedad === t.tipo
                        ? 'rgba(245, 158, 11, 0.18)'
                        : 'rgba(255, 255, 255, 0.05)',
                  },
                ]}
              >
                <View style={styles.filaOpcion}>
                  <MaterialCommunityIcons
                    name={t.icono as keyof typeof MaterialCommunityIcons.glyphMap}
                    size={20}
                    color={tipoNovedad === t.tipo ? tema.colors.tertiary : tema.colors.onSurfaceVariant}
                  />
                  <Text variant="titleSmall" style={styles.textoOpcion}>
                    {t.etiqueta}
                  </Text>
                  {tipoNovedad === t.tipo && (
                    <MaterialCommunityIcons name="check" size={20} color={tema.colors.tertiary} />
                  )}
                </View>
              </TouchableRipple>
            ))}

            <Campo
              label="Detalle (opcional)"
              value={textoNovedad}
              onChangeText={setTextoNovedad}
              multiline
              numberOfLines={2}
              style={styles.campoNovedad}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setNovedadAbierta(false)} disabled={enviandoNovedad}>
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={enviarNovedad}
              loading={enviandoNovedad}
              disabled={enviandoNovedad || !tipoNovedad}
            >
              Avisar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </PantallaBase>
  );
}

// Cuadradito de color + texto, para explicar qué significa cada tramo de la
// barra de progreso sin tener que escribir una leyenda larga.
const styles = StyleSheet.create({
  saludo: { gap: 2 },
  negrita: { fontFamily: FUENTES.textoNegrita },
  avatarToque: { borderRadius: 19 },

  // Pantallas simples (sin ruta elegida): scroll normal con márgenes
  lienzo: {
    paddingHorizontal: ESPACIO.pantalla,
    paddingBottom: 40,
    gap: ESPACIO.seccion,
  },

  // 1. Cabecera fija
  cabecera: { paddingHorizontal: ESPACIO.pantalla, gap: ESPACIO.interno },
  carrilChips: { marginBottom: 2 },
  filaHero: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno + 2 },
  filaUnidad: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  aclaracionNovedad: { marginBottom: ESPACIO.interno },
  opcionNovedad: { borderRadius: RADIO.control, marginBottom: ESPACIO.minimo },
  filaOpcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIO.interno,
    paddingHorizontal: ESPACIO.interno,
    minHeight: 48,
  },
  textoOpcion: { flex: 1 },
  campoNovedad: { marginTop: ESPACIO.minimo },
  datosHero: { flex: 1, gap: 2 },
  pastilla: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIO.pastilla },
  barraFondo: {
    flexDirection: 'row',
    height: 10,
    borderRadius: RADIO.pastilla,
    overflow: 'hidden',
  },
  leyenda: { flexDirection: 'row', alignItems: 'center', gap: 5 },

  // 2. Lista
  lista: {
    paddingHorizontal: ESPACIO.pantalla,
    paddingTop: ESPACIO.seccion,
    paddingBottom: ESPACIO.seccion,
    gap: ESPACIO.seccion,
  },
  botonSecundario: { borderRadius: RADIO.control },
  contenidoBotonGrande: { paddingVertical: 8 },

  // 3. Pie fijo
  pie: {
    paddingHorizontal: ESPACIO.pantalla,
    paddingTop: ESPACIO.interno,
    gap: ESPACIO.minimo,
    ...SOMBRA_FLOTANTE,
  },
  avisoPie: { textAlign: 'center' },
});
