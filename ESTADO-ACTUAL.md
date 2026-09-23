# Estado actual del proyecto — handoff (2026-07-28)

> Resumen para continuar en otra conversación. La **fuente de verdad** sigue siendo
> `CLAUDE.md`, pero su sección 5 ("estado actual") quedó **desactualizada** (describe
> hasta Fase 5). Este documento refleja lo real a hoy: Fase 3.5 + transbordo.
> Otros docs: `MIGRACION-fase-3.5.md` y `docs/transbordo-implementacion.md`.

---

## 1. Qué es

Sistema de transporte escolar para **Inversiones Perez** (La Ceiba, Honduras) y
proyecto de graduación de Derek. **Panel web admin** (React + Vite + TS + Mantine +
Leaflet) + **app móvil** (React Native + Expo + RN Paper) para conductores y padres.
Backend **Firebase Firestore + Auth** (plan Spark gratis, **sin Cloud Functions**).
Todo en tiempo real. Código original (defendible línea por línea). Textos y campos en
español. `models.ts` debe ser **idéntico** en web (`src/types/`) y móvil (`types/`).

## 2. Principios de diseño (CLAUDE.md §1-bis — mandan sobre todo)

1. **El transbordo es la excepción, no la regla.** Los niños son directos
   (casa↔escuela) por default; `subeEn`/`bajaEn` se llenan solos. La UI de transbordo
   solo aparece si la ruta tiene un punto insertado.
2. **Simplicidad de operación.** Conductor: botones grandes, "Todos" visible, dos
   estados (pendiente/listo), cero config. Padre: el transbordo es invisible. Admin:
   puede haber densidad. Si algo obliga a explicarle un concepto nuevo al conductor/padre, proponerlo antes.
3. **Mecánica del transbordo.** Solo **decide quien ENTREGA**; quien recibe confirma
   una lista que se llena sola (leída de `registros`, nunca de la ruta ajena). Si hay
   **discrepancia, manda la recepción**; la discrepancia queda registrada.

## 3. Qué está construido y funcionando

**Panel web (admin) — todo funcional, compila limpio:**
- Login solo admin; Dashboard con contadores.
- **Conductores** y **Padres** (secciones separadas; `GestionUsuariosScreen` param. por rol).
- **Buses**, **Escuelas** (mapa), **Puntos** (mapa; puntos de transbordo).
- **Niños** (escuela + turno + casa en mapa).
- **Rutas** (armador: unidad + turno + escuela(s) + checklist de niños + sección
  "Transbordo (opcional)"; escribe `ninoIds` **y** `ninos: NinoEnRuta[]`).
  **Rediseñado 2026-07-28 (2 iteraciones con Derek):**
  - El checklist son **los niños que viajan en ese bus** (todos los del turno, de
    cualquier escuela), compacto: buscador + scroll (max ~230px) + contador. Un niño
    que ya viaja en OTRA ruta activa del turno **aparece pero bloqueado** ("Ya viaja
    en la ruta X (bus Y)") — un niño no puede ir en dos buses. Las entradas de
    receptor no cuentan como ocupación (las administra la ruta de origen).
  - El transbordo se marca **sobre un niño que YA viaja en esta ruta** (la que
    entrega): niño + punto + "lo sigue el bus X". La ruta receptora se actualiza sola
    al guardar (`actualizarNinosDeRuta`, diff altas/bajas) y muestra sus recibidos
    como solo-lectura. Destildar al niño quita también su transbordo.
  - Validación al guardar: un niño sin transbordo cuya escuela no está en la ruta
    bloquea el guardado (habría que agregar la escuela o marcarle transbordo).
  - El bus receptor no se guarda: se deriva buscando qué ruta del turno recibe al
    niño en ese punto (ambas rutas se escriben juntas → siempre apareadas).
- **Migración** (`/migracion`): convierte rutas viejas `ninoIds` → `ninos`+`paradas` (idempotente).
- **Datos de prueba** (`/datos-prueba`): seed con un transbordo real (ver §7).
- **Fase 8 — supervisión y reportes (2026-07-30): construida, compila limpio (tsc +
  build + eslint), NO probada con datos en vivo.**
  - **Supervisión** (`/supervision`; `SupervisionScreen` + `components/MapaBuses.tsx` +
    `services/supervisionService.ts`): mapa Leaflet con TODOS los buses con viaje
    `en_curso` a la vez (marcador 🚌 con tooltip ruta/conductor/placa), cruzando dos
    suscripciones en vivo (viajes en curso + colección `ubicaciones`). Lista lateral con
    cada viaje y si tiene señal GPS ("En vivo" / "Sin señal"). Encuadra el mapa una sola
    vez y después deja al admin moverlo.
  - **Reportes** (`/reportes`; `ReportesScreen` + `services/reportesService.ts` +
    `utils/csv.ts`), dos pestañas: (1) **Viajes** — filtro por rango de fechas (rango
    sobre `fecha`, sin índice; ruta/conductor filtrados en cliente) + conteo de niños
    transportados por viaje (distintos con evento `subio`, leídos de `registros`); (2)
    **Por niño** — historial de asistencia (subió/bajó) de un niño, resolviendo la ruta
    vía el viaje. Ambas exportan **CSV** (generación manual RFC 4180 con BOM, sin
    papaparse — cero dependencias nuevas).
  - Sin cambios de reglas (el admin ya lee viajes/registros/ubicaciones). Nav: se
    agregaron "Supervisión" (tras Dashboard) y "Reportes" (tras Mensajes).

**App móvil — funcional, compila limpio (tsc+eslint); NO probado en dispositivo aún:**
- Conductor **"Mi ruta de hoy"** (`app/(conductor)/hoy.tsx`): ruta del turno actual,
  **tiempo real** (`onSnapshot` a las rutas del bus), iniciar/finalizar viaje, GPS,
  asistencia agrupada por casa/escuela. Los niños de transbordo NO aparecen en la
  recogida/entrega normal (los maneja la pantalla de transbordo). Botón "Transbordo en [punto]".
- Conductor **Transbordo** (`app/(conductor)/transbordo.tsx` + `services/transbordoService.ts`):
  ENTREGA (decide, con excepción "¿Se baja otro niño aquí?") / RECIBE (se llena sola, en
  vivo desde `registros` del punto), precedencia con `discrepancia`, validación roja no
  bloqueante, contingencia "Esperar"/"Continuar sin transbordo".
- Componente reutilizable `components/GrupoAsistencia.tsx` (dos estados).
- Conductor **Recorrido** (`app/(conductor)/recorrido.tsx`, agregado 2026-07-28): botón
  "Ver recorrido en el mapa" en hoy.tsx → mapa WebView+Leaflet con TODAS las paradas
  numeradas en orden (🏠 casas → 🔄 punto → 🏫 escuelas; tarde al revés) y línea punteada.
  El orden lo deriva `derivarRecorrido()` en `conductorService.ts` desde `ruta.ninos`
  (subidas → punto → bajadas; casas dedup por coordenadas). NO probado en dispositivo.
- Padre: **Mis hijos**, **mapa en vivo**, **historial** (de Fase 5). ⚠️ **NO** actualizado
  para transbordo: un hijo con transbordo está en 2 rutas y el padre aún no muestra ambos tramos.
- **Fase 6 — notificaciones push (2026-07-30): construida, NO probada en dispositivo.**
  `services/notificacionesService.ts` completo: `registrarTokenPush` (permiso + Expo Push
  Token → `usuarios/{uid}.expoPushToken`; lo llaman los layouts de conductor y padre al
  entrar), `notificarEventoAlPadre` (subió/bajó desde `hoy.tsx`; desde `transbordo.tsx`
  solo la ENTREGA y con texto neutro "sigue en camino" vía `{enPunto:true}` — el
  transbordo es invisible para el padre; recepciones y "continuar sin transbordo" NO
  notifican) y `notificarProximidad` (haversine, umbral 400 m, un aviso por niño por
  viaje en memoria, hermanos agrupados en un solo push por padre). El hook
  `use-emision-ubicacion` ahora acepta `onPosicion` (vía ref, sin reiniciar el watcher)
  y `hoy.tsx` arma los candidatos: mañana = pendientes que suben en casa; tarde = en el
  bus y bajan en casa. Handler de foreground + canal Android en `app/_layout.tsx`.
  Envío: POST directo a `https://exp.host/--/api/v2/push/send` (sin backend). Tokens y
  niños se cachean en memoria por sesión. ⚠️ Para que funcione: (1) redesplegar reglas
  (ver §5), (2) `eas init` para tener `extra.eas.projectId` en app.json (sin él,
  `registrarTokenPush` sale sin token, a propósito) — **ya hecho**, (3) probar en
  APK/dev build — **Expo Go en Android NO soporta push remotas desde SDK 53**.
- **Identidad visual — logo real y portada animada (2026-08-19): construida, compila
  limpio (tsc + eslint + build web + `expo export` de Android), NO vista en dispositivo.**
  El set de iconos de `Logos/` (generado con IconKitchen: ilustracion de un bus escolar
  con "Rutas Escolar / Seguridad") reemplaza a los del template de Expo en TODAS partes.
  - **Movil:** `icon.png` (1024, aplanado sobre blanco porque la App Store rechaza alfa),
    `android-icon-foreground.png` (1024, logo al 68% y centrado sobre transparente — la
    "zona segura" del adaptive icon; a sangre, los recortes de Android se comerian el
    texto), `android-icon-monochrome.png`, `splash-icon.png`, `favicon.png` y `logo.png`
    (para usar DENTRO de la app). Se quito de `app.json` el `backgroundImage`: el que
    traia el set es negro solido, asi que ahora manda `backgroundColor: "#FFFFFF"`.
    Generados con un script de una sola vez usando `jimp-compact`, que ya venia instalado
    como dependencia de `@expo/image-utils` — **no se agrego ninguna libreria**.
  - **Portada animada:** `components/PortadaAnimada.tsx`, la pantalla que se ve mientras
    se resuelve la sesion (antes: una rueda de carga gris). Logo + un bus que avanza. El
    bus casi no se mueve: lo que corre es la CARRETERA debajo (fila de rayas que se
    desplaza un `PASO` y reinicia — como todas son iguales, el ciclo es invisible y el
    movimiento nunca se corta). Usa `Animated` de React Native (incluido, sin libreria
    nueva) con `useNativeDriver: true`, para que siga fluido mientras JS espera a
    Firebase. Las animaciones se detienen al desmontar. Montada en `app/index.tsx`.
  - **Login movil:** el `Avatar.Icon` generico de bus paso a ser el logo real.
  - **Web:** `public/` recibe favicon.ico, apple-touch-icon y los cuatro iconos PWA
    (192/512, normales y maskable) + `logo.png`. Nuevo `public/manifest.webmanifest` y
    `index.html` reescrito (iconos, `theme-color`, titulo y descripcion reales — antes
    decia "transporte-web" y apuntaba a `/vite.svg`). El logo tambien aparece en
    `LoginScreen` y en el encabezado de `AppLayout`.
  - **Pagina de descarga** (`public/descargar.html`): el emoji 🚌 paso a ser el logo real.

- **Fase 6-bis — entrega con la app CERRADA (2026-08-19): construida, compila limpio
  (tsc + eslint móvil y web + build web), NO probada en dispositivo.** Cierra los huecos
  que quedaban para que "el aviso llega aunque la app esté cerrada" valga para TODO
  (asistencia, proximidad, mensajes y comunicados). Ver `docs/notificaciones.md`.
  - **Avisos de canal ahora mandan push** (antes solo se escribían en Firestore y el
    padre se enteraba únicamente si abría la app — inútil para un "mañana no hay clases").
    `notificarAvisoNuevo()` deriva los destinatarios de los niños activos de la escuela
    del canal (sin lista de suscriptores) y envía **en lote**: un POST con hasta 100
    mensajes vía `enviarPushMultiple()`, no uno por padre.
  - **La cola de reintentos estaba muerta:** `reintentarAvisosPendientes()` existía pero
    **nadie la llamaba**, así que un aviso perdido por falta de señal no se reintentaba
    nunca. Ahora la llaman los layouts de los tres roles al abrir la app y `hoy.tsx` tras
    cada marcado de asistencia (ahí se sabe que hay señal). Se le agregó guarda contra
    ejecución simultánea (evita avisos duplicados) y tope de 300 pendientes.
  - **El panel web ya puede enviar push.** Antes no podía: Expo no devuelve
    `Access-Control-Allow-Origin` y el navegador cancelaba el POST por CORS, así que un
    mensaje o aviso escrito desde la web no llegaba a ningún teléfono. Se resuelve con
    `Content-Type: text/plain` (tipo safelisted de CORS ⇒ sin preflight; la API de Expo
    igual parsea el cuerpo como JSON — comprobado contra el servidor real) +
    `mode: "no-cors"`. Precio asumido: la respuesta es opaca, se envía a ciegas (el dato
    ya está en Firestore de todos modos; la limpieza de tokens muertos la sigue haciendo
    el móvil). Nuevo `transporte-web/src/services/notificacionesService.ts`, cableado en
    `MensajesScreen` y `CanalesScreen`.
  - **Tocar el aviso abre la pantalla correcta**, incluso si la app venía cerrada y se
    abrió por el toque: cada push lleva un `data` (`DatosPush`: mensaje / aviso / hijos) y
    `hooks/use-navegacion-notificacion.ts` lo lee con `useLastNotificationResponse`
    (el hook que Expo recomienda porque cubre el caso de app terminada, que un listener
    normal se perdería). Salta con 400 ms de retraso para no chocar con el redirect por
    rol de `index.tsx`. Montado en `app/_layout.tsx`.
  - `notificarMensajeNuevo()` cambió de firma: ahora recibe también el `remitenteId`
    (hace falta para saber qué conversación abrir al tocar el aviso).
- **Fase 7 — chat padre ↔ conductor / administración (2026-07-30): construida, compila
  limpio (tsc + eslint + build web), NO probada con dos sesiones.**
  Colección `mensajes` (ya en el modelo). `conversacionId` = los dos uids ordenados y
  unidos (determinístico). Servicios espejo `services/mensajesService.ts` en web y móvil:
  `idConversacion`, `enviarMensaje`, `escucharConversacion` (onSnapshot, orden por hora
  en cliente — sin índice compuesto), `marcarLeidos` (batch), `escucharBandeja` (DOS
  listeners: `de==yo` + `para==yo`, combinados en memoria → resumen por conversación con
  último texto y no leídos), y en móvil `escucharTotalNoLeidos` (badge) + `listarUsuarios`.
  Contactos: `padreService.listarContactosPadre` (conductores de las rutas de sus hijos,
  vía ruta.busId→bus.conductorId, + admin) y `conductorService.listarContactosConductor`
  (padres de los niños de sus rutas + admin). El "admin" con quien chatean padre/conductor
  es el **primer admin activo** (hay uno solo: admin@transporteperez.com) y se muestra como
  "Administración".
  - **Móvil:** pantalla de chat compartida a nivel raíz `app/conversacion.tsx` (padre y
    conductor la reusan; burbujas, input, **botón de llamada directa** `tel:` en el Appbar
    — es el fallback del informe, incluido como complemento). Bandejas por rol
    `app/(padre)/mensajes.tsx` y `app/(conductor)/mensajes.tsx` con `components/FilaContacto.tsx`.
    Botón "Mensajes" con badge de no leídos (`components/BotonMensajes.tsx`) en Mis hijos y
    en Mi ruta de hoy. Al enviar, push al destinatario vía `notificarMensajeNuevo` (reusa
    la infra de Fase 6). Desde que existe la sección de admin en la app móvil, el admin
    también registra token al entrar, así que un mensaje AL admin sí le llega al teléfono.
  - **Web (admin):** `screens/MensajesScreen.tsx` (dos paneles: conversaciones a la
    izquierda con badge de no leídos + selector para iniciar con cualquier conductor/padre;
    chat en vivo a la derecha). Ruta `/mensajes` + enlace en el sidebar. La web **sí**
    manda push desde 2026-08-19 (el problema de CORS del endpoint de Expo se resuelve con
    `text/plain` + `no-cors` — ver Fase 6-bis arriba).
  - ⚠️ Para que funcione: **desplegar reglas** (§5). Falta prueba con dos sesiones
    (padre ↔ conductor ↔ admin) y, para el push de mensajes, APK/dev build.

## 3-bis. Rediseño visual de la app móvil (2026-08-19) — compila limpio, NO probado en dispositivo

Cuatro cosas pedidas por Derek: los avisos tienen que **verse** en el inicio del
padre, la app tiene que sentirse suave, el chat no puede quedar tapado por el
teclado, y todo tiene que adaptarse a cualquier teléfono.

- **Avisos visibles (padre).** `services/canalesService.escucharAvisosDeCanales()`
  (un listener por canal, combinados en memoria; solo igualdades, sin índices)
  alimenta la nueva sección de **Avisos del inicio**, que ahora muestra el TEXTO
  de los dos comunicados más recientes con el canal y el "hace cuánto", no un
  botón. La pantalla `/canales` pasó de listar canales a listar **avisos**, con
  pastillas para filtrar por escuela si hay más de una. Componente nuevo
  `components/TarjetaAviso.tsx` (compartido inicio / canal), `utils/tiempo.ts`
  (`horaCorta`, `haceCuanto`, `esReciente`).
- **Teclado del chat.** Se quitó `KeyboardAvoidingView` (no funciona con
  `edgeToEdgeEnabled` en Android: la ventana no se redimensiona) y se reemplazó
  por `hooks/use-teclado.ts` → `useAlturaTeclado()`, que compensa
  `alto del teclado − lo que la ventana ya se achicó`. Sirve igual en iOS,
  Android edge-to-edge y Android con resize. Se usa en `conversacion.tsx`, en
  `PantallaBase` (todos los formularios), `login.tsx` y `completar-perfil.tsx`.
- **Adaptación al teléfono.** `PantallaBase` agrega `respiroInferior(insets.bottom)`
  al final del scroll, así la última tarjeta nunca queda debajo de los tres
  botones de Android ni de la barra de gestos; lo mismo en `mapa.tsx`,
  `recorrido.tsx`, `login.tsx` y `completar-perfil.tsx` (que además dejaron de
  usar `paddingTop` fijo y leen `insets.top`).
- **Estilo.** Tokens más redondos y sombras más difusas (`constants/estilos.ts`:
  radio de tarjeta 26, `SOMBRA_FLOTANTE` nueva); componentes nuevos
  `BotonPrincipal` (acción grande, con háptico — iniciar/finalizar viaje),
  `ChipFiltro` (cambiar de ruta / filtrar canales) y `AparicionSuave`
  (entrada en cascada con Reanimated, solo en el inicio del padre);
  `GrupoAsistencia` migrado de `Card` de Paper a la `Tarjeta` del proyecto, con
  contador "2 de 4" y botones más grandes; transición `slide_from_right` en los
  tres layouts; velo con el destino sobre el mapa del inicio; hora del último
  mensaje en las dos bandejas.

Sin cambios de modelo, de servicios de datos ni de reglas. Verificado: `tsc`,
`eslint` y `expo export` (bundle Android) limpios.

### 3-ter. Identidad "Tropical Heat" y los dos inicios nuevos (2026-08-19)

Derek eligió, sobre maquetas navegables en el teléfono, el inicio del padre
("el viaje como protagonista") y el del conductor ("progreso arriba, acción fija
abajo"), y pidió una paleta tropical. La pantalla de maquetas
(`app/maquetas.tsx`) ya cumplió su función y **se borró**.

- **Paleta (`constants/tema.ts`): BLANCO con los colores DEL LOGO.**
  ⚠️ **Reemplazada el 2026-08-19.** Antes eran acentos "tropicales" elegidos a
  mano (coral `#C93F1C` / aqua `#00786F` / mango `#9A5A00`); ahora los tres
  salen **del logo de la empresa**, medidos con un histograma de color sobre
  `Logos/ios/AppIcon~ios-marketing.png` — el azul del cielo ocupa el **19.6%**
  de la imagen, así que es el color de la marca. El motivo del cambio: el ícono
  que el padre ve en su teléfono y la app que abre tenían que ser la misma cosa.
  El color principal de la app sigue siendo el blanco (fondos, tarjetas, barras)
  y encima entran tres acentos, cada uno con un trabajo asignado — eso es lo que
  hay que poder defender: **azul cielo `#12659E`** = lo que está pasando ahora
  (bus en viaje, niño arriba, acción principal); **verde campo `#1B7A5A`** = lo
  que ya se cumplió (entregado, parada completa, viaje terminado); **ámbar bus
  `#8A5B00`** = avisos. Azul "en curso" → verde "terminado" es además la
  convención que casi todo el mundo ya conoce.
  ⚠️ **Límite conocido y documentado en el archivo:** el azul y el verde tienen
  casi la misma **luminancia** (contraste entre ellos 1.12:1), o sea que se
  distinguen por el tono pero no por lo claro/oscuro. Por eso el color nunca va
  solo donde el estado importa: siempre lo acompaña un ícono o una palabra. Los
  cuatro colores sí pasan **AA (4.5:1) contra blanco** — verificado: azul 6.21,
  verde 5.28, ámbar 5.87, rojo de error 8.16.
  La regla sigue siendo que el color aparece solo donde significa algo: sin
  viaje en curso la pantalla es casi toda blanca, y cuando el bus sale el azul
  se nota. Como el fondo y las tarjetas son blancos, el contorno lo dibuja un
  **borde de un pelo** (`bordeTarjeta()` en `constants/estilos.ts`). Los grises
  pasaron de cálidos a **fríos** (sobre una marca azul, un gris cálido se ve
  sucio) y el modo oscuro de `#141211` a `#101619`. Se conserva la escala
  tipográfica propia (`configureFonts`, sin fuentes externas) y
  `FRANJA_TROPICAL`, la franja de tres colores del encabezado, el login y
  "completar perfil", ahora en la versión VIVA del logo
  (`#2E90CE` / `#F0C24E` / `#2F9E76`) porque es decorativa y no sostiene texto.
  Los mapas Leaflet (WebView) llevan los mismos colores **a mano**, porque el
  WebView es HTML aparte y no ve el tema de Paper: bus azul con halo que late,
  parada verde, escuelas ámbar (`recorrido.tsx`, `MapaBusEnVivo.tsx`,
  `SelectorUbicacion.tsx`).
  **El panel web también:** antes usaba el azul por defecto de Mantine; ahora
  `transporte-web/src/theme.ts` define la escala de la marca con el índice 6 =
  `#12659E`, el mismo azul que el móvil. Igual el `theme-color` del
  `index.html`, el `theme_color` del manifest, la paleta de `descargar.html` y
  el color del ícono de notificación en `app.json`.
- **Inicio del padre (`(padre)/hijos.tsx`).** El hijo con el bus andando se lleva
  la pantalla: mapa en vivo de 280 px con la señal flotando arriba y, sobre un
  velo tostado, su nombre, hacia dónde va y a qué hora subió. Debajo, pie de
  acciones (Mapa · Perfil · Historial). Los hijos sin viaje quedan en tarjetas
  compactas con su `LineaViaje`. Después: avisos con texto, cuatro accesos en
  grilla (Mensajes con insignia de no leídos, Solicitudes, Inscribir, Cambio) y
  los viajes pasados. Saludo según la hora del día.
- **Inicio del conductor (`(conductor)/hoy.tsx`).** Tres partes fijas:
  cabecera con la ruta y una **barra de progreso de dos tramos** (aqua =
  entregados, coral = en el bus) más el estado del GPS; lista de asistencia
  que se desplaza en el medio; y el **botón principal clavado abajo**
  (Iniciar / Finalizar), por encima de la barra de navegación del teléfono. Sin
  viaje iniciado se ve la lista de a quiénes va a recoger, en gris.
- Cambios de `app.json`: fondo del ícono adaptativo y del splash en arena. Solo
  se ven al recompilar el APK, no en Expo Go.

Verificado igual: `tsc`, `eslint` y `expo export` limpios. **Falta verlo en el
teléfono.**

### 3-quater. App móvil del ADMIN (2026-08-19) — construida, NO probada en dispositivo

Grupo nuevo `app/(admin)/` con layout protegido por rol. **Alcance deliberado:
solo vigilancia y comunicación.** Crear usuarios, buses, escuelas, niños y rutas
sigue siendo exclusivo del panel web (pantalla grande, teclado, mapas para armar
recorridos); la app le da al admin lo que necesita estando en la calle.

- **Monitoreo** (`(admin)/monitoreo.tsx`, es su pantalla de inicio): tres
  contadores (en curso · terminadas · sin salir) y una fila por ruta activa con
  turno, unidad, cantidad de niños, estado, hora de salida y de fin, asistencia
  (subieron / entregados) y si el bus **está mandando ubicación**. Desde cada
  fila se abre el chat con ese conductor o se lo llama. Todo en vivo con dos
  suscripciones (`viajes` de hoy por igualdad de `fecha`, y la colección
  `ubicaciones` entera, que tiene un doc por viaje activo).
- **Mensajes** (`(admin)/mensajes.tsx`): conversaciones existentes ordenadas por
  la más reciente con badge de no leídos, más un buscador para escribirle a
  cualquier padre o conductor. Reusa `app/conversacion.tsx` (el chat es el mismo
  para los tres roles).
- **Publicar aviso** (`(admin)/avisos.tsx`): elegir canal (pastillas si hay más
  de uno), escribir y publicar; debajo, lo ya publicado en ese canal, en vivo.
  Los canales se siguen creando y editando en la web.
- `services/adminService.ts` (solo lectura: catálogo de rutas/buses/conductores,
  viajes de hoy, señal de GPS, conteo de asistencia y `armarEstadoDeRutas()`,
  función pura que cruza todo) y dos funciones nuevas en `canalesService.ts`
  (`listarCanales`, `publicarAviso`).
- `app/index.tsx` ya no manda al admin a "usá la web": lo redirige a
  `/monitoreo`. El menú lateral tiene sus cuatro destinos.
- **Sin cambios de reglas**: las actuales ya permiten todo esto (`viajes`,
  `ubicaciones`, `rutas`, `buses` y `usuarios` son legibles por cualquier
  autenticado; `avisos` create exige `esAdmin() && de == request.auth.uid`, que
  es justo lo que hace `publicarAviso`).
- Efecto lateral: el admin ahora **registra token push** al entrar, así que los
  mensajes de padres y conductores le llegan al teléfono (antes no, porque solo
  usaba la web). Se actualizó la nota en `notificacionesService.ts`.

### 3-quinquies. Rediseño "azul profundo" y barra flotante (2026-08-20) — compila limpio, NO probado en dispositivo

Derek pidió llevar la app al lenguaje visual de una app de viajes moderna
(referencia: tarjetas blancas flotando, sombras difusas, esquinas muy
redondeadas, aspecto muy limpio) con **azul oscuro** de marca y el **menú abajo
en forma de burbuja**.

- **La paleta pasó por dos iteraciones.** Primero se profundizó el azul del logo
  (`#12659E` → `#0F4C81`); después, sobre maquetas comparadas, Derek eligió
  **"Aurora Caribe"** y la paleta se reemplazó por completo. Ver §3-septies —
  **el azul ya no existe en el código**.
- **Fondo y tarjeta se separaron.** Antes todo era blanco y el contorno lo hacía
  un borde de un pelo. Ahora el fondo de la página es `#F4F7FB` (gris azulado
  casi blanco) y la tarjeta es blanco puro: ese medio tono más la sombra bastan
  para ver dónde empieza cada tarjeta, y `bordeTarjeta()` devuelve
  `transparent` en modo claro. Sin el borde, el diseño respira mucho más.
- **Sombras azules y difusas** (`constants/estilos.ts`): el color de sombra pasó
  de marrón cálido `#5A1F0A` a azul profundo `#0B2E52`, con radio 26 y opacidad
  0.1 (tarjetas) / radio 24 y 0.2 (lo que flota). Sobre un fondo azulado, una
  sombra negra o cálida se ve gris sucio.
- **Barra de navegación flotante** (`components/BarraBurbuja.tsx` +
  `constants/navegacion.ts`): cápsula blanca despegada de los bordes, con sombra
  amplia, que muestra los destinos del rol siempre a la vista. La sección activa
  lleva una **burbuja redonda azul** alrededor del ícono, animada con
  `Animated.spring` y `useNativeDriver`. Debajo de cada ícono va SIEMPRE la
  etiqueta: una barra de solo íconos obligaría al padre a adivinar (CLAUDE.md
  §1-bis).
- **Se eliminó el menú lateral** (`MenuLateral.tsx`): la barra cubre los mismos
  destinos sin obligar a descubrir que existía un ☰. El cierre de sesión ya
  vivía en Configuración, que sigue siendo un destino de la barra.
- **Encabezado nuevo** (`PantallaBase.tsx`): en pantallas de SECCIÓN el título va
  grande y a la izquierda con la acción a la derecha (como la referencia); en
  pantallas APILADAS se conserva la flecha de volver con título centrado. Se
  quitó la franja tricolor de dentro de la app (se conserva en login y completar
  perfil, donde sí aporta identidad sin ensuciar).
- **Degradado sin librerías** (`components/Degradado.tsx`): apila 32 franjas con
  el color interpolado paso a paso. Se usa en la portada de arranque, que ahora
  es azul con el bus y el texto en blanco. Se evitó `expo-linear-gradient` para
  no sumar dependencias (CLAUDE.md §4).
- **Colisión resuelta:** el pie fijo del conductor (`hoy.tsx`, botón Iniciar /
  Finalizar) ahora se separa con `espacioBarra(insets.bottom)`, así el botón
  grande queda arriba y la barra de navegación debajo, sin taparse.
- **El desenfoque es translúcido, no blur real.** `VIDRIO_OSCURO` /
  `VIDRIO_CLARO` en `estilos.ts` son colores con transparencia. Un desenfoque de
  verdad necesitaría `expo-blur`; queda como opción a decidir.

Sin cambios de modelo, de servicios de datos ni de reglas. Verificado: `tsc`,
`eslint` (0 errores) y `expo export` de Android, limpios. **Falta verlo en el
teléfono**, sobre todo la barra en un Android con los tres botones de abajo y el
modo oscuro.

### 3-sexies. Migración a Expo SDK 57 (2026-09-03) — compila limpio, expo-doctor 21/21

Motivo: Expo Go de la tienda ya solo soporta el SDK más nuevo, así que con SDK 54
la app **no se podía abrir en el teléfono**. Se migró de SDK 54 → 57 (salto de
tres versiones). Comando base: `npx expo install expo@^57.0.0 --fix`.

**Versiones nuevas:** Expo **57.0.19**, React Native **0.86.3**, React **19.2.3**,
expo-router **57.0.18**, expo-notifications 57.0.16, expo-location 57.0.15,
react-native-webview 13.16.1, react-native-reanimated 4.5.1, TypeScript 6.0.3.

**Rompimientos que hubo que resolver** (documentados en `transporte-movil/AGENTS.md`):

1. **`expo-router` ya no depende de react-navigation** (SDK 56). Se corrió el
   codemod oficial `sdk-56-expo-router-react-navigation-replace`: los imports de
   `@react-navigation/native` pasaron a `expo-router/react-navigation` en
   `app/_layout.tsx` y `constants/tema.ts`. Además se **desinstalaron** los tres
   paquetes `@react-navigation/*`: seguían declarando un tipo global
   `ReactNavigation.Theme` con colores `string` que chocaba con el de expo-router
   (`ColorValue`) y rompía el type-check. **No reinstalarlos.**
2. **`edgeToEdgeEnabled` se eliminó de app.json** (SDK 55): el edge-to-edge ahora
   es obligatorio. El código que compensa los insets no cambió.
3. **`newArchEnabled` ya no es propiedad válida** (la New Architecture es
   obligatoria desde SDK 55). Se quitó de app.json — era el único fallo de
   `expo-doctor`.
4. **`StyleSheet.absoluteFillObject` no existe en RN 0.86.** Se reemplazó por las
   cuatro posiciones escritas en `components/SelectorUbicacion.tsx`.
5. **Cuatro plugins nuevos obligatorios en app.json**: `expo-font`, `expo-image`,
   `expo-status-bar`, `expo-web-browser`.
6. **Limpieza:** se borraron 11 archivos muertos de la plantilla de Expo
   (`haptic-tab`, `themed-text`, `themed-view`, `parallax-scroll-view`,
   `hello-wave`, `external-link`, `components/ui/*`, `use-theme-color`,
   `constants/theme.ts`). Nada en `app/` los usaba y eran los que arrastraban
   `@react-navigation/bottom-tabs`.

**Dos reglas de ESLint bajadas a aviso** (`eslint.config.js`, con justificación
escrita en el archivo): `react-hooks/refs` y `react-hooks/set-state-in-effect`.
Las trajo el ESLint del SDK 57 (React Compiler) y marcan patrones correctos y
documentados por React Native — `useRef(new Animated.Value(0)).current` para las
animaciones y `setState` tras una carga de Firestore. Migrarlas de verdad
(`useAnimatedValue` + hooks de datos) queda como trabajo opcional posterior.

**Impacto en el informe:** las versiones de la §5.7.3 de
`docs/informe-5.7-analisis-de-requerimientos.md` ya se actualizaron. El mínimo de
**iOS subió de 15.1 a 16.4** (cambió en SDK 56). **Android no cambió**:
`minSdkVersion 24` = Android 7.0, compile/target 36.

Verificado: `tsc` limpio, `eslint` **0 errores** (37 avisos), `expo export` de
Android OK (6.6 MB) y `expo-doctor` **21/21**. **Falta probarlo en el teléfono**
— que es justamente lo que la migración vino a destrabar.

### 3-septies. Identidad "Aurora Caribe" (2026-09-03) — compila limpio, NO probado en dispositivo

Derek comparó nueve pieles y seis estructuras sobre maquetas navegables (mismo
contenido en todas) y eligió la paleta **Aurora Caribe**. Alcance aplicado: **solo
el sistema visual** — tokens, paleta y componentes compartidos, que se propagan
a las 28 pantallas. La estructura de pantalla ("panel dividido", que también le
gustó) **NO se aplicó todavía**: es una pantalla, no un token.

- **De dónde sale la paleta (esto es lo defendible).** La empresa opera en La
  Ceiba, El Porvenir, El Pino y La Unión, todas sobre la costa atlántica de
  Honduras. El turquesa es el mar y el verde es la vegetación: es una identidad
  del **lugar donde el servicio existe**, no una moda. Reemplaza al argumento
  anterior ("los colores salen del logo"), que ya no aplica.
- **Roles y contrastes sobre blanco** (AA pide 4.5:1):
  - 🌊 **Turquesa `#0A6E67`** = marca + "en curso" — **6.10:1**
  - 🌿 **Verde pasto `#44712B`** = "completado" — **5.76:1**
  - 🟡 **Ámbar `#8A5B00`** = avisos — 5.87:1 (sin cambio)
  - 🔴 **Rojo `#9F1218`** = alertas — 8.16:1 (sin cambio)
- ⚠️ **El verde de "completado" CAMBIÓ de tono, y no es cosmético.** Pasó de
  `#1B7A5A` (verde azulado) a `#44712B` (verde amarillento). Con una marca
  turquesa, el verde anterior quedaba a ~13° de tono del color principal y los
  estados "en curso" y "entregado" se volvían indistinguibles. El verde nuevo
  está a ~86°, o sea que se separan de verdad. Efecto lateral bueno: se parece
  más al pasto real del logo.
- **Fondos:** página `#F4FCFB` (blanco con una gota de agua), tarjetas blanco
  puro. Sombras teñidas de verde profundo `#04322F` — sobre este fondo una
  sombra negra se ve gris sucio.
- **Degradados nuevos en `tema.ts`:** `GRADIENTE_MARCA` (el mar, para la portada
  de arranque) y `LUZ_DE_AGUA` (la versión suave para fondos).
  ⚠️ **Limitación honesta:** en la maqueta aprobada el fondo eran tres **manchas
  radiales** difuminadas. React Native no dibuja degradados radiales sin sumar
  una librería, así que `Degradado` lo resuelve con una transición **vertical**.
  El efecto es más sobrio que la maqueta. Las manchas exactas exigirían evaluar
  una dependencia nueva.
- **Mapas actualizados a mano** (van en WebView y no ven el tema):
  `recorrido.tsx`, `MapaBusEnVivo.tsx`, `SelectorUbicacion.tsx`.
- **El panel web también** (`transporte-web/src/theme.ts`): misma escala de
  marca con el índice 6 = `#0A6E67`. Igual el `theme-color` de `index.html`, el
  `theme_color` del manifest, la paleta de `descargar.html` (se renombró la
  variable `--azul` a `--marca`, que ya mentía) y el color del ícono de
  notificación en `app.json`.

Sin cambios de modelo, de servicios de datos ni de reglas. Verificado: `tsc`
limpio, `eslint` **0 errores**, `expo export` de Android OK y `npm run build` del
panel web OK. **Falta verlo en el teléfono.**

### 3-octies. "No estaba", panel dividido y login nuevo (2026-09-03)

**A) NIÑO QUE NO ESTABA EN LA PARADA — el problema que planteó la dueña.**
Pasaba que el bus llegaba y el niño no estaba, y **el fallo no quedaba
registrado en ningún lado**: no había constancia de que el bus hubiera pasado, y
la discusión terminaba en "el bus nunca vino" contra "esperamos y no había
nadie".

- **Modelo:** `EventoRegistro` pasó de `"subio" | "bajo"` a
  `"subio" | "bajo" | "no_estaba"` (en las dos copias de `models.ts`, verificadas
  idénticas). Sin cambios de reglas: `registros` create ya era del conductor.
- ⚠️ **El riesgo real de este cambio, y cómo se cerró.** Había **14 lugares** con
  la forma `evento === 'subio' ? A : B`, que daban por sentado que los eventos
  eran dos. Sin tocarlos, un "no estaba" se habría mostrado como **"bajó del
  bus"** — y el push le habría dicho al padre **"llegó a la escuela"** sobre un
  niño que nunca subió. Se creó `utils/eventos.ts` con los mapas
  `TEXTO_EVENTO` / `ICONO_EVENTO` / `tonoEvento()`, indexados por
  `Record<EventoRegistro, …>`: **si mañana se agrega otro evento, no compila
  hasta asignarle texto, ícono y color.**
- **Conductor** (`hoy.tsx` + `GrupoAsistencia`): acción secundaria opcional, en
  rojo y chica, al lado de "Subió" — solo en los grupos de RECOGIDA y solo
  mientras el niño sigue pendiente. Es la **única acción de la app que pide
  confirmación**, porque le manda un aviso al padre en el momento. El botón
  "Subió" queda habilitado después: si el niño aparece corriendo, se lo marca y
  el estado se corrige solo (manda el último registro; corregir es agregar, no
  editar). Estado nuevo `ausente` en conductor y padre.
- **Push al padre:** *"Ana no estaba en la parada — El bus pasó a las 6:42 y no
  pudo recogerlo."* Con la hora exacta a propósito: es lo que zanja la discusión.
- **Reportes web:** el CSV exporta "No estaba" como valor propio.
- ⏳ **Falta (propuesto y no construido):** aviso temprano por *paradas
  restantes* en vez de los 400 m actuales (que dan solo ~1-2 minutos de aviso, o
  sea que no alcanzan para prevenir el caso), botón "Esperando", y reporte de
  ausencias reincidentes. **Y una decisión de negocio pendiente: cuánto espera
  el bus.** La app puede mostrar y registrar esa regla, pero la empresa tiene
  que definirla.

**B) INICIO DEL PADRE — estructura "panel dividido"** (`hijos.tsx`), elegida
comparando seis arquitecturas sobre maquetas. El mapa del viaje en curso ahora va
**a sangre** (márgenes negativos que cancelan el margen de la pantalla), con los
datos sobre un velo, y la **cuadrícula de accesos subió justo debajo**: arriba lo
que está pasando, abajo lo que se puede hacer. Sin viaje en curso, la mitad de
arriba no se dibuja.

**C) LOGIN NUEVO** (`login.tsx`): el degradado del mar ocupa la pantalla completa
y el formulario vive en una **hoja blanca que sube desde abajo**, con esquinas de
34 px. Reemplaza al encabezado de color con tarjeta al medio. Se quitó la franja
tricolor.

**D) TRANSICIONES ENTRE PANTALLAS** (`constants/navegacion.ts` + los cuatro
layouts). Antes todo usaba `slide_from_right`, incluido el cambio de sección
desde la barra de abajo — y eso era lo que hacía que la app pareciera un pase de
diapositivas: tocar una pestaña deslizaba la pantalla entera de costado, como si
una sección estuviera "adentro" de la otra. Ahora hay **dos** transiciones, y la
diferencia es semántica:

- `TRANSICION_APILADA` (`ios_from_right` + `gestureEnabled`) para entrar más
  adentro: perfil de un hijo, formularios, chat, mapa. La pantalla saliente se
  va **más lento** y oscureciéndose (el parallax de iOS), que es lo que hace
  que se sienta profundidad en vez de un empujón. Y se vuelve deslizando
  desde el borde.
- `TRANSICION_SECCION` (`fade`, 180 ms) para la barra de abajo y para
  login/despachador: ahí no hay jerarquía, así que se cruzan con un fundido
  corto.

**E) 🔴 LOS MAPAS ESTABAN ROTOS — CARTO ahora exige API key.** Se detectó en una
captura del teléfono: las teselas mostraban el cartel **"API KEY REQUIRED"**
encima del mapa. Afectaba a **los 7 mapas del sistema**, móvil y web. Se migró de
`basemaps.cartocdn.com` al servidor oficial de OpenStreetMap
(`tile.openstreetmap.org`), que no pide clave — y que es, además, **lo que el
informe declara** ("Leaflet / OpenStreetMap"). Se quitaron `subdomains` (OSM no
los usa) y el zoom máximo bajó de 20 a 19, que es hasta donde llega OSM.
Archivos: `MapaBusEnVivo`, `SelectorUbicacion`, `recorrido.tsx` (móvil) y
`MapaArmador`, `MapaBuses`, `MapaUbicacion` (web).
⚠️ Contrapartida honesta: el estilo de OSM es más cargado que el CARTO Positron
que se venía usando. Si se quisiera volver al estilo claro habría que registrar
una API key de CARTO.

**F) INICIO DEL PADRE, segunda pasada** (pedido sobre la captura). Con viaje en
curso, el mapa ahora llega **hasta arriba de todo**: se agregó `sinEncabezado` a
`PantallaBase`, el saludo y el título no se dibujan, y el mapa crece
`ALTURA.heroMapa + insets.top` para pasar por debajo de la barra de estado. Lo
único que queda arriba es **la burbuja del perfil flotando** sobre el mapa (y la
pastilla de "En vivo"). Se eliminó la fila de tres botones (Mapa · Perfil ·
Historial): tocar el mapa ya abría el mapa, y **Perfil** e **Historial** pasaron
a la cuadrícula de accesos, con el NOMBRE del hijo en el título para que nunca
haya duda de a cuál se refieren. Sin viaje en curso, el encabezado con el saludo
vuelve a aparecer.
El alto del mapa dejó de ser un número fijo: ahora es el **46 % del alto real de
la pantalla** (`PROPORCION_MAPA_INICIO` + `useWindowDimensions`). Con 280 px
fijos el mapa ocupaba media pantalla en un teléfono chico pero apenas un tercio
en uno grande, y ahí se perdía la división en dos mitades que es toda la idea de
esta pantalla.

Verificado: `tsc` limpio, `eslint` **0 errores**, `expo export` de Android OK y
`npm run build` del panel web OK. **Falta probarlo en el teléfono** — en especial
el circuito completo de "No estaba" con dos sesiones.

### 3-nonies. Tres tipos de solicitud nuevos (2026-09-04)

`TipoSolicitud` pasó de 2 a 5 valores. **Y aparecieron dos naturalezas distintas
dentro de la misma colección**, que conviene tener clara porque es la decisión de
diseño de esta tanda:

- **PEDIDOS** (`inscripcion`, `cambio_ubicacion`, `cambio_escuela`,
  `cambio_turno`): cambian configuración, nacen `pendiente`, los aprueba el admin.
- **AVISO** (`ausencia_dia`): no cambia ninguna configuración, **nace ya
  `aprobada`** y surte efecto de inmediato.

**Por qué el aviso no espera aprobación.** Un niño se enferma a las 5 de la
mañana y el bus pasa a las 6:40. Si "hoy no viaja" dependiera de que la
administración lo lea y lo apruebe, llegaría tarde siempre y nadie lo usaría.
Además es la forma más barata de evitar que a un niño le quede un registro de
"no estaba en la parada" que no corresponde (ver §3-octies A).
⚠️ Esto exigió **tocar `firestore.rules`**: el `create` de `solicitudes` exigía
`estado == 'pendiente'`. Ahora acepta la excepción de `ausencia_dia` con
`estado == 'aprobada'`. El `update` sigue siendo solo del admin, así que un padre
no puede aprobarse un cambio de escuela. **No funciona hasta desplegar reglas.**

- **Móvil, pantallas nuevas:** `nueva-ausencia.tsx` (elegir hijo, día con flechas
  desde hoy, motivo), `nueva-solicitud-escuela.tsx` (no ofrece la escuela donde
  el niño ya está) y `nueva-solicitud-turno.tsx` (explica en palabras qué
  significa cada turno; bloquea si es el turno que ya tiene).
- **`solicitudes.tsx` reescrita como página de AYUDA.** Cada trámite dice **en
  qué caso sirve**, con un ejemplo, y si necesita aprobación o no. Es la única
  pantalla del padre donde se admite texto explicativo: "cambio de lugar" y
  "cambio de escuela" suenan casi igual pero hacen cosas distintas, y elegir mal
  cuesta trabajo a la administración y una espera inútil al padre. Un aviso de
  ausencia se muestra como **"Avisado"**, no "Aprobada" — nadie lo aprobó.
- **Conductor:** los niños con ausencia avisada aparecen con
  **"HOY NO VIAJA"** en rojo y **los botones bloqueados**, así no se los espera
  ni se los puede marcar como "no estaba".
- **Panel web:** `aprobarCambioEscuela` y `aprobarCambioTurno`. Las dos avisan en
  naranja que **hay que revisar la ruta**: una ruta sirve a escuelas concretas y
  tiene un turno, así que aprobar cualquiera de los dos puede dejar al niño en un
  bus que ya no le sirve. Reasignarlo es decisión de quien arma rutas, no algo
  para automatizar.

Verificado: `tsc` limpio, `eslint` 0 errores, `expo export` OK, `npm run build`
del panel OK, `models.ts` idénticos.

### 3-decies. Deshacer del conductor + acceso directo a "Hoy no viaja" (2026-09-04)

**A) EL CONDUCTOR PUEDE CORREGIR UN DEDAZO.** Marca de pie, con el bus andando y
niños subiendo: marcar "subió" al hermano equivocado es cuestión de tiempo. Hasta
ahora no había salida, y encima el padre ya había recibido un aviso falso.

- **Evento nuevo `anulado`** (`EventoRegistro` pasó a 4 valores). **No borra ni
  edita nada** — los registros siguen siendo inmutables: agrega un registro que
  **tacha al anterior** de ese niño. Así queda la historia completa (se marcó, se
  corrigió), que es justo lo que hace falta cuando el padre pregunta por qué
  recibió un aviso raro.
- **`registrosEfectivos()` en `utils/eventos.ts`** es quien traduce esa historia
  a lo que pasó de verdad: recorre en orden con una **pila** y cada `anulado`
  hace `pop()`. Funciona igual si se deshace dos veces seguidas, y sirve tanto
  para deshacer un "subió" como un "bajó" sin lógica especial para cada caso.
- **Al padre no se le muestran** ni las marcas tachadas ni los `anulado`: para
  él esa marca nunca existió. La historia completa queda en Firestore para la
  administración. Aplicado en el estado del hijo, en "viajes pasados" y en el
  historial.
- **Sí se le avisa la corrección** (push "Corrección sobre Ana"): si la marca
  equivocada fue un "subió", el padre está creyendo que su hijo va en el bus.
  Callarse la corrección sería peor que el error original.
- **Botón "Deshacer"** en `GrupoAsistencia`, solo sobre lo ya marcado, chico y
  gris para no competir con la acción principal. Con confirmación, porque manda
  un aviso al padre. Cableado en los cuatro grupos (recogida y entrega).
- **Reportes web corregidos:** `contarNinosTransportados` descartaba mal las
  marcas deshechas — un "subió" anulado inflaba el número de niños
  transportados, que es justamente el dato que mira la empresa. Ahora aplica la
  misma lógica de pila por niño.

> Este cambio salió barato gracias a `utils/eventos.ts` (§3-octies A): los mapas
> están indexados por `Record<EventoRegistro, …>`, así que agregar el cuarto
> evento **rompió la compilación** hasta darle texto, ícono y color en un solo
> archivo, en vez de dejar catorce ternarios mintiendo.

**B) "Hoy no viaja" ahora está en el inicio del padre**, reemplazando a
"Inscribir un hijo" en la cuadrícula. Motivo: se usa a las 5 de la mañana con un
hijo enfermo y el bus pasando a las 6:40 — dos toques de más importan. Inscribir
se hace una vez en la vida y sigue en Solicitudes, bien explicado.

Verificado: `tsc` limpio, `eslint` 0 errores, `expo export` OK, build web OK,
`models.ts` idénticos.

### 3-undecies. El fondo por fin es la "luz de agua" (2026-09-04)

Al aplicar Aurora Caribe (§3-septies) se dejó preparado el degradado
`LUZ_DE_AGUA` pero **nunca se usó**: el fondo de la app siguió siendo un color
plano. O sea que el fondo que se veía no era el que se había elegido en las
maquetas. Ahora `PantallaBase` pinta el fondo con `Degradado`.

- **Va en el contenedor de la pantalla, no dentro del scroll**, para que quede
  quieto mientras el contenido se desplaza. Un degradado que se mueve con el
  scroll se nota y se ve barato.
- ⚠️ **El último color del degradado es exactamente `colors.background`.** No es
  capricho: hay barras fijas al pie pintadas con ese token (el botón de iniciar
  viaje del conductor, el campo de escribir del chat). Si el degradado terminara
  en otro tono, se vería una **costura horizontal** justo ahí. Terminando donde
  termina, la barra se funde con el fondo.
- `LUZ_DE_AGUA_OSCURA` nueva para el modo oscuro, con el mismo criterio.
- 20 franjas en vez de 32: los cuatro tonos están tan cerca que no se ve ningún
  escalón, y son 12 vistas menos por pantalla en teléfonos de gama baja.

**Ajuste (mismo día, elegido sobre maqueta comparativa): degradado INVERTIDO.**
Ahora va blanco arriba → agua abajo (`#FFFFFF → #D6EFE9`), que da más peso al
pie de la pantalla. Eso rompió la regla de la costura: el final del degradado ya
no coincide con `colors.background`.
Se resolvió con **`fondoPie(oscuro)` en `tema.ts`**, que **calcula** el último
tono del degradado en vez de repetirlo a mano. Lo usan el pie del conductor
(`hoy.tsx`) y la barra de escribir del chat (`conversacion.tsx`). Si mañana se
cambia el degradado, los pies lo siguen solos — escrito a mano, alguien lo
cambia, se olvida de uno, y queda una línea atravesando la pantalla.

**Emojis en Solicitudes.** Los cinco trámites (y la lista de enviadas) usan
🚌 📍 🏫 🕐 🎒 en vez de íconos de línea: el color y la forma ayudan a encontrar
el trámite sin leer los cinco títulos. Es coherente con lo que ya se hacía en los
mapas (🚌 🏠 🏫). El significado lo sigue cargando el título — el emoji acompaña,
no informa solo.
⚠️ Deuda de consistencia: el resto de la app usa `MaterialCommunityIcons`. Si se
quiere unificar, hay que decidir hacia qué lado.

### 3-duodecies. El panel web adopta el diseño de la app (2026-09-04)

El panel ya tenía los colores de Aurora Caribe pero no el **lenguaje visual**:
seguía siendo un Mantine por defecto con la paleta cambiada. Ahora las dos
mitades del sistema se leen como un solo producto.

- **Fondo de luz de agua** (`index.css`): el mismo degradado del móvil sobre el
  `body`, con `background-attachment: fixed` para que no se mueva con el scroll.
  Las tres zonas del `AppShell` quedan **translúcidas** (`--mantine-color-body:
  transparent`) para que se vea a través de todo el panel.
- **Encabezado y barra lateral esmerilados**: blanco al 75 %/55 % con
  `backdrop-filter: blur(12px)`. El contenido pasa por debajo al hacer scroll y
  se sigue intuyendo — el mismo recurso de vidrio de los velos del móvil.
- **`theme.ts` ampliado**: escala de esquinas, **sombras teñidas de verde
  profundo** (`#04322F`, como en el móvil), titulares apretados, y valores por
  defecto de Card/Paper/Modal/Button/inputs.
- ⚠️ **Se adaptó, NO se calcó.** Las esquinas del panel llegan a 24 px, no a los
  28 del móvil, y los botones no van en cápsula completa. En un teléfono esas
  medidas se sienten amables; en una tabla o un formulario denso se ven
  infladas. Es una decisión consciente, no una inconsistencia.
- **Login partido en dos** (`LoginScreen.tsx`): el mar a la izquierda con la
  marca, el formulario a la derecha sobre blanco. Es la traducción a proporción
  de escritorio de la pantalla del móvil (donde el mar está arriba y la hoja
  sube desde abajo): en un monitor, un degradado a lo alto con el formulario
  flotando en el medio se vería vacío. En pantallas chicas el panel del mar se
  oculta y el logo se repite sobre el formulario.
- **Los 16 destinos del menú se agruparon** en cuatro bloques —Operación,
  Catálogo, Análisis, Herramientas—. Con dieciséis enlaces en lista plana el ojo
  no encuentra nada: hay que leerlos todos. Los grupos siguen cómo se usa el
  panel, no cómo está hecho.

Verificado: `npm run build` y `eslint src` limpios.

### 3-terdecies. Dashboard nuevo y filtros en todo el catálogo (2026-09-04)

**A) EL TABLERO PASÓ DE CONTAR A AVISAR.** Antes eran cinco contadores del
sistema; el problema es que un número dice *cuánto hay*, no *qué hacer*: "142
niños activos" es cierto todos los días y no cambia ninguna decisión. Ahora está
ordenado por urgencia:

1. **Requiere tu atención** — solicitudes sin responder, **niños que no estaban
   hoy** y rutas que todavía no salieron. Las tarjetas **se encienden solo si
   hay algo** (ámbar / rojo); en un día tranquilo la fila se ve gris, y eso ya
   es información. Son botones: llevan a resolverlo.
2. **Cómo va el día** — viajes en curso, terminados, niños transportados.
3. **En el sistema** — los totales de antes, abajo y en chico.

`obtenerResumenHoy()` en `dashboardService`. Reusa la **lógica de pila** de
`registrosEfectivos`: una marca que el conductor deshizo no cuenta como niño
transportado. Y "no estaba" solo cuenta si el niño **no terminó subiendo** — si
apareció corriendo y lo marcaron, el día salió bien.
⚠️ **Costo:** ~200 lecturas por carga (los viajes de hoy más los registros de
cada uno). Por eso **no** se dejó en tiempo real con un listener: eso
multiplicaría el gasto por cada marcado de asistencia.

**B) FILTROS Y PAGINACIÓN EN LAS 7 SECCIONES DEL CATÁLOGO** (conductores,
padres, buses, escuelas, puntos, niños, rutas).

- Piezas compartidas: `utils/filtros.ts`, `hooks/use-paginacion.ts` y
  `components/FiltrosCatalogo.tsx`, para que buscar se sienta igual en las siete.
- **La búsqueda ignora tildes y acepta palabras en cualquier orden.** Sin lo
  primero, "josue" no encuentra a "Josué" — y nadie escribe tildes en un
  buscador. Sin lo segundo, escribir el apellido antes que el nombre no
  encuentra nada.
- **Contador "Mostrando 12 de 340"**: sin él, el admin no sabe si ve todo o una
  parte, y termina dudando de si un registro existe o solo está filtrado.
- **Filtro de estado** en las siete (por defecto "Activos": las listas mezclan
  vigente con archivado por el borrado lógico). **Niños** suma escuela y turno;
  **Rutas** suma turno. Búsquedas cruzadas útiles: un bus se encuentra por placa
  **o por el nombre de su conductor**; una ruta, por su placa o sus escuelas.
- Paginación de 25 por página, con la página **acotada al vuelo** en vez de
  corregida con un efecto (evita el parpadeo de tabla vacía).
- ⚠️ **Límite documentado:** el filtrado es EN EL CLIENTE — se traen los
  documentos y se filtra en memoria. Es lo correcto para cientos de registros
  por colección y evita índices compuestos, que el proyecto viene esquivando a
  propósito. Pasados unos pocos miles de documentos habría que paginar contra el
  servidor. Es material directo para la §5.7.2 del informe.

Verificado: `npm run build` y `eslint src` limpios.

### 3-quaterdecies. El busito de cargando, en las dos mitades (2026-09-04)

La rueda gris de siempre se reemplazó por un **bus andando sobre una carretera
que corre**, en la app y en el panel. Una rueda no dice nada; el bus le recuerda
al usuario qué está usando mientras espera.

- **Móvil:** `components/CargandoBus.tsx`, con `Animated` y
  `useNativeDriver: true` — la animación corre en el hilo nativo, así sigue
  fluida justo cuando JavaScript está ocupado esperando a Firebase.
- **Web:** `components/CargandoBus.tsx` + `@keyframes` en `index.css`, con la
  misma mecánica para que esperar se sienta igual en las dos mitades. **Se apaga
  solo** para quien pidió menos animación en su sistema (`prefers-reduced-motion`).
- **El truco:** el bus casi no se mueve; lo que corre es la **carretera**. Un bus
  que cruzara la pantalla se saldría y habría que reiniciarlo de un salto; con la
  carretera en bucle el movimiento es continuo. Como todas las rayas son iguales,
  el salto al reiniciar es invisible.
- **Cada carga dice QUÉ está esperando** ("Cargando tus hijos…", "Armando el
  tablero…", "Buscando los buses…"). Un texto concreto hace que la espera se
  sienta más corta que un círculo girando.
- **Alcance deliberado:** se cambiaron las cargas **de pantalla** (17 en el
  móvil, 15 en la web). Los spinner **dentro de un botón** siguen siendo ruedas
  —`BotonPrincipal`, el GPS de `SelectorUbicacion`, los inline del panel—:
  un bus dentro de un botón sería ridículo y además no cabe.
- `PortadaAnimada` conserva su propia copia a propósito: allá el bus va más
  grande, sobre el degradado azul y con el logo, y es una pantalla ya probada.

Verificado: `tsc`, `eslint` 0 errores y `expo export` en el móvil; `npm run
build` y `eslint src` en la web.

### 3-quinquiesdecies. Identidad "Liquid Obsidian & Specular Glass" (2026-09-07) — compila limpio, NO probado en dispositivo

**La app móvil pasó de CLARA a OSCURA.** Es un cambio de identidad completo, no
una variante de la anterior: se reemplaza "Aurora Caribe" (turquesa sobre
blanco, tarjetas flotando con sombra difusa, esquinas de 28 px).

**De dónde sale el diseño.** Se generó en **Google Stitch**, proyecto
`RutaEscolar Ceiba` (`projects/8454737076624822774`), design system **"Liquid
Obsidian & Specular Glass"** (`assets/f3c88cbb22754c7fab5a3dbeda3c934b`). Stitch
había producido cuatro familias de estilo para las mismas pantallas —
*TransCeiba* (navy claro), *Modo Sereno* (verde agua), *Tono Neutro* (crema
editorial) y *Espejo Moderno* / **Liquid Obsidian** (oscuro) — y Derek eligió la
oscura. Las 24 pantallas y el `DESIGN.md` se bajaron por el MCP de Stitch
(`https://stitch.googleapis.com/mcp`).

**El alcance fue: adoptar el LENGUAJE VISUAL conservando los botones y funciones
que ya existen.** Las pantallas de Stitch muestran funciones que este sistema no
tiene (ETA calculado, cámara en vivo, banner de modo sin conexión); ésas no se
implementaron.

**⚠️ La advertencia honesta, para el informe.** Este design system dice de sí
mismo *"low-glare **evening** operation"*, y el otro `DESIGN.md` del mismo
proyecto Stitch dice que el modo claro es **obligatorio** para el conductor por
el sol. Un fondo negro se lee peor al mediodía en La Ceiba. Se adoptó igual (es
la identidad elegida) y se compensa donde importa: **los botones de asistencia
del conductor NO van en vidrio translúcido sino con relleno sólido y saturado**
— ver la nota grande en `components/GrupoAsistencia.tsx`.

**El sistema, en cinco piezas:**

- **`constants/tema.ts` — reescrito.** Un solo tema, oscuro (el design system es
  `colorMode: DARK` y no trae contraparte clara; inventarle una sería inventar
  diseño). La app ya **no sigue el modo del teléfono**: `userInterfaceStyle` pasó
  a `"dark"` en `app.json`, y los hooks `use-color-scheme.ts` / `.web.ts` se
  borraron por quedar muertos. Cada color conserva su TRABAJO del tema anterior,
  así ninguna pantalla cambió de significado: 🔵 zafiro `#2563EB` = marca y "está
  pasando ahora" · 🟢 esmeralda `#10B981` = cumplido · 🟡 ámbar `#F59E0B` = avisos
  · 🔴 rojo = alertas · 🩵 **cian `#38BDF8` = telemetría** (color nuevo: que el GPS
  ande no es lo mismo que que el niño esté bien, y ahora la app no lo confunde).
- **`constants/estilos.ts` — reescrito.** Tokens de vidrio (tres niveles de
  desenfoque, velo, contorno y filo especular), radios 24/16/12/cápsula, la
  regla de radios concéntricos, `halo()` (sombra del color del objeto, que
  ilumina en vez de oscurecer) y `ALTURA.filaNino = 72`.
- **`components/Vidrio.tsx` — NUEVO, el material de toda la app.** Cuatro capas:
  desenfoque + velo en degradado inclinado + **filo especular de 1 px en el borde
  de arriba** + contorno. Dos vistas anidadas porque en iOS `overflow: 'hidden'`
  recortaría también la sombra.
- **`components/PastillaEstado.tsx` — NUEVO.** La cápsula de estado única de las
  tres apps, con punto que brilla y **pulso de radar solo en lo que está vivo**.
  Reemplazó cinco pastillas ad-hoc distintas (padre, conductor, admin,
  solicitudes, historial): ahora el padre y el conductor ven el mismo indicador
  para el mismo hecho.
- **Reescritos al lenguaje nuevo:** `Tarjeta`, `BotonPrincipal` (espejo de zafiro
  en degradado + halo), `Campo` (la "zanja" hundida), `ChipFiltro`,
  `TileAccion`, `TarjetaAviso`, `TituloSeccion`, `BarraBurbuja`, `PantallaBase`
  (con el resplandor de zafiro detrás del encabezado), `GrupoAsistencia`,
  `Degradado` y `app/login.tsx`.

**Tipografía — Outfit + Plus Jakarta Sans.** Titulares y cifras en Outfit (la
geométrica, "de tablero de auto"); texto y controles en Plus Jakarta Sans.
Dos detalles que valen para la defensa:

- **El grosor se cambia CAMBIANDO DE FAMILIA, nunca con `fontWeight`.** Con una
  fuente cargada de archivo, `fontWeight` no busca otro archivo: le aplica
  negrita sintética a la que ya está. Se barrieron los 31 usos que había.
- **Cada peso se importa de su subcarpeta** (`@expo-google-fonts/outfit/500Medium`)
  y no del paquete: el índice hace `require` de los nueve pesos y Metro no los
  descarta. Medido acá: **de 16 archivos de fuente a 7** (~1 MB de APK menos).
- `estilosBase.cifra` usa `tabular-nums`: los contadores del conductor no
  "tiemblan" al pasar de 9 a 10.

**Los mapas, oscuros sin cambiar de proveedor.** Un mapa claro dentro de una app
oscura es un rectángulo que encandila. En vez de migrar a CARTO Dark Matter o
Stadia (las dos piden API key ahora, y el informe declara OpenStreetMap), **las
teselas se invierten por CSS**: `invert(1) hue-rotate(180deg)` — el
`hue-rotate` es lo que evita que el agua quede naranja. El filtro va **solo
sobre `.leaflet-tile-pane`**, no sobre el mapa entero, para no invertir también
los marcadores. El CSS vive UNA vez en **`constants/mapa.ts`** (nuevo) y lo usan
los tres mapas (bus en vivo, selector de ubicación, recorrido del conductor).

**Lo que Stitch aportó además del color** (y que sí se construyó, porque los
datos ya existían): el **trío de cifras** del conductor — ESPERANDO / A BORDO /
ENTREGADOS en números grandes, arriba de la barra de progreso — y la lista de
asistencia con inicial del niño, pastilla de estado y filas de 72 px.

**Dependencias nuevas (4).** Se declaran acá porque CLAUDE.md §4 lo exige:
`expo-blur` y `expo-linear-gradient` (paquetes oficiales de Expo; el vidrio y
los degradados diagonales del diseño no se pueden dibujar sin ellos — el
`Degradado` hecho a mano solo sabía hacer verticales y costaba 32 vistas cada
uno), más `@expo-google-fonts/outfit` y `@expo-google-fonts/plus-jakarta-sans`.

**El login se rehízo aparte (2026-09-07, segunda pasada).** Derek mostró una
maqueta de Stitch —*"Splash de Carga y Transición a Login Moderno"*— que **no
está guardada en el proyecto**: se revisaron `list_screens` (12 pantallas) y las
4 ocultas que solo aparecen en `get_project`, y ninguna es ésa. Los dos logins
que sí existen ahí son "Login Universal - Liquid Obsidian"
(`c10ffb84f36d…`) y "Acceso - Liquid Obsidian & Specular Glass"
(`5382e77f7186…`). La pantalla se construyó a partir de la captura.

`app/login.tsx` quedó en dos piezas: una **portada animada** (degradado de
zafiro con tres esferas de luz que flotan en bucle, `Animated` con
`useNativeDriver`) y una **hoja que sube** con el formulario. La animación
cuenta algo real y no rellena una espera: mientras Firebase revisa si hay sesión
guardada se ve SOLO la portada con el busito, y la hoja sube recién cuando
resuelve que no hay sesión — si la hay, la hoja no aparece nunca. La portada se
encoge sola al abrirse el teclado (40 % → 16 % del alto) para que el botón de
entrar no quede tapado en un teléfono chico.

**Se dejaron afuera seis cosas que la maqueta muestra y el sistema no tiene**, y
el motivo de cada una está escrito en la cabecera del archivo: login por
teléfono/DNI y "PIN escolar" (Firebase acá es solo Email/Password); la casilla
"Recordar este dispositivo" (la sesión SIEMPRE persiste vía AsyncStorage — una
casilla que no se puede desmarcar de verdad miente); las fichas Padres /
Conductor / Admin como forma de ingresar (el rol sale de Firestore DESPUÉS de
autenticar, no se elige); Face ID / huella (haría falta
`expo-local-authentication`, y no reemplaza a la contraseña); y "Volver" y
"Flota En Línea" (no hay pantalla anterior, y las reglas de Firestore bloquean
toda lectura sin sesión). El lugar que ocupaban las fichas de rol lo toma el
bloque "¿Primer ingreso?", que dice lo que aquéllas sugerían sin poder cumplir:
quién define tu rol.

**Decisión de rendimiento que conviene poder explicar:** el desenfoque real está
**apagado por defecto** y se enciende solo donde hay algo que desenfocar — la
barra flotante (pasa contenido por detrás al hacer scroll) y las láminas sobre
un mapa. En una lista, desenfocar el fondo liso devuelve el mismo color plano y
cuesta una vista desenfocada por tarjeta en los teléfonos de gama baja que
tienen los padres. Los tonos sólidos del tema se calcularon justamente como
"este vidrio apoyado sobre la obsidiana", así que se ven igual.

Verificado: `tsc --noEmit` limpio, `eslint` **0 errores**, y `expo export
--platform android` genera el bundle con las 7 fuentes correctas.
**Falta probarlo en el teléfono** (ver §9).

### 3-sexiesdecies. La pantalla azul, y la regla que salió de ahí (2026-09-08)

Derek probó la app y **todas las pantallas salían en azul, vacías**, en los tres
roles: no se podía ni iniciar sesión. La causa fue un error de diseño del
rediseño anterior, no de las funciones (la capa de datos —`services/`,
`context/`, `types/`— no se tocó en ningún momento).

**La cadena:** el rediseño sumó dos dependencias **NATIVAS**, `expo-blur` y
`expo-linear-gradient`. Un módulo nativo no entra a un binario ya compilado: si
la app corre sobre un **APK o dev-client construido antes**, React Native no
puede crear esa vista y **no dibuja nada**. Y como el degradado se había puesto
como CONTENEDOR de cada pantalla (`<Degradado>…contenido…</Degradado>`), al
fallar el degradado se iba con él todo el contenido. Quedaba solo el fondo del
tema de navegación, `#0F131D` — el azul oscuro que se veía.

**LA REGLA, que vale para todo el proyecto de acá en adelante: un fondo es una
CAPA DETRÁS, nunca el contenedor del contenido.** Si el fondo es un componente
nativo y falla, tiene que caerse el fondo, no la pantalla.

Qué se cambió:

- **`components/PantallaBase.tsx`** (todas las pantallas) y
  **`components/PortadaAnimada.tsx`** (el arranque): el degradado pasó a ser un
  hermano absoluto con `pointerEvents="none"`, y el contenido quedó afuera. El
  contenedor lleva además el primer tono del degradado como color plano, así
  tampoco se ve un salto mientras la capa nativa carga.
- **Color sólido de respaldo debajo de cada degradado**: en `Vidrio` (un tono
  por nivel), en `BotonPrincipal` y en la portada del login. Ahora, en el peor
  caso, la app se ve plana; nunca vacía. En `Vidrio` el respaldo se aplica
  **solo si no hay desenfoque real**: con `translucido`, un fondo opaco abajo
  sería justamente lo que el BlurView desenfocaría y se perdería el efecto.
- **`app/login.tsx`**: la hoja del formulario arrancaba en `opacity: 0` y subía
  con la animación. Eso deja el formulario colgando de que la animación llegue a
  correr. Ahora arranca **visible** y la animación la lleva al estado inicial
  antes de soltarla. **Nunca esconder contenido detrás del éxito de una
  animación.**
- **`app/_layout.tsx`**: el arranque esperaba a `useFonts` sin límite. Si los
  assets no llegaban (Metro caído, LAN lenta), la app quedaba en la pantalla de
  arranque para siempre. Ahora hay un tope de 4 s y arranca igual con la letra
  del sistema.

⚠️ **Lo que Derek tiene que hacer igual:** con dependencias nativas nuevas hay
que **volver a compilar** (`eas build -p android --profile preview`) o probar en
**Expo Go de SDK 57**, que ya trae los dos módulos. Los arreglos de arriba hacen
que la app se degrade con dignidad, pero el vidrio y los degradados solo se ven
de verdad con un binario que los incluya.

Verificado: `tsc` limpio, `eslint` 0 errores, `expo export --platform android` OK.

### 3-septiesdecies. Las tarjetas y el orden, según Stitch (2026-09-08)

Segunda pasada del rediseño: además de los colores y el material, ahora la
COMPOSICIÓN y el ORDEN de las tarjetas siguen las maquetas de Stitch. La
estructura de cada pantalla se sacó del HTML real bajado por el MCP, no de mirar
las capturas.

**Login — el splash y su transición.** La maqueta se llama "Splash de Carga y
Transición a Login Moderno", y ahora hace las dos cosas: (1) la portada ocupa la
pantalla ENTERA con el logo entrando (escala + aparición) y el busito; (2) al
resolverse la sesión, la portada **se encoge** hasta el 40 % del alto mientras
la hoja del formulario sube desde abajo. `DURACION_SPLASH` (1,7 s) es un
mínimo, no un fijo: si Firebase tarda más, el splash espera. Sin ese mínimo,
cuando Firebase responde en 200 ms no se veía nada. No le cuesta tiempo a nadie
en el uso diario, porque esta pantalla solo aparece cuando NO hay sesión
guardada. Es la única animación de la app con `useNativeDriver: false` — se
anima el ALTO, que es una propiedad de layout y el hilo nativo no la maneja;
ocurre una sola vez y en una pantalla que no hace nada más.

**`components/Metrica.tsx` — NUEVO.** La mini-tarjeta de una cifra, con la
etiqueta arriba y el número abajo. Es la misma pieza en el conductor y en el
admin porque en el diseño es la misma. Los números van a DOS DÍGITOS ("04") y en
fuente tabular: con un dígito las columnas quedan de ancho distinto, y al pasar
de 9 a 10 se corre todo lo de al lado.

**Conductor (`hoy.tsx`).** El encabezado quedó en el orden del diseño:
*Ocupación de cabina* (cuántos lleva de cuántos) → barra de progreso de dos
tramos → las tres métricas. La tercera casilla cambia sola: mientras nadie
falte muestra los entregados y, en cuanto hay un niño que no estaba, pasa a
mostrar eso. Se agregó el conteo de `ausentes`, que antes no existía.

**Padre (`hijos.tsx`).** Se REORDENARON las secciones al orden de la maqueta:
viaje en curso → **Núcleo familiar** → **Gestiones rápidas** → **Comunicados**.
Antes las gestiones iban antes que la familia. El orden nuevo sigue el de las
preguntas que se hace el padre al abrir la app: qué está pasando, quiénes son,
qué puedo hacer, qué me dijeron.

**Admin (`monitoreo.tsx`).** Los tres cuadros sueltos se reemplazaron por una
lámina única, "Operación de hoy", con la pastilla de estado y el trío de
métricas adentro (En curso / Terminadas / Sin salir), más un renglón con los
alumnos del día sumados sobre todas las rutas. El componente local `Cuadro`
desapareció: lo reemplaza `Metrica`, compartido con el conductor.

**`TituloSeccion`** gana `detalle`: una etiqueta PASIVA a la derecha ("2
inscritos"), distinta de `textoAccion`, que es un enlace. Sin esa diferencia el
usuario toca un texto que no hace nada.

**Lo que NO se trajo de la maqueta, y por qué:**
- **La lista del conductor niño por niño con pastillas de filtro** (Todos /
  Pendientes / A bordo / Ausentes). La app agrupa por PARADA, y eso es un
  requisito del proyecto (CLAUDE.md §2: "niños agrupados por parada, en el orden
  en que va a pasar por ellas"), no una preferencia. Se conservó el agrupamiento.
- **El radar de flota del admin.** El mapa con todos los buses existe, pero en el
  panel WEB (`transporte-web`, Fase 8); la app del admin nunca lo tuvo.
- **La sub-tarjeta del conductor con botón de llamada dentro de la tarjeta de
  viaje del padre.** El dato existe (`padreService` deriva el conductor por
  `ruta.busId → bus.conductorId`) pero no está mapeado por hijo, así que traerlo
  toca la capa de datos. Queda pendiente — ver §9.
- Clima, ETA calculado, nivel de combustible, velocidad, asiento asignado, NFC y
  "% en tiempo": el sistema no tiene ninguno de esos datos.

Verificado: `tsc` limpio, `eslint` 0 errores, `expo export --platform android` OK.

### 3-duodevicies. "Tengo rutas y el conductor no las ve" (2026-09-08)

Derek reportó rutas creadas en el panel que no aparecían en la app del
conductor. **Se auditó la cadena entera y el código está bien**: el id del
documento del usuario ES el uid de Auth (`setDoc(doc(db,"usuarios", uid))`), la
pantalla de Buses exige elegir conductor, `crearRuta` y `crearBus` ponen
`activa`/`activo` en true, y las reglas permiten a cualquier autenticado leer
`buses` y `rutas`. O sea que era un problema de ESTADO de los datos, no de
cableado — y el defecto real era que **ni la app ni el panel sabían decir cuál**.

**La raíz del malentendido, que conviene tener escrita:** el panel y la app no
miran lo mismo.

| | Panel (admin) | App (conductor) |
| --- | --- | --- |
| Rutas | `orderBy("nombre")` — sin filtro | `busId == mi unidad` **y** `activa == true` |
| Buses | `orderBy("placa")` — sin filtro | `conductorId == mi uid` **y** `activo == true` |

Y hay un detalle de Firestore que lo agrava: **un filtro de igualdad descarta
los documentos que NO TIENEN ese campo**. Una ruta sin `activa` no es "una ruta
inactiva": es invisible para la app, y el panel la lista igual. De ahí que el
admin jure que la ruta existe y el conductor vea la pantalla vacía.

**En la app (`services/conductorService.ts` + `app/(conductor)/hoy.tsx`).** Antes
había UN mensaje ("No tenés un bus asignado") para cuatro causas distintas,
porque las consultas devolvían `null`/`[]` tanto si no había nada como si
fallaban. Ahora `diagnosticarAsignacion()` repite las consultas **sin** los
filtros de estado, compara, y devuelve la causa real: sin unidad · unidad
desactivada · unidad sin rutas · rutas desactivadas o sin el campo · permiso
denegado · error de red. `mensajeDeDiagnostico()` la traduce a una instrucción
que el conductor puede leerle por teléfono al admin, con el lugar exacto del
panel donde se arregla. Además `escucharRutasDelBus` **ya no traga el error**:
lo pasa al callback, así un permiso denegado o un índice faltante no se
confunden con "no hay rutas".

**En el panel (`screens/RutasScreen.tsx`).** Cada fila de la tabla revisa la
misma cadena que recorre la app (ruta → unidad → conductor) y, si algún eslabón
está roto, muestra una insignia roja **"No le llega al conductor"** con el
motivo exacto en el tooltip. También se corrigió que la pantalla cargaba solo
los buses ACTIVOS: una ruta con la unidad apagada se veía como "(sin bus)" y
mandaba a buscar el problema donde no estaba. Ahora se cargan todos (los
desactivados solo para el diagnóstico; el selector del formulario sigue
ofreciendo únicamente los activos).

Verificado: `tsc` limpio y `eslint` 0 errores en las dos mitades; `npm run build`
de la web OK.

### 3-undevicies. Mapa con entrada animada, trámites reordenados y "quién lo lleva" (2026-09-08)

Tres pedidos de Derek sobre la maqueta.

**1. El mapa no se veía como el diseño.** Tres cambios en `constants/mapa.ts` y
`components/MapaBusEnVivo.tsx`:

- **Color.** El filtro de inversión estaba demasiado apagado (`saturate(.55)`) y
  el velo encima demasiado denso (`.42`): entre los dos dejaban el mapa gris.
  Ahora `saturate(.9)` con el velo en `.28`, y el agua y la vegetación vuelven a
  distinguirse — que es lo que hacía que el mapa se viera muerto.
- **Marcadores en CÁPSULA, no alfileres.** El diseño usa pastillas con nombre
  ("El Naranjal", "Unidad 04"): un punto de color y el texto al lado, sobre
  vidrio oscuro. La diferencia no es estética — un alfiler obliga a tocarlo para
  saber qué es; la cápsula ya lo dice, y el padre mira este mapa diez segundos.
  El destino va en ÁMBAR y el bus en ZAFIRO encendido con su aura latiendo, así
  no hay que leerlos para distinguirlos. Se arman con `textContent`, no con
  HTML, para que el nombre de una parada escrito por un padre no pueda inyectar
  marcado.
- **ENTRADA ANIMADA.** El contenedor arranca invisible, escalado al 106 % y con
  6 px de desenfoque, y entra cuando Leaflet avisa que cargó la PRIMERA tanda de
  teselas (`capa.on('load')`). No es adorno: las teselas cargan de a una y el
  armado se veía feo —primero gris, después parches, después el mapa—; así el
  usuario ve el mapa YA HECHO. Hay una red de seguridad de 2,5 s: si una tesela
  no llega, el evento nunca dispara y el mapa quedaría invisible para siempre.
- La ruta ganó un **halo**: tres líneas superpuestas (halo ancho de zafiro al
  22 %, borde negro, trazo claro) más `drop-shadow` sobre la capa de trazos. Es
  el mismo recurso que el resto de la app — una sombra del color del objeto, que
  ilumina en vez de oscurecer.

**2. Trámites: el historial estaba enterrado.** `app/(padre)/solicitudes.tsx`
mostraba los cinco trámites y, recién al final, TODO lo enviado junto — había
que bajar la pantalla entera para ver si te habían contestado. Ahora son dos
secciones separadas, porque son dos preguntas distintas: **"Esperando
respuesta"** va ARRIBA de todo (es la que se hace todos los días) y
**"Historial"** al final (la que se hace una vez cada tanto). Los avisos de
ausencia no infllan la lista de espera: nunca necesitaron aprobación, así que
caen directo al historial. La tarjeta de una solicitud se extrajo a
`tarjetaDeSolicitud` para dibujarla en los dos lugares sin duplicarla.

**3. Inicio del padre: "quién lo lleva".** Era el pendiente §8 y ya está hecho.
La tarjeta del viaje ahora muestra al conductor con su foto, su nombre, la
unidad, y botones de **llamar** (`Linking`, teléfono) y **escribir** (el chat de
la Fase 7). La cadena se resuelve al revés que en la app del conductor:
ruta → `busId` → bus → `conductorId` → usuario, con `obtenerBus` y
`listarContactosPadre`, que ya existían en `padreService`. Se carga DESPUÉS de
`setBase` y sin `await`: es información de adorno, y si tarda o falla, el estado
del hijo —que es lo que importa— ya se está viendo. Si algún eslabón falta, la
fila no se dibuja: media fila con huecos comunica peor que nada. De paso, la
placa alimenta la etiqueta "Unidad XX" de la cápsula del bus en el mapa.

**De la maqueta quedó afuera** lo que el sistema no puede calcular: el clima, el
"65 % completado" de la ruta (el padre no puede leer los registros de los demás
niños — las reglas se lo impiden, y con razón), "llegada en ~3 min" y "estimado
07:15" (no hay cálculo de ETA), asiento asignado, NFC, "cabina climatizada" y
"compartir ruta".

Verificado: `tsc` limpio, `eslint` 0 errores, `expo export --platform android` OK.

### 3-vicies. El servidor de OSM bloqueó la app; el mapa vuelve a su estilo (2026-09-08)

Derek reportó que el mapa "no cambió nada". Tenía razón, y no era el color:
**`tile.openstreetmap.org` devuelve teselas de "Access blocked — App is not
following the tile usage policy of OpenStreetMap's volunteer-run servers"**.
Verificado bajando teselas reales de La Ceiba con y sin User-Agent de navegador,
y también con `Referer`.

⚠️ **EL BLOQUEO ES INTERMITENTE, y eso es lo que más confunde al diagnosticar:**
algunas teselas pasan y otras no. En la misma tanda, la de la costa (z13) volvió
completa y la de la ciudad (z14) volvió bloqueada. O sea que el mapa no aparecía
"vacío" sino como un MOSAICO de teselas buenas y avisos de bloqueo — que a
primera vista parece un problema de estilo, no de servidor.

Y hay un detalle que impide detectarlo por código: el aviso llega como HTTP
**200 con una imagen** que dibuja el número 418. Para Leaflet es una tesela
válida, así que `tileerror` nunca dispara. Solo se ve con el ojo.

**Proveedores evaluados, renderizando la tesela real de La Ceiba (z13, costa) y
comparándolas a ojo, no de memoria:**

| Proveedor | Resultado |
| --- | --- |
| OSM oficial | 403 "Access blocked" |
| Wikimedia | 403 |
| CARTO dark_matter | 200, pero con **"API KEY REQUIRED"** incrustado en la imagen |
| Stadia / Thunderforest | exigen API key |
| Esri Dark Gray Canvas | limpio, pero es un LIENZO: casi sin color ni detalle |
| Esri World Street Map | limpio, pero apagado: sin verde ni azul, edificios apenas visibles |
| OSM Francia (HOT) | funciona, pero es el estilo humanitario: apagado y naranja |
| **`tile.openstreetmap.de`** (FOSSGIS e.V.) | **el estilo CLÁSICO de OSM, el mismo de siempre** ← el elegido |

La elección se confirmó poniendo los tres estilos **lado a lado contra una
tesela oficial real** que sí había pasado el bloqueo: el servidor alemán es
prácticamente indistinguible del oficial (mismos amarillos, mismo azul de río,
mismos verdes, mismas etiquetas), mientras que el francés se reconoce al
instante como otro estilo. Vale aclararlo porque el nombre engaña: el servidor
está en Alemania, pero **el mapa no tiene nada de alemán** — es el mismo
OpenStreetMap Carto de siempre, con los nombres locales en español.

**EL MAPA VA CLARO, aunque la app sea oscura.** Se probó oscurecerlo por los dos
caminos —invertir un mapa claro por CSS y usar el lienzo Dark Gray de Esri— y
los dos salieron peor: los lienzos oscuros son neutros a propósito, y oscurecer
un mapa claro apaga justamente lo que sirve, que es distinguir una calle de un
parque y de un río. Un padre mira ese mapa diez segundos para reconocer SU
barrio. La unidad con el resto de la app la dan las piezas que van ENCIMA —las
cápsulas de vidrio oscuro, la ruta en zafiro, las pastillas de estado—: el mapa
es el fondo, la app es lo que flota sobre él.

**Respaldo automático.** Si el servidor principal deja de responder, tras cinco
fallos seguidos el mapa cambia solo a Esri World Street Map. ⚠️ Pero **eso NO
cubre el caso que nos pasó**: el bloqueo de OSM llegó como HTTP **200** con una
IMAGEN que dice "Access blocked", y para Leaflet eso es una tesela válida, así
que `tileerror` nunca dispara. El respaldo cubre caídas y 404 reales; un bloqueo
servido como imagen hay que verlo con el ojo.

**Riesgo conocido, para que no sorprenda:** el servidor alemán también es
comunitario y tiene su propia política de uso. Podría bloquear en el futuro,
igual que el oficial. Por eso la URL vive en UN solo lugar (`constants/mapa.ts`)
y cambiar de proveedor es una línea.

**Trampa documentada:** los dos proveedores ordenan las coordenadas distinto —
OSM usa `{z}/{x}/{y}` y Esri `{z}/{y}/{x}`. Confundirlos NO da error: el mapa
carga teselas de otro lugar del mundo. La línea de la ruta pasó a **funda blanca
+ trazo de zafiro**, el recurso de todos los navegadores, porque sobre mapa
claro el contorno negro se veía sucio.

**Dos bugs propios que salieron en el camino:**
1. Los colores de las cápsulas y de la ruta estaban escritos como
   `${'${COLORES_MAPA.ambar}'}` dentro de un template literal. Un template
   literal **interpola una sola vez**: insertaba el texto literal como color,
   que es inválido. Por eso el punto del marcador salía sin color y la ruta con
   el azul por defecto de Leaflet.
2. `CSS_MAPA_OSCURO` se renombró a `CSS_MAPA`: el nombre ya era mentira.

⚠️ **Para el informe:** declara "Leaflet/OpenStreetMap". Las dos cosas siguen
siendo ciertas — Leaflet es la librería y los datos son de OpenStreetMap. Lo que
cambió es el SERVIDOR de teselas (del oficial al de OSM Alemania), por un motivo
técnico verificable: el oficial bloqueó a la aplicación. Vale la pena anotarlo
como incidencia real del despliegue.

### 3-quatervicies. La ficha de quién lleva al niño (2026-09-10)

En el inicio del padre, la tarjeta del conductor mostraba nombre y unidad y
tenía dos botones. Ahora **la tarjeta entera se toca** y abre una ficha con todo
lo que un padre quiere saber de quién lleva a su hijo.

**Las dos fotos, juntas y del mismo tamaño.** La del conductor y la de la
UNIDAD, una al lado de la otra. No es simetría decorativa: el padre no espera al
conductor, espera al BUS. Poder mirar la foto de la unidad desde la vereda —y
compararla con la que se está acercando— es lo que convierte el dato en algo
útil. Las formas son distintas a propósito: el conductor va en círculo, como
toda persona en la app, y la unidad en rectángulo de esquinas suaves, porque es
un objeto. Sin esa diferencia se leen como dos retratos.

**Los datos, y cuáles se pueden usar.** Teléfono, ruta y capacidad de la unidad.
El teléfono **se toca y llama** (`Linking`), y se distingue de los demás por el
color y la flecha: es lo que separa un dato que se USA de uno que solo se lee.
Un número que hay que copiar a mano, con el bus llegando, no sirve.

**Detalles de construcción:**
- La foto de la unidad ya existía en el modelo (`Bus.foto`, base64 que sube el
  admin) y las reglas de Firestore ya permiten a cualquier autenticado leer
  `buses` — no hizo falta tocar reglas ni modelo. Solo faltaba mostrarla.
- Si la unidad no tiene foto cargada, va un recuadro con el ícono del bus y
  "Sin foto": se degrada, no deja un hueco.
- La ficha del hijo (`FichaHijo`) ganó `rutaNombre`, que sale del mismo `base`
  donde ya estaba `busId`.
- Se agregó la pista **"TOCÁ PARA VER SUS DATOS"** debajo del nombre. Sin ella
  nadie descubre que la tarjeta se toca: los dos botones de la derecha hacen
  creer que eso es todo lo que hay.
- Los dos botones rápidos (llamar y escribir) **se conservan**: quien solo
  quiere llamar no tiene por qué pasar por la ficha. Los toques anidados
  funcionan solos — en React Native el táctil más interno gana.

Verificado: `tsc` limpio, `eslint` 0 errores, `expo export` OK.

### 3-tervicies. Foto del bus en el mapa, sugerencias del panel y bandeja escalable (2026-09-08)

**La foto de la unidad, en el mapa de supervisión.** El marcador del bus mostraba
un emoji igual para todos. Con ocho buses moviéndose a la vez en el mismo mapa,
ocho emojis idénticos obligaban a pasar el mouse por cada uno para saber cuál
era cuál. Ahora el marcador muestra la FOTO REAL de la unidad (la que el admin
sube al darla de alta) con la PLACA en una cápsula debajo — que es como se
nombran las unidades por radio. Si la unidad no tiene foto cargada queda la
burbuja azul de antes: se degrada, no se rompe. La placa va con posición
absoluta para no empujar al marcador y que siga centrado en su coordenada real.

**SUGERENCIAS DEL PANEL (`components/Sugerencias.tsx`, nuevo).** El sistema tiene
seis entidades que se relacionan entre sí y muchas combinaciones quedan a medio
armar **sin que nada falle**: una escuela sin canal, un conductor sin unidad, un
niño sin ruta. No hay error ni pantalla roja — simplemente esa parte no funciona
para alguien, y el admin se entera cuando llaman a quejarse. El panel lo hace
visible antes.

Tres reglas para que no se vuelva ruido, y están escritas en el componente:
1. **Sin nada que sugerir, el panel no se dibuja.** Un cartel de "todo en orden"
   ocupa lugar todos los días para no informar nada, y entrena al ojo a
   saltearlo — justo lo que no queremos el día que sí diga algo.
2. **Cada sugerencia trae su acción.** "Faltan canales" obliga a averiguar dónde
   se crean; "Faltan canales [Crear el de Mazapán]" no. El botón abre el
   formulario **con la escuela ya elegida y el nombre propuesto**.
3. **Se nombra lo concreto.** "3 escuelas sin canal: Mazapán, San Isidro y El
   Naranjal" se resuelve; "hay escuelas sin canal" hay que investigarlo.

Dónde está conectado hasta ahora:
- **Canales**: escuelas CON ALUMNOS que no tienen canal (una escuela cargada
  pero todavía sin niños no necesita uno, y sugerirlo sería ruido), y canales
  cuya escuela se quedó sin alumnos activos — no le llegan a nadie, porque la
  membresía se deriva de los hijos de cada padre.
- **Buses**: conductores sin unidad asignada (en su app ven "no tenés un bus
  asignado" y no pueden trabajar) y unidades activas cuyo conductor se dio de
  baja. Es el mismo agujero que la insignia "No le llega al conductor" de la
  pantalla de Rutas, visto desde el otro lado de la cadena.

Los ayudantes de texto (`enumerar`, `plural`) viven en `utils/texto.ts` y no en
el componente: un archivo que exporta un componente Y funciones sueltas rompe la
recarga en caliente de Vite (regla `react-refresh/only-export-components`).

**LA BANDEJA DEL ADMIN, PREPARADA PARA CIENTOS DE CONTACTOS.** Es la pantalla
con más elementos por lejos: la administración habla con TODOS los padres y
TODOS los conductores.

- **Rendimiento**: pasó de `ScrollView` a **`FlatList`**. El ScrollView monta
  TODO de una vez — con trescientas tarjetas el teléfono las arma todas antes de
  mostrar la primera, y en los equipos de gama baja de la empresa eso son
  segundos de pantalla congelada. FlatList monta solo lo visible y recicla las
  filas: abre igual de rápido con 20 contactos que con 500. Se afinó con
  `initialNumToRender={12}` (lo que llena una pantalla), `windowSize={7}` (para
  que el scroll rápido no muestre huecos) y `removeClippedSubviews` (para que la
  memoria no crezca sin parar).
- **Organización**, que es la otra mitad del problema —una lista de trescientos
  nombres es inservible aunque se desplace fluida—: lo que tiene mensajes SIN
  LEER va primero siempre (alguien esperando respuesta no puede quedar sepultado
  bajo conversaciones viejas), después las conversaciones por fecha, y al final
  el resto en orden alfabético.
- **Buscador y filtros por rol** (Todos / Padres / Conductores), con el conteo
  de cada uno. El buscador ahora filtra TODO —antes solo el final de la lista— y
  también por teléfono. Van FUERA de la lista y no como encabezado de la
  FlatList: como encabezado se irían con el scroll, y en una lista de cientos de
  nombres el buscador tiene que estar siempre a la vista.
- Todo el filtrado y ordenado vive en un `useMemo`: en el render se
  recalcularía en cada tecla sobre cientos de contactos.

Verificado: `tsc` limpio y `eslint` 0 errores en las dos mitades; `npm run build`
de la web y `expo export` del móvil, OK.

### 3-duovicies. El admin quedaba encerrado en Mensajes y Avisos (2026-09-08)

Derek reportó que al entrar a Mensajes desde el panel del admin no podía volver
y desaparecía el menú de abajo. Era un bug de navegación, con una cadena de dos
pasos:

`app/(admin)/mensajes.tsx` y `app/(admin)/avisos.tsx` le pasaban
`alVolver={() => router.back()}` a `PantallaBase`. Eso hace dos cosas a la vez:

1. `PantallaBase` las trata como pantallas APILADAS, y por eso **esconde la
   barra flotante de abajo** — que en una sección es la única forma de salir.
2. La flecha llama a `router.back()`, pero a las secciones se llega con
   `router.replace()` desde la barra (ver `BarraBurbuja`), y **replace no apila
   historial**: no hay a dónde volver, así que la flecha no hace nada.

Resultado: el admin quedaba encerrado. Se auditaron las diez pantallas de
sección de los tres roles y **eran las únicas dos** con `alVolver`; las del
padre y el conductor estaban bien. Se les quitó, y se dejó una advertencia
explícita en la cabecera de `PantallaBase` para que no vuelva a pasar: las
secciones de cada rol están listadas en `constants/navegacion.ts` y ninguna
lleva `alVolver`.

De paso se verificó el resto del panel del admin: `monitoreo` ya tiene botones
de llamar y escribir por ruta, `conversacion` sí lleva `alVolver` (y está bien,
porque se llega con `router.push`), y `configuracion` usa el componente
compartido. El panel queda completo.

Verificado: `tsc` limpio, `eslint` 0 errores, `expo export` OK.

### 3-unvicies. Mapa del conductor, orden del recorrido y novedades del viaje (2026-09-08)

**El mapa del conductor no funcionaba, y la causa era mía.** El CSS compartido
deja `#mapa` en `opacity: 0` y solo se ve cuando algo le agrega la clase
"listo" — pero ese código vivía únicamente dentro del mapa del PADRE. El del
conductor y el selector de ubicación quedaban invisibles para siempre, sin dar
ningún error: el WebView cargaba bien, simplemente no se veía nada. Se extrajo a
`JS_ENTRADA_MAPA` en `constants/mapa.ts` y ahora los tres lo incluyen.

**El orden del recorrido, encima del mapa.** Los números en el mapa dicen el
orden, pero para saber QUÉ es cada número había que tocarlos uno por uno. Ahora
hay un panel de vidrio superpuesto con la lista de corrido: número, lugar,
quiénes suben o bajan ahí y el punto de referencia. **Se pliega con un toque en
su cabecera** — a veces lo que hace falta es justo lo contrario, ver el mapa
entero. Plegado deja la barra del título a la vista: un panel que se esconde
entero es un panel que el conductor no vuelve a encontrar. Arranca ABIERTO,
porque lo primero que se quiere al abrir el mapa es el orden.

**La unidad, visible de verdad.** Estaba perdida en un texto corrido ("Turno
mañana · Bus HAB-1234 · 12 niños") y no se encontraba. Ahora tiene su propio
renglón, con ícono y la placa en la fuente de cifras: es el dato que el
conductor tiene que poder leerle a la administración por teléfono sin buscar.

**NOVEDADES DEL VIAJE (funcionalidad nueva).** El conductor puede avisar desde
la calle lo que no es una marca de asistencia: se pinchó una rueda, hay un
tranque, se largó a llover, va con retraso.

- **Modelo**: colección `incidencias` (en las dos copias de `models.ts`). Guarda
  COPIADOS el nombre de la ruta, la placa y el nombre del conductor: el admin
  lee un solo documento, y si mañana esa unidad se da de baja el registro
  histórico sigue diciendo lo que pasó ESE día. Del lado de los niños solo
  guarda la CANTIDAD que iba a bordo, no la lista de ids — le da al admin la
  dimensión del problema sin poner datos de niños donde no hacen falta.
- **Por qué no es un mensaje de chat**: un chat es entre dos; esto es un
  anuncio de uno a muchos que además tiene que quedar REGISTRADO. Si un padre
  pregunta por qué el bus llegó cuarenta minutos tarde, la respuesta tiene que
  estar guardada con su hora, su ruta y su unidad.
- **Dos mensajes distintos para dos públicos**: al PADRE le llega qué pasó y qué
  significa para el viaje, sin placa ni nombre de ruta, que no le dicen nada. Al
  ADMIN le llega quién, en qué unidad y en qué ruta — lo que necesita para
  levantar el teléfono.
- **Solo se avisa a los padres de los niños que van ARRIBA del bus.** Al que
  todavía no recogieron, un aviso de "el bus tuvo un problema" lo asusta sin
  motivo. Los de a bordo se calculan al ENVIAR, no al abrir el diálogo: entre
  una cosa y la otra el conductor puede haber marcado a alguien más.
- **El registro nunca depende del aviso**: primero se guarda en Firestore y
  después se notifica; si no hay señal, la novedad igual queda. Al revés sería
  peor. Y se le dice al conductor A CUÁNTOS padres se avisó, no solo "listo":
  con cero avisados tiene que saberlo para poder llamar.
- **Reglas de Firestore**: lee solo el ADMIN (el padre se entera por la
  notificación; darle lectura le mostraría novedades de rutas ajenas). El
  conductor crea, y **solo a su propio nombre** — sin esa condición podría
  reportar una avería a nombre de otro. Nadie edita ni borra salvo el admin: el
  valor de un registro está en que no se pueda cambiar después.
- **Panel del admin**: las novedades de hoy aparecen ARRIBA de las rutas y en
  vivo. Si un bus se quedó con una rueda pinchada, es lo primero que Francis
  tiene que ver — antes que cualquier contador. La sección solo existe si hay
  algo que mostrar.

⚠️ **Falta desplegar las reglas** (`firebase deploy --only firestore:rules`)
para que la colección `incidencias` funcione. Hasta entonces, reportar una
novedad va a fallar por permisos.

Verificado: `tsc` limpio, `eslint` 0 errores, `expo export` OK.

### 3-quinvicies. Seguridad endurecida, suplencias, GPS en segundo plano y recorridos (2026-09-11) — compila limpio, reglas probadas en el emulador, NO desplegado

Pedido de Derek después de una revisión de seguridad del sistema: **(1)** cerrar
todas las brechas encontradas; **(3)** GPS en segundo plano, asistencia sin señal,
hora de salida por ruta (solo informativa), conductor suplente y bajar lecturas
del plan gratuito; **(4)** recorrido guardado por viaje y el proveedor de mapas
del panel. La parte 2 (seguridad del niño) y el resto de la 4 quedaron afuera a
pedido de Derek.

> ⚠️ **ANTES DE PUBLICAR: el orden importa y está en `docs/despliegue.md`
> (primera sección).** Las reglas nuevas y la app vieja NO son compatibles: con
> las reglas nuevas, un teléfono con el APK viejo no ve a sus niños ni puede
> marcar asistencia. Y el panel nuevo con las reglas viejas no puede guardar
> nada sensible. Orden: APK nuevo en todos los teléfonos → `firebase deploy
> --only firestore:rules,hosting` sin viajes en curso → abrir el panel (recalcula
> los accesos) → prueba de humo.

**A) Reglas reescritas (`firestore.rules`) + 76 pruebas automáticas (`pruebas-reglas/`)**

| Brecha | Cómo se cerró |
| --- | --- |
| Una cuenta dada de baja seguía con acceso | Toda regla exige cuenta activa (`cuentaActiva()`: `activo` ausente cuenta como true). La app y el panel además cierran la sesión y dicen por qué |
| Cada usuario reescribía su perfil (se podía reactivar, cambiar correo, renombrarse "Administración") | De su doc solo cambia `telefono`, `foto`, `debeCompletarPerfil`, `expoPushToken`. El nombre ya no se edita en la app (completar-perfil lo muestra fijo) |
| Cualquier sesión leía todos los usuarios (teléfonos, tokens) | Padre: solo conductores y admin. Conductor: solo padres y admin. Cada uno siempre lee su propio doc |
| El destinatario podía editar el texto de un mensaje | Solo puede poner `leido: true`. Además se valida remitente, `conversacionId`, texto (1–4000) y que un padre no le escriba a otro padre |
| La hora de las evidencias salía del teléfono | `horaServidor` en registros, mensajes e incidencias, y `horaInicioServidor`/`horaFinServidor` en viajes, iguales a `request.time`. La hora del teléfono se conserva (sin señal es la del momento real) |
| Todo conductor leía casa y foto de todos los niños | Solo los niños con su uid en `conductorIds` (ver B). Solicitudes: solo avisos operativos aprobados de ayer/hoy/mañana (hora de Honduras, UTC-6) |
| Todo padre veía todos los buses en vivo | `ubicaciones` lleva `padreIds`; el padre solo lee si está en la lista (un doc que todavía no existe sí se puede esperar) |
| Cambios del admin sin rastro | Cambio sensible ⇒ doc NUEVO en `auditoria` en el mismo lote (`existsAfter`), inmutable incluso para el admin. Pantalla **Auditoría** |
| Sin respaldos (Spark no tiene) | **Herramientas → Respaldo**: descarga JSON de las colecciones, contando antes las lecturas |
| Hosting sin cabeceras, sesión web eterna | CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy y HSTS en `firebase.json` (descargar.html pasó su script a `descargar.js`); cierre por inactividad a los 60 min (`hooks/use-cierre-por-inactividad.ts`) |
| `react-router` con vulnerabilidad alta | `npm audit fix` → 7.18.3, 0 vulnerabilidades en la web |
| Bug: se intentaba borrar el token de otro usuario | Eliminado; los tokens muertos se recuerdan en memoria (`tokensMuertos`) |
| (extra) | viajes: crear exige manejar esa unidad HOY (titular o suplente); el conductor solo cambia estado/fin/demora |

Qué quedó sin cerrar, a propósito: **App Check** (en el móvil exige migrar a
`@react-native-firebase`, un cambio de stack que hay que decidir); un conductor
puede leer los tokens de los padres y un padre los de conductores y admin (sin
servidor propio no hay forma de ocultarlos a quien envía el push); `registros`
los crea cualquier conductor activo (desviación documentada en las reglas); y en
el móvil quedan 17 vulnerabilidades moderadas/altas en herramientas de
compilación de Expo (`xmldom`, `js-yaml`, `brace-expansion`), que no viajan en el
APK y se resuelven con actualizaciones de Expo.

Pruebas: `cd pruebas-reglas && npm install && npm test` (emulador local,
proyecto `demo-`, nunca toca producción; Java 11+, sirve el `jbr` de Android
Studio). Resultado: **76/76**. La CSP se probó sirviendo `dist` con las mismas
cabeceras y abriéndolo en Chrome sin interfaz por el protocolo de DevTools (el
emulador de hosting de Firebase falla leyendo desde OneDrive): el login se dibuja
completo con 0 violaciones y 0 errores; Firestore, Auth, OSRM, Expo, las teselas
de OSM Alemania y Esri y las fotos `data:` están permitidos; y los dos controles
negativos (un sitio cualquiera y el servidor oficial de OSM) quedan bloqueados.

**B) Qué niños ve cada conductor (`nino.conductorIds`)** — dato DERIVADO que
calcula el panel (`services/accesoConductoresService.ts`): ruta activa → unidad
activa → titular + suplentes de hoy en adelante → niños de la ruta. Se recalcula
al guardar rutas/unidades/conductores/suplencias, una vez por día al abrir el
panel y a mano en **Herramientas → Migración → Recalcular accesos ahora**. Si la
app del conductor no puede leer a algún niño de su ruta, lo **avisa** en rojo
(nunca muestra una lista incompleta en silencio).

**C) Suplencias** (panel: **Operación → Suplencias**; `suplencias/{busId}_{fecha}`).
Ese día el suplente ve las rutas de la unidad y es el único que puede iniciar sus
viajes (lo verifican las reglas); el titular ve "Hoy te cubre…"; el padre ve al
suplente con su teléfono; el monitoreo del admin muestra "· suplente". La
asignación permanente (`Bus.conductorId`) no se toca: al día siguiente todo
vuelve solo. Se cancelan, no se borran. Si el titular ya había iniciado el viaje,
el suplente lo ve pero no lo puede operar (y viceversa). Límite: el suplente
conserva la lectura de esos niños hasta el primer recálculo del día siguiente.

**D) GPS en segundo plano** (`services/gpsViaje.ts`, `hooks/use-emision-ubicacion.ts`).
Tarea de fondo con **`expo-task-manager`** (dependencia nueva, oficial de Expo)
y servicio en primer plano de Android (notificación fija "Viaje en curso"), que
no exige el permiso "Permitir siempre". El GPS ya no se apaga al cambiar de
pantalla: se apaga al finalizar el viaje. Si la tarea no arranca (Expo Go), cae
al modo con la app abierta y la pastilla lo dice. `app.json`: 
`isAndroidForegroundServiceEnabled` e `isIosBackgroundLocationEnabled`.
**Necesita APK nuevo.**

**E) Asistencia sin señal** (`services/colaRegistros.ts`). Cada marca se guarda
primero en el teléfono y después va a Firestore con un id generado antes: si la
app se cierra sin señal, se reintenta al abrir; si ya había llegado, las reglas
rechazan pisarla y sale de la cola (no se duplica). La pantalla ya no se traba
esperando al servidor. Iniciar y finalizar un viaje siguen necesitando señal.

**F) Hora de salida** (`Ruta.horaSalida`, "HH:mm"): se carga en el armador, se ve
en la lista de rutas, en la app del conductor ("SALIDA 6:15 a. m.") y en el
monitoreo del admin. **Solo informativa**: no restringe nada.

**G) Lecturas del plan gratuito.** El conductor ya no descarga todos los niños
activos (consulta `array-contains` por su uid); los contactos del padre y del
conductor se leen perfil por perfil (antes, colecciones enteras de usuarios y
buses); las novedades leen solo a los niños de a bordo. Para medir con datos
reales: consola de Firebase → Firestore → pestaña **Uso**. Escrituras del GPS:
~240/h (ubicación) + ~60/h (recorrido) por bus en viaje.

**H) Recorridos y mapas del panel.** `recorridos/{viajeId}`: un punto por minuto
(las reglas solo dejan agregar, nunca reescribir). Se ve en **Supervisión →
detalle del viaje → Recorrido realizado**. Los mapas del panel usan el mismo
proveedor que el móvil (OSM Alemania + Esri de respaldo automático,
`utils/mapa.ts` + `components/CapaTeselas.tsx`): antes pedían al servidor que
bloqueó a la app.

**Modelo** (las dos copias idénticas): `Usuario/Bus/Ruta/Nino.auditoriaId`,
`Nino.conductorIds`, `Ruta.horaSalida`, `Viaje.horaInicioServidor/horaFinServidor`,
`Registro.horaServidor/ninoNombre/ninoEscuelaId`, `UbicacionActual.padreIds`,
`Mensaje.horaServidor`, `Incidencia.horaServidor`, y las colecciones nuevas
`suplencias`, `auditoria`, `recorridos` (+ `sistema` para la marca del recálculo).

Dependencias del móvil: además de `expo-task-manager`, se alinearon con
`npx expo install --fix` 17 paquetes del SDK 57 a sus últimos parches (Expo los
publicó después de la migración; sin eso `expo-doctor` fallaba). No cambia
código, pero es otro motivo para compilar el APK nuevo.

Verificado: web `tsc` limpio, `eslint` limpio y `npm run build` OK; móvil `tsc`
limpio, `eslint` 0 errores (76 avisos, los mismos de antes), `expo-doctor`
**21/21** y `expo export --platform android` OK; reglas **76/76**; `models.ts`
idénticos. **Falta probar en el teléfono** (ver la lista de humo de
`docs/despliegue.md` §5).

### 3-sexvicies. La ficha de "quién lleva a mi hijo", rediseñada (2026-09-11) — compila limpio, NO probada en dispositivo

Pedido de Derek: mejorar el diseño de lo que se abre al tocar la tarjeta del
conductor en el inicio del padre. Antes era el `Dialog` genérico de Paper,
centrado y fuera del lenguaje de vidrio de la app, con llamar escondido como un
renglón más y la placa en texto chico. Ahora es **`components/FichaConductor.tsx`**
(sale de `hijos.tsx`, que baja ~170 líneas):

- **Hoja flotante que sube desde abajo**, en `Vidrio` superpuesto: el pulgar
  llega con una mano y es el patrón que el padre ya conoce.
- **Primero la unidad, grande**: la foto del bus con la **placa encima** en la
  fuente de cifras. El padre espera un bus, no una persona. Sin foto, un panel con
  el ícono y la placa sigue siendo lo más visible.
- **Después la persona**: su foto montada sobre el borde de la del bus, con
  "LLEVA A ANA HOY", el nombre grande y el teléfono visible.
- **Dos datos en casillas** (ruta y capacidad) y una línea que dice para qué
  sirve todo: "Compará la foto y la placa con el bus que llega".
- **Acciones grandes**: **Llamar** es la principal (espejo de zafiro), Escribir la
  secundaria (vidrio). Sin teléfono cargado, Escribir pasa a ser la principal.
- **Se cierra de cuatro formas**: la X (área táctil de 56 px), tocar afuera,
  deslizar hacia abajo y el botón atrás. Respeta "reducir movimiento".
- Radios concéntricos (lámina 24 − relleno 12 = foto 12), ancho tope de 520 px
  para tablets, etiquetas para lector de pantalla. `BotonPrincipal` ganó la prop
  opcional `accesibilidad` ("Llamar a Carlos al 9999-9999").
- La animación usa `useAnimatedValue` (no `useRef(new Animated.Value())`), así
  no suma avisos del compilador de React.

Verificado: `tsc` limpio, `eslint` 0 errores y sin avisos nuevos (76), `expo
export --platform android` OK. **Falta verla en el teléfono**, sobre todo el
arrastre para cerrar y cómo se ve una foto de bus real.

### 3-septvicies. Ningún mapa se acomoda a mano (2026-09-11) — compila limpio, NO probado en dispositivo

Pedido de Derek: la misma ficha del conductor para el admin en la app, y que
**todos** los mapas —los cuatro del móvil y los cuatro del panel— tengan un
botón de centrar, más uno de "siguiente parada" para el conductor. El problema
real era que los mapas se encuadraban **una sola vez** y después quedaban
quietos: el bus se iba de la pantalla y había que arrastrar con el dedo para
encontrarlo, parado en la vereda o manejando.

**1. El mapa del padre SIGUE al bus** (`components/MapaBusEnVivo.tsx`). Con cada
posición (~15 s) vuelve a encuadrar bus + parada, que es la pregunta real
("¿cuánto le falta para llegar?"). En cuanto el padre mueve el mapa con el dedo,
deja de seguirlo —un mapa que se reacomoda solo mientras alguien lo mira es peor
que uno quieto— y el botón **Centrar** se enciende en zafiro para volver. El HTML
avisa por `postMessage` cuándo dejó de seguir; React Native solo pinta el botón.
Se distingue el dedo del código mirando `dragstart` (que solo lo dispara el dedo)
y los toques de dos dedos, porque el zoom no dice quién lo pidió.

**2. El mapa del conductor** (`app/(conductor)/recorrido.tsx`): se ve a sí mismo
como el **punto azul** de cualquier app de mapas (`watchPositionAsync` mientras
la pantalla está abierta; NO pide el permiso, lo reusa del que ya dio al iniciar
viajes). **"Siguiente · 3. Casa de los López"** encuadra esa parada junto con él
y desde ahí lo sigue; **"Ver toda la ruta"** vuelve a la vista completa; y tocar
una parada de la lista lleva el mapa hasta ella. La parada que toca ahora late en
el mapa y va en zafiro lleno en la lista, con "LE TOCA AHORA".

Cuál es la siguiente se calcula en `hoy.tsx`, que es donde se sabe el estado de
cada niño (primera parada con algo pendiente, según si ahí se sube o se baja
—depende del turno—; los que hoy no viajan y los "no estaba" no cuentan), y viaja
al mapa como un número.

**3. Los encuadres esquivan lo que tapa la pantalla.** El panel del orden ocupa
hasta media pantalla, así que "centrar" dejaría la parada centrada pero escondida
detrás. React Native mide el panel (`onLayout`) y manda ese margen con cada
mensaje; el mapa encuadra contra la parte que de verdad se ve.

**4. La ficha del conductor, ahora también para el admin**
(`app/(admin)/monitoreo.tsx`). Tocar el nombre en la fila de una ruta abre la
MISMA hoja que ve el padre (`components/FichaConductor.tsx`), con una prop nueva
`vista: 'padre' | 'admin'` que cambia solo los textos: rótulo "SUPLENTE DE HOY" o
"CONDUCTOR DE LA RUTA", y el renglón del final pasa de "compará la foto con el
bus que llega" a "Hoy cubre a Fulano". Antes ese toque iba directo al chat; ahora
el chat y la llamada están adentro de la ficha, junto con la foto y la placa de
la unidad. `EstadoRuta` ganó `busId` para poder abrir la unidad sin buscarla.

**5. Los cuatro mapas del panel** comparten `components/BotonCentrarMapa.tsx`
(el que ya tenía el armador de rutas, extraído): supervisión encuadra buses y
ruta, el recorrido de un viaje lo encuadra completo, y el selector de ubicación
vuelve al lugar marcado. Va **fuera** del contenedor de Leaflet: adentro, cada
clic sería además un clic en el mapa y en el selector movería el marcador.

**6. Control compartido en el móvil**: `components/BotonMapa.tsx` (redondo con
solo ícono, o cápsula con texto; vidrio oscuro o zafiro encendido). Es opaco y no
`Vidrio` porque detrás hay un WebView, que Android no le presta a la capa de
desenfoque.

**Error viejo arreglado de paso:** en el mapa del padre, la línea azul del bus a
la casa se calculaba una vez y nunca más. El código tocaba una segunda línea
("la funda blanca") que ya no existía; el `TypeError` caía dentro de un `.then`,
así que se perdía en silencio y el camino quedaba congelado en el primero
mientras el bus seguía avanzando.

Verificado: `tsc` limpio en móvil y web, `eslint` **0 errores** (72 avisos en
móvil, cuatro menos que antes; ninguno nuevo), web sin avisos, `npm run build` y
`expo export --platform android` OK. **Falta probarlo en el teléfono**: sobre
todo que el punto azul del conductor aparezca (depende del permiso ya concedido)
y que el seguimiento del mapa del padre no se sienta invasivo con el bus en
movimiento.

### 3-octovicies. Las cinco pantallas de comunicación, rehechas (2026-09-11) — compila limpio, NO probado en dispositivo

Pedido de Derek: mejorar el diseño de **Mensajes** en los tres roles y de
**Avisos** en los tres. Al abrirlas aparecieron tres problemas de fondo, y el
rediseño sale de ahí:

1. **La bandeja del padre y la del conductor eran el MISMO archivo copiado**
   (misma interfaz, mismos estilos, mismos textos), y la del admin —la única con
   orden de verdad, buscador y lista virtualizada— tenía toda esa lógica metida
   adentro del render. Tres lugares para arreglar la misma cosa.
2. **Un mensaje sin leer se veía igual que uno contestado hace un mes.** El
   único indicio era un globito chico… en ROJO, que en este sistema de diseño
   significa "algo falló" (ver `PastillaEstado`): la bandeja del admin parecía
   una pantalla de errores.
3. **El conductor no tenía Avisos.** Un comunicado como "mañana no hay clases"
   le cambia el día de trabajo tanto como al padre, y se enteraba por un mensaje
   suelto, o no se enteraba.

**Lo que ahora es UNA sola pieza para los tres roles:**

- **`utils/bandeja.ts`** — el orden de la bandeja como función PURA (entran
  contactos y resúmenes, sale lo que se dibuja). El orden no es alfabético ni
  por fecha, es por URGENCIA: **Sin leer** primero (alguien espera respuesta),
  después **Conversaciones** de la más reciente a la más vieja, y al final
  **Escribirle a alguien** en orden alfabético, con la administración primera.
- **`components/FilaConversacion.tsx`** — la fila. Sin leer: nombre en negrita,
  el último mensaje deja de estar atenuado (es lo que hay que leer) y un punto
  de zafiro sobre la foto. El contador pasó de rojo a **zafiro**, que es lo que
  la app usa para "está pasando ahora".
- **`components/ListaBandeja.tsx`** — la lista virtualizada (FlatList) con su
  encabezado fijo. Antes solo el admin la tenía; ahora también el conductor, que
  puede tener un padre por cada niño de su bus.
- **`components/EstadoVacio.tsx`** — el vacío explica en vez de ser un renglón
  gris: ícono, qué pasa y **qué tiene que ocurrir** para que deje de estar vacío.
- **`components/ListaAvisos.tsx`** — los avisos **agrupados por fecha** (Hoy ·
  Ayer · Esta semana · Antes) con un contador de lo nuevo en ámbar. Sin los
  grupos había que leer la fecha de cada tarjeta para saber si algo era de hoy,
  que es la única pregunta de esa pantalla. (`grupoDeFecha()` en `utils/tiempo.ts`
  compara por día de calendario, no por horas: un aviso de las 11 de la noche de
  ayer es "Ayer" aunque hayan pasado nueve horas.)

**Por pantalla:** el **padre** no tiene buscador (habla con dos o tres personas:
agregarle controles es justo lo que no hay que hacerle, CLAUDE.md §1-bis); el
**conductor** lo tiene a partir de 8 contactos, porque su caso real es
escribirle a UN padre concreto porque el niño no estaba en la parada; el
**admin** conserva además sus filtros por rol. Los tres usan ahora el `Campo` de
la app y no el `TextInput` crudo de Paper.

**Avisos del admin** ganó la **vista previa**: mientras escribe ve la tarjeta
EXACTA que le va a aparecer al padre, armada con el mismo componente. Un aviso
se publica una vez y le llega al teléfono a decenas de familias. Además dice a
quién le llega con el nombre de la escuela, y avisa cuando el texto es tan largo
que la notificación lo va a recortar.

**Avisos del conductor es una pantalla NUEVA** (`app/(conductor)/avisos.tsx`):
su barra pasó de 3 a 4 destinos. Lee solo los canales de las escuelas de las
rutas de las unidades que maneja HOY (incluida la que cubra por una suplencia),
encadenando servicios que ya existían: unidades → rutas (en vivo) → escuelas →
canales → avisos. **No necesita ningún cambio en las reglas de Firestore**
—`canales` y `avisos` ya los lee cualquier cuenta activa—, lo cual importa
porque las reglas v2 siguen sin publicarse. Convive con `(admin)/avisos.tsx` en
la ruta `/avisos` igual que ya conviven los tres `mensajes.tsx` y los tres
`configuracion.tsx`.

Verificado: `tsc` limpio y `eslint` **0 errores con 71 avisos — uno MENOS que
antes** (72), porque al sacar los `setState` del cuerpo de los efectos
desapareció también un aviso que ya venía de antes en la pantalla del padre.
**Falta probarlo en el teléfono**: sobre todo la bandeja del conductor con
muchos padres y que el aviso nuevo del conductor aparezca en su barra.

### 3-novemvicies. La hoja de "avisar una novedad" (2026-09-12) — compila limpio, NO probada en dispositivo

Pedido de Derek: mejorar el pop up con el que el conductor avisa una novedad
(rueda pinchada, tranque, lluvia), con el mismo lenguaje que la ficha del
conductor. Era el `Dialog` genérico de Paper: un cuadro centrado, cinco
renglones de 48 px casi idénticos entre sí y los botones de texto de Paper.

**Primero, lo que se hizo para NO duplicar:** el marco de la hoja —velo de
fondo, entrada animada, asa y gesto de arrastrar para cerrar— estaba escrito
dentro de `FichaConductor.tsx`. Al aparecer la segunda hoja se extrajo a
**`components/HojaInferior.tsx`** y las dos lo usan. Duplicar la mecánica de un
gesto es el mismo error que tenían las bandejas de mensajes (§3-octovicies).

> ⚠️ Eso implica que **se tocó `FichaConductor.tsx`, que ya estaba aprobado**.
> El contenido no cambió; sí cambia un detalle: antes la ficha se podía
> arrastrar agarrándola de la foto del bus, y ahora solo del asa de arriba (es
> lo que evita que un arrastre compita con una lista o con un campo de texto).
> Si molesta, se revierte volviendo a la versión anterior del archivo.

**La hoja nueva (`components/HojaNovedad.tsx`):**

- **Sube desde abajo**, porque el conductor está manejando y el pulgar llega
  ahí sin cambiar la mano de posición.
- **Cinco opciones de 64 px** con su ícono en un cuadro de color: se tocan sin
  apuntar. La elegida se pinta en **ámbar** con el borde encendido —el color de
  "pide atención" en toda la app—, no con un tilde chiquito.
- **Se muestra LO QUE VAN A LEER LOS PADRES.** Es lo más importante que se
  agregó: el conductor elige "Problema con la unidad" y ve, textual, el mensaje
  que les va a llegar ("Los niños están bien; la ruta va a demorarse"). Sin eso
  está mandando a ciegas un aviso a decenas de familias, y el miedo a asustar a
  alguien es justamente la razón por la que un conductor no reporta nada. Solo
  aparece si hay niños a bordo: si no le llega a ningún padre, mostrar "lo que
  van a leer" sería mentir sobre lo que hace el botón.
- **Se arregló un texto que quedaba mal:** con el bus vacío decía "se les avisa
  a los padres de los 0 niños que van a bordo". Ahora dice la verdad — "ahora no
  hay niños a bordo: le llega solo a la administración".
- **El detalle sigue siendo opcional y al final**: si fuera obligatorio, nadie
  avisaría nada. La hoja se levanta lo que mida el teclado para que el campo no
  quede tapado.

`BotonPrincipal` ganó el tono **`aviso`** (ámbar). Su texto va en marrón oscuro
y no en blanco: sobre ámbar, el blanco no llega al contraste mínimo y se lee
peor justo con el sol en la pantalla, que es cuando se usa.

El estado (qué tipo eligió, qué escribió) y el envío se quedaron en
`app/(conductor)/hoy.tsx`: ahí están los datos del viaje y el cálculo de quiénes
van a bordo **en el momento de enviar**, que no cambió.

Verificado: `tsc` limpio y `eslint` **0 errores con 71 avisos, exactamente los
mismos de antes**. **Falta probarlo en el teléfono**: el arrastre para cerrar y
que el teclado no tape el campo de detalle.

### 3-tricies. Recuperación de contraseña: se cerró la fuga de "quién es cliente" (2026-09-13)

Derek preguntó si cualquiera podía cambiar una contraseña ajena. La respuesta
corta es **no**, pero revisándolo apareció algo peor que sí había que arreglar.

**Lo que ya estaba bien:** `sendPasswordResetEmail` manda un enlace de un solo
uso **al buzón de ese correo y a ninguno otro**. Escribir el correo de otra
persona no cambia nada: solo le manda un correo a ella. Y ese buzón es el que la
administración registró al dar de alta la cuenta, porque no hay registro
público. O sea que el control de acceso es "quién abre ese correo", y eso ya
estaba resuelto.

**Lo que estaba MAL, y es el arreglo de verdad — enumeración de usuarios.**
La pantalla de acceso respondía distinto según el caso: con un correo registrado
decía *"Te enviamos un correo a X"*, y con uno que no existía, *"Verificá que
esté bien escrito"*. Eso convertía el login en un buscador de clientes:
probando direcciones, cualquiera podía averiguar qué familias usan Inversiones
Perez. En un sistema sobre niños, ese dato no puede filtrarse.

Ahora la respuesta es **siempre la misma**: *"Si ese correo está registrado por
Inversiones Perez, te va a llegar un enlace…"*. El caso `auth/user-not-found` se
traga en `services/authService.ts`, en UN solo lugar, para que ninguna pantalla
pueda filtrarlo por descuido. El formato del correo sí se valida (avisar de un
correo mal escrito no delata a nadie).

**Lo demás que se agregó:**

- **Espera de 60 s entre envíos.** Sin eso, cualquiera podía llenarle la bandeja
  de entrada a un padre tocando el enlace muchas veces.
- **Autenticado pero sin perfil.** La clave del proyecto es pública (va dentro
  de la app: es así por diseño en Firebase), así que alguien podría crearse una
  cuenta llamando directo a la API. No puede ver NADA —las reglas exigen un
  perfil con rol— pero antes quedaba en un login que no fallaba ni explicaba
  nada. Ahora se le cierra la sesión y se le dice que su correo no está
  habilitado. Arreglado en las dos apps (`context/AuthContext.tsx`).
- **Ya no se confunde "sin señal" con "no está registrado".** Antes el perfil se
  leía con `.catch(() => null)`: una caída de red se veía igual que una cuenta
  inexistente. Ahora se distinguen, porque una cierra la sesión y la otra no.

**Lo que NO se puede hacer sin cambiar de plan**, y queda documentado como
riesgo aceptado: deshabilitar de verdad una cuenta en Firebase Authentication
(una cuenta dada de baja conserva su contraseña; lo que la frena son las reglas
y el cierre de sesión de la app) y cerrar el alta pública de cuentas sin romper
el panel, que crea usuarios con el SDK cliente. Las dos cosas exigen el Admin
SDK, o sea Cloud Functions y plan Blaze.

**Tres ajustes de consola quedaron documentados** en `docs/despliegue.md` §0-bis:
encender la *protección contra enumeración de correos*, traducir al español las
plantillas de correo (hoy llegan en inglés y firmadas por
`project-XXXX.firebaseapp.com`, que a un padre le parece phishing) y **no**
apagar la creación de cuentas.

**Hueco conocido que queda:** el panel web no tiene "¿olvidaste tu contraseña?",
así que un admin que pierda la suya depende de que otro admin se la reenvíe
desde Usuarios.

Verificado: `tsc` limpio y `eslint` 0 errores con 71 avisos en el móvil (los
mismos de antes). **Falta probarlo en el teléfono**: pedir el correo con una
dirección registrada y con una inventada, y ver que la pantalla diga lo mismo.

### 3-untricies. Logo nuevo (2026-09-17)

Derek reemplazó el set de `Logos/` (IconKitchen). El logo pasó de la ilustración
con el texto "Rutas Escolar / Seguridad" sobre cielo azul a una **buseta blanca
con una franja azul, sin texto**, sobre una tarjeta blanca redondeada. Sin
texto se lee mejor en 48 px, que es el tamaño real del ícono en el teléfono.

Reemplazar la carpeta NO cambia la app: los archivos que usan la app y el panel
son otros. Se regeneraron los 13 con un script de una sola vez (`jimp-compact`,
que ya viene con `@expo/image-utils` — **sin librerías nuevas**), como en agosto.

- ⚠️ **El arte viene sobre NEGRO**: es una tarjeta blanca redondeada con las
  esquinas negras. Copiado tal cual, esas esquinas asoman por fuera de la
  máscara del ícono de Android y quedan como un marco oscuro en iOS. El script
  las quita con un relleno que entra **desde las cuatro esquinas** y avanza solo
  por píxeles oscuros conectados a ellas: así los negros del dibujo (llantas,
  contornos, ventanas) no se tocan, porque están rodeados de blanco. El borde
  queda suavizado (la transparencia sale de cuánta luz tenía el píxel), no
  cortado en seco.
- ⚠️ **La capa monocroma del paquete es la de color.** Android la pinta de UN
  solo color usando la transparencia como molde, así que tal cual habría quedado
  un cuadro macizo sin bus. Se genera acá: cada píxel queda blanco y tan opaco
  como oscuro era, o sea que el fondo blanco de la tarjeta desaparece y quedan
  los contornos — el bus dibujado a línea.
- **El fondo del ícono adaptativo sigue oscuro** (`#0F131D`). Se compararon las
  dos opciones renderizadas: con fondo blanco la tarjeta pierde el borde sobre
  un fondo de pantalla claro; con el oscuro se enmarca y además es el color del
  tema de la app.
- `icon.png` va aplanado sobre blanco (la App Store rechaza el canal alfa);
  `splash-icon.png` y `logo.png` van con las esquinas transparentes, porque se
  dibujan sobre el fondo oscuro de la app.

⚠️ **El APK del 2026-09-17 se compiló ANTES de esto: todavía tiene el logo
viejo.** Para verlo en el teléfono hay que recompilar, y para verlo en el panel
hay que volver a publicar el hosting.

## 4. Modelo de datos (colecciones y tipos clave)

Colecciones: `usuarios, buses, escuelas, puntos, ninos, rutas, viajes, registros, ubicaciones, mensajes, canales, avisos, solicitudes, incidencias`.

```ts
type Turno = "manana" | "tarde";
type TurnoNino = Turno | "ambos";
type TipoLugar = "casa" | "escuela" | "punto"; // 'punto' = punto de transbordo
interface LugarRef { tipo: TipoLugar; id: string } // casa→ninoId, escuela→escuelaId, punto→puntoId
interface NinoEnRuta { ninoId: string; subeEn: LugarRef; bajaEn: LugarRef }
interface Parada { lugar: LugarRef; orden: number }

interface Escuela { id; nombre; lat; lng; activa }
interface Punto   { id; nombre; lat; lng; activo }   // coords sueltas como escuelas

interface Nino {
  id; nombre; grado; padreId; activo;
  escuelaId?; parada?: { nombre; lat; lng }; turno?: TurnoNino;
  // legacy (se limpian al final): centroEducativo, rutaId, paradaId
}
interface Ruta {
  id; nombre; busId; activa;
  turno?; escuelaIds?: string[];
  ninoIds?: string[];      // SE CONSERVA (lo usan móvil hoy.tsx y padre array-contains)
  ninos?: NinoEnRuta[];    // canónico a futuro (lo escribe el armador y la migración)
  paradas?: Parada[]; municipio?;
  // legacy: horarioAM, horarioPM
}
interface Viaje {
  id; rutaId; conductorId; busId; fecha; estado;
  horaInicio?; horaFin?; demorado?;   // demorado = contingencia de transbordo
  // legacy: tipo (AM/PM)
}
interface Registro {
  id; viajeId; ninoId; evento: "subio"|"bajo"; hora; paradaId;
  // transbordo (opcionales, solo en registros del punto):
  fecha?; lugarTipo?: TipoLugar; lugarId?; rutaId?; busId?; conductorId?;
  excepcion?; discrepancia?; motivo?;
}
```

**Estado del niño NO se guarda** (no hay `ninos.estado`): se **deriva** del último
`registro`. Decisión clave (ver §6).

## 5. Estado de las reglas de Firestore

> ⚠️ **Desde 2026-09-11 las reglas son la versión 2** (§3-quinvicies): cubren
> también `suplencias`, `auditoria`, `recorridos` y `sistema`, y tienen 76 pruebas
> automáticas en `pruebas-reglas/`. Lo que sigue en esta sección describe la
> versión 1 y queda como historia. Publicar la v2 exige el orden de
> `docs/despliegue.md`.
>
> ✅ **PUBLICADO EL 2026-09-17:** reglas v2 + panel web (`firebase deploy --only
> firestore:rules,hosting`, con 76/76 pruebas antes de publicar) y APK nuevo
> (EAS build `ff88f8fa…`, enlace en `descargar.js`, **vence el 2026-10-01**).
> El aviso de abajo ya no aplica; queda como historia.
>
> ⚠️ **LO QUE ESTÁ PUBLICADO HOY NO CONOCE LAS COLECCIONES NUEVAS (2026-09-12):**
> `suplencias`, `auditoria`, `sistema`, `recorridos` e `incidencias` no tienen
> bloque `match` en las reglas publicadas, y en Firestore eso significa DENEGADO
> para todos. Por eso **Suplencias se queda cargando para siempre** y las
> novedades del viaje no funcionan en producción. Se arregla publicando la v2
> (`firebase.json` apunta a `firestore.rules`), que va junto con el APK nuevo.

- `firestore.rules` (raíz) cubre las 10 colecciones. `puntos`: lectura autenticado,
  escritura admin. `registros`: **conductor lee/crea todo** (por eso el transbordo no
  necesitó reglas nuevas). Último deploy: 2026-07-28.
- ⚠️ **REGLAS FINALES SIN DESPLEGAR (Fase 9, 2026-07-30).** `firestore.rules` quedó en
  su **versión final documentada** (encabezado con el modelo de seguridad + las
  desviaciones justificadas respecto de la spec original de la §9). La **lógica es
  idéntica** a la ya probada — solo se agregó documentación — así que es seguro
  desplegarla. Cambios acumulados sin desplegar desde el 2026-07-28: `usuarios` lee
  cualquier autenticado (Fases 6/7: push + chat + llamada). **Hasta correr `firebase
  deploy --only firestore:rules`, el chat y los push fallan en silencio.**
- **Desviaciones documentadas (a propósito, defendibles):** (1) escrituras muy
  restringidas (config solo admin; viajes/ubicaciones solo el conductor dueño); (2)
  lectura sensible acotada (padre solo sus hijos/registros; mensajes solo participantes);
  (3) datos operativos (buses, rutas, viajes, ubicaciones) legibles por cualquier
  autenticado — evita `get()` por doc (tope 20 por lote) e índices/Cloud Functions fuera
  del plan Spark. `registros` create es conductor (no se verifica dueño con `get()` para
  no chocar con el tope en "marcar todos suben"); la propiedad la garantiza la app.
- ⚠️ **GOTCHA recurrente:** cada colección NUEVA no funciona hasta correr
  `firebase deploy --only firestore:rules` desde la raíz. Fue el bloqueo de varias
  sesiones (escuelas, paradas, puntos). El clasificador del entorno a veces bloquea que
  Claude lo corra; puede correrlo Derek. CLI logueado como `transportesperez36@gmail.com`.

## 6. Decisiones clave del transbordo (se apartan del prompt a propósito)

- **Estado derivado de `registros`, no `ninos.estado`.** Una sola fuente de verdad y el
  conductor NO necesita permiso de escritura sobre `ninos` (datos sensibles).
- **Sin reglas nuevas ni índices** para transbordo: `registros` ya alcanza; consultas
  solo con igualdades (`fecha`+`lugarTipo`+`lugarId`) y orden en cliente.
- **`LugarRef` = `{tipo:'punto', id}`** (no `refId`/`'transbordo'`) para no re-migrar.
- **Offline:** cola de escrituras en memoria (funciona sin señal con la app abierta; el
  SDK JS en RN no persiste entre reinicios y no se agregó `@react-native-firebase`).
- **Validación de escuela en el RECEPTOR** (que conoce su ruta), no en el emisor (que
  nunca lee la ruta ajena).
- **"Continuar sin transbordo":** los pendientes quedan como `excepcion` en el punto.
- **Registros inmutables:** una corrección es un registro nuevo, no un update.

## 7. Datos de prueba (seed)

`/datos-prueba` (web) → elegir 2 conductores distintos → "Cargar". Crea (todo "(prueba)",
idempotente por el punto "Plaza Cabotaje (prueba)"): 2 escuelas, 1 punto, 2 buses
(PRU-001/002), 1 padre-doc (sin login), 5 niños, 2 rutas **en el turno actual**.
**Pedro López** hace transbordo: bus PRU-001 lo lleva de su casa al punto; PRU-002 lo
recibe en el punto y lo lleva a su escuela. (Juan y María son hermanos, misma casa → dedup.)

## 8. Cómo correr / verificar

- Web: `cd transporte-web && npm run dev` (5173/5174). Build: `npm run build`; lint: `npx eslint src`.
- Móvil: `cd transporte-movil && npx expo start` → Expo Go `exp://<IP-LAN>:8081`.
  Type-check: `npx tsc --noEmit`; lint: `npx eslint app services components`.
- Deploy reglas: `firebase deploy --only firestore:rules` (desde la raíz).
- `models.ts`: editar el del web, copiarlo al móvil, `diff` que sean idénticos.
- Antes de escribir código móvil: `transporte-movil/AGENTS.md` pide leer los docs de Expo v54.

## 9. Pendientes (próximos pasos)

0. **SALIR A PRODUCCIÓN, en este orden** (2026-09-12; el detalle con comandos
   está en `docs/despliegue.md`). Se confirmó que el sistema **todavía no está
   en uso real**, así que no hay que proteger a nadie ni hacer etapas:
   > **2026-09-17: hechos (c) y (d)** — APK compilado y reglas v2 + panel
   > publicados. Antes se alinearon 6 parches de Expo (`expo install --fix`,
   > expo-doctor 21/21). Falta (a), (b) sin confirmar, y de (e) en adelante.
   > Guion de capturas para la presentación: `docs/evidencias-presentacion.md`.

   (a) commitear (hay ~167 archivos sin commitear desde el 21/08);
   (b) subir a EAS la clave de **FCM V1** — sin eso el push nunca llega, y es
   requisito obligatorio del informe;
   (c) `eas build -p android --profile preview` e instalar el APK;
   (d) `npm run build` en la web + `firebase deploy --only firestore:rules,hosting`
   (reglas v2 y panel JUNTOS: el panel nuevo necesita las colecciones nuevas);
   (e) abrir el panel como admin (recalcula los accesos de los conductores);
   (f) cargar los datos reales por los CRUDs (paso 4 de la guía);
   (g) la prueba de humo entera (paso 5) con dos teléfonos.
   Decisión pendiente de Derek: **App Check** (requiere migrar el móvil a
   `@react-native-firebase`).

1. **Probar el transbordo end-to-end en dos teléfonos** (conductor A y B) — solo se
   verificó que compila, NO en dispositivo. Revisar semántica de "Continuar sin transbordo".
2. **Padre con transbordo:** que el padre vea los DOS tramos del viaje de su hijo
   (hoy `padreService.listarRutasDeNino` devuelve 2 rutas; hay un TODO comentado ahí).
3. **Hacer funcionar las notificaciones** — el código está completo; faltan tres
   pasos de configuración que solo puede hacer Derek (piden login en Expo y una
   clave de Firebase): `eas init`, subir las credenciales de FCM V1 a EAS y
   compilar el APK. Guía paso a paso en **[`docs/notificaciones.md`](docs/notificaciones.md)**.
   Para verificar sin adivinar, la app trae ahora **Configuración →
   Notificaciones**: muestra el estado real (`sin_projectid`, `sin_permiso`,
   `sin_soporte`, `listo`) y un botón de **notificación de prueba** que traduce
   el error que devuelve Expo (`InvalidCredentials` = faltan las credenciales de
   FCM; `DeviceNotRegistered` = token viejo). Recién con eso en verde tiene
   sentido probar el circuito real (subió/bajó, proximidad a 400 m, transbordo).
4. **Probar la Fase 7 (chat)** con dos sesiones (construida 2026-07-30): padre ↔
   conductor ↔ admin, badges de no leídos, botón de llamada, y push de mensaje (requiere
   APK/dev build + deploy de reglas). Ver §3.
5. **Probar la Fase 8** (construida 2026-07-30): con un viaje en curso emitiendo GPS,
   ver el bus en `/supervision`; generar un reporte de viajes y exportar CSV; ver el
   historial de un niño. Falta aún, si se quiere: mostrar en el reporte las
   excepciones/demoras de transbordo (ya quedan en `registros`/`viaje.demorado`) y PDF
   (opcional, el informe lo da como "si alcanza el tiempo").
6. **Fase 9 — código y config LISTOS (2026-07-30); falta ejecutar los pasos de
   despliegue** (los corre Derek, no Claude). Ver `docs/despliegue.md` para los comandos
   exactos: (a) `firebase deploy --only firestore:rules`; (b) publicar la web con Firebase
   Hosting (`firebase.json` ya tiene el bloque `hosting` → `transporte-web/dist` con
   reescritura SPA); (c) `eas init` + `eas build -p android --profile preview` (APK) —
   `eas.json` y `app.json` (package + googleServicesFile) ya configurados; (d) cargar
   datos reales por los CRUDs. Reglas finales documentadas en `firestore.rules`. Casos de
   prueba del informe en `docs/casos-de-prueba.md`.
7. **Probar la identidad "Liquid Obsidian" en el teléfono** (2026-09-07, ver
   §3-quinquiesdecies). Solo se verificó que compila. Lo que hay que mirar sí o sí:
   (a) que las **fuentes carguen** — si fallan, la app arranca igual pero con la
   letra de Android; (b) el **desenfoque de la barra flotante** en un Android de
   gama baja (`expo-blur` es lo más caro del rediseño; si arrastra, se le quita
   el `translucido` en `components/BarraBurbuja.tsx` y queda sólida); (c) los
   **tres mapas oscuros** — que las teselas invertidas se lean y que los
   marcadores NO hayan quedado invertidos; (d) el **contraste al sol**, sobre
   todo la lista de asistencia del conductor, que es la razón por la que sus
   botones quedaron sólidos y no de vidrio; (e) que **ninguna pantalla haya
   quedado con texto oscuro sobre fondo oscuro** — el barrido fue por tokens,
   pero conviene recorrer las 25 pantallas una vez.

8. **Probar el rediseño móvil anterior en el teléfono** (2026-08-19, ver §3-bis y §3-ter):
   que el aviso publicado desde el panel aparezca solo en el inicio del padre;
   escribir en el chat con el teclado abierto (que no tape el campo ni el botón
   de enviar); revisar en un Android **con los tres botones de abajo** que
   ninguna pantalla quede cortada al final; y, con un viaje en curso, ver el
   mapa grande del inicio del padre y la barra de progreso del conductor con el
   botón de finalizar fijo abajo. La paleta tropical conviene mirarla también en
   **modo oscuro** (la app sigue el modo del teléfono).
9. **Limpieza técnica:** quitar campos legacy (`horarioAM/PM`, `centroEducativo`,
   `Nino.rutaId/paradaId`, `Viaje.tipo`, y `ninoIds` cuando móvil+padre usen `ninos`).
10. **Actualizar `CLAUDE.md` §5** (estado actual) — está desactualizada. (§4 sí
   quedó al día con la identidad nueva.)

## 10. Archivos clave

**Web** (`transporte-web/src/`): `types/models.ts`; `services/` (firebase, auth,
usuarios, buses, escuelas, puntos, ninos, rutas, dashboard, migracion, datosPrueba,
**mensajes**, **supervision**, **reportes**); `utils/csv.ts`; `screens/` (Login,
Dashboard, GestionUsuarios, Buses, Escuelas, Puntos, Ninos, Rutas, **Mensajes**,
**Supervision**, **Reportes**, Migracion, DatosPrueba); `components/` (AppLayout,
MapaUbicacion, **MapaBuses**); `App.tsx`, `context/AuthContext.tsx`.

**Móvil** (`transporte-movil/`): `types/models.ts`; `services/` (firebase, auth,
conductor, viajes, ubicaciones, notificaciones, transbordo, padre, **mensajes**);
`components/` (GrupoAsistencia, **FilaContacto**, **BotonMensajes**);
`hooks/use-emision-ubicacion.ts`; `app/conversacion.tsx` (chat compartido);
`app/(conductor)/` (hoy, transbordo, recorrido, **mensajes**, _layout),
`app/(padre)/` (hijos, mapa, historial, **mensajes**, _layout), `app/login.tsx`, `app/index.tsx`.

**Móvil (config Fase 9):** `eas.json` (perfil `preview` = APK), `app.json`
(`android.package`, `googleServicesFile`, `ios.bundleIdentifier`), `google-services.json`.

**Raíz:** `firestore.rules` (final documentada), `firebase.json` (rules + hosting),
`.firebaserc`, `CLAUDE.md`, `MIGRACION-fase-3.5.md`, `docs/transbordo-implementacion.md`,
`docs/casos-de-prueba.md`, `docs/despliegue.md`, este archivo.
