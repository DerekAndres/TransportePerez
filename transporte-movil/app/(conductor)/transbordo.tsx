import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Chip, Text, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import GrupoAsistencia, { type ItemAsistencia } from '@/components/GrupoAsistencia';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import TituloSeccion from '@/components/TituloSeccion';
import { RADIO, estilosBase } from '@/constants/estilos';
import { fechaDeHoy, listarRegistrosDeViaje } from '@/services/viajesService';
import { notificarEventoAlPadre } from '@/services/notificacionesService';
import {
  escucharRegistrosDelPunto,
  listarNinosActivos,
  marcarViajeDemorado,
  obtenerRuta,
  registrarTransbordo,
  type ContextoTransbordo,
  type EventoTransbordo,
} from '@/services/transbordoService';
import type { Nino, Registro, Ruta } from '@/types/models';

// Pantalla de transbordo del conductor. Asimetría:
//  - ENTREGA (decide): mis niños que bajan en este punto. Confirmo individual o "Todos".
//  - RECIBE (no decide): la lista se llena sola (mi plan + lo que dejó el otro bus).
//    Solo confirmo "Subieron". Precedencia: si confirmo a alguien que el otro bus no
//    marcó, queda registrado como discrepancia. Dos estados: pendiente / listo.
export default function TransbordoScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();
  const params = useLocalSearchParams<{
    puntoId: string;
    puntoNombre: string;
    viajeId: string;
    rutaId: string;
    busId: string;
  }>();

  const fecha = fechaDeHoy();

  const [cargando, setCargando] = useState(true);
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [ninos, setNinos] = useState<Nino[]>([]);
  const [registrosViaje, setRegistrosViaje] = useState<Registro[]>([]); // de mi viaje (excepciones)
  const [registrosPunto, setRegistrosPunto] = useState<Registro[]>([]); // en vivo, del punto
  const [ocupado, setOcupado] = useState(false);
  const [demorado, setDemorado] = useState(false);
  const [mostrarExcepcion, setMostrarExcepcion] = useState(false);

  // Carga inicial: ruta, niños, registros de mi viaje
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const [r, ns, rv] = await Promise.all([
        obtenerRuta(params.rutaId),
        listarNinosActivos(),
        listarRegistrosDeViaje(params.viajeId),
      ]);
      if (cancelado) return;
      setRuta(r);
      setNinos(ns);
      setRegistrosViaje(rv);
      setCargando(false);
    })().catch(() => {
      if (!cancelado) setCargando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [params.rutaId, params.viajeId]);

  // Suscripción EN VIVO a los registros del punto (para ver lo que deja el otro bus)
  useEffect(() => {
    const unsub = escucharRegistrosDelPunto(fecha, params.puntoId, setRegistrosPunto);
    return unsub;
  }, [fecha, params.puntoId]);

  const ctx: ContextoTransbordo = {
    viajeId: params.viajeId,
    rutaId: params.rutaId,
    busId: params.busId,
    conductorId: usuario?.id ?? '',
    puntoId: params.puntoId,
    fecha,
  };

  const ninosPorId = useMemo(() => new Map(ninos.map((n) => [n.id, n])), [ninos]);
  const nombre = (id: string) => ninosPorId.get(id)?.nombre ?? id;

  const bajoPunto = registrosPunto.filter((r) => r.evento === 'bajo'); // entregas en el punto
  const subioPunto = registrosPunto.filter((r) => r.evento === 'subio'); // recepciones en el punto
  const yaBajo = (id: string) => bajoPunto.some((r) => r.ninoId === id);
  const yaSubio = (id: string) => subioPunto.some((r) => r.ninoId === id);

  // --- ENTREGA: niños de MI ruta que bajan en este punto ---
  const entregaIds = (ruta?.ninos ?? [])
    .filter((n) => n.bajaEn.tipo === 'punto' && n.bajaEn.id === params.puntoId)
    .map((n) => n.ninoId);
  const itemsEntrega: ItemAsistencia[] = entregaIds.map((id) => ({
    id,
    nombre: nombre(id),
    hecho: yaBajo(id),
  }));

  // --- RECIBE: mi plan (suben en el punto) + los que dejó el otro bus (excepciones) ---
  const escuelasRuta = new Set(ruta?.escuelaIds ?? []);
  const recibePlanIds = (ruta?.ninos ?? [])
    .filter((n) => n.subeEn.tipo === 'punto' && n.subeEn.id === params.puntoId)
    .map((n) => n.ninoId);
  const recibeIds = [...new Set([...recibePlanIds, ...bajoPunto.map((r) => r.ninoId)])];
  const itemsRecibe: ItemAsistencia[] = recibeIds.map((id) => {
    const escuelaId = ninosPorId.get(id)?.escuelaId;
    // Validación NO bloqueante: este bus no cubre la escuela del niño (se valida en
    // el receptor, que sí conoce SU propia ruta; el emisor nunca lee la ruta ajena)
    const noCubre = !!escuelaId && !escuelasRuta.has(escuelaId);
    return {
      id,
      nombre: nombre(id),
      hecho: yaSubio(id),
      detalle: noCubre ? '⚠ Este bus no va a su escuela' : undefined,
      alerta: noCubre,
    };
  });

  // --- Excepción (solo ENTREGA): resto de los niños de MI bus que siguen arriba ---
  const estaEnMiBus = (id: string): boolean => {
    const propios = registrosViaje
      .filter((r) => r.ninoId === id)
      .sort((a, b) => a.hora.toMillis() - b.hora.toMillis());
    return propios.length > 0 && propios[propios.length - 1].evento === 'subio';
  };
  const candidatosExcepcion = [...new Set(registrosViaje.map((r) => r.ninoId))]
    .filter((id) => estaEnMiBus(id) && !entregaIds.includes(id) && !yaBajo(id));
  const itemsExcepcion: ItemAsistencia[] = candidatosExcepcion.map((id) => ({
    id,
    nombre: nombre(id),
    hecho: false,
  }));

  // --- Acciones ---
  const registrar = async (items: EventoTransbordo[]) => {
    if (items.length === 0) return;
    setOcupado(true);
    try {
      await registrarTransbordo(ctx, items);
      // Fase 6: solo la ENTREGA en el punto avisa al padre, con texto neutro
      // ("sigue en camino") — el transbordo es invisible para él. La recepción no
      // notifica (sería un doble aviso del mismo cambio de bus) y "continuar sin
      // transbordo" (lleva motivo) tampoco: esa excepción la revisa el admin.
      items
        .filter((it) => it.evento === 'bajo' && !it.motivo)
        .forEach((it) =>
          notificarEventoAlPadre(it.ninoId, 'bajo', { enPunto: true }).catch(() => {})
        );
    } catch {
      Alert.alert('Sin guardar', 'No se pudo guardar ahora. Se reintenta al volver la señal.');
    } finally {
      setOcupado(false);
    }
  };

  const entregar = (ids: string[]) =>
    registrar(ids.map((id) => ({ ninoId: id, evento: 'bajo' as const })));
  const recibir = (ids: string[]) =>
    registrar(ids.map((id) => ({ ninoId: id, evento: 'subio' as const, discrepancia: !yaBajo(id) })));
  const entregarExcepcion = (ids: string[]) =>
    registrar(ids.map((id) => ({ ninoId: id, evento: 'bajo' as const, excepcion: true })));

  const esperar = async () => {
    try {
      await marcarViajeDemorado(params.viajeId);
      setDemorado(true);
    } catch {
      Alert.alert('Error', 'No se pudo marcar la demora.');
    }
  };

  const continuarSinTransbordo = () => {
    const pendientes: EventoTransbordo[] = [...itemsEntrega, ...itemsRecibe]
      .filter((i) => !i.hecho)
      .map((i) => ({
        ninoId: i.id,
        evento: 'bajo' as const,
        excepcion: true,
        motivo: 'continuar sin transbordo',
      }));
    if (pendientes.length === 0) {
      router.back();
      return;
    }
    Alert.alert(
      'Continuar sin transbordo',
      `Quedan ${pendientes.length} niño(s) sin confirmar. Se registran como excepción en el punto para que el administrador los revise.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: async () => {
            await registrar(pendientes);
            router.back();
          },
        },
      ]
    );
  };

  if (cargando) {
    return (
      <PantallaBase titulo="Transbordo" alVolver={() => router.back()} scroll={false}>
        <View style={estilosBase.centrado}>
          <ActivityIndicator size="large" />
        </View>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase
      titulo="Transbordo"
      subtitulo={params.puntoNombre}
      alVolver={() => router.back()}
    >
      <>
        {/* ENTREGA */}
        {entregaIds.length > 0 && (
          <>
            <TituloSeccion titulo="Entrego acá (bajan de mi bus)" />
            <GrupoAsistencia
              titulo={`En ${params.puntoNombre}`}
              items={itemsEntrega}
              etiquetaAccion="Entregar"
              etiquetaGrupo="Todos"
              onAccion={entregar}
              ocupado={ocupado}
            />

            {candidatosExcepcion.length > 0 && (
              <>
                <Button
                  mode="text"
                  icon="account-plus"
                  onPress={() => setMostrarExcepcion((v) => !v)}
                >
                  ¿Se baja otro niño aquí?
                </Button>
                {mostrarExcepcion && (
                  <GrupoAsistencia
                    titulo="Otros niños de mi bus"
                    items={itemsExcepcion}
                    etiquetaAccion="Se baja"
                    etiquetaGrupo="Todos"
                    onAccion={entregarExcepcion}
                    ocupado={ocupado}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* RECIBE */}
        {recibeIds.length > 0 && (
          <>
            <TituloSeccion titulo="Recibo acá (suben a mi bus)" />
            <Text variant="bodySmall" style={[estilosBase.tenue, styles.aclaracion]}>
              Esta lista se llena sola con los niños que deja el otro bus.
            </Text>
            <GrupoAsistencia
              titulo={`En ${params.puntoNombre}`}
              items={itemsRecibe}
              etiquetaAccion="Subió"
              etiquetaGrupo="Todos"
              onAccion={recibir}
              ocupado={ocupado}
            />
          </>
        )}

        {/* Contingencia */}
        <Tarjeta style={styles.contingencia}>
          <Text variant="titleSmall" style={styles.negrita}>
            Si no podés esperar
          </Text>
          <View style={styles.filaBotones}>
            {demorado ? (
              <Chip icon="timer-sand">Demora marcada</Chip>
            ) : (
              <Button mode="outlined" icon="timer-sand" style={styles.boton} onPress={esperar}>
                Esperar
              </Button>
            )}
            <Button
              mode="outlined"
              icon="skip-next"
              textColor={tema.colors.error}
              style={styles.boton}
              onPress={continuarSinTransbordo}
            >
              Continuar sin transbordo
            </Button>
          </View>
        </Tarjeta>
      </>
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  // Pega la aclaración al título de la sección que está justo arriba
  aclaracion: { marginTop: -14 },
  negrita: { fontWeight: '700' },
  contingencia: { marginTop: 8 },
  filaBotones: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  boton: { borderRadius: RADIO.control },
});
