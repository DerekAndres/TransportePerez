// Ayudantes de texto para los mensajes del panel.
//
// Viven aparte del componente `Sugerencias` a propósito: un archivo que exporta
// un componente Y funciones sueltas rompe la recarga en caliente de Vite
// (react-refresh solo funciona si el archivo exporta únicamente componentes).

// "Mazapán, San Isidro y 4 más" en vez de treinta nombres seguidos. El límite
// por defecto es tres porque a partir de ahí el renglón deja de leerse de un
// vistazo, que es justo para lo que sirve.
export function enumerar(nombres: string[], maximo = 3): string {
  if (nombres.length === 0) return "";
  if (nombres.length <= maximo) {
    if (nombres.length === 1) return nombres[0];
    return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
  }
  const resto = nombres.length - maximo;
  return `${nombres.slice(0, maximo).join(", ")} y ${resto} más`;
}

// Plural sin repetir el ternario en cada pantalla
export function plural(cantidad: number, singular: string, pluralForma: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : pluralForma}`;
}
