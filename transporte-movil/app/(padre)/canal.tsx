import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import { escucharAvisos } from '@/services/canalesService';
import { ESPACIO, estilosBase } from '@/constants/estilos';
import type { Aviso } from '@/types/models';

// Fecha y hora legible de un aviso
function cuando(a: Aviso): string {
  return a.hora.toDate().toLocaleString('es-HN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Avisos de un canal. Es solo lectura a propósito: el canal es informativo, no
// un chat. Si el padre necesita responder, tiene la sección Mensajes.
export default function CanalScreen() {
  const router = useRouter();
  const tema = useTheme();
  const params = useLocalSearchParams<{ canalId: string; canalNombre: string }>();
  const [avisos, setAvisos] = useState<Aviso[] | null>(null);

  useEffect(() => {
    if (!params.canalId) return;
    return escucharAvisos(params.canalId, setAvisos);
  }, [params.canalId]);

  if (avisos === null) {
    return (
      <PantallaBase
        titulo={params.canalNombre ?? 'Avisos'}
        alVolver={() => router.back()}
        scroll={false}
      >
        <View style={estilosBase.centrado}>
          <ActivityIndicator size="large" />
        </View>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase
      titulo={params.canalNombre ?? 'Avisos'}
      subtitulo="Comunicados de la administración"
      alVolver={() => router.back()}
    >
      {avisos.length === 0 && (
        <Tarjeta>
          <Text style={estilosBase.tenue}>Todavía no hay avisos en este canal.</Text>
        </Tarjeta>
      )}

      {avisos.map((a) => (
        <Tarjeta key={a.id}>
          <View style={styles.encabezado}>
            <View style={[styles.circulo, { backgroundColor: tema.colors.tertiaryContainer }]}>
              <MaterialCommunityIcons
                name="bullhorn"
                size={17}
                color={tema.colors.onTertiaryContainer}
              />
            </View>
            <Text variant="bodySmall" style={estilosBase.tenue}>
              {cuando(a)}
            </Text>
          </View>
          <Text variant="bodyLarge">{a.texto}</Text>
        </Tarjeta>
      ))}
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.minimo + 2 },
  circulo: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
