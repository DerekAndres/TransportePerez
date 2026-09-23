# Evidencias para la presentación final — guion de captura

> Las 7 evidencias que faltan, ordenadas para sacarlas **en una sola sesión**.
> Un solo viaje de prueba con transbordo produce las evidencias 1, 2, 3, 4 y 7;
> la 5 y la 6 salen del mismo día.

---

## 0. Antes de la sesión (sin esto, las fotos no salen)

Revisado el 2026-09-17:

| Qué | Estado | Por qué importa |
| --- | --- | --- |
| Código de push, transbordo, historial y CSV | ✅ Completo y compila | — |
| CSV legible en Excel | ✅ **Arreglado hoy** | Salía todo en la columna A (Windows es-HN usa `;`). Probado en el Excel de esta computadora: 8 columnas y acentos bien |
| Seed con padre real | ✅ **Agregado hoy** | Antes los niños de prueba quedaban con un padre ficticio sin teléfono: **ningún aviso le podía llegar a nadie** |
| Commit de los cambios | ⏳ Pendiente | Hay archivos que la app usa y ni siquiera están en git (`HojaInferior.tsx`, `HojaNovedad.tsx`) |
| Credenciales FCM V1 en EAS | ❓ Sin confirmar | Sin esto **el push no llega nunca** (evidencia 1) |
| APK nuevo | ✅ **Compilado el 17/09** | Descargalo desde `https://transporte-perez.web.app/descargar`. **El enlace vence el 01/10**: guardá una copia del `.apk` |
| Reglas v2 + panel publicados | ✅ **Publicados el 17/09** | Verificado online: versión nueva, cabeceras de seguridad y enlace del APK |

**Orden (detalle en `docs/despliegue.md`):**

1. Commit de todo.
2. Subir la clave FCM V1: `cd transporte-movil` → `eas credentials` → Android →
   Push Notifications (FCM V1). Es interactivo: lo tenés que correr vos.
3. `eas build -p android --profile preview` → instalar el APK en **los dos
   teléfonos**, y guardar una copia del `.apk` en la computadora.
4. `cd transporte-web && npm run build && cd ..` →
   `firebase deploy --only firestore:rules,hosting`.
5. Pegar el enlace nuevo del APK en `transporte-web/public/descargar.js` y volver
   a publicar el hosting.
6. **Prueba de semáforo:** en el teléfono del padre → Configuración →
   Notificaciones → **"Enviar una notificación de prueba"**. Si dice
   "faltan las credenciales", volvé al paso 2. **No arranques la sesión hasta que
   esta prueba llegue con la app cerrada.**

---

## 1. Preparación (15 min, en el panel web)

Necesitás **dos teléfonos**: el del conductor y el del padre. La evidencia 1
exige que la app del padre esté **cerrada** mientras el conductor marca, así que
con uno solo no se puede mostrar honestamente.

1. En el panel, tener: **2 cuentas de conductor** y **1 cuenta de padre real**
   (tu correo o el de un familiar), sin otros buses asignados.
2. En el teléfono del padre: iniciar sesión **una vez**, aceptar notificaciones,
   hacer la prueba de semáforo (paso 6) y **cerrar la app** deslizándola desde
   recientes.
3. Panel → Herramientas → **Datos de prueba**: elegir los dos conductores y, en
   **"Padre de los niños"**, al padre real → Cargar.
   ⚠️ Las rutas se crean **en el turno de la hora actual** (antes de las 12:00 =
   mañana). Cargá los datos en el mismo turno en que vas a hacer el viaje; si no,
   borralos y volvé a cargarlos.

El seed crea dos rutas: **Norte (prueba)** en el bus PRU-001 (Juan, María, Ana y
**Pedro**) y **Centro (prueba)** en el PRU-002 (Luis y **Pedro**). Pedro hace
transbordo en **Plaza Cabotaje (prueba)**.

---

## 2. La sesión: un viaje con transbordo

El teléfono del conductor puede ser uno solo, cambiando de sesión: el bus B
arma su lista de recepción leyendo lo que dejó guardado el bus A.

### Conductor A (bus PRU-001)

| Paso | Qué hacer | 📸 Captura |
| --- | --- | --- |
| A1 | Iniciar viaje | — |
| A2 | Marcar **Subió** a Pedro | **EVIDENCIA 1** en el teléfono del padre (ver abajo) |
| A3 | Marcar Subió a Juan, María y Ana | Foto del conductor marcando (**EVIDENCIA 7**) |
| A4 | Botón **"Transbordo en Plaza Cabotaje"** → entregar a Pedro | **EVIDENCIA 2a**: pantalla "Entrego acá" con Pedro marcado |
| A5 | Marcar Bajó a los tres en la escuela → **Finalizar viaje** | — |

### Conductor B (bus PRU-002)

| Paso | Qué hacer | 📸 Captura |
| --- | --- | --- |
| B1 | Cerrar sesión de A, entrar como B, iniciar viaje | — |
| B2 | Abrir Transbordo | **EVIDENCIA 2b**: Pedro **ya aparece solo** en la lista de recepción, sin que nadie lo cargue. Es la captura que demuestra la mecánica: *quien recibe confirma una lista que se llena sola* |
| B3 | Confirmar a Pedro; Subió a Luis | — |
| B4 | Bajó a los dos → **Finalizar viaje** | — |

### EVIDENCIA 1 — el aviso con la app cerrada

En el teléfono del padre, **antes** del paso A2: app cerrada (deslizada desde
recientes) y **pantalla bloqueada**. Cuando el conductor marque "Subió":

- 📸 **Pantalla de bloqueo** con "Pedro López subió al bus — Va en camino a la
  escuela". Captura en Android: botón de encendido + bajar volumen.
- 📸 Desbloquear y bajar la **barra de notificaciones** (se ve el ícono de la app
  y la hora).
- 📸 (Opcional, suma mucho) **Recientes vacío** en ese mismo teléfono, para que
  se vea que la app no estaba abierta.
- Tocar el aviso: abre directo en "Mis hijos". Vale un video corto de 10 s.

El mismo teléfono recibe después el resto del viaje de Pedro. Con las tres
capturas juntas se ve el circuito completo:

- **A4** → "Pedro López sigue en camino". 📸 Vale capturarlo: el padre **no se
  entera de que cambió de bus**, que es el principio de diseño del transbordo
  (es invisible para el padre).
- **B4** → "Pedro López llegó a la escuela · Bajó del bus a las H:mm".

(Los cinco niños quedan a nombre del mismo padre, así que también le llegan los
avisos de Juan, María, Ana y Luis. Es normal.)

---

## 3. Después del viaje (en la computadora)

### EVIDENCIA 3 — un viaje real terminado

- 📸 Panel → **Supervisión** → abrir el viaje finalizado de Norte (prueba):
  detalle con hora de inicio y fin, el mapa de **"Recorrido realizado"** y la
  línea de tiempo **"Movimientos"**, con la hora exacta de cada subida y bajada.
  Tomá también el viaje de Centro (prueba): ahí Pedro aparece subiendo en Plaza
  Cabotaje.
- 📸 En el teléfono del padre: Pedro → **Historial**, con sus eventos del día y
  sus horas. Muestra que el mismo dato llega a los dos lados.

> Para que el recorrido dibuje una línea, el conductor tiene que **moverse**
> durante el viaje: se guarda un punto por minuto. Con el teléfono quieto en un
> escritorio sale un solo punto.

### EVIDENCIA 4 — CSV abierto en Excel

1. Panel → **Reportes** → pestaña **Viajes** → rango de hoy → Exportar CSV.
2. Abrirlo con doble clic en Excel.
3. 📸 Excel mostrando las columnas (Fecha, Ruta, Conductor, Bus, Estado, Inicio,
   Fin, Niños transportados) **con el nombre del archivo visible en la barra de
   título**. Deberían verse los 2 viajes: 4 niños y 2 niños.
4. (Opcional) Pestaña **Por niño** → Pedro López → Exportar: se ve su subida en
   un bus y su bajada en el otro.

### EVIDENCIA 5 — despliegue

- 📸 Navegador con **`https://transporte-perez.web.app`** en la barra de
  direcciones y el panel adentro (Dashboard con datos). Que se vea el candado.
- 📸 (Suma) `https://transporte-perez.web.app/descargar` con el botón del APK.
- 📸 **Pantalla de inicio del teléfono** con el ícono de la app. Con el APK nuevo
  dice "Transportes Perez"; el viejo decía "transporte-movil".

### EVIDENCIA 6 — consumo de Firebase

**Al día siguiente** (la consola tarda hasta unas horas en reflejar el uso):

1. console.firebase.google.com → proyecto transporte-perez → **Firestore
   Database** → pestaña **Uso**.
2. 📸 Gráfico de **lecturas, escrituras y eliminaciones** del día del viaje, con
   el período elegido visible.
3. 📸 (Suma) **Uso y facturación** mostrando el plan **Spark** (costo $0).

Para la diapositiva conviene ponerlo **al lado** de lo que calculaste en la
volumetría: el GPS escribe ~240 veces por hora de viaje en `ubicaciones` y ~60 en
`recorridos`, por bus. Si un viaje de 20 minutos dio del orden de 100
escrituras de GPS, el cálculo queda validado con un dato medido.

### EVIDENCIA 7 — el sistema en uso

- 📸 El teléfono en el soporte del bus con la pantalla "Mi ruta de hoy" encendida,
  o la mano del conductor tocando "Subió".
- ⚠️ **Sin caras de niños** y sin nombres reales legibles, salvo autorización
  escrita de los padres: son menores y el jurado lo va a notar. El teléfono en
  primer plano con el interior del bus desenfocado alcanza.

---

## 4. Al terminar

- Panel → Datos de prueba → **Borrar datos de prueba**: se van los niños (también
  los que quedaron a nombre del padre real), las rutas, los viajes y los
  registros. El padre y los conductores reales no se tocan.
  ⚠️ **Borralo DESPUÉS de sacar las capturas 3, 4 y 6**: el historial y el
  reporte se van con los datos.

## Checklist para la presentación

- [ ] 1 · Aviso en la pantalla de bloqueo + barra de notificaciones
- [ ] 2 · Transbordo: pantalla de quien entrega + la de quien recibe
- [ ] 3 · Viaje terminado: detalle en Supervisión + historial del padre
- [ ] 4 · CSV abierto en Excel
- [ ] 5 · Panel con la URL visible + ícono del APK en el teléfono
- [ ] 6 · Consola de Firebase con lecturas y escrituras
- [ ] 7 · Foto del sistema en uso
