import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Chip, Text, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import GrupoAsistencia, { type ItemAsistencia } from '@/components/GrupoAsistencia';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import TituloSeccion from '@/components/TituloSeccion';
import { RADIO, estilosBase } from '@/constants/estilos';
import { FUENTES } from '@/constants/tema';
import { fechaDeHoy, listarRegistrosDeViaje } from '@/services/viajesService';
import { listarNinosQueLlevo } from '@/services/conductorService';
import { pendientesDeViaje, reintentarRegistrosPendientes } from '@/services/colaRegistros';
import { notificarEventoAlPadre } from '@/services/notificacionesService';
import {
  escucharRegistrosDelPunto,
  marcarViajeDemorado,
  obtenerRuta,
  registrarTransbordo,
  type ContextoTransbordo,
  type EventoTransbordo,
} from '@/services/transbordoService';
import type { Nino, Registro, Ruta } from '@/types/models';
import CargandoBus from '@/components/CargandoBus';

// Pantalla de transbordo del conductor. Asimetría:
//  - ENTREGA (decide): mis niños que bajan en este punto. Confirmo individual o "Todos".
//  - RECIBE (no decide): la lista se llena sola (mi plan + lo que dejó el otro bus).
//    Solo confirmo "Subieron". Dos estados: pendiente / listo.
//
// CADENA DE CUSTODIA (regla pedida por la empresa, 2026-09-23): el receptor NO
// puede marcar que un niño subió mientras el otro conductor no lo haya
// entregado. Antes sí podía, y la marca quedaba registrada como `discrepancia`
// para que la revisara el admin; ahora el botón está apagado hasta que llega la
// entrega. El motivo es que un niño no puede figurar en dos buses a la vez ni
// aparecer recibido por alguien sin que nadie conste que lo soltó: con dos
// marcas encadenadas, en cualquier momento hay UN responsable identificado.
//
// ⚠️ El costo de la regla, y hay que conocerlo: si el teléfono del que entrega
// se queda sin señal, su marca se queda en la cola del teléfono y el receptor
// queda bloqueado. Para ese caso está "Continuar sin transbordo", que registra
// lo pendiente como excepción para que el admin lo vea. El campo `discrepancia`
// se conserva en el modelo porque hay registros históricos que lo usan.
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
    busPlaca: string;
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
  // La consulta en vivo del punto falló. Importa mostrarlo: sin esto, el
  // conductor ve una lista vacía y cree que el otro bus no entregó a nadie.
  const [falloEscucha, setFalloEscucha] = useState(false);

  // Carga inicial: ruta, niños que llevo, registros de mi viaje (los del
  // servidor y los que todavía están en la cola del teléfono)
  const uid = usuario?.id;
  useEffect(() => {
    if (!uid) return;
    let cancelado = false;
    (async () => {
      const [r, ns, rv, pendientes] = await Promise.all([
        obtenerRuta(params.rutaId),
        listarNinosQueLlevo(uid),
        listarRegistrosDeViaje(params.viajeId),
        pendientesDeViaje(params.viajeId),
      ]);
      if (cancelado) return;
      setRuta(r);
      setNinos(ns);
      const idsServidor = new Set(rv.map((reg) => reg.id));
      setRegistrosViaje([...rv, ...pendientes.filter((p) => !idsServidor.has(p.id))]);
      setCargando(false);
    })().catch(() => {
      if (!cancelado) setCargando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [params.rutaId, params.viajeId, uid]);

  // Suscripción EN VIVO a los registros del punto (para ver lo que deja el otro bus)
  useEffect(() => {
    const unsub = escucharRegistrosDelPunto(fecha, params.puntoId, setRegistrosPunto, () =>
      setFalloEscucha(true)
    );
    return unsub;
  }, [fecha, params.puntoId]);

  const ctx: ContextoTransbordo = {
    viajeId: params.viajeId,
    rutaId: params.rutaId,
    busId: params.busId,
    conductorId: usuario?.id ?? '',
    puntoId: params.puntoId,
    fecha,
    turno: ruta?.turno,
  };

  const ninosPorId = useMemo(() => new Map(ninos.map((n) => [n.id, n])), [ninos]);

  // ⚠️ SOLO LOS DE MI TURNO. La consulta al punto trae todo lo del DÍA (filtra
  // por fecha + punto, que es lo que permite ver lo que dejó el otro bus sin
  // leer su ruta). Pero un niño cruza el mismo punto DOS VECES al día: de ida a
  // la escuela y de vuelta a casa. Sin este filtro, al abrir el transbordo de la
  // tarde el niño aparecía ya entregado y ya subido por lo que había pasado a la
  // mañana, sin que nadie marcara nada.
  //
  // Los registros SIN turno se descartan: son de antes de este campo, y darlos
  // por válidos sería volver a arrastrar historia vieja al viaje de ahora.
  const delTurno = registrosPunto.filter((r) => !!ruta?.turno && r.turno === ruta.turno);

  // Nombre y escuela de un niño. Primero de los niños que llevo; si no está ahí
  // (lo bajó el otro bus por excepción y no es de mi ruta, así que las reglas no
  // me dejan leerlo), de lo que COPIÓ en el registro el conductor que lo entregó.
  const copiaEnPunto = (id: string) => delTurno.find((r) => r.ninoId === id && r.ninoNombre);
  const nombre = (id: string) =>
    ninosPorId.get(id)?.nombre ?? copiaEnPunto(id)?.ninoNombre ?? 'Niño de otra ruta';
  const escuelaDe = (id: string) => ninosPorId.get(id)?.escuelaId ?? copiaEnPunto(id)?.ninoEscuelaId;

  const bajoPunto = delTurno.filter((r) => r.evento === 'bajo'); // entregas en el punto
  const subioPunto = delTurno.filter((r) => r.evento === 'subio'); // recepciones en el punto

  // ⚠️ HAY QUE SEPARAR LO MÍO DE LO AJENO. Antes se usaba `bajoPunto` entero
  // para armar la lista de recepción, así que apenas yo entregaba a un niño,
  // MI PROPIA entrega lo metía en mi lista de "suben a mi bus": el mismo bus
  // aparecía bajándolo y subiéndolo. Los registros ya guardan `rutaId`, que es
  // lo que permite distinguirlos.
  const entregoYo = (r: (typeof bajoPunto)[number]) => r.rutaId === params.rutaId;
  const bajoPuntoMio = bajoPunto.filter(entregoYo);
  const bajoPuntoAjeno = bajoPunto.filter((r) => !entregoYo(r));

  // Para MI lista de entrega: ¿ya lo entregué yo?
  const yaEntregue = (id: string) => bajoPuntoMio.some((r) => r.ninoId === id);
  // Para MI lista de recepción: ¿lo entregó el OTRO bus? Es la cadena de
  // custodia (ver la cabecera): sin esto, nada se habilita.
  const loEntregoElOtro = (id: string) => bajoPuntoAjeno.some((r) => r.ninoId === id);
  const yaSubio = (id: string) => subioPunto.some((r) => r.ninoId === id);

  // --- ENTREGA: niños de MI ruta que bajan en este punto ---
  const entregaIds = (ruta?.ninos ?? [])
    .filter((n) => n.bajaEn.tipo === 'punto' && n.bajaEn.id === params.puntoId)
    .map((n) => n.ninoId);
  const itemsEntrega: ItemAsistencia[] = entregaIds.map((id) => ({
    id,
    nombre: nombre(id),
    hecho: yaEntregue(id),
  }));

  // --- RECIBE: mi plan (suben en el punto) + los que dejó el otro bus (excepciones) ---
  const escuelasRuta = new Set(ruta?.escuelaIds ?? []);
  const recibePlanIds = (ruta?.ninos ?? [])
    .filter((n) => n.subeEn.tipo === 'punto' && n.subeEn.id === params.puntoId)
    .map((n) => n.ninoId);
  // Los que dejó el OTRO bus (no los míos), y nunca alguien que yo esté
  // entregando: no se puede recibir en el mismo bus del que uno lo baja.
  const recibeIds = [...new Set([...recibePlanIds, ...bajoPuntoAjeno.map((r) => r.ninoId)])].filter(
    (id) => !entregaIds.includes(id)
  );
  const itemsRecibe: ItemAsistencia[] = recibeIds.map((id) => {
    const escuelaId = escuelaDe(id);
    // Validación NO bloqueante: este bus no cubre la escuela del niño (se valida en
    // el receptor, que sí conoce SU propia ruta; el emisor nunca lee la ruta ajena)
    const noCubre = !!escuelaId && !escuelasRuta.has(escuelaId);
    // CADENA DE CUSTODIA: no se puede recibir a un niño que el otro bus todavía
    // no entregó. El botón queda apagado hasta que aparece su registro de
    // entrega en el punto (llega solo, por la suscripción en vivo).
    const entregado = loEntregoElOtro(id);
    return {
      id,
      nombre: nombre(id),
      hecho: yaSubio(id),
      habilitado: entregado,
      // El motivo del bloqueo manda sobre la advertencia de escuela: si el botón
      // está apagado, lo primero que el conductor necesita saber es por qué.
      detalle: !entregado
        ? 'Esperando que el otro bus lo entregue'
        : noCubre
          ? '⚠ Este bus no va a su escuela'
          : undefined,
      alerta: entregado && noCubre,
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
    .filter((id) => estaEnMiBus(id) && !entregaIds.includes(id) && !yaEntregue(id));
  const itemsExcepcion: ItemAsistencia[] = candidatosExcepcion.map((id) => ({
    id,
    nombre: nombre(id),
    hecho: false,
  }));

  // Cada registro del punto lleva copiados el nombre y la escuela del niño, para
  // que el otro bus los vea aunque no pueda leer al niño (ver arriba)
  const conCopia = (item: EventoTransbordo): EventoTransbordo => ({
    ...item,
    ninoNombre: ninosPorId.get(item.ninoId)?.nombre,
    ninoEscuelaId: ninosPorId.get(item.ninoId)?.escuelaId,
  });

  // --- Acciones ---
  const registrar = async (items: EventoTransbordo[]) => {
    if (items.length === 0) return;
    setOcupado(true);
    try {
      // Queda guardado en el teléfono antes de mandarse (ver colaRegistros.ts):
      // sin señal no se pierde, y la lista del punto se actualiza sola
      await registrarTransbordo(ctx, items.map(conCopia));
      // AVISO AL PADRE EN LOS DOS EXTREMOS (cambio pedido el 2026-09-24).
      // Antes solo avisaba la entrega, con un texto neutro, porque el transbordo
      // se había definido como invisible para el padre. Ahora avisan las dos
      // marcas: bajó de un bus, y subió al otro. El hueco entre las dos es
      // justamente el rato en que el niño no va arriba de ninguna unidad, que es
      // lo que un padre quiere saber.
      //
      // ⚠️ El `turno` va SIEMPRE y sale de la ruta, no del reloj: sin él, el
      // aviso decía "va de camino a casa" en un viaje de la mañana en cuanto el
      // teléfono pasaba el mediodía (o si el reloj del equipo está corrido).
      //
      // "Continuar sin transbordo" (lleva motivo) sigue SIN notificar: eso no es
      // un cambio de bus, es una excepción que revisa el administrador.
      items
        .filter((it) => !it.motivo)
        .forEach((it) =>
          notificarEventoAlPadre(it.ninoId, it.evento, {
            enPunto: true,
            turno: ruta?.turno,
            puntoNombre: params.puntoNombre,
            unidad: params.busPlaca || undefined,
          }).catch(() => {})
        );
      reintentarRegistrosPendientes().catch(() => {});
    } catch {
      Alert.alert('Sin guardar', 'No se pudo guardar ahora. Se reintenta al volver la señal.');
    } finally {
      setOcupado(false);
    }
  };

  const entregar = (ids: string[]) =>
    registrar(ids.map((id) => ({ ninoId: id, evento: 'bajo' as const })));
  // Solo se reciben niños ya entregados por el otro bus. El filtro es una red de
  // seguridad además del botón apagado: entre que se toca "Todos" y que se
  // guarda, la lista en vivo pudo cambiar.
  const recibir = (ids: string[]) =>
    registrar(ids.filter(loEntregoElOtro).map((id) => ({ ninoId: id, evento: 'subio' as const })));
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
          <CargandoBus texto="Cargando el transbordo…" />
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
              Esta lista se llena sola con los niños que deja el otro bus. Cada
              niño se habilita cuando el otro conductor confirma que lo entregó.
            </Text>
            {falloEscucha && (
              <Text variant="bodySmall" style={[styles.aclaracion, { color: tema.colors.error }]}>
                ⚠ No se está recibiendo lo que marca el otro bus. Revisá la señal.
                Si no vuelve, usá “Continuar sin transbordo” y avisá a la administración.
              </Text>
            )}
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
  negrita: { fontFamily: FUENTES.textoNegrita },
  contingencia: { marginTop: 8 },
  filaBotones: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  boton: { borderRadius: RADIO.control },
});
