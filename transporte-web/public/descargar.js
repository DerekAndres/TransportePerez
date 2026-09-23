// ⬇️ ÚNICO VALOR A CAMBIAR: pegá acá el enlace del APK que imprime
//    `eas build --platform android --profile preview` al terminar.
//    Compilado el 2026-09-17 (versión 1.0.0, versionCode 1). Incluye el GPS en
//    segundo plano, la seguridad v2, el nombre "Transportes Perez" y el logo
//    nuevo (la buseta blanca, sin texto ni marcas de terceros).
//    Ojo: en el plan gratuito este enlace VENCE el 2026-10-01 (14 días). Si
//    hace falta después, recompilá y actualizá este enlace.
//
// Está en un archivo aparte y no dentro de descargar.html porque la política de
// seguridad del hosting (firebase.json → Content-Security-Policy) no permite
// scripts escritos dentro del HTML.
var ENLACE_APK =
  "https://expo.dev/artifacts/eas/Rox7IQdY2vFkUAINXRVJOwVFaAeeaLqAN4OqazDn6bU.apk";

var zona = document.getElementById("zona-descarga");
if (ENLACE_APK && ENLACE_APK !== "PENDIENTE") {
  var a = document.createElement("a");
  a.className = "boton";
  a.href = ENLACE_APK;
  a.textContent = "⬇  Descargar la app";
  zona.appendChild(a);
} else {
  var div = document.createElement("div");
  div.className = "no-disponible";
  div.textContent = "La app se está preparando — volvé pronto";
  zona.appendChild(div);
}
