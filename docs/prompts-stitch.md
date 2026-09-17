# Briefing para Stitch — app de transporte escolar

> **Qué es esto.** La descripción funcional del sistema para que una herramienta
> de diseño con IA (Stitch, u otra) proponga una interfaz **desde cero**.
>
> **Acá no hay ni un color, ni una medida, ni una disposición de pantalla a
> propósito.** Si se le dice cómo tiene que verse, lo único que puede hacer es
> copiar lo que ya existe, y entonces no sirve para comparar. Lo que sí hay es
> qué resuelve el sistema, quién lo usa y en qué condiciones — que es lo que un
> diseñador necesita para proponer algo bueno.
>
> **Cómo usarlo:** pegá primero la sección 1 (la idea) y la sección 3 (los
> usuarios). Después pedí una pantalla por vez con su bloque de la sección 4.
> Cerrá siempre con: *"Decidí vos la estética, la paleta y la disposición."*

---

## 1. La idea

> Una aplicación móvil para una **empresa de transporte escolar** que lleva y
> trae niños entre sus casas y sus colegios, en La Ceiba, Honduras.
>
> El problema que resuelve: hoy los padres **no saben dónde va el bus** ni si su
> hijo subió. Llaman por teléfono al conductor mientras maneja. Cuando un niño
> se queda sin recoger, nadie tiene registro de qué pasó y la discusión termina
> en "el bus nunca vino" contra "esperamos y no había nadie".
>
> La app da tres cosas: el padre ve el bus en un mapa en vivo y recibe un aviso
> cuando su hijo sube y cuando baja; el conductor marca la asistencia con el bus
> detenido, sin escribir nada; y el dueño ve todo lo que pasa en el día y queda
> un registro de cada viaje.

---

## 2. El contexto real (esto sí condiciona el diseño)

No son preferencias estéticas: son las condiciones en las que la app se usa, y
un diseño que las ignore está mal aunque se vea lindo.

- **La empresa opera en la costa caribeña de Honduras.** Municipios: La Ceiba,
  El Porvenir, El Pino y La Unión.
- **El conductor usa el teléfono de pie, con el bus detenido, a pleno sol**, con
  niños subiendo y treinta segundos por parada. No puede leer textos largos ni
  apuntarle a controles chicos.
- **La cobertura celular se corta** en las zonas rurales de la ruta.
- **Los padres son un grupo muy diverso**, con teléfonos de gama baja y planes de
  datos limitados. No se les puede pedir que aprendan nada.
- **Nadie se registra solo.** Todas las cuentas las crea la empresa: no existe
  pantalla de "crear cuenta".
- Los viajes ocurren en dos turnos: **mañana** (casa → escuela) y **tarde**
  (escuela → casa).

---

## 3. Los tres usuarios

### El PADRE — el más numeroso
Abre la app diez segundos, dos veces al día, para saber si su hijo está bien.
La mayor parte del tiempo **no entra**: recibe avisos. Puede tener uno o varios
hijos, en escuelas distintas y turnos distintos.

### El CONDUCTOR — el más exigente
Maneja un bus con veinte niños. Usa la app dos veces al día, siempre apurado.
Solo hace tres cosas: iniciar el viaje, marcar quién sube y quién baja, y
finalizarlo. No configura nada.

### El ADMINISTRADOR — la dueña de la empresa
Usa una computadora para todo lo pesado (dar de alta niños, armar rutas). En el
teléfono solo quiere vigilar cómo va el día y responder mensajes cuando está en
la calle.

---

## 4. Pantallas: qué tiene que permitir cada una

> Cada bloque dice **qué necesita el usuario**, no cómo se ve. Terminá cada
> pedido con: *"Decidí vos la estética, la paleta y la disposición."*

### 4.1 Inicio del PADRE

```
Diseñá la pantalla principal de una app de transporte escolar, para el padre.

Lo que necesita saber al abrirla, por orden de importancia:
1. Si el bus de su hijo está viajando AHORA y por dónde va (ubicación en vivo).
2. En qué estado está cada hijo: en casa, arriba del bus, ya entregado, o no
   estaba en la parada cuando el bus pasó.
3. A qué hora subió y hacia dónde va (a la escuela o de vuelta a casa).
4. Si la escuela publicó algún comunicado.

Lo que necesita poder hacer sin buscar:
- Avisar que hoy su hijo no va a usar el bus (por ejemplo, está enfermo).
- Escribirle al conductor o a la administración.
- Ver el historial de viajes de un hijo.

Consideraciones: puede tener uno o varios hijos, y lo habitual es que solo uno
esté viajando en ese momento. Cuando no hay ningún viaje en curso, la pantalla
tiene que seguir teniendo sentido. El padre no debe necesitar aprender nada ni
configurar nada.

Decidí vos la estética, la paleta y la disposición.
```

### 4.2 Seguimiento del bus en vivo

```
Diseñá una pantalla donde un padre sigue en un mapa el bus escolar en el que
viaja su hijo.

Tiene que mostrar dónde está el bus, dónde está la parada de su hijo, y si la
señal del bus está llegando o se cortó (en las rutas rurales se pierde
cobertura seguido). También la hora en que el niño subió y hacia dónde va.

El padre solo mira: no hay nada que configurar acá.

Decidí vos la estética, la paleta y la disposición.
```

### 4.3 Trámites del PADRE

```
Diseñá la pantalla desde donde un padre hace trámites con la empresa de
transporte escolar.

Hay cinco trámites, y el problema real es que se parecen entre sí: la pantalla
tiene que dejar clarísimo cuál corresponde en cada caso, porque elegir mal hace
que el padre espere una respuesta que no le sirve.

1. Avisar que su hijo no viaja un día puntual (está enfermo, viaje familiar).
   Este NO necesita aprobación: sirve el mismo día, de inmediato.
2. Cambiar dónde se recoge o se entrega a su hijo (una mudanza, o solo por un
   día).
3. Cambiar a su hijo de escuela.
4. Cambiar el turno: si usa el bus de ida, de vuelta, o las dos veces.
5. Inscribir a un hijo nuevo en el transporte.

Los cuatro últimos los tiene que aprobar la administración, así que la pantalla
también debe mostrar el estado de lo que ya envió (esperando respuesta,
aprobado, rechazado).

Decidí vos la estética, la paleta y la disposición.
```

### 4.4 Historial de un hijo

```
Diseñá la pantalla donde un padre revisa los viajes de su hijo de los últimos
días.

Para cada día tiene que ver a qué hora subió al bus, a qué hora bajó, y en qué
ruta. También los días en que el bus pasó y el niño no estaba en la parada, que
es la información que más le importa revisar.

Decidí vos la estética, la paleta y la disposición.
```

### 4.5 La pantalla del CONDUCTOR

```
Diseñá la pantalla principal de la app de un conductor de bus escolar.

CONDICIONES DE USO, que mandan sobre todo lo demás: la usa de pie, con el bus
detenido, a pleno sol, con niños subiendo y unos treinta segundos por parada.
Todo tiene que tocarse rápido y sin mirar. No configura nada.

Lo que necesita ver:
- Qué ruta le toca hoy y en qué unidad.
- La lista de niños que tiene que recoger, AGRUPADOS POR PARADA, en el orden en
  que va a pasar por ellas.
- Cuántos lleva arriba y cuántos ya entregó.
- Si el teléfono está mandando la ubicación correctamente.
- Un aviso destacado sobre los niños que hoy no viajan porque el padre avisó, y
  sobre los que hoy se recogen en otra dirección.

Lo que necesita poder hacer:
- Iniciar el viaje y finalizarlo (la acción más importante de la pantalla).
- Marcar que un niño subió — y poder marcar de una vez a todos los de una
  parada, porque es lo que pasa el 90 % de las veces.
- Marcar que un niño NO ESTABA en la parada, que es un caso serio y deja
  constancia.
- Deshacer una marca hecha por error (marcar al hermano equivocado con el bus
  andando pasa seguido).

Decidí vos la estética, la paleta y la disposición.
```

### 4.6 Monitoreo del ADMINISTRADOR

```
Diseñá una pantalla de monitoreo para la dueña de una empresa de transporte
escolar, en su teléfono, para usar mientras está fuera de la oficina.

Necesita saber, de un vistazo:
- Cuántas rutas salieron hoy, cuántas terminaron y cuántas todavía no salieron.
- Por cada ruta: el turno, la unidad, cuántos niños lleva, a qué hora salió,
  cuántos subieron y cuántos ya fueron entregados.
- Si el bus está mandando su ubicación o se quedó sin señal.
- Si hay niños que hoy quedaron sin recoger.
- Si hay solicitudes de padres esperando respuesta.

Desde cada ruta tiene que poder escribirle o llamar al conductor.

Decidí vos la estética, la paleta y la disposición.
```

### 4.7 Entrada a la app

```
Diseñá la pantalla de inicio de sesión de una app de transporte escolar de una
empresa familiar de la costa caribeña de Honduras.

Se entra con correo y contraseña. NO hay opción de crear una cuenta: las
cuentas las crea la empresa y el usuario recibe un correo para definir su
contraseña. La pantalla tiene que explicar eso a quien entra por primera vez.

Es la primera pantalla que ve cualquiera, así que es donde la empresa se
presenta.

Decidí vos la estética, la paleta y la disposición.
```

---

## 5. Funciones completas del sistema

Por si Stitch pide el alcance total, o para pedirle pantallas que acá no están.

**Padre:** ver el estado y la ubicación de cada hijo · mapa en vivo · historial
de viajes · avisos de la escuela · chat con el conductor y con la administración
· llamada directa · los cinco trámites · foto y perfil de cada hijo.

**Conductor:** ver su ruta del día · iniciar y finalizar viaje · marcar subida y
bajada · marcar ausencia · deshacer · ver el recorrido en un mapa · **transbordo**
(entregar niños a otro bus en un punto intermedio y recibir los de otro) · chat.

**Administrador:** dar de alta conductores, padres, buses, escuelas, puntos de
transbordo y niños · armar rutas sobre un mapa · aprobar o rechazar solicitudes
· publicar comunicados por escuela · ver todos los buses en viaje a la vez ·
reportes de viajes y de asistencia · chat con cualquiera.

**Del sistema:** avisos al teléfono cuando el niño sube, cuando baja y cuando el
bus se está acercando a su parada.

---

## 6. Qué NO decirle

Para que la propuesta sea de verdad nueva:

- **No le des colores, tipografías ni medidas.** Es exactamente lo que se le
  está pidiendo que invente.
- **No le describas la app actual.** Si le decís "mapa arriba y accesos abajo",
  va a devolver eso.
- **No le pidas varias pantallas juntas.** Mezcla los elementos y ninguna queda
  bien.
- **Sí insistí en las condiciones de uso** (sol, apuro, teléfonos de gama baja,
  padres que no deben aprender nada). Eso no es estética: es el problema a
  resolver, y es lo que separa una propuesta seria de una bonita.

---

## 7. Para el informe

Guardá las capturas. Para el capítulo de diseño, **mostrar alternativas
descartadas y explicar por qué** vale más que mostrar solo el resultado final:
demuestra que hubo criterio y no una sola idea.

Cuando compares lo que devuelva Stitch con lo construido, las preguntas útiles
son siempre las mismas:

- ¿Los botones del conductor se tocan sin mirar y a pleno sol?
- ¿El padre entiende la pantalla sin que nadie se la explique?
- ¿Qué pasa cuando no hay ningún viaje en curso? ¿Y cuando hay tres hijos en
  estados distintos?
- ¿Dónde aparece que un niño no estaba en la parada?

Una propuesta que se ve mejor pero falla en esas cuatro no es mejor. Y decir eso
con argumentos, en la defensa, vale más que la maqueta.
