import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import Tarjeta from '@/components/Tarjeta';
import { ESPACIO, RADIO, estilosBase } from '@/constants/estilos';
import { esReciente, haceCuanto } from '@/utils/tiempo';
import type { Aviso } from '@/types/models';

// ============================================
// TARJETA DE UN AVISO
// ============================================
// Muestra el aviso ENTERO (o sus primeras líneas), no un enlace a él: si la
// administración publicó algo, el padre tiene que poder leerlo en el inicio sin
// entrar a ninguna pantalla. Un botón que dice "Avisos" no comunica nada; el
// texto del aviso sí.
//
// La usan el inicio del padre (con `lineas` para recortar los avisos largos) y
// la pantalla del canal (completo).

export default function TarjetaAviso({
  aviso,
  canalNombre,
  lineas,
  onPress,
}: {
  aviso: Aviso;
  // De qué canal es. En la pantalla de un canal ya se sabe, así que se omite.
  canalNombre?: string;
  // Máximo de líneas del texto (sin límite si no se pasa)
  lineas?: number;
  onPress?: () => void;
}) {
  const tema = useTheme();
  const nuevo = esReciente(aviso.hora);

  return (
    <Tarjeta onPress={onPress}>
      <View style={styles.encabezado}>
        <View style={[styles.circulo, { backgroundColor: tema.colors.tertiaryContainer }]}>
          <MaterialCommunityIcons
            name="bullhorn"
            size={18}
            color={tema.colors.onTertiaryContainer}
          />
        </View>

        <View style={styles.datos}>
          <Text variant="titleSmall" numberOfLines={1} style={estilosBase.negrita}>
            {canalNombre ?? 'Comunicado'}
          </Text>
          <Text variant="bodySmall" style={estilosBase.tenue}>
            {haceCuanto(aviso.hora)}
          </Text>
        </View>

        {/* Solo lo publicado en las últimas 24 h se marca como nuevo: así la
            marca significa algo y no aparece en todos los avisos viejos */}
        {nuevo && (
          <View style={[styles.pastilla, { backgroundColor: tema.colors.tertiary }]}>
            <Text variant="labelSmall" style={{ color: tema.colors.onTertiary }}>
              Nuevo
            </Text>
          </View>
        )}
      </View>

      <Text variant="bodyMedium" numberOfLines={lineas} style={styles.texto}>
        {aviso.texto}
      </Text>

      {/* Con el texto recortado, se avisa que hay más para leer */}
      {!!onPress && !!lineas && (
        <View style={styles.pie}>
          <Text variant="labelMedium" style={{ color: tema.colors.primary }}>
            Leer el aviso
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={17} color={tema.colors.primary} />
        </View>
      )}
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
  circulo: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  datos: { flex: 1, gap: 1 },
  pastilla: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIO.pastilla },
  // Interlineado más aireado: un aviso puede ser un párrafo entero
  texto: { lineHeight: 21 },
  pie: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
