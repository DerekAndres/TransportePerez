import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import { listarCanalesDeEscuelas } from '@/services/canalesService';
import { listarHijos } from '@/services/padreService';
import { ALTURA, ESPACIO, estilosBase } from '@/constants/estilos';
import type { Canal } from '@/types/models';

// Canales informativos del padre: uno por cada escuela donde tiene un hijo.
// No se inscribe a nada — la lista se arma sola con las escuelas de sus hijos.
export default function CanalesScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();

  const [canales, setCanales] = useState<Canal[] | null>(null);

  useEffect(() => {
    if (!usuario) return;
    let cancelado = false;
    (async () => {
      try {
        const hijos = await listarHijos(usuario.id);
        // Escuelas distintas de sus hijos (dos hijos en la misma escuela = un canal)
        const escuelaIds = [
          ...new Set(hijos.map((h) => h.escuelaId).filter((x): x is string => !!x)),
        ];
        const lista = await listarCanalesDeEscuelas(escuelaIds);
        if (!cancelado) setCanales(lista);
      } catch {
        if (!cancelado) setCanales([]);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [usuario]);

  if (canales === null) {
    return (
      <PantallaBase titulo="Avisos" scroll={false}>
        <View style={estilosBase.centrado}>
          <ActivityIndicator size="large" />
        </View>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase titulo="Avisos">
      <Text variant="bodyMedium" style={estilosBase.tenue}>
        Comunicados de la administración para las escuelas de tus hijos.
      </Text>

      {canales.length === 0 && (
        <Tarjeta>
          <Text style={estilosBase.tenue}>
            Todavía no hay canales de avisos para la escuela de tus hijos.
          </Text>
        </Tarjeta>
      )}

      {canales.map((c) => (
        <Tarjeta
          key={c.id}
          sinRelleno
          onPress={() =>
            router.push({ pathname: '/canal', params: { canalId: c.id, canalNombre: c.nombre } })
          }
        >
          {/* Portada del canal (normalmente el logo de la escuela) */}
          {!!c.foto && <Image source={{ uri: c.foto }} style={styles.portada} />}
          <View style={styles.cuerpo}>
            {!c.foto && (
              <View style={[styles.circulo, { backgroundColor: tema.colors.tertiaryContainer }]}>
                <MaterialCommunityIcons
                  name="bullhorn"
                  size={22}
                  color={tema.colors.onTertiaryContainer}
                />
              </View>
            )}
            <View style={styles.datos}>
              <Text variant="titleMedium" style={styles.negrita}>
                {c.nombre}
              </Text>
              {!!c.descripcion && (
                <Text variant="bodySmall" style={estilosBase.tenue}>
                  {c.descripcion}
                </Text>
              )}
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={tema.colors.onSurfaceVariant}
            />
          </View>
        </Tarjeta>
      ))}
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  portada: { width: '100%', height: ALTURA.portada },
  cuerpo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIO.interno,
    padding: ESPACIO.pantalla,
  },
  circulo: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  datos: { flex: 1, gap: 2 },
  negrita: { fontWeight: '700' },
});
