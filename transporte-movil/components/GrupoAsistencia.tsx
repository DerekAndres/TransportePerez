import { StyleSheet, View } from 'react-native';
import { Button, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import Tarjeta from '@/components/Tarjeta';
import PastillaEstado from '@/components/PastillaEstado';
import { ALTURA, ESPACIO, RADIO, VIDRIO, halo } from '@/constants/estilos';
import { ESMERALDA } from '@/constants/tema';

// Un niño dentro de una tarjeta de asistencia. Dos estados: pendiente / listo.
export interface ItemAsistencia {
  id: string;
  nombre: string;
  hecho: boolean; // true = listo (✓); false = pendiente
  habilitado?: boolean; // false = todavía no se puede accionar (default: true)
  detalle?: string; // texto secundario cuando está pendiente
  alerta?: boolean; // true = el detalle se muestra en rojo (aviso no bloqueante)
  // true = el niño quedó marcado como "no estaba en la parada". No es lo mismo
  // que `hecho`: el trámite terminó, pero terminó MAL, y tiene que verse así.
  fallo?: boolean;
}

// ============================================
// TARJETA DE ASISTENCIA DE UN GRUPO
// ============================================
// Es LA pantalla del conductor: la usa parado en la parada, con el bus andando
// y sin tiempo para leer. Por eso:
//   - el botón grupal ("Todos subieron") va ancho y arriba de todo, porque es
//     lo que se toca el 90 % de las veces;
//   - cada niño tiene un botón grande, no una casilla chiquita;
//   - hay dos estados y nada más — pendiente o listo — con un ✓ que se ve de
//     lejos;
//   - el contador ("2 de 4") deja saber cuánto falta sin contar a mano.
//
// ⚠️ ACÁ EL VIDRIO SE APAGA, Y ES A PROPÓSITO.
// Toda la app está hecha de láminas translúcidas, pero los botones de esta
// tarjeta van con RELLENO SÓLIDO Y SATURADO. El motivo está escrito en
// constants/tema.ts: la identidad es oscura, y el conductor la usa a pleno sol
// con reflejo en la pantalla. Un botón de vidrio semitransparente ahí
// desaparece; uno de esmeralda llena, no. Cuando el diseño y la condición de
// uso se pelean, en esta tarjeta gana la condición de uso — es la única de la
// app donde marcar mal tiene consecuencias sobre un niño.
//
// Cada fila mide 72 px de alto como mínimo (ALTURA.filaNino), que es lo que
// pide el design system y por una razón concreta: con el bus en movimiento,
// filas más juntas hacen que el conductor le marque al hermano equivocado.
//
// Es presentacional: quien la usa decide qué significa "hecho" y qué hace la
// acción. La usan "Mi ruta de hoy" (subió/bajó) y la de transbordo
// (entregar/recibir).
export default function GrupoAsistencia({
  titulo,
  items,
  etiquetaAccion,
  etiquetaGrupo,
  onAccion,
  etiquetaSecundaria,
  onSecundaria,
  etiquetaDeshacer,
  onDeshacer,
  ocupado,
}: {
  titulo: string;
  items: ItemAsistencia[];
  etiquetaAccion: string; // botón individual (ej. "Subió", "Entregar")
  etiquetaGrupo: string; // botón grupal (ej. "Todos")
  onAccion: (ids: string[]) => void;
  // Acción de ESCAPE, opcional: la salida cuando lo normal no pasó ("No estaba").
  // Va deliberadamente chica y sin relleno, para que no compita con la acción
  // principal — el conductor tiene que seguir viendo UN botón obvio.
  etiquetaSecundaria?: string;
  onSecundaria?: (ids: string[]) => void;
  // DESHACER, opcional: aparece solo sobre los que ya están listos. Marcar mal
  // con el bus andando es cuestión de tiempo, y sin una salida el conductor
  // queda atrapado con un dato falso que además ya se le avisó al padre.
  etiquetaDeshacer?: string;
  onDeshacer?: (ids: string[]) => void;
  ocupado: boolean;
}) {
  const tema = useTheme();
  const accionables = items.filter((i) => !i.hecho && i.habilitado !== false);
  const listos = items.filter((i) => i.hecho).length;
  const todoListo = listos === items.length && items.length > 0;

  return (
    <Tarjeta>
      <View style={styles.filaTitulo}>
        <Text variant="titleLarge" style={styles.titulo} numberOfLines={2}>
          {titulo}
        </Text>
        {/* Contador: se enciende en esmeralda cuando el grupo está completo */}
        <PastillaEstado
          texto={`${listos} de ${items.length}`}
          tono={todoListo ? 'cumplido' : 'espera'}
          icono={todoListo ? 'check-circle' : undefined}
        />
      </View>

      {/* EL BOTÓN GRUPAL, SIEMPRE VISIBLE (principio de diseño del proyecto):
          el conductor no tiene que buscarlo ni marcar niño por niño. Va relleno
          de esmeralda, que en toda la app significa "cumplido", y con el número
          adentro para que se lea a cuántos afecta antes de tocarlo. */}
      <TouchableRipple
        onPress={() => onAccion(accionables.map((i) => i.id))}
        disabled={ocupado || accionables.length === 0}
        borderless
        style={[
          styles.botonGrupo,
          accionables.length > 0
            ? { backgroundColor: ESMERALDA, ...halo(ESMERALDA) }
            : { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
          (ocupado || accionables.length === 0) && styles.inactivo,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${etiquetaGrupo} (${accionables.length})`}
      >
        <View style={styles.contenidoBotonGrupo}>
          <MaterialCommunityIcons
            name="check-all"
            size={22}
            color={accionables.length > 0 ? tema.colors.onSecondaryContainer : tema.colors.onSurfaceVariant}
          />
          <Text
            variant="titleMedium"
            style={{
              color:
                accionables.length > 0
                  ? tema.colors.onSecondaryContainer
                  : tema.colors.onSurfaceVariant,
            }}
          >
            {etiquetaGrupo}
            {accionables.length > 0 ? ` (${accionables.length})` : ''}
          </Text>
        </View>
      </TouchableRipple>

      <View style={styles.lista}>
        {items.map((item, indice) => (
          <View
            key={item.id}
            style={[
              styles.fila,
              indice > 0 && { borderTopWidth: 1, borderTopColor: VIDRIO.borde },
            ]}
          >
            {/* La inicial del niño en un círculo. No es decoración: le da a cada
                fila un ancla visual distinta, y con el bus moviéndose eso ayuda
                a no perder el renglón entre un nombre y el de al lado. */}
            <View
              style={[
                styles.inicial,
                item.fallo
                  ? { backgroundColor: 'rgba(255, 90, 82, 0.18)' }
                  : item.hecho
                    ? { backgroundColor: 'rgba(16, 185, 129, 0.18)' }
                    : { backgroundColor: 'rgba(255, 255, 255, 0.07)' },
              ]}
            >
              <Text
                variant="titleMedium"
                style={{
                  color: item.fallo
                    ? tema.colors.error
                    : item.hecho
                      ? tema.colors.secondary
                      : tema.colors.onSurfaceVariant,
                }}
              >
                {(item.nombre || '?').trim().charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={styles.datos}>
              <Text variant="titleMedium" numberOfLines={1}>
                {item.nombre}
              </Text>
              {/* El estado, siempre como pastilla: es el mismo indicador que ve
                  el padre en su pantalla, así los dos hablan el mismo idioma */}
              <PastillaEstado
                texto={
                  item.fallo
                    ? 'No estaba'
                    : item.hecho
                      ? 'Listo'
                      : (item.detalle ?? 'Pendiente')
                }
                tono={
                  item.fallo ? 'alerta' : item.hecho ? 'cumplido' : item.alerta ? 'aviso' : 'espera'
                }
              />
            </View>

            <View style={styles.acciones}>
              {/* La salida de escape solo aparece mientras el niño sigue
                  pendiente: una vez resuelto, deja de tener sentido */}
              {!!etiquetaSecundaria && !!onSecundaria && !item.hecho && (
                <Button
                  mode="text"
                  compact
                  textColor={tema.colors.error}
                  disabled={ocupado || item.habilitado === false}
                  onPress={() => onSecundaria([item.id])}
                  labelStyle={styles.etiquetaSecundaria}
                >
                  {etiquetaSecundaria}
                </Button>
              )}
              {/* Deshacer: solo sobre lo ya marcado */}
              {!!etiquetaDeshacer && !!onDeshacer && item.hecho && (
                <Button
                  mode="text"
                  compact
                  textColor={tema.colors.onSurfaceVariant}
                  disabled={ocupado}
                  onPress={() => onDeshacer([item.id])}
                  labelStyle={styles.etiquetaSecundaria}
                >
                  {etiquetaDeshacer}
                </Button>
              )}

              {item.hecho ? (
                // Ya marcado: un ✓ apagado. No es un botón — no hay nada que
                // volver a tocar, y dejarlo tocable invita a marcar dos veces.
                <View style={styles.marcaListo}>
                  <MaterialCommunityIcons name="check" size={22} color={tema.colors.secondary} />
                </View>
              ) : (
                <TouchableRipple
                  onPress={() => onAccion([item.id])}
                  disabled={ocupado || item.habilitado === false}
                  borderless
                  style={[
                    styles.botonFila,
                    { backgroundColor: ESMERALDA },
                    (ocupado || item.habilitado === false) && styles.inactivo,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${etiquetaAccion}: ${item.nombre}`}
                >
                  <Text
                    variant="labelLarge"
                    style={{ color: tema.colors.onSecondaryContainer }}
                  >
                    {etiquetaAccion}
                  </Text>
                </TouchableRipple>
              )}
            </View>
          </View>
        ))}
      </View>
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  filaTitulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { flex: 1 },
  inactivo: { opacity: 0.4 },

  botonGrupo: { borderRadius: RADIO.control },
  contenidoBotonGrupo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    // 52 px: por encima del mínimo de 48 de Android, y el que más se toca
    minHeight: 52,
    paddingHorizontal: ESPACIO.canal,
  },

  lista: { gap: 0 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIO.interno,
    paddingVertical: ESPACIO.interno,
    // El alto mínimo que pide el design system para no marcar al hermano
    // equivocado con el bus en movimiento
    minHeight: ALTURA.filaNino,
  },
  inicial: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datos: { flex: 1, gap: 5 },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  etiquetaSecundaria: { fontSize: 12 },
  botonFila: {
    borderRadius: RADIO.pastilla,
    paddingHorizontal: 16,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaListo: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
