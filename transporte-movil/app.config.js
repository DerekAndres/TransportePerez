// ============================================
// CONFIGURACIÓN DINÁMICA DE LA APP
// ============================================
// Toda la configuración sigue viviendo en `app.json` — este archivo solo cambia
// UNA cosa antes de compilar: de dónde sale `google-services.json`.
//
// El problema: ese archivo tiene las credenciales de Firebase para Android (las
// que usa FCM para entregar las notificaciones) y está en `.gitignore`, así que
// NO viaja al servidor de EAS cuando se compila el APK. Sin él, la app se
// compila sin notificaciones.
//
// La solución que recomienda Expo: subir el archivo una vez a EAS como variable
// de entorno de tipo "file" (hecho con `eas env:create GOOGLE_SERVICES_JSON`).
// Durante el build, EAS lo escribe en el servidor y deja su ruta en esa
// variable; acá se lee y se usa. En la computadora de Derek la variable no
// existe, así que sigue usándose el archivo local de siempre.
//
// Expo pasa el contenido de app.json en `config`; devolvemos ese mismo objeto
// con el retoque.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
  },
});
