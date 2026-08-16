# Casos de prueba — Sistema de Transporte Escolar Inversiones Perez

> Documento de la **Fase 9**. Sirve como base del capítulo de pruebas del informe
> de graduación. Cada caso está pensado para ejecutarse a mano (pruebas de
> aceptación / caja negra) sobre el sistema real conectado a Firebase.
>
> **Convenciones.** Rol que ejecuta: **A** = admin (panel web), **C** = conductor
> (app móvil), **P** = padre (app móvil). "Turno actual" = mañana si la hora del
> sistema es antes del mediodía, tarde si es después (así lo resuelve la app).
>
> **Datos base sugeridos.** Cargar el seed desde el panel web (`/datos-prueba`,
> elegir 2 conductores) o los datos reales. Varios casos usan al niño **Pedro
> López**, que hace transbordo en "Plaza Cabotaje".

---

## 1. Autenticación y roles

| ID | Precondición | Pasos | Resultado esperado |
|----|--------------|-------|--------------------|
| AUT-01 | Cuenta admin existente | En la web, iniciar sesión con el correo y contraseña del admin | Entra al panel; se ve el Dashboard y el nombre del admin en el header |
| AUT-02 | — | En la web, intentar iniciar sesión con contraseña incorrecta | Mensaje de error; no entra |
| AUT-03 | Cuenta de conductor | En la app móvil, iniciar sesión como conductor | Redirige a "Mi ruta de hoy"; no muestra secciones de admin ni de padre |
| AUT-04 | Cuenta de padre | En la app móvil, iniciar sesión como padre | Redirige a "Mis hijos" |
| AUT-05 | Sesión de conductor iniciada | Cerrar la app por completo y volver a abrirla | La sesión persiste (no vuelve a pedir login) |
| AUT-06 | Usuario admin | En la app móvil, iniciar sesión como admin | Aviso "los administradores usan el panel web"; opción de cerrar sesión |
| AUT-07 | Cualquier rol logueado | Presionar "Cerrar sesión" | Vuelve a la pantalla de login |
| AUT-08 | — | Verificar que no exista ninguna pantalla de registro público | No hay forma de crear una cuenta sin ser admin |

## 2. Gestión de conductores y padres (CRUD usuarios)

| ID | Precondición | Pasos | Resultado esperado |
|----|--------------|-------|--------------------|
| USR-01 | A logueado | Crear un conductor con nombre, teléfono y correo reales | Se crea; aviso "le llegará un correo para definir su contraseña". La sesión del admin **no** se cierra |
| USR-02 | USR-01 | Revisar el correo del conductor | Llega un correo de restablecimiento de contraseña de Firebase |
| USR-03 | A logueado | Crear un padre igual que USR-01 | Se crea sin perder la sesión del admin |
| USR-04 | Correo ya usado | Crear un usuario con un correo que ya existe | Error "ya existe una cuenta con ese correo"; no se duplica |
| USR-05 | Usuario existente | Editar su nombre/teléfono | Se guarda; el correo y el rol no son editables |
| USR-06 | Usuario existente | Desactivar con el switch "activo" | Queda inactivo; no se borra (se conserva el historial) |

## 3. Buses, escuelas y puntos (CRUD)

| ID | Precondición | Pasos | Resultado esperado |
|----|--------------|-------|--------------------|
| BUS-01 | Hay conductores | Crear un bus (placa, capacidad, conductor) | Aparece en la lista |
| BUS-02 | Bus existente | Editar la placa/capacidad/conductor | Se guarda |
| ESC-01 | A logueado | Crear una escuela y marcar su ubicación en el mapa (clic) | Se guarda con lat/lng; el marcador queda donde se hizo clic |
| PUN-01 | A logueado | Crear un punto de transbordo y marcarlo en el mapa | Se guarda; queda disponible para armar transbordos |

## 4. Niños (CRUD)

| ID | Precondición | Pasos | Resultado esperado |
|----|--------------|-------|--------------------|
| NIN-01 | Hay padres y escuelas | Crear un niño (nombre, grado, padre, escuela, turno, casa en el mapa) | Se crea con su parada (casa) y turno |
| NIN-02 | Niño existente | Editar su escuela o turno | Se guarda |
| NIN-03 | Niño existente | Desactivarlo | Queda inactivo; deja de contar en el dashboard y de aparecer en rutas |

## 5. Rutas y armado (incluye configuración de transbordo)

| ID | Precondición | Pasos | Resultado esperado |
|----|--------------|-------|--------------------|
| RUT-01 | Hay bus, escuela y niños del turno | Crear una ruta: elegir unidad, turno, escuela(s) y marcar niños | Se guarda; escribe `ninoIds` y `ninos` (con subeEn/bajaEn directo por defecto) |
| RUT-02 | RUT-01 | Volver a abrir la ruta | Los niños marcados aparecen seleccionados |
| RUT-03 | Un niño ya viaja en otra ruta activa del mismo turno | Intentar marcarlo en una segunda ruta | Aparece bloqueado con "Ya viaja en la ruta X (bus Y)" |
| RUT-04 | Ruta con un niño cuya escuela no está en la ruta y sin transbordo | Guardar | Se bloquea el guardado pidiendo agregar la escuela o marcar transbordo |
| RUT-05 | Hay un punto de transbordo | Marcar a un niño con transbordo: niño + punto + "lo sigue el bus X" | Se guarda; la ruta receptora se actualiza sola y muestra al niño como recibido (solo lectura) |
| RUT-06 | RUT-05 | Destildar al niño con transbordo | Se quita también su transbordo de la ruta receptora |

## 6. Herramientas de datos (migración / seed)

| ID | Precondición | Pasos | Resultado esperado |
|----|--------------|-------|--------------------|
| MIG-01 | Rutas viejas con solo `ninoIds` | Ejecutar `/migracion` | Convierte a `ninos`+`paradas`; correrla de nuevo no duplica (idempotente) |
| SEED-01 | 2 conductores creados | En `/datos-prueba`, elegir 2 conductores y "Cargar" | Crea 2 escuelas, 1 punto, 2 buses, 1 padre, 5 niños y 2 rutas del turno actual, con Pedro López en transbordo |

## 7. Viaje del conductor (Fase 4)

| ID | Precondición | Pasos | Resultado esperado |
|----|--------------|-------|--------------------|
| VIA-01 | C con bus y ruta del turno actual | Abrir "Mi ruta de hoy" | Muestra la ruta del turno, el bus y los niños agrupados por casa/escuela |
| VIA-02 | VIA-01 | Presionar "Iniciar viaje" | El viaje pasa a en curso; aparece el chip de estado GPS |
| VIA-03 | Viaje en curso, permiso de ubicación dado | Moverse con el teléfono | La ubicación se actualiza en `ubicaciones/{viajeId}` cada ~15 s |
| VIA-04 | Viaje en curso, turno mañana | Marcar "Subió" a un niño en su casa | El niño pasa a "en el bus"; el contador sube |
| VIA-05 | Grupo con hermanos en una casa | Presionar "Todos subieron" | Todos los del grupo quedan marcados de una vez |
| VIA-06 | Niño en el bus | Marcar "Bajó" al llegar a la escuela | El niño pasa a "entregado"; el botón "Bajó" solo estaba habilitado estando en el bus |
| VIA-07 | Viaje en curso | Presionar "Finalizar viaje" y confirmar | El viaje queda finalizado; se borra `ubicaciones/{viajeId}` (el bus deja de estar en vivo) |
| VIA-08 | El admin edita la ruta durante el día | El admin agrega/quita un niño de la ruta | La pantalla del conductor lo refleja sin recargar (tiempo real) |
| VIA-09 | Viaje del turno ya finalizado | Intentar iniciar otro del mismo turno | No permite reiniciar el turno ya cerrado |

## 8. Transbordo en operación (conductor)

| ID | Precondición | Pasos | Resultado esperado |
|----|--------------|-------|--------------------|
| TRA-01 | Ruta con punto de transbordo, viaje en curso | Abrir "Transbordo en [punto]" | Muestra sección ENTREGA (mis niños que bajan en el punto) y/o RECIBE |
| TRA-02 | Bus emisor (Pedro baja en el punto) | Marcar "Entregar" a Pedro | Queda registrado en el punto; el bus receptor lo ve en su lista en vivo |
| TRA-03 | Bus receptor | Ver la lista de recepción | Se llena sola con lo que dejó el otro bus (leído de `registros`, no de la ruta ajena) |
| TRA-04 | TRA-03 | Confirmar "Subió" a Pedro en el receptor | Pedro queda a bordo del segundo bus |
| TRA-05 | Receptor confirma un niño que el emisor no entregó | Marcarlo igual | Se registra como **discrepancia** (manda la recepción; queda para el admin) |
| TRA-06 | Un niño del receptor cuya escuela no cubre ese bus | Verlo en la lista | Muestra la advertencia "este bus no va a su escuela" (no bloquea) |
| TRA-07 | No se puede esperar al otro bus | Presionar "Esperar" | El viaje queda marcado `demorado` |
| TRA-08 | Quedan niños sin confirmar | Presionar "Continuar sin transbordo" y confirmar | Los pendientes quedan como `excepcion` en el punto para que el admin los revise |

## 9. Vistas del padre (Fase 5)

| ID | Precondición | Pasos | Resultado esperado |
|----|--------------|-------|--------------------|
| PAD-01 | P con hijos | Abrir "Mis hijos" | Lista cada hijo con su estado (en casa / en el bus / entregado) según el último registro |
| PAD-02 | Un hijo con viaje en curso | Presionar "Ver bus en vivo" | Abre el mapa; el marcador 🚌 se mueve y el 📍 de la casa queda fijo |
| PAD-03 | El conductor finaliza el viaje | Observar el mapa del padre | El chip cambia a "viaje finalizado" (detecta el borrado de la ubicación) |
| PAD-04 | P con hijos | Abrir "Historial" y cambiar de día con las flechas | Muestra los registros del hijo en la fecha elegida |
| PAD-05 | P sin viaje en curso | Ver la tarjeta del hijo | "Ver bus en vivo" está deshabilitado con la aclaración correspondiente |

## 10. Notificaciones push (Fase 6)

> Requiere APK / development build (Expo Go en Android no recibe push remotas) y
> reglas desplegadas. El padre debe haber abierto la app al menos una vez (para
> registrar su token).

| ID | Precondición | Pasos | Resultado esperado |
|----|--------------|-------|--------------------|
| NOT-01 | P abrió la app y aceptó el permiso | Revisar `usuarios/{uid}` del padre | Tiene `expoPushToken` guardado |
| NOT-02 | Viaje en curso; C marca "Subió" al hijo del padre | Con la app del padre cerrada | Llega push "[Niño] subió al bus" |
| NOT-03 | C marca "Bajó" (entrega en la escuela/casa) | — | Llega push "[Niño] llegó a la escuela/casa" |
| NOT-04 | Bus a menos de 400 m de la casa de un niño pendiente | El bus se acerca | Llega push "el bus está cerca" una sola vez por viaje para ese niño |
| NOT-05 | Hermanos en la misma casa | El bus se acerca | Un solo push que nombra a ambos hermanos |
| NOT-06 | Entrega de un niño en un punto de transbordo | C marca la entrega | El padre recibe un aviso neutro ("sigue en camino"); nunca se le menciona el cambio de bus |

## 11. Chat (Fase 7)

| ID | Precondición | Pasos | Resultado esperado |
|----|--------------|-------|--------------------|
| CHA-01 | P con un hijo asignado a una ruta | Abrir "Mensajes" | Aparecen "Administración" y el conductor de la ruta de su hijo |
| CHA-02 | CHA-01 | Escribirle al conductor | El conductor lo ve en tiempo real en su bandeja y en el chat |
| CHA-03 | C con padres en su ruta | Abrir "Mensajes" | Aparecen "Administración" y los padres de los niños de su ruta |
| CHA-04 | Conversación con mensajes sin leer | Recibir un mensaje sin abrir el chat | El badge de no leídos aumenta en el botón "Mensajes" y en la fila del contacto |
| CHA-05 | CHA-04 | Abrir el chat | Los mensajes se marcan como leídos; el badge desaparece |
| CHA-06 | Chat abierto | Presionar el ícono de teléfono | Abre el marcador del sistema con el número del otro (llamada directa) |
| CHA-07 | A en el panel web | Abrir "Mensajes", elegir un padre y escribirle | El padre lo recibe; el admin ve la conversación en vivo |
| CHA-08 | App del destinatario cerrada (móvil) | Enviarle un mensaje desde la app | Llega push con el nombre del remitente y el texto |

## 12. Supervisión y reportes (Fase 8)

| ID | Precondición | Pasos | Resultado esperado |
|----|--------------|-------|--------------------|
| SUP-01 | Uno o más viajes en curso con GPS | A abre "Supervisión" | El mapa muestra un 🚌 por bus en curso; el tooltip da ruta/conductor/placa |
| SUP-02 | Viaje en curso sin GPS todavía | Ver la lista lateral | El viaje aparece con la etiqueta "Sin señal" y no en el mapa |
| SUP-03 | Viaje finaliza | Observar el mapa | El bus desaparece del mapa (se borró su ubicación) |
| REP-01 | Hay viajes en un rango de fechas | En "Reportes → Viajes", elegir el rango y "Buscar" | Tabla con fecha, ruta, conductor, bus, estado, horas y niños transportados |
| REP-02 | REP-01 | Filtrar por ruta o conductor | La tabla se acota al filtro |
| REP-03 | REP-01 | Presionar "Exportar CSV" | Descarga un CSV que abre bien en Excel (acentos correctos) |
| REP-04 | Un niño con registros | En "Reportes → Por niño", elegirlo | Muestra su historial de asistencia (fecha, ruta, subió/bajó, hora) |
| REP-05 | REP-04 | "Exportar CSV" | Descarga el historial del niño en CSV |

## 13. Seguridad — casos negativos (reglas de Firestore)

> Se pueden verificar desde el simulador de reglas de la consola de Firebase o
> intentando la operación con una sesión del rol indicado.

| ID | Rol | Intento | Resultado esperado |
|----|-----|---------|--------------------|
| SEG-01 | Sin sesión | Leer cualquier colección | Denegado (nada es público) |
| SEG-02 | P | Leer un niño que no es su hijo | Denegado |
| SEG-03 | P | Leer los registros de un niño ajeno | Denegado |
| SEG-04 | P | Crear/editar un niño, ruta o bus | Denegado (escritura solo admin) |
| SEG-05 | C | Editar un viaje cuyo `conductorId` no es el suyo | Denegado |
| SEG-06 | C | Escribir la ubicación de un viaje ajeno | Denegado |
| SEG-07 | P o C | Cambiarse el rol en su propio doc de usuario | Denegado (la regla exige que el rol no cambie) |
| SEG-08 | P/C/A | Leer una conversación en la que no participa | Denegado |
| SEG-09 | Destinatario de un mensaje | Marcarlo como leído | Permitido (solo el `para` puede) |
| SEG-10 | Remitente | Crear un mensaje poniendo a otro como `de` | Denegado (solo puede crear con `de` == su uid) |
| SEG-11 | A | Cualquier lectura/escritura de configuración | Permitido |
