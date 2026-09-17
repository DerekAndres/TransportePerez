import { StyleSheet, View } from 'react-native';
import { Avatar, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import Tarjeta from '@/components/Tarjeta';
import { ESPACIO, RADIO, estilosBase, halo } from '@/constants/estilos';
import { ESMERALDA, FUENTES, ZAFIRO } from '@/constants/tema';
import { haceCuanto } from '@/utils/tiempo';
import type { ContactoBandeja, TonoContacto } from '@/utils/bandeja';
import type { ResumenConversacion } from '@/services/mensajesService';

// ============================================
// UNA FILA DE LA BANDEJA DE MENSAJES
// ============================================
// La misma fila para los tres roles. Antes había dos copias idénticas (padre y
// conductor) más una tercera parecida dentro de la pantalla del admin: tres
// lugares donde arreglar la misma cosa.
//
// LO QUE CAMBIÓ, Y POR QUÉ:
//
// 1. UN MENSAJE SIN LEER TIENE QUE VERSE SIN LEER. Antes una conversación con
//    tres mensajes esperando se veía IGUAL que una contestada hace un mes: el
//    único indicio era un globito chico. Ahora el nombre va en negrita, el
//    último mensaje deja de estar atenuado (es lo que hay que leer) y la foto
//    lleva un punto de zafiro encima, como en cualquier app de mensajería.
//
// 2. EL CONTADOR ES ZAFIRO, NO ROJO. En el sistema de diseño el rojo significa
//    "algo falló" (ver PastillaEstado): un niño que no estaba en la parada, el
//    GPS caído. Un mensaje sin leer no es una falla, es algo que está pasando
//    ahora — y eso, en toda la app, es zafiro. Con el rojo, la bandeja del
//    admin parecía una pantalla de errores.
//
// 3. LA HORA Y EL CONTADOR NO SE PISAN. Van en columna a la derecha, con la
//    hora arriba: es el orden en que se leen.

const TAMANO_AVATAR = 46;

// De qué color es la burbuja de quien no tiene foto. El tono lo decide quien
// arma la lista, para que un conductor y un padre se distingan de un vistazo.
const RELLENO: Record<TonoContacto, string> = {
  marca: 'rgba(37, 99, 235, 0.22)',
  alterno: 'rgba(16, 185, 129, 0.20)',
  neutro: 'rgba(255, 255, 255, 0.08)',
};

export default function FilaConversacion({
  contacto,
  resumen,
  onPress,
}: {
  contacto: ContactoBandeja;
  resumen?: ResumenConversacion;
  onPress: () => void;
}) {
  const tema = useTheme();
  const tono: TonoContacto = contacto.tono ?? 'neutro';
  const sinLeer = (resumen?.noLeidos ?? 0) > 0;

  const colorIcono =
    tono === 'marca' ? tema.colors.primary : tono === 'alterno' ? ESMERALDA : tema.colors.onSurfaceVariant;

  return (
    <Tarjeta onPress={onPress}>
      <View style={styles.fila}>
        {/* La foto, con el punto de "sin leer" montado en la esquina */}
        <View>
          {contacto.foto ? (
            <Avatar.Image size={TAMANO_AVATAR} source={{ uri: contacto.foto }} />
          ) : (
            <Avatar.Icon
              size={TAMANO_AVATAR}
              icon={contacto.icono}
              style={{ backgroundColor: RELLENO[tono] }}
              color={colorIcono}
            />
          )}
          {sinLeer && <View style={[styles.puntoSinLeer, halo(ZAFIRO)]} />}
        </View>

        <View style={styles.datos}>
          <Text
            variant="titleSmall"
            numberOfLines={1}
            style={sinLeer ? styles.nombreSinLeer : undefined}
          >
            {contacto.nombre}
          </Text>
          <Text
            variant="bodySmall"
            numberOfLines={1}
            // Sin leer, el último mensaje es lo que hay que leer: se muestra con
            // el contraste normal. Leído, es contexto y se atenúa.
            style={sinLeer ? styles.ultimoSinLeer : estilosBase.tenue}
          >
            {resumen?.ultimoTexto ?? contacto.papel}
          </Text>
        </View>

        <View style={styles.derecha}>
          {!!resumen && (
            <Text
              variant="labelSmall"
              style={sinLeer ? { color: tema.colors.primary } : estilosBase.tenue}
            >
              {haceCuanto(resumen.ultimaHora)}
            </Text>
          )}
          {sinLeer ? (
            <View style={[styles.contador, halo(ZAFIRO)]}>
              <Text variant="labelSmall" style={styles.numero}>
                {resumen!.noLeidos}
              </Text>
            </View>
          ) : (
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={tema.colors.onSurfaceVariant}
            />
          )}
        </View>
      </View>
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
  datos: { flex: 1, gap: 2 },
  derecha: { alignItems: 'flex-end', gap: 5 },
  // El grosor se cambia CAMBIANDO DE FAMILIA, nunca con fontWeight (ver tema.ts)
  nombreSinLeer: { fontFamily: FUENTES.textoNegrita },
  ultimoSinLeer: { fontFamily: FUENTES.textoMedio },
  // El punto de zafiro sobre la foto: se ve antes que cualquier texto
  puntoSinLeer: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 15,
    height: 15,
    borderRadius: RADIO.pastilla,
    backgroundColor: ZAFIRO,
    borderWidth: 2,
    borderColor: '#1C1F2A',
  },
  contador: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: RADIO.pastilla,
    backgroundColor: ZAFIRO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numero: { color: '#FFFFFF', includeFontPadding: false },
});
