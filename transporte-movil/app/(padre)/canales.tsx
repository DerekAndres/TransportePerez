import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import ListaAvisos from '@/components/ListaAvisos';
import CargandoBus from '@/components/CargandoBus';
import { escucharAvisosDeCanales, listarCanalesDeEscuelas } from '@/services/canalesService';
import { listarHijos } from '@/services/padreService';
import { estilosBase } from '@/constants/estilos';
import type { Aviso, Canal } from '@/types/models';

// ============================================
// AVISOS DEL PADRE
// ============================================
// Los comunicados de la administración para las escuelas de sus hijos, del más
// nuevo al más viejo. El padre NO se inscribe a nada: recibe el canal de la
// escuela de cada hijo, y si un hijo cambia de escuela entra y sale del canal
// solo.
//
// Se muestran los AVISOS, no los canales: entrar a "Avisos" y encontrar una
// lista de canales que hay que abrir uno por uno agrega un paso para nada. La
// lista (agrupada por fecha, con el contador de lo nuevo) es la misma que ve el
// conductor — vive en components/ListaAvisos.tsx.
export default function CanalesScreen() {
  const { usuario } = useAuth();

  const [canales, setCanales] = useState<Canal[] | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  useEffect(() => {
    if (!usuario) return;
    let cancelado = false;
    (async () => {
      try {
        const hijos = await listarHijos(usuario.id);
        // Escuelas distintas de sus hijos (dos hijos en la misma escuela = un canal)
        const escuelaIds = [
          ...new Set(hijos.map((h) => h.escuelaId).filter((x): x is string => !!x)),
        ];
        const lista = await listarCanalesDeEscuelas(escuelaIds);
        if (!cancelado) setCanales(lista);
      } catch {
        if (!cancelado) setCanales([]);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [usuario]);

  // Avisos de todos sus canales, en vivo. La clave es una cadena y no el
  // arreglo: así el efecto se rehace cuando cambian los canales DE VERDAD y no
  // en cada render.
  const clavesCanales = (canales ?? []).map((c) => c.id).join(',');
  useEffect(
    // Sin canales, el servicio ya devuelve la lista vacía y una baja que no
    // hace nada, así que no hace falta el caso especial acá. Además evita tocar
    // el estado dentro del cuerpo del efecto, que provoca renders en cascada.
    () => escucharAvisosDeCanales(clavesCanales ? clavesCanales.split(',') : [], setAvisos),
    [clavesCanales]
  );

  if (canales === null) {
    return (
      <PantallaBase titulo="Avisos" scroll={false}>
        <View style={estilosBase.centrado}>
          <CargandoBus texto="Cargando los avisos…" />
        </View>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase titulo="Avisos" subtitulo="Comunicados de la administración">
      <ListaAvisos
        canales={canales}
        avisos={avisos}
        tituloVacio={
          canales.length === 0 ? 'Todavía no hay canal de avisos' : 'Todavía no hay avisos'
        }
        textoVacio={
          canales.length === 0
            ? 'Cuando la administración abra el canal de la escuela de tu hijo, los comunicados te aparecen acá.'
            : 'Cuando la administración publique un comunicado de la escuela, te aparece acá y te llega al teléfono.'
        }
      />
    </PantallaBase>
  );
}
