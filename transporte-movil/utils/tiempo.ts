import type { Timestamp } from 'firebase/firestore';

// ============================================
// TEXTOS DE TIEMPO
// ============================================
// Cómo se muestra "cuándo pasó algo" en toda la app. Está en un solo archivo
// para que un aviso, un mensaje y un registro de asistencia se lean siempre
// igual.

// Hora corta "H:mm" (la que se muestra al lado de un evento del día)
export function horaCorta(momento: Timestamp): string {
  const fecha = momento.toDate();
  return `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, '0')}`;
}

// "Hace un rato" en lenguaje natural: es más fácil de leer de un vistazo que
// una fecha completa, sobre todo en los avisos ("hace 2 h" dice más que
// "18/08 14:30"). Pasada una semana se muestra la fecha, que ahí sí importa.
export function haceCuanto(momento: Timestamp): string {
  const ahora = Date.now();
  const minutos = Math.floor((ahora - momento.toMillis()) / 60000);

  if (minutos < 1) return 'Recién';
  if (minutos < 60) return `Hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;

  const dias = Math.floor(horas / 24);
  if (dias === 1) return 'Ayer';
  if (dias < 7) return `Hace ${dias} días`;

  return momento.toDate().toLocaleDateString('es-HN', { day: '2-digit', month: 'short' });
}

// true si el momento es de las últimas 24 horas (para marcar un aviso como nuevo)
export function esReciente(momento: Timestamp): boolean {
  return Date.now() - momento.toMillis() < 24 * 60 * 60 * 1000;
}

// En qué grupo de una lista cae algo: "Hoy", "Ayer", "Esta semana" o "Antes".
// Sirve para cortar una lista larga de avisos en tramos que se entienden sin
// leer ninguna fecha. Se compara por DÍA DEL CALENDARIO y no por horas
// transcurridas: un aviso de las 11 de la noche de ayer es "Ayer" aunque hayan
// pasado nueve horas, que es como lo cuenta cualquier persona.
export function grupoDeFecha(momento: Timestamp): string {
  const fecha = momento.toDate();
  const hoy = new Date();
  const aMedianoche = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((aMedianoche(hoy) - aMedianoche(fecha)) / (24 * 60 * 60 * 1000));

  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 7) return 'Esta semana';
  return 'Antes';
}

// Saludo según la hora. Detalle chico que cambia mucho: la app deja de decir
// siempre lo mismo y acompaña el momento del día en que se la usa (la mañana de
// la ida y la tarde del regreso son los dos momentos en que se la abre).
export function saludoDelDia(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// "06:15" (como el panel guarda la hora de salida de una ruta) → "6:15 a. m.".
// Si llega algo que no es una hora, se devuelve tal cual.
export function horaDeTexto(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}
