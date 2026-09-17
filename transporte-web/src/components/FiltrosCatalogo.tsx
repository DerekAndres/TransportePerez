import type { ReactNode } from "react";
import { Button, Center, Group, Pagination, Text, TextInput } from "@mantine/core";
import { IconSearch, IconX } from "@tabler/icons-react";

// ============================================
// BARRA DE FILTROS DE UNA SECCIÓN DEL CATÁLOGO
// ============================================
// La misma barra en las siete secciones (conductores, padres, buses, escuelas,
// puntos, niños, rutas), para que buscar se sienta igual en todas.
//
// Tres cosas, en este orden:
//   1. El buscador, que es lo que se usa el 90 % de las veces.
//   2. Los filtros propios de cada sección (estado, escuela, ruta…), que cada
//      pantalla pasa como hijos porque solo ella sabe cuáles tienen sentido.
//   3. EL CONTADOR. Es lo que más se subestima: sin él, el admin no sabe si
//      está viendo todo o una parte, y termina dudando de si un registro existe
//      o simplemente está filtrado. Dice "12 de 340" y se acabó la duda.

export default function FiltrosCatalogo({
  busqueda,
  onBusqueda,
  placeholder = "Buscar…",
  mostrados,
  total,
  onLimpiar,
  children,
}: {
  busqueda: string;
  onBusqueda: (valor: string) => void;
  placeholder?: string;
  // Cuántos quedaron tras filtrar, y cuántos hay en total
  mostrados: number;
  total: number;
  // Devuelve todos los filtros de la sección a su valor inicial
  onLimpiar?: () => void;
  // Filtros extra propios de cada pantalla (Select de estado, de escuela…)
  children?: ReactNode;
}) {
  const hayFiltro = busqueda.trim() !== "" || mostrados !== total;

  return (
    <Group justify="space-between" align="flex-end" gap="sm" wrap="wrap">
      <Group align="flex-end" gap="sm" wrap="wrap">
        <TextInput
          label="Buscar"
          placeholder={placeholder}
          leftSection={<IconSearch size={16} />}
          value={busqueda}
          onChange={(e) => onBusqueda(e.currentTarget.value)}
          w={260}
          // El buscador se limpia desde su propia X, que es donde la gente la
          // busca; el botón "Limpiar filtros" es para todo lo demás
          rightSection={
            busqueda ? (
              <IconX
                size={15}
                style={{ cursor: "pointer" }}
                onClick={() => onBusqueda("")}
              />
            ) : null
          }
        />
        {children}
        {hayFiltro && onLimpiar && (
          <Button variant="subtle" size="compact-sm" onClick={onLimpiar} mb={6}>
            Limpiar filtros
          </Button>
        )}
      </Group>

      <Text size="sm" c="dimmed" mb={6}>
        {mostrados === total ? (
          <>
            {total} {total === 1 ? "registro" : "registros"}
          </>
        ) : (
          <>
            Mostrando <b>{mostrados}</b> de {total}
          </>
        )}
      </Text>
    </Group>
  );
}

// --- Pie de la tabla: el paginador ---
// Se oculta solo cuando hay una sola página: un paginador de "1 de 1" es ruido.
export function PiePaginacion({
  pagina,
  totalPaginas,
  onPagina,
}: {
  pagina: number;
  totalPaginas: number;
  onPagina: (p: number) => void;
}) {
  if (totalPaginas <= 1) return null;
  return (
    <Center mt="sm">
      <Pagination value={pagina} onChange={onPagina} total={totalPaginas} size="sm" />
    </Center>
  );
}

// --- Fila de "no hay resultados" ---
// Distinta del vacío real: si la sección no tiene NADA, el mensaje correcto es
// "todavía no hay X"; si hay pero el filtro no deja ver nada, hay que decir eso,
// porque son dos situaciones que el admin resuelve de manera distinta.
export function SinResultados({ colSpan, hayDatos }: { colSpan: number; hayDatos: boolean }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <Text c="dimmed" ta="center" py="lg" size="sm">
          {hayDatos
            ? "Ningún registro coincide con la búsqueda."
            : "Todavía no hay registros en esta sección."}
        </Text>
      </td>
    </tr>
  );
}
