// ⬇️ ÚNICO VALOR A CAMBIAR: pegá acá el enlace del APK que imprime
//    `eas build --platform android --profile preview` al terminar.
//    Compilado el 2026-08-19 (versión 1.0.0, versionCode 1). Incluye el logo
//    nuevo, la portada animada y la paleta sacada del logo.
//    Ojo: en el plan gratuito, EAS conserva el archivo 30 DÍAS. Si el
//    piloto se extiende, recompilá y actualizá este enlace.
//
// Está en un archivo aparte y no dentro de descargar.html porque la política de
// seguridad del hosting (firebase.json → Content-Security-Policy) no permite
// scripts escritos dentro del HTML.
var ENLACE_APK =
  "https://expo.dev/artifacts/eas/YwIuOcwwxJEazMjzGAdOIGJBqnLiwojH8XEauGgD1pw.apk";

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
