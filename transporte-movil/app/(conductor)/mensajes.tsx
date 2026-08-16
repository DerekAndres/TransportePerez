import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Badge, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import { listarContactosConductor } from '@/services/conductorService';
import { escucharBandeja, type ResumenConversacion } from '@/services/mensajesService';
import { ESPACIO, estilosBase } from '@/constants/estilos';

// Bandeja de mensajes del conductor: puede escribirle a la administración y a los
// padres de los niños de sus rutas. Cada fila muestra el último mensaje y un
// badge de no leídos (en vivo).
interface Contacto {
  id: string;
  nombre: string;
  telefono: string;
  icono: keyof typeof MaterialCommunityIcons.glyphMap;
  foto?: string;
  rol: string;
}

export default function MensajesConductorScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();

  const [contactos, setContactos] = useState<Contacto[] | null>(null);
  const [resumenes, setResumenes] = useState<ResumenConversacion[]>([]);

  useEffect(() => {
    if (!usuario) return;
    listarContactosConductor(usuario.id)
      .then(({ padres, admin }) => {
        const lista: Contacto[] = [];
        if (admin) {
          lista.push({
            id: admin.id,
            nombre: 'Administración',
            telefono: admin.telefono,
            icono: 'office-building',
            rol: 'Inversiones Perez',
          });
        }
        padres.forEach((p) =>
          lista.push({
            id: p.id,
            nombre: p.nombre,
            telefono: p.telefono,
            icono: 'account',
            foto: p.foto,
            rol: 'Padre / Madre',
          })
        );
        setContactos(lista);
      })
      .catch(() => setContactos([]));
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;
    return escucharBandeja(usuario.id, setResumenes);
  }, [usuario]);

  const resumenPorId = useMemo(() => new Map(resumenes.map((r) => [r.otroId, r])), [resumenes]);

  const abrir = (c: Contacto) =>
    router.push({
      pathname: '/conversacion',
      params: { otroId: c.id, otroNombre: c.nombre, otroTelefono: c.telefono },
    });

  if (!contactos) {
    return (
      <PantallaBase titulo="Mensajes" scroll={false}>
        <View style={estilosBase.centrado}>
          <ActivityIndicator size="large" />
        </View>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase titulo="Mensajes">
      <Text variant="bodyMedium" style={estilosBase.tenue}>
        Escribile a la administración o a los padres de los niños de tu ruta.
      </Text>

      {contactos.length === 0 && (
        <Tarjeta>
          <Text style={estilosBase.tenue}>
            Todavía no hay con quién chatear. Aparecerán la administración y los padres de tu
            ruta.
          </Text>
        </Tarjeta>
      )}

      {contactos.map((c) => {
        const resumen = resumenPorId.get(c.id);
        return (
          <Tarjeta key={c.id} onPress={() => abrir(c)}>
            <View style={styles.fila}>
              {c.foto ? (
                <Avatar.Image size={46} source={{ uri: c.foto }} />
              ) : (
                <Avatar.Icon
                  size={46}
                  icon={c.icono}
                  style={{ backgroundColor: tema.colors.primaryContainer }}
                  color={tema.colors.onPrimaryContainer}
                />
              )}
              <View style={styles.datos}>
                <Text variant="titleSmall" numberOfLines={1} style={styles.negrita}>
                  {c.nombre}
                </Text>
                <Text variant="bodySmall" numberOfLines={1} style={estilosBase.tenue}>
                  {resumen?.ultimoTexto ?? c.rol}
                </Text>
              </View>
              {resumen && resumen.noLeidos > 0 ? (
                <Badge style={{ backgroundColor: tema.colors.error }}>{resumen.noLeidos}</Badge>
              ) : (
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color={tema.colors.onSurfaceVariant}
                />
              )}
            </View>
          </Tarjeta>
        );
      })}
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
  datos: { flex: 1, gap: 2 },
  negrita: { fontWeight: '700' },
});
