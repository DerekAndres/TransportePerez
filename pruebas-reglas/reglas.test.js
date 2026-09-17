// ============================================================================
// PRUEBAS AUTOMÁTICAS DE LAS REGLAS DE SEGURIDAD (firestore.rules)
// ============================================================================
// Corren contra el EMULADOR local de Firestore, nunca contra producción: el
// proyecto se llama "demo-…" y Firebase no deja que un proyecto demo toque la
// nube. Cada prueba es un caso concreto — quién intenta hacer qué y si las
// reglas lo dejan o no — y sirve tal cual para el capítulo de pruebas del informe.
//
// Cómo correrlas, desde esta carpeta:
//   npm install   (una sola vez)
//   npm test
// Requisitos: firebase-tools y Java 11 o más nuevo (sirve el que trae Android
// Studio: poner su carpeta jbr/bin en el PATH).

import { after, before, beforeEach, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

let entorno;

// La fecha de hoy en Honduras (UTC-6), calculada igual que en las reglas
function fechaHonduras(dias = 0) {
  return new Date(Date.now() - 6 * 3600_000 + dias * 86_400_000).toISOString().slice(0, 10);
}
const HOY = fechaHonduras(0);

const U = {
  admin: 'admin1',
  adminViejo: 'admin2', // documento creado antes de que existiera el campo `activo`
  condA: 'condA',
  condB: 'condB',
  condBaja: 'condBaja',
  padreP: 'padreP',
  padreQ: 'padreQ',
  padreBaja: 'padreBaja',
};

const db = (uid) => entorno.authenticatedContext(uid).firestore();
const conversacion = (a, b) => [a, b].sort().join('_');

// Un lote con su registro de auditoría adentro, igual que lo arma el panel
function loteAuditado(firestore, coleccion, docIds, { actorId = U.admin, id } = {}) {
  const lote = writeBatch(firestore);
  const ref = id ? doc(firestore, 'auditoria', id) : doc(collection(firestore, 'auditoria'));
  lote.set(ref, {
    actorId,
    accion: 'prueba',
    coleccion,
    docIds,
    detalle: '',
    hora: serverTimestamp(),
  });
  return { lote, auditoriaId: ref.id };
}

async function sembrar() {
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    const ahora = Timestamp.now();
    const usuarios = {
      [U.admin]: { rol: 'admin', nombre: 'Admin', activo: true },
      [U.adminViejo]: { rol: 'admin', nombre: 'Admin sin campo activo' },
      [U.condA]: { rol: 'conductor', nombre: 'Carlos', activo: true },
      [U.condB]: { rol: 'conductor', nombre: 'Beto', activo: true },
      [U.condBaja]: { rol: 'conductor', nombre: 'Despedido', activo: false, eliminado: true },
      [U.padreP]: { rol: 'padre', nombre: 'Pedro', activo: true },
      [U.padreQ]: { rol: 'padre', nombre: 'Quique', activo: true },
      [U.padreBaja]: { rol: 'padre', nombre: 'Padre de baja', activo: false },
    };
    for (const [id, u] of Object.entries(usuarios)) {
      await setDoc(doc(d, 'usuarios', id), { email: `${id}@x.com`, telefono: '0', ...u });
    }
    await setDoc(doc(d, 'buses', 'bus1'), { placa: 'AAA-1', capacidad: 20, conductorId: U.condA, activo: true });
    await setDoc(doc(d, 'buses', 'bus2'), { placa: 'BBB-2', capacidad: 20, conductorId: U.condB, activo: true });
    await setDoc(doc(d, 'rutas', 'ruta1'), { nombre: 'R1', busId: 'bus1', activa: true, ninoIds: ['nino1'] });
    await setDoc(doc(d, 'ninos', 'nino1'), {
      nombre: 'Ana', grado: '1', padreId: U.padreP, activo: true, conductorIds: [U.condA],
      parada: { nombre: 'Casa', lat: 15.7, lng: -86.8 },
    });
    await setDoc(doc(d, 'ninos', 'nino2'), { nombre: 'Beto Jr', grado: '2', padreId: U.padreQ, activo: true, conductorIds: [U.condB] });
    await setDoc(doc(d, 'ninos', 'nino3'), { nombre: 'Sin ruta', grado: '3', padreId: U.padreQ, activo: true });
    await setDoc(doc(d, 'viajes', 'viaje1'), { rutaId: 'ruta1', conductorId: U.condA, busId: 'bus1', fecha: HOY, estado: 'en_curso', horaInicio: ahora });
    await setDoc(doc(d, 'viajes', 'viaje2'), { rutaId: 'ruta1', conductorId: U.condA, busId: 'bus1', fecha: HOY, estado: 'en_curso', horaInicio: ahora });
    await setDoc(doc(d, 'ubicaciones', 'viaje1'), { viajeId: 'viaje1', lat: 1, lng: 1, timestamp: ahora, padreIds: [U.padreP] });
    await setDoc(doc(d, 'registros', 'reg1'), { viajeId: 'viaje1', ninoId: 'nino1', evento: 'subio', hora: ahora });
    await setDoc(doc(d, 'solicitudes', 'aus1'), { tipo: 'ausencia_dia', padreId: U.padreP, estado: 'aprobada', ninoId: 'nino1', fechaAplicacion: HOY, creadaEn: ahora });
    await setDoc(doc(d, 'solicitudes', 'insc1'), { tipo: 'inscripcion', padreId: U.padreP, estado: 'pendiente', creadaEn: ahora });
    await setDoc(doc(d, 'solicitudes', 'cambioViejo'), { tipo: 'cambio_ubicacion', padreId: U.padreQ, estado: 'aprobada', ninoId: 'nino2', fechaAplicacion: '2020-01-01', creadaEn: ahora });
    await setDoc(doc(d, 'mensajes', 'msj1'), { conversacionId: conversacion(U.padreP, U.condA), de: U.padreP, para: U.condA, texto: 'Hola', hora: ahora, leido: false });
    await setDoc(doc(d, 'recorridos', 'viaje1'), { viajeId: 'viaje1', conductorId: U.condA, puntos: [{ lat: 1, lng: 1, t: ahora }] });
  });
}

before(async () => {
  entorno = await initializeTestEnvironment({
    projectId: 'demo-transporte-perez',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

after(async () => {
  await entorno?.cleanup();
});

beforeEach(async () => {
  await entorno.clearFirestore();
  await sembrar();
});

// ----------------------------------------------------------------------------
describe('1. Cuentas dadas de baja', () => {
  test('un conductor dado de baja ya no lee las unidades', async () => {
    await assertFails(getDoc(doc(db(U.condBaja), 'buses', 'bus1')));
  });
  test('un conductor dado de baja no puede iniciar un viaje', async () => {
    await assertFails(setDoc(doc(db(U.condBaja), 'viajes', 'nuevo'), {
      rutaId: 'ruta1', conductorId: U.condBaja, busId: 'bus1', fecha: HOY, estado: 'en_curso',
      horaInicio: Timestamp.now(), horaInicioServidor: serverTimestamp(),
    }));
  });
  test('un padre dado de baja ya no lee nada del sistema', async () => {
    await assertFails(getDoc(doc(db(U.padreBaja), 'rutas', 'ruta1')));
  });
  test('la cuenta dada de baja sí lee su propio perfil (para que la app explique por qué no entra)', async () => {
    await assertSucceeds(getDoc(doc(db(U.condBaja), 'usuarios', U.condBaja)));
  });
  test('la cuenta dada de baja no se puede reactivar sola', async () => {
    await assertFails(updateDoc(doc(db(U.condBaja), 'usuarios', U.condBaja), { activo: true }));
  });
  test('un admin viejo sin el campo "activo" sigue funcionando', async () => {
    await assertSucceeds(getDocs(collection(db(U.adminViejo), 'ninos')));
  });
});

// ----------------------------------------------------------------------------
describe('2. Perfil propio', () => {
  test('el padre cambia su teléfono', async () => {
    await assertSucceeds(updateDoc(doc(db(U.padreP), 'usuarios', U.padreP), { telefono: '9999-9999' }));
  });
  test('el padre guarda su token de avisos', async () => {
    await assertSucceeds(updateDoc(doc(db(U.padreP), 'usuarios', U.padreP), { expoPushToken: 'ExponentPushToken[x]' }));
  });
  test('el padre NO puede cambiarse el nombre (evita hacerse pasar por "Administración")', async () => {
    await assertFails(updateDoc(doc(db(U.padreP), 'usuarios', U.padreP), { nombre: 'Administración' }));
  });
  test('el padre NO puede cambiarse el rol', async () => {
    await assertFails(updateDoc(doc(db(U.padreP), 'usuarios', U.padreP), { rol: 'admin' }));
  });
  test('el padre NO puede cambiarse el correo', async () => {
    await assertFails(updateDoc(doc(db(U.padreP), 'usuarios', U.padreP), { email: 'otro@x.com' }));
  });
  test('nadie edita el perfil de otro', async () => {
    await assertFails(updateDoc(doc(db(U.padreP), 'usuarios', U.padreQ), { telefono: '1' }));
  });
});

// ----------------------------------------------------------------------------
describe('3. Lectura de usuarios', () => {
  test('el padre ve al conductor y a la administración', async () => {
    await assertSucceeds(getDoc(doc(db(U.padreP), 'usuarios', U.condA)));
    await assertSucceeds(getDoc(doc(db(U.padreP), 'usuarios', U.admin)));
  });
  test('el padre NO ve a otros padres', async () => {
    await assertFails(getDoc(doc(db(U.padreP), 'usuarios', U.padreQ)));
  });
  test('el padre NO descarga la colección entera', async () => {
    await assertFails(getDocs(collection(db(U.padreP), 'usuarios')));
  });
  test('el padre sí lista a los conductores', async () => {
    await assertSucceeds(getDocs(query(collection(db(U.padreP), 'usuarios'), where('rol', '==', 'conductor'))));
  });
  test('el conductor ve padres y administración, no a otros conductores', async () => {
    await assertSucceeds(getDoc(doc(db(U.condA), 'usuarios', U.padreP)));
    await assertSucceeds(getDocs(query(collection(db(U.condA), 'usuarios'), where('rol', '==', 'admin'))));
    await assertFails(getDoc(doc(db(U.condA), 'usuarios', U.condB)));
  });
  test('el admin lista a todos', async () => {
    await assertSucceeds(getDocs(collection(db(U.admin), 'usuarios')));
  });
});

// ----------------------------------------------------------------------------
describe('4. Niños', () => {
  test('el conductor lee al niño que lleva', async () => {
    await assertSucceeds(getDoc(doc(db(U.condA), 'ninos', 'nino1')));
  });
  test('el conductor NO lee a un niño de otra unidad', async () => {
    await assertFails(getDoc(doc(db(U.condA), 'ninos', 'nino2')));
  });
  test('el conductor NO lee a un niño sin ruta', async () => {
    await assertFails(getDoc(doc(db(U.condA), 'ninos', 'nino3')));
  });
  test('el conductor lista a SUS niños con array-contains', async () => {
    await assertSucceeds(getDocs(query(collection(db(U.condA), 'ninos'), where('conductorIds', 'array-contains', U.condA))));
  });
  test('el conductor NO lista a todos los niños activos', async () => {
    await assertFails(getDocs(query(collection(db(U.condA), 'ninos'), where('activo', '==', true))));
  });
  test('el padre lee a su hijo y no al ajeno', async () => {
    await assertSucceeds(getDoc(doc(db(U.padreP), 'ninos', 'nino1')));
    await assertFails(getDoc(doc(db(U.padreP), 'ninos', 'nino2')));
    await assertSucceeds(getDocs(query(collection(db(U.padreP), 'ninos'), where('padreId', '==', U.padreP))));
  });
  test('el padre cambia la foto de su hijo, pero no su padre', async () => {
    await assertSucceeds(updateDoc(doc(db(U.padreP), 'ninos', 'nino1'), { foto: 'data:x' }));
    await assertFails(updateDoc(doc(db(U.padreP), 'ninos', 'nino1'), { padreId: U.padreQ }));
  });
});

// ----------------------------------------------------------------------------
describe('5. Auditoría de cambios sensibles', () => {
  test('cambiar el padre de un niño SIN auditoría: rechazado', async () => {
    await assertFails(updateDoc(doc(db(U.admin), 'ninos', 'nino1'), { padreId: U.padreQ }));
  });
  test('cambiar el padre de un niño CON auditoría en el mismo lote: aceptado', async () => {
    const d = db(U.admin);
    const { lote, auditoriaId } = loteAuditado(d, 'ninos', ['nino1']);
    lote.update(doc(d, 'ninos', 'nino1'), { padreId: U.padreQ, auditoriaId });
    await assertSucceeds(lote.commit());
  });
  test('reutilizar un registro de auditoría viejo: rechazado', async () => {
    const d = db(U.admin);
    const primero = loteAuditado(d, 'ninos', ['nino1']);
    primero.lote.update(doc(d, 'ninos', 'nino1'), { grado: '2', auditoriaId: primero.auditoriaId });
    await assertSucceeds(primero.lote.commit());
    // El niño ya lleva ese auditoriaId: un cambio sensible nuevo sin registro nuevo
    await assertFails(updateDoc(doc(d, 'ninos', 'nino1'), { padreId: U.padreQ }));
    // Ni apuntando a un registro que no existe…
    await assertFails(updateDoc(doc(d, 'ninos', 'nino1'), { padreId: U.padreQ, auditoriaId: 'inventado' }));
    // …ni usando el registro viejo en otro niño
    await assertFails(updateDoc(doc(d, 'ninos', 'nino2'), { padreId: U.padreP, auditoriaId: primero.auditoriaId }));
  });
  test('una auditoría que no nombra al documento: rechazado', async () => {
    const d = db(U.admin);
    const { lote, auditoriaId } = loteAuditado(d, 'ninos', ['nino2']);
    lote.update(doc(d, 'ninos', 'nino1'), { padreId: U.padreQ, auditoriaId });
    await assertFails(lote.commit());
  });
  test('un cambio no sensible (el grado) no necesita auditoría', async () => {
    await assertSucceeds(updateDoc(doc(db(U.admin), 'ninos', 'nino1'), { grado: '6to' }));
  });
  test('crear un niño exige auditoría', async () => {
    const d = db(U.admin);
    await assertFails(setDoc(doc(d, 'ninos', 'nuevo'), { nombre: 'X', padreId: U.padreP, activo: true }));
    const { lote, auditoriaId } = loteAuditado(d, 'ninos', ['nuevo']);
    lote.set(doc(d, 'ninos', 'nuevo'), { nombre: 'X', padreId: U.padreP, activo: true, auditoriaId });
    await assertSucceeds(lote.commit());
  });
  test('lote grande: 300 niños nuevos con UN registro de auditoría', async () => {
    const d = db(U.admin);
    const ids = Array.from({ length: 300 }, (_, i) => `lote${i}`);
    const { lote, auditoriaId } = loteAuditado(d, 'ninos', ids);
    ids.forEach((id) => lote.set(doc(d, 'ninos', id), { nombre: id, padreId: U.padreP, activo: true, auditoriaId }));
    await assertSucceeds(lote.commit());
  });
  test('recalcular conductorIds de muchos niños no necesita auditoría (dato derivado)', async () => {
    const d = db(U.admin);
    const lote = writeBatch(d);
    lote.update(doc(d, 'ninos', 'nino1'), { conductorIds: [U.condA, U.condB] });
    lote.update(doc(d, 'ninos', 'nino2'), { conductorIds: [] });
    lote.update(doc(d, 'ninos', 'nino3'), { conductorIds: [U.condA] });
    await assertSucceeds(lote.commit());
  });
  test('dar de baja una cuenta exige auditoría', async () => {
    const d = db(U.admin);
    await assertFails(updateDoc(doc(d, 'usuarios', U.condB), { activo: false }));
    const { lote, auditoriaId } = loteAuditado(d, 'usuarios', [U.condB]);
    lote.update(doc(d, 'usuarios', U.condB), { activo: false, auditoriaId });
    await assertSucceeds(lote.commit());
  });
  test('cambiar el conductor titular de una unidad exige auditoría; la placa no', async () => {
    const d = db(U.admin);
    await assertFails(updateDoc(doc(d, 'buses', 'bus1'), { conductorId: U.condB }));
    await assertSucceeds(updateDoc(doc(d, 'buses', 'bus1'), { placa: 'AAA-9' }));
    const { lote, auditoriaId } = loteAuditado(d, 'buses', ['bus1']);
    lote.update(doc(d, 'buses', 'bus1'), { conductorId: U.condB, auditoriaId });
    await assertSucceeds(lote.commit());
  });
  test('borrar una ruta exige su registro "borrado-rutas-<id>"', async () => {
    const d = db(U.admin);
    await assertFails(deleteDoc(doc(d, 'rutas', 'ruta1')));
    const { lote } = loteAuditado(d, 'rutas', ['ruta1'], { id: 'borrado-rutas-ruta1' });
    lote.delete(doc(d, 'rutas', 'ruta1'));
    await assertSucceeds(lote.commit());
  });
  test('ocho borrados auditados en un mismo lote', async () => {
    const d = db(U.admin);
    const ids = Array.from({ length: 8 }, (_, i) => `borrable${i}`);
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      for (const id of ids) await setDoc(doc(ctx.firestore(), 'ninos', id), { nombre: id, padreId: U.padreP });
    });
    const lote = writeBatch(d);
    for (const id of ids) {
      lote.set(doc(d, 'auditoria', `borrado-ninos-${id}`), {
        actorId: U.admin, accion: 'borrar', coleccion: 'ninos', docIds: [id], detalle: '', hora: serverTimestamp(),
      });
      lote.delete(doc(d, 'ninos', id));
    }
    await assertSucceeds(lote.commit());
  });
  test('los registros de auditoría no se editan ni se borran, ni por el admin', async () => {
    const d = db(U.admin);
    const { lote, auditoriaId } = loteAuditado(d, 'ninos', ['nino1']);
    await assertSucceeds(lote.commit());
    await assertFails(updateDoc(doc(d, 'auditoria', auditoriaId), { detalle: 'otra cosa' }));
    await assertFails(deleteDoc(doc(d, 'auditoria', auditoriaId)));
  });
  test('un registro de auditoría a nombre de otro, o con hora del teléfono: rechazado', async () => {
    const d = db(U.admin);
    await assertFails(setDoc(doc(d, 'auditoria', 'a1'), { actorId: U.adminViejo, accion: 'x', coleccion: 'ninos', docIds: ['nino1'], hora: serverTimestamp() }));
    await assertFails(setDoc(doc(d, 'auditoria', 'a2'), { actorId: U.admin, accion: 'x', coleccion: 'ninos', docIds: ['nino1'], hora: Timestamp.now() }));
    await assertFails(setDoc(doc(db(U.condA), 'auditoria', 'a3'), { actorId: U.condA, accion: 'x', coleccion: 'ninos', docIds: ['nino1'], hora: serverTimestamp() }));
  });
});

// ----------------------------------------------------------------------------
describe('6. Viajes y suplencias', () => {
  const viajeNuevo = (conductorId, extra = {}) => ({
    rutaId: 'ruta1', conductorId, busId: 'bus1', fecha: HOY, estado: 'en_curso',
    horaInicio: Timestamp.now(), horaInicioServidor: serverTimestamp(), ...extra,
  });

  async function crearSuplencia(conductorId, extra = {}) {
    const d = db(U.admin);
    const id = `bus1_${HOY}`;
    const { lote, auditoriaId } = loteAuditado(d, 'suplencias', [id]);
    lote.set(doc(d, 'suplencias', id), {
      busId: 'bus1', fecha: HOY, conductorId, conductorNombre: 'Beto', titularId: U.condA,
      titularNombre: 'Carlos', busPlaca: 'AAA-1', creadaEn: serverTimestamp(), auditoriaId, ...extra,
    });
    return lote.commit();
  }

  test('el titular inicia el viaje de su unidad', async () => {
    await assertSucceeds(setDoc(doc(db(U.condA), 'viajes', 'v'), viajeNuevo(U.condA)));
  });
  test('sin la hora del servidor, no', async () => {
    await assertFails(setDoc(doc(db(U.condA), 'viajes', 'v'), viajeNuevo(U.condA, { horaInicioServidor: Timestamp.now() })));
  });
  test('otro conductor NO inicia viajes de una unidad que no maneja', async () => {
    await assertFails(setDoc(doc(db(U.condB), 'viajes', 'v'), viajeNuevo(U.condB)));
  });
  test('una suplencia exige auditoría y el id "<bus>_<fecha>"', async () => {
    const d = db(U.admin);
    await assertFails(setDoc(doc(d, 'suplencias', `bus1_${HOY}`), { busId: 'bus1', fecha: HOY, conductorId: U.condB }));
    const { lote, auditoriaId } = loteAuditado(d, 'suplencias', ['otroId']);
    lote.set(doc(d, 'suplencias', 'otroId'), { busId: 'bus1', fecha: HOY, conductorId: U.condB, auditoriaId });
    await assertFails(lote.commit());
  });
  test('con suplencia vigente: maneja el suplente y el titular NO', async () => {
    await assertSucceeds(crearSuplencia(U.condB));
    await assertSucceeds(setDoc(doc(db(U.condB), 'viajes', 'v1'), viajeNuevo(U.condB)));
    await assertFails(setDoc(doc(db(U.condA), 'viajes', 'v2'), viajeNuevo(U.condA)));
  });
  test('con la suplencia cancelada vuelve a manejar el titular', async () => {
    await assertSucceeds(crearSuplencia(U.condB));
    const d = db(U.admin);
    const id = `bus1_${HOY}`;
    const { lote, auditoriaId } = loteAuditado(d, 'suplencias', [id]);
    lote.update(doc(d, 'suplencias', id), { cancelada: true, auditoriaId });
    await assertSucceeds(lote.commit());
    await assertSucceeds(setDoc(doc(db(U.condA), 'viajes', 'v1'), viajeNuevo(U.condA)));
    await assertFails(setDoc(doc(db(U.condB), 'viajes', 'v2'), viajeNuevo(U.condB)));
  });
  test('conductores y padres leen las suplencias', async () => {
    await assertSucceeds(crearSuplencia(U.condB));
    await assertSucceeds(getDoc(doc(db(U.condA), 'suplencias', `bus1_${HOY}`)));
    await assertSucceeds(getDoc(doc(db(U.padreP), 'suplencias', `bus1_${HOY}`)));
  });
  test('finalizar: con la hora del servidor sí; sin ella no', async () => {
    const d = db(U.condA);
    await assertFails(updateDoc(doc(d, 'viajes', 'viaje1'), { estado: 'finalizado', horaFin: Timestamp.now() }));
    await assertSucceeds(updateDoc(doc(d, 'viajes', 'viaje1'), {
      estado: 'finalizado', horaFin: Timestamp.now(), horaFinServidor: serverTimestamp(),
    }));
  });
  test('el conductor marca demora, pero no se cambia el dueño del viaje', async () => {
    await assertSucceeds(updateDoc(doc(db(U.condA), 'viajes', 'viaje1'), { demorado: true }));
    await assertFails(updateDoc(doc(db(U.condA), 'viajes', 'viaje1'), { conductorId: U.condB }));
  });
});

// ----------------------------------------------------------------------------
describe('7. Registros de asistencia', () => {
  const registro = (extra = {}) => ({
    viajeId: 'viaje1', ninoId: 'nino1', evento: 'bajo', hora: Timestamp.now(),
    horaServidor: serverTimestamp(), ...extra,
  });
  test('el conductor registra con la hora del servidor', async () => {
    await assertSucceeds(setDoc(doc(db(U.condA), 'registros', 'r'), registro()));
  });
  test('sin la hora del servidor, o con un evento inventado: rechazado', async () => {
    await assertFails(setDoc(doc(db(U.condA), 'registros', 'r1'), registro({ horaServidor: Timestamp.now() })));
    await assertFails(setDoc(doc(db(U.condA), 'registros', 'r2'), registro({ evento: 'teletransportado' })));
  });
  test('un padre NO escribe registros', async () => {
    await assertFails(setDoc(doc(db(U.padreP), 'registros', 'r'), registro()));
  });
  test('los registros no se editan (reintentar uno ya guardado falla y no duplica)', async () => {
    await assertFails(setDoc(doc(db(U.condA), 'registros', 'reg1'), registro()));
  });
  test('"Todos subieron": 60 registros en un solo lote', async () => {
    const d = db(U.condA);
    const lote = writeBatch(d);
    for (let i = 0; i < 60; i++) lote.set(doc(d, 'registros', `masivo${i}`), registro({ ninoId: `n${i}`, evento: 'subio' }));
    await assertSucceeds(lote.commit());
  });
  test('el padre lee los registros de su hijo y no los de otro', async () => {
    const d = db(U.padreP);
    await assertSucceeds(getDocs(query(collection(d, 'registros'), where('viajeId', '==', 'viaje1'), where('ninoId', '==', 'nino1'))));
    await assertFails(getDocs(query(collection(d, 'registros'), where('viajeId', '==', 'viaje1'), where('ninoId', '==', 'nino2'))));
  });
});

// ----------------------------------------------------------------------------
describe('8. Mensajes', () => {
  const mensaje = (de, para, extra = {}) => ({
    conversacionId: conversacion(de, para), de, para, texto: 'Buenas', hora: Timestamp.now(),
    horaServidor: serverTimestamp(), leido: false, ...extra,
  });
  test('el padre le escribe al conductor', async () => {
    await assertSucceeds(setDoc(doc(db(U.padreP), 'mensajes', 'm'), mensaje(U.padreP, U.condA)));
  });
  test('un padre NO le escribe a otro padre', async () => {
    await assertFails(setDoc(doc(db(U.padreP), 'mensajes', 'm'), mensaje(U.padreP, U.padreQ)));
  });
  test('conversación que no corresponde, hora del teléfono, remitente falso o texto vacío: rechazado', async () => {
    const d = db(U.padreP);
    await assertFails(setDoc(doc(d, 'mensajes', 'm1'), mensaje(U.padreP, U.condA, { conversacionId: 'x_y' })));
    await assertFails(setDoc(doc(d, 'mensajes', 'm2'), mensaje(U.padreP, U.condA, { horaServidor: Timestamp.now() })));
    await assertFails(setDoc(doc(d, 'mensajes', 'm3'), mensaje(U.padreQ, U.condA)));
    await assertFails(setDoc(doc(d, 'mensajes', 'm4'), mensaje(U.padreP, U.condA, { texto: '' })));
  });
  test('el destinatario marca leído, pero NO puede cambiar el texto', async () => {
    await assertSucceeds(updateDoc(doc(db(U.condA), 'mensajes', 'msj1'), { leido: true }));
    await assertFails(updateDoc(doc(db(U.condA), 'mensajes', 'msj1'), { texto: 'Nunca dije eso' }));
  });
  test('el remitente no marca leído su propio mensaje', async () => {
    await assertFails(updateDoc(doc(db(U.padreP), 'mensajes', 'msj1'), { leido: true }));
  });
  test('un tercero no lee la conversación', async () => {
    await assertFails(getDoc(doc(db(U.padreQ), 'mensajes', 'msj1')));
  });
});

// ----------------------------------------------------------------------------
describe('9. Ubicación en vivo', () => {
  const posicion = { viajeId: 'viaje1', lat: 2, lng: 2, timestamp: Timestamp.now(), padreIds: [U.padreP] };
  test('el dueño del viaje publica la posición; otro conductor no', async () => {
    await assertSucceeds(setDoc(doc(db(U.condA), 'ubicaciones', 'viaje1'), posicion));
    await assertFails(setDoc(doc(db(U.condB), 'ubicaciones', 'viaje1'), posicion));
  });
  test('el padre del niño ve el bus; otro padre no', async () => {
    await assertSucceeds(getDoc(doc(db(U.padreP), 'ubicaciones', 'viaje1')));
    await assertFails(getDoc(doc(db(U.padreQ), 'ubicaciones', 'viaje1')));
  });
  test('el padre puede esperar un documento que todavía no existe', async () => {
    await assertSucceeds(getDoc(doc(db(U.padreQ), 'ubicaciones', 'viajeQueTodaviaNoSalio')));
  });
  test('el admin ve todos los buses', async () => {
    await assertSucceeds(getDocs(collection(db(U.admin), 'ubicaciones')));
  });
});

// ----------------------------------------------------------------------------
describe('10. Solicitudes', () => {
  const col = (uid) => collection(db(uid), 'solicitudes');
  test('el conductor lee las ausencias aprobadas de hoy', async () => {
    await assertSucceeds(getDocs(query(col(U.condA), where('tipo', '==', 'ausencia_dia'), where('estado', '==', 'aprobada'), where('fechaAplicacion', '==', HOY))));
  });
  test('sin filtrar por "aprobada", no', async () => {
    await assertFails(getDocs(query(col(U.condA), where('tipo', '==', 'ausencia_dia'), where('fechaAplicacion', '==', HOY))));
  });
  test('el conductor NO lee cambios de otras fechas (historial de domicilios)', async () => {
    await assertFails(getDocs(query(col(U.condA), where('tipo', '==', 'cambio_ubicacion'), where('estado', '==', 'aprobada'), where('fechaAplicacion', '==', '2020-01-01'))));
  });
  test('el conductor NO lee inscripciones', async () => {
    await assertFails(getDoc(doc(db(U.condA), 'solicitudes', 'insc1')));
  });
  test('el padre lee las suyas y avisa una ausencia ya aprobada, pero no se aprueba otra cosa', async () => {
    await assertSucceeds(getDocs(query(col(U.padreP), where('padreId', '==', U.padreP))));
    await assertSucceeds(setDoc(doc(col(U.padreP), 'a'), { tipo: 'ausencia_dia', padreId: U.padreP, estado: 'aprobada', creadaEn: Timestamp.now() }));
    await assertFails(setDoc(doc(col(U.padreP), 'b'), { tipo: 'cambio_escuela', padreId: U.padreP, estado: 'aprobada', creadaEn: Timestamp.now() }));
  });
});

// ----------------------------------------------------------------------------
describe('11. Recorridos', () => {
  const punto = () => ({ lat: 3, lng: 3, t: Timestamp.now() });
  test('el dueño agrega puntos', async () => {
    await assertSucceeds(setDoc(doc(db(U.condA), 'recorridos', 'viaje1'), { puntos: arrayUnion(punto()) }, { merge: true }));
  });
  test('el dueño empieza el recorrido de un viaje nuevo', async () => {
    await assertSucceeds(setDoc(doc(db(U.condA), 'recorridos', 'viaje2'), {
      viajeId: 'viaje2', conductorId: U.condA, puntos: arrayUnion(punto()),
    }, { merge: true }));
  });
  test('nadie reescribe por dónde pasó el bus', async () => {
    await assertFails(updateDoc(doc(db(U.condA), 'recorridos', 'viaje1'), { puntos: [punto()] }));
  });
  test('otro conductor no agrega puntos', async () => {
    await assertFails(setDoc(doc(db(U.condB), 'recorridos', 'viaje1'), { puntos: arrayUnion(punto()) }, { merge: true }));
  });
  test('el admin lo lee; el padre no', async () => {
    await assertSucceeds(getDoc(doc(db(U.admin), 'recorridos', 'viaje1')));
    await assertFails(getDoc(doc(db(U.padreP), 'recorridos', 'viaje1')));
  });
});

// ----------------------------------------------------------------------------
describe('12. Novedades del viaje', () => {
  const incidencia = (conductorId, extra = {}) => ({
    viajeId: 'viaje1', rutaId: 'ruta1', busId: 'bus1', conductorId, tipo: 'averia', texto: '',
    hora: Timestamp.now(), horaServidor: serverTimestamp(), ninosABordo: 3, ...extra,
  });
  test('el conductor reporta a su nombre con la hora del servidor', async () => {
    await assertSucceeds(setDoc(doc(db(U.condA), 'incidencias', 'i'), incidencia(U.condA)));
  });
  test('a nombre de otro, o con la hora del teléfono: rechazado', async () => {
    await assertFails(setDoc(doc(db(U.condA), 'incidencias', 'i1'), incidencia(U.condB)));
    await assertFails(setDoc(doc(db(U.condA), 'incidencias', 'i2'), incidencia(U.condA, { horaServidor: Timestamp.now() })));
  });
});
