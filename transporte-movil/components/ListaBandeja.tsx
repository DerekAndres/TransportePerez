import type { ReactNode } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import EstadoVacio from '@/components/EstadoVacio';
import FilaConversacion from '@/components/FilaConversacion';
import { ESPACIO, estilosBase, respiroInferior } from '@/constants/estilos';
import type { ContactoBandeja, FilaBandeja } from '@/utils/bandeja';

// ============================================
// LA BANDEJA DE MENSAJES, UNA SOLA PARA LOS TRES ROLES
// ============================================
// Padre, conductor y admin ven la MISMA bandeja; lo único que cambia es de
// dónde salen los contactos (los conductores de sus hijos, los padres de su
// ruta, todo el mundo). Antes eran tres pantallas distintas: dos copiadas letra
// por letra y una tercera, la del admin, que era la única bien resuelta.
//
// ⚠️ POR QUÉ FlatList Y NO EL SCROLL DE PantallaBase.
// El resto de la app dibuja su contenido dentro de un ScrollView, que monta
// TODO de una vez. Con tres contactos no se nota; la bandeja del admin tiene
// uno por cada padre y cada conductor de la empresa, y la del conductor uno por
// cada padre de su ruta. Con trescientas filas, un ScrollView arma las
// trescientas antes de mostrar la primera, y en los teléfonos de gama baja que
// usa la empresa eso son varios segundos de pantalla congelada. FlatList monta
// solo lo que entra en pantalla y recicla al desplazar.
//
// El `encabezado` (buscador, filtros por rol) va FUERA de la lista y no como
// `ListHeaderComponent` a propósito: como encabezado se iría con el scroll, y
// un buscador que hay que ir a buscar arriba de todo no se usa.
export default function ListaBandeja({
  filas,
  onAbrir,
  encabezado,
}: {
  filas: FilaBandeja[];
  onAbrir: (contacto: ContactoBandeja) => void;
  encabezado?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <>
      {!!encabezado && <View style={styles.encabezadoFijo}>{encabezado}</View>}

      <FlatList
        data={filas}
        keyExtractor={(fila) => fila.clase + '-' + fila.id}
        contentContainerStyle={[
          styles.lista,
          { paddingBottom: respiroInferior(insets.bottom, true) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // Con la lista virtualizada, estos tres números deciden cuánto trabaja
        // el teléfono al abrir y al desplazar:
        //   · `initialNumToRender`: cuántas filas se dibujan ANTES de mostrar
        //     algo. Doce llenan una pantalla; más solo retrasa la apertura.
        //   · `windowSize`: cuántas pantallas de alto se mantienen montadas
        //     alrededor de lo visible. Con 7 el scroll rápido no deja huecos.
        //   · `removeClippedSubviews`: descarta de memoria lo que quedó lejos.
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews
        renderItem={({ item }) => {
          if (item.clase === 'encabezado') {
            return (
              <View style={styles.grupo}>
                <Text variant="titleLarge">{item.texto}</Text>
                {!!item.detalle && (
                  <Text variant="labelMedium" style={estilosBase.tenue}>
                    {item.detalle}
                  </Text>
                )}
              </View>
            );
          }

          if (item.clase === 'vacio') {
            return (
              <View style={styles.fila}>
                <EstadoVacio icono="message-text-outline" titulo={item.texto} />
              </View>
            );
          }

          return (
            <View style={styles.fila}>
              <FilaConversacion
                contacto={item.contacto}
                resumen={item.resumen}
                onPress={() => onAbrir(item.contacto)}
              />
            </View>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  encabezadoFijo: {
    paddingHorizontal: ESPACIO.pantalla,
    paddingBottom: ESPACIO.interno,
    gap: ESPACIO.interno,
  },
  lista: { paddingHorizontal: ESPACIO.pantalla },
  // La separación va en cada fila y no como `gap` de la lista: FlatList recicla
  // mejor cuando cada fila trae su propio espacio
  fila: { marginBottom: ESPACIO.interno },
  grupo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: ESPACIO.minimo,
    paddingBottom: ESPACIO.interno,
  },
});
