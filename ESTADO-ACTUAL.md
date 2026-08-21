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

## 4. Modelo de datos (colecciones y tipos clave)

Colecciones: `usuarios, buses, escuelas, puntos, ninos, rutas, viajes, registros, ubicaciones, mensajes`.

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
7. **Probar el rediseño móvil en el teléfono** (2026-08-19, ver §3-bis y §3-ter):
   que el aviso publicado desde el panel aparezca solo en el inicio del padre;
   escribir en el chat con el teclado abierto (que no tape el campo ni el botón
   de enviar); revisar en un Android **con los tres botones de abajo** que
   ninguna pantalla quede cortada al final; y, con un viaje en curso, ver el
   mapa grande del inicio del padre y la barra de progreso del conductor con el
   botón de finalizar fijo abajo. La paleta tropical conviene mirarla también en
   **modo oscuro** (la app sigue el modo del teléfono).
8. **Limpieza técnica:** quitar campos legacy (`horarioAM/PM`, `centroEducativo`,
   `Nino.rutaId/paradaId`, `Viaje.tipo`, y `ninoIds` cuando móvil+padre usen `ninos`).
9. **Actualizar `CLAUDE.md` §5** (estado actual) — está desactualizada.

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
