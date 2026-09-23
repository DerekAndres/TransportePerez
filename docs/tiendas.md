# Publicar en Google Play y en la App Store

> Decisión tomada el **2026-09-12**: se publica en **las dos tiendas, de forma
> pública**, y se confirma que hay iPhones reales entre los usuarios (por eso se
> reabre lo que `CLAUDE.md` §6 había dejado fuera de alcance).
>
> Estos pasos los corrés **vos (Derek)**: piden cuentas de desarrollador,
> pagos y formularios interactivos. Claude no puede ejecutarlos.
>
> ⚠️ Las políticas de las tiendas cambian seguido. Lo de acá es la guía; la
> palabra final siempre la tiene lo que diga la consola el día que subas.

---

## Bloqueos abiertos (verificado el 2026-09-13)

Esto es lo que hoy impide mandar la app a revisión. Está ordenado por lo que
tarda más en resolverse.

| # | Bloqueo | Estado (revisado el 2026-09-17) |
| --- | --- | --- |
| 1 | ~~El ícono lleva el logo de TOYOTA~~ | ✅ **resuelto**: logo nuevo (buseta blanca, sin texto ni emblemas; se amplió la parrilla para confirmarlo). Ícono de tienda listo en `tienda/` |
| 2 | Credenciales de **FCM V1** sin subir a EAS | 🔴 sin esto el push no llega. No se puede verificar desde acá: `eas credentials` es interactivo |
| 3 | ~~La política de privacidad no está publicada~~ | ✅ **publicada**: `https://transporte-perez.web.app/privacidad` responde 200 |
| 4 | **Nada probado en un teléfono** | 🔴 **el bloqueo de fondo**. Todo lo automático pasa, pero ninguna pantalla se vio en un equipo real |
| 5 | Cuentas de desarrollador sin abrir | 🔴 $25 Google · $99/año Apple |
| 6 | Sin capturas ni gráfico destacado 1024×500 | 🟡 el ícono ya está; las capturas salen del APK del 17/09 |
| 7 | Archivos sin commitear | 🟡 |
| 8 | **iOS nunca se compiló** | 🟡 los textos de permiso los inyectan los plugins al compilar: hay que verificarlos en el primer build |

> **Corregido el 2026-09-17:** el perfil `production` de `eas.json` no declaraba
> `environment`, así que el AAB se habría compilado **sin las variables de
> Firebase ni `google-services.json`** (el `preview` sí lo declaraba). Una app
> así instala bien y no deja iniciar sesión a nadie. Ya está puesto.

### 1. El ícono: por qué hay que rehacerlo

`transporte-movil/assets/images/icon.png` —y también
`transporte-web/public/logo.png`, que es el mismo dibujo— tiene tres problemas:

- **Lleva el logo de Toyota** dibujado en la parrilla de la buseta. Es una marca
  registrada ajena. Las dos tiendas pueden rechazar la ficha por eso, y para una
  empresa real es un riesgo legal que no hace falta correr.
- **Dice "Rutas Escolar"**, que no es el nombre de la app (*Transportes Perez*)
  ni está bien escrito.
- **Tiene texto y demasiado detalle.** Un ícono se ve a 48 px en la lista de
  apps del teléfono: ahí ese texto no se lee, y en Android muchos lanzadores lo
  recortan en círculo y se comen las palabras.

**Qué necesita el reemplazo:** una marca simple, sin texto y sin logos de
terceros, que se entienda a 48 px. Lo que mejor funciona es una silueta de
buseta genérica (sin marca ni modelo reconocible) sobre el zafiro de la app
(`#2563EB`), o las iniciales de la empresa. Hace falta en 1024×1024 px, sin
transparencia y sin esquinas redondeadas (las redondean las tiendas).

Al cambiarlo hay que reemplazar: `icon.png`, `android-icon-foreground.png` (solo
el símbolo, con aire alrededor: se recorta en círculo), `splash-icon.png` y
`transporte-web/public/logo.png`.

---

## 0. Antes que nada: esto va DESPUÉS de lo otro

Publicar en tiendas no reemplaza el despliegue normal (`docs/despliegue.md`).
Primero tiene que estar cerrado eso:

1. Commitear el trabajo pendiente.
2. Subir a EAS la clave de **FCM V1** (sin eso el push no llega nunca).
3. Compilar el APK, instalarlo y **hacer la prueba de humo completa** en
   teléfonos de verdad.
4. Publicar reglas v2 + panel, y cargar los datos reales.

Recién con eso funcionando tiene sentido empezar el trámite de las tiendas: lo
que se sube a revisión tiene que ser una app que ya sabés que funciona.

---

## 1. Lo que ya quedó listo en el repo

| Requisito | Estado |
| --- | --- |
| Nombre visible de la app | ✅ "Transportes Perez" (antes decía `transporte-movil`) |
| Identificador Android / iOS | ✅ `com.derekperez.transporteperez` |
| Proyecto EAS vinculado | ✅ `extra.eas.projectId` en `app.json` |
| Perfil de build para tiendas | ✅ `production` en `eas.json` (Android = **AAB**, que es lo que exige Play) |
| Permiso de fotos en iOS | ✅ agregado (sin él, iOS mata la app al tocar "cambiar foto" y Apple la rechaza) |
| Declaración de cifrado iOS | ✅ `usesNonExemptEncryption: false` (evita el formulario de exportación en cada subida) |
| Permisos de ubicación Android | ✅ solo primer plano (`FOREGROUND_SERVICE_LOCATION`). **No** se pide `ACCESS_BACKGROUND_LOCATION`, que dispara la revisión más dura de Play |
| Política de privacidad | ✅ publicada en `/privacidad` (revisala y cambiá el correo de contacto si hace falta) |

### Los permisos exactos que declara la app

Esto es lo que Play va a mostrar en la ficha, y tiene que coincidir con lo que
digas en el formulario de datos. Salió de `npx expo config --type prebuild`:

| Permiso Android | Por qué está |
| --- | --- |
| `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` | La posición del bus, solo en el teléfono del conductor y solo durante el viaje |
| `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_LOCATION` | Seguir transmitiendo con la pantalla apagada, con la notificación fija "Viaje en curso" |
| `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` | Elegir la foto de perfil o del niño en Android viejo (lo agrega el selector de imágenes) |
| `INTERNET` | Hablar con la base de datos |

**No** se declara `ACCESS_BACKGROUND_LOCATION` (el permiso "Permitir siempre"),
que es el que dispara la revisión más estricta de Play: con el servicio en primer
plano alcanza.

⚠️ **`RECORD_AUDIO` se quitó a mano.** El plugin del selector de imágenes declara
micrófono y cámara por defecto, aunque la app solo abra la galería. En una app
que transporta niños, un permiso de micrófono sin motivo es una pregunta
garantizada en revisión, así que en `app.json` van `cameraPermission: false` y
`microphonePermission: false`. Si algún día se agrega "tomar la foto con la
cámara", hay que volver a habilitar `cameraPermission`.

**iOS:** los textos de permiso (`NSPhotoLibraryUsageDescription`,
`NSLocationWhenInUseUsageDescription`) los inyectan los plugins al generar el
proyecto nativo durante `eas build`, no aparecen al resolver la configuración.
Verificalos en el log del build o en el Info.plist que genera: sin el de fotos,
iOS cierra la app al tocar "cambiar foto".

---

## 2. Cuentas que hay que abrir

| | Google Play | App Store |
| --- | --- | --- |
| Costo | **25 USD**, una sola vez | **99 USD por año** |
| Dónde | play.google.com/console | developer.apple.com/programs |
| Demora de verificación | días (piden documento de identidad) | días a semanas |

⚠️ **La trampa de calendario de Google Play:** si abrís una cuenta **personal**
nueva, Google exige una **prueba cerrada con 12 testers durante 14 días
seguidos** antes de habilitarte producción. No se puede acelerar trabajando más:
son 14 días de reloj. Las cuentas de **organización** (piden número D-U-N-S de
la empresa) están exentas. Si Inversiones Perez puede sacar el D-U-N-S, conviene:
te ahorra las dos semanas.

---

## 3. Google Play, paso a paso

1. Crear la app en Play Console (nombre, idioma, gratuita).
2. **Ficha de la tienda:** descripción corta y larga, ícono 512×512, gráfico
   destacado 1024×500 y al menos 2 capturas de teléfono.
3. **Política de privacidad:** pegar la URL `https://transporte-perez.web.app/privacidad`.
4. **Formulario de seguridad de los datos** (ver la tabla del punto 5).
5. **Declaración de ubicación:** como la app usa un servicio en primer plano con
   ubicación, Play pide explicar para qué y normalmente un **video corto**
   mostrando la función. Grabá el viaje del conductor: iniciar viaje → la
   notificación "Viaje en curso" → el bus moviéndose en el mapa del padre.
6. **Acceso para la revisión:** la app no tiene registro público, así que hay que
   darles un **usuario y contraseña de prueba** (creá una cuenta de padre con
   datos ficticios) y explicar en las notas que las cuentas las asigna la empresa.
7. Subir el AAB:
   ```bash
   cd transporte-movil
   eas build --platform android --profile production
   eas submit --platform android --latest
   ```
8. Publicar primero en **prueba cerrada** (y si la cuenta es personal, dejar
   correr los 14 días con 12 testers), después promover a producción.

---

## 4. App Store, paso a paso

> **El riesgo real está acá.** La guía **4.3** de App Review rechaza
> habitualmente apps que solo le sirven a los clientes o empleados de una
> empresa, y deriva a *Apple Business Manager* (apps a medida). No es seguro que
> pase, pero preparate para esa respuesta.
>
> **Cómo bajar el riesgo:** en las notas para el revisor, explicá en inglés que
> es la app operativa de una empresa de transporte escolar real de La Ceiba,
> Honduras, que los padres reciben su cuenta al contratar el servicio, y dale
> credenciales de prueba que funcionen. Si aun así la rechazan por 4.3, el camino
> es **Apple Business Manager** (distribución privada a la empresa), que además
> es lo que técnicamente mejor encaja.

1. En App Store Connect, crear la app con el bundle `com.derekperez.transporteperez`.
2. **Privacidad de la app** ("App Privacy"): mismo contenido que la tabla del
   punto 5, más la URL de la política.
3. **Capturas obligatorias** para iPhone 6.7" y 6.5" (se pueden generar desde un
   simulador o pedirle a alguien con iPhone).
4. Compilar y subir:
   ```bash
   cd transporte-movil
   eas build --platform ios --profile production
   eas submit --platform ios --latest
   ```
   EAS compila iOS **en la nube**: no hace falta una Mac. Sí hace falta la cuenta
   de Apple pagada, porque firma con tus certificados.
5. Repartir primero por **TestFlight** (no pasa por revisión pública completa) y
   recién después enviar a revisión.

---

## 5. Qué declarar en los formularios de datos

Los dos formularios preguntan lo mismo con otras palabras. Esto es lo que la app
realmente hace:

| Dato | ¿Se recoge? | Para qué | ¿Vinculado a la persona? |
| --- | --- | --- | --- |
| Nombre | Sí | Funcionamiento de la app | Sí |
| Correo | Sí | Inicio de sesión | Sí |
| Teléfono | Sí | Llamada directa padre ↔ conductor | Sí |
| Fotos | Sí (opcional) | Reconocer a la persona y al niño | Sí |
| Ubicación precisa | Sí (solo del conductor, en viaje) | Mostrar el bus en el mapa del padre | Sí |
| Mensajes | Sí | Comunicación dentro de la empresa | Sí |
| Identificadores (token de notificación) | Sí | Enviar avisos | Sí |
| Publicidad / analítica / rastreo | **No** | — | — |

En las dos tiendas: **no** se usa para publicidad, **no** se vende, **no** hay
rastreo entre apps. Y marcá que ofrecés **eliminación de cuenta** (Play lo exige):
la vía está explicada en `/privacidad`.

---

## 6. Lo que todavía falta preparar

- [ ] Ícono de tienda 512×512 y gráfico destacado 1024×500 (Android).
- [ ] Capturas de pantalla de las dos plataformas.
- [ ] Descripción corta y larga de la ficha.
- [ ] Cuenta de prueba (padre) con datos ficticios para los revisores.
- [ ] Video corto de la función de ubicación (Play).
- [ ] Revisar la política de privacidad y confirmar el correo de contacto.
- [ ] Decidir si la cuenta de Play es personal (14 días de prueba cerrada) o de
      empresa (D-U-N-S).

---

## 7. Textos de la ficha, listos para copiar

### Nombre y categoría

- **Nombre** (Play, máx. 30): `Transportes Perez`
- **Subtítulo** (App Store, máx. 30): `Transporte escolar en vivo`
- **Categoría sugerida:** *Mapas y navegación* (alternativa: *Educación*).
- **Clasificación de contenido:** apta para todo público. No hay violencia,
  compras ni contenido generado por usuarios que sea público.

⚠️ **Público objetivo: ADULTOS.** En el cuestionario de Play hay que declarar que
la app **no está dirigida a niños**. Es cierto —la usan padres, conductores y la
administración; los niños no tienen cuenta— y es importante: si se declara que
apunta a menores, la app entra en el programa *Familias* de Google, con
requisitos mucho más estrictos. Que la app *hable* de niños no la hace una app
*para* niños.

### Descripción corta (Play, máx. 80)

```
Seguí el bus escolar de tus hijos en tiempo real.
```

### Descripción larga

```
Transportes Perez es la aplicación de Inversiones Perez, empresa de transporte
estudiantil que opera en La Ceiba, El Porvenir, El Pino y La Unión.

Es una herramienta para las familias y los conductores de la empresa: las
cuentas las crea la administración al contratar el servicio. No hay registro
público.

PARA LOS PADRES
• Ver en el mapa, en vivo, el bus que lleva a su hijo.
• Recibir un aviso cuando el niño sube al bus y cuando baja.
• Recibir un aviso cuando el bus se acerca a su parada.
• Saber quién maneja hoy, con su foto, la placa de la unidad y su teléfono.
• Avisar que el niño hoy no viaja, o que se lo recoge en otro lugar.
• Escribirle al conductor o a la administración.

PARA LOS CONDUCTORES
• La lista de niños de su ruta, en el orden del recorrido.
• Marcar quién subió y quién bajó, incluso sin señal: las marcas se guardan y se
  envían solas al recuperar la conexión.
• El mapa del recorrido con la siguiente parada.
• Avisar una novedad (tráfico, lluvia, problema con la unidad) a los padres de
  los niños que van a bordo.

PRIVACIDAD
La ubicación se comparte únicamente desde el teléfono del conductor y solo
mientras hay un viaje en curso; al terminarlo deja de transmitirse. Cada padre
ve solamente a sus propios hijos. No hay publicidad ni rastreadores.

Política de privacidad: https://transporte-perez.web.app/privacidad
```

### Notas para el revisor

Van en *App Review Information* (Apple) y en *Acceso a la app* (Play). Son lo que
baja el riesgo de rechazo por la guía 4.3 de Apple.

**Para Apple (en inglés):**

```
This is the operational app of Inversiones Perez, a real school transport
company in La Ceiba, Honduras. Parents and drivers receive their accounts from
the company when they sign up for the service, so there is no public
registration by design.

Test account (parent role):
  email: <correo de prueba>
  password: <contraseña de prueba>

What you can see with it: the child's status, the live map of the bus during a
trip, announcements from the school, and the in-app chat. Location is only
transmitted from a driver's device while a trip is active.

Privacy policy: https://transporte-perez.web.app/privacidad
```

**Para Play (en español):** lo mismo, más el aviso de que la app usa un servicio
en primer plano con ubicación, con el video de demostración que pide el
formulario.

⚠️ **La cuenta de prueba tiene que existir y funcionar el día de la revisión.**
Creá un padre con datos ficticios desde el panel, con un niño y una ruta
asignados; si el revisor entra y no ve nada, rechazan la app.
