# Alta de conductores y padres

> Registro **cerrado**: no hay ninguna pantalla de registro público. Todas las
> cuentas las crea el administrador desde el panel web.

---

## 1. El flujo

1. El padre (o conductor) le da **su correo** a la administración.
2. El admin entra al panel → **Padres** o **Conductores** → *Nuevo* → carga
   nombre, teléfono y ese correo.
3. El sistema:
   - crea la cuenta en Firebase Authentication con una contraseña aleatoria que
     **nadie ve**;
   - marca al usuario con `debeCompletarPerfil: true`;
   - pide a Firebase que le envíe el **correo para definir su contraseña**.
4. El usuario abre ese correo, toca el enlace y define su contraseña en la página
   de Firebase.
5. Abre la app e **inicia sesión** con su correo y esa contraseña.
6. La primera vez, la app lo lleva a **Completá tu perfil**: confirma su nombre y
   carga su **teléfono** y su **foto**. No puede entrar a la app hasta terminarlo.
7. Listo. Desde ahí entra siempre por *Iniciar sesión*.

En la lista de usuarios del panel, cada persona aparece como **«Pendiente»**
(naranja, todavía no entró a la app) o **«Activo»** (verde).

---

## 2. Por qué hay un paso de "completar perfil"

El enlace de Firebase solo sirve para definir la contraseña: no puede pedir el
teléfono ni la foto. Y esos dos datos importan de verdad:

- el **teléfono** es lo que usa el conductor para llamar al padre desde el chat;
- la **foto** aparece en el chat y en el panel, y ayuda a identificar a la gente.

Por eso la app los pide una única vez, al primer ingreso, y no deja entrar sin
ellos. Es la forma de garantizar que ningún usuario quede a medio cargar.

---

## 3. Si el usuario no recibió el correo

En la fila de esa persona, botón **«Correo»** → reenvía el correo de Firebase
para definir la contraseña. Sirve también si el enlace venció (los de Firebase
caducan) o si el usuario olvidó su contraseña más adelante.

El usuario también puede pedirlo solo, desde **«¿Olvidaste tu contraseña?»** en
la pantalla de inicio de sesión de la app.

> Si el correo no llega, revisar la carpeta de spam. El remitente se puede
> personalizar en Firebase Console → Authentication → Templates, donde además
> conviene dejar la plantilla **en español**.

---

## 4. Por qué no se usa un código de registro

Se evaluó un flujo con "Registrarse" y un código enviado por correo. Se descartó:
mandar un correo con contenido propio exige Cloud Functions (plan Blaze, de pago)
o un servicio externo de correo, y ambas cosas están fuera del alcance del
proyecto (plan Spark, sin dependencias de terceros).

El correo de Firebase, en cambio, es gratuito, lo entrega la infraestructura de
Google y no agrega ninguna pieza al sistema. La única desventaja —que no pide
teléfono ni foto— queda resuelta con el paso de "completar perfil" descrito
arriba.

---

## 5. Qué NO hay que desplegar

Este flujo **no usa colecciones nuevas** ni cambia las reglas de Firestore: se
apoya en `usuarios`, que ya permite que cada quien edite su propio documento sin
poder cambiarse el rol.
