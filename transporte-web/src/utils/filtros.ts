// ============================================
// BÚSQUEDA DE TEXTO EN LAS TABLAS DEL CATÁLOGO
// ============================================
// Todas las secciones del catálogo (conductores, padres, buses, escuelas,
// puntos, niños, rutas) filtran con la misma función, así el buscador se
// comporta igual en las siete y no hay que aprender uno distinto por pantalla.
//
// DÓNDE SE FILTRA Y POR QUÉ. El filtrado es EN EL CLIENTE: se traen los
// documentos una vez y se filtra en memoria. Es lo correcto para el tamaño de
// esta empresa (cientos de registros por colección) y evita índices compuestos
// en Firestore, que el proyecto viene esquivando a propósito. El límite está
// documentado en ESTADO-ACTUAL: si una colección superara el orden de unos
// pocos miles de documentos, habría que pasar a paginar contra el servidor.

// Pasa un texto a su forma comparable: sin mayúsculas y SIN TILDES.
// Lo de las tildes importa de verdad acá: nadie escribe "Josué" con tilde en un
// buscador, y sin esto "josue" no encontraría a "Josué". Igual con "Unión",
// "Bilingüe" o "García".
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD") // separa la letra de su tilde
    .replace(/[\u0300-\u036f]/g, ""); // y borra la tilde
}

// Filtra una lista por texto libre. `camposDe` devuelve los campos de cada
// elemento donde hay que buscar (nombre, placa, correo, teléfono…).
//
// La búsqueda es por PALABRAS SUELTAS y en cualquier orden: escribir
// "perez ana" encuentra a "Ana Lucía Perez". Es lo que la gente espera de un
// buscador, y evita el caso frustrante de escribir el apellido primero y que no
// aparezca nada.
export function filtrarTexto<T>(
  items: T[],
  busqueda: string,
  camposDe: (item: T) => (string | number | undefined | null)[]
): T[] {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return items;

  return items.filter((item) => {
    const heno = normalizar(
      camposDe(item)
        .filter((c) => c !== undefined && c !== null && c !== "")
        .join(" ")
    );
    return palabras.every((palabra) => heno.includes(palabra));
  });
}

// --- Filtro por estado activo/inactivo ---
// Las siete secciones usan borrado lógico (nada se borra, se desactiva), así que
// las listas mezclan lo vigente con lo archivado. Por defecto interesa lo
// ACTIVO; ver lo inactivo es la excepción.
export type FiltroEstado = "activos" | "inactivos" | "todos";

export const OPCIONES_ESTADO = [
  { value: "activos", label: "Activos" },
  { value: "inactivos", label: "Inactivos" },
  { value: "todos", label: "Todos" },
];

export function filtrarPorEstado<T>(
  items: T[],
  estado: FiltroEstado,
  estaActivo: (item: T) => boolean
): T[] {
  if (estado === "todos") return items;
  return items.filter((item) => (estado === "activos" ? estaActivo(item) : !estaActivo(item)));
}
