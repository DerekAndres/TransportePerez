import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import Tarjeta from '@/components/Tarjeta';
import { ESPACIO, RADIO, estilosBase } from '@/constants/estilos';

// Un niño dentro de una tarjeta de asistencia. Dos estados: pendiente / listo.
export interface ItemAsistencia {
  id: string;
  nombre: string;
  hecho: boolean; // true = listo (✓); false = pendiente
  habilitado?: boolean; // false = todavía no se puede accionar (default: true)
  detalle?: string; // texto secundario cuando está pendiente
  alerta?: boolean; // true = el detalle se muestra en rojo (aviso no bloqueante)
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
// Es presentacional: quien la usa decide qué significa "hecho" y qué hace la
// acción. La usan "Mi ruta de hoy" (subió/bajó) y la de transbordo
// (entregar/recibir).
export default function GrupoAsistencia({
  titulo,
  items,
  etiquetaAccion,
  etiquetaGrupo,
  onAccion,
  ocupado,
}: {
  titulo: string;
  items: ItemAsistencia[];
  etiquetaAccion: string; // botón individual (ej. "Subió", "Entregar")
  etiquetaGrupo: string; // botón grupal (ej. "Todos")
  onAccion: (ids: string[]) => void;
  ocupado: boolean;
}) {
  const tema = useTheme();
  const accionables = items.filter((i) => !i.hecho && i.habilitado !== false);
  const listos = items.filter((i) => i.hecho).length;
  const todoListo = listos === items.length && items.length > 0;

  return (
    <Tarjeta>
      <View style={styles.filaTitulo}>
        <Text variant="titleMedium" style={[styles.titulo, estilosBase.negrita]}>
          {titulo}
        </Text>
        {/* Contador: coral suave cuando el grupo está completo */}
        <View
          style={[
            styles.contador,
            {
              backgroundColor: todoListo
                ? tema.colors.primaryContainer
                : tema.colors.surfaceVariant,
            },
          ]}
        >
          {todoListo && (
            <MaterialCommunityIcons
              name="check-circle"
              size={14}
              color={tema.colors.onPrimaryContainer}
            />
          )}
          <Text
            variant="labelMedium"
            style={{
              color: todoListo ? tema.colors.onPrimaryContainer : tema.colors.onSurfaceVariant,
            }}
          >
            {listos} de {items.length}
          </Text>
        </View>
      </View>

      {/* El botón grupal SIEMPRE visible (principio de diseño del proyecto):
          el conductor no tiene que buscarlo ni marcar niño por niño */}
      <Button
        mode="contained-tonal"
        icon="check-all"
        disabled={ocupado || accionables.length === 0}
        onPress={() => onAccion(accionables.map((i) => i.id))}
        style={styles.botonGrupo}
        contentStyle={styles.contenidoBotonGrupo}
        labelStyle={estilosBase.negrita}
      >
        {etiquetaGrupo}
      </Button>

      <View style={styles.lista}>
        {items.map((item, indice) => (
          <View
            key={item.id}
            style={[
              styles.fila,
              indice > 0 && { borderTopWidth: 1, borderTopColor: tema.colors.outlineVariant },
            ]}
          >
            <View style={styles.datos}>
              <Text variant="bodyLarge" numberOfLines={1}>
                {item.nombre}
              </Text>
              <View style={styles.filaEstado}>
                {item.hecho && (
                  <MaterialCommunityIcons name="check" size={15} color={tema.colors.primary} />
                )}
                <Text
                  variant="bodySmall"
                  numberOfLines={2}
                  style={[
                    styles.estado,
                    item.alerta
                      ? { color: tema.colors.error }
                      : item.hecho
                        ? { color: tema.colors.primary, fontWeight: '700' }
                        : estilosBase.tenue,
                  ]}
                >
                  {item.hecho ? 'Listo' : (item.detalle ?? 'Pendiente')}
                </Text>
              </View>
            </View>

            <Button
              mode={item.hecho ? 'text' : 'contained-tonal'}
              compact
              disabled={ocupado || item.hecho || item.habilitado === false}
              onPress={() => onAccion([item.id])}
              contentStyle={styles.contenidoBotonFila}
            >
              {item.hecho ? '✓' : etiquetaAccion}
            </Button>
          </View>
        ))}
      </View>
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  filaTitulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { flex: 1 },
  contador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIO.pastilla,
  },
  botonGrupo: { borderRadius: RADIO.control },
  contenidoBotonGrupo: { paddingVertical: 6 },
  lista: { gap: 0 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIO.interno,
    paddingVertical: ESPACIO.interno,
  },
  datos: { flex: 1, gap: 2 },
  filaEstado: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  estado: { flex: 1 },
  contenidoBotonFila: { paddingHorizontal: 10, paddingVertical: 4 },
});
