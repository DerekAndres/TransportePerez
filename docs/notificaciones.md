# Notificaciones push — qué falta para que funcionen

> Estado a hoy (2026-08-19): **el código está completo** y cubre todos los
> avisos (asistencia, proximidad, mensajes y comunicados de canal), en los dos
> sentidos y desde las dos apps. Falta configuración que solo puede hacer Derek
> (pide iniciar sesión en Expo y en Firebase). El paso 1 ya está hecho.

---

## Todo esto llega con la app CERRADA

Es la parte que más importa y conviene entender por qué funciona, porque es lo
primero que va a preguntar el jurado.

Un aviso **no lo muestra la app**: lo muestra el **sistema operativo**. El
recorrido es siempre el mismo:

```
app que hace la acción  →  API de Expo Push  →  FCM (Google)  →  Android  →  aviso en pantalla
```

Android recibe el mensaje aunque la app esté cerrada y lo dibuja él mismo. La
app del que recibe **no participa** — ni siquiera necesita estar corriendo. Dos
cosas del código lo garantizan:

- `priority: "high"` en cada envío, que le pide a Android despertar el teléfono
  en vez de guardar el aviso para más tarde;
- el canal `default` creado con `AndroidImportance.MAX`, que es lo que permite
  que suene y se muestre encima.

**Quien sí tiene que tener la app abierta es el que ENVÍA**, porque el envío sale
de su teléfono (no hay servidor propio: es la decisión de arquitectura del plan
gratuito). En la práctica eso siempre se cumple, porque enviar es una acción
manual: el conductor está marcando asistencia, el padre está escribiendo un
mensaje, el admin está publicando un aviso. Y desde el panel web también se
envía (ver más abajo).

> **La única excepción real:** si el usuario entra a Ajustes de Android y le da
> **"Forzar detención"** a la app, Android bloquea la entrega hasta que la vuelva
> a abrir. Es una restricción del sistema operativo, no del código, y le pasa
> igual a WhatsApp. Cerrar la app deslizándola de recientes **no** cuenta: ahí
> los avisos siguen llegando.

### Si el bus se queda sin señal

El aviso lo manda el teléfono del conductor, y en El Porvenir y El Pino perder
cobertura es lo normal. Para eso está la **cola de avisos pendientes**: un envío
que falla se guarda en el teléfono (`AsyncStorage`, así sobrevive a que se cierre
la app) y se reintenta solo al recuperar la conexión — al abrir la app o en el
siguiente marcado de asistencia, que es cuando se sabe que hay señal porque la
escritura a Firestore funcionó. Los avisos vencen a las 3 horas: al padre no le
sirve enterarse a las 6 de la tarde de que su hijo subió al bus a las 6 de la
mañana.

### Al tocar el aviso

La notificación lleva en su campo `data` a qué pantalla ir, y la app salta
directo ahí — al chat de quien escribió, al canal del comunicado, o a "Mis
hijos". Funciona también cuando la app estaba completamente cerrada y se abrió
justo por tocar el aviso (`useLastNotificationResponse`, en
`hooks/use-navegacion-notificacion.ts`).

---

## Qué falta configurar

| # | Qué falta | Síntoma si falta |
| --- | --- | --- |
| 1 | ~~`eas init` — vincular la app con Expo~~ | ✅ **Ya hecho** (`projectId` está en `app.json`) |
| 2 | Subir las credenciales de FCM a EAS | El envío se rechaza con `InvalidCredentials` |
| 3 | Instalar el **APK** (no Expo Go) | Expo Go en Android no recibe push remotas desde el SDK 53 |

La app ya avisa en cuál está trabada: **Configuración → Notificaciones**
muestra el estado y tiene un botón **"Enviar una notificación de prueba"** que
dice el motivo exacto del rechazo.

---

## Paso 2 — Credenciales de Firebase Cloud Messaging

En Android, Expo entrega las notificaciones **a través de FCM**. El
`google-services.json` que ya está en el repo cubre solo el lado del teléfono;
el servidor de Expo necesita además una clave de cuenta de servicio.

1. Firebase Console → ⚙️ **Configuración del proyecto** → pestaña **Cloud Messaging**.
2. En *Firebase Cloud Messaging API (V1)* → **Administrar cuentas de servicio** →
   **Generar nueva clave privada**. Se descarga un `.json`.
3. Subilo a EAS:

```bash
cd transporte-movil
eas credentials
# → Android → production (o el perfil que uses) → Push Notifications
# → subir el .json descargado
```

> ⚠️ Ese `.json` es una credencial: **no lo commitees**. Guardalo fuera del repo.

---

## Paso 3 — Compilar e instalar el APK

```bash
cd transporte-movil
eas build --platform android --profile preview
```

Al terminar, EAS imprime un enlace de descarga. Instalalo en el teléfono
(Android va a pedir permiso para "instalar de orígenes desconocidos").

Para publicar ese enlace a los padres, pegalo en
`transporte-web/public/descargar.html` reemplazando
`var ENLACE_APK = "PENDIENTE";`, y volvé a publicar la web:

```bash
cd transporte-web && npm run build && cd ..
firebase deploy --only hosting
```

---

## Cómo comprobar que quedó andando

1. Abrí la app y aceptá el permiso de notificaciones cuando lo pida.
2. Entrá a **Configuración**. Arriba de "Cuenta" hay una tarjeta
   **Notificaciones**: tiene que decir *"Vas a recibir los avisos aunque tengas
   la app cerrada."*
3. Tocá **"Enviar una notificación de prueba"**. Debería llegarte el aviso en
   unos segundos, incluso con la app cerrada.
4. Si no llega, el mismo botón dice por qué:
   - *"faltan las credenciales de Firebase Cloud Messaging"* → paso 2.
   - *"El token guardado ya no es válido"* → cerrá sesión y volvé a entrar.
   - *"Expo Go en Android no recibe notificaciones remotas"* → paso 3.

Recién cuando la prueba llega tiene sentido probar el circuito real: el
conductor marca "Subió" y al padre le entra el aviso.

---

## Qué avisos manda la app (ya está todo programado)

| Cuándo | A quién | Texto | Sale de |
| --- | --- | --- | --- |
| El conductor marca **Subió** | Al padre del niño | "Ana subió al bus — Va en camino a la escuela" | App conductor |
| El conductor marca **Bajó** | Al padre del niño | "Ana llegó a la escuela — Bajó del bus a las 7:12" | App conductor |
| El bus se acerca a **menos de 400 m** de la casa | Al padre | "El bus está cerca" (una sola vez por niño y viaje; hermanos en un solo aviso) | App conductor |
| Entrega en un **punto de transbordo** | Al padre | "Ana sigue en camino" (neutro: el transbordo es invisible para el padre) | App conductor |
| Alguien manda un **mensaje** de chat | Al destinatario | El nombre de quien escribe y el texto recortado | App móvil **y panel web** |
| El admin publica un **aviso de canal** | A **todos** los padres de esa escuela | El nombre del canal y el texto recortado | App admin **y panel web** |

Todo sale de la app que hace la acción, con un POST directo a
`https://exp.host/--/api/v2/push/send`. Sin backend, sin Cloud Functions y sin
salir del plan gratuito de Firebase.

Los avisos de canal se mandan **en lote** (un solo POST con hasta 100 mensajes),
así publicar para una escuela entera es una sola petición y no ochenta. Quién lo
recibe se **deriva** de los niños activos de esa escuela — no hay lista de
suscriptores que mantener.

### Por qué el panel web también puede enviar

El servidor de Expo no devuelve la cabecera `Access-Control-Allow-Origin`, así
que un `fetch` normal desde el navegador se cancela por CORS. Por eso, antes, un
mensaje o un aviso escrito desde la web no le llegaba a nadie al teléfono.

La vuelta: CORS considera "seguros" tres tipos de contenido que **no** disparan
la petición previa de permiso (*preflight*), y uno es `text/plain`. La API de
Expo parsea el cuerpo como JSON aunque se declare así (comprobado contra el
servidor real), de modo que el POST sale de verdad. Se combina con
`mode: "no-cors"` para que el navegador no marque error al no poder leer la
respuesta.

El precio es que **desde la web se envía a ciegas**: no se puede leer si Expo
aceptó cada token. Es aceptable, porque el dato importante (el mensaje, el
aviso) ya quedó guardado en Firestore y el padre lo ve igual al abrir la app; el
push es un extra. La limpieza de tokens muertos la sigue haciendo la app móvil,
que sí lee la respuesta. Está todo en
`transporte-web/src/services/notificacionesService.ts`.

> Nota: un padre solo recibe avisos si **abrió la app al menos una vez** y
> aceptó el permiso (ahí se guarda su token en `usuarios/{uid}.expoPushToken`).
> Si no tiene token, no se le envía nada — pero el mensaje o el aviso igual
> queda guardado y lo ve cuando entre.
