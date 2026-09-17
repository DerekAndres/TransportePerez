import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ESPACIO, RADIO, VIDRIO, estilosBase } from '@/constants/estilos';
import { CIAN } from '@/constants/tema';

// ============================================
// MÉTRICA — la mini-tarjeta de una cifra
// ============================================
// La usan el encabezado del conductor (A bordo / Esperando / Ausentes) y el
// resumen del admin (Unidades / Alumnos / Sin salir). Es una sola pieza porque
// en el diseño de Stitch son la misma: una lámina chica, la etiqueta arriba en
// mayúsculas y el número grande debajo.
//
// TRES DETALLES QUE NO SON ESTÉTICOS:
//
//   · EL NÚMERO VA EN DOS DÍGITOS ("04", no "4"). Con un solo dígito, las tres
//     columnas quedan de ancho distinto y el bloque se ve torcido; y cuando un
//     contador pasa de 9 a 10 todo lo de al lado se corre. Es la convención de
//     los tableros, y por eso el diseño la usa.
//   · LA FUENTE ES TABULAR (`estilosBase.cifra`): todos los dígitos ocupan lo
//     mismo, así que un número que cambia en vivo no hace "temblar" la fila.
//   · LA ETIQUETA VA ARRIBA Y EL NÚMERO ABAJO. Al revés se lee peor: el ojo
//     baja buscando el dato, y lo que tiene que encontrar al final del recorrido
//     es la cifra, no su nombre.

export default function Metrica({
  etiqueta,
  valor,
  de,
  pie,
  icono,
  tono = 'neutro',
}: {
  etiqueta: string;
  valor: number;
  // Denominador opcional: "14 /16"
  de?: number;
  // Renglón chico al pie ("En ruta", "A bordo")
  pie?: string;
  icono?: keyof typeof MaterialCommunityIcons.glyphMap;
  // De qué color va el número. Los mismos significados de siempre:
  // vivo = está pasando ahora · cumplido = ya se cumplió · alerta = falló
  tono?: 'neutro' | 'vivo' | 'cumplido' | 'alerta' | 'dato';
}) {
  const tema = useTheme();

  const colores = {
    neutro: tema.colors.onSurface,
    vivo: tema.colors.primary,
    cumplido: tema.colors.secondary,
    alerta: tema.colors.error,
    dato: CIAN,
  };
  const color = colores[tono];

  return (
    <View style={styles.metrica}>
      <Text variant="labelSmall" numberOfLines={1} style={estilosBase.tenue}>
        {etiqueta.toUpperCase()}
      </Text>

      <View style={styles.filaValor}>
        <Text variant="headlineSmall" style={[estilosBase.cifra, { color }]}>
          {/* Dos dígitos: es lo que mantiene alineadas las tres columnas */}
          {String(valor).padStart(2, '0')}
        </Text>
        {de !== undefined && (
          <Text variant="labelMedium" style={estilosBase.tenue}>
            /{String(de).padStart(2, '0')}
          </Text>
        )}
      </View>

      {!!pie && (
        <View style={styles.pie}>
          {!!icono && (
            <MaterialCommunityIcons name={icono} size={11} color={tema.colors.onSurfaceVariant} />
          )}
          <Text variant="labelSmall" numberOfLines={1} style={estilosBase.tenue}>
            {pie}
          </Text>
        </View>
      )}
    </View>
  );
}

// Las tres métricas juntas. Se exporta acá y no se arma en cada pantalla para
// que el conductor y el admin vean exactamente el mismo bloque.
export function FilaMetricas({ children }: { children: React.ReactNode }) {
  return <View style={styles.fila}>{children}</View>;
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', gap: ESPACIO.minimo },
  // Cada métrica es una lámina hundida dentro de la tarjeta que la contiene:
  // más oscura que su madre, no más clara. Es lo que las lee como "casillas
  // de un tablero" en vez de tres tarjetas sueltas.
  metrica: {
    flex: 1,
    gap: 2,
    paddingVertical: ESPACIO.minimo + 2,
    paddingHorizontal: ESPACIO.minimo + 2,
    borderRadius: RADIO.control,
    backgroundColor: 'rgba(10, 14, 24, 0.55)',
    borderWidth: 1,
    borderColor: VIDRIO.borde,
  },
  filaValor: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  pie: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
