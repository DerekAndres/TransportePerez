import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import AparicionSuave from '@/components/AparicionSuave';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import TarjetaAviso from '@/components/TarjetaAviso';
import TituloSeccion from '@/components/TituloSeccion';
import TileAccion from '@/components/TileAccion';
import LineaViaje, { type EtapaViaje } from '@/components/LineaViaje';
import MapaBusEnVivo, { type EstadoMapa } from '@/components/MapaBusEnVivo';
import {
  escucharRegistrosDeNino,
  escucharViajesDeRuta,
  listarHijos,
  listarRutasDeNino,
  listarRegistrosDeNino,
  listarViajesDeRutaPorFecha,
  obtenerEscuela,
} from '@/services/padreService';
import { escucharAvisosDeCanales, listarCanalesDeEscuelas } from '@/services/canalesService';
import { escucharBandeja, type ResumenConversacion } from '@/services/mensajesService';
import { fechaDeHoy, turnoActual } from '@/services/viajesService';
import { ALTURA, ESPACIO, RADIO, SOMBRA_FLOTANTE, estilosBase } from '@/constants/estilos';
import { horaCorta, saludoDelDia } from '@/utils/tiempo';
import type { Aviso, Canal, Nino, ParadaNino, Registro, Ruta, Viaje } from '@/types/models';

// ============================================
// INICIO DEL PADRE
// ============================================
// Arriba, lo único que importa a diario: la TARJETA DEL VIAJE de cada hijo —
// dónde está ahora, el recorrido dibujado y, si el bus salió, el mapa en vivo.
// Enseguida, los AVISOS de la administración; después, los atajos, los viajes
// pasados y los mensajes. Cada sección muestra un adelanto y un "Ver todo" que
// lleva a su pantalla completa.
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

type EstadoHijo = 'en_casa' | 'en_bus' | 'entregado';

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
};

const ETAPA_DE_ESTADO: Record<EstadoHijo, EtapaViaje> = {
  en_casa: 'pendiente',
  en_bus: 'en_camino',
  entregado: 'completado',
};

export default function InicioPadreScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();

  const [base, setBase] = useState<BaseHijo[] | null>(null);
  const [viajesPorRuta, setViajesPorRuta] = useState<Map<string, Viaje[]>>(new Map());
  const [registrosPorClave, setRegistrosPorClave] = useState<Map<string, Registro[]>>(new Map());
  const [estadoMapaPorHijo, setEstadoMapaPorHijo] = useState<Map<string, EstadoMapa>>(new Map());
  const [canales, setCanales] = useState<Canal[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [recientes, setRecientes] = useState<EventoReciente[]>([]);
  const [resumenes, setResumenes] = useState<ResumenConversacion[]>([]);
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
                        const propios = await listarRegistrosDeNino(viaje.id, b.nino.id);
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
        const registros = [...(registrosPorClave.get(`${b.nino.id}:${vigente.id}`) ?? [])].sort(
          (x, y) => x.hora.toMillis() - y.hora.toMillis()
        );
        const subio = registros.find((r) => r.evento === 'subio');
        const bajo = registros.find((r) => r.evento === 'bajo');
        if (subio) horaSubio = horaCorta(subio.hora);
        if (bajo) horaBajo = horaCorta(bajo.hora);
        const ultimo = registros[registros.length - 1];
        if (ultimo) estado = ultimo.evento === 'subio' ? 'en_bus' : 'entregado';
      }

      return { nino: b.nino, escuelaNombre: b.escuelaNombre, estado, horaSubio, horaBajo, viajeEnCurso };
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

  // Colores de la pastilla de estado — los mismos tres en toda la app:
  //   en casa   = arena (todavía no pasa nada)
  //   en el bus = CORAL lleno (está pasando ahora)
  //   entregado = AQUA (se cumplió)
  const colorPastilla: Record<EstadoHijo, { fondo: string; texto: string }> = {
    en_casa: { fondo: tema.colors.surfaceVariant, texto: tema.colors.onSurfaceVariant },
    en_bus: { fondo: tema.colors.primary, texto: tema.colors.onPrimary },
    entregado: { fondo: tema.colors.secondaryContainer, texto: tema.colors.onSecondaryContainer },
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
          <ActivityIndicator size="large" />
        </View>
      </PantallaBase>
    );
  }

  // Los hijos con el bus andando AHORA se llevan la pantalla entera; los demás
  // quedan en tarjetas compactas debajo. Esa es toda la idea de este inicio:
  // lo que está pasando se ve sin buscarlo.
  const enViaje = fichas.filter((f) => f.viajeEnCurso);
  const enReposo = fichas.filter((f) => !f.viajeEnCurso);

  return (
    <PantallaBase
      accionDerecha={avatarUsuario}
      refrescando={refrescando}
      onRefrescar={refrescar}
    >
      {/* Saludo */}
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
        const estadoMapa = estadoMapaPorHijo.get(ficha.nino.id);
        const enVivo = estadoMapa?.tipo === 'en_vivo';

        // En la mañana el viaje va de la casa a la escuela; en la tarde, al revés
        const esManana = turnoActual() === 'manana';
        const llegada = esManana ? ficha.escuelaNombre : (destino?.nombre ?? 'Casa');

        return (
          <AparicionSuave key={ficha.nino.id} indice={indice}>
            <Tarjeta sinRelleno>
              <TouchableRipple onPress={() => verMapa(ficha)} borderless>
                <View style={styles.hero}>
                  {destino ? (
                    <MapaBusEnVivo
                      viajeId={ficha.viajeEnCurso!.id}
                      paradaLat={destino.lat}
                      paradaLng={destino.lng}
                      paradaNombre={destino.nombre}
                      interactivo={false}
                      onEstado={(nuevo) =>
                        setEstadoMapaPorHijo((prev) => new Map(prev).set(ficha.nino.id, nuevo))
                      }
                      style={styles.mapaHero}
                    />
                  ) : (
                    // El niño viaja pero nadie marcó su casa en el mapa: se dice
                    // qué falta, en vez de mostrar un recuadro vacío
                    <View
                      style={[
                        styles.mapaHero,
                        styles.sinMapa,
                        { backgroundColor: tema.colors.primaryContainer },
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

                  {/* Señal del GPS: el puntito coral late en la mente del padre
                      como "el bus está transmitiendo ahora" */}
                  <View style={[styles.pastillaFlotante, { backgroundColor: tema.colors.surface }]}>
                    <View
                      style={[
                        styles.puntoSenal,
                        { backgroundColor: enVivo ? tema.colors.primary : tema.colors.outline },
                      ]}
                    />
                    <Text variant="labelSmall">
                      {enVivo ? `En vivo · ${estadoMapa.hora}` : 'Esperando señal'}
                    </Text>
                  </View>

                  {/* Los datos montados sobre el mapa */}
                  <View style={styles.velo}>
                    <View style={styles.textoVelo}>
                      <Text variant="titleMedium" numberOfLines={1} style={styles.blanco}>
                        {ficha.nino.nombre}
                      </Text>
                      <View style={styles.filaMini}>
                        <MaterialCommunityIcons
                          name="map-marker"
                          size={13}
                          color="rgba(255,255,255,0.8)"
                        />
                        <Text variant="bodySmall" numberOfLines={1} style={styles.blancoTenue}>
                          Va hacia {llegada}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.bloqueVelo}>
                      <Text variant="labelSmall" style={styles.blancoTenue}>
                        {ficha.horaSubio ? 'Subió' : 'Estado'}
                      </Text>
                      <Text variant="titleSmall" style={styles.blanco}>
                        {ficha.horaSubio ?? ETIQUETA_ESTADO[ficha.estado]}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableRipple>

              {/* Acciones de la tarjeta */}
              <View style={[styles.pieTarjeta, { borderTopColor: tema.colors.outlineVariant }]}>
                <TouchableRipple onPress={() => verMapa(ficha)} borderless style={styles.accionPie}>
                  <View style={styles.filaAccionPie}>
                    <MaterialCommunityIcons
                      name="map-marker"
                      size={17}
                      color={tema.colors.primary}
                    />
                    <Text variant="labelLarge" style={{ color: tema.colors.primary }}>
                      Mapa
                    </Text>
                  </View>
                </TouchableRipple>
                <TouchableRipple
                  onPress={() => verPerfil(ficha.nino.id)}
                  borderless
                  style={styles.accionPie}
                >
                  <View style={styles.filaAccionPie}>
                    <MaterialCommunityIcons name="account" size={17} color={tema.colors.primary} />
                    <Text variant="labelLarge" style={{ color: tema.colors.primary }}>
                      Perfil
                    </Text>
                  </View>
                </TouchableRipple>
                <TouchableRipple
                  onPress={() => verHistorial(ficha.nino)}
                  borderless
                  style={styles.accionPie}
                >
                  <View style={styles.filaAccionPie}>
                    <MaterialCommunityIcons name="history" size={17} color={tema.colors.primary} />
                    <Text variant="labelLarge" style={{ color: tema.colors.primary }}>
                      Historial
                    </Text>
                  </View>
                </TouchableRipple>
              </View>
            </Tarjeta>
          </AparicionSuave>
        );
      })}

      {/* --- Los hijos que hoy no están viajando --- */}
      {enReposo.length > 0 && (
        <>
          {enViaje.length > 0 && <TituloSeccion titulo="Tus otros hijos" />}
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
                    <View
                      style={[
                        styles.pastilla,
                        { backgroundColor: colorPastilla[ficha.estado].fondo },
                      ]}
                    >
                      <Text
                        variant="labelSmall"
                        style={{ color: colorPastilla[ficha.estado].texto }}
                      >
                        {ETIQUETA_ESTADO[ficha.estado]}
                      </Text>
                    </View>
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

      {/* --- Avisos de la administración ---
          Muestra el TEXTO del aviso: es información que la escuela quiere que
          el padre lea hoy, no un enlace a otra pantalla. */}
      <TituloSeccion
        titulo="Avisos"
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

      {/* --- Accesos, en grilla de dos por fila --- */}
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
                  {
                    backgroundColor:
                      evento.evento === 'subio'
                        ? tema.colors.primaryContainer
                        : tema.colors.secondaryContainer,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={evento.evento === 'subio' ? 'bus-clock' : 'home-import-outline'}
                  size={18}
                  color={
                    evento.evento === 'subio'
                      ? tema.colors.onPrimaryContainer
                      : tema.colors.onSecondaryContainer
                  }
                />
              </View>
              <View style={styles.textoFila}>
                <Text variant="bodyMedium">
                  {evento.ninoNombre} {evento.evento === 'subio' ? 'subió al bus' : 'bajó del bus'}
                </Text>
                <Text variant="bodySmall" style={estilosBase.tenue}>
                  {etiquetaDia(evento.fecha)} · {evento.hora}
                </Text>
              </View>
            </View>
          ))
        )}
      </Tarjeta>
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  saludo: { gap: 2 },
  negrita: { fontWeight: '700' },
  fecha: { textTransform: 'capitalize' },
  avatarToque: { borderRadius: 19 },

  // --- El héroe: el viaje en curso ---
  hero: { position: 'relative' },
  mapaHero: { height: ALTURA.heroMapa },
  sinMapa: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: ESPACIO.pantalla },
  pastillaFlotante: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: RADIO.pastilla,
    ...SOMBRA_FLOTANTE,
  },
  puntoSenal: { width: 8, height: 8, borderRadius: 4 },
  // Velo tostado (no gris) para que el mapa siga leyéndose debajo y el texto
  // blanco tenga contraste suficiente
  velo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIO.interno,
    paddingHorizontal: ESPACIO.pantalla,
    paddingVertical: 14,
    backgroundColor: 'rgba(35, 14, 5, 0.66)',
  },
  textoVelo: { flex: 1, gap: 2 },
  bloqueVelo: { alignItems: 'flex-end', gap: 2 },
  blanco: { color: '#FFFFFF', fontWeight: '700' },
  blancoTenue: { color: 'rgba(255, 255, 255, 0.78)' },
  filaMini: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pieTarjeta: { flexDirection: 'row', borderTopWidth: 1 },
  accionPie: { flex: 1, paddingVertical: 14 },
  filaAccionPie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },

  // --- Resto de la pantalla ---
  filaSimple: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
  textoFila: { flex: 1, gap: 2 },
  pastilla: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIO.pastilla },
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
