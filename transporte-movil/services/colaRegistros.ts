import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { EventoRegistro, Registro, TipoLugar } from '../types/models';

// ============================================
// ASISTENCIA SIN SEÑAL: LA COLA DEL TELÉFONO
// ============================================
// El problema: en las rutas de El Pino o La Unión el bus pierde señal seguido.
// Firestore guarda las escrituras pendientes en MEMORIA y las manda al volver
// la señal, pero si la app se cierra antes —se acaba la batería, el conductor
// la cierra, Android la mata para liberar memoria— esas marcas se pierden: el
// niño subió, pero no quedó registrado en ningún lado.
//
// La solución: cada marca se guarda PRIMERO en el teléfono (AsyncStorage, que
// sobrevive a cerrar la app) y recién después se manda a Firestore. Sale de la
// cola cuando Firestore confirma que la recibió, y lo que quedó se reintenta al
// volver a abrir la app.
//
// Por qué nunca se duplica: el id del registro se genera en el teléfono ANTES de
// guardar. Si una marca llegó al servidor pero la confirmación se perdió, el
// reintento usa el MISMO id; las reglas no dejan modificar un registro (son
// inmutables), así que el reintento es rechazado, se comprueba que el registro
// ya existe y se lo saca de la cola.
//
// Y la pantalla no se traba: no espera la confirmación del servidor, que sin
// señal puede tardar minutos. El conductor marca y sigue.

const CLAVE_COLA = 'registrosPendientes';

// Una marca vieja se sigue guardando (es la constancia de lo que pasó ese día);
// solo se descarta pasado este tiempo, para que la cola no crezca para siempre.
const DIAS_MAXIMOS_EN_COLA = 30;

// Lo que se guarda de cada marca. `horaMs` es la hora del teléfono en el momento
// de marcar; la del servidor la pone Firestore cuando el registro llega.
export interface DatosRegistro {
  viajeId: string;
  ninoId: string;
  evento: EventoRegistro;
  horaMs: number;
  // --- Solo en los registros de un transbordo ---
  paradaId?: string;
  fecha?: string;
  lugarTipo?: TipoLugar;
  lugarId?: string;
  rutaId?: string;
  busId?: string;
  conductorId?: string;
  excepcion?: boolean;
  discrepancia?: boolean;
  motivo?: string;
  ninoNombre?: string;
  ninoEscuelaId?: string;
}

interface Pendiente {
  id: string;
  datos: DatosRegistro;
}

// Marcas que se están mandando ahora mismo en esta sesión: el reintento no las toca
const enVuelo = new Set<string>();

async function leerCola(): Promise<Pendiente[]> {
  try {
    const crudo = await AsyncStorage.getItem(CLAVE_COLA);
    return crudo ? (JSON.parse(crudo) as Pendiente[]) : [];
  } catch {
    return [];
  }
}

async function guardarCola(cola: Pendiente[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CLAVE_COLA, JSON.stringify(cola));
  } catch {
    // Si no se puede escribir en el teléfono, queda la cola en memoria de Firestore
  }
}

// Las lecturas y escrituras de la cola van en fila: dos marcas seguidas no
// pueden leer la misma versión y pisarse una a la otra.
let fila: Promise<unknown> = Promise.resolve();
function enFila<T>(tarea: () => Promise<T>): Promise<T> {
  const resultado = fila.then(tarea, tarea);
  fila = resultado.catch(() => {});
  return resultado;
}

async function quitarDeCola(ids: string[]): Promise<void> {
  const quitar = new Set(ids);
  await enFila(async () => guardarCola((await leerCola()).filter((p) => !quitar.has(p.id))));
}

// Lo que se escribe en Firestore
function aFirestore(datos: DatosRegistro): Record<string, unknown> {
  const { horaMs, ...resto } = datos;
  // Firestore no acepta undefined: se quitan los campos opcionales vacíos
  const definidos = Object.fromEntries(Object.entries(resto).filter(([, v]) => v !== undefined));
  return {
    ...definidos,
    hora: Timestamp.fromMillis(horaMs),
    horaServidor: serverTimestamp(), // la exigen las reglas
  };
}

// Cómo se ve en pantalla una marca que todavía no llegó al servidor
function comoRegistro(p: Pendiente): Registro {
  const { horaMs, ...resto } = p.datos;
  return {
    ...resto,
    id: p.id,
    paradaId: resto.paradaId ?? '',
    hora: Timestamp.fromMillis(horaMs),
  };
}

// --- Registra una o varias marcas: primero en el teléfono, después en Firestore ---
// Devuelve los registros tal como tienen que verse YA en pantalla.
export async function guardarRegistros(lista: DatosRegistro[]): Promise<Registro[]> {
  const pendientes: Pendiente[] = lista.map((datos) => ({
    id: doc(collection(db, 'registros')).id,
    datos,
  }));

  await enFila(async () => guardarCola([...(await leerCola()), ...pendientes]));

  // Un solo lote: "todos subieron" queda entero o no queda. No se espera la
  // confirmación (ver arriba); si falla, la marca sigue en la cola del teléfono.
  pendientes.forEach((p) => enVuelo.add(p.id));
  const lote = writeBatch(db);
  pendientes.forEach((p) => lote.set(doc(db, 'registros', p.id), aFirestore(p.datos)));
  lote
    .commit()
    .then(() => quitarDeCola(pendientes.map((p) => p.id)))
    .catch(() => {})
    .finally(() => pendientes.forEach((p) => enVuelo.delete(p.id)));

  return pendientes.map(comoRegistro);
}

// --- Las marcas de un viaje que todavía no llegaron al servidor ---
// La pantalla las suma a las que lee de Firestore: sin esto, al reabrir la app
// sin señal el niño aparecería otra vez como pendiente y se lo marcaría dos veces.
export async function pendientesDeViaje(viajeId: string): Promise<Registro[]> {
  return (await leerCola()).filter((p) => p.datos.viajeId === viajeId).map(comoRegistro);
}

let reintentando = false;

// --- Reintenta lo que quedó en la cola ---
// La llaman el layout del conductor al abrir la app y la pantalla del viaje
// después de cada marca.
export async function reintentarRegistrosPendientes(): Promise<void> {
  if (reintentando) return;
  reintentando = true;
  try {
    const limite = Date.now() - DIAS_MAXIMOS_EN_COLA * 24 * 60 * 60 * 1000;
    const cola = await leerCola();

    // Se mandan todos a la vez: sin señal, Firestore los retiene y los despacha
    // juntos cuando vuelve; de a uno, el primero trabaría a todos los demás.
    await Promise.all(
      cola
        .filter((p) => p.datos.horaMs >= limite && !enVuelo.has(p.id))
        .map(async (p) => {
          enVuelo.add(p.id);
          try {
            await setDoc(doc(db, 'registros', p.id), aFirestore(p.datos));
            await quitarDeCola([p.id]);
          } catch {
            // ¿Ya estaba guardado? Las reglas no dejan pisar un registro, así que
            // un reintento de algo que sí llegó es rechazado: se comprueba y se saca
            const yaExiste = await getDoc(doc(db, 'registros', p.id))
              .then((s) => s.exists())
              .catch(() => false);
            if (yaExiste) await quitarDeCola([p.id]);
          } finally {
            enVuelo.delete(p.id);
          }
        })
    );

    // Lo que pasó el límite de días se descarta
    await enFila(async () => guardarCola((await leerCola()).filter((p) => p.datos.horaMs >= limite)));
  } finally {
    reintentando = false;
  }
}
