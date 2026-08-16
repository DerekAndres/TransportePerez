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
  `registrarTokenPush` sale sin token, a propósito), (3) probar en APK/dev build —
  **Expo Go en Android NO soporta push remotas desde SDK 53**.
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
    la infra de Fase 6; el admin no tiene token porque usa la web, así que un mensaje AL
    admin no dispara push — lo ve al abrir el panel).
  - **Web (admin):** `screens/MensajesScreen.tsx` (dos paneles: conversaciones a la
    izquierda con badge de no leídos + selector para iniciar con cualquier conductor/padre;
    chat en vivo a la derecha). Ruta `/mensajes` + enlace en el sidebar. La web **no**
    manda push (evita el problema de CORS del endpoint de Expo desde el navegador); el
    padre/conductor lo ve por onSnapshot al abrir la app.
  - ⚠️ Para que funcione: **desplegar reglas** (§5). Falta prueba con dos sesiones
    (padre ↔ conductor ↔ admin) y, para el push de mensajes, APK/dev build.

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
3. **Probar la Fase 6 en dispositivo** (construida 2026-07-30). Antes: deploy de reglas
   (§5) y `eas init`. En APK o development build (Expo Go Android no recibe push):
   token guardado al entrar, avisos subió/bajó, proximidad a 400 m, transbordo neutro.
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
7. **Limpieza técnica:** quitar campos legacy (`horarioAM/PM`, `centroEducativo`,
   `Nino.rutaId/paradaId`, `Viaje.tipo`, y `ninoIds` cuando móvil+padre usen `ninos`).
8. **Actualizar `CLAUDE.md` §5** (estado actual) — está desactualizada.

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
