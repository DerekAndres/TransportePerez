# Insumos para el informe — 5.7 Análisis de Requerimientos

> **Cómo usar este documento.** Es material de apoyo para redactar las secciones
> 5.7.1, 5.7.2 y 5.7.3 del informe de graduación. Está organizado igual que el
> informe, pero **no es el texto final**: hay tablas para copiar, cifras para
> citar y párrafos de justificación para reescribir con tus palabras.
>
> **Qué está verificado y qué no.** Todo lo marcado como *(verificado)* se leyó
> de los archivos reales del proyecto o de la fuente oficial, con fecha
> 2026-08-20. Lo marcado como *(estimación)* son supuestos de trabajo que
> **tenés que validar con Francis Perez** antes de ponerlos en el informe: yo no
> conozco el tamaño real de la flota ni la cantidad de estudiantes.

---

# 5.7.1 Características de los usuarios finales

## Panorama

El sistema tiene **tres perfiles de usuario**, definidos en el modelo de datos
como el tipo `Rol = "admin" | "conductor" | "padre"` *(verificado:
`types/models.ts`)*. No existe un cuarto perfil ni registro público: **todas las
cuentas las crea el administrador**, de modo que "usuario autenticado" equivale
a "persona conocida por la empresa".

Los tres perfiles se diferencian en tres ejes que condicionaron todo el diseño:
**qué dispositivo usan**, **en qué contexto físico lo usan** y **cuánta
alfabetización digital se les puede exigir**.

## Perfil 1 — Administrador

| Atributo | Descripción |
| --- | --- |
| Quién es | Francis Perez (propietaria de Inversiones Perez) y el personal administrativo que designe |
| Cantidad | 1 cuenta activa actualmente *(verificado: `admin@transporteperez.com`)* |
| Formación | Gestión del negocio de transporte; no requiere formación informática |
| Alfabetización digital | Media: uso cotidiano de computadora, navegador, mensajería |
| Dispositivo principal | Computadora de escritorio o laptop (panel web) |
| Dispositivo secundario | Teléfono Android (app móvil, sección de administración) |
| Contexto de uso | Oficina, sentada, sin apuro, con conexión estable |
| Frecuencia | Diaria: al inicio y al cierre de la jornada, más consultas puntuales |

**Funciones que ejecuta** *(verificado: 16 pantallas del panel web)*: gestión de
conductores y padres, buses, escuelas, puntos de transbordo, niños y rutas;
armado de rutas sobre mapa; aprobación o rechazo de solicitudes; publicación de
avisos por canal; supervisión de todos los buses en viaje; reportes con
exportación a CSV; historial y restauración de registros archivados; chat con
cualquier conductor o padre.

**Consecuencia de diseño:** es el único perfil donde **se admite densidad de
información**. Puede haber tablas, filtros, formularios largos y mapas de
edición, porque tiene pantalla grande, teclado y tiempo. Es también el único que
recibe formación explícita sobre el sistema.

**Por qué la app móvil del admin es deliberadamente reducida:** solo monitoreo,
mensajes y publicación de avisos. Crear usuarios, buses, escuelas, niños y rutas
sigue siendo exclusivo del panel web, porque esas tareas necesitan pantalla
grande y mapas de edición. La app le da lo que necesita **estando en la calle**.

## Perfil 2 — Conductor

| Atributo | Descripción |
| --- | --- |
| Quién es | Los conductores de las unidades de la empresa |
| Cantidad | *(estimación — validar)* una por unidad en operación |
| Formación | Licencia de conducir para transporte; educación media o menor |
| Alfabetización digital | **Básica**: usa mensajería y llamadas; no necesariamente instala apps ni configura opciones |
| Dispositivo | Teléfono Android propio, frecuentemente de gama baja |
| Contexto de uso | **De pie o al volante con el bus detenido, a plena luz solar, con ruido, con niños subiendo y con muy poco tiempo por parada** |
| Frecuencia | Dos veces al día (turno de mañana y turno de tarde), todos los días de clase |

**Funciones que ejecuta** *(verificado: `app/(conductor)/`)*: ver su ruta del
día, iniciar y finalizar el viaje, marcar quién sube y quién baja, ver el
recorrido en el mapa, ejecutar un transbordo (entregar o recibir niños en un
punto), y conversar o llamar a un padre.

**Consecuencias de diseño — este es el perfil que más restringe el sistema:**

- **Botones grandes y un botón principal fijo abajo** (iniciar/finalizar viaje),
  alcanzable con el pulgar sin mirar.
- **Dos estados como máximo por niño** (pendiente / listo) y opción "Todos"
  siempre visible, para resolver una parada con un toque.
- **Cero configuración.** El GPS arranca solo al iniciar el viaje; el conductor
  nunca elige ruta, turno ni ajustes. El turno se deduce de la hora del sistema.
- **El transbordo no le exige entender el concepto:** quien entrega decide, y
  quien recibe confirma una lista que se llena sola.
- **Tolerancia a la falta de señal:** los avisos que no salen se encolan en el
  teléfono y se reintentan solos *(verificado: cola en `AsyncStorage`, vigencia
  de 3 horas)*, porque en El Porvenir y El Pino perder cobertura es normal.

**Limitación asumida y declarable:** la emisión de ubicación funciona **solo con
la aplicación abierta en primer plano** *(verificado:
`hooks/use-emision-ubicacion.ts`)*. El procedimiento operativo es que el
conductor deje el teléfono en el soporte con la app abierta durante el viaje.
Conviene documentarlo como restricción, no esconderlo: la alternativa (ubicación
en segundo plano) exige código nativo adicional y no se puede probar en Expo Go.

## Perfil 3 — Padre, madre o encargado

| Atributo | Descripción |
| --- | --- |
| Quién es | El adulto responsable de cada estudiante transportado |
| Cantidad | *(estimación — validar)* uno por familia; una familia puede tener varios hijos |
| Formación | **Heterogénea**: es el grupo más diverso del sistema |
| Alfabetización digital | **Baja a media, no asumible.** Es el criterio de diseño más exigente |
| Dispositivo | Teléfono Android propio, gama baja frecuente, plan de datos limitado |
| Contexto de uso | En su casa o en el trabajo, en momentos sueltos, revisando "¿ya subió?" |
| Frecuencia | Pasiva la mayor parte del tiempo: **recibe** avisos más de lo que **entra** a la app |

**Funciones que ejecuta** *(verificado: `app/(padre)/`)*: ver el estado actual de
cada hijo (en casa / en el bus / entregado), ver el bus en el mapa en vivo,
consultar el historial, leer los avisos de la escuela, escribirle al conductor o
a la administración, llamar por teléfono, solicitar la inscripción de un hijo y
solicitar un cambio de lugar de recogida o entrega.

**Consecuencias de diseño:**

- **No se le agrega ningún concepto nuevo.** No hay filtros, ni configuración, ni
  vocabulario del sistema. El principio rector es que un padre **no debería
  necesitar aprender nada** para usarlo.
- **El transbordo es invisible para él.** Aunque su hijo cambie de bus, el padre
  recibe un aviso neutro ("sigue en camino") y ve un marcador que se sigue
  moviendo. Nunca se le explica que hubo dos unidades.
- **La información llega sola.** El canal principal no es la pantalla: es la
  notificación push, que aparece **aunque la aplicación esté cerrada**, porque la
  dibuja el sistema operativo y no la app.
- **Bajo consumo de datos.** El documento de ubicación se **sobrescribe** en vez
  de acumular historial, y se actualiza como máximo cada 15 segundos.

## Tabla comparativa (para el informe)

| Criterio | Administrador | Conductor | Padre / encargado |
| --- | --- | --- | --- |
| Plataforma | Web (+ móvil reducida) | Móvil | Móvil |
| Alfabetización digital exigida | Media | Básica | **Ninguna asumible** |
| Contexto físico | Oficina, sin apuro | Vía pública, con apuro | Cotidiano, atención parcial |
| Densidad de información admitida | Alta | Mínima | Mínima |
| Capacitación requerida | Sí, formal | Breve, demostrativa | **Ninguna** |
| Rol frente al dato | Lo configura | Lo genera | Lo consume |
| Modo de interacción dominante | Activo | Activo, por ráfagas | **Pasivo (recibe avisos)** |

## Decisiones de accesibilidad y usabilidad derivadas de estos perfiles

Esta subsección es valiosa en la defensa, porque conecta las características de
los usuarios con decisiones concretas y medibles.

- **Contraste verificado contra la norma WCAG AA (4.5:1).** Los cuatro colores
  de estado del sistema fueron medidos sobre fondo blanco *(verificado:
  `constants/tema.ts`)*: azul 6.21:1, verde 5.28:1, ámbar 5.87:1 y rojo 8.16:1.
  Todos superan el mínimo, lo que importa en un teléfono usado **a plena luz
  solar** dentro de un bus.
- **El color nunca comunica solo.** El azul (en curso) y el verde (completado)
  tienen luminancia casi idéntica (contraste de 1.12:1 entre sí), o sea que se
  distinguen por tono pero no por claridad. Por eso todo estado va acompañado de
  **un ícono y una palabra**: quien no distingue esos tonos igual entiende la
  pantalla. Es una limitación **detectada, documentada y mitigada**, no un
  descuido.
- **Semántica de color convencional:** azul "está pasando ahora" → verde "ya se
  cumplió", que es la convención que la mayoría de la gente ya conoce.
- **Todo el texto visible está en español**, igual que los campos de la base de
  datos, por decisión de estándar de código.
- **Orientación vertical fija** y adaptación a teléfonos con barra de gestos o
  con los tres botones de Android, para que ninguna acción quede fuera de
  alcance.
- **La aplicación sigue el modo claro u oscuro del teléfono**, sin pedirle al
  usuario que lo configure.

## Supuestos a validar con la empresa antes de redactar

Anotá estos datos con Francis y reemplazá las estimaciones:

1. Cantidad de unidades (buses) en operación.
2. Cantidad de conductores.
3. Cantidad de estudiantes transportados y de familias.
4. Cantidad de centros educativos atendidos.
5. Rango de edad y nivel educativo típico de los conductores.
6. Porcentaje aproximado de padres con teléfono Android y con plan de datos.
7. Municipios donde la cobertura celular es irregular.

---

# 5.7.2 Requerimientos de datos

## Naturaleza del modelo de datos

El sistema utiliza **Cloud Firestore**, una base de datos **NoSQL orientada a
documentos**. Los datos se organizan en **colecciones** de **documentos**, y
cada documento es un conjunto de campos con tipo.

**Justificación de la elección (defendible ante el jurado):**

1. **Sincronización en tiempo real nativa.** El requerimiento central del
   sistema —que el padre vea el bus moverse y que el conductor vea su ruta
   actualizada— se resuelve con suscripciones (`onSnapshot`) sin programar
   ningún mecanismo de actualización propio ni consultar periódicamente.
2. **Sin servidor propio que administrar.** Firestore expone la base
   directamente a las aplicaciones cliente, con la seguridad aplicada del lado
   del servidor mediante reglas declarativas.
3. **Costo cero en el plan gratuito (Spark)**, condición del proyecto.
4. **Modelo flexible**, adecuado para una estructura que evolucionó durante el
   desarrollo (por ejemplo, al incorporar el transbordo).

**Contrapartida asumida:** Firestore no tiene integridad referencial ni `JOIN`.
Ambas cosas se resuelven en la capa de aplicación, como se detalla más abajo.

## Diccionario de datos — 13 colecciones

*(verificado: `types/models.ts`, idéntico en web y móvil, y las referencias
reales a `collection()` en los servicios de ambos proyectos)*

| # | Colección | Qué almacena | Quién escribe | Quién lee |
| --- | --- | --- | --- | --- |
| 1 | `usuarios` | Cuentas del sistema y su rol | Admin (cada quien su perfil) | Cualquier autenticado |
| 2 | `buses` | Unidades de la flota | Admin | Cualquier autenticado |
| 3 | `escuelas` | Centros educativos con coordenadas | Admin | Cualquier autenticado |
| 4 | `puntos` | Puntos de transbordo | Admin | Cualquier autenticado |
| 5 | `ninos` | Estudiantes transportados | Admin | Admin, conductor; padre solo sus hijos |
| 6 | `rutas` | Recorridos, con sus niños y paradas | Admin | Cualquier autenticado |
| 7 | `viajes` | Cada salida efectiva de una ruta | Conductor dueño | Cualquier autenticado |
| 8 | `registros` | Asistencia: quién subió y quién bajó | Conductor | Admin, conductor; padre solo de sus hijos |
| 9 | `ubicaciones` | Posición GPS actual de cada viaje | Conductor dueño | Cualquier autenticado |
| 10 | `mensajes` | Chat entre dos personas | El remitente | **Solo los dos participantes** (y admin) |
| 11 | `canales` | Canal de avisos de una escuela | Admin | Cualquier autenticado |
| 12 | `avisos` | Publicaciones de un canal | **Solo admin** | Cualquier autenticado |
| 13 | `solicitudes` | Pedidos del padre al admin | Padre (crea), admin (resuelve) | El padre autor y el admin |

> Detalle para el informe: `firestore.rules` contiene además un bloque
> `paradas`, que corresponde al modelo anterior a la reestructuración del
> proyecto y **ya no se usa desde el código**. Conviene mencionarlo como deuda
> técnica menor o eliminarlo antes de la entrega.

### Campos por entidad (los principales)

**`usuarios`** — `id` (uid de Firebase Authentication), `rol`, `nombre`,
`telefono`, `email`, `expoPushToken`, `foto`, `debeCompletarPerfil`, `activo`,
`creadoEn`, más los campos de archivado (`eliminado`, `eliminadoEn`,
`motivoEliminacion`).

**`buses`** — `id`, `placa`, `capacidad`, `conductorId`, `foto`, `activo`.

**`escuelas`** / **`puntos`** — `id`, `nombre`, `lat`, `lng`, `activa`/`activo`.

**`ninos`** — `id`, `nombre`, `grado`, `padreId`, `escuelaId`, `parada`
(nombre + lat + lng + referencia escrita), `paradaTarde` (opcional, si en la
tarde se entrega en otro lugar), `turno` (`manana` | `tarde` | `ambos`), `foto`,
`activo` y campos de archivado.

**`rutas`** — `id`, `nombre`, `busId`, `turno`, `escuelaIds[]`, `ninoIds[]`,
`ninos[]` (por cada niño: dónde sube y dónde baja **en esa ruta**), `paradas[]`
(recorrido ordenado), `municipio`, `activa`.

**`viajes`** — `id`, `rutaId`, `conductorId`, `busId`, `fecha` (`YYYY-MM-DD`),
`estado` (`pendiente` | `en_curso` | `finalizado`), `horaInicio`, `horaFin`,
`demorado`.

**`registros`** — `id`, `viajeId`, `ninoId`, `evento` (`subio` | `bajo`),
`hora`, `paradaId`, y para transbordo: `fecha`, `lugarTipo`, `lugarId`,
`rutaId`, `busId`, `conductorId`, `excepcion`, `discrepancia`, `motivo`.

**`ubicaciones`** — `viajeId`, `lat`, `lng`, `timestamp`. **Un documento por
viaje activo, que se sobrescribe.**

**`mensajes`** — `id`, `conversacionId`, `de`, `para`, `texto`, `hora`, `leido`.

**`canales`** — `id`, `nombre`, `escuelaId`, `descripcion`, `foto`, `activo`,
`creadoEn`. **`avisos`** — `id`, `canalId`, `texto`, `de`, `hora`.

**`solicitudes`** — `id`, `tipo` (`inscripcion` | `cambio_ubicacion`), `padreId`,
`estado` (`pendiente` | `aprobada` | `rechazada`), `creadaEn`, `datosNino`,
`ninoId`, `permanente`, `fechaAplicacion`, `alcance`, `nuevaUbicacion`,
`motivo`, `respuesta`, `resueltaEn`.

## Reglas de integridad y consistencia (decisiones de diseño de datos)

Estas cinco decisiones son las más defendibles del capítulo de datos:

1. **El estado del niño no se almacena: se deriva.** No existe un campo
   `ninos.estado`. Que un niño esté "en casa", "en el bus" o "entregado" se
   calcula a partir de su **último registro**. Se evita así el problema clásico
   de dos fuentes de verdad que se contradicen, y como beneficio de seguridad,
   **el conductor no necesita permiso de escritura sobre los datos del niño**.
2. **Los registros son inmutables.** Una corrección no modifica un registro
   existente: **crea uno nuevo**. La secuencia completa queda auditable, que es
   lo que corresponde a un registro de asistencia de menores de edad.
3. **Borrado lógico (archivado), nunca borrado físico.** Al "eliminar" un padre,
   un conductor o un niño, el documento se marca con `eliminado: true` y
   `activo: false`. Tres razones: los viajes y registros históricos guardan
   `ninoId` y `conductorId` y quedarían huérfanos; borrar una cuenta de
   Authentication ajena exige un servidor con privilegios de administrador que
   este proyecto no tiene; y es coherente con la política del sistema. Al
   archivar un padre se archivan sus hijos en un solo lote.
4. **Integridad referencial mantenida por la aplicación.** Firestore no tiene
   claves foráneas. Las relaciones se guardan como identificadores de documento
   (`padreId`, `busId`, `rutaId`, `escuelaId`) y la aplicación garantiza su
   validez: los selectores solo ofrecen documentos activos y existentes, y una
   escritura que afecta a dos rutas (un transbordo) **se hace junta**, para que
   nunca queden desapareadas.
5. **Identificador de conversación determinístico.** El `conversacionId` es la
   unión de los dos identificadores de usuario **ordenados alfabéticamente**, de
   modo que dos personas siempre obtienen el mismo hilo sin importar quién
   escriba primero, y sin necesidad de un documento de "conversación".

## Datos sensibles y su tratamiento

El sistema maneja **datos personales de menores de edad y su ubicación
geográfica**, la categoría más sensible posible en un sistema de este tipo. Vale
la pena dedicarle un párrafo explícito en el informe.

| Dato sensible | Tratamiento |
| --- | --- |
| Nombre, grado y foto del estudiante | Solo los leen su padre, el conductor y el administrador |
| Domicilio (coordenadas de la casa) | Nunca se muestra a otros padres |
| Ubicación del bus en vivo | Se **borra** al finalizar el viaje; no se conserva historial de recorrido |
| Contraseñas | **Nadie las maneja en texto plano**: las gestiona Firebase Authentication; el admin crea la cuenta y el usuario define su clave desde un correo de restablecimiento |
| Conversaciones | Legibles únicamente por los dos participantes, aplicado por las reglas del servidor |
| Fotos | Se comprimen a 300 px de ancho y calidad 0.6, y se guardan como texto dentro del documento |

**Tres puntos técnicos que conviene mencionar:**

- **La seguridad se aplica en el servidor, no en la aplicación.** Las reglas de
  Firestore se evalúan en la infraestructura de Google: aunque alguien
  modificara la aplicación, no obtendría datos que la regla no le permite.
- **No hay registro público.** Ninguna pantalla permite crear una cuenta: se
  elimina de raíz el problema de verificar que alguien realmente es el padre de
  un niño.
- **Las fotos se guardan dentro del documento en formato base64** porque Firebase
  Storage exige el plan de pago. Es una desviación consciente de la buena
  práctica, acotada por dos límites: la compresión a ~50 KB y el **tope de 1 MiB
  por documento** que impone Firestore.

## Volumetría y consumo de cuota

Esta es la parte cuantitativa de la sección 5.7.2 y la que demuestra que el
dimensionamiento se analizó y no se supuso.

**Cuotas del plan gratuito (Spark)** *(verificado el 2026-08-20 en la página
oficial de precios de Firebase — citala como fuente)*:

| Recurso | Límite diario/total |
| --- | --- |
| Almacenamiento en Firestore | 1 GiB |
| Lecturas de documentos | 50,000 por día |
| Escrituras de documentos | 20,000 por día |
| Borrados de documentos | 20,000 por día |
| Transferencia de salida | 10 GiB por mes |
| Usuarios activos mensuales (Authentication) | 50,000 |
| Firebase Hosting | 10 GB de almacenamiento, 360 MB de transferencia por día |

**Escenario de referencia** *(estimación — reemplazá con los datos reales)*:
5 unidades, 5 rutas por turno, 2 turnos diarios, 100 estudiantes, 80 familias,
viajes de 90 minutos.

**Escrituras por día:**

| Origen | Cálculo | Total |
| --- | --- | --- |
| Ubicación GPS | 1 escritura cada 15 s → 4/min × 90 min = 360 por viaje × 2 turnos × 5 buses | 3,600 |
| Asistencia | 2 eventos por niño por turno × 2 turnos × 100 niños | 400 |
| Viajes | (crear + finalizar) × 5 rutas × 2 turnos | 20 |
| Mensajes, avisos y solicitudes | estimado | ~60 |
| **Total** | | **≈ 4,080 (20 % de la cuota)** |

**Lecturas por día.** Es el recurso crítico, porque **cada actualización que
recibe una suscripción abierta cuenta como una lectura**:

| Origen | Cálculo | Total |
| --- | --- | --- |
| Padres viendo el mapa (uso moderado: 10 min por viaje) | 40 lecturas × 80 padres × 2 turnos | 6,400 |
| Pantalla de supervisión del admin | 360 × 5 buses × 2 turnos, si la deja abierta todo el viaje | 3,600 |
| Listados iniciales al abrir la app | ~30 por sesión × 85 sesiones | 2,550 |
| **Total (uso moderado)** | | **≈ 12,550 (25 % de la cuota)** |

**Limitación identificada y declarable:** en el peor escenario —los 80 padres con
el mapa abierto durante los 90 minutos completos— las lecturas ascenderían a
unas 57,600 por día, **por encima del límite gratuito**. Las mitigaciones ya
implementadas son: el intervalo mínimo de 15 segundos entre escrituras de GPS
(que acota directamente cuántas actualizaciones recibe cada suscripción), la
sobrescritura del documento de ubicación en lugar de acumular historial, el uso
de conteos del lado del servidor en el tablero, el reflejo local de los
registros nuevos sin volver a consultar, y el cierre de las suscripciones al
salir de cada pantalla. Si la operación creciera, la vía de escalamiento es el
plan de pago por uso, no un rediseño del sistema.

**Almacenamiento estimado:** fotos ≈ 50 KB × (100 niños + usuarios + buses)
≈ 10 MB; registros ≈ 200 bytes × 400 por día ≈ **29 MB al año**; las ubicaciones
ocupan un documento por viaje activo y no crecen. El total se mantiene muy por
debajo del 1 GiB disponible.

## Índices y consultas

**Decisión de diseño:** todas las consultas del sistema usan **únicamente
filtros de igualdad**, y el ordenamiento se resuelve en el cliente. Esto evita
por completo la necesidad de **índices compuestos** en Firestore. Es una
restricción que se respetó en todo el proyecto y explica por qué, por ejemplo,
los mensajes de un chat se ordenan por hora en memoria en vez de pedirle el
orden al servidor.

## Retención, respaldo y recuperación

- **Retención:** los viajes y registros se conservan indefinidamente (son la
  trazabilidad del servicio). Las ubicaciones **no se conservan**: el documento
  se elimina al finalizar el viaje.
- **Respaldo:** el plan gratuito **no incluye copias de seguridad automáticas**
  ni recuperación a un punto en el tiempo; ambas funciones pertenecen al plan de
  pago. El respaldo previsto es la **exportación manual** desde la consola o la
  línea de comandos de Firebase, más la exportación a CSV de los reportes.
  Declaralo como limitación conocida, con la mitigación indicada.
- **Recuperación ante borrado accidental:** el borrado lógico permite
  **restaurar** desde la pantalla de Historial del panel web.
- **Disponibilidad sin conexión:** las escrituras pendientes se encolan en
  memoria mientras la aplicación siga abierta, y los avisos push que fallan se
  guardan en el almacenamiento del teléfono con una vigencia de 3 horas, porque
  un aviso de que el niño subió al bus a las 6 de la mañana no le sirve a nadie
  a las 6 de la tarde.

---

# 5.7.3 Requerimientos de hardware y software

## Arquitectura de despliegue (contexto para la sección)

El sistema **no tiene servidor propio**. Es una arquitectura cliente–servicios
en la nube: dos aplicaciones cliente (panel web y aplicación móvil) que
conversan directamente con servicios administrados. Esto elimina los
requerimientos de hardware de servidor, y conviene decirlo explícitamente en el
informe porque es una decisión de arquitectura, no una omisión.

## A. Entorno de desarrollo *(verificado en la máquina del proyecto)*

| Componente | Requerimiento | Versión en uso |
| --- | --- | --- |
| Sistema operativo | Windows, macOS o Linux | Windows 11 Pro (26200) |
| Entorno de ejecución | Node.js LTS o superior | **v24.6.0** |
| Gestor de paquetes | npm | **11.5.1** |
| Editor | Visual Studio Code | — |
| Control de versiones | Git | — |
| Herramienta de Firebase | Firebase CLI (despliegue de reglas y hosting) | — |
| Herramienta de compilación móvil | EAS CLI (compilación del APK en la nube) | — |
| Hardware sugerido | 8 GB de RAM, 10 GB libres en disco | — |
| Conectividad | Internet permanente (todos los servicios son remotos) | — |
| Dispositivo de prueba | Teléfono Android físico **con GPS** en la misma red WiFi | — |

## B. Servicios en la nube (sustituyen al servidor)

| Servicio | Función en el sistema | Plan |
| --- | --- | --- |
| Cloud Firestore | Base de datos en tiempo real (región us-central1) | Spark (gratuito) |
| Firebase Authentication | Autenticación por correo y contraseña | Spark |
| Firebase Hosting | Publicación del panel web | Spark |
| API de Expo Push Notifications | Entrega de notificaciones push | Gratuito |
| Firebase Cloud Messaging | Transporte de las notificaciones hacia Android | Gratuito |
| EAS Build | Compilación del APK en la nube | Gratuito (con cola de espera) |
| OpenStreetMap | Teselas (imágenes) de los mapas | Gratuito |

> Para el informe: aclarar que **no se utilizan Cloud Functions** ni el plan de
> pago, y que la ausencia de un servidor propio es lo que hace viable el costo
> operativo cero.

## C. Cliente — Administrador (panel web)

| Componente | Requerimiento mínimo | Recomendado |
| --- | --- | --- |
| Equipo | Computadora de escritorio o laptop | — |
| Sistema operativo | Windows, macOS o Linux | Windows 10 u 11 |
| Navegador | Cualquiera moderno con soporte de ES2020: Chrome, Edge, Firefox o Safari | Chrome o Edge actualizado |
| Resolución de pantalla | 1280 × 720 | 1920 × 1080 (los mapas y tablas se aprovechan mejor) |
| Memoria | 4 GB | 8 GB |
| Conectividad | Internet estable (el tiempo real depende de ella) | — |
| Instalación | **Ninguna**: se accede por dirección web | — |

## D. Cliente — Conductor y Padre (aplicación móvil)

| Componente | Requerimiento mínimo | Fuente |
| --- | --- | --- |
| Sistema operativo | **Android 7.0 (API 24)** o superior | *(verificado: `minSdkVersion 24` en el complemento de Gradle de Expo Modules Core)* |
| Versión objetivo de compilación | Android 16 (API 36) | *(verificado: `compileSdkVersion`/`targetSdkVersion 36`)* |
| iOS (soportado, no es el entregable) | **iOS 15.1** o superior | *(verificado: `min_ios_version_supported` en los scripts de React Native 0.81.5)* |
| Servicios de Google Play | **Requeridos** para recibir notificaciones push | — |
| Receptor GPS | **Obligatorio en el teléfono del conductor** | — |
| Memoria RAM | 2 GB | — |
| Almacenamiento libre | ~100 MB | — |
| Conectividad | Datos móviles o WiFi | — |
| Batería | Se recomienda **cargador vehicular** para el conductor: la emisión de GPS con la pantalla encendida durante 90 minutos consume batería de forma sostenida | — |
| Instalación | APK distribuido por la empresa (no se publica en la tienda) | — |

## E. Inventario de software y versiones *(verificado en los `package.json`)*

**Panel web**

| Biblioteca | Versión | Función |
| --- | --- | --- |
| React | 19.2.7 | Biblioteca de interfaz |
| Vite | 8.1.1 | Empaquetador y servidor de desarrollo |
| TypeScript | 6.0.2 | Lenguaje con tipado estático |
| Mantine (core, hooks, form, notifications) | 9.4.1 | Componentes de interfaz |
| @tabler/icons-react | 3.44.0 | Iconografía |
| react-router-dom | 7.18.1 | Navegación |
| Leaflet | 1.9.4 | Motor de mapas |
| react-leaflet | 5.0.0 | Integración de Leaflet con React |
| firebase | 12.15.0 | Cliente de Firestore y Authentication |
| ESLint | 10.6.0 | Análisis estático de código |

**Aplicación móvil**

| Biblioteca | Versión | Función |
| --- | --- | --- |
| Expo SDK | 54.0.34 | Plataforma de desarrollo |
| React Native | 0.81.5 | Marco de trabajo móvil |
| React | 19.1.0 | Biblioteca de interfaz |
| expo-router | 6.0.23 | Navegación basada en archivos |
| react-native-paper | 5.15.3 | Componentes de interfaz (Material Design) |
| expo-location | 19.0.8 | Acceso al GPS |
| expo-notifications | 0.32.17 | Notificaciones push |
| react-native-webview | 13.15.0 | Contenedor del mapa Leaflet |
| react-native-reanimated | 4.1.1 | Animaciones |
| expo-image-picker / expo-image-manipulator | 17.0.11 / 14.0.8 | Selección y compresión de fotos |
| @react-native-async-storage/async-storage | 2.2.0 | Persistencia local (sesión y cola de avisos) |
| firebase | 12.15.0 | Cliente de Firestore y Authentication |
| TypeScript | 5.9.2 | Lenguaje con tipado estático |

> Coherencia entre plataformas: ambos proyectos usan **la misma versión del
> cliente de Firebase (12.15.0)** y **el mismo archivo de modelo de datos**,
> verificado como idéntico.

## F. Permisos del sistema operativo que solicita la aplicación

| Permiso | Para qué | Quién lo otorga |
| --- | --- | --- |
| `ACCESS_FINE_LOCATION` y `ACCESS_COARSE_LOCATION` | Emitir la posición del bus durante el viaje y marcar lugares en el mapa | Conductor (y padre, al marcar una ubicación) |
| Notificaciones | Recibir los avisos de asistencia, proximidad, mensajes y comunicados | Los tres roles |
| Acceso a la galería de fotos | Cargar la foto de perfil, del niño o de la unidad | Quien suba una foto |

*(verificado: `app.json` declara los dos permisos de ubicación; los de
notificaciones y galería los agregan sus respectivos complementos de Expo.)*
El texto que ve el conductor al pedirle la ubicación está redactado en español y
explica el motivo, como exige la revisión de las tiendas de aplicaciones.

## G. Restricciones técnicas conocidas (declararlas fortalece el informe)

1. **La aplicación del conductor debe permanecer abierta durante el viaje.** La
   emisión de GPS funciona solo en primer plano.
2. **Las notificaciones push requieren el APK instalado.** Desde el SDK 53,
   Expo Go no recibe notificaciones remotas en Android. Es una limitación de la
   herramienta de desarrollo, no del sistema.
3. **iOS queda fuera del alcance de la entrega.** La arquitectura lo soporta,
   pero distribuir en iOS exige una cuenta de desarrollador de Apple con costo
   anual.
4. **El envío de notificaciones sale del teléfono de quien realiza la acción**,
   porque no hay servidor propio. Quien las recibe no necesita tener la
   aplicación abierta; quien las envía sí.
5. **El plan gratuito no ofrece copias de seguridad automáticas** (ver 5.7.2).
6. **Los mapas y las notificaciones dependen de servicios externos**
   (OpenStreetMap y la infraestructura de Expo y Google).

---

## Fuentes para citar en el informe

- Código fuente del sistema: `types/models.ts`, `firestore.rules`, `app.json`,
  `package.json` de ambos proyectos.
- Precios y cuotas de Firebase: https://firebase.google.com/pricing
  (consultado el 2026-08-20).
- Documentación de Expo SDK 54: https://docs.expo.dev
- Pauta de contraste WCAG 2.1, criterio 1.4.3 (nivel AA).
- Documentación interna del proyecto: `CLAUDE.md`, `ESTADO-ACTUAL.md`,
  `docs/notificaciones.md`, `docs/despliegue.md`, `docs/casos-de-prueba.md`,
  `docs/transbordo-implementacion.md`.
