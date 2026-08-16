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

```bash
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

### Notas sobre el push en el APK

- El push remoto **no** funciona en Expo Go en Android (SDK 53+); recién con este
  APK se puede probar de verdad.
- Expo Push usa FCM por debajo en Android. Si al probar el push no llega, configurá
  las credenciales de FCM V1 con `eas credentials` (Android → subir la clave de
  cuenta de servicio de Firebase → Project settings → Cloud Messaging). El
  `google-services.json` ya referenciado cubre la parte del cliente.

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
