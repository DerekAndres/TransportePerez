import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import ListaBandeja from '@/components/ListaBandeja';
import CargandoBus from '@/components/CargandoBus';
import { listarContactosPadre } from '@/services/padreService';
import { escucharBandeja, type ResumenConversacion } from '@/services/mensajesService';
import { estilosBase } from '@/constants/estilos';
import { armarBandeja, totalSinLeer, type ContactoBandeja } from '@/utils/bandeja';

// ============================================
// MENSAJES DEL PADRE
// ============================================
// Le puede escribir a la administración y al conductor (o conductores) de las
// rutas de sus hijos. Son POCOS contactos, así que acá no hay buscador ni
// filtros: agregarle controles a una lista de tres nombres es exactamente el
// tipo de cosa que el padre no tiene que aprender (CLAUDE.md §1-bis).
//
// El orden, la fila y el aspecto de "sin leer" son los mismos de los tres roles
// (utils/bandeja.ts y components/FilaConversacion.tsx).
export default function MensajesPadreScreen() {
  const { usuario } = useAuth();
  const router = useRouter();

  const [contactos, setContactos] = useState<ContactoBandeja[] | null>(null);
  const [resumenes, setResumenes] = useState<ResumenConversacion[]>([]);

  // Con quién puede hablar (una sola vez)
  useEffect(() => {
    if (!usuario) return;
    let cancelado = false;
    listarContactosPadre(usuario.id)
      .then(({ conductores, admin }) => {
        if (cancelado) return;
        const lista: ContactoBandeja[] = [];
        if (admin) {
          lista.push({
            id: admin.id,
            nombre: 'Administración',
            telefono: admin.telefono,
            papel: 'Inversiones Perez',
            icono: 'office-building',
            tono: 'marca',
            prioritario: true,
          });
        }
        conductores.forEach((c) =>
          lista.push({
            id: c.id,
            nombre: c.nombre,
            telefono: c.telefono,
            papel: 'Conductor de la ruta',
            icono: 'bus',
            foto: c.foto,
            tono: 'marca',
          })
        );
        setContactos(lista);
      })
      .catch(() => {
        if (!cancelado) setContactos([]);
      });
    return () => {
      cancelado = true;
    };
  }, [usuario]);

  // El último mensaje y los no leídos de cada conversación, en vivo
  useEffect(() => {
    if (!usuario) return;
    return escucharBandeja(usuario.id, setResumenes);
  }, [usuario]);

  const filas = useMemo(
    () =>
      armarBandeja(contactos ?? [], resumenes, {
        vacio: 'Todavía no hay con quién chatear.',
      }),
    [contactos, resumenes]
  );

  const sinLeer = totalSinLeer(resumenes);

  if (!contactos) {
    return (
      <PantallaBase titulo="Mensajes" scroll={false}>
        <View style={estilosBase.centrado}>
          <CargandoBus texto="Cargando las conversaciones…" />
        </View>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase
      titulo="Mensajes"
      // El subtítulo contesta de entrada la única pregunta con la que se abre
      // esta pantalla: ¿me contestaron?
      subtitulo={
        sinLeer > 0
          ? `${sinLeer} sin leer`
          : 'Escribile al conductor o a la administración'
      }
      scroll={false}
    >
      <ListaBandeja
        filas={filas}
        onAbrir={(contacto) =>
          router.push({
            pathname: '/conversacion',
            params: {
              otroId: contacto.id,
              otroNombre: contacto.nombre,
              otroTelefono: contacto.telefono,
            },
          })
        }
        encabezado={
          contactos.length === 0 ? (
            <Text variant="bodyMedium" style={estilosBase.tenue}>
              Acá van a aparecer la administración y el conductor de la ruta de tu hijo.
            </Text>
          ) : undefined
        }
      />
    </PantallaBase>
  );
}
