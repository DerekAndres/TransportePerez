import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import ListaBandeja from '@/components/ListaBandeja';
import Campo from '@/components/Campo';
import CargandoBus from '@/components/CargandoBus';
import { listarContactosConductor } from '@/services/conductorService';
import { escucharBandeja, type ResumenConversacion } from '@/services/mensajesService';
import { estilosBase } from '@/constants/estilos';
import { armarBandeja, totalSinLeer, type ContactoBandeja } from '@/utils/bandeja';

// ============================================
// MENSAJES DEL CONDUCTOR
// ============================================
// Le puede escribir a la administración y a los padres de los niños que lleva.
// A diferencia del padre, acá la lista puede ser LARGA: un bus con cuarenta
// niños son cerca de cuarenta padres. Por eso esta pantalla sí tiene buscador —
// aparece solo cuando hace falta, para que un conductor con seis contactos no
// se encuentre con un control que no necesita.
//
// El buscador importa por el caso real de esta pantalla: el conductor no entra
// a "ver sus mensajes", entra a escribirle a UN padre concreto porque el niño
// no estaba en la parada. Sin buscador, eso es desplazarse por cuarenta nombres
// con el teléfono en el soporte.
const MINIMO_PARA_BUSCADOR = 8;

export default function MensajesConductorScreen() {
  const { usuario } = useAuth();
  const router = useRouter();

  const [contactos, setContactos] = useState<ContactoBandeja[] | null>(null);
  const [resumenes, setResumenes] = useState<ResumenConversacion[]>([]);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (!usuario) return;
    let cancelado = false;
    listarContactosConductor(usuario.id)
      .then(({ padres, admin }) => {
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
        padres.forEach((p) =>
          lista.push({
            id: p.id,
            nombre: p.nombre,
            telefono: p.telefono,
            papel: 'Padre / Madre',
            icono: 'account',
            foto: p.foto,
            tono: 'alterno',
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

  useEffect(() => {
    if (!usuario) return;
    return escucharBandeja(usuario.id, setResumenes);
  }, [usuario]);

  const filas = useMemo(
    () =>
      armarBandeja(contactos ?? [], resumenes, {
        busqueda,
        vacio: 'Todavía no hay con quién chatear. Van a aparecer la administración y los padres de tu ruta.',
      }),
    [contactos, resumenes, busqueda]
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
      subtitulo={sinLeer > 0 ? `${sinLeer} sin leer` : `${contactos.length} contactos`}
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
          contactos.length >= MINIMO_PARA_BUSCADOR ? (
            <Campo
              placeholder="Buscar un padre por nombre o teléfono"
              value={busqueda}
              onChangeText={setBusqueda}
              // Los adornos son los de Paper: `Campo` solo envuelve al TextInput
              // con el aspecto del sistema de diseño, no redefine sus estáticos
              left={<TextInput.Icon icon="magnify" />}
              right={
                busqueda ? <TextInput.Icon icon="close" onPress={() => setBusqueda('')} /> : undefined
              }
            />
          ) : undefined
        }
      />
    </PantallaBase>
  );
}
