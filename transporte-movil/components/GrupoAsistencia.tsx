import { StyleSheet, View } from 'react-native';
import { Button, Card, Divider, Text, useTheme } from 'react-native-paper';

// Un niño dentro de una tarjeta de asistencia. Dos estados: pendiente / listo.
export interface ItemAsistencia {
  id: string;
  nombre: string;
  hecho: boolean; // true = listo (✓ verde); false = pendiente (gris)
  habilitado?: boolean; // false = todavía no se puede accionar (default: true)
  detalle?: string; // texto secundario cuando está pendiente
  alerta?: boolean; // true = el detalle se muestra en rojo (aviso no bloqueante)
}

// Tarjeta de asistencia REUTILIZABLE: un grupo de niños con marcado individual y
// grupal ("Todos" siempre visible). Es presentacional — quien la usa decide qué
// significa "hecho" y qué hace la acción. La usan la pantalla de "Mi ruta de hoy"
// (subió/bajó) y la de transbordo (entregar/recibir).
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

  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.filaTitulo}>
          <Text variant="titleSmall" style={styles.titulo}>
            {titulo}
          </Text>
          <Button
            mode="contained-tonal"
            compact
            disabled={ocupado || accionables.length === 0}
            onPress={() => onAccion(accionables.map((i) => i.id))}
          >
            {etiquetaGrupo}
          </Button>
        </View>
        <Divider style={styles.divisor} />
        {items.map((item) => (
          <View key={item.id} style={styles.fila}>
            <View style={styles.datos}>
              <Text variant="bodyMedium">{item.nombre}</Text>
              <Text
                variant="bodySmall"
                style={
                  item.alerta
                    ? { color: tema.colors.error }
                    : item.hecho
                      ? { color: tema.colors.primary, fontWeight: '700' }
                      : styles.dimmed
                }
              >
                {item.hecho ? '✓ Listo' : (item.detalle ?? 'Pendiente')}
              </Text>
            </View>
            <Button
              mode="outlined"
              compact
              disabled={ocupado || item.hecho || item.habilitado === false}
              onPress={() => onAccion([item.id])}
            >
              {etiquetaAccion}
            </Button>
          </View>
        ))}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {},
  filaTitulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { flex: 1 },
  divisor: { marginVertical: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  datos: { flex: 1 },
  dimmed: { opacity: 0.6 },
});
