import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  Badge,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import TituloSeccion from '@/components/TituloSeccion';
import {
  escucharBandeja,
  listarUsuarios,
  type ResumenConversacion,
} from '@/services/mensajesService';
import { ESPACIO, RADIO, estilosBase } from '@/constants/estilos';
import { haceCuanto } from '@/utils/tiempo';
import type { Usuario } from '@/types/models';

// ============================================
// BANDEJA DEL ADMIN
// ============================================
// Arriba, las conversaciones que ya existen, de la más reciente a la más vieja y
// con los no leídos marcados: es a lo que el admin entra a responder. Debajo,
// todos los demás padres y conductores para empezar una conversación nueva, con
// un buscador porque la lista crece con la empresa.
//
// La pantalla de chat es la misma que usan el padre y el conductor
// (`app/conversacion.tsx`): el chat es idéntico para los tres roles.
export default function MensajesAdminScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();

  const [gente, setGente] = useState<Usuario[] | null>(null);
  const [resumenes, setResumenes] = useState<ResumenConversacion[]>([]);
  const [busqueda, setBusqueda] = useState('');

  // Todos los usuarios menos yo (el admin habla con padres y conductores)
  useEffect(() => {
    if (!usuario) return;
    let cancelado = false;
    listarUsuarios()
      .then((lista) => {
        if (cancelado) return;
        setGente(lista.filter((u) => u.id !== usuario.id && u.activo !== false));
      })
      .catch(() => {
        if (!cancelado) setGente([]);
      });
    return () => {
      cancelado = true;
    };
  }, [usuario]);

  // Resúmenes en vivo (último mensaje + no leídos)
  useEffect(() => {
    if (!usuario) return;
    return escucharBandeja(usuario.id, setResumenes);
  }, [usuario]);

  const porId = useMemo(() => new Map((gente ?? []).map((u) => [u.id, u])), [gente]);
  const resumenPorId = useMemo(() => new Map(resumenes.map((r) => [r.otroId, r])), [resumenes]);

  // Conversaciones existentes, de la más nueva a la más vieja
  const conversaciones = useMemo(
    () =>
      [...resumenes]
        .sort((a, b) => b.ultimaHora.toMillis() - a.ultimaHora.toMillis())
        .filter((r) => porId.has(r.otroId)),
    [resumenes, porId]
  );

  // El resto de la gente, filtrada por el buscador
  const sinConversacion = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return (gente ?? [])
      .filter((u) => !resumenPorId.has(u.id))
      .filter((u) => (texto ? u.nombre.toLowerCase().includes(texto) : true))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [gente, resumenPorId, busqueda]);

  const abrir = (u: Usuario) =>
    router.push({
      pathname: '/conversacion',
      params: { otroId: u.id, otroNombre: u.nombre, otroTelefono: u.telefono },
    });

  if (!gente) {
    return (
      <PantallaBase titulo="Mensajes" alVolver={() => router.back()} scroll={false}>
        <View style={estilosBase.centrado}>
          <ActivityIndicator size="large" />
        </View>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase titulo="Mensajes" alVolver={() => router.back()}>
      {conversaciones.length > 0 && (
        <>
          <TituloSeccion titulo="Conversaciones" />
          {conversaciones.map((r) => {
            const u = porId.get(r.otroId)!;
            return (
              <Tarjeta key={r.otroId} onPress={() => abrir(u)}>
                <View style={styles.fila}>
                  <Retrato usuario={u} />
                  <View style={styles.datos}>
                    <Text variant="titleSmall" numberOfLines={1}>
                      {u.nombre}
                    </Text>
                    <Text variant="bodySmall" numberOfLines={1} style={estilosBase.tenue}>
                      {r.ultimoTexto}
                    </Text>
                  </View>
                  <View style={styles.derecha}>
                    <Text variant="labelSmall" style={estilosBase.tenue}>
                      {haceCuanto(r.ultimaHora)}
                    </Text>
                    {r.noLeidos > 0 ? (
                      <Badge style={{ backgroundColor: tema.colors.error }}>{r.noLeidos}</Badge>
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
        </>
      )}

      <TituloSeccion titulo="Escribirle a alguien" />

      <TextInput
        mode="outlined"
        placeholder="Buscar por nombre"
        value={busqueda}
        onChangeText={setBusqueda}
        left={<TextInput.Icon icon="magnify" />}
        outlineStyle={styles.campoRedondo}
      />

      {sinConversacion.length === 0 ? (
        <Tarjeta>
          <Text style={estilosBase.tenue}>
            {busqueda
              ? 'Nadie coincide con esa búsqueda.'
              : 'Ya tenés una conversación abierta con todos.'}
          </Text>
        </Tarjeta>
      ) : (
        sinConversacion.map((u) => (
          <Tarjeta key={u.id} onPress={() => abrir(u)}>
            <View style={styles.fila}>
              <Retrato usuario={u} />
              <View style={styles.datos}>
                <Text variant="titleSmall" numberOfLines={1}>
                  {u.nombre}
                </Text>
                <Text variant="bodySmall" style={estilosBase.tenue}>
                  {u.rol === 'conductor' ? 'Conductor' : 'Padre / Madre'}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={tema.colors.onSurfaceVariant}
              />
            </View>
          </Tarjeta>
        ))
      )}
    </PantallaBase>
  );
}

// Foto del usuario o, si no tiene, su inicial. El ícono cambia según el rol para
// distinguir de un vistazo a un conductor de un padre.
function Retrato({ usuario }: { usuario: Usuario }) {
  const tema = useTheme();

  if (usuario.foto) return <Avatar.Image size={46} source={{ uri: usuario.foto }} />;

  return (
    <Avatar.Icon
      size={46}
      icon={usuario.rol === 'conductor' ? 'bus' : 'account'}
      style={{
        backgroundColor:
          usuario.rol === 'conductor'
            ? tema.colors.primaryContainer
            : tema.colors.secondaryContainer,
      }}
      color={
        usuario.rol === 'conductor'
          ? tema.colors.onPrimaryContainer
          : tema.colors.onSecondaryContainer
      }
    />
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
  datos: { flex: 1, gap: 2 },
  derecha: { alignItems: 'flex-end', gap: 4 },
  campoRedondo: { borderRadius: RADIO.control },
});
