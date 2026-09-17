import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import AparicionSuave from '@/components/AparicionSuave';
import ChipFiltro from '@/components/ChipFiltro';
import EstadoVacio from '@/components/EstadoVacio';
import TarjetaAviso from '@/components/TarjetaAviso';
import { ESPACIO, estilosBase } from '@/constants/estilos';
import { esReciente, grupoDeFecha } from '@/utils/tiempo';
import type { Aviso, Canal } from '@/types/models';

// ============================================
// LA LISTA DE AVISOS (padre y conductor)
// ============================================
// Los dos leen exactamente lo mismo —los comunicados de la administración— y lo
// único que cambia es DE QUÉ escuelas: el padre recibe las de sus hijos, el
// conductor las de las escuelas de su ruta. Así que la lista vive acá una sola
// vez y cada pantalla solo se ocupa de conseguir sus canales.
//
// LO QUE SE AGREGÓ AL DISEÑO:
//
// 1. AGRUPADA POR FECHA (Hoy · Ayer · Esta semana · Antes). Una lista de
//    comunicados sin cortes obliga a leer la fecha de cada tarjeta para saber
//    si algo es de hoy. Con los grupos, "lo de hoy" se ve sin leer nada — que
//    es la única pregunta real de esta pantalla.
// 2. UN RENGLÓN QUE CUENTA LO NUEVO arriba de todo ("2 avisos nuevos"), en
//    ámbar y latiendo, porque es exactamente lo que el usuario vino a ver.
// 3. UN VACÍO QUE EXPLICA en vez de un texto gris suelto (ver EstadoVacio).

// Valor del filtro cuando no se filtra por ningún canal en particular
const TODOS = 'todos';

export default function ListaAvisos({
  canales,
  avisos,
  tituloVacio,
  textoVacio,
}: {
  canales: Canal[];
  avisos: Aviso[];
  tituloVacio: string;
  textoVacio: string;
}) {
  const tema = useTheme();
  const [filtro, setFiltro] = useState<string>(TODOS);

  const nombrePorCanal = useMemo(
    () => new Map(canales.map((c) => [c.id, c.nombre])),
    [canales]
  );

  const visibles = filtro === TODOS ? avisos : avisos.filter((a) => a.canalId === filtro);
  const nuevos = visibles.filter((a) => esReciente(a.hora)).length;

  // Los avisos ya vienen del más nuevo al más viejo (lo ordena el servicio):
  // acá solo se cortan en grupos, conservando ese orden.
  const grupos = useMemo(() => {
    const porGrupo: { titulo: string; avisos: Aviso[] }[] = [];
    visibles.forEach((aviso) => {
      const titulo = grupoDeFecha(aviso.hora);
      const ultimo = porGrupo[porGrupo.length - 1];
      if (ultimo && ultimo.titulo === titulo) ultimo.avisos.push(aviso);
      else porGrupo.push({ titulo, avisos: [aviso] });
    });
    return porGrupo;
  }, [visibles]);

  return (
    <>
      {/* Con dos o más escuelas, se puede mirar una sola */}
      {canales.length > 1 && (
        <ChipFiltro
          opciones={[
            { id: TODOS, etiqueta: 'Todos', detalle: `${avisos.length}` },
            ...canales.map((c) => ({ id: c.id, etiqueta: c.nombre })),
          ]}
          seleccionadaId={filtro}
          onSeleccionar={setFiltro}
        />
      )}

      {/* Lo nuevo, contado. Solo aparece si hay algo de las últimas 24 h: un
          renglón que dice "0 nuevos" ocupa lugar todos los días para nada. */}
      {nuevos > 0 && (
        <View style={styles.filaNuevos}>
          <MaterialCommunityIcons name="bullhorn" size={16} color={tema.colors.tertiary} />
          <Text variant="labelLarge" style={{ color: tema.colors.tertiary }}>
            {nuevos === 1 ? '1 aviso nuevo' : `${nuevos} avisos nuevos`}
          </Text>
        </View>
      )}

      {visibles.length === 0 ? (
        <EstadoVacio icono="bullhorn-outline" titulo={tituloVacio} texto={textoVacio} />
      ) : (
        grupos.map((grupo) => (
          <View key={grupo.titulo} style={styles.grupo}>
            <Text variant="labelMedium" style={[estilosBase.tenue, styles.tituloGrupo]}>
              {grupo.titulo.toUpperCase()}
            </Text>
            {grupo.avisos.map((aviso, indice) => (
              <AparicionSuave key={aviso.id} indice={indice}>
                <TarjetaAviso aviso={aviso} canalNombre={nombrePorCanal.get(aviso.canalId)} />
              </AparicionSuave>
            ))}
          </View>
        ))
      )}
    </>
  );
}

const styles = StyleSheet.create({
  filaNuevos: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.minimo },
  // El grupo junta su título con sus tarjetas y las separa del grupo siguiente
  grupo: { gap: ESPACIO.interno },
  tituloGrupo: { letterSpacing: 1 },
});
