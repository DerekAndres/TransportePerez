import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  Avatar,
  IconButton,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import AparicionSuave from '@/components/AparicionSuave';
import FichaConductor from '@/components/FichaConductor';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import TarjetaAviso from '@/components/TarjetaAviso';
import TituloSeccion from '@/components/TituloSeccion';
import TileAccion from '@/components/TileAccion';
import PastillaEstado, { type TonoEstado } from '@/components/PastillaEstado';
import LineaViaje, { type EtapaViaje } from '@/components/LineaViaje';
import MapaBusEnVivo, { type EstadoMapa } from '@/components/MapaBusEnVivo';
import {
  escucharRegistrosDeNino,
  escucharViajesDeRuta,
  listarHijos,
  listarContactosPadre,
  obtenerSuplenciaDeHoy,
  listarRutasDeNino,
  obtenerBus,
  listarRegistrosDeNino,
  listarViajesDeRutaPorFecha,
  obtenerEscuela,
} from '@/services/padreService';
import { escucharAvisosDeCanales, listarCanalesDeEscuelas } from '@/services/canalesService';
import { escucharBandeja, type ResumenConversacion } from '@/services/mensajesService';
import { fechaDeHoy, turnoActual } from '@/services/viajesService';
import {
  ESPACIO,
  PROPORCION_MAPA_INICIO,
  RADIO,
  SOMBRA_FLOTANTE,
  VIDRIO_OSCURO,
  estilosBase,
} from '@/constants/estilos';
import { horaCorta, saludoDelDia } from '@/utils/tiempo';
import {
  ICONO_EVENTO,
  TEXTO_EVENTO_BREVE,
  registrosEfectivos,
  tonoEvento,
} from '@/utils/eventos';
import type { Aviso, Bus, Canal, Nino, ParadaNino, Registro, Ruta, Usuario, Viaje } from '@/types/models';
import CargandoBus from '@/components/CargandoBus';
import { FUENTES } from '@/constants/tema';

// ============================================
// INICIO DEL PADRE — "PANEL DIVIDIDO"
// ============================================
// La pantalla está partida en dos, y esa división es toda su idea:
//
//   ARRIBA — LO QUE ESTÁ PASANDO. El mapa en vivo del hijo que va en el bus,
//   a sangre (llega a los bordes del teléfono, sin tarjeta que lo enmarque),
//   con su nombre, hacia dónde va y a qué hora subió montados sobre un velo
//   oscuro. Es lo primero que se ve al abrir la app, sin buscarlo y sin tocar
//   nada, porque es lo único que el padre necesita saber a diario.
//
//   ABAJO — LO QUE PUEDE HACER. La cuadrícula de accesos: mensajes,
//   solicitudes, inscribir un hijo y pedir un cambio de lugar.
//
// Debajo siguen los otros hijos, los avisos y los viajes pasados. La estructura
// se eligió comparando seis alternativas sobre maquetas (ver ESTADO-ACTUAL.md).
// Si ningún hijo está viajando, la mitad de arriba simplemente no se dibuja: no
// tiene sentido reservar media pantalla para un mapa vacío.
//
// LOS AVISOS SE MUESTRAN, NO SE ANUNCIAN: si la administración publicó un
// comunicado en el canal de la escuela de un hijo, acá aparece el TEXTO del
// aviso, no un botón que dice "Avisos". Un botón obliga al padre a entrar para
// enterarse de si hay algo — y entonces no se entera. El canal del que viene
// cada aviso sale del mismo criterio de siempre: es padre del canal quien tiene
// un hijo activo en esa escuela, sin inscribirse a nada.
//
// La navegación general no vive acá sino en el menú ☰ del encabezado; el inicio
// solo ofrece los caminos más usados.

// Cuántos avisos se muestran en el inicio. Los demás están en "Ver todos".
const AVISOS_EN_INICIO = 2;

// 'ausente' = el bus pasó por su parada y el niño no estaba. Se muestra en
// rojo: para el padre es la información más importante del día.
type EstadoHijo = 'en_casa' | 'en_bus' | 'entregado' | 'ausente';

// Cuántos días atrás se miran para la sección "Viajes pasados". Se mantiene
// chico a propósito: cada día son dos consultas por ruta, y el historial
// completo ya está a un toque en la pantalla de Historial.
const DIAS_RECIENTES = 3;

// Parte "fija" de cada hijo: se carga una vez (o al deslizar para refrescar).
// Lo que cambia durante el día (viajes y registros) llega por listeners.
interface BaseHijo {
  nino: Nino;
  escuelaNombre: string;
  rutas: Ruta[];
}

interface FichaHijo {
  nino: Nino;
  escuelaNombre: string;
  estado: EstadoHijo;
  horaSubio: string | null;
  horaBajo: string | null;
  viajeEnCurso: Viaje | null;
  // La unidad de su ruta, para poder mostrar quién lo lleva. Va en la ficha y
  // no se busca al dibujar porque el dato viene de `base`, que solo existe acá.
  busId: string | null;
  // El nombre de la ruta, para la ficha del conductor
  rutaNombre: string | null;
}

// Un evento de asistencia de días anteriores, ya listo para mostrar
interface EventoReciente {
  id: string;
  ninoNombre: string;
  evento: Registro['evento'];
  fecha: string;
  hora: string;
  momento: number; // para ordenar
}

// Viaje "vigente" del día: el que está en curso o, si no hay, el último finalizado
function viajeVigenteDe(viajes: Viaje[]): Viaje | null {
  return (
    viajes.find((v) => v.estado === 'en_curso') ??
    [...viajes]
      .filter((v) => v.estado === 'finalizado')
      .sort((a, b) => (a.horaInicio?.toMillis() ?? 0) - (b.horaInicio?.toMillis() ?? 0))
      .pop() ??
    null
  );
}

// A dónde va el bus con este niño ahora: en la tarde puede ser la entrega
// alternativa (casa de la abuela, etc.); el resto del tiempo, su casa.
function destinoDe(nino: Nino): ParadaNino | undefined {
  return turnoActual() === 'tarde' && nino.paradaTarde ? nino.paradaTarde : nino.parada;
}

// Suma (o resta) días a una fecha "YYYY-MM-DD"
function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const d = new Date(anio, mes - 1, dia + dias);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// "Hoy", "Ayer" o el día abreviado
function etiquetaDia(fecha: string): string {
  const hoy = fechaDeHoy();
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, -1)) return 'Ayer';
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-HN', {
    weekday: 'short',
    day: 'numeric',
  });
}

const ETIQUETA_ESTADO: Record<EstadoHijo, string> = {
  en_casa: 'En casa',
  en_bus: 'En el bus',
  entregado: 'Entregado',
  ausente: 'No estaba',
};

// Qué tono del sistema le toca a cada estado. Son los mismos cuatro de toda la
// app, y el conductor ve exactamente los mismos en su lista de asistencia:
//   en casa   = gris  (todavía no pasó nada)
//   en el bus = ZAFIRO con pulso (está pasando ahora)
//   entregado = ESMERALDA (se cumplió)
//   no estaba = ROJO (falló el servicio, tiene que saltar a la vista)
const TONO_ESTADO: Record<EstadoHijo, TonoEstado> = {
  en_casa: 'espera',
  en_bus: 'vivo',
  entregado: 'cumplido',
  ausente: 'alerta',
};

const ETAPA_DE_ESTADO: Record<EstadoHijo, EtapaViaje> = {
  en_casa: 'pendiente',
  en_bus: 'en_camino',
  entregado: 'completado',
  // El viaje no llegó a empezar para este niño
  ausente: 'pendiente',
};

export default function InicioPadreScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();
  const insets = useSafeAreaInsets();
  // El mapa se lleva casi la mitad de la pantalla, medido sobre el alto REAL
  // del teléfono (ver PROPORCION_MAPA_INICIO). Incluye la barra de estado,
  // porque el mapa pasa por debajo de ella.
  const { height: altoPantalla } = useWindowDimensions();
  const altoMapa = Math.round(altoPantalla * PROPORCION_MAPA_INICIO);

  const [base, setBase] = useState<BaseHijo[] | null>(null);
  const [viajesPorRuta, setViajesPorRuta] = useState<Map<string, Viaje[]>>(new Map());
  const [registrosPorClave, setRegistrosPorClave] = useState<Map<string, Registro[]>>(new Map());
  const [estadoMapaPorHijo, setEstadoMapaPorHijo] = useState<Map<string, EstadoMapa>>(new Map());
  const [canales, setCanales] = useState<Canal[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [recientes, setRecientes] = useState<EventoReciente[]>([]);
  const [resumenes, setResumenes] = useState<ResumenConversacion[]>([]);
  // Unidad y conductor de cada ruta, para la tarjeta del viaje en curso
  const [busesPorId, setBusesPorId] = useState<Map<string, Bus>>(new Map());
  const [conductoresPorId, setConductoresPorId] = useState<Map<string, Usuario>>(new Map());
  // La ficha completa de quién lleva al niño (components/FichaConductor.tsx).
  // Los datos se quedan guardados aunque la ficha se cierre: así no se vacía de
  // golpe durante el fundido de salida. Se reemplazan al volver a abrirla.
  const [fichaDeQuienLleva, setFichaDeQuienLleva] = useState<{
    conductor: Usuario;
    bus?: Bus;
    rutaNombre: string | null;
    ninoNombre: string;
  } | null>(null);
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState('');

  // --- Carga principal: hijos, escuelas y rutas ---
  const cargar = useCallback(async () => {
    if (!usuario) return;
    setError('');
    try {
      const hijos = await listarHijos(usuario.id);

      const escuelaIds = [...new Set(hijos.map((h) => h.escuelaId).filter((x): x is string => !!x))];
      const escuelas = new Map<string, string>();
      await Promise.all(
        escuelaIds.map(async (id) => {
          const e = await obtenerEscuela(id);
          if (e) escuelas.set(id, e.nombre);
        })
      );

      const resultado = await Promise.all(
        hijos.map(async (nino): Promise<BaseHijo> => ({
          nino,
          escuelaNombre: escuelas.get(nino.escuelaId ?? '') ?? '—',
          rutas: await listarRutasDeNino(nino.id),
        }))
      );
      setBase(resultado);

      // --- La unidad y el conductor de cada ruta ---
      // Es lo que el diseño pone dentro de la tarjeta del viaje: con quién va
      // el niño y en qué unidad, más los botones para llamarlo o escribirle.
      // Se resuelve la misma cadena que usa el conductor pero al revés:
      // ruta → busId → bus → conductorId → usuario.
      //
      // Va DESPUÉS de `setBase` y sin `await`: son datos de adorno de la
      // tarjeta, y si la unidad tarda o falla, el estado del hijo —que es lo
      // que de verdad importa— ya se está viendo.
      const busIds = [...new Set(resultado.flatMap((b) => b.rutas.map((r) => r.busId)).filter(Boolean))];
      Promise.all(
        busIds.map(async (id) => {
          const [bus, suplencia] = await Promise.all([
            obtenerBus(id).catch(() => null),
            obtenerSuplenciaDeHoy(id),
          ]);
          // Un día de suplencia quien lleva al hijo es el SUPLENTE: se muestra a
          // él (con su teléfono) en lugar del titular de la unidad
          return bus && suplencia ? { ...bus, conductorId: suplencia.conductorId } : bus;
        })
      )
        .then(async (listaBuses) => {
          const buses = new Map<string, Bus>();
          listaBuses.forEach((bus) => {
            if (bus) buses.set(bus.id, bus);
          });
          setBusesPorId(buses);
          const { conductores } = await listarContactosPadre(usuario.id).catch(() => ({
            conductores: [] as Usuario[],
            admin: null,
          }));
          setConductoresPorId(new Map(conductores.map((c) => [c.id, c])));
        })
        .catch(() => {});

      // Los avisos dependen de las escuelas de los hijos
      listarCanalesDeEscuelas(escuelaIds).then(setCanales).catch(() => setCanales([]));
    } catch {
      setError('No se pudieron cargar tus hijos. Revisá tu conexión.');
      setBase([]);
    }
  }, [usuario]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // --- Viajes de hoy, en vivo (uno por ruta) ---
  useEffect(() => {
    if (!base) return;
    const hoy = fechaDeHoy();
    const rutaIds = [...new Set(base.flatMap((b) => b.rutas.map((r) => r.id)))];
    const unsubs = rutaIds.map((rutaId) =>
      escucharViajesDeRuta(rutaId, hoy, (viajes) => {
        setViajesPorRuta((prev) => new Map(prev).set(rutaId, viajes));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [base]);

  // --- Registros del viaje vigente de cada hijo, en vivo ---
  useEffect(() => {
    if (!base) return;
    const unsubs = base.flatMap((b) => {
      const vigente = viajeVigenteDe(b.rutas.flatMap((r) => viajesPorRuta.get(r.id) ?? []));
      if (!vigente) return [];
      const clave = `${b.nino.id}:${vigente.id}`;
      return [
        escucharRegistrosDeNino(vigente.id, b.nino.id, (registros) => {
          setRegistrosPorClave((prev) => new Map(prev).set(clave, registros));
        }),
      ];
    });
    return () => unsubs.forEach((u) => u());
  }, [base, viajesPorRuta]);

  // --- Bandeja de mensajes, en vivo ---
  useEffect(() => {
    if (!usuario) return;
    return escucharBandeja(usuario.id, setResumenes);
  }, [usuario]);

  // --- Avisos de los canales del padre, en vivo ---
  // En vivo y no una carga puntual: si la administración publica algo mientras
  // el padre tiene la app abierta, el aviso aparece solo en el inicio.
  const clavesCanales = canales.map((c) => c.id).join(',');
  useEffect(() => {
    const ids = clavesCanales ? clavesCanales.split(',') : [];
    if (ids.length === 0) {
      setAvisos([]);
      return;
    }
    return escucharAvisosDeCanales(ids, setAvisos);
  }, [clavesCanales]);

  // Nombre de cada canal, para decir de dónde viene cada aviso
  const nombrePorCanal = useMemo(
    () => new Map(canales.map((c) => [c.id, c.nombre])),
    [canales]
  );

  // --- Viajes pasados (últimos días). Se carga después de lo principal para
  //     que la tarjeta del viaje aparezca de inmediato. ---
  useEffect(() => {
    if (!base || base.length === 0) return;
    let cancelado = false;

    (async () => {
      const fechas = Array.from({ length: DIAS_RECIENTES }, (_, i) => sumarDias(fechaDeHoy(), -i));
      try {
        const porHijo = await Promise.all(
          base.map(async (b) => {
            const porRuta = await Promise.all(
              b.rutas.map(async (ruta) => {
                const porFecha = await Promise.all(
                  fechas.map(async (fecha) => {
                    const viajes = await listarViajesDeRutaPorFecha(ruta.id, fecha);
                    const porViaje = await Promise.all(
                      viajes.map(async (viaje) => {
                        const propios = registrosEfectivos(
                          await listarRegistrosDeNino(viaje.id, b.nino.id)
                        );
                        return propios.map(
                          (r): EventoReciente => ({
                            id: r.id,
                            ninoNombre: b.nino.nombre,
                            evento: r.evento,
                            fecha,
                            hora: horaCorta(r.hora),
                            momento: r.hora.toMillis(),
                          })
                        );
                      })
                    );
                    return porViaje.flat();
                  })
                );
                return porFecha.flat();
              })
            );
            return porRuta.flat();
          })
        );

        if (cancelado) return;
        setRecientes(porHijo.flat().sort((a, b2) => b2.momento - a.momento).slice(0, 5));
      } catch {
        if (!cancelado) setRecientes([]);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [base]);

  // --- Fichas derivadas de todo lo anterior ---
  const fichas = useMemo<FichaHijo[] | null>(() => {
    if (!base) return null;
    return base.map((b) => {
      const viajesHoy = b.rutas.flatMap((r) => viajesPorRuta.get(r.id) ?? []);
      const viajeEnCurso = viajesHoy.find((v) => v.estado === 'en_curso') ?? null;
      const vigente = viajeVigenteDe(viajesHoy);

      let estado: EstadoHijo = 'en_casa';
      let horaSubio: string | null = null;
      let horaBajo: string | null = null;

      if (vigente) {
        // Solo las marcas que quedaron en pie: si el conductor deshizo algo,
        // para el padre esa marca nunca existió
        const registros = registrosEfectivos(
          registrosPorClave.get(`${b.nino.id}:${vigente.id}`) ?? []
        );
        const subio = registros.find((r) => r.evento === 'subio');
        const bajo = registros.find((r) => r.evento === 'bajo');
        if (subio) horaSubio = horaCorta(subio.hora);
        if (bajo) horaBajo = horaCorta(bajo.hora);
        const ultimo = registros[registros.length - 1];
        if (ultimo) {
          estado =
            ultimo.evento === 'subio'
              ? 'en_bus'
              : ultimo.evento === 'no_estaba'
                ? 'ausente'
                : 'entregado';
        }
      }

      return {
        nino: b.nino,
        escuelaNombre: b.escuelaNombre,
        estado,
        horaSubio,
        horaBajo,
        viajeEnCurso,
        busId: b.rutas[0]?.busId ?? null,
        rutaNombre: b.rutas[0]?.nombre ?? null,
      };
    });
  }, [base, viajesPorRuta, registrosPorClave]);

  const totalNoLeidos = useMemo(
    () => resumenes.reduce((suma, r) => suma + r.noLeidos, 0),
    [resumenes]
  );

  const refrescar = async () => {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  };

  const verPerfil = (ninoId: string) => router.push({ pathname: '/hijo', params: { ninoId } });

  const verHistorial = (nino: Nino) =>
    router.push({ pathname: '/historial', params: { ninoId: nino.id, hijoNombre: nino.nombre } });

  const verMapa = (ficha: FichaHijo) => {
    if (!ficha.viajeEnCurso) return;
    const destino = destinoDe(ficha.nino);
    router.push({
      pathname: '/mapa',
      params: {
        viajeId: ficha.viajeEnCurso.id,
        hijoNombre: ficha.nino.nombre,
        paradaNombre: destino?.nombre ?? '',
        paradaLat: String(destino?.lat ?? ''),
        paradaLng: String(destino?.lng ?? ''),
      },
    });
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

  if (!fichas) {
    return (
      <PantallaBase scroll={false} accionDerecha={avatarUsuario}>
        <View style={estilosBase.centrado}>
          <CargandoBus texto="Cargando tus hijos…" />
        </View>
      </PantallaBase>
    );
  }

  // Los hijos con el bus andando AHORA se llevan la pantalla entera; los demás
  // quedan en tarjetas compactas debajo. Esa es toda la idea de este inicio:
  // lo que está pasando se ve sin buscarlo.
  const enViaje = fichas.filter((f) => f.viajeEnCurso);
  const enReposo = fichas.filter((f) => !f.viajeEnCurso);
  // Con un viaje en curso el mapa se lleva la parte de arriba de la pantalla:
  // no hay encabezado ni saludo, solo el avatar flotando sobre el mapa.
  const hayViaje = enViaje.length > 0;
  // A quién apuntan los accesos de "Perfil" e "Historial": el hijo que está
  // viajando; si no viaja ninguno, el primero. Van con el NOMBRE en el título
  // para que nunca haya duda de a qué hijo se refieren.
  const destacado = enViaje[0] ?? fichas[0] ?? null;

  return (
    <PantallaBase
      accionDerecha={hayViaje ? undefined : avatarUsuario}
      sinEncabezado={hayViaje}
      refrescando={refrescando}
      onRefrescar={refrescar}
    >
      {/* Saludo: solo cuando no hay viaje en curso. Con el bus andando, la
          pantalla arranca directamente con el mapa. */}
      {!hayViaje && (
      <View style={styles.saludo}>
        <Text variant="headlineMedium">
          {saludoDelDia()}, {usuario?.nombre?.split(' ')[0] ?? ''} 👋
        </Text>
        <Text variant="bodyMedium" style={[estilosBase.tenue, styles.fecha]}>
          {new Date().toLocaleDateString('es-HN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Text>
      </View>
      )}

      {error !== '' && <Text style={{ color: tema.colors.error }}>{error}</Text>}

      {fichas.length === 0 && error === '' && (
        <Tarjeta>
          <Text variant="titleMedium" style={styles.negrita}>
            Todavía no tenés hijos registrados
          </Text>
          <Text style={estilosBase.tenue}>
            Inscribí a tu hijo desde Solicitudes y la administración lo asigna a una ruta.
          </Text>
        </Tarjeta>
      )}

      {/* ================================================================
          EL VIAJE EN CURSO — lo primero y lo más grande de la pantalla
          ================================================================ */}
      {enViaje.map((ficha, indice) => {
        const destino = destinoDe(ficha.nino);
        // La unidad y quién la maneja. Se resuelve ruta → bus → conductor; si
        // algún eslabón falta, la fila simplemente no se dibuja (el estado del
        // hijo, que es lo importante, no depende de esto).
        const busDeHoy = ficha.busId ? busesPorId.get(ficha.busId) : undefined;
        const conductorDeHoy = busDeHoy?.conductorId
          ? conductoresPorId.get(busDeHoy.conductorId)
          : undefined;
        const estadoMapa = estadoMapaPorHijo.get(ficha.nino.id);
        const enVivo = estadoMapa?.tipo === 'en_vivo';

        // En la mañana el viaje va de la casa a la escuela; en la tarde, al revés
        const esManana = turnoActual() === 'manana';
        const llegada = esManana ? ficha.escuelaNombre : (destino?.nombre ?? 'Casa');

        return (
          <AparicionSuave key={ficha.nino.id} indice={indice}>
            {/* `panelSuperior` se sale del margen lateral de la pantalla con
                márgenes negativos: así el mapa llega hasta los bordes del
                teléfono, que es lo que hace que esta mitad se lea como una
                pieza y no como una tarjeta más de la lista. */}
            <View style={styles.panelSuperior}>
              <TouchableRipple onPress={() => verMapa(ficha)}>
                <View style={styles.hero}>
                  {destino ? (
                    <MapaBusEnVivo
                      viajeId={ficha.viajeEnCurso!.id}
                      paradaLat={destino.lat}
                      paradaLng={destino.lng}
                      paradaNombre={destino.nombre}
                      unidad={busDeHoy?.placa ?? ''}
                      interactivo={false}
                      onEstado={(nuevo) =>
                        setEstadoMapaPorHijo((prev) => new Map(prev).set(ficha.nino.id, nuevo))
                      }
                      style={[styles.mapaHero, { height: altoMapa }]}
                    />
                  ) : (
                    // El niño viaja pero nadie marcó su casa en el mapa: se dice
                    // qué falta, en vez de mostrar un recuadro vacío
                    <View
                      style={[
                        styles.mapaHero,
                        styles.sinMapa,
                        {
                          height: altoMapa,
                          paddingTop: insets.top,
                          backgroundColor: tema.colors.primaryContainer,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="map-marker-off-outline"
                        size={30}
                        color={tema.colors.onPrimaryContainer}
                      />
                      <Text
                        variant="bodySmall"
                        style={{ color: tema.colors.onPrimaryContainer, textAlign: 'center' }}
                      >
                        Falta marcar en el mapa dónde se recoge a {ficha.nino.nombre}. Pedilo desde
                        Solicitudes.
                      </Text>
                    </View>
                  )}

                  {/* Señal del GPS. Va en CIAN, el color de los datos de
                      máquina, y no en el zafiro de "está pasando ahora": que el
                      bus transmita no es lo mismo que que el niño esté bien, y
                      la app no puede dar a entender que sí. El punto late solo
                      mientras llega señal — un punto quieto y uno que late
                      dicen cosas distintas sin que el padre lea nada. */}
                  <PastillaEstado
                    texto={enVivo ? `En vivo · ${estadoMapa.hora}` : 'Esperando señal'}
                    tono={enVivo ? 'dato' : 'espera'}
                    pulso={enVivo}
                    style={[styles.pastillaFlotante, { top: insets.top + 10 }]}
                  />

                  {/* Los datos montados sobre el mapa. El velo NO es
                      decorativo: sin él, el texto blanco sobre un mapa claro
                      sería ilegible. Por eso está aunque la app sea clara. */}
                  <View style={styles.velo}>
                    <Text variant="labelSmall" style={styles.etiquetaVelo}>
                      En camino
                    </Text>
                    <Text variant="headlineSmall" numberOfLines={1} style={styles.nombreVelo}>
                      {ficha.nino.nombre}
                    </Text>
                    <View style={styles.filaMini}>
                      <MaterialCommunityIcons
                        name="map-marker"
                        size={13}
                        color="rgba(255,255,255,0.82)"
                      />
                      <Text variant="bodySmall" numberOfLines={1} style={styles.blancoTenue}>
                        {ficha.horaSubio ? `Subió ${ficha.horaSubio} · ` : ''}Va hacia {llegada}
                      </Text>
                    </View>
                  </View>

                  {/* La burbuja del perfil, flotando sobre el mapa. Es el único
                      control que queda arriba: sin encabezado, es la forma de
                      llegar a la configuración. */}
                  <TouchableRipple
                    onPress={() => router.push('/configuracion')}
                    borderless
                    style={[styles.avatarFlotante, { top: insets.top + 6 }]}
                    accessibilityLabel="Ir a configuración"
                  >
                    {usuario?.foto ? (
                      <Avatar.Image size={40} source={{ uri: usuario.foto }} />
                    ) : (
                      <Avatar.Text
                        size={40}
                        label={usuario?.nombre.trim().charAt(0).toUpperCase() || '?'}
                        style={{ backgroundColor: tema.colors.surface }}
                        color={tema.colors.primary}
                      />
                    )}
                  </TouchableRipple>
                </View>
              </TouchableRipple>

            </View>

            {/* ================================================================
                QUIÉN LO LLEVA
                ================================================================
                Es la pieza que faltaba de la maqueta, y la que más calma a un
                padre: no "el bus", sino una persona con nombre a la que puede
                llamar en el momento. Los dos botones son los dos caminos que el
                sistema ya tiene — el teléfono y el chat de la Fase 7.

                Va FUERA del panel del mapa (que se sale del margen con márgenes
                negativos) para que respete el canal de lectura de la pantalla.

                Solo aparece si la cadena ruta → unidad → conductor está
                completa: media fila con huecos comunica peor que nada. */}
            {!!conductorDeHoy && (
              <Tarjeta
                style={styles.tarjetaConductor}
                onPress={() => {
                  setFichaDeQuienLleva({
                    conductor: conductorDeHoy,
                    bus: busDeHoy,
                    rutaNombre: ficha.rutaNombre,
                    ninoNombre: ficha.nino.nombre,
                  });
                  setFichaAbierta(true);
                }}
              >
                <View style={styles.filaSimple}>
                  {conductorDeHoy.foto ? (
                    <Avatar.Image size={44} source={{ uri: conductorDeHoy.foto }} />
                  ) : (
                    <Avatar.Text
                      size={44}
                      label={conductorDeHoy.nombre.trim().charAt(0).toUpperCase() || '?'}
                      style={{ backgroundColor: tema.colors.primaryContainer }}
                      color={tema.colors.onPrimaryContainer}
                    />
                  )}
                  <View style={styles.textoFila}>
                    <Text variant="titleSmall" numberOfLines={1}>
                      {conductorDeHoy.nombre}
                    </Text>
                    <Text variant="bodySmall" numberOfLines={1} style={estilosBase.tenue}>
                      Conductor{busDeHoy?.placa ? ` · Unidad ${busDeHoy.placa}` : ''}
                    </Text>
                    {/* Sin esta pista, nadie descubre que la tarjeta se toca:
                        los dos botones de la derecha hacen creer que eso es
                        todo lo que hay. */}
                    <Text variant="labelSmall" style={{ color: tema.colors.primary }}>
                      TOCÁ PARA VER SUS DATOS
                    </Text>
                  </View>
                  {!!conductorDeHoy.telefono && (
                    <IconButton
                      icon="phone"
                      mode="contained-tonal"
                      size={20}
                      onPress={() => Linking.openURL(`tel:${conductorDeHoy.telefono}`)}
                      accessibilityLabel={`Llamar a ${conductorDeHoy.nombre}`}
                    />
                  )}
                  <IconButton
                    icon="message-text"
                    mode="contained-tonal"
                    size={20}
                    onPress={() =>
                      router.push({
                        pathname: '/conversacion',
                        params: {
                          otroId: conductorDeHoy.id,
                          otroNombre: conductorDeHoy.nombre,
                        },
                      })
                    }
                    accessibilityLabel={`Escribirle a ${conductorDeHoy.nombre}`}
                  />
                </View>
              </Tarjeta>
            )}
          </AparicionSuave>
        );
      })}

      {/* --- NÚCLEO FAMILIAR: los hijos que hoy no están viajando --- */}
      {enReposo.length > 0 && (
        <>
          <TituloSeccion
            titulo={enViaje.length > 0 ? 'Núcleo familiar' : 'Tus hijos'}
            detalle={`${fichas.length} inscritos`}
          />
          {enReposo.map((ficha, indice) => {
            const destino = destinoDe(ficha.nino);
            const esManana = turnoActual() === 'manana';
            const origen = esManana ? 'Casa' : ficha.escuelaNombre;
            const llegada = esManana ? ficha.escuelaNombre : (destino?.nombre ?? 'Casa');

            return (
              <AparicionSuave key={ficha.nino.id} indice={enViaje.length + indice}>
                <Tarjeta onPress={() => verPerfil(ficha.nino.id)}>
                  <View style={styles.filaSimple}>
                    {ficha.nino.foto ? (
                      <Avatar.Image size={46} source={{ uri: ficha.nino.foto }} />
                    ) : (
                      <Avatar.Text
                        size={46}
                        label={ficha.nino.nombre.trim().charAt(0).toUpperCase() || '?'}
                        style={{ backgroundColor: tema.colors.primaryContainer }}
                        color={tema.colors.onPrimaryContainer}
                      />
                    )}
                    <View style={styles.textoFila}>
                      <Text variant="titleSmall" numberOfLines={1} style={styles.negrita}>
                        {ficha.nino.nombre}
                      </Text>
                      <Text variant="bodySmall" numberOfLines={1} style={estilosBase.tenue}>
                        {ficha.escuelaNombre}
                      </Text>
                    </View>
                    <PastillaEstado
                      texto={ETIQUETA_ESTADO[ficha.estado]}
                      tono={TONO_ESTADO[ficha.estado]}
                      // Solo late lo que está pasando AHORA: el niño arriba del bus
                      pulso={ficha.estado === 'en_bus'}
                    />
                  </View>

                  <LineaViaje
                    origen={origen}
                    destino={llegada}
                    etapa={ETAPA_DE_ESTADO[ficha.estado]}
                    horaOrigen={ficha.horaSubio}
                    horaDestino={ficha.horaBajo}
                  />

                </Tarjeta>
              </AparicionSuave>
            );
          })}
        </>
      )}

      {/* ================================================================
          GESTIONES RÁPIDAS — lo que el padre PUEDE HACER
          ================================================================
          Va después de la familia y antes de los avisos, que es el orden del
          diseño: primero lo que está pasando, después quiénes son, después lo
          que uno puede hacer, y al final lo que la escuela tiene para decir.
          Es el orden en que se hacen las preguntas al abrir la app. */}
      <TituloSeccion titulo="Gestiones rápidas" />
      <View style={styles.filaTiles}>
        <TileAccion
          titulo="Mensajes"
          detalle={resumenes[0]?.ultimoTexto ?? 'Conductor y administración'}
          icono="message-text"
          insignia={totalNoLeidos}
          onPress={() => router.push('/mensajes')}
        />
        <TileAccion
          titulo="Solicitudes"
          detalle="Lo que pediste y su estado"
          icono="file-document-edit"
          onPress={() => router.push('/solicitudes')}
        />
      </View>
      {!!destacado && (
        <View style={styles.filaTiles}>
          <TileAccion
            titulo={`Perfil de ${destacado.nino.nombre.split(' ')[0]}`}
            detalle="Foto, escuela y lugar de recogida"
            icono="account"
            onPress={() => verPerfil(destacado.nino.id)}
          />
          <TileAccion
            titulo={`Historial de ${destacado.nino.nombre.split(' ')[0]}`}
            detalle="Sus viajes día por día"
            icono="history"
            onPress={() => verHistorial(destacado.nino)}
          />
        </View>
      )}
      <View style={styles.filaTiles}>
        {/* El acceso más urgente de la app del padre: se usa a las 5 de la
            mañana, cuando un hijo amanece enfermo y el bus pasa a las 6:40.
            Está acá y no solo dentro de Solicitudes porque a esa hora dos
            toques de más importan. Inscribir un hijo, en cambio, se hace una
            vez en la vida y vive en Solicitudes, bien explicado. */}
        <TileAccion
          titulo="Hoy no viaja"
          detalle="Avisar que hoy no usa el bus"
          icono="bus-alert"
          onPress={() => router.push('/nueva-ausencia')}
        />
        <TileAccion
          titulo="Cambio de lugar"
          detalle="Mudanza o solo por un día"
          icono="map-marker-right"
          color="acento"
          onPress={() => router.push('/nueva-solicitud-cambio')}
        />
      </View>

      {/* --- Avisos de la administración ---
          Muestra el TEXTO del aviso: es información que la escuela quiere que
          el padre lea hoy, no un enlace a otra pantalla. */}
      <TituloSeccion
        titulo="Comunicados"
        onVerTodo={canales.length > 0 ? () => router.push('/canales') : undefined}
      />
      {avisos.length === 0 ? (
        <Tarjeta>
          <View style={styles.filaSimple}>
            <View style={[styles.circuloIcono, { backgroundColor: tema.colors.surfaceVariant }]}>
              <MaterialCommunityIcons
                name="bullhorn-outline"
                size={20}
                color={tema.colors.onSurfaceVariant}
              />
            </View>
            <View style={styles.textoFila}>
              <Text style={estilosBase.tenue}>
                {canales.length === 0
                  ? 'Todavía no hay canales de avisos para la escuela de tus hijos.'
                  : 'Sin avisos nuevos. Acá vas a ver los comunicados de la escuela.'}
              </Text>
            </View>
          </View>
        </Tarjeta>
      ) : (
        avisos.slice(0, AVISOS_EN_INICIO).map((aviso, indice) => (
          <AparicionSuave key={aviso.id} indice={indice}>
            <TarjetaAviso
              aviso={aviso}
              canalNombre={nombrePorCanal.get(aviso.canalId)}
              lineas={4}
              onPress={() =>
                router.push({
                  pathname: '/canal',
                  params: {
                    canalId: aviso.canalId,
                    canalNombre: nombrePorCanal.get(aviso.canalId) ?? 'Avisos',
                  },
                })
              }
            />
          </AparicionSuave>
        ))
      )}

      {/* --- Viajes pasados --- */}
      <TituloSeccion titulo="Viajes pasados" />
      <Tarjeta>
        {recientes.length === 0 ? (
          <Text style={estilosBase.tenue}>
            Todavía no hay viajes registrados en los últimos días.
          </Text>
        ) : (
          recientes.map((evento, indice) => (
            <View
              key={evento.id}
              style={[
                styles.filaEvento,
                indice > 0 && { borderTopWidth: 1, borderTopColor: tema.colors.outlineVariant },
              ]}
            >
              {/* Coral para las subidas, aqua para las entregas: los mismos dos
                  colores que usa el estado en toda la app */}
              <View
                style={[
                  styles.circuloEvento,
                  { backgroundColor: tonoEvento(evento.evento, tema).fondo },
                ]}
              >
                <MaterialCommunityIcons
                  name={ICONO_EVENTO[evento.evento]}
                  size={18}
                  color={tonoEvento(evento.evento, tema).texto}
                />
              </View>
              <View style={styles.textoFila}>
                <Text variant="bodyMedium">
                  {evento.ninoNombre} {TEXTO_EVENTO_BREVE[evento.evento]}
                </Text>
                <Text variant="bodySmall" style={estilosBase.tenue}>
                  {etiquetaDia(evento.fecha)} · {evento.hora}
                </Text>
              </View>
            </View>
          ))
        )}
      </Tarjeta>

      {/* ================================================================
          QUIÉN LLEVA A MI HIJO — la ficha completa
          ================================================================
          Se abre al tocar la tarjeta del conductor: la foto y la placa de la
          unidad, la persona, la ruta y los botones de llamar y escribir. El
          diseño y el porqué de cada decisión están en
          components/FichaConductor.tsx. */}
      <FichaConductor
        visible={fichaAbierta}
        conductor={fichaDeQuienLleva?.conductor ?? null}
        bus={fichaDeQuienLleva?.bus}
        rutaNombre={fichaDeQuienLleva?.rutaNombre ?? null}
        ninoNombre={fichaDeQuienLleva?.ninoNombre}
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

const styles = StyleSheet.create({
  saludo: { gap: 2 },
  negrita: { fontFamily: FUENTES.textoNegrita },
  fecha: { textTransform: 'capitalize' },
  avatarToque: { borderRadius: 19 },

  // --- MITAD DE ARRIBA: el viaje en curso, a sangre ---
  // Los márgenes negativos cancelan el margen lateral de la pantalla, así el
  // mapa llega a los bordes del teléfono. Es lo que separa esta pantalla de
  // "una tarjeta más": el viaje ocupa su propia mitad.
  panelSuperior: { marginHorizontal: -ESPACIO.pantalla },
  hero: { position: 'relative' },
  mapaHero: {},
  sinMapa: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: ESPACIO.pantalla },
  // Solo la posición y el fondo: el dibujo de la pastilla lo pone
  // PastillaEstado. Acá el fondo va OPACO (y no el translúcido del componente)
  // porque debajo hay un mapa: sin fondo propio, el texto competiría con las
  // calles.
  pastillaFlotante: {
    position: 'absolute',
    left: ESPACIO.pantalla,
    backgroundColor: VIDRIO_OSCURO,
    ...SOMBRA_FLOTANTE,
  },
  // Velo verde profundo (del agua, no gris) para que el mapa siga leyéndose
  // debajo y el texto blanco encima tenga contraste suficiente
  velo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 1,
    paddingHorizontal: ESPACIO.pantalla,
    paddingTop: 26,
    paddingBottom: 16,
    backgroundColor: VIDRIO_OSCURO,
  },
  etiquetaVelo: {
    color: 'rgba(255, 255, 255, 0.82)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: FUENTES.textoNegrita,
  },
  nombreVelo: { color: '#FFFFFF', fontFamily: FUENTES.textoNegrita },
  blanco: { color: '#FFFFFF', fontFamily: FUENTES.textoNegrita },
  blancoTenue: { color: 'rgba(255, 255, 255, 0.82)' },
  filaMini: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  // La burbuja del perfil, flotando sobre el mapa
  avatarFlotante: {
    position: 'absolute',
    right: ESPACIO.pantalla,
    borderRadius: RADIO.pastilla,
    ...SOMBRA_FLOTANTE,
  },

  // --- Resto de la pantalla ---
  filaSimple: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
  // Se pega al panel del mapa que tiene arriba: son la misma información
  tarjetaConductor: { marginTop: -ESPACIO.interno },

  textoFila: { flex: 1, gap: 2 },
  circuloIcono: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filaTiles: { flexDirection: 'row', gap: ESPACIO.interno },
  filaEvento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIO.interno,
    paddingVertical: 10,
  },
  circuloEvento: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
