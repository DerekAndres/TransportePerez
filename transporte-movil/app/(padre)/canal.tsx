import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import TarjetaAviso from '@/components/TarjetaAviso';
import { escucharAvisos } from '@/services/canalesService';
import { estilosBase } from '@/constants/estilos';
import type { Aviso } from '@/types/models';

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
          <View style={estilosBase.filaEntre}>
            <Text style={estilosBase.tenue}>Todavía no hay avisos en este canal.</Text>
            <MaterialCommunityIcons
              name="bullhorn-outline"
              size={20}
              color={tema.colors.onSurfaceVariant}
            />
          </View>
        </Tarjeta>
      )}

      {/* Misma tarjeta que en el inicio, pero con el texto completo */}
      {avisos.map((a) => (
        <TarjetaAviso key={a.id} aviso={a} canalNombre={params.canalNombre} />
      ))}
    </PantallaBase>
  );
}
