import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import PantallaBase from '@/components/PantallaBase';
import MapaBusEnVivo, { CENTRO_LA_CEIBA, type EstadoMapa } from '@/components/MapaBusEnVivo';
import { ESPACIO, RADIO, estilosBase } from '@/constants/estilos';

// Mapa a pantalla completa del bus que lleva al hijo. Toda la mecánica (Leaflet
// en un WebView, la suscripción a 'ubicaciones' y el camino por las calles) vive
// en el componente MapaBusEnVivo, que esta pantalla comparte con el inicio.
export default function MapaEnVivoScreen() {
  const router = useRouter();
  const tema = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    viajeId: string;
    hijoNombre: string;
    paradaNombre: string;
    paradaLat: string;
    paradaLng: string;
  }>();

  const [estado, setEstado] = useState<EstadoMapa>({ tipo: 'esperando' });

  const paradaLat = Number(params.paradaLat) || CENTRO_LA_CEIBA.lat;
  const paradaLng = Number(params.paradaLng) || CENTRO_LA_CEIBA.lng;

  // useCallback para no recrear la función en cada render (el componente la
  // guarda en una ref, pero así queda explícito que es estable)
  const alCambiarEstado = useCallback((nuevo: EstadoMapa) => setEstado(nuevo), []);

  // Etiqueta de la señal: es lo primero que mira el padre al abrir el mapa
  const senal =
    estado.tipo === 'finalizado'
      ? { icono: 'flag-checkered' as const, texto: 'El viaje finalizó', vivo: false }
      : estado.tipo === 'en_vivo'
        ? { icono: 'access-point' as const, texto: `En vivo · ${estado.hora}`, vivo: true }
        : { icono: 'timer-sand' as const, texto: 'Esperando ubicación del bus…', vivo: false };

  return (
    <PantallaBase
      titulo={`Bus de ${params.hijoNombre ?? ''}`}
      alVolver={() => router.back()}
      scroll={false}
    >
      <View style={styles.contenido}>
        <View style={styles.filaEstado}>
          <View
            style={[
              styles.pastilla,
              {
                backgroundColor: senal.vivo ? tema.colors.primary : tema.colors.surfaceVariant,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={senal.icono}
              size={15}
              color={senal.vivo ? tema.colors.onPrimary : tema.colors.onSurfaceVariant}
            />
            <Text
              variant="labelMedium"
              style={{ color: senal.vivo ? tema.colors.onPrimary : tema.colors.onSurfaceVariant }}
            >
              {senal.texto}
            </Text>
          </View>
        </View>

        <MapaBusEnVivo
          viajeId={params.viajeId}
          paradaLat={paradaLat}
          paradaLng={paradaLng}
          paradaNombre={params.paradaNombre ?? ''}
          onEstado={alCambiarEstado}
          style={styles.mapa}
        />

        {/* El pie se separa de la barra de navegación del teléfono (los tres
            botones de Android o la barra de gestos), que si no lo taparía */}
        <Text
          variant="bodySmall"
          style={[
            estilosBase.tenue,
            styles.pie,
            { paddingBottom: insets.bottom + ESPACIO.interno },
          ]}
        >
          🏠 {params.paradaNombre || 'Parada'} · 🚌 el bus se actualiza cada ~15-20 s · la línea
          coral sigue las calles
        </Text>
      </View>
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  contenido: { flex: 1 },
  filaEstado: { flexDirection: 'row', paddingHorizontal: ESPACIO.pantalla, paddingBottom: 10 },
  pastilla: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIO.pastilla,
  },
  // El mapa ocupa todo el alto disponible, pegado a los bordes y con las
  // esquinas de arriba redondeadas para que se lea como una hoja que sube
  mapa: { flex: 1, borderTopLeftRadius: RADIO.tarjeta, borderTopRightRadius: RADIO.tarjeta },
  pie: { textAlign: 'center', padding: ESPACIO.interno },
});
