# Guía de despliegue — Fase 9

> Estos pasos los corrés **vos (Derek)**, no Claude: implican desplegar a
> producción, compilar el APK y cargar datos reales. La configuración ya está
> lista en el repo; acá van los comandos exactos y en qué orden.
>
> Todos los comandos de Firebase se corren **desde la raíz** (`TransportePerez/`),
> donde están `firebase.json` y `.firebaserc` (proyecto `transporte-perez`).

---

## 0. Requisitos previos (una sola vez)

- **Node.js** instalado (ya lo tenés).
- **Firebase CLI**: `npm install -g firebase-tools` y `firebase login`
  (ya estás logueado como `transportesperez36@gmail.com`).
- **EAS CLI** (para el APK): `npm install -g eas-cli` y `eas login`
  (con tu cuenta de Expo; si no tenés, se crea gratis en expo.dev).

---

## 1. Desplegar las reglas de Firestore  ⚠️ pendiente y necesario

Las reglas finales están en `firestore.rules`. Incluyen los cambios de las Fases
6 y 7 (lectura de `usuarios` para cualquier autenticado). **Sin este paso, el chat
y las notificaciones push fallan en silencio.**

```bash
firebase deploy --only firestore:rules
```

Verificación: en la consola de Firebase → Firestore → Reglas, la fecha de
publicación debe ser de hoy.

---

## 2. Desplegar el panel web (Firebase Hosting)

Firebase Hosting está en el plan gratuito (Spark). La config ya está en
`firebase.json` (sirve `transporte-web/dist` con reescritura SPA para React
Router).

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

> Se puede publicar reglas y hosting juntos con `firebase deploy` (sin `--only`).

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

# 1) Vincular el proyecto con EAS. Esto crea/escribe extra.eas.projectId en
#    app.json — el MISMO id que las notificaciones push necesitan en runtime.
eas init

# 2) Compilar el APK (se compila en la nube de Expo; al terminar da un link de descarga)
eas build --platform android --profile preview
```

Instalá el APK en el teléfono (descargándolo del link o con `eas build:run -p
android`).

### ⚠️ Para que las notificaciones push funcionen

Son **dos** requisitos, y sin cualquiera de los dos el push falla en silencio
(la app no se rompe, simplemente nunca llega el aviso):

**a) `extra.eas.projectId` en `app.json`** — lo escribe `eas init` (paso 1 de
arriba). `registrarTokenPush()` en `services/notificacionesService.ts` corta y
retorna sin pedir token si ese id no está. Hoy `app.json` **no lo tiene**, así
que `eas init` es obligatorio, no opcional.

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

Mientras el APK no exista, la página muestra "La app se está preparando". Para
activar el botón, cuando `eas build` termine:

1. Copiá el enlace del APK que imprime EAS al finalizar.
2. En `transporte-web/public/descargar.html`, al final del archivo, reemplazá
   la línea `var ENLACE_APK = "PENDIENTE";` por ese enlace.
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
5. **Rutas** (unidad + turno + escuela(s) + niños; transbordo si aplica).

> El seed de `/datos-prueba` es solo para pruebas; para producción se cargan los
> datos reales por los CRUDs. Los registros de prueba se pueden dejar (son
> idempotentes y quedan marcados "(prueba)") o limpiar desde la consola.

---

## 5. Verificación post-despliegue (humo)

- [ ] Login de admin en la URL pública.
- [ ] Login de un conductor y de un padre en el APK.
- [ ] Un viaje de prueba: iniciar, marcar asistencia, ver el bus en `/supervision`.
- [ ] El padre recibe el push de "subió" con la app cerrada.
- [ ] Un mensaje de chat ida y vuelta entre padre y conductor.
- [ ] Un reporte de viajes y su exportación a CSV.

Los casos detallados están en [`casos-de-prueba.md`](./casos-de-prueba.md).
