import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import ListaBandeja from '@/components/ListaBandeja';
import ChipFiltro from '@/components/ChipFiltro';
import Campo from '@/components/Campo';
import CargandoBus from '@/components/CargandoBus';
import {
  escucharBandeja,
  listarUsuarios,
  type ResumenConversacion,
} from '@/services/mensajesService';
import { estilosBase } from '@/constants/estilos';
import { armarBandeja, totalSinLeer, type ContactoBandeja } from '@/utils/bandeja';
import type { Usuario } from '@/types/models';

// ============================================
// BANDEJA DEL ADMIN
// ============================================
// Es la pantalla de la app con MÁS elementos por lejos: la administración habla
// con TODOS los padres y TODOS los conductores. Con la empresa creciendo son
// cientos de filas.
//
// El rendimiento (lista virtualizada) y el orden (sin leer primero, después las
// conversaciones, después el resto) ahora son de los tres roles y viven en
// components/ListaBandeja.tsx y utils/bandeja.ts. Lo único propio de esta
// pantalla es el FILTRO POR ROL: "escribirle a un conductor" y "escribirle a un
// padre" son dos tareas distintas, y el admin siempre sabe cuál de las dos está
// haciendo.

type FiltroRol = 'todos' | 'padre' | 'conductor';

export default function MensajesAdminScreen() {
  const { usuario } = useAuth();
  const router = useRouter();

  const [gente, setGente] = useState<Usuario[] | null>(null);
  const [resumenes, setResumenes] = useState<ResumenConversacion[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState<FiltroRol>('todos');

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

  // La gente del filtro elegido, traducida a la forma que entiende la bandeja.
  // El conductor va en zafiro y el padre en esmeralda: en una lista de cientos
  // de nombres, el color dice de quién se trata antes de leer.
  const contactos = useMemo<ContactoBandeja[]>(
    () =>
      (gente ?? [])
        .filter((u) => filtroRol === 'todos' || u.rol === filtroRol)
        .map((u) => ({
          id: u.id,
          nombre: u.nombre,
          telefono: u.telefono,
          papel: u.rol === 'conductor' ? 'Conductor' : 'Padre / Madre',
          icono: u.rol === 'conductor' ? ('bus' as const) : ('account' as const),
          foto: u.foto,
          tono: u.rol === 'conductor' ? ('marca' as const) : ('alterno' as const),
        })),
    [gente, filtroRol]
  );

  const filas = useMemo(
    () =>
      armarBandeja(contactos, resumenes, {
        busqueda,
        vacio: 'Todavía no hay usuarios con quienes hablar. Se crean desde el panel web.',
      }),
    [contactos, resumenes, busqueda]
  );

  const sinLeer = totalSinLeer(resumenes);

  if (!gente) {
    return (
      <PantallaBase titulo="Mensajes" scroll={false}>
        <View style={estilosBase.centrado}>
          <CargandoBus texto="Cargando las conversaciones…" />
        </View>
      </PantallaBase>
    );
  }

  const totalPadres = gente.filter((u) => u.rol === 'padre').length;
  const totalConductores = gente.filter((u) => u.rol === 'conductor').length;

  return (
    <PantallaBase
      titulo="Mensajes"
      subtitulo={sinLeer > 0 ? `${sinLeer} sin leer` : `${gente.length} contactos`}
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
          <>
            <Campo
              placeholder="Buscar por nombre o teléfono"
              value={busqueda}
              onChangeText={setBusqueda}
              // Los adornos son los de Paper: `Campo` solo envuelve al TextInput
              // con el aspecto del sistema de diseño, no redefine sus estáticos
              left={<TextInput.Icon icon="magnify" />}
              right={
                busqueda ? <TextInput.Icon icon="close" onPress={() => setBusqueda('')} /> : undefined
              }
            />
            <ChipFiltro
              opciones={[
                { id: 'todos', etiqueta: 'Todos', detalle: `${gente.length}` },
                { id: 'padre', etiqueta: 'Padres', detalle: `${totalPadres}` },
                { id: 'conductor', etiqueta: 'Conductores', detalle: `${totalConductores}` },
              ]}
              seleccionadaId={filtroRol}
              onSeleccionar={(id) => setFiltroRol(id as FiltroRol)}
            />
          </>
        }
      />
    </PantallaBase>
  );
}
