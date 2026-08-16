# CLAUDE.md — Sistema de Transporte Escolar Inversiones Perez

## Cómo usar este documento

Este archivo vive en la raíz de la carpeta `TransportePerez` (al mismo nivel que `transporte-web` y `transporte-movil`). Abrí Claude Code desde esa carpeta raíz, para que tenga visibilidad de ambos proyectos a la vez.

Este documento es la **fuente de verdad**. Leelo completo antes de escribir código. Las fases dependen unas de otras — no saltes de fase sin cerrar la anterior. El resumen de "estado actual" (sección 5) refleja el proyecto al momento de escribir esto — antes de asumir algo, revisá los archivos reales por si hubo cambios posteriores no reflejados aquí.

## 1. Qué es este proyecto

Sistema de gestión de transporte escolar para **Inversiones Perez**, empresa de transporte estudiantil propiedad de Francis Perez, que opera rutas en La Ceiba, El Porvenir, El Pino y La Unión (Atlántida, Honduras).

Este sistema es también el **Proyecto de Graduación de Derek**, Ingeniería en Informática, CEUTEC La Ceiba (asesora: Sairy Odeth Chirinos Madrid). De esto se derivan dos reglas importantes:

1. **Tiene que funcionar de verdad.** No es un mockup académico; la empresa lo va a usar en producción.
2. **Derek tiene que poder defender cada línea frente a un jurado.** Priorizá claridad sobre "cleverness". Evitá abstracciones que no aporten valor real a este alcance. Comentá las decisiones no obvias.

> Nota sobre el informe académico: el documento de tesis también incluye un marco teórico/legal (Ley de Transporte Terrestre Decreto 155-2015, regulaciones del IHTT) y una metodología (Scrum/ágil adaptada a un solo desarrollador). Eso es contenido documental de la tesis, no se traduce en features de código — no intentes "implementar" cumplimiento legal ni Scrum en el sistema.

## 1-bis. Principios de diseño (aplican a TODO el proyecto)

Estos dos principios mandan sobre cualquier decisión de features o UI. Si algo los contradice, se replantea.

**1. El transbordo es la excepción, no la regla.** La mayoría de niños son directos (casa → escuela). Cuando el admin agrega un niño a una ruta, `subeEn`/`bajaEn` se llenan solos con el caso directo según el turno — **nunca** se le pide al admin decidir por cada niño. La UI de transbordo solo existe si la ruta tiene un punto de transbordo insertado, y por defecto no lo tiene. (El transbordo es cuando un niño usa dos buses, cambiando en un "punto"; ver `docs/transbordo-implementacion.md`.)

**2. Simplicidad de operación por encima de completitud de funciones.**
- **Conductor** (maneja un bus): botones grandes, "Todos" siempre visible, dos estados máximo (pendiente / listo), cero configuración.
- **Padre** (no debe entender el sistema): recibe avisos y ve el mapa. No agregarle pantallas, filtros ni conceptos nuevos. El transbordo para él es invisible — una notificación y el marcador que sigue moviéndose.
- **Admin/jefe** (configura): ahí sí puede haber densidad.
- Si una función requiere explicarle algo nuevo al conductor o al padre, **proponela antes de construirla**.

**3. Mecánica del transbordo.** Solo **decide quien ENTREGA**; quien **recibe confirma una lista que se llena sola** (su plan + lo que dejó el otro bus, leído de `registros` — nunca de la ruta ajena). Si hay **discrepancia**, **manda la recepción**: quien tiene físicamente al niño gana, y la discrepancia queda registrada para el admin.

## 2. Alcance funcional obligatorio (del informe — nada de esto es opcional)

- Control de qué niños son transportados, en qué ruta y parada.
- Gestión de rutas, paradas y horarios (AM/PM).
- Ubicación del bus en tiempo real en un mapa.
- Notificación push al padre cuando su hijo sube al bus.
- Notificación push al padre cuando su hijo baja del bus.
- Notificación push al padre cuando el bus se acerca a su parada.
- Canal de comunicación padre ↔ conductor y padre ↔ administración.
- Panel de supervisión total para Francis (dueño): todos los buses, todas las rutas, todos los viajes en curso, reportes históricos.

## 3. Roles del sistema

- **admin** — usa la app web. Ve y gestiona todo.
- **conductor** — usa la app móvil. Ve solo su ruta/bus asignado del día.
- **padre** — usa la app móvil. Ve solo a sus propios hijos.

No existe registro público para ningún rol. Ver sección 6.

## 4. Stack tecnológico (fijo — no sustituir sin preguntar primero)

| Capa | Tecnología |
| --- | --- |
| Panel admin | React + Vite + TypeScript |
| UI web | Mantine (`@mantine/core`, hooks, notifications, form) + `@tabler/icons-react` |
| Routing web | react-router-dom |
| Mapa web | react-leaflet + leaflet (+ `@types/leaflet`) |
| App móvil | React Native + Expo (TypeScript) + Expo Router |
| UI móvil | React Native Paper |
| Mapa móvil | `react-native-webview` cargando HTML con Leaflet embebido — **NO** usar react-native-maps/Google Maps, para mantener consistencia con el informe ya entregado (especifica Leaflet/OpenStreetMap) |
| Backend | Firebase Firestore + Firebase Authentication (Email/Password) |
| Notificaciones push | Expo Push Notifications API directo (`expo-notifications`) — **NO** Firebase Cloud Messaging, **NO** Cloud Functions |
| Plan de Firebase | Spark (gratis) — todo el diseño evita depender de Cloud Functions o plan Blaze |

No se usan plantillas de pago ni de terceros (ThemeForest, CodeCanyon, tutoriales copiados) — todo el código debe ser original para que Derek pueda defenderlo.

## 5. Estado actual (ya construido — verificar antes de repetir trabajo)

**Firebase (consola + CLI):**

- Proyecto: `transporte-perez`. Firestore en modo producción, región us-central1.
- **Reglas por rol ya desplegadas** (se adelantó una primera versión de la Fase 9): versionadas en `firestore.rules` en la raíz del repo, junto con `firebase.json` y `.firebaserc`. Cubren las 8 colecciones; ninguna lectura/escritura permitida sin autenticación. La regla bootstrap temporal usada para crear el primer admin ya fue removida y redesplegada. En Fase 9 solo queda refinarlas (ej. acotar qué niños lee un conductor).
- Firebase CLI logueado como `transportesperez36@gmail.com` (dueña del proyecto). Deploy de reglas: `firebase deploy --only firestore:rules` desde la raíz.
- Authentication: Email/Password activado.
- **Usuario admin ya creado y verificado en Firestore**: `admin@transporteperez.com` (uid `AkwzczMOxbefYAXICmSsmNRVZjC3`, doc en `usuarios/` con `rol: "admin"`). La contraseña la conoce Derek — no está en el repo. No hizo falta el script `seed-admin.ts`: se creó vía REST API con una regla bootstrap temporal, ya removida.
- Apps registradas: Web, Android (`com.derekperez.transporteperez`), iOS (mismo bundle ID).

**transporte-web/ (Fase 2 completa):**

- Scaffolding Vite+React+TS funcionando (`npm run dev`, puerto 5173).
- Instalado: firebase, react-router-dom, paquetes de Mantine, @tabler/icons-react.
- `.env` con credenciales (ya en `.gitignore`).
- `src/services/firebase.ts` — inicializa Firebase, exporta `db` y `auth`.
- `src/types/models.ts` — modelo de datos completo (sección 7).
- `src/services/authService.ts` — `login()`, `logout()`, `obtenerPerfilUsuario()`, `escucharCambiosSesion()`.
- `src/context/AuthContext.tsx` — `AuthProvider` + hook `useAuth()`.
- `src/screens/LoginScreen.tsx` — formulario de login con Mantine.
- `src/App.tsx` — enruta por rol (sin sesión → login; rol≠admin → acceso no autorizado; admin → placeholder de panel con botón de logout).
- `src/main.tsx` — envuelve con MantineProvider, BrowserRouter, AuthProvider.

> ✅ **Login end-to-end confirmado** (2026-07-06): Derek entró con el usuario admin y vio el placeholder del panel con logout. Fase 2 web cerrada.

**transporte-web/ — Fase 3 completa (probada manualmente por Derek el 2026-07-08: creación de conductor y padre sin perder la sesión admin, correos de restablecimiento recibidos, paradas persistidas en Firestore, parada reseteada al cambiar ruta, dashboard con contadores correctos):**

- Instalado: react-leaflet + leaflet + @types/leaflet.
- `src/components/AppLayout.tsx` — Mantine AppShell (sidebar + header con logout), responsive con burger.
- `src/screens/DashboardScreen.tsx` — cards de totales usando `getCountFromServer` (cuenta en servidor, barato en cuota).
- `src/screens/UsuariosScreen.tsx` + `src/services/usuariosService.ts` — CRUD con el truco de la 2ª instancia de Firebase (`initializeApp(config, "secundaria")` + `deleteApp` al final); contraseña temporal aleatoria + email de restablecimiento.
- `src/screens/BusesScreen.tsx`, `RutasScreen.tsx` (con gestión de paradas: mapa Leaflet clic-para-agregar, renombrar inline, reordenar con flechas, guardar array completo), `NinosScreen.tsx` (parada filtrada según ruta elegida) + sus servicios.
- `src/index.css` reemplazado por reset mínimo (el CSS del template rompía el AppShell); `App.css` y pantalla placeholder eliminados.
- Decisiones tomadas no especificadas: sin borrado físico (solo switch activo/activa — conserva historial); email y rol no editables tras crear; reorden de paradas con flechas (sin drag&drop ni librería extra); horarios como TextInput validado `HH:mm` (evita instalar @mantine/dates); paradas nuevas se llaman "Parada N" y se renombran inline.
- Verificado: tsc, ESLint y `npm run build` limpios. Falta prueba manual end-to-end con datos reales.

**transporte-movil/ (Fase 2 completa):**

- Scaffolding Expo SDK 54 + TS funcionando (probado con Expo Go vía LAN, `exp://<ip>:8081`).
- `google-services.json` y `GoogleService-Info.plist` copiados a la raíz.
- Instalado: firebase, `@react-native-async-storage/async-storage`, `react-native-paper`.
- `.env` con credenciales `EXPO_PUBLIC_FIREBASE_*` (agregado a `.gitignore`).
- `types/models.ts` — idéntico al del proyecto web.
- `services/firebase.ts` — `initializeAuth` + `getReactNativePersistence(AsyncStorage)` para que la sesión sobreviva a cerrar la app. Nota: el import de `getReactNativePersistence` lleva un `@ts-expect-error` porque falta en los typings públicos de firebase v12 (existe en el build react-native que Metro resuelve).
- `services/authService.ts` y `context/AuthContext.tsx` — mismo patrón y mismos nombres que web.
- `app/login.tsx` — pantalla de login con React Native Paper, sin registro público.
- `app/index.tsx` — despachador: redirige por rol (conductor → `/hoy`, padre → `/hijos`, admin → aviso de usar la web, sin sesión → `/login`).
- `app/(conductor)/` y `app/(padre)/` — grupos con layout protegido cada uno (redirigen si el rol no coincide) y pantallas placeholder (`hoy.tsx` para Fase 4, `hijos.tsx` para Fase 5).
- Pantallas del template de Expo eliminadas (`(tabs)`, `modal`).

**transporte-movil/ — Fase 4 completa (probada por Derek el 2026-07-08 con teléfono físico: viaje iniciado con GPS emitiendo a `ubicaciones/{viajeId}`, asistencia subió/bajó escribiendo en `registros`, viaje finalizado con limpieza de ubicación, contador del dashboard reflejando el viaje):**

- Instalado: expo-location (~19.0.8) + plugin en `app.json` con el texto del permiso iOS.
- `services/conductorService.ts` — bus del conductor, ruta del bus, niños de la ruta. Todas las consultas usan solo filtros de igualdad (sin `orderBy` en servidor) para no requerir índices compuestos; el orden se resuelve en cliente.
- `services/viajesService.ts` — `listarViajesDeHoy`, `iniciarViaje` (crea en `en_curso` con `horaInicio`), `finalizarViaje`, `registrarEvento` (subió/bajó → `registros`), `listarRegistrosDeViaje`, helpers `fechaDeHoy()` y `tipoViajeActual()` (AM si hora < 12).
- `services/ubicacionesService.ts` — `actualizarUbicacion` (setDoc que sobreescribe `ubicaciones/{viajeId}`) y `limpiarUbicacion` (borra el doc al finalizar — el bus ya no está en vivo).
- `services/notificacionesService.ts` — `notificarEventoAlPadre()` **no-op a propósito**: punto de integración para Fase 6, ya cableado desde la pantalla del conductor.
- `hooks/use-emision-ubicacion.ts` — `watchPositionAsync` con throttle propio de 15s mínimo entre escrituras (además de `timeInterval`/`distanceInterval` como pistas al SO); devuelve estado del GPS (`inactivo`/`activo`/`sin_permiso`/`error`). Solo foreground — background location no funciona en Expo Go; para producción el conductor mantiene la app abierta durante el viaje (documentar en el informe).
- `app/(conductor)/hoy.tsx` — pantalla completa: datos de ruta/bus, "Iniciar viaje AM/PM" según hora, asistencia por parada (estado por niño: pendiente → en el bus → entregado, derivado del último registro), contadores en bus/entregados, chip de estado GPS, "Finalizar viaje" con confirmación. Registros nuevos se reflejan localmente sin re-consultar (ahorra lecturas).
- Decisiones tomadas no especificadas: un viaje por tipo (AM/PM) por día — si el del turno actual ya finalizó, no se puede reiniciar; al finalizar se borra `ubicaciones/{viajeId}`; el botón "Subió" solo habilitado en estado pendiente y "Bajó" solo en el bus (máquina de estados simple).

**transporte-movil/ — Fase 5 construida (pendiente prueba manual con dos sesiones):**

- Instalado: react-native-webview (13.15.0).
- `services/padreService.ts` — `listarHijos`, `obtenerRuta`, `listarViajesDeRutaPorFecha`, `listarRegistrosDeNino` (siempre filtra por `ninoId` con igualdad — requisito de las reglas para que el padre pueda listar), `escucharUbicacion` (onSnapshot sobre `ubicaciones/{viajeId}`, entrega null si el doc no existe).
- `app/(padre)/hijos.tsx` — "Mis hijos": estado por último registro del viaje vigente de hoy (en casa / en el bus / entregado), pull-to-refresh, botones "Ver bus en vivo" (habilitado solo con viaje en curso) e "Historial". Rutas consultadas una sola vez aunque haya hermanos.
- `app/(padre)/mapa.tsx` — WebView con HTML+Leaflet embebido (CDN unpkg): marcador 📍 de la parada fijo y 🚌 del bus con transición CSS (animado); RN reenvía cada onSnapshot vía `postMessage` (listeners en window Y document por diferencias iOS/Android); chips de estado (en vivo con hora / esperando / viaje finalizado — detecta el borrado del doc).
- `app/(padre)/historial.tsx` — historial filtrable por fecha con flechas día anterior/siguiente (sin datepicker externo); consulta viajes de la ruta por fecha y de ahí los registros del niño (solo igualdades, sin índices compuestos).
- Decisiones tomadas no especificadas: estado "vigente" = viaje en curso o el último finalizado de hoy; el mapa encuadra bus+parada solo en la primera coordenada (no molesta al usuario después); Leaflet se carga desde CDN unpkg (la app requiere internet de todos modos por Firestore).
- Verificado: tsc limpio, bundle Metro compila (1660 módulos). Falta prueba manual con dos sesiones (conductor emitiendo + padre viendo).

## 6. Decisiones de negocio ya tomadas (no las reabras)

- **Registro cerrado (Opción A):** ninguna pantalla de registro público. Todas las cuentas (conductores y padres) las crea el admin desde el panel web. Justificación: cartera cerrada — la empresa ya conoce a sus clientes — y evita el problema de verificar la relación padre-hijo sin control.
- **Entrega de contraseña:** el admin registra al usuario con su email real → Firebase envía email de restablecer contraseña → el usuario define la suya. Nadie maneja contraseñas en texto plano.
- **Problema técnico de Fase 3:** crear un usuario desde el SDK cliente de Firebase (web) desloguea al admin actual. Solución: una segunda instancia de Firebase App (`initializeApp(config, "secundaria")`) solo para el flujo de creación de usuarios, cerrando su sesión inmediatamente después. Evita necesitar Cloud Functions/Admin SDK del lado servidor.
- **Plataforma prioritaria de demo:** Android (APK vía `eas build`). iOS queda documentado como soportado por la arquitectura (Expo), pero no es el entregable principal — requiere cuenta de desarrollador Apple ($99/año), fuera de alcance.
- **`ubicaciones` es un documento que se sobreescribe por viaje** (no historial acumulado), para ahorrar cuota de escrituras del plan gratuito.

## 7. Modelo de datos

Ya definido en `transporte-web/src/types/models.ts` y `transporte-movil/types/models.ts` (deben mantenerse idénticos). 8 colecciones: `usuarios`, `buses`, `rutas` (con `paradas` anidadas como array), `ninos`, `viajes`, `registros`, `ubicaciones`, `mensajes`. Leé ese archivo antes de escribir cualquier consulta a Firestore. Si agregás un campo, hacelo en ambas copias.

## 8. Especificación por fase

Trabajá en orden. Al cerrar cada fase: verificá que compile/type-check, y avisá qué falta probar a mano (consola Firebase, permisos del teléfono, etc.) y cualquier decisión que hayas tomado que no estuviera ya especificada aquí.

### Fase 2 — Autenticación y roles (empezar aquí)

**Web (terminar):**

1. Resolver la creación del primer usuario admin. Recomendado: script Node (`scripts/seed-admin.ts`) con `firebase-admin` que cree el usuario en Authentication + su doc en Firestore en un solo comando. Requiere que Derek descargue una clave de cuenta de servicio (Firebase Console → ⚙️ Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada) — indicale el paso exacto, y agregá esa clave a `.gitignore` de inmediato, nunca commitearla.
2. Confirmar login end-to-end: entrar con el admin, ver el placeholder del panel.
3. Agregar botón de logout visible en el layout placeholder.

**Móvil (construir desde cero):**

- `services/firebase.ts` equivalente al web. Usar `initializeAuth` con `getReactNativePersistence` de `firebase/auth` + `@react-native-async-storage/async-storage`, para que la sesión sobreviva a cerrar la app (en RN esto no es automático como en web).
- `services/authService.ts` y `context/AuthContext.tsx` — mismo patrón que web.
- Pantalla de login (React Native Paper), sin registro público.
- Expo Router con grupos de rutas por rol — `(conductor)` y `(padre)`, cada uno con su layout protegido; redirigir si el rol no coincide.

### Fase 3 — Panel administrativo web: CRUDs

- Layout: sidebar + header (Mantine AppShell).
- CRUD Usuarios: crear conductor/padre con el truco de la segunda instancia de Firebase (sección 6). Formulario: nombre, teléfono, email, rol.
- CRUD Buses: placa, capacidad, selector de conductor.
- CRUD Rutas: nombre, municipio (La Ceiba / El Porvenir / El Pino / La Unión), bus asignado, horarioAM, horarioPM.
- Gestión de paradas: mapa Leaflet (clic para agregar coordenadas), lista reordenable.
- CRUD Niños: nombre, grado, centro educativo, selector de padre/ruta/parada (parada filtrada según la ruta elegida).
- Dashboard: cards con totales (niños activos, buses activos, rutas activas, viajes de hoy).

### Fase 4 — App del conductor

- "Mi ruta de hoy": ruta asignada a su bus, paradas ordenadas con niños por parada.
- "Iniciar viaje": crea doc en `viajes` (`estado: 'en_curso'`, `horaInicio`, `tipo` AM/PM según hora del sistema).
- Lista de asistencia por parada: botón "subió"/"bajó" por niño → escribe en `registros` y dispara notificación (Fase 6).
- "Finalizar viaje": `estado: 'finalizado'`, `horaFin`, detiene emisión de ubicación.
- Emisión GPS: `expo-location`, `watchPositionAsync` con throttle (actualizar `ubicaciones/{viajeId}` cada 15-30s, no en cada movimiento).

### Fase 5 — App de padres

- "Mis hijos": estado actual según último registro (en casa / en el bus / entregado).
- Mapa en vivo: `onSnapshot` sobre `ubicaciones/{viajeId}`, marcador animado en el WebView+Leaflet (`postMessage` para pasar coordenadas de RN al mapa).
- Historial de registros de sus hijos, filtrable por fecha.

### Fase 6 — Notificaciones push

- Al iniciar sesión en móvil: pedir permiso (`expo-notifications` + `expo-device`), guardar el Expo Push Token en `usuarios/{uid}.expoPushToken`.
- Al registrar "subió"/"bajó" (Fase 4), la app del conductor llama directo a `https://exp.host/--/api/v2/push/send` con el token del padre — sin backend intermedio.
- Notificación de proximidad: en cada actualización de ubicación, calcular distancia (fórmula haversine) a la parada de cada niño pendiente de esa ruta; si es menor a un umbral (ej. 300-500m) y no se notificó ya en este viaje para esa parada, enviar push.
- Manejar notificaciones en foreground y background.

### Fase 7 — Comunicación padre-conductor/admin

- Colección `mensajes`, `conversacionId` = los dos IDs ordenados alfabéticamente y unidos (determinístico sin importar quién inicia).
- Chat en tiempo real (`onSnapshot`, ordenado por `hora`).
- Desde padres: chat con el conductor de la ruta de su hijo y con el admin.
- Si el tiempo apremia: fallback con botón de llamada directa (`Linking.openURL('tel:...')`) — documentar cuál se implementó al final.

### Fase 8 — Supervisión y reportes (admin)

- Mapa con TODOS los buses con viaje `en_curso` simultáneamente.
- Reporte de viajes: filtro fecha/ruta/conductor, conteo de niños transportados (agregando `registros`).
- Historial de asistencia por niño.
- Exportación CSV mínimo viable (papaparse o generación manual); PDF opcional si alcanza el tiempo.

### Fase 9 — Seguridad, pruebas y despliegue

- Reglas de seguridad Firestore finales (reemplazando el bloqueo total actual):
  - `usuarios`: cada quien lee/escribe su propio doc; admin todo.
  - `ninos`: padre solo lee donde `padreId == request.auth.uid`; conductor lee los niños de su ruta asignada; admin todo.
  - `rutas`/`buses`: lectura para conductor/padre relacionados, escritura solo admin.
  - `viajes`/`registros`/`ubicaciones`: escritura solo por el conductor dueño del viaje; lectura por el padre de un niño en esa ruta y por admin.
  - `mensajes`: cada quien lee/escribe solo conversaciones donde participa.
- Casos de prueba por módulo (documentados — sirven para el capítulo de pruebas del informe).
- Deploy web: Vercel o Firebase Hosting.
- Build móvil: `eas build --platform android` → APK.
- Cargar datos reales de Inversiones Perez (rutas, buses, niños) para la demo final.

## 9. Estándares de código

- Campos de Firestore, variables de lógica de negocio, comentarios y todo texto visible al usuario final: **en español**.
- Nombres de archivos/componentes pueden mezclar términos técnicos en inglés con palabras de dominio en español (ya establecido: `authService.ts`, `AuthContext.tsx`, `LoginScreen.tsx`) — seguí ese patrón.
- Priorizá código que Derek pueda explicar línea por línea en su defensa. Evitá abstracciones que no aporten valor real a este alcance.
- No agregues librerías fuera de la sección 4 sin señalarlo y explicar por qué.
- Comentá las decisiones no obvias (mismo estilo que `models.ts` y `authService.ts` ya construidos).

## 10. Cómo trabajar

- Fase por fase, en el orden de la sección 8. No adelantes Fase 4/5/6/7/8 antes de cerrar Fase 2 y 3 — todo depende de tener usuarios, rutas y niños reales en Firestore.
- Al cerrar cada fase: verificá que compile, y resumí qué quedó, qué falta probar a mano, y cualquier decisión tomada que no estuviera ya especificada aquí.
- Si una decisión de arquitectura no está cubierta en este documento, preguntá antes de asumir — explicá brevemente el porqué de decisiones importantes, Derek no es programador de profesión.
- No corras builds/deploys (`eas build`, deploy a Vercel/Firebase Hosting) ni toques las reglas de Firestore en producción sin avisar primero.

## 11. Qué NO hacer

- No usar Realtime Database (usamos Firestore).
- No usar Cloud Functions ni plan Blaze.
- No usar Google Sign-In ni ningún proveedor social — solo Email/Password.
- No crear pantallas de registro público.
- No usar plantillas de terceros ni código copiado de tutoriales con licencia.
