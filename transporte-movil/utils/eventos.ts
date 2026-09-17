import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MD3Theme } from 'react-native-paper';

import type { EventoRegistro, Registro } from '@/types/models';

// ============================================
// QUÉ PASÓ DE VERDAD: LOS REGISTROS EFECTIVOS
// ============================================
// El conductor marca la asistencia de pie, con el bus andando y niños subiendo.
// Un dedazo es cuestión de tiempo: marcar "subió" al hermano equivocado, o
// "bajó" en la parada anterior. Para eso existe el evento 'anulado'.
//
// Los registros NO se editan ni se borran nunca (decisión de diseño del
// proyecto: una corrección es un registro nuevo). Entonces "deshacer" agrega un
// 'anulado', y esta función es la que traduce esa historia a lo que realmente
// pasó: recorre los registros en orden y cada 'anulado' TACHA al anterior que
// siga en pie.
//
// Se hace con una pila, y funciona igual si el conductor deshace dos veces
// seguidas. Lo que devuelve es lo que hay que usar para calcular el estado de
// un niño y para mostrarle su historial al padre — al padre no se le muestran
// las marcas tachadas ni los 'anulado': para él, esa marca nunca existió. La
// historia completa queda en Firestore para la administración.
export function registrosEfectivos(registros: Registro[]): Registro[] {
  const enOrden = [...registros].sort((a, b) => a.hora.toMillis() - b.hora.toMillis());
  const pila: Registro[] = [];
  for (const r of enOrden) {
    if (r.evento === 'anulado') pila.pop();
    else pila.push(r);
  }
  return pila;
}

// ============================================
// CÓMO SE MUESTRA UN EVENTO DE ASISTENCIA
// ============================================
// Un solo lugar que dice, para cada evento, qué texto lleva, con qué ícono y de
// qué color. Antes esto estaba repetido como `evento === 'subio' ? A : B` en
// catorce lugares distintos, y esa forma tenía un problema grave: daba por
// sentado que los eventos eran solo DOS. Cuando se agregó "no estaba", cada uno
// de esos catorce lugares habría mostrado "bajó del bus" para un niño que nunca
// subió — o sea, exactamente lo contrario de lo que pasó.
//
// Con estos mapas, agregar un evento nuevo rompe la compilación hasta que se le
// asigne texto, ícono y color. Eso es a propósito: es preferible un error de
// TypeScript a una pantalla que le miente al padre.

// Texto en primera persona del niño, como lo lee el padre en su historial
export const TEXTO_EVENTO: Record<EventoRegistro, string> = {
  subio: 'Subió al bus',
  bajo: 'Bajó del bus',
  no_estaba: 'No estaba en la parada',
  // Al padre no se le muestra nunca (ver registrosEfectivos); el texto existe
  // para el historial completo que ve la administración
  anulado: 'Marca corregida por el conductor',
};

// Versión corta para listas donde ya se dijo el nombre del niño
export const TEXTO_EVENTO_BREVE: Record<EventoRegistro, string> = {
  subio: 'subió al bus',
  bajo: 'bajó del bus',
  no_estaba: 'no estaba en la parada',
  anulado: 'tuvo una marca corregida',
};

export const ICONO_EVENTO: Record<
  EventoRegistro,
  keyof typeof MaterialCommunityIcons.glyphMap
> = {
  subio: 'bus',
  bajo: 'home-import-outline',
  // Un reloj con exclamación: el bus pasó y no había nadie
  no_estaba: 'account-alert-outline',
  anulado: 'undo-variant',
};

// Colores de la pastilla/círculo que acompaña al evento. Salen del tema, así
// que siguen la identidad de la app sin escribir ningún color a mano:
//   subió      → turquesa (está pasando ahora)
//   bajó       → verde    (se cumplió)
//   no estaba  → ROJO     (es un fallo del servicio, y tiene que verse como tal)
export function tonoEvento(evento: EventoRegistro, tema: MD3Theme): {
  fondo: string;
  texto: string;
} {
  if (evento === 'subio') {
    return { fondo: tema.colors.primaryContainer, texto: tema.colors.onPrimaryContainer };
  }
  if (evento === 'bajo') {
    return { fondo: tema.colors.secondaryContainer, texto: tema.colors.onSecondaryContainer };
  }
  if (evento === 'anulado') {
    return { fondo: tema.colors.surfaceVariant, texto: tema.colors.onSurfaceVariant };
  }
  return { fondo: tema.colors.errorContainer, texto: tema.colors.onErrorContainer };
}
