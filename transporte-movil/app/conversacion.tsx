import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  IconButton,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import {
  escucharConversacion,
  idConversacion,
  enviarMensaje,
  marcarLeidos,
} from '@/services/mensajesService';
import { notificarMensajeNuevo } from '@/services/notificacionesService';
import { ESPACIO, RADIO, estilosBase, fondoTarjeta } from '@/constants/estilos';
import type { Mensaje } from '@/types/models';

// Pantalla de chat, compartida por padre y conductor (el chat es igual para
// ambos: solo cambia con quién se habla, que llega por parámetros). Vive en la
// raíz para no duplicarla en cada grupo de rutas.
export default function ConversacionScreen() {
  const { usuario } = useAuth();
  const router = useRouter();
  const tema = useTheme();
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
      notificarMensajeNuevo(params.otroId, usuario.nombre, limpio).catch(() => {});
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
    <TouchableRipple onPress={llamar} borderless style={styles.botonLlamar} accessibilityLabel="Llamar">
      <MaterialCommunityIcons name="phone" size={22} color={tema.colors.primary} />
    </TouchableRipple>
  ) : undefined;

  return (
    <PantallaBase
      titulo={params.otroNombre}
      alVolver={() => router.back()}
      accionDerecha={botonLlamar}
      scroll={false}
    >
      <KeyboardAvoidingView
        style={estilosBase.pantalla}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {!mensajes ? (
          <View style={estilosBase.centrado}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.lista}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {mensajes.length === 0 && (
              <Text variant="bodySmall" style={styles.vacio}>
                No hay mensajes todavía. Escribí el primero.
              </Text>
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
                  <Text style={mio ? { color: tema.colors.onPrimary } : undefined}>{m.texto}</Text>
                  <Text
                    variant="labelSmall"
                    style={[
                      styles.hora,
                      mio ? { color: tema.colors.onPrimary, opacity: 0.7 } : styles.horaOtro,
                    ]}
                  >
                    {horaCorta(m)}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        <View style={[styles.barraEnvio, { borderTopColor: tema.colors.outlineVariant }]}>
          <TextInput
            mode="outlined"
            placeholder="Escribí un mensaje"
            value={texto}
            onChangeText={setTexto}
            style={styles.entrada}
            outlineStyle={styles.campoRedondo}
            multiline
            onSubmitEditing={enviar}
            returnKeyType="send"
          />
          <IconButton
            icon="send"
            mode="contained"
            disabled={!texto.trim() || enviando}
            onPress={enviar}
            accessibilityLabel="Enviar"
          />
        </View>
      </KeyboardAvoidingView>
    </PantallaBase>
  );
}

// Hora "H:mm" del mensaje. El último enviado localmente ya trae Timestamp.now().
function horaCorta(m: Mensaje): string {
  const fecha = m.hora.toDate();
  return `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  lista: { paddingHorizontal: ESPACIO.pantalla, paddingBottom: ESPACIO.interno, gap: 8 },
  vacio: { textAlign: 'center', opacity: 0.6, marginTop: 24 },
  burbuja: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, maxWidth: '82%' },
  burbujaMia: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  burbujaOtro: { alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  hora: { marginTop: 2, alignSelf: 'flex-end' },
  horaOtro: { opacity: 0.5 },
  barraEnvio: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingHorizontal: ESPACIO.interno,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  entrada: { flex: 1, maxHeight: 120 },
  campoRedondo: { borderRadius: RADIO.control },
  botonLlamar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
