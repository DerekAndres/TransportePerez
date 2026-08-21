import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Badge, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import { listarContactosPadre } from '@/services/padreService';
import { escucharBandeja, type ResumenConversacion } from '@/services/mensajesService';
import { ESPACIO, estilosBase } from '@/constants/estilos';
import { haceCuanto } from '@/utils/tiempo';

// Bandeja de mensajes del padre: puede escribirle a la administración y al/los
// conductor(es) de las rutas de sus hijos. Cada fila muestra el último mensaje y
// un badge de no leídos (en vivo).
interface Contacto {
  id: string;
  nombre: string;
  telefono: string;
  icono: keyof typeof MaterialCommunityIcons.glyphMap;
  foto?: string;
  rol: string;
}

export default function MensajesPadreScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();

  const [contactos, setContactos] = useState<Contacto[] | null>(null);
  const [resumenes, setResumenes] = useState<ResumenConversacion[]>([]);

  // Contactos disponibles (una vez)
  useEffect(() => {
    if (!usuario) return;
    listarContactosPadre(usuario.id)
      .then(({ conductores, admin }) => {
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
        conductores.forEach((c) =>
          lista.push({
            id: c.id,
            nombre: c.nombre,
            telefono: c.telefono,
            icono: 'bus',
            foto: c.foto,
            rol: 'Conductor',
          })
        );
        setContactos(lista);
      })
      .catch(() => setContactos([]));
  }, [usuario]);

  // Resúmenes de conversación en vivo (último mensaje + no leídos)
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
        Escribile al conductor de la ruta de tu hijo o a la administración.
      </Text>

      {contactos.length === 0 && (
        <Tarjeta>
          <Text style={estilosBase.tenue}>
            Todavía no hay con quién chatear. Aparecerá la administración y el conductor de la
            ruta de tu hijo.
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
              {/* Cuándo fue lo último y cuánto falta por leer, como en cualquier
                  app de mensajería: se entiende sin explicación */}
              <View style={styles.derecha}>
                {!!resumen && (
                  <Text variant="labelSmall" style={estilosBase.tenue}>
                    {haceCuanto(resumen.ultimaHora)}
                  </Text>
                )}
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
  derecha: { alignItems: 'flex-end', gap: 4 },
  negrita: { fontWeight: '700' },
});
