import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import PastillaEstado, { type TonoEstado } from '@/components/PastillaEstado';
import Tarjeta from '@/components/Tarjeta';
import TituloSeccion from '@/components/TituloSeccion';
import { escucharMisSolicitudes } from '@/services/solicitudesService';
import { ESPACIO, estilosBase } from '@/constants/estilos';
import { FUENTES } from '@/constants/tema';
import type { EstadoSolicitud, Solicitud, TipoSolicitud } from '@/types/models';

// ============================================
// SOLICITUDES DEL PADRE
// ============================================
// La pantalla empieza EXPLICANDO, no ofreciendo botones. El motivo: los cinco
// trámites se parecen entre sí y es fácil equivocarse — "cambio de lugar" y
// "cambio de escuela" suenan casi igual, pero uno mueve la parada y el otro
// puede cambiar al niño de bus. Un padre que elige mal genera trabajo a la
// administración y se queda esperando una respuesta que no le sirve.
//
// Por eso cada opción dice EN QUÉ CASO se usa, con un ejemplo, y avisa si
// necesita aprobación o no. Es la única pantalla de la app del padre donde se
// admite texto explicativo: acá el costo de elegir mal es real.

const ETIQUETA_ESTADO: Record<EstadoSolicitud, string> = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
};

interface OpcionTramite {
  titulo: string;
  // La instrucción: en qué caso sirve, con un ejemplo concreto
  cuando: string;
  // Emoji y no ícono de línea: acá el color y la forma reconocible ayudan a
  // encontrar el trámite de un vistazo, sin leer los cinco títulos. Es la misma
  // decisión que ya se había tomado en los mapas (🚌 🏠 🏫). El significado
  // igual lo carga el título: el emoji acompaña, no informa solo.
  emoji: string;
  ruta: Href;
  // false = es un aviso y surte efecto de inmediato
  necesitaAprobacion: boolean;
}

const TRAMITES: OpcionTramite[] = [
  {
    titulo: 'Hoy no viaja',
    cuando:
      'Tu hijo no va a usar el bus un día puntual: está enfermo, se queda en casa, salen de viaje. El conductor lo ve al salir y no lo espera.',
    emoji: '🚌',
    ruta: '/nueva-ausencia',
    necesitaAprobacion: false,
  },
  {
    titulo: 'Cambio de lugar',
    cuando:
      'Cambia DÓNDE se recoge o se entrega a tu hijo: te mudaste, o por un día lo pasan a buscar a otra dirección. La escuela sigue siendo la misma.',
    emoji: '📍',
    ruta: '/nueva-solicitud-cambio',
    necesitaAprobacion: true,
  },
  {
    titulo: 'Cambio de escuela',
    cuando:
      'Tu hijo pasa a otro centro educativo. Ojo: puede significar que le toque otro bus, porque cada ruta pasa por escuelas distintas.',
    emoji: '🏫',
    ruta: '/nueva-solicitud-escuela',
    necesitaAprobacion: true,
  },
  {
    titulo: 'Cambio de turno',
    cuando:
      'Cambia si usa el bus solo de ida, solo de vuelta, o las dos veces. Por ejemplo, si ahora sale a las 12:40 y necesita el viaje de la tarde.',
    emoji: '🕐',
    ruta: '/nueva-solicitud-turno',
    necesitaAprobacion: true,
  },
  {
    titulo: 'Inscribir un hijo',
    cuando:
      'Sumar un hijo que todavía no usa el transporte. Se piden sus datos, su escuela y dónde se lo recoge.',
    emoji: '🎒',
    ruta: '/nueva-inscripcion',
    necesitaAprobacion: true,
  },
];

export default function SolicitudesScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);

  // Las dos preguntas que el padre se hace en esta pantalla, separadas:
  // "¿ya me contestaron?" (arriba) y "¿qué mandé antes?" (al final).
  // Un aviso de ausencia nunca queda pendiente —no necesita aprobación—, así
  // que cae directo en el historial y no infla la lista de espera.
  const pendientes = useMemo(
    () => solicitudes.filter((s) => s.estado === 'pendiente' && s.tipo !== 'ausencia_dia'),
    [solicitudes]
  );
  const resueltas = useMemo(
    () => solicitudes.filter((s) => !pendientes.includes(s)),
    [solicitudes, pendientes]
  );

  useEffect(() => {
    if (!usuario) return;
    return escucharMisSolicitudes(usuario.id, setSolicitudes);
  }, [usuario]);

  // Un aviso de ausencia nunca estuvo "pendiente de aprobación": decir
  // "Aprobada" ahí confundiría, porque nadie lo aprobó.
  const etiquetaDe = (s: Solicitud) =>
    s.tipo === 'ausencia_dia' ? 'Avisado' : ETIQUETA_ESTADO[s.estado];

  const EMOJI_TIPO: Record<TipoSolicitud, string> = {
    inscripcion: '🎒',
    cambio_ubicacion: '📍',
    cambio_escuela: '🏫',
    cambio_turno: '🕐',
    ausencia_dia: '🚌',
  };

  const describir = (s: Solicitud): { titulo: string; detalle: string } => {
    switch (s.tipo) {
      case 'inscripcion':
        return {
          titulo: `Inscripción de ${s.datosNino?.nombre ?? '—'}`,
          detalle: 'Alta de un nuevo hijo en el transporte',
        };
      case 'cambio_escuela':
        return {
          titulo: 'Cambio de escuela',
          detalle: s.fechaAplicacion ? `A partir del ${s.fechaAplicacion}` : 'Cambio de centro educativo',
        };
      case 'cambio_turno':
        return {
          titulo: 'Cambio de turno',
          detalle: s.fechaAplicacion ? `A partir del ${s.fechaAplicacion}` : 'Cambia los viajes que usa',
        };
      case 'ausencia_dia':
        return {
          titulo: `No viaja el ${s.fechaAplicacion}`,
          detalle: s.motivo ?? 'Avisado a la ruta',
        };
      default:
        return {
          titulo: s.permanente
            ? 'Cambio de ubicación (permanente)'
            : `Cambio por un día (${s.fechaAplicacion})`,
          detalle: s.alcance === 'recogida' ? 'Cambia dónde se recoge' : 'Cambia dónde se entrega',
        };
    }
  };

  // Las solicitudes se dibujan en DOS lugares (arriba las que esperan respuesta,
  // abajo las ya resueltas), así que la tarjeta se define una sola vez.
  const tarjetaDeSolicitud = (s: Solicitud) => {
    const d = describir(s);
    return (
      <Tarjeta key={s.id}>
        <View style={styles.fila}>
          <View style={[styles.circuloChico, { backgroundColor: tema.colors.surfaceVariant }]}>
            <Text style={styles.emojiChico}>{EMOJI_TIPO[s.tipo]}</Text>
          </View>
          <View style={styles.datos}>
            <Text variant="titleSmall" style={estilosBase.negrita}>
              {d.titulo}
            </Text>
            <Text variant="bodySmall" style={estilosBase.tenue}>
              {d.detalle}
            </Text>
            <Text variant="bodySmall" style={estilosBase.tenue}>
              Enviada el {s.creadaEn.toDate().toLocaleDateString('es-HN')}
            </Text>
          </View>
          <PastillaEstado texto={etiquetaDe(s)} tono={TONO_ESTADO[s.estado]} />
        </View>
        {!!s.respuesta && (
          <Text variant="bodySmall" style={styles.respuesta}>
            Respuesta: {s.respuesta}
          </Text>
        )}
      </Tarjeta>
    );
  };

  return (
    <PantallaBase titulo="Solicitudes">
      {/* ================================================================
          LO QUE ESTÁ ESPERANDO RESPUESTA — arriba de todo
          ================================================================
          Va PRIMERO y separado del historial por una razón concreta: son dos
          preguntas distintas. "¿Ya me contestaron?" se hace todos los días y
          tiene que responderse sin desplazar nada; "¿qué mandé en marzo?" se
          hace una vez cada tanto y puede vivir al final.
          Antes todo estaba junto al fondo de la pantalla, debajo de los cinco
          trámites, así que para ver si había respuesta había que bajar entero. */}
      {pendientes.length > 0 && (
        <>
          <TituloSeccion
            titulo="Esperando respuesta"
            detalle={`${pendientes.length} ${pendientes.length === 1 ? 'solicitud' : 'solicitudes'}`}
          />
          {pendientes.map(tarjetaDeSolicitud)}
        </>
      )}

      <TituloSeccion titulo="Hacer un trámite" />
      <Text variant="bodyMedium" style={estilosBase.tenue}>
        Elegí según lo que necesitás. Cada una dice en qué caso sirve.
      </Text>

      {TRAMITES.map((t) => (
        <Tarjeta key={t.titulo} sinRelleno>
          <TouchableRipple onPress={() => router.push(t.ruta)} borderless>
            <View style={styles.tramite}>
              <View
                style={[
                  styles.circulo,
                  {
                    backgroundColor: t.necesitaAprobacion
                      ? tema.colors.surfaceVariant
                      : tema.colors.primaryContainer,
                  },
                ]}
              >
                <Text style={styles.emoji}>{t.emoji}</Text>
              </View>

              <View style={styles.textoTramite}>
                <View style={styles.filaTitulo}>
                  <Text variant="titleSmall" style={estilosBase.negrita}>
                    {t.titulo}
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={tema.colors.onSurfaceVariant}
                  />
                </View>
                <Text variant="bodySmall" style={estilosBase.tenue}>
                  {t.cuando}
                </Text>
                {/* Lo más importante para el padre: si tiene que esperar o no */}
                <Text
                  variant="labelSmall"
                  style={{
                    color: t.necesitaAprobacion ? tema.colors.onSurfaceVariant : tema.colors.primary,
                    fontFamily: FUENTES.textoNegrita,
                  }}
                >
                  {t.necesitaAprobacion
                    ? 'La revisa la administración'
                    : 'Sin aprobación · sirve el mismo día'}
                </Text>
              </View>
            </View>
          </TouchableRipple>
        </Tarjeta>
      ))}

      {/* --- El historial: lo que la administración ya resolvió --- */}
      <TituloSeccion
        titulo="Historial"
        detalle={
          resueltas.length > 0
            ? `${resueltas.length} ${resueltas.length === 1 ? 'resuelta' : 'resueltas'}`
            : undefined
        }
      />

      {solicitudes.length === 0 ? (
        <Tarjeta>
          <Text style={estilosBase.tenue}>Todavía no enviaste ninguna solicitud.</Text>
        </Tarjeta>
      ) : resueltas.length === 0 ? (
        <Tarjeta>
          <Text style={estilosBase.tenue}>
            Todo lo que enviaste sigue esperando respuesta; lo ves arriba.
          </Text>
        </Tarjeta>
      ) : null}

      {resueltas.map(tarjetaDeSolicitud)}

    </PantallaBase>
  );
}

// El ámbar de "esperando respuesta" es el mismo que el de los avisos: algo que
// pide atención pero no es una falla.
const TONO_ESTADO: Record<EstadoSolicitud, TonoEstado> = {
  pendiente: 'aviso',
  aprobada: 'cumplido',
  rechazada: 'alerta',
};

const styles = StyleSheet.create({
  tramite: { flexDirection: 'row', gap: ESPACIO.interno, padding: ESPACIO.pantalla },
  circulo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circuloChico: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // El emoji se centra a ojo dentro de su círculo: los emoji traen su propio
  // interlineado y sin esto quedan un pelo altos
  emoji: { fontSize: 21, lineHeight: 26 },
  emojiChico: { fontSize: 16, lineHeight: 20 },
  textoTramite: { flex: 1, gap: 3 },
  filaTitulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: ESPACIO.interno },
  datos: { flex: 1, gap: 2 },
  respuesta: { fontStyle: 'italic', opacity: 0.8 },
});
