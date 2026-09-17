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

  // Registro de `auditoria` que acompañó el último cambio sensible de esta
  // cuenta (rol, activo, archivado, correo). Ver el bloque "AUDITORÍA" al final.
  auditoriaId?: string;
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
  conductorId: string; // referencia a Usuario.id (el TITULAR; ver "SUPLENCIAS" al final)
  foto?: string; // foto de la unidad (base64 comprimida — la sube el admin, la ve el padre)
  activo: boolean;
  auditoriaId?: string; // último cambio sensible (conductor, activo) — ver "AUDITORÍA"
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

  // Hora de salida programada, "HH:mm" en 24 h (ej. "06:15"). Es SOLO
  // INFORMATIVA: la carga el admin para que el conductor sepa su horario. No
  // restringe cuándo se puede iniciar el viaje ni dispara ningún aviso.
  horaSalida?: string;

  auditoriaId?: string; // último cambio sensible (unidad, niños, activa) — ver "AUDITORÍA"

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

  // Uids de los conductores que llevan a este niño: el titular de cada unidad
  // de sus rutas activas, más el suplente si hay una suplencia vigente. Es un
  // dato DERIVADO que recalcula el panel (services/accesoConductoresService.ts)
  // y existe por seguridad: las reglas de Firestore solo le dejan leer al niño
  // —su casa, su foto— a un conductor que esté en esta lista. Nadie lo edita a
  // mano; si se tocara, la próxima sincronización lo corrige.
  conductorIds?: string[];

  auditoriaId?: string; // último cambio sensible (padre, casa, activo) — ver "AUDITORÍA"

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
  // Las mismas dos horas, pero puestas por el SERVIDOR (serverTimestamp). La del
  // teléfono sirve para mostrar; la del servidor es la que vale como evidencia,
  // porque no depende de que el reloj del teléfono esté bien. Las reglas de
  // Firestore rechazan un viaje sin ellas.
  horaInicioServidor?: Timestamp;
  horaFinServidor?: Timestamp;
  demorado?: boolean; // contingencia de transbordo: el conductor marcó que está esperando
  tipo?: TipoViaje; // (viejo AM/PM) ya no se usa; se elimina en la limpieza final
}

// --- Colección: registros (asistencia) ---
// 'no_estaba' es el caso más delicado del servicio: el bus llegó a la parada y
// el niño NO estaba ahí. Antes esto no se registraba en ningún lado, así que el
// fallo quedaba invisible: no había constancia de que el bus hubiera pasado, y
// la discusión terminaba siendo "el bus nunca vino" contra "esperamos y no
// había nadie".
//
// Al ser un registro más, hereda todo lo bueno del modelo: queda con su hora,
// su viaje y su niño; es inmutable (una corrección es un registro nuevo); lo
// ve el padre en su historial; y el admin puede contarlo en los reportes para
// hablar con las familias que se repiten.
//
// ⚠️ CUIDADO AL LEERLO: durante mucho tiempo el evento fue binario y el código
// preguntaba `evento === 'subio' ? subió : bajó`. Con este tercer valor, esa
// pregunta daría "bajó" para un niño que nunca subió. Todos esos lugares ya se
// corrigieron; si agregás uno nuevo, no asumas que solo hay dos eventos.
// 'anulado' es el DESHACER del conductor: marcó algo por error —un dedazo con
// el bus en movimiento, el niño equivocado de una fila— y lo corrige.
//
// No borra ni edita el registro anterior, porque los registros son inmutables:
// AGREGA uno que cancela al inmediato anterior de ese niño. Así queda la
// historia completa de lo que pasó (se marcó, se corrigió), que es justamente
// lo que hace falta cuando el padre pregunta por qué recibió un aviso raro.
//
// Cómo se lee: ver `registrosEfectivos()` en utils/eventos.ts. Un 'anulado'
// tacha al anterior y el estado del niño se calcula con lo que queda en pie.
export type EventoRegistro = "subio" | "bajo" | "no_estaba" | "anulado";

export interface Registro {
  id: string;
  viajeId: string;
  ninoId: string;
  evento: EventoRegistro;
  // `hora` es la del TELÉFONO en el momento de marcar: es la que se muestra y la
  // que ordena los eventos (sin señal, el registro puede llegar al servidor
  // mucho después). `horaServidor` la pone Firestore al recibirlo y es la que
  // vale como evidencia, porque no depende del reloj del teléfono. Si las dos
  // difieren mucho, o el teléfono tenía mal la hora, o el registro viajó sin señal.
  hora: Timestamp;
  horaServidor?: Timestamp;
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
  // Nombre y escuela del niño, COPIADOS por el bus que lo entrega en el punto.
  // El bus que lo recibe puede no tener permiso para leer a ese niño (si el
  // otro conductor lo bajó por excepción, no está en su ruta): así igual sabe a
  // quién está recibiendo y si su bus pasa por esa escuela.
  ninoNombre?: string;
  ninoEscuelaId?: string;
}

// --- Colección: ubicaciones (tracking GPS en vivo) ---
export interface UbicacionActual {
  viajeId: string; // mismo id que el viaje, un doc por viaje activo
  lat: number;
  lng: number;
  timestamp: Timestamp;
  // Padres de los niños de la ruta. Las reglas solo les dejan ver la posición a
  // ellos: un padre no puede seguir a un bus que no lleva a su hijo.
  padreIds?: string[];
}

// --- Colección: mensajes (chat padre-conductor/admin) ---
export interface Mensaje {
  id: string;
  conversacionId: string; // ej: `${padreId}_${conductorId}`
  de: string; // Usuario.id del remitente
  para: string; // Usuario.id del destinatario
  texto: string;
  hora: Timestamp; // la del teléfono: ordena el chat aunque no haya señal
  horaServidor?: Timestamp; // la del servidor: la que vale como constancia (la exigen las reglas)
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
// ⚠️ Hay DOS naturalezas distintas acá dentro, y conviene tenerlas claras:
//
//   PEDIDOS (inscripcion, cambio_ubicacion, cambio_escuela, cambio_turno):
//   cambian la configuración del servicio, así que nacen 'pendiente' y no pasa
//   nada hasta que el admin aprueba desde el panel web.
//
//   AVISOS (ausencia_dia): NO cambian ninguna configuración; solo le dicen al
//   conductor que hoy no pase por ese niño. Nacen ya 'aprobada' porque no hay
//   nada que aprobar — y sobre todo porque tienen que servir EL MISMO DÍA: un
//   niño se enferma a las 5 de la mañana y el bus pasa a las 6:40. Si esperaran
//   aprobación, llegarían tarde siempre y nadie los usaría.
//   (La regla de Firestore contempla esta excepción explícitamente.)
export type TipoSolicitud =
  | "inscripcion"
  | "cambio_ubicacion"
  | "cambio_escuela"
  | "cambio_turno"
  | "ausencia_dia";
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

  // --- tipo 'cambio_escuela' ---
  // ⚠️ Aprobarlo NO alcanza con cambiar este campo: una ruta sirve a escuelas
  // concretas (ruta.escuelaIds), así que el niño puede quedar en una ruta que ya
  // no pasa por su colegio nuevo. El panel avisa que hay que reasignarlo.
  nuevaEscuelaId?: string;

  // --- tipo 'cambio_turno' ---
  // Mismo cuidado que arriba: una ruta tiene turno, así que pasar de 'manana' a
  // 'ambos' exige sumarlo también a una ruta de la tarde.
  nuevoTurno?: TurnoNino;

  // --- tipo 'ausencia_dia' ---
  // Solo usa `ninoId` + `fechaAplicacion` (el día que no viaja) + `motivo`.
  // No tiene nada que aprobar; ver el comentario de TipoSolicitud.

  motivo?: string; // texto libre del padre

  // --- respuesta del admin ---
  respuesta?: string; // nota opcional al aprobar/rechazar
  resueltaEn?: Timestamp;
}

// --- Colección: incidencias (novedades del viaje) ---
// Lo que el conductor reporta EN MEDIO del viaje y no es una marca de
// asistencia: se pinchó una rueda, hay un tranque, se largó a llover.
//
// POR QUÉ ES UNA COLECCIÓN PROPIA Y NO UN MENSAJE DE CHAT: un chat es una
// conversación entre dos, y esto es un anuncio de uno a muchos —a todos los
// padres que tienen un hijo arriba del bus, y a la administración— que además
// tiene que quedar REGISTRADO. Si mañana un padre pregunta por qué el bus llegó
// cuarenta minutos tarde, la respuesta tiene que estar guardada con su hora,
// su ruta y su unidad, no perdida en una conversación.
//
// Al padre le llega solo la notificación (no lee esta colección: no tiene por
// qué ver las novedades de rutas ajenas). El admin sí la lee entera.
export type TipoIncidencia = "averia" | "trafico" | "clima" | "demora" | "otro";

export interface Incidencia {
  id: string;
  // El viaje en curso. Puede ser null si el conductor reporta algo antes de
  // iniciar (por ejemplo, que la unidad no arranca).
  viajeId: string | null;
  rutaId: string;
  busId: string;
  conductorId: string;
  // Se guardan COPIADOS el nombre de la ruta, la placa y el nombre del
  // conductor. Es duplicar datos a propósito: el admin tiene que poder leer
  // "Don Carlos, unidad HAB-1234, ruta Mañana El Naranjal" de un solo
  // documento, sin encadenar tres lecturas más; y si mañana esa unidad se da de
  // baja o cambia de conductor, el registro histórico tiene que seguir diciendo
  // lo que pasó ESE día.
  rutaNombre: string;
  busPlaca: string;
  conductorNombre: string;
  tipo: TipoIncidencia;
  // Lo que escribió el conductor. Puede ir vacío: el tipo ya dice lo esencial,
  // y a mitad de viaje escribir cuesta.
  texto: string;
  hora: Timestamp;
  horaServidor?: Timestamp; // la que vale como constancia (la exigen las reglas)
  // Cuántos niños iban a bordo cuando pasó. Es un número y no la lista de ids
  // a propósito: le da al admin la dimensión del problema sin poner datos de
  // niños en un documento que no los necesita.
  ninosABordo: number;
}

// ============================================
// SUPLENCIAS (colección: suplencias)
// ============================================
// Cuando el conductor titular de una unidad no puede trabajar un día (se
// enfermó, tiene un trámite), el admin asigna a OTRO conductor para esa unidad
// y esa fecha. Ese día:
//   - el suplente ve en su app las rutas de esa unidad y es el único que puede
//     iniciar sus viajes (lo exigen las reglas de Firestore);
//   - el titular ve "Hoy te cubre …" y no puede iniciarlos;
//   - el padre ve al suplente en "quién lleva a tu hijo", con su teléfono;
//   - al día siguiente todo vuelve solo a la normalidad: la asignación
//     permanente de la unidad (Bus.conductorId) nunca se tocó.
//
// El id del documento es "<busId>_<fecha>": una sola suplencia por unidad por
// día, y las reglas la encuentran sin tener que buscarla. No se borran: se
// cancelan, y cada cambio queda en la auditoría.
export interface Suplencia {
  id: string; // "<busId>_<fecha>"
  busId: string;
  busPlaca: string; // copiada: el conductor la lee sin consultar la unidad
  fecha: string; // "YYYY-MM-DD"
  titularId: string;
  titularNombre: string; // copiado: el titular no puede leer el perfil de otro conductor
  conductorId: string; // el SUPLENTE
  conductorNombre: string;
  cancelada?: boolean;
  creadaEn: Timestamp;
  auditoriaId?: string;
}

// ============================================
// AUDITORÍA (colección: auditoria)
// ============================================
// Quién hizo un cambio sensible desde el panel, cuándo (hora del servidor) y
// qué cambió. Cada cambio sensible viaja en el MISMO lote que su registro y las
// reglas de Firestore rechazan el cambio si el registro no está. Los registros
// no se editan ni se borran, ni siquiera el admin.
export type ColeccionAuditada = "usuarios" | "ninos" | "buses" | "rutas" | "suplencias";

export interface CambioAuditado {
  campo: string;
  antes: string; // ya en texto legible ("—" si no había valor)
  despues: string;
}

export interface Auditoria {
  id: string;
  actorId: string; // uid del admin que hizo el cambio
  accion: string; // "crear", "editar", "desactivar", "archivar", "asignar_suplente"…
  coleccion: ColeccionAuditada;
  docIds: string[]; // los documentos que tocó
  detalle: string; // resumen en palabras
  cambios?: CambioAuditado[]; // campo por campo, cuando aplica
  hora: Timestamp;
}

// ============================================
// RECORRIDOS (colección: recorridos)
// ============================================
// El camino que hizo el bus en un viaje: un punto por minuto mientras el viaje
// está en curso. `ubicaciones` guarda solo la ÚLTIMA posición (se pisa); esto
// es lo que permite, días después, reconstruir por dónde pasó el bus ante un
// reclamo. Un documento por viaje (id = id del viaje). Las reglas solo dejan
// AGREGAR puntos: nadie puede reescribir el camino después.
export interface PuntoRecorrido {
  lat: number;
  lng: number;
  t: Timestamp; // hora del teléfono en ese punto
}

export interface Recorrido {
  viajeId: string;
  rutaId: string;
  busId: string;
  conductorId: string;
  fecha: string; // "YYYY-MM-DD"
  puntos: PuntoRecorrido[];
}
