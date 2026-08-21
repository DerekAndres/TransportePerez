import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import Tarjeta from '@/components/Tarjeta';
import TarjetaAviso from '@/components/TarjetaAviso';
import ChipFiltro from '@/components/ChipFiltro';
import { escucharAvisosDeCanales, listarCanalesDeEscuelas } from '@/services/canalesService';
import { listarHijos } from '@/services/padreService';
import { estilosBase } from '@/constants/estilos';
import type { Aviso, Canal } from '@/types/models';

// ============================================
// AVISOS (pantalla completa)
// ============================================
// Los comunicados de la administración para las escuelas de los hijos, del más
// nuevo al más viejo. El padre NO se inscribe a nada: recibe el canal de la
// escuela de cada hijo, y si un hijo cambia de escuela entra y sale del canal
// solo.
//
// Se muestran los AVISOS, no los canales: entrar a "Avisos" y encontrar una
// lista de canales que hay que abrir uno por uno agrega un paso para nada.
// Cuando hay más de una escuela, las pastillas de arriba filtran por canal.

// Valor del filtro cuando no se filtra por ningún canal en particular
const TODOS = 'todos';

export default function CanalesScreen() {
  const { usuario } = useAuth();
  const tema = useTheme();

  const [canales, setCanales] = useState<Canal[] | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [filtro, setFiltro] = useState<string>(TODOS);

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

  // Avisos de todos sus canales, en vivo
  const clavesCanales = (canales ?? []).map((c) => c.id).join(',');
  useEffect(() => {
    const ids = clavesCanales ? clavesCanales.split(',') : [];
    if (ids.length === 0) {
      setAvisos([]);
      return;
    }
    return escucharAvisosDeCanales(ids, setAvisos);
  }, [clavesCanales]);

  const nombrePorCanal = useMemo(
    () => new Map((canales ?? []).map((c) => [c.id, c.nombre])),
    [canales]
  );

  const visibles = filtro === TODOS ? avisos : avisos.filter((a) => a.canalId === filtro);

  if (canales === null) {
    return (
      <PantallaBase titulo="Avisos" scroll={false}>
        <View style={estilosBase.centrado}>
          <ActivityIndicator size="large" />
        </View>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase titulo="Avisos" subtitulo="Comunicados de la administración">
      {/* Con dos o más escuelas, se puede mirar una sola */}
      {canales.length > 1 && (
        <ChipFiltro
          opciones={[
            { id: TODOS, etiqueta: 'Todos' },
            ...canales.map((c) => ({ id: c.id, etiqueta: c.nombre })),
          ]}
          seleccionadaId={filtro}
          onSeleccionar={setFiltro}
        />
      )}

      {visibles.length === 0 && (
        <Tarjeta>
          <View style={estilosBase.filaEntre}>
            <Text style={[estilosBase.tenue, { flex: 1 }]}>
              {canales.length === 0
                ? 'Todavía no hay canales de avisos para la escuela de tus hijos.'
                : 'Todavía no hay avisos publicados.'}
            </Text>
            <MaterialCommunityIcons
              name="bullhorn-outline"
              size={22}
              color={tema.colors.onSurfaceVariant}
            />
          </View>
        </Tarjeta>
      )}

      {visibles.map((a) => (
        <TarjetaAviso key={a.id} aviso={a} canalNombre={nombrePorCanal.get(a.canalId)} />
      ))}
    </PantallaBase>
  );
}
