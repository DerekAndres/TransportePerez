import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import TarjetaAviso from '@/components/TarjetaAviso';
import ChipFiltro from '@/components/ChipFiltro';
import BotonPrincipal from '@/components/BotonPrincipal';
import TituloSeccion from '@/components/TituloSeccion';
import { escucharAvisos, listarCanales, publicarAviso } from '@/services/canalesService';
import { notificarAvisoNuevo } from '@/services/notificacionesService';
import { ESPACIO, RADIO, estilosBase } from '@/constants/estilos';
import type { Aviso, Canal } from '@/types/models';

// ============================================
// PUBLICAR UN AVISO (admin, desde el teléfono)
// ============================================
// Elegir canal, escribir y publicar. Nada más: los canales se crean y se editan
// en el panel web, acá solo se publica en los que ya existen — que es lo que
// hace falta cuando pasa algo y el admin no está frente a la computadora.
//
// Debajo del formulario se ven los avisos ya publicados en ese canal, en vivo,
// para no repetir uno que ya se mandó.
export default function AvisosAdminScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();

  const [canales, setCanales] = useState<Canal[] | null>(null);
  const [canalId, setCanalId] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  useEffect(() => {
    let cancelado = false;
    listarCanales()
      .then((lista) => {
        if (cancelado) return;
        setCanales(lista);
        // Se preselecciona el primero: con un solo canal (el caso normal) no hay
        // nada que elegir
        if (lista.length > 0) setCanalId(lista[0].id);
      })
      .catch(() => {
        if (!cancelado) setCanales([]);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // Avisos del canal elegido, en vivo
  useEffect(() => {
    if (!canalId) {
      setAvisos([]);
      return;
    }
    return escucharAvisos(canalId, setAvisos);
  }, [canalId]);

  const publicar = async () => {
    const limpio = texto.trim();
    setError('');
    setExito('');
    if (!canalId) {
      setError('Elegí a qué canal va el aviso.');
      return;
    }
    if (limpio.length < 5) {
      setError('Escribí el aviso antes de publicarlo.');
      return;
    }
    if (!usuario) return;

    setPublicando(true);
    try {
      await publicarAviso(canalId, limpio, usuario.id);
      setTexto('');
      setExito('Aviso publicado. Les llega al teléfono aunque tengan la app cerrada.');
      // Push a los padres de la escuela del canal. Va DESPUÉS de publicar y sin
      // await: el aviso ya quedó guardado, y si el envío falla no tiene sentido
      // decirle al admin que no se publicó (la cola lo reintenta sola).
      const canal = canales?.find((c) => c.id === canalId);
      if (canal) {
        notificarAvisoNuevo(canal.id, canal.nombre, canal.escuelaId, limpio).catch(() => {});
      }
    } catch {
      setError('No se pudo publicar. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setPublicando(false);
    }
  };

  const canalElegido = canales?.find((c) => c.id === canalId);

  if (canales === null) {
    return (
      <PantallaBase titulo="Publicar aviso" alVolver={() => router.back()} scroll={false}>
        <View style={estilosBase.centrado}>
          <ActivityIndicator size="large" />
        </View>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase
      titulo="Publicar aviso"
      subtitulo={canalElegido?.nombre}
      alVolver={() => router.back()}
    >
      {canales.length === 0 ? (
        <Tarjeta>
          <View style={styles.filaSimple}>
            <View style={[styles.circulo, { backgroundColor: tema.colors.surfaceVariant }]}>
              <MaterialCommunityIcons
                name="bullhorn-outline"
                size={20}
                color={tema.colors.onSurfaceVariant}
              />
            </View>
            <Text style={[estilosBase.tenue, styles.texto]}>
              Todavía no hay canales. Se crean desde el panel web, uno por escuela.
            </Text>
          </View>
        </Tarjeta>
      ) : (
        <>
          {/* Con más de una escuela, se elige a cuál va */}
          {canales.length > 1 && (
            <ChipFiltro
              opciones={canales.map((c) => ({ id: c.id, etiqueta: c.nombre }))}
              seleccionadaId={canalId}
              onSeleccionar={(id) => {
                setCanalId(id);
                setExito('');
              }}
            />
          )}

          <Tarjeta>
            <Text variant="titleSmall">¿Qué querés avisar?</Text>
            <Text variant="bodySmall" style={estilosBase.tenue}>
              Lo van a ver en el inicio de la app todos los padres con un hijo en{' '}
              {canalElegido?.nombre ?? 'la escuela'}.
            </Text>

            <TextInput
              mode="outlined"
              placeholder="Ej: Mañana no hay clases por reunión de maestros."
              value={texto}
              onChangeText={(t) => {
                setTexto(t);
                setExito('');
              }}
              multiline
              numberOfLines={5}
              style={styles.campo}
              outlineStyle={styles.campoRedondo}
            />

            <HelperText type="error" visible={!!error}>
              {error}
            </HelperText>
            {!!exito && (
              <View style={styles.filaExito}>
                <MaterialCommunityIcons name="check-circle" size={16} color={tema.colors.secondary} />
                <Text variant="bodySmall" style={{ color: tema.colors.secondary }}>
                  {exito}
                </Text>
              </View>
            )}

            <BotonPrincipal
              texto="Publicar aviso"
              icono="send"
              onPress={publicar}
              cargando={publicando}
              deshabilitado={publicando || !texto.trim()}
            />
          </Tarjeta>

          <TituloSeccion titulo="Publicados en este canal" />
          {avisos.length === 0 ? (
            <Tarjeta>
              <Text style={estilosBase.tenue}>Todavía no publicaste nada en este canal.</Text>
            </Tarjeta>
          ) : (
            avisos
              .slice(0, 10)
              .map((a) => (
                <TarjetaAviso key={a.id} aviso={a} canalNombre={canalElegido?.nombre} lineas={5} />
              ))
          )}
        </>
      )}
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  filaSimple: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
  circulo: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  texto: { flex: 1 },
  campo: { maxHeight: 180 },
  campoRedondo: { borderRadius: RADIO.control },
  filaExito: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
