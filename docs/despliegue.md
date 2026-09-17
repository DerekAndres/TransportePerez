# Guía de despliegue — Fase 9

> Estos pasos los corrés **vos (Derek)**, no Claude: implican desplegar a
> producción, compilar el APK y cargar datos reales. La configuración ya está
> lista en el repo; acá van los comandos exactos y en qué orden.
>
> Todos los comandos de Firebase se corren **desde la raíz** (`TransportePerez/`),
> donde están `firebase.json` y `.firebaserc` (proyecto `transporte-perez`).

---

## ⚠️ Antes que nada: la versión 2 de seguridad se publica EN ESTE ORDEN

Las reglas de Firestore de la versión 2 (2026-09-11, ver `ESTADO-ACTUAL.md`
§3-quinvicies) **no son compatibles con la app ni con el panel anteriores**, y
viceversa:

- Con las reglas nuevas, un teléfono con el **APK viejo** deja de funcionar: el
  conductor no ve a sus niños (la app vieja los pide todos, y ahora solo puede leer
  los suyos), no puede marcar asistencia ni iniciar viajes (la app vieja no manda
  la hora del servidor) y el padre no ve al conductor.
- Con las reglas viejas, el **panel nuevo** no puede guardar nada sensible: cada
  cambio viaja con su registro de `auditoria`, y las reglas viejas no conocen esa
  colección.

Por eso el orden es obligatorio:

1. **Compilar el APK nuevo** (paso 3 de abajo) e **instalarlo en TODOS los
   teléfonos** de conductores y padres. Hasta el paso 2 la app nueva sigue
   funcionando con las reglas viejas.
2. En un horario **sin viajes** (fin de semana o de noche), compilar la web y
   publicar **reglas y panel juntos**, en un solo comando:
   ```bash
   cd transporte-web && npm run build && cd ..
   firebase deploy --only firestore:rules,hosting
   ```
3. **Abrir el panel** e iniciar sesión como admin. Al entrar, el panel recalcula
   solo qué niños ve cada conductor (`conductorIds`). Para confirmarlo:
   Herramientas → Migración → **Recalcular accesos ahora** (dice cuántos niños
   actualizó).
4. **Prueba de humo** con un conductor y un padre (sección 5), incluida una
   suplencia de prueba.
5. En el navegador, con el panel abierto: F12 → Consola. **No tiene que aparecer
   ningún mensaje "Refused to…" (Content-Security-Policy)**. Si apareciera y algo
   del panel dejara de andar, la salida rápida es quitar el bloque `headers` de
   `firebase.json` y volver a correr `firebase deploy --only hosting`.

> **Nota (2026-09-12):** se llegó a preparar un paquete de reglas "de transición"
> (las publicadas + solo las colecciones nuevas) para no romperle el día a
> conductores que estuvieran trabajando con el APK viejo. Se descartó al
> confirmar que **el sistema todavía no está en uso real**: sin nadie
> trabajando, publicar la v2 completa junto con el APK nuevo es más simple y más
> seguro (la v2 es la que tiene las 76 pruebas). Si algún día hay que hacer un
> cambio por etapas, se rearma con `git show HEAD:firestore.rules` más los
> bloques de las colecciones nuevas.

### Probar las reglas antes de publicarlas

Las reglas tienen 76 pruebas automáticas que corren contra el emulador local
(nunca contra producción). Hace falta Java 11 o más nuevo; sirve el que trae
Android Studio.

```bash
cd pruebas-reglas
npm install          # solo la primera vez
npm test             # tiene que terminar con "fail 0"
```

En Windows, si `java -version` dice 1.8, antes de `npm test`:
```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export PATH="$JAVA_HOME/bin:$PATH"
```

---

## 0. Requisitos previos (una sola vez)

- **Node.js** instalado (ya lo tenés).
- **Firebase CLI**: `npm install -g firebase-tools` y `firebase login`
  (ya estás logueado como `transportesperez36@gmail.com`).
- **EAS CLI** (para el APK): `npm install -g eas-cli` y `eas login`
  (con tu cuenta de Expo; si no tenés, se crea gratis en expo.dev).

---

## 1. Desplegar las reglas de Firestore

Las reglas están en `firestore.rules`. **Leé primero la sección de arriba**: desde
la versión 2 se publican junto con el panel y después de instalar el APK nuevo.

```bash
firebase deploy --only firestore:rules,hosting
```

Verificación: en la consola de Firebase → Firestore → Reglas, la fecha de
publicación debe ser de hoy.

---

## 2. Desplegar el panel web (Firebase Hosting)

Firebase Hosting está en el plan gratuito (Spark). La config ya está en
`firebase.json` (sirve `transporte-web/dist` con reescritura SPA para React
Router, y las cabeceras de seguridad: Content-Security-Policy, X-Frame-Options,
HSTS y otras).

```bash
# 1) Compilar la web
cd transporte-web
npm install          # solo la primera vez
npm run build        # genera transporte-web/dist
cd ..

# 2) Publicar
firebase deploy --only hosting
```

Al terminar, la CLI imprime la URL pública (algo como
`https://transporte-perez.web.app`). Abrila e iniciá sesión como admin para
confirmar. Cada vez que cambie la web: `npm run build` + `firebase deploy --only
hosting`.

> ⚠️ Si se agrega un servicio externo nuevo al panel (otro proveedor de mapas,
> otra API), hay que sumar su dominio a la `Content-Security-Policy` de
> `firebase.json`: si no, el navegador lo bloquea en silencio.

---

## 3. Compilar el APK de Android (EAS Build)

El APK es el entregable de demo (Android es la plataforma prioritaria). La config
está en `eas.json` (perfil **preview** = APK instalable) y en `app.json`
(`android.package` = `com.derekperez.transporteperez`, con `google-services.json`
para las credenciales de FCM que usa el push).

> ⚠️ **Estos comandos los tenés que correr vos**: `eas login` y `eas init` piden
> las credenciales de tu cuenta de Expo de forma interactiva, así que Claude no
> los puede ejecutar.

```bash
# 0) Instalar el EAS CLI (una sola vez) e iniciar sesión en tu cuenta de Expo
npm install -g eas-cli
eas login

cd transporte-movil
npm install          # solo la primera vez

# 1) Vincular el proyecto con EAS (ya hecho: app.json tiene extra.eas.projectId)
eas init

# 2) Compilar el APK (se compila en la nube de Expo; al terminar da un link de descarga)
eas build --platform android --profile preview
```

Instalá el APK en el teléfono (descargándolo del link o con `eas build:run -p
android`).

> **GPS en segundo plano:** necesita este APK. En Expo Go la app funciona igual,
> pero el GPS solo transmite con la app abierta (la pastilla del conductor dice
> "GPS solo con la app abierta"). Con el APK, al iniciar un viaje aparece la
> notificación fija "Viaje en curso": es la que le permite a Android seguir
> mandando la ubicación con la pantalla apagada.

### ⚠️ Para que las notificaciones push funcionen

Son **dos** requisitos, y sin cualquiera de los dos el push falla en silencio
(la app no se rompe, simplemente nunca llega el aviso):

**a) `extra.eas.projectId` en `app.json`** — lo escribe `eas init` (paso 1 de
arriba). `registrarTokenPush()` en `services/notificacionesService.ts` corta y
retorna sin pedir token si ese id no está.

**b) Credenciales de FCM V1 subidas a EAS** — en Android, Expo Push entrega los
avisos a través de Firebase Cloud Messaging, y para eso el servidor de Expo
necesita una clave de cuenta de servicio de tu proyecto. El `google-services.json`
cubre solo el lado del cliente, no este. Pasos:

1. Firebase Console → ⚙️ Configuración del proyecto → pestaña **Cloud Messaging**.
2. En *Firebase Cloud Messaging API (V1)* → **Administrar cuentas de servicio** →
   generar una nueva clave privada (descarga un `.json`).
3. `eas credentials` → plataforma **Android** → *Push Notifications* → subir ese `.json`.

Recién después de esto compilá el APK. Para probar: el padre tiene que haber
abierto la app **al menos una vez** y aceptado el permiso de notificaciones
(ahí se guarda su `expoPushToken` en `usuarios/{uid}`); si no tiene token
guardado, el conductor marca asistencia y no se envía nada.

- El push remoto **no** funciona en Expo Go en Android (SDK 53+); recién con este
  APK se puede probar de verdad.

---

## 3-bis. Publicar el enlace de descarga del APK

La página pública de descarga ya está desplegada en
**https://transporte-perez.web.app/descargar** (archivo estático
`transporte-web/public/descargar.html`, fuera de la app React para que se abra
sin iniciar sesión). Trae las instrucciones de instalación para los padres y el
aviso de "orígenes desconocidos" de Android.

Para cambiar el APK que se descarga, cuando `eas build` termine:

1. Copiá el enlace del APK que imprime EAS al finalizar.
2. En **`transporte-web/public/descargar.js`** (no en el `.html`: la política de
   seguridad no permite scripts escritos dentro del HTML), reemplazá el valor de
   `var ENLACE_APK = "…";` por ese enlace.
3. Volvé a publicar:

```bash
cd transporte-web && npm run build && cd ..
firebase deploy --only hosting
```

> Se apunta al enlace de Expo en vez de subir el APK a Firebase Hosting a
> propósito: el plan Spark permite solo **360 MB de transferencia por día** y un
> APK de Expo pesa ~70-100 MB, o sea que se agotaría con 4 descargas diarias.
> Sirviéndolo desde Expo, el ancho de banda no consume tu cuota.
>
> Ojo: en el plan gratuito EAS conserva los artefactos de compilación **30 días**.
> Si el piloto se extiende más, recompilá y actualizá el enlace.

---

## 4. Cargar los datos reales de Inversiones Perez

Con la web ya publicada, iniciá sesión como admin y cargá, **en este orden** (cada
uno depende del anterior):

1. **Conductores** y **Padres** (sección Conductores / Padres). Cada uno recibe un
   correo para definir su contraseña.
2. **Buses** (placa, capacidad, conductor).
3. **Escuelas** y **Puntos** de transbordo (marcados en el mapa).
4. **Niños** (con su padre, escuela, turno y casa en el mapa).
5. **Rutas** (unidad + turno + hora de salida opcional + escuela(s) + niños;
   transbordo si aplica). Al guardar, el panel recalcula solo qué niños ve cada
   conductor.

> El seed de `/datos-prueba` es solo para pruebas; para producción se cargan los
> datos reales por los CRUDs. Los datos de prueba se borran desde esa misma
> pantalla.

---

## 5. Verificación post-despliegue (humo)

- [ ] Login de admin en la URL pública, sin mensajes "Refused to…" en la consola.
- [ ] Login de un conductor y de un padre en el APK.
- [ ] Un viaje de prueba: iniciar, marcar asistencia, ver el bus en `/supervision`.
- [ ] Con el viaje en curso, bloquear el teléfono del conductor 2 minutos: el bus
      tiene que seguir moviéndose en el mapa del padre.
- [ ] Marcar asistencia en modo avión, cerrar la app, volver a abrirla con señal:
      las marcas tienen que llegar (se ven en `/supervision` → detalle del viaje).
- [ ] El padre recibe el push de "subió" con la app cerrada.
- [ ] Un mensaje de chat ida y vuelta entre padre y conductor.
- [ ] Suplencias: asignar un suplente para hoy, confirmar que el suplente ve la
      ruta y el titular ve "Hoy te cubre…", y cancelarla.
- [ ] Desactivar una cuenta de prueba: la app la saca de la sesión y dice por qué.
- [ ] Auditoría: después de editar un niño, el cambio aparece en `/auditoria`.
- [ ] Respaldo: descargar el JSON desde Herramientas → Respaldo.
- [ ] Un reporte de viajes y su exportación a CSV.

Los casos detallados están en [`casos-de-prueba.md`](./casos-de-prueba.md).
