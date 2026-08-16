// ============================================
// MODELO DE DATOS - Sistema Transporte Perez
// Este archivo define la forma de cada colección de Firestore
// ============================================

import { Timestamp } from "firebase/firestore";

// --- Roles del sistema ---
export type Rol = "admin" | "conductor" | "padre";

// --- Colección: usuarios ---
export interface Usuario {
  id: string; // uid de Firebase Auth
  rol: Rol;
  nombre: string;
  telefono: string;
  email: string;
  expoPushToken?: string; // token para notificaciones push (se llena al iniciar sesión en móvil)
  // Foto de perfil como data-URI base64 comprimida (~50 KB). Se guarda dentro
  // del documento porque Firebase Storage exige plan Blaze y este proyecto es
  // solo Spark (ver utils/fotos.ts en el móvil).
  foto?: string;
  // true mientras la cuenta sea nueva: el admin la creó y Firebase le envió el
  // correo para definir su contraseña, pero el usuario todavía no entró a la app
  // a cargar su teléfono y su foto. La app lo manda a "completar perfil" una
  // única vez, hasta que quede en false.
  debeCompletarPerfil?: boolean;
  activo: boolean;
  creadoEn: Timestamp;

  // --- Archivado (ver el bloque "BORRADO LÓGICO" más abajo) ---
  eliminado?: boolean;
  eliminadoEn?: Timestamp;
  motivoEliminacion?: string;
}

// ============================================
// BORRADO LÓGICO (archivado)
// ============================================
// Cuando el admin "elimina" un padre, un conductor o un niño, el documento NO se
// borra: se marca con `eliminado: true` (y `activo: false`, para que desaparezca
// de todas las listas y selectores que ya filtran por activo). Los registros
// quedan visibles en la pantalla de Historial, desde donde se pueden restaurar.
//
// Por qué no se borra de verdad:
//   1. Los viajes y los registros de asistencia guardan `ninoId` y `conductorId`.
//      Si el documento desapareciera, los reportes históricos mostrarían "—" en
//      lugar de los nombres y se perdería la trazabilidad del servicio.
//   2. Borrar la cuenta de Firebase Authentication de OTRO usuario requiere el
//      Admin SDK en un servidor, que este proyecto no tiene (plan Spark, sin
//      Cloud Functions). La cuenta quedaría igual, así que un borrado "real" de
//      Firestore solo dejaría datos huérfanos.
//   3. Es coherente con la decisión ya tomada de no hacer borrado físico en
//      ninguna colección.
//
// Al archivar un PADRE se archivan también sus hijos, en un solo lote.

// --- Colección: buses ---
export interface Bus {
  id: string;
  placa: string;
  capacidad: number;
  conductorId: string; // referencia a Usuario.id
  foto?: string; // foto de la unidad (base64 comprimida — la sube el admin, la ve el padre)
  activo: boolean;
}

// --- Colección: escuelas (Fase 3.5) ---
// Las escuelas son entidades con ubicación propia. Cada niño va a una.
export interface Escuela {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  activa: boolean;
}

// --- Colección: puntos (puntos de transbordo) ---
// Lugares físicos donde un niño cambia de bus (transbordo). Mismo formato de
// coordenadas que 'escuelas' (lat/lng sueltos), por consistencia.
export interface Punto {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  activo: boolean;
}

// --- Turno de una ruta / de un niño (Fase 3.5) ---
// 'manana' = viaje de la mañana (casa → escuela); 'tarde' = de la tarde (escuela → casa).
export type Turno = "manana" | "tarde";
// El niño puede viajar solo en un turno o en ambos.
export type TurnoNino = Turno | "ambos";

// --- Sub-tipo: la parada (casa) del niño (Fase 3.5) ---
// Se marca en un mapa dentro del perfil del niño. Es donde se lo recoge y se lo deja.
export interface ParadaNino {
  nombre: string; // etiqueta, ej. "Col. Bella Vista"
  lat: number;
  lng: number;
  // Punto de referencia escrito por el padre para que el conductor ubique el
  // lugar exacto (ej. "portón negro frente a la pulpería Doña Mari"). Se muestra
  // en la ficha de la parada en el mapa del conductor.
  referencia?: string;
}

// --- Transbordo: tipos de lugar y referencias (ver docs/transbordo-implementacion.md) ---
// Un niño sube y baja en algún LUGAR de cada ruta. En el caso directo (la mayoría)
// sube en su casa y baja en su escuela (o al revés según el turno). Con transbordo,
// puede subir/bajar en un PUNTO de transbordo (donde cambia de bus).
export type TipoLugar = "casa" | "escuela" | "punto";

// Referencia a un lugar concreto. El id se interpreta según el tipo:
//   "casa"    → ninoId    (la casa vive embebida en nino.parada)
//   "escuela" → escuelaId (colección escuelas)
//   "punto"   → puntoId   (colección puntos)
export interface LugarRef {
  tipo: TipoLugar;
  id: string;
}

// Un niño dentro de una ruta: dónde sube y dónde baja EN ESA RUTA.
export interface NinoEnRuta {
  ninoId: string;
  subeEn: LugarRef;
  bajaEn: LugarRef;
}

// Una parada del recorrido de la ruta: un lugar por el que pasa, en orden.
export interface Parada {
  lugar: LugarRef;
  orden: number;
}

// --- Colección: rutas ---
// Una ruta pertenece a un bus, tiene un turno (mañana o tarde) y sirve a una o
// varias escuelas. Sus niños son los marcados en 'ninoIds'.
export interface Ruta {
  id: string;
  nombre: string;
  busId: string; // referencia a Bus.id (la "unidad")
  activa: boolean;

  // --- Modelo (Fase 3.5) ---
  turno?: Turno;
  escuelaIds?: string[]; // una o varias escuelas que sirve la ruta
  ninoIds?: string[]; // niños asignados (los que se marcan al armar la ruta) — SE CONSERVA
  municipio?: "La Ceiba" | "El Porvenir" | "El Pino" | "La Union";

  // --- Transbordo (lo genera la migración; canónico a futuro) ---
  ninos?: NinoEnRuta[]; // por niño: dónde sube y dónde baja en esta ruta
  paradas?: Parada[]; // recorrido ordenado de lugares (reemplaza al viejo ParadaEnRuta[], que nadie leía)

  // --- Modelo viejo — se elimina en la limpieza de la migración de Fase 3.5 ---
  horarioAM?: string;
  horarioPM?: string;
}

// --- Colección: ninos ---
export interface Nino {
  id: string;
  nombre: string;
  grado: string;
  padreId: string; // referencia a Usuario.id
  activo: boolean;

  // --- Modelo nuevo (Fase 3.5) — opcionales mientras dura la migración ---
  escuelaId?: string; // su escuela (referencia a escuelas/{id})
  parada?: ParadaNino; // su casa (marcada en el mapa del perfil)
  turno?: TurnoNino; // cuándo viaja: mañana, tarde o ambos
  foto?: string; // foto del niño (base64 comprimida — la sube su padre)
  // Si en la TARDE el niño se entrega en un lugar DISTINTO de donde se recoge
  // en la mañana (ej. casa de la abuela), acá va ese lugar. Sin este campo, la
  // entrega de la tarde es en 'parada' (el caso normal).
  paradaTarde?: ParadaNino;

  // --- Archivado (ver el bloque "BORRADO LÓGICO" arriba) ---
  eliminado?: boolean;
  eliminadoEn?: Timestamp;
  motivoEliminacion?: string;

  // --- Modelo viejo — se conserva durante la migración; se elimina al terminar Fase 3.5 ---
  centroEducativo: string; // reemplazado por escuelaId
  rutaId: string; // la asignación a rutas ahora vive en ruta.ninoIds
  paradaId: string; // la parada ahora vive embebida en 'parada'
}

// --- Colección: viajes ---
export type EstadoViaje = "pendiente" | "en_curso" | "finalizado";
export type TipoViaje = "AM" | "PM";

export interface Viaje {
  id: string;
  rutaId: string; // identifica el viaje junto con la fecha (un viaje por ruta por día)
  conductorId: string;
  busId: string;
  fecha: string; // formato "YYYY-MM-DD"
  estado: EstadoViaje;
  horaInicio?: Timestamp;
  horaFin?: Timestamp;
  demorado?: boolean; // contingencia de transbordo: el conductor marcó que está esperando
  tipo?: TipoViaje; // (viejo AM/PM) ya no se usa; se elimina en la limpieza final
}

// --- Colección: registros (asistencia) ---
export type EventoRegistro = "subio" | "bajo";

export interface Registro {
  id: string;
  viajeId: string;
  ninoId: string;
  evento: EventoRegistro;
  hora: Timestamp;
  paradaId: string;

  // --- Transbordo (opcionales; solo en registros hechos en un punto de transbordo) ---
  // Permiten que el bus RECEPTOR reconstruya a quién dejó el bus EMISOR en el punto,
  // sin leer la ruta del otro bus (solo consulta 'registros' del punto).
  fecha?: string; // "YYYY-MM-DD" — para consultar los registros del punto por día
  lugarTipo?: TipoLugar; // 'punto' cuando el evento ocurre en un transbordo
  lugarId?: string; // id del lugar (puntoId cuando lugarTipo === 'punto')
  rutaId?: string;
  busId?: string;
  conductorId?: string;
  excepcion?: boolean; // true si es una entrega/recepción por excepción
  discrepancia?: boolean; // true si el receptor confirmó sin entrega previa del emisor
  motivo?: string; // texto opcional (motivo de excepción/demora)
}

// --- Colección: ubicaciones (tracking GPS en vivo) ---
export interface UbicacionActual {
  viajeId: string; // mismo id que el viaje, un doc por viaje activo
  lat: number;
  lng: number;
  timestamp: Timestamp;
}

// --- Colección: mensajes (chat padre-conductor/admin) ---
export interface Mensaje {
  id: string;
  conversacionId: string; // ej: `${padreId}_${conductorId}`
  de: string; // Usuario.id del remitente
  para: string; // Usuario.id del destinatario
  texto: string;
  hora: Timestamp;
  leido: boolean;
}

// --- Colección: canales (avisos informativos por escuela) ---
// Un canal es de UNA escuela y es de una sola vía: solo el admin publica, los
// padres leen. La MEMBRESÍA NO SE GUARDA: es padre del canal quien tenga un hijo
// activo en esa escuela. Así, si un padre tiene dos hijos en escuelas distintas
// queda en los dos canales sin que nadie lo inscriba, y si un niño cambia de
// escuela su padre entra y sale del canal solo.
export interface Canal {
  id: string;
  nombre: string;
  escuelaId: string; // de qué escuela son los padres que lo reciben
  descripcion?: string;
  foto?: string; // portada del canal (ej. el logo de la escuela), base64 comprimida
  activo: boolean;
  creadoEn: Timestamp;
}

// --- Colección: avisos (las publicaciones de un canal) ---
// Solo las crea el admin (regla de Firestore). Son informativos: no hay
// respuestas ni "leído por", justamente para que el canal no se vuelva un chat.
export interface Aviso {
  id: string;
  canalId: string;
  texto: string;
  de: string; // uid del admin que publicó
  hora: Timestamp;
}

// --- Colección: solicitudes (el padre pide, el admin aprueba) ---
// Mantiene el sistema de registro CERRADO: el padre llena los formularios desde
// la app, pero nada entra en operación hasta que el admin lo aprueba en el
// panel web. Dos tipos:
//   - inscripcion:       alta de un hijo (al aprobar, el admin crea el niño y
//                        luego lo asigna a una ruta con el armador).
//   - cambio_ubicacion:  mudanza o cambio de lugar de recogida/entrega. Puede
//                        ser permanente (el admin actualiza la casa del niño al
//                        aprobar) o de un solo día (el conductor ve un aviso
//                        destacado ese día).
export type TipoSolicitud = "inscripcion" | "cambio_ubicacion";
export type EstadoSolicitud = "pendiente" | "aprobada" | "rechazada";

// Qué lado del viaje cambia una solicitud de ubicación: dónde se recoge (mañana),
// dónde se entrega (tarde) o las dos cosas (el caso típico de una mudanza).
export type AlcanceCambio = "recogida" | "entrega" | "ambas";

// Datos que el padre llena para inscribir a un hijo. El formulario es
// condicional por turno: si viaja solo en la mañana, alcanza con la casa y la
// escuela; si también viaja en la tarde, puede indicar una entrega distinta.
export interface DatosInscripcion {
  nombre: string;
  grado: string;
  escuelaId: string;
  turno: TurnoNino;
  casa: ParadaNino; // dónde se recoge en la mañana (y se entrega en la tarde, por defecto)
  entregaTarde?: ParadaNino; // solo si en la tarde se deja en OTRO lugar
  foto?: string;
}

export interface Solicitud {
  id: string;
  tipo: TipoSolicitud;
  padreId: string; // quién la envió
  estado: EstadoSolicitud;
  creadaEn: Timestamp;

  // --- tipo 'inscripcion' ---
  datosNino?: DatosInscripcion;

  // --- tipo 'cambio_ubicacion' ---
  // Se piden con 24 h de anticipación: `fechaAplicacion` nunca puede ser hoy ni
  // mañana temprano (la app valida que el día empiece al menos 24 h después).
  // Un cambio de UN DÍA no toca el perfil del niño: el conductor lo ve como
  // aviso solo esa fecha y al día siguiente todo vuelve a la normalidad.
  ninoId?: string; // a qué hijo aplica
  permanente?: boolean; // true = mudanza (actualiza el perfil); false = solo un día
  fechaAplicacion?: string; // "YYYY-MM-DD" del día puntual (solo si !permanente)
  alcance?: AlcanceCambio; // qué lado cambia: recogida, entrega o ambas
  nuevaUbicacion?: ParadaNino; // incluye su punto de referencia
  motivo?: string; // texto libre del padre

  // --- respuesta del admin ---
  respuesta?: string; // nota opcional al aprobar/rechazar
  resueltaEn?: Timestamp;
}
