# Cómo correr la app móvil (Expo SDK 54)

> Guía para levantar la app en tu teléfono vos solo. Todo se corre desde
> `transporte-movil/`. No hace falta instalar el "Expo CLI" global: el proyecto
> ya lo trae y se usa con `npx expo`.

---

## 1. Una sola vez

- **Node.js** instalado (ya lo tenés).
- **Dependencias del proyecto**: `cd transporte-movil` y `npm install`.
- **Expo Go** en el teléfono (Play Store / App Store). Tiene que ser la versión
  para **SDK 54**; si la app abre y dice que el proyecto usa otro SDK, actualizá
  Expo Go desde la tienda.
- El teléfono y la computadora en la **misma red WiFi**.

---

## 2. El comando de todos los días

```bash
cd transporte-movil
npx expo start
```

Se abre Metro (el empaquetador) e imprime un **QR**:

- **Android**: abrí Expo Go → *Scan QR code* → escaneá.
- **iPhone**: escaneá el QR con la cámara.

La primera carga tarda (arma el bundle entero, ~1-2 min). Después, cada vez que
guardás un archivo la app se recarga sola.

> Atajo equivalente: `npm start`.

### Teclas útiles mientras Metro corre

| Tecla | Qué hace |
| --- | --- |
| `r` | Recargar la app en el teléfono |
| `m` | Abrir el menú de desarrollo |
| `j` | Abrir el depurador (consola, red) |
| `?` | Ver todas las opciones |
| `Ctrl + C` | Apagar Metro |

Los `console.log` de la app aparecen en esta misma terminal.

---

## 3. Cuando el teléfono no conecta

Es lo que más falla, y casi siempre es la red. En orden, de lo más simple a lo
más seguro:

**a) Forzar el modo LAN con tu IP.** Averiguá la IP de tu WiFi:

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback|vEthernet|WSL" } | Select-Object IPAddress, InterfaceAlias
```

Y arrancá Metro fijándola (reemplazá por la tuya):

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "192.168.1.111"
npx expo start --lan
```

Esto hace falta cuando la PC tiene varias redes (WSL, VirtualBox, VPN) y Expo
elige la que no es.

**b) Modo túnel.** Anda aunque las redes no se vean entre sí (WiFi con
aislamiento de clientes, o el teléfono en datos móviles). Es más lento:

```bash
npx expo start --tunnel
```

La primera vez pide instalar `@expo/ngrok`: aceptá.

**c) Firewall de Windows.** Si el QR carga pero se queda en "Downloading…",
puede ser que Windows esté bloqueando el puerto 8081. Al arrancar Metro por
primera vez sale un cartel de Windows Defender: hay que darle **Permitir
acceso** en redes **privadas**.

---

## 4. Otros problemas comunes

| Síntoma | Qué hacer |
| --- | --- |
| "Port 8081 is running…" o el puerto quedó tomado | Cerrá la terminal vieja, o `npx expo start --port 8082` |
| Pantalla en blanco / cambios que no aparecen | `npx expo start --clear` (borra el caché de Metro) |
| `Unable to resolve module ...` | Casi siempre falta `npm install`, o el archivo importado no existe. Después, `--clear` |
| Cambiaste el `.env` | Reiniciá Metro: las variables `EXPO_PUBLIC_*` se inyectan al armar el bundle, no en caliente |
| Cambiaste `app.json` (plugins, permisos, íconos) | Expo Go **no** alcanza para probarlo: eso necesita un build (`eas build`) |
| Algo raro y no sabés qué | `npx expo-doctor` revisa el proyecto y dice qué está mal |

---

## 5. Verificar sin teléfono

Antes de probar en el celular conviene ver si el código está sano. Son rápidos y
no necesitan nada conectado:

```bash
npx tsc --noEmit                      # errores de tipos
npx eslint app services components    # errores de estilo/código
npx expo export --platform android    # arma el bundle entero: si esto pasa, la app carga
```

Si `expo export` termina sin error, no hay imports rotos ni archivos faltantes.

---

## 6. Qué NO se puede probar en Expo Go

Expo Go es la app genérica de Expo; no incluye código nativo propio del
proyecto. Por eso hay cosas que solo funcionan en el **APK**:

- **Notificaciones push remotas en Android** (desde el SDK 53 Expo Go no las
  recibe). Las locales sí.
- Cualquier cambio de `app.json` que toque configuración nativa.
- El ícono, el splash y el nombre reales de la app.

Todo lo demás — pantallas, Firestore en vivo, GPS, mapas, chat, fotos — se
prueba perfecto en Expo Go. Para el APK, ver [`despliegue.md`](./despliegue.md).

---

## 7. Instalar un paquete nuevo

Siempre con `expo install`, **no** con `npm install`: elige la versión
compatible con el SDK 54 en vez de la última publicada.

```bash
npx expo install nombre-del-paquete
```

(Y avisá antes de sumar dependencias nuevas: el proyecto trata de mantener la
lista corta, ver `CLAUDE.md` §4.)
