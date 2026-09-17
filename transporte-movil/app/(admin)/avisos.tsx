import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import TarjetaAviso from '@/components/TarjetaAviso';
import ChipFiltro from '@/components/ChipFiltro';
import Campo from '@/components/Campo';
import BotonPrincipal from '@/components/BotonPrincipal';
import TituloSeccion from '@/components/TituloSeccion';
import EstadoVacio from '@/components/EstadoVacio';
import AparicionSuave from '@/components/AparicionSuave';
import CargandoBus from '@/components/CargandoBus';
import { escucharAvisos, listarCanales, publicarAviso } from '@/services/canalesService';
import { notificarAvisoNuevo } from '@/services/notificacionesService';
import { ESPACIO, estilosBase } from '@/constants/estilos';
import type { Aviso, Canal } from '@/types/models';

// ============================================
// PUBLICAR UN AVISO (admin, desde el teléfono)
// ============================================
// Elegir canal, escribir y publicar. Nada más: los canales se crean y se editan
// en el panel web, acá solo se publica en los que ya existen — que es lo que
// hace falta cuando pasa algo y el admin no está frente a la computadora.
//
// LO QUE SE AGREGÓ AL DISEÑO:
//
// 1. LA VISTA PREVIA. Mientras escribe, el admin ve la tarjeta EXACTA que le va
//    a aparecer al padre en su inicio, armada con el mismo componente
//    (TarjetaAviso). Un aviso se publica una sola vez y les llega al teléfono a
//    decenas de familias: poder verlo antes es la diferencia entre corregir una
//    palabra y mandar un comunicado con un error a toda la escuela.
// 2. SE DICE A QUIÉN LE LLEGA, con el nombre de la escuela, antes de publicar.
// 3. EL CONTADOR DE CARACTERES aparece recién cuando el texto se hace largo:
//    un aviso larguísimo llega recortado en la notificación del teléfono.
// 4. La confirmación dejó de ser un renglón verde suelto: es una tarjeta con su
//    ícono, del mismo tono "cumplido" que usa toda la app.

// A partir de acá se avisa que el texto es largo (la notificación lo recorta)
const LARGO_COMODO = 220;

export default function AvisosAdminScreen() {
  const { usuario } = useAuth();
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
  const escrito = texto.trim();

  if (canales === null) {
    return (
      <PantallaBase titulo="Publicar aviso" scroll={false}>
        <View style={estilosBase.centrado}>
          <CargandoBus texto="Cargando los canales…" />
        </View>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase titulo="Publicar aviso" subtitulo={canalElegido?.nombre}>
      {canales.length === 0 ? (
        <EstadoVacio
          icono="bullhorn-outline"
          titulo="Todavía no hay canales"
          texto="Se crean desde el panel web, uno por escuela. Después podés publicar desde acá."
        />
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
            {/* A quién le llega, dicho antes de escribir y con el nombre real */}
            <View style={styles.filaDestino}>
              <MaterialCommunityIcons
                name="account-group"
                size={16}
                color={tema.colors.onSurfaceVariant}
              />
              <Text variant="bodySmall" style={[estilosBase.tenue, styles.textoFlexible]}>
                Lo van a ver en el inicio de la app todos los padres con un hijo en{' '}
                {canalElegido?.nombre ?? 'la escuela'}.
              </Text>
            </View>

            <Campo
              placeholder="Ej: Mañana no hay clases por reunión de maestros."
              value={texto}
              onChangeText={(t) => {
                setTexto(t);
                setExito('');
              }}
              multiline
              numberOfLines={5}
              style={styles.campo}
            />

            {/* El contador aparece recién cuando el texto se hace largo: si
                estuviera siempre, parecería un límite que no existe */}
            {escrito.length > LARGO_COMODO && (
              <Text variant="labelSmall" style={[estilosBase.tenue, styles.contador]}>
                {escrito.length} caracteres · en la notificación del teléfono se va a ver
                recortado
              </Text>
            )}

            {!!error && (
              <Text variant="bodySmall" style={{ color: tema.colors.error }}>
                {error}
              </Text>
            )}

            <BotonPrincipal
              texto="Publicar aviso"
              icono="send"
              onPress={publicar}
              cargando={publicando}
              deshabilitado={publicando || !escrito}
            />
          </Tarjeta>

          {/* Confirmación de lo último publicado */}
          {!!exito && (
            <Tarjeta>
              <View style={styles.filaExito}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={20}
                  color={tema.colors.secondary}
                />
                <Text variant="bodyMedium" style={[styles.textoFlexible, { color: tema.colors.secondary }]}>
                  {exito}
                </Text>
              </View>
            </Tarjeta>
          )}

          {/* ============================================================
              CÓMO LO VA A VER EL PADRE
              ============================================================
              La misma tarjeta que se dibuja en el inicio del padre, con el
              texto que se está escribiendo. Solo aparece mientras hay algo
              escrito: vacía no enseñaría nada. */}
          {!!escrito && (
            <>
              <TituloSeccion titulo="Así lo van a ver" />
              <TarjetaAviso
                aviso={{
                  id: 'vista-previa',
                  canalId: canalId ?? '',
                  texto: escrito,
                  de: usuario?.id ?? '',
                  hora: Timestamp.now(),
                }}
                canalNombre={canalElegido?.nombre}
              />
            </>
          )}

          <TituloSeccion
            titulo="Publicados en este canal"
            detalle={avisos.length > 0 ? `${avisos.length}` : undefined}
          />
          {avisos.length === 0 ? (
            <EstadoVacio
              icono="text-box-outline"
              titulo="Todavía no publicaste nada acá"
              texto="Lo que publiques va a quedar listado debajo, del más nuevo al más viejo."
            />
          ) : (
            avisos.slice(0, 10).map((a, indice) => (
              <AparicionSuave key={a.id} indice={indice}>
                <TarjetaAviso aviso={a} canalNombre={canalElegido?.nombre} lineas={5} />
              </AparicionSuave>
            ))
          )}
        </>
      )}
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  filaDestino: { flexDirection: 'row', alignItems: 'flex-start', gap: ESPACIO.minimo },
  textoFlexible: { flex: 1 },
  campo: { maxHeight: 180 },
  contador: { textAlign: 'right' },
  filaExito: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
});
