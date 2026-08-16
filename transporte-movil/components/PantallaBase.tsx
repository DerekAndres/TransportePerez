import { useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MenuLateral from '@/components/MenuLateral';
import { ALTURA, ESPACIO, RADIO, estilosBase } from '@/constants/estilos';

// ============================================
// ESQUELETO COMÚN DE TODAS LAS PANTALLAS
// ============================================
// Todas las pantallas de la app se arman con este componente, y por eso todas
// se ven igual: el mismo encabezado ("Transportes Perez" al centro, el menú ☰ a
// la izquierda), el mismo margen lateral y el mismo aire entre bloques.
//
// Hay dos formas de la barra de arriba:
//   - Sección (Inicio, Mensajes, Avisos…): botón ☰ que abre el menú lateral.
//   - Pantalla apilada (un formulario, el perfil de un hijo): flecha de volver.
// Se elige sola según se pase o no `alVolver`.

interface Props {
  // Lo que dice el centro del encabezado. Por defecto, el nombre de la empresa.
  titulo?: string;
  // Renglón chico bajo el título (ej. "Últimos 7 días")
  subtitulo?: string;
  // Si se pasa, la izquierda muestra la flecha de volver en vez del menú ☰
  alVolver?: () => void;
  // Contenido opcional de la esquina derecha (avatar, botón de acción)
  accionDerecha?: ReactNode;
  // false para pantallas que manejan su propio scroll o que ocupan todo el alto
  // (el mapa a pantalla completa, un chat con su lista invertida)
  scroll?: boolean;
  // Deslizar para refrescar (solo con scroll)
  refrescando?: boolean;
  onRefrescar?: () => void;
  children: ReactNode;
}

export default function PantallaBase({
  titulo = 'Transportes Perez',
  subtitulo,
  alVolver,
  accionDerecha,
  scroll = true,
  refrescando,
  onRefrescar,
  children,
}: Props) {
  const tema = useTheme();
  const insets = useSafeAreaInsets();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const contenido = scroll ? (
    <ScrollView
      contentContainerStyle={estilosBase.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefrescar ? (
          <RefreshControl refreshing={!!refrescando} onRefresh={onRefrescar} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={estilosBase.pantalla}>{children}</View>
  );

  return (
    <View style={[estilosBase.pantalla, { backgroundColor: tema.colors.background }]}>
      {/* Encabezado: menú/volver · nombre · acción */}
      <View style={[styles.encabezado, { paddingTop: insets.top + 6 }]}>
        <TouchableRipple
          onPress={alVolver ?? (() => setMenuAbierto(true))}
          borderless
          style={styles.botonIzquierda}
          accessibilityLabel={alVolver ? 'Volver' : 'Abrir menú'}
        >
          <MaterialCommunityIcons
            name={alVolver ? 'arrow-left' : 'menu'}
            size={26}
            color={tema.colors.onSurface}
          />
        </TouchableRipple>

        <View style={styles.centro}>
          <Text variant="titleMedium" numberOfLines={1} style={styles.titulo}>
            {titulo}
          </Text>
          {!!subtitulo && (
            <Text variant="bodySmall" numberOfLines={1} style={estilosBase.tenue}>
              {subtitulo}
            </Text>
          )}
        </View>

        {/* Ancho fijo a la derecha para que el título quede centrado de verdad,
            haya o no acción (si no, el texto se corre hacia un lado) */}
        <View style={styles.ranuraDerecha}>{accionDerecha}</View>
      </View>

      {contenido}

      <MenuLateral visible={menuAbierto} onCerrar={() => setMenuAbierto(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ALTURA.encabezado,
    paddingHorizontal: ESPACIO.interno,
    paddingBottom: ESPACIO.interno,
    gap: ESPACIO.minimo,
  },
  botonIzquierda: {
    width: 44,
    height: 44,
    borderRadius: RADIO.pastilla,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centro: { flex: 1, alignItems: 'center' },
  titulo: { fontWeight: '700' },
  ranuraDerecha: { width: 44, alignItems: 'flex-end', justifyContent: 'center' },
});
