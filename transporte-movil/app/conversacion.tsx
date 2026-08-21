import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import { useAlturaTeclado } from '@/hooks/use-teclado';
import {
  escucharConversacion,
  idConversacion,
  enviarMensaje,
  marcarLeidos,
} from '@/services/mensajesService';
import { notificarMensajeNuevo } from '@/services/notificacionesService';
import { ESPACIO, RADIO, estilosBase, fondoTarjeta } from '@/constants/estilos';
import { horaCorta } from '@/utils/tiempo';
import type { Mensaje } from '@/types/models';

// Pantalla de chat, compartida por padre y conductor (el chat es igual para
// ambos: solo cambia con quién se habla, que llega por parámetros). Vive en la
// raíz para no duplicarla en cada grupo de rutas.
//
// EL TECLADO: acá está el problema clásico de un chat — al escribir, el teclado
// tapa el campo y el botón de enviar. Se resuelve con el hook
// `useAlturaTeclado`, que dice cuántos píxeles hay que levantar el contenido en
// ESTE teléfono (ver hooks/use-teclado.ts). Ese valor se aplica como espacio
// abajo de todo el chat: la lista de mensajes se achica y la barra de escribir
// queda siempre justo encima del teclado. Cuando el teclado está cerrado, ese
// espacio lo ocupa el inset de la barra de navegación del sistema, así que la
// barra de escribir tampoco queda debajo de los botones de Android.
export default function ConversacionScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();
  const insets = useSafeAreaInsets();
  const altoTeclado = useAlturaTeclado();
  const params = useLocalSearchParams<{
    otroId: string;
    otroNombre: string;
    otroTelefono?: string;
  }>();

  const [mensajes, setMensajes] = useState<Mensaje[] | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const miId = usuario?.id ?? '';
  const conversacionId = useMemo(
    () => (miId && params.otroId ? idConversacion(miId, params.otroId) : ''),
    [miId, params.otroId]
  );

  // Suscripción en vivo + marcar como leídos lo que me llega mientras miro el chat
  useEffect(() => {
    if (!conversacionId) return;
    const unsub = escucharConversacion(conversacionId, miId, (msgs) => {
      setMensajes(msgs);
      marcarLeidos(msgs, miId).catch(() => {});
    });
    return unsub;
  }, [conversacionId, miId]);

  // Al abrirse el teclado, bajar al último mensaje: si no, el que estabas
  // leyendo queda tapado por el propio teclado
  useEffect(() => {
    if (altoTeclado > 0) {
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      return () => clearTimeout(t);
    }
  }, [altoTeclado]);

  // Esta pantalla está fuera de los layouts protegidos por rol: si no hay sesión,
  // de vuelta al login (cualquier usuario logueado puede chatear)
  if (!usuario) return <Redirect href="/login" />;

  const enviar = async () => {
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    setTexto(''); // se limpia ya; el mensaje aparece solo por el onSnapshot
    try {
      await enviarMensaje(miId, params.otroId, limpio);
      // Aviso push al destinatario por si tiene la app cerrada (Fase 6)
      notificarMensajeNuevo(params.otroId, miId, usuario.nombre, limpio).catch(() => {});
    } catch {
      setTexto(limpio); // si falló, se devuelve el texto para reintentar
    } finally {
      setEnviando(false);
    }
  };

  const llamar = () => {
    if (params.otroTelefono) Linking.openURL(`tel:${params.otroTelefono}`).catch(() => {});
  };

  // Complemento a la mensajería: llamada directa (el informe lo contempla)
  const botonLlamar = params.otroTelefono ? (
    <TouchableRipple
      onPress={llamar}
      borderless
      style={[styles.botonLlamar, { backgroundColor: tema.colors.primaryContainer }]}
      accessibilityLabel="Llamar"
    >
      <MaterialCommunityIcons name="phone" size={20} color={tema.colors.onPrimaryContainer} />
    </TouchableRipple>
  ) : undefined;

  const puedeEnviar = !!texto.trim() && !enviando;

  return (
    <PantallaBase
      titulo={params.otroNombre}
      alVolver={() => router.back()}
      accionDerecha={botonLlamar}
      scroll={false}
    >
      {/* Todo el chat se levanta lo que mida el teclado */}
      <View style={[estilosBase.pantalla, { paddingBottom: altoTeclado }]}>
        {!mensajes ? (
          <View style={estilosBase.centrado}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            // flex:1 explícito: la lista ocupa el alto que sobra y la barra de
            // escribir queda anclada abajo, nunca empujada fuera de la pantalla
            style={estilosBase.pantalla}
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
            // Permite tocar "enviar" con el teclado abierto sin que el primer
            // toque se gaste en cerrarlo
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {mensajes.length === 0 && (
              <View style={styles.vacio}>
                <View style={[styles.circuloVacio, { backgroundColor: tema.colors.surfaceVariant }]}>
                  <MaterialCommunityIcons
                    name="message-text-outline"
                    size={26}
                    color={tema.colors.onSurfaceVariant}
                  />
                </View>
                <Text variant="bodyMedium" style={estilosBase.tenue}>
                  No hay mensajes todavía. Escribí el primero.
                </Text>
              </View>
            )}
            {mensajes.map((m) => {
              const mio = m.de === miId;
              return (
                <View
                  key={m.id}
                  style={[
                    styles.burbuja,
                    mio
                      ? [styles.burbujaMia, { backgroundColor: tema.colors.primary }]
                      : [styles.burbujaOtro, { backgroundColor: fondoTarjeta(tema) }],
                  ]}
                >
                  <Text
                    style={[styles.textoMensaje, mio ? { color: tema.colors.onPrimary } : undefined]}
                  >
                    {m.texto}
                  </Text>
                  <Text
                    variant="labelSmall"
                    style={[
                      styles.hora,
                      mio ? { color: tema.colors.onPrimary, opacity: 0.7 } : styles.horaOtro,
                    ]}
                  >
                    {horaCorta(m.hora)}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Barra de escribir. Con el teclado cerrado se separa de la barra de
            navegación del teléfono; con el teclado abierto va pegada a él. */}
        <View
          style={[
            styles.barraEnvio,
            {
              backgroundColor: tema.colors.background,
              borderTopColor: tema.colors.outlineVariant,
              paddingBottom: altoTeclado > 0 ? ESPACIO.interno : insets.bottom + ESPACIO.interno,
            },
          ]}
        >
          <TextInput
            mode="outlined"
            placeholder="Escribí un mensaje"
            value={texto}
            onChangeText={setTexto}
            style={[styles.entrada, { backgroundColor: fondoTarjeta(tema) }]}
            outlineStyle={[styles.campoRedondo, { borderColor: tema.colors.outlineVariant }]}
            multiline
          />
          {/* Botón circular grande: es el destino más frecuente del dedo en esta
              pantalla, así que tiene que ser fácil de acertar */}
          <TouchableRipple
            onPress={enviar}
            disabled={!puedeEnviar}
            borderless
            style={[
              styles.botonEnviar,
              {
                backgroundColor: puedeEnviar ? tema.colors.primary : tema.colors.surfaceVariant,
              },
            ]}
            accessibilityLabel="Enviar"
          >
            <MaterialCommunityIcons
              name="send"
              size={21}
              color={puedeEnviar ? tema.colors.onPrimary : tema.colors.onSurfaceVariant}
            />
          </TouchableRipple>
        </View>
      </View>
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  lista: {
    paddingHorizontal: ESPACIO.pantalla,
    paddingTop: ESPACIO.minimo,
    paddingBottom: ESPACIO.interno,
    gap: 8,
  },
  vacio: { alignItems: 'center', gap: ESPACIO.interno, marginTop: 40 },
  circuloVacio: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  burbuja: { paddingHorizontal: 15, paddingVertical: 11, borderRadius: 22, maxWidth: '82%' },
  // La esquina "mordida" del lado de quien habla es lo que hace que se lea como
  // una conversación y no como dos listas de cajas
  burbujaMia: { alignSelf: 'flex-end', borderBottomRightRadius: 7 },
  burbujaOtro: { alignSelf: 'flex-start', borderBottomLeftRadius: 7 },
  textoMensaje: { lineHeight: 21 },
  hora: { marginTop: 3, alignSelf: 'flex-end' },
  horaOtro: { opacity: 0.5 },
  barraEnvio: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: ESPACIO.interno,
    paddingTop: ESPACIO.interno,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  entrada: { flex: 1, maxHeight: 120 },
  campoRedondo: { borderRadius: RADIO.control },
  botonEnviar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  botonLlamar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
