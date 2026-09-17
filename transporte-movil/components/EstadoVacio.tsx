import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import Tarjeta from '@/components/Tarjeta';
import { ESPACIO, RADIO, VIDRIO, estilosBase } from '@/constants/estilos';

// ============================================
// CUANDO NO HAY NADA QUE MOSTRAR
// ============================================
// Una lista vacía es el momento en que más se duda de si la app está rota. Por
// eso una pantalla vacía nunca puede ser un renglón de texto gris suelto, que
// es lo que había en las cinco pantallas de comunicación: cada una lo resolvía
// con una tarjeta distinta y un texto distinto.
//
// El patrón es siempre el mismo y dice tres cosas en este orden:
//   · un ícono, para que se lea de qué está vacío sin leer nada;
//   · QUÉ pasa, en una frase corta y en positivo ("Todavía no hay avisos");
//   · POR QUÉ y qué va a pasar después ("cuando la administración publique
//     algo, te aparece acá"). Sin esa segunda línea, el usuario no sabe si
//     tiene que hacer algo él.
export default function EstadoVacio({
  icono,
  titulo,
  texto,
}: {
  icono: keyof typeof MaterialCommunityIcons.glyphMap;
  titulo: string;
  // La explicación: qué tiene que pasar para que esto deje de estar vacío
  texto?: string;
}) {
  const tema = useTheme();

  return (
    <Tarjeta>
      <View style={styles.contenido}>
        <View style={styles.circulo}>
          <MaterialCommunityIcons name={icono} size={26} color={tema.colors.onSurfaceVariant} />
        </View>
        <Text variant="titleSmall" style={styles.titulo}>
          {titulo}
        </Text>
        {!!texto && (
          <Text variant="bodySmall" style={[estilosBase.tenue, styles.texto]}>
            {texto}
          </Text>
        )}
      </View>
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  contenido: { alignItems: 'center', gap: ESPACIO.minimo, paddingVertical: ESPACIO.interno },
  circulo: {
    width: 58,
    height: 58,
    borderRadius: RADIO.pastilla,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: VIDRIO.borde,
    marginBottom: 2,
  },
  titulo: { textAlign: 'center' },
  texto: { textAlign: 'center' },
});
