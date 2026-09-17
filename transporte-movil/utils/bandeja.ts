import type { MaterialCommunityIcons } from '@expo/vector-icons';

import type { ResumenConversacion } from '@/services/mensajesService';

// ============================================
// CÓMO SE ORDENA UNA BANDEJA DE MENSAJES
// ============================================
// Los tres roles tienen bandeja (padre, conductor y admin) y los tres necesitan
// exactamente el mismo criterio, así que vive acá una sola vez. Antes cada
// pantalla lo resolvía por su cuenta: la del padre y la del conductor eran el
// MISMO archivo copiado, y la del admin —la única con orden de verdad— tenía la
// lógica metida adentro del render.
//
// EL ORDEN NO ES ALFABÉTICO NI POR FECHA, es por URGENCIA:
//
//   1. SIN LEER — alguien escribió y está esperando respuesta. Es lo único de
//      la pantalla que exige algo del usuario, así que va primero siempre. En
//      una bandeja de cientos de contactos (la del admin), que un mensaje sin
//      contestar quede sepultado bajo conversaciones viejas es el peor error
//      posible de esta pantalla.
//   2. CONVERSACIONES — las ya abiertas, de la más reciente a la más vieja.
//   3. ESCRIBIRLE A ALGUIEN — el resto de la gente con la que se PUEDE hablar
//      pero todavía no se habló, alfabético. La administración va primero de
//      ese grupo: es el contacto al que más se recurre.

export type TonoContacto =
  | 'marca' // zafiro — la administración, el conductor
  | 'alterno' // esmeralda — el padre/madre
  | 'neutro';

// Alguien con quien se puede chatear. Cada rol arma esta lista a su manera (el
// padre con sus conductores, el conductor con los padres de sus niños, el admin
// con todos), pero a partir de acá se tratan todos igual.
export interface ContactoBandeja {
  id: string;
  nombre: string;
  telefono: string;
  // Qué se muestra bajo el nombre MIENTRAS NO HAY conversación ("Conductor",
  // "Padre / Madre"). Cuando ya hay mensajes, ahí va el último.
  papel: string;
  icono: keyof typeof MaterialCommunityIcons.glyphMap;
  foto?: string;
  tono?: TonoContacto;
  // Va primero entre los que no tienen conversación (la administración)
  prioritario?: boolean;
}

// Una fila de la lista. Encabezados y personas van MEZCLADOS en un solo arreglo
// porque la bandeja del admin usa FlatList, y FlatList recicla mucho mejor UNA
// lista larga que varias listas anidadas.
export type FilaBandeja =
  | { clase: 'encabezado'; id: string; texto: string; detalle?: string }
  | { clase: 'contacto'; id: string; contacto: ContactoBandeja; resumen?: ResumenConversacion }
  | { clase: 'vacio'; id: string; texto: string };

export interface OpcionesBandeja {
  // Texto del buscador (nombre o teléfono). Vacío = no filtra.
  busqueda?: string;
  // Texto de la fila vacía cuando no hay NADIE con quien hablar
  vacio?: string;
}

function normalizar(texto: string): string {
  return texto.trim().toLowerCase();
}

// ¿Este contacto coincide con lo que se escribió en el buscador?
export function coincide(contacto: ContactoBandeja, busqueda: string): boolean {
  const texto = normalizar(busqueda);
  if (!texto) return true;
  return (
    contacto.nombre.toLowerCase().includes(texto) || (contacto.telefono ?? '').includes(texto)
  );
}

// Arma la lista completa, ya ordenada y con sus encabezados. Es una función
// PURA: entran los contactos y los resúmenes en vivo, sale lo que se dibuja.
// Así se puede leer (y explicar) sin mirar ninguna pantalla.
export function armarBandeja(
  contactos: ContactoBandeja[],
  resumenes: ResumenConversacion[],
  opciones: OpcionesBandeja = {}
): FilaBandeja[] {
  const { busqueda = '', vacio = 'Todavía no hay con quién chatear.' } = opciones;

  const resumenPorId = new Map(resumenes.map((r) => [r.otroId, r]));
  const visibles = contactos.filter((c) => coincide(c, busqueda));

  const conResumen = visibles
    .map((contacto) => ({ contacto, resumen: resumenPorId.get(contacto.id) }))
    .filter((x) => !!x.resumen) as {
    contacto: ContactoBandeja;
    resumen: ResumenConversacion;
  }[];

  const masReciente = (
    a: { resumen: ResumenConversacion },
    b: { resumen: ResumenConversacion }
  ) => b.resumen.ultimaHora.toMillis() - a.resumen.ultimaHora.toMillis();

  const sinLeer = conResumen.filter((x) => x.resumen.noLeidos > 0).sort(masReciente);
  const leidas = conResumen.filter((x) => x.resumen.noLeidos === 0).sort(masReciente);

  // Los que todavía no tienen conversación: la administración primero, después
  // por nombre
  const nuevos = visibles
    .filter((c) => !resumenPorId.has(c.id))
    .sort((a, b) => {
      if (!!a.prioritario !== !!b.prioritario) return a.prioritario ? -1 : 1;
      return a.nombre.localeCompare(b.nombre);
    });

  const filas: FilaBandeja[] = [];

  if (sinLeer.length > 0) {
    const mensajes = sinLeer.reduce((suma, x) => suma + x.resumen.noLeidos, 0);
    filas.push({
      clase: 'encabezado',
      id: 'h-sin-leer',
      texto: 'Sin leer',
      detalle: `${mensajes} ${mensajes === 1 ? 'mensaje' : 'mensajes'}`,
    });
    sinLeer.forEach((x) =>
      filas.push({ clase: 'contacto', id: x.contacto.id, contacto: x.contacto, resumen: x.resumen })
    );
  }

  if (leidas.length > 0) {
    filas.push({ clase: 'encabezado', id: 'h-conv', texto: 'Conversaciones' });
    leidas.forEach((x) =>
      filas.push({ clase: 'contacto', id: x.contacto.id, contacto: x.contacto, resumen: x.resumen })
    );
  }

  if (nuevos.length > 0) {
    filas.push({
      clase: 'encabezado',
      id: 'h-nuevos',
      // Si ya hay conversaciones arriba, este grupo es "alguien MÁS"
      texto: conResumen.length > 0 ? 'Escribirle a alguien más' : 'Escribirle a alguien',
      detalle: `${nuevos.length}`,
    });
    nuevos.forEach((contacto) => filas.push({ clase: 'contacto', id: contacto.id, contacto }));
  }

  if (filas.length === 0) {
    filas.push({
      clase: 'vacio',
      id: 'v-bandeja',
      texto: normalizar(busqueda) ? 'Nadie coincide con esa búsqueda.' : vacio,
    });
  }

  return filas;
}

// Cuántos mensajes sin leer hay en total (el renglón del encabezado)
export function totalSinLeer(resumenes: ResumenConversacion[]): number {
  return resumenes.reduce((suma, r) => suma + r.noLeidos, 0);
}
