# Plan de migración — Fase 3.5: escuelas, y rutas por unidad + turno + escuelas

> Documento vivo. Refleja el modelo **definitivo** acordado con Derek (última
> corrección del 2026-07-21: la parada vive en el niño; la ruta se arma por unidad +
> turno + escuelas + niños marcados).

---

## 1. Qué es Fase 3.5 y estrategia

Cambia las fundaciones: agrega `escuelas`, reescribe `ninos` y `rutas`, y saca el
AM/PM en favor de un **turno** (mañana/tarde). Comparte `models.ts` idéntico entre
web y móvil. Estrategia: **aditivo primero, limpieza al final** — campos nuevos
opcionales conviviendo con los viejos, migrando pantalla por pantalla con ambos
proyectos compilando en cada paso; los viejos se borran en la sub-etapa final.

---

## 2. Decisiones (cerradas)

1. **Fuera AM/PM → turno.** La ruta tiene un **turno** (`manana` / `tarde`). El
   conductor resuelve la ruta activa por la hora (antes del mediodía = mañana).
   **Sin horas exactas** (se descartó la franja `horaInicio/horaFin`).
2. **`escuelaId` reemplaza a `centroEducativo`** (escuela con ubicación).
3. **Datos de prueba: se recrean** con la UI nueva.
4. **Flujo niño ↔ parada ↔ ruta (definitivo):**
   - La **parada es la casa** del niño y vive **en su perfil** (se marca en un mapa).
     → **No hay colección/pantalla de Paradas** (se eliminó).
   - El niño tiene un **turno**: `manana`, `tarde` o `ambos` (cuándo viaja).
   - Al registrar un niño se define: **escuela + turno + parada (casa en el mapa)**.
   - La **ruta** se arma: elegís **unidad (bus)** → **turno** → **una o varias
     escuelas** → aparece la **lista de niños** de esas escuelas en ese turno y
     **marcás** los que van. Una ruta puede servir a **varias escuelas** (típico de
     la mañana).
   - Un niño con turno `ambos` aparece como candidato tanto en rutas de mañana como
     de tarde; se lo marca en las que corresponda.
   - **Orden del recorrido: automático** (por ahora sin ordenar a mano). El
     conductor verá los niños agrupados por casa y la(s) escuela(s).

---

## 3. Modelo de datos (`models.ts`, idéntico en ambos)

Campos nuevos opcionales; viejos conservados hasta la limpieza (sub-etapa final).

```ts
interface Escuela { id; nombre; lat; lng; activa }

type Turno = "manana" | "tarde";
type TurnoNino = Turno | "ambos";

// la casa del niño, marcada en el mapa de su perfil
interface ParadaNino { nombre; lat; lng }

interface Nino {
  id; nombre; grado; padreId; activo;
  escuelaId?: string;   // su escuela
  parada?: ParadaNino;  // su casa
  turno?: TurnoNino;    // cuándo viaja
  // viejos (se eliminan al final): centroEducativo, rutaId, paradaId
}

interface Ruta {
  id; nombre; busId; activa;
  turno?: Turno;
  escuelaIds?: string[]; // una o varias escuelas
  ninoIds?: string[];    // niños marcados
  municipio?: …;
  // viejos (se eliminan al final): paradas, horarioAM, horarioPM
}

interface Viaje { …; tipo; … }  // 'tipo' (AM/PM) se quita en la limpieza
```

`ParadaEnRuta` (parada embebida vieja) se conserva solo para que el móvil compile;
se elimina al final.

**Mantener idéntico:** editar el `models.ts` web, copiar verbatim al móvil, `diff`,
y type-check de ambos.

---

## 4. Estado de la construcción

| Sub-etapa | Estado |
|---|---|
| Modelo (aditivo, ambos) | ✅ hecho, idénticos, ambos compilan |
| Escuelas (web) | ✅ hecho y **probado por Derek** |
| Niños (web: escuela + turno + parada en mapa) | ✅ hecho — falta probar |
| Rutas (web: unidad + turno + escuelas + checklist de niños) | ✅ hecho — falta probar |
| Conductor (móvil) | ✅ hecho — falta probar en el teléfono |
| Padre (móvil) | ✅ hecho — falta probar con dos sesiones |
| Limpieza + datos reales | ⏳ pendiente |

Orden del panel web: **Escuelas → Niños → Rutas** (Paradas se eliminó).

---

## 5. Archivos (web)

**Vigentes nuevos:** `services/escuelasService.ts`, `screens/EscuelasScreen.tsx`,
`components/MapaUbicacion.tsx` (mapa de un punto, reutilizado por escuelas y por la
parada del niño).

**Reescritos:** `types/models.ts`, `services/ninosService.ts`,
`screens/NinosScreen.tsx` (escuela + turno + parada en mapa),
`services/rutasService.ts`, `screens/RutasScreen.tsx` (unidad + turno + escuelas +
checklist de niños), `services/dashboardService.ts`, `screens/DashboardScreen.tsx`,
`App.tsx`, `components/AppLayout.tsx`.

**Eliminados:** `screens/ParadasScreen.tsx`, `services/paradasService.ts`,
`components/MapaParadas.tsx`, `components/MapaEscuela.tsx`,
`components/MapaRecorrido.tsx`.

**Nota:** las tres pantallas de datos muestran un **mensaje de error con
"Reintentar"** si una carga falla (antes quedaban en spinner infinito).

**Reglas:** `firestore.rules` tiene `escuelas` (desplegada). La regla `paradas`
quedó en el archivo pero la colección ya no se usa; se limpia al final (no molesta).

## 5-bis. Archivos (móvil) — pendiente

- `conductorService.ts` — rutas del bus + ruta activa por turno/reloj; niños desde
  `ruta.ninoIds`; escuelas de la ruta.
- `viajesService.ts` — quitar `tipoViajeActual`/`tipo`; registro en batch.
- `app/(conductor)/hoy.tsx` — ruta del turno actual; niños agrupados por casa
  (parada) con "marcar todos"; "Llegué a [escuela]".
- `app/(padre)/hijos.tsx`, `mapa.tsx`, `historial.tsx` — hijo con su(s) ruta(s);
  parada desde `nino.parada`; escuela desde `escuelas`; sin chip AM/PM.

---

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Cambios de modelo cruzan web y móvil. | Aditivo + `diff` de `models.ts` + type-check de ambos en cada paso. |
| Quitar AM/PM toca viajes (Fase 4/5). | `Viaje.tipo` opcional en transición; se migra el móvil y se revalida en el teléfono; se borra al final. El web no usa `Viaje.tipo`. |
| Colección nueva sin regla → falla (síntoma: pantallas no cargan). | Regla desplegada por Derek antes de probar. Las pantallas ahora muestran el error en vez de spinner infinito. |

---

## 7. Qué NO toca esta fase

- De `viajes` solo se quita `tipo`. `registros`, `ubicaciones`, `mensajes` no cambian.
- Sin Cloud Functions, plan Blaze ni Realtime Database. Sin librerías fuera del CLAUDE.md §4.
- No calcula rutas óptimas ni ordena el recorrido automáticamente (queda para más adelante).

---

## 8. Próximo paso

Probar el panel web (Escuelas → Niños → Rutas). Confirmado eso, sigo con el
**móvil (conductor, luego padre)** y al final la **limpieza + datos reales** y la
actualización del `CLAUDE.md`.
