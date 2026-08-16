import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Badge, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Timestamp } from 'firebase/firestore';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
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
import { listarCanalesDeEscuelas } from '@/services/canalesService';
import { escucharBandeja, type ResumenConversacion } from '@/services/mensajesService';
import { fechaDeHoy, turnoActual } from '@/services/viajesService';
import { ALTURA, ESPACIO, RADIO, estilosBase } from '@/constants/estilos';
import type { Canal, Nino, ParadaNino, Registro, Ruta, Viaje } from '@/types/models';

// ============================================
// INICIO DEL PADRE
// ============================================
// Arriba, lo único que importa a diario: la TARJETA DEL VIAJE de cada hijo —
// dónde está ahora, el recorrido dibujado y, si el bus salió, el mapa en vivo.
// Abajo, todo lo demás en secciones cortas: atajos, avisos de la escuela,
// viajes pasados y mensajes. Cada sección muestra un adelanto y un "Ver todo"
// que lleva a su pantalla completa.
//
// La navegación general no vive acá sino en el menú ☰ del encabezado; el inicio
// solo ofrece los caminos más usados.

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

// Hora "H:mm" de un registro (la que quedó guardada al marcar la asistencia)
function horaCorta(momento: Timestamp): string {
  const fecha = momento.toDate();
  return `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, '0')}`;
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

  // Colores de la pastilla de estado: el azul lleno es el estado "vivo"
  const colorPastilla: Record<EstadoHijo, { fondo: string; texto: string }> = {
    en_casa: { fondo: tema.colors.surfaceVariant, texto: tema.colors.onSurfaceVariant },
    en_bus: { fondo: tema.colors.primary, texto: tema.colors.onPrimary },
    entregado: { fondo: tema.colors.primaryContainer, texto: tema.colors.onPrimaryContainer },
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

  return (
    <PantallaBase
      accionDerecha={avatarUsuario}
      refrescando={refrescando}
      onRefrescar={refrescar}
    >
      {/* Saludo */}
      <View style={styles.saludo}>
        <Text variant="headlineMedium" style={styles.negrita}>
          Hola, {usuario?.nombre?.split(' ')[0] ?? ''}
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

      {/* --- LA TARJETA PRINCIPAL: el viaje de cada hijo --- */}
      {fichas.map((ficha) => {
        const destino = destinoDe(ficha.nino);
        const estadoMapa = estadoMapaPorHijo.get(ficha.nino.id);
        const mapa =
          ficha.viajeEnCurso && destino
            ? {
                viajeId: ficha.viajeEnCurso.id,
                lat: destino.lat,
                lng: destino.lng,
                nombre: destino.nombre,
              }
            : null;

        // En la mañana el viaje va de la casa a la escuela; en la tarde, al revés
        const esManana = turnoActual() === 'manana';
        const origen = esManana ? 'Casa' : ficha.escuelaNombre;
        const llegada = esManana ? ficha.escuelaNombre : (destino?.nombre ?? 'Casa');

        return (
          <Tarjeta key={ficha.nino.id} sinRelleno>
            <View style={styles.cuerpoViaje}>
              {/* Quién viaja + estado */}
              <TouchableRipple onPress={() => verPerfil(ficha.nino.id)} borderless>
                <View style={styles.filaNino}>
                  {ficha.nino.foto ? (
                    <Avatar.Image size={50} source={{ uri: ficha.nino.foto }} />
                  ) : (
                    <Avatar.Text
                      size={50}
                      label={ficha.nino.nombre.trim().charAt(0).toUpperCase() || '?'}
                      style={{ backgroundColor: tema.colors.primaryContainer }}
                      color={tema.colors.onPrimaryContainer}
                    />
                  )}
                  <View style={styles.datosNino}>
                    <Text variant="titleMedium" numberOfLines={1} style={styles.negrita}>
                      {ficha.nino.nombre}
                    </Text>
                    <Text variant="bodySmall" numberOfLines={1} style={estilosBase.tenue}>
                      {ficha.escuelaNombre}
                    </Text>
                  </View>
                  <View
                    style={[styles.pastilla, { backgroundColor: colorPastilla[ficha.estado].fondo }]}
                  >
                    <Text variant="labelSmall" style={{ color: colorPastilla[ficha.estado].texto }}>
                      {ETIQUETA_ESTADO[ficha.estado]}
                    </Text>
                  </View>
                </View>
              </TouchableRipple>

              {/* El recorrido dibujado */}
              <LineaViaje
                origen={origen}
                destino={llegada}
                etapa={ETAPA_DE_ESTADO[ficha.estado]}
                horaOrigen={ficha.horaSubio}
                horaDestino={ficha.horaBajo}
              />
            </View>

            {/* Mapa en vivo: solo cuando el bus salió */}
            {mapa && (
              <TouchableRipple onPress={() => verMapa(ficha)} borderless>
                <View style={styles.marcoMapa}>
                  <MapaBusEnVivo
                    viajeId={mapa.viajeId}
                    paradaLat={mapa.lat}
                    paradaLng={mapa.lng}
                    paradaNombre={mapa.nombre}
                    interactivo={false}
                    onEstado={(nuevo) =>
                      setEstadoMapaPorHijo((prev) => new Map(prev).set(ficha.nino.id, nuevo))
                    }
                  />
                  <View style={[styles.senal, { backgroundColor: tema.colors.surface }]}>
                    <MaterialCommunityIcons
                      name={estadoMapa?.tipo === 'en_vivo' ? 'access-point' : 'timer-sand'}
                      size={13}
                      color={
                        estadoMapa?.tipo === 'en_vivo'
                          ? tema.colors.primary
                          : tema.colors.onSurfaceVariant
                      }
                    />
                    <Text variant="labelSmall">
                      {estadoMapa?.tipo === 'en_vivo'
                        ? `En vivo · ${estadoMapa.hora}`
                        : 'Esperando señal'}
                    </Text>
                  </View>
                </View>
              </TouchableRipple>
            )}

            {/* Acciones de la tarjeta */}
            <View style={[styles.pieTarjeta, { borderTopColor: tema.colors.outlineVariant }]}>
              <TouchableRipple onPress={() => verPerfil(ficha.nino.id)} borderless style={styles.accionPie}>
                <View style={styles.filaAccionPie}>
                  <MaterialCommunityIcons name="account" size={17} color={tema.colors.primary} />
                  <Text variant="labelLarge" style={{ color: tema.colors.primary }}>
                    Perfil
                  </Text>
                </View>
              </TouchableRipple>
              <TouchableRipple onPress={() => verHistorial(ficha.nino)} borderless style={styles.accionPie}>
                <View style={styles.filaAccionPie}>
                  <MaterialCommunityIcons name="history" size={17} color={tema.colors.primary} />
                  <Text variant="labelLarge" style={{ color: tema.colors.primary }}>
                    Historial
                  </Text>
                </View>
              </TouchableRipple>
              {mapa && (
                <TouchableRipple onPress={() => verMapa(ficha)} borderless style={styles.accionPie}>
                  <View style={styles.filaAccionPie}>
                    <MaterialCommunityIcons name="map-marker" size={17} color={tema.colors.primary} />
                    <Text variant="labelLarge" style={{ color: tema.colors.primary }}>
                      Mapa
                    </Text>
                  </View>
                </TouchableRipple>
              )}
            </View>
          </Tarjeta>
        );
      })}

      {/* --- Atajos --- */}
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

      {/* --- Avisos de la escuela --- */}
      <TituloSeccion titulo="Avisos" onVerTodo={() => router.push('/canales')} />
      {canales.length === 0 ? (
        <Tarjeta>
          <Text style={estilosBase.tenue}>
            Todavía no hay canales de avisos para la escuela de tus hijos.
          </Text>
        </Tarjeta>
      ) : (
        canales.slice(0, 2).map((canal) => (
          <Tarjeta
            key={canal.id}
            onPress={() =>
              router.push({ pathname: '/canal', params: { canalId: canal.id, canalNombre: canal.nombre } })
            }
          >
            <View style={styles.filaSimple}>
              <View style={[styles.circuloIcono, { backgroundColor: tema.colors.tertiaryContainer }]}>
                <MaterialCommunityIcons
                  name="bullhorn"
                  size={20}
                  color={tema.colors.onTertiaryContainer}
                />
              </View>
              <View style={styles.textoFila}>
                <Text variant="titleSmall" numberOfLines={1} style={styles.negrita}>
                  {canal.nombre}
                </Text>
                {!!canal.descripcion && (
                  <Text variant="bodySmall" numberOfLines={1} style={estilosBase.tenue}>
                    {canal.descripcion}
                  </Text>
                )}
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={tema.colors.onSurfaceVariant}
              />
            </View>
          </Tarjeta>
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
              <MaterialCommunityIcons
                name={evento.evento === 'subio' ? 'bus-clock' : 'home-import-outline'}
                size={20}
                color={tema.colors.primary}
              />
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

      {/* --- Mensajes --- */}
      <TituloSeccion titulo="Mensajes" onVerTodo={() => router.push('/mensajes')} />
      <Tarjeta onPress={() => router.push('/mensajes')}>
        <View style={styles.filaSimple}>
          <View style={[styles.circuloIcono, { backgroundColor: tema.colors.primaryContainer }]}>
            <MaterialCommunityIcons
              name="message-text"
              size={20}
              color={tema.colors.onPrimaryContainer}
            />
          </View>
          <View style={styles.textoFila}>
            <Text variant="titleSmall" style={styles.negrita}>
              {totalNoLeidos > 0 ? 'Tenés mensajes sin leer' : 'Conversaciones'}
            </Text>
            <Text variant="bodySmall" numberOfLines={1} style={estilosBase.tenue}>
              {resumenes[0]?.ultimoTexto ?? 'Escribile al conductor o a la administración'}
            </Text>
          </View>
          {totalNoLeidos > 0 ? (
            <Badge style={{ backgroundColor: tema.colors.error }}>{totalNoLeidos}</Badge>
          ) : (
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={tema.colors.onSurfaceVariant}
            />
          )}
        </View>
      </Tarjeta>
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  saludo: { gap: 2 },
  negrita: { fontWeight: '700' },
  fecha: { textTransform: 'capitalize' },
  avatarToque: { borderRadius: 19 },

  // Tarjeta del viaje
  cuerpoViaje: { padding: ESPACIO.pantalla, gap: ESPACIO.seccion },
  filaNino: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
  datosNino: { flex: 1, gap: 2 },
  pastilla: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIO.pastilla },
  marcoMapa: { height: ALTURA.mapaPrevia, position: 'relative' },
  senal: {
    position: 'absolute',
    left: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIO.pastilla,
    opacity: 0.95,
  },
  pieTarjeta: { flexDirection: 'row', borderTopWidth: 1 },
  accionPie: { flex: 1, paddingVertical: 14 },
  filaAccionPie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },

  // Secciones de abajo
  filaTiles: { flexDirection: 'row', gap: ESPACIO.interno },
  filaSimple: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
  circuloIcono: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  textoFila: { flex: 1, gap: 2 },
  filaEvento: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno, paddingVertical: 10 },
});
