# Transbordo de niños entre rutas — Documento de implementación

> **Estado: BORRADOR PARA REVISAR (redactado el 2026-07-23).**
> Este documento **no existía**; lo redacté a partir de (a) los nombres de tipos que
> pediste (`TipoLugar`, `LugarRef`, `NinoEnRuta`, `Parada`, `Ruta` actualizado,
> colección `puntos`), (b) el alcance y restricciones que diste, y (c) el modelo
> **real** que quedó tras la Fase 3.5. **Antes de tocar código, revisá la sección 2
> (tipos) y la 8 (supuestos).** Si algo no coincide con lo que tenías en mente,
> corregilo acá y lo implemento fiel a eso.

---

## 0. Qué es el transbordo y contexto

**Transbordo** = un niño usa **más de un bus** para llegar a la escuela (o volver).
Ejemplo de mañana: el bus A lo recoge en su **casa** y lo deja en un **punto de
transbordo**; el bus B lo recoge en ese punto y lo lleva a la **escuela**. A la
tarde, al revés. El "punto" es el lugar físico donde el niño cambia de bus.

Hoy (Fase 3.5) un niño va **directo**: sube en su casa y baja en su escuela (o al
revés según el turno), todo en una sola ruta. El transbordo agrega la posibilidad
de que **dónde sube y dónde baja** un niño en una ruta sea un lugar cualquiera:
casa, escuela **o punto de transbordo**.

### Modelo actual relevante (verificado en el código)

- `Ruta`: `busId`, `turno` (`manana`/`tarde`), `escuelaIds: string[]`,
  **`ninoIds: string[]`** (los niños de la ruta), `nombre`, `activa`.
- `Nino`: `escuelaId`, **`parada: { nombre, lat, lng }`** (su casa), `turno`, etc.
- Colecciones: `usuarios, buses, escuelas, ninos, rutas, viajes, registros, ubicaciones, mensajes`.
- `ruta.paradas` existe en el tipo como `ParadaEnRuta[]` **legacy** pero **ningún
  archivo lo lee** (quedó muerto tras la Fase 3.5). → se puede reemplazar.
- `ruta.ninoIds` **sí se usa mucho** (ver sección 7): NO se puede quitar en esta sesión.

---

## 1. Colección `puntos` + CRUD en el panel web  *(esta sesión)*

Los **puntos de transbordo** son lugares físicos con ubicación, iguales en forma a
las escuelas. Se gestionan con un CRUD **calcado del de Escuelas**.

**Colección `puntos`** — doc: `{ nombre, lat, lng, activo }`.

**Archivos a crear (copiando el patrón de Escuelas):**

| Nuevo | Basado en |
|---|---|
| `src/services/puntosService.ts` | `escuelasService.ts` (`listar/crear/actualizar/cambiarActivo`) |
| `src/screens/PuntosScreen.tsx` | `EscuelasScreen.tsx` (tabla + modal con `MapaUbicacion`) |

**Reutiliza sin cambios:** `components/MapaUbicacion.tsx` (mapa de un marcador, ya
usado por Escuelas y por la casa del niño).

**Cableado:** enlace "Puntos" en `AppLayout.tsx` (icono `IconMapPin`), ruta en
`App.tsx`, y —opcional— card en el dashboard. La escritura ya está permitida por
las reglas actuales para admin sobre colecciones nuevas… **no**: ver sección 6
(las reglas se tocan en otra sesión; hay que agregar la de `puntos` para poder
leer/escribir — lo marco como dependencia, no lo hago acá).

> ⚠️ Igual que pasó con `escuelas` y (en su momento) `paradas`: una colección nueva
> **sin regla desplegada no se puede leer/escribir**. La regla de `puntos` es parte
> de la sesión de reglas (sección 6). Para **probar** el CRUD de puntos hará falta
> desplegar esa regla antes. Lo dejo señalado como bloqueo de prueba.

---

## 2. Tipos nuevos en el modelo compartido  *(esta sesión)*

Van en `transporte-web/src/types/models.ts` y se copian **idénticos** a
`transporte-movil/types/models.ts` (regla ya establecida).

```ts
// --- Colección: puntos (puntos de transbordo) ---
export interface Punto {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  activo: boolean;
}

// --- Tipo de lugar donde un niño sube/baja, o por donde pasa una ruta ---
export type TipoLugar = "casa" | "escuela" | "punto";

// --- Referencia a un lugar concreto ---
// El id se interpreta según el tipo:
//   "casa"    → ninoId   (la casa vive embebida en nino.parada)
//   "escuela" → escuelaId (colección escuelas)
//   "punto"   → puntoId   (colección puntos)
export interface LugarRef {
  tipo: TipoLugar;
  id: string;
}

// --- Un niño dentro de una ruta: dónde sube y dónde baja EN ESA RUTA ---
// Con transbordo, subeEn/bajaEn pueden ser un punto (no solo casa/escuela).
export interface NinoEnRuta {
  ninoId: string;
  subeEn: LugarRef;
  bajaEn: LugarRef;
}

// --- Una parada de la ruta: un lugar por el que pasa, en orden ---
export interface Parada {
  lugar: LugarRef;
  orden: number;
}
```

**`Ruta` actualizado** (aditivo — no rompe lo actual):

```ts
export interface Ruta {
  id: string;
  nombre: string;
  busId: string;
  activa: boolean;
  turno?: Turno;
  escuelaIds?: string[];
  ninoIds?: string[];        // SE CONSERVA (lo usan el builder web, el móvil y el padre)
  ninos?: NinoEnRuta[];      // NUEVO — lo genera la migración; canónico a futuro
  paradas?: Parada[];        // NUEVO shape — reemplaza al ParadaEnRuta[] legacy (que estaba muerto)
  municipio?: "La Ceiba" | "El Porvenir" | "El Pino" | "La Union";
  // se eliminan: ParadaEnRuta (legacy), horarioAM, horarioPM (en la limpieza de la migración vieja)
}
```

- Se **elimina** la interface `ParadaEnRuta` (solo la referenciaba el tipo; nadie la lee).
- `ninoIds` y `ninos` **conviven** durante la transición: hasta que el armador de
  rutas (sección 4, otra sesión) escriba `ninos` directo, `ninoIds` sigue siendo la
  fuente para el builder/móvil/padre. Ver sección 7 y el supuesto S3.

---

## 3. Página `/migracion` (solo admin)  *(esta sesión)*

Convierte las rutas del formato viejo (`ninoIds: string[]`) al nuevo
(`ninos: NinoEnRuta[]` + `paradas: Parada[]`), **sin quitar `ninoIds`**.

**Ruta y protección:** el panel web ya es **100% admin** (todo lo que cuelga del
layout exige rol admin; los demás ven "Acceso denegado"). Propongo la ruta
`/migracion` dentro de ese layout (queda admin-only automáticamente) con un enlace
discreto en el menú. *(El brief decía `/admin/migracion`; como no hay prefijo
`/admin` en el ruteo actual, uso `/migracion`. Si querés el path literal, se ajusta.)*

**Algoritmo (idempotente):**

1. Traer todas las rutas y todos los niños activos (un `getDocs` cada uno) → mapa
   `ninoId → Nino`.
2. Para cada ruta:
   - **Si ya tiene `ninos` (array)** → **saltar** (idempotente). Suma a "saltadas".
   - Si no: derivar `ninos: NinoEnRuta[]` desde `ninoIds`. Para cada `ninoId`,
     según el `turno` de la ruta y el `escuelaId` del niño:
     - `manana`: `subeEn = {casa, ninoId}`, `bajaEn = {escuela, escuelaId}`.
     - `tarde`:  `subeEn = {escuela, escuelaId}`, `bajaEn = {casa, ninoId}`.
     - (Si al niño le falta `escuelaId`, esa ruta va a "con error" y se registra cuál.)
   - Derivar `paradas: Parada[]`: el conjunto **distinto** de lugares de todos los
     `subeEn`+`bajaEn`, ordenado (primero las subidas, luego las bajadas → mañana:
     casas y luego escuelas; tarde: al revés), con `orden` 1..n. Las escuelas/puntos
     se deduplican por id; **las casas se deduplican por coordenadas** (hermanos en
     la misma casa → una sola parada, ver S1).
   - Encolar en el batch: `update(ruta, { ninos, paradas })`. **No toca `ninoIds`.**
3. **Batching:** `writeBatch` con **máximo 500 operaciones**; cuando se llega a 500
   se hace `commit()` y se abre un batch nuevo. (Cada ruta = 1 operación de update.)
4. **Progreso:** barra/porcentaje mientras corre (procesadas / total).
5. **Resumen final:** `migradas`, `saltadas`, `con error` (con el listado de rutas
   que fallaron y por qué).

**Reglas para migrar:** la migración **escribe** en `rutas` (update) → requiere que
la regla de `rutas` permita escritura al admin (ya la permite). No necesita reglas nuevas.

---

## 4. Armador de rutas con transbordo — ✅ IMPLEMENTADO (2026-07-27)

`RutasScreen` ahora escribe `ninos: NinoEnRuta[]` (además de `ninoIds`). Por defecto
todos los niños quedan **directos** (casa↔escuela según el turno). Sección
**"Transbordo (opcional)"**: el admin marca, para un niño, que en esta ruta **se
sube** o **se baja** en un **punto** (en vez de su casa/escuela). Al editar una
ruta, esos transbordos se reconstruyen desde `ruta.ninos`. Una ruta con al menos un
tramo de transbordo se marca en la tabla. Se mantiene `ninoIds` en paralelo.

## 5. App móvil — conductor ✅ IMPLEMENTADO (2026-07-27); padre pendiente

**Conductor** — `app/(conductor)/transbordo.tsx` + `services/transbordoService.ts`:
- Entrada desde "Mi ruta de hoy": si la ruta pasa por un punto, aparece un botón
  **"Transbordo en [punto]"**.
- **ENTREGA** (decide): mis niños con `bajaEn` = ese punto. Confirmo individual o
  "Todos". Botón **"¿Se baja otro niño aquí?"** (excepción) con el resto de los
  niños de mi bus.
- **RECIBE** (no decide): mi plan (`subeEn` = punto) **+** lo que dejó el otro bus,
  leído en vivo de `registros` del punto (`onSnapshot`, filtros de igualdad
  `fecha`+`lugarTipo`+`lugarId`). Solo confirmo "Subió".
- **Precedencia:** al recibir, si no hay entrega previa del otro bus → el registro
  lleva `discrepancia:true` (queda para el admin). Manda la recepción.
- **Validación (no bloqueante):** un niño en RECIBE cuya escuela no está en las
  escuelas de **mi** ruta se muestra en rojo. *(Se valida en el receptor, que sí
  conoce su propia ruta; el emisor nunca lee la ruta ajena, por eso no puede validar
  al agregar la excepción — la validación vive en quien recibe.)*
- **Contingencia:** "Esperar" (marca `viaje.demorado`) y "Continuar sin transbordo"
  (los pendientes se registran como `excepcion` en el punto con motivo → ningún niño
  queda en estado imposible).
- Se reutiliza el componente de asistencia (`components/GrupoAsistencia.tsx`,
  extraído de `hoy.tsx`), en modo dos estados (pendiente / listo).

**Padre** — pendiente (otra sesión): ver el/los tramos del viaje de su hijo.

## Decisiones tomadas en esta sesión (Derek delegó: "las más lógicas, sin problemas a futuro")

- **Estado del niño se DERIVA de `registros`, no se guarda en `ninos.estado`.** Una
  sola fuente de verdad (no se desincroniza) y **no** hace falta darle al conductor
  permiso de escritura sobre `ninos` (datos sensibles). Se aparta del prompt, que
  pedía `ninos.estado`; a cambio, todo queda derivable y más seguro.
- **Sin reglas nuevas ni índices.** La regla de `registros` ya deja al conductor
  leer/crear; las consultas usan solo igualdades (orden en cliente) → sin índice
  compuesto. **Cero deploy** para esta función. (El CRUD de `puntos` sí necesita su
  regla, ya agregada a `firestore.rules`.)
- **Nombres:** se mantienen `LugarRef = { tipo, id }` con `tipo:'punto'` (no
  `refId`/`'transbordo'`) para no re-migrar datos ya migrados. `'punto'` **significa**
  transbordo.
- **Offline:** cola de escrituras en memoria de Firestore (marca sin señal con la app
  abierta). Persistencia entre reinicios no es viable con el SDK JS en RN; no se
  agregó `@react-native-firebase` (fuera de stack).
- **Registros inmutables:** siempre `set` de docs nuevos; una corrección es un
  registro nuevo, no un update.

## 6. (Futuro) Reglas de seguridad — *otra sesión*

Agregar la regla de `puntos` (lectura: autenticado; escritura: admin, patrón de
`escuelas`) y revisar el resto. **Dependencia:** sin esta regla desplegada no se
puede probar el CRUD de puntos (sección 1) ni leer puntos en el móvil.

---

## 7. Compatibilidad — por qué esta sesión NO rompe nada

Verificado en el código (grep):

| Campo | Quién lo usa hoy | Efecto de la migración |
|---|---|---|
| `ruta.ninoIds` | web `rutasService`/`RutasScreen`; móvil `hoy.tsx`; **`padreService` lo consulta con `array-contains`** | **Se conserva intacto.** Todo sigue funcionando. |
| `ruta.escuelaIds` | web builder; móvil `hoy.tsx` | Sin cambios. |
| `ruta.paradas` (viejo `ParadaEnRuta[]`) | **nadie lo lee** (solo el tipo) | Se reemplaza por el nuevo `Parada[]`. Nadie se entera. |
| `ruta.ninos` | nadie (no existía) | Se agrega. Nadie lo lee todavía → aditivo puro. |

Conclusión: la migración es **puramente aditiva** para lo que se usa. No hace falta
adaptar ninguna pantalla actual, ni dejar TODOs de "algo lee `ruta.ninos` como
string[]" (nadie lo hace).

---

## 8. Decisiones confirmadas (2026-07-23)

- **S1 ✅ — `LugarRef` "casa" → ninoId**, coords desde `nino.parada`. **Ajuste:** las
  paradas de tipo `casa` se **deduplican por coordenadas** — si dos hermanos viven
  en la misma casa, el conductor ve **una sola** parada (referenciando al primer
  hermano como representante; las coords son las mismas). Escuelas y puntos se
  deduplican por id.
- **S2 ✅ — `puntos` = puntos de transbordo**, forma `{ nombre, lat, lng, activo }`
  con `lat`/`lng` **numbers sueltos, igual que `escuelas`** (no GeoPoint) — consistencia.
- **S3 ✅ — `ninoIds` se conserva** junto a `ninos`. **Nota para el futuro:** con
  transbordo, un niño estará en **DOS rutas del mismo turno**, así que la consulta
  `array-contains` del padre (`padreService.listarRutasDeNino`) devolverá dos rutas
  donde antes devolvía una. **No se arregla ahora**; se deja un comentario en el
  código, en esa consulta.
- **S4 ✅ — Path `/migracion`** (admin-only por el layout).
- **S5 ✅ — Regla de `puntos` se agrega ahora** a `firestore.rules` (lectura:
  autenticado; escritura: admin). El resto de reglas queda para otra sesión. Derek
  la despliega.

### Principios transversales (anotados también en CLAUDE.md)

1. **El transbordo es la EXCEPCIÓN, no la regla.** La mayoría de niños son directos
   (casa → escuela). Al agregar un niño a una ruta, `subeEn`/`bajaEn` se llenan
   solos con el caso directo según el turno; nunca se le pide al admin decidir por
   cada niño. La UI de transbordo solo aparece si la ruta tiene un punto insertado.
   **En la migración: TODOS los niños quedan directos, ninguno como transbordo.**
2. **Simplicidad de operación por encima de completitud.** Conductor: botones
   grandes, "Todos" siempre visible, dos estados máximo, cero configuración. Padre:
   el transbordo es invisible (una notificación y el marcador que sigue). Admin: ahí
   puede haber densidad. Si algo obliga a explicarle un concepto nuevo al conductor
   o al padre, se propone antes de construirlo.

---

## 9. Qué se hace en esta sesión (resumen)

1. `puntosService.ts` + `PuntosScreen.tsx` (CRUD calcado de Escuelas) + cableado.
2. Tipos de la sección 2 en ambos `models.ts` (idénticos), quitando `ParadaEnRuta`.
3. Página `/migracion` idempotente (batch ≤500, progreso, resumen).

**No se toca:** armador de rutas, app móvil, reglas (salvo, si confirmás S5, agregar
la de `puntos` al archivo sin desplegar).
