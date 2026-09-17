import { useMemo, useState } from "react";

// ============================================
// PAGINACIÓN DE LAS TABLAS DEL CATÁLOGO
// ============================================
// Filtrar no alcanza cuando hay volumen: aunque el admin busque "Perez" y
// queden 80 filas, dibujar 80 filas de tabla con sus switches y sus botones
// pone lento al navegador y obliga a un scroll larguísimo. Se muestran de a
// tandas.
//
// 25 por página es el número que entra en una pantalla de escritorio sin tener
// que desplazarse mucho, y que a la vez no obliga a pasar de página todo el
// tiempo.
const POR_PAGINA = 25;

export function usePaginacion<T>(items: T[], porPagina: number = POR_PAGINA) {
  const [pagina, setPagina] = useState(1);

  const totalPaginas = Math.max(1, Math.ceil(items.length / porPagina));

  // Si el usuario está en la página 4 y escribe algo en el buscador que deja
  // solo 10 resultados, la página 4 ya no existe y la tabla se vería vacía sin
  // ninguna explicación.
  //
  // Se resuelve ACOTANDO el valor al vuelo en vez de corrigiéndolo con un
  // efecto: un efecto haría que la tabla se dibuje una vez vacía y recién en el
  // siguiente dibujado apareciera bien (un parpadeo), además de ser el patrón
  // que React desaconseja. Así el número nunca llega a estar mal.
  const paginaSegura = Math.min(pagina, totalPaginas);

  const visibles = useMemo(
    () => items.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina),
    [items, paginaSegura, porPagina]
  );

  return {
    visibles,
    pagina: paginaSegura,
    setPagina,
    totalPaginas,
    total: items.length,
  };
}
