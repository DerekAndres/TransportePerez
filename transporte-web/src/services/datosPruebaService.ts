import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Bus,
  Escuela,
  LugarRef,
  Nino,
  NinoEnRuta,
  Punto,
  Ruta,
  Usuario,
  Viaje,
} from "../types/models";

// Carga un set chico de datos de prueba para ver el sistema (incluido un
// transbordo) funcionando. Escribe con la sesión del admin, así respeta las reglas
// (no necesita clave de cuenta de servicio). Todo se nombra "(prueba)" para
// distinguirlo, y es idempotente: no duplica si ya está cargado.

export interface ResumenSeed {
  creado: boolean;
  mensaje: string;
}

const PUNTO_PRUEBA = "Plaza Cabotaje (prueba)";
// Marca de idempotencia del seed completo: si esta ruta existe, ya se cargó
const RUTA_NORTE_PRUEBA = "Norte (prueba)";

// --- Cómo se reconoce lo que cargó cualquiera de los dos botones de prueba ---
//   - escuelas, puntos y padres: llevan "(prueba)" en el nombre
//   - buses: la placa empieza con "PRU-"
//   - padres: además, su correo es de un dominio de ejemplo
//   - niños: NO se marcan, para que la pantalla se vea como en producción; se
//     los encuentra por su padre, que sí está marcado
const PREFIJO_PLACA_PRUEBA = "PRU-";
const EMAIL_PADRE_PRUEBA = "familia.prueba@example.com"; // el del primer seed
const DOMINIO_PRUEBA = "@prueba.example.com"; // los padres generados
const MARCA = "(prueba)";

const esPadreDePrueba = (email?: string) =>
  !!email && (email === EMAIL_PADRE_PRUEBA || email.endsWith(DOMINIO_PRUEBA));

// Firestore admite hasta 500 operaciones por lote
const MAX_OPS_BATCH = 500;

export async function cargarDatosDePrueba(conductor1: string, conductor2: string): Promise<ResumenSeed> {
  if (!conductor1 || !conductor2 || conductor1 === conductor2) {
    return {
      creado: false,
      mensaje: "Elegí dos conductores DISTINTOS (uno por bus).",
    };
  }

  // Idempotencia: la marca es la RUTA que crea este seed, no el punto. Antes se
  // miraba el punto, pero el otro botón ("solo niños y padres") también lo crea,
  // y entonces este quedaba bloqueado sin haber cargado nunca sus rutas.
  const yaExiste = await getDocs(
    query(collection(db, "rutas"), where("nombre", "==", RUTA_NORTE_PRUEBA))
  );
  if (!yaExiste.empty) {
    return {
      creado: false,
      mensaje:
        "Las rutas de prueba ya están cargadas. Si querés recargarlas, borrá primero los datos de prueba con el botón de abajo.",
    };
  }

  const crear = async (col: string, data: object) =>
    (await addDoc(collection(db, col), data)).id;

  // Escuelas, punto y buses se REUTILIZAN si el otro botón ya los creó, para no
  // terminar con dos "Escuela Central (prueba)" en los selectores.
  const reusarOCrear = async (
    coleccion: string,
    campo: string,
    valor: string,
    datos: object
  ): Promise<string> => {
    const existente = await getDocs(
      query(collection(db, coleccion), where(campo, "==", valor))
    );
    return existente.empty ? crear(coleccion, datos) : existente.docs[0].id;
  };

  // Escuelas
  const e1 = await reusarOCrear("escuelas", "nombre", "Escuela San José (prueba)", {
    nombre: "Escuela San José (prueba)",
    lat: 15.767,
    lng: -86.801,
    activa: true,
  });
  const e2 = await reusarOCrear("escuelas", "nombre", "Escuela Central (prueba)", {
    nombre: "Escuela Central (prueba)",
    lat: 15.773,
    lng: -86.789,
    activa: true,
  });

  // Punto de transbordo
  const p1 = await reusarOCrear("puntos", "nombre", PUNTO_PRUEBA, {
    nombre: PUNTO_PRUEBA,
    lat: 15.78,
    lng: -86.795,
    activo: true,
  });

  // Buses (uno por conductor elegido)
  const b1 = await reusarOCrear("buses", "placa", "PRU-001", {
    placa: "PRU-001",
    capacidad: 20,
    conductorId: conductor1,
    activo: true,
  });
  const b2 = await reusarOCrear("buses", "placa", "PRU-002", {
    placa: "PRU-002",
    capacidad: 20,
    conductorId: conductor2,
    activo: true,
  });

  // Padre de prueba (doc de usuario; NO puede iniciar sesión — es solo referencia)
  const padre = await reusarOCrear("usuarios", "email", EMAIL_PADRE_PRUEBA, {
    rol: "padre",
    nombre: "Familia de prueba (prueba)",
    telefono: "0000-0000",
    email: EMAIL_PADRE_PRUEBA,
    activo: true,
    creadoEn: Timestamp.now(),
  });

  // Turno según la hora actual, para que el conductor vea las rutas cuando pruebe
  // (antes del mediodía = mañana). Los niños quedan "ambos" para no depender de eso.
  const esTarde = new Date().getHours() >= 12;
  const turno = esTarde ? "tarde" : "manana";

  const casa = (nombre: string, lat: number, lng: number) => ({ nombre, lat, lng });
  const crearNino = (nombre: string, grado: string, escuelaId: string, parada: object) =>
    crear("ninos", { nombre, grado, padreId: padre, activo: true, escuelaId, turno: "ambos", parada });

  const casaBella = casa("Col. Bella Vista", 15.76, -86.81);
  const n1 = await crearNino("Juan Pérez", "3ro", e1, casaBella);
  const n2 = await crearNino("María Pérez", "1ro", e1, casaBella); // hermana, misma casa (dedup)
  const n3 = await crearNino("Pedro López", "5to", e2, casa("Barrio El Centro", 15.762, -86.803)); // TRANSBORDO
  const n4 = await crearNino("Ana Gómez", "2do", e1, casa("Res. Los Pinos", 15.758, -86.815));
  const n5 = await crearNino("Luis Cruz", "4to", e2, casa("Col. Miramar", 15.785, -86.799));

  const casaRef = (id: string): LugarRef => ({ tipo: "casa", id });
  const escuelaRef = (id: string): LugarRef => ({ tipo: "escuela", id });
  const puntoRef = (id: string): LugarRef => ({ tipo: "punto", id });

  // Extremos según el turno. Directo: mañana casa→escuela; tarde escuela→casa.
  const directo = (ninoId: string, escuelaId: string): NinoEnRuta =>
    esTarde
      ? { ninoId, subeEn: escuelaRef(escuelaId), bajaEn: casaRef(ninoId) }
      : { ninoId, subeEn: casaRef(ninoId), bajaEn: escuelaRef(escuelaId) };
  // Emisor de transbordo: entrega al niño en el punto (en vez de su destino normal).
  const emisor = (ninoId: string, escuelaId: string): NinoEnRuta =>
    esTarde
      ? { ninoId, subeEn: escuelaRef(escuelaId), bajaEn: puntoRef(p1) }
      : { ninoId, subeEn: casaRef(ninoId), bajaEn: puntoRef(p1) };
  // Receptor de transbordo: recibe al niño en el punto y lo lleva a su destino.
  const receptor = (ninoId: string, escuelaId: string): NinoEnRuta =>
    esTarde
      ? { ninoId, subeEn: puntoRef(p1), bajaEn: casaRef(ninoId) }
      : { ninoId, subeEn: puntoRef(p1), bajaEn: escuelaRef(escuelaId) };

  // Ruta A (bus 1): N1, N2, N4 directos a E1; N3 (que va a E2) lo entrega en el punto.
  // escuelaIds solo lleva E1: este bus NO pasa por E2 — por eso Pedro hace transbordo.
  const ninosA: NinoEnRuta[] = [directo(n1, e1), directo(n2, e1), directo(n4, e1), emisor(n3, e2)];
  await crear("rutas", {
    nombre: RUTA_NORTE_PRUEBA,
    busId: b1,
    turno,
    activa: true,
    escuelaIds: [e1],
    ninoIds: [n1, n2, n4, n3],
    ninos: ninosA,
  });

  // Ruta B (bus 2): recibe a N3 en el punto y lo lleva a E2; N5 directo a E2.
  const ninosB: NinoEnRuta[] = [receptor(n3, e2), directo(n5, e2)];
  await crear("rutas", {
    nombre: "Centro (prueba)",
    busId: b2,
    turno,
    activa: true,
    escuelaIds: [e2],
    ninoIds: [n3, n5],
    ninos: ninosB,
  });

  return {
    creado: true,
    mensaje:
      "Listo. Pedro López hace transbordo en Plaza Cabotaje: lo lleva el bus PRU-001 hasta el punto y lo sigue el PRU-002 hasta su escuela. (Rutas cargadas en el turno actual.)",
  };
}

// ============================================================================
// SOLO GENTE Y LUGARES (sin rutas)
// ============================================================================
// El otro botón deja dos rutas ya armadas. Este NO arma ninguna: crea escuelas,
// puntos, buses, padres y niños repartidos por colonias de La Ceiba, y deja que
// el admin arme las rutas a mano en el armador. Es la forma de probar de verdad
// la asignación con volumen: cuántos niños se piden es un parámetro, porque el
// armador se diseñó justamente para aguantar más de 100.
//
// Los niños NO se llaman "(prueba)": así la pantalla se ve como se vería en
// producción. Se los reconoce por su padre, que sí está marcado.

// Colonias reales de La Ceiba, cada una con su coordenada aproximada. Sirven
// para que la agrupación "por zona" y el orden por cercanía tengan algo de qué
// agarrarse — con todos los niños en el mismo punto no se probaría nada.
const ZONAS_LA_CEIBA = [
  { nombre: "Col. Bella Vista", lat: 15.7712, lng: -86.7935 },
  { nombre: "Barrio El Centro", lat: 15.7789, lng: -86.7935 },
  { nombre: "Col. El Sauce", lat: 15.766, lng: -86.808 },
  { nombre: "Res. Los Pinos", lat: 15.758, lng: -86.815 },
  { nombre: "Col. Miramar", lat: 15.784, lng: -86.799 },
  { nombre: "Barrio La Isla", lat: 15.782, lng: -86.786 },
  { nombre: "Col. Suyapa", lat: 15.769, lng: -86.776 },
  { nombre: "Barrio Inglés", lat: 15.786, lng: -86.78 },
  { nombre: "Col. Toronjal", lat: 15.762, lng: -86.77 },
  { nombre: "Col. San José", lat: 15.755, lng: -86.788 },
];

const ESCUELAS_PRUEBA = [
  { nombre: "Escuela San José (prueba)", lat: 15.767, lng: -86.801 },
  { nombre: "Escuela Central (prueba)", lat: 15.773, lng: -86.789 },
  { nombre: "Instituto La Ceiba (prueba)", lat: 15.775, lng: -86.77 },
];

const PUNTOS_PRUEBA = [
  { nombre: PUNTO_PRUEBA, lat: 15.78, lng: -86.795 },
  { nombre: "Parque Central (prueba)", lat: 15.779, lng: -86.793 },
];

const BUSES_PRUEBA = [
  { placa: "PRU-101", capacidad: 30 },
  { placa: "PRU-102", capacidad: 25 },
  { placa: "PRU-103", capacidad: 40 },
];

const NOMBRES = [
  "Juan", "María", "Carlos", "Ana", "Luis", "Sofía", "José", "Keyla",
  "Marco", "Gabriela", "Diego", "Wendy", "Kevin", "Karla", "Ángel", "Daniela",
  "Óscar", "Fernanda", "Elmer", "Nohemí", "Darwin", "Yulissa", "Josué", "Alejandra",
];

const APELLIDOS = [
  "Pérez", "López", "Martínez", "Cruz", "Reyes", "Fúnez", "Zelaya",
  "Mejía", "Cárcamo", "Interiano", "Bonilla", "Núñez", "Discua", "Padilla",
];

const GRADOS = ["Kínder", "1ro", "2do", "3ro", "4to", "5to", "6to", "7mo", "8vo", "9no"];

// Desplazamiento chico y REPETIBLE dentro de una colonia, para que las casas no
// caigan todas en la misma coordenada. Es un generador pseudoaleatorio simple
// (congruencial lineal): siempre da lo mismo para el mismo número, así dos
// cargas seguidas no producen un mapa distinto.
function corrimiento(semilla: number, escala = 0.005): number {
  return (((semilla * 9301 + 49297) % 233280) / 233280 - 0.5) * escala;
}

export interface ResumenNinosPrueba {
  creados: number;
  mensaje: string;
}

// Deja `objetivo` niños de prueba en total. Si ya hay algunos, crea solo los que
// faltan — así apretar el botón dos veces no duplica nada.
export async function cargarNinosDePrueba(
  objetivo: number,
  conductorIds: string[]
): Promise<ResumenNinosPrueba> {
  const leer = async <T>(nombreColeccion: string): Promise<T[]> => {
    const snap = await getDocs(collection(db, nombreColeccion));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
  };

  const [escuelas, puntos, buses, usuarios, ninos] = await Promise.all([
    leer<Escuela>("escuelas"),
    leer<Punto>("puntos"),
    leer<Bus>("buses"),
    leer<Usuario>("usuarios"),
    leer<Nino>("ninos"),
  ]);

  // Todas las escrituras se juntan y se mandan en lotes al final: con 100 niños
  // son ~150 documentos y hacerlos de a uno sería lentísimo.
  const escrituras: { ref: ReturnType<typeof doc>; datos: object }[] = [];
  const nuevo = (coleccion: string, datos: object) => {
    const ref = doc(collection(db, coleccion));
    escrituras.push({ ref, datos });
    return ref.id;
  };

  // --- Escuelas, puntos y buses: se reutilizan si ya existen ---
  const escuelaIds = ESCUELAS_PRUEBA.map((e) => {
    const existente = escuelas.find((x) => x.nombre === e.nombre);
    return existente ? existente.id : nuevo("escuelas", { ...e, activa: true });
  });

  PUNTOS_PRUEBA.forEach((p) => {
    if (!puntos.some((x) => x.nombre === p.nombre)) nuevo("puntos", { ...p, activo: true });
  });

  let busesCreados = 0;
  if (conductorIds.length > 0) {
    BUSES_PRUEBA.forEach((b, i) => {
      if (buses.some((x) => x.placa === b.placa)) return;
      nuevo("buses", {
        ...b,
        conductorId: conductorIds[i % conductorIds.length],
        activo: true,
      });
      busesCreados++;
    });
  }

  // --- Cuántos niños de prueba hay ya ---
  const idsPadresPrueba = new Set(
    usuarios.filter((u) => esPadreDePrueba(u.email)).map((u) => u.id)
  );
  const yaHay = ninos.filter((n) => idsPadresPrueba.has(n.padreId)).length;
  const faltan = Math.max(0, objetivo - yaHay);

  if (faltan === 0 && escrituras.length === 0) {
    return {
      creados: 0,
      mensaje: `Ya hay ${yaHay} niños de prueba cargados. Subí el número si querés más.`,
    };
  }

  // --- Familias: cada 3ª tiene dos hijos, para que haya hermanos ---
  // Los hermanos comparten la MISMA casa: así se prueba que el recorrido junte
  // las dos subidas en una sola parada.
  let creados = 0;
  let familia = yaHay; // sigue la numeración para no repetir correos
  while (creados < faltan) {
    const zona = ZONAS_LA_CEIBA[familia % ZONAS_LA_CEIBA.length];
    const apellido = APELLIDOS[familia % APELLIDOS.length];
    const casa = {
      nombre: zona.nombre,
      lat: zona.lat + corrimiento(familia * 2 + 1),
      lng: zona.lng + corrimiento(familia * 2 + 2),
    };

    const padreId = nuevo("usuarios", {
      rol: "padre",
      nombre: `${NOMBRES[(familia + 5) % NOMBRES.length]} ${apellido} (prueba)`,
      telefono: `9${String(1000000 + familia).slice(0, 7)}`,
      email: `padre${familia}${DOMINIO_PRUEBA}`,
      activo: true,
      creadoEn: Timestamp.now(),
    });

    const hijos = familia % 3 === 0 ? 2 : 1;
    for (let h = 0; h < hijos && creados < faltan; h++) {
      const i = creados;
      // Turnos repartidos: la mayoría de mañana o ambos, algunos solo de tarde
      const turno = i % 5 === 4 ? "tarde" : i % 5 < 2 ? "manana" : "ambos";
      nuevo("ninos", {
        nombre: `${NOMBRES[i % NOMBRES.length]} ${apellido}`,
        grado: GRADOS[i % GRADOS.length],
        padreId,
        activo: true,
        escuelaId: escuelaIds[i % escuelaIds.length],
        turno,
        parada: casa,
      });
      creados++;
    }
    familia++;
  }

  for (let desde = 0; desde < escrituras.length; desde += MAX_OPS_BATCH) {
    const lote = writeBatch(db);
    for (const e of escrituras.slice(desde, desde + MAX_OPS_BATCH)) lote.set(e.ref, e.datos);
    await lote.commit();
  }

  const partes = [`${creados} niños`];
  if (busesCreados > 0) partes.push(`${busesCreados} buses`);
  return {
    creados,
    mensaje:
      `Listo: se crearon ${partes.join(", ")} y sus padres, repartidos en ${ZONAS_LA_CEIBA.length} ` +
      `colonias y ${ESCUELAS_PRUEBA.length} escuelas. NO se creó ninguna ruta: armalas vos en la ` +
      `sección Rutas para probar el armador.` +
      (conductorIds.length === 0
        ? " (No había conductores activos, así que no se crearon buses.)"
        : ""),
  };
}

// ============================================================================
// BORRADO DE LOS DATOS DE PRUEBA
// ============================================================================
// La contracara del botón de arriba: deja la base como estaba antes del seed.
//
// Acá el borrado SÍ es físico (no el "borrado lógico" que usan Padres, Niños y
// Conductores). El archivado existe para no perder la trazabilidad de un
// servicio real; estos documentos nunca fueron un servicio real y lo que se
// busca es justamente que desaparezcan de las listas y de los reportes.
//
// No se identifican solo por el nombre: se arranca de las anclas que dejó el
// seed (los "(prueba)", las placas PRU-00x, el correo del padre ficticio) y de
// ahí se SIGUEN LAS REFERENCIAS — los niños por su padre, las rutas por su bus,
// los viajes por su ruta, los registros por su viaje. Así también se limpia lo
// que se haya generado después probando en el teléfono.

export interface InventarioPrueba {
  escuelas: string[]; // etiquetas para mostrar
  puntos: string[];
  buses: string[];
  padres: string[];
  ninos: string[];
  rutas: string[];
  viajes: number;
  registros: number;
  ubicaciones: number;
  // Rutas REALES (no de prueba) que tienen algún niño de prueba adentro: no se
  // borran, se les saca al niño para que no quede un id colgado.
  rutasALimpiar: { id: string; nombre: string; quitados: number }[];
  total: number; // documentos que se van a borrar
}

interface Hallazgo {
  escuelas: Escuela[];
  puntos: Punto[];
  buses: Bus[];
  padres: Usuario[];
  ninos: Nino[];
  rutas: Ruta[];
  viajes: Viaje[];
  registros: string[]; // ids
  ubicaciones: string[]; // ids (comparten id con su viaje)
  rutasALimpiar: { ruta: Ruta; ninoIds: string[]; ninos: NinoEnRuta[]; quitados: number }[];
}

// Busca todo lo que dejó el seed, siguiendo las referencias.
async function buscarDatosDePrueba(): Promise<Hallazgo> {
  const leer = async <T>(nombreColeccion: string): Promise<T[]> => {
    const snap = await getDocs(collection(db, nombreColeccion));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
  };

  const [escuelas, puntos, buses, usuarios, ninos, rutas] = await Promise.all([
    leer<Escuela>("escuelas"),
    leer<Punto>("puntos"),
    leer<Bus>("buses"),
    leer<Usuario>("usuarios"),
    leer<Nino>("ninos"),
    leer<Ruta>("rutas"),
  ]);

  const escuelasPrueba = escuelas.filter((e) => e.nombre?.includes(MARCA));
  const puntosPrueba = puntos.filter((p) => p.nombre?.includes(MARCA));
  const busesPrueba = buses.filter((b) => b.placa?.startsWith(PREFIJO_PLACA_PRUEBA));
  // Los padres ficticios solo existen como documento, nunca tuvieron cuenta en
  // Authentication, así que borrar el documento los elimina por completo.
  const padresPrueba = usuarios.filter((u) => esPadreDePrueba(u.email));

  const idsPadres = new Set(padresPrueba.map((p) => p.id));
  const ninosPrueba = ninos.filter((n) => idsPadres.has(n.padreId));
  const idsNinos = new Set(ninosPrueba.map((n) => n.id));

  const idsBuses = new Set(busesPrueba.map((b) => b.id));
  // Por nombre o por bus: si a la ruta le cambiaron el nombre, el bus la delata
  const rutasPrueba = rutas.filter((r) => r.nombre?.includes(MARCA) || idsBuses.has(r.busId));
  const idsRutas = new Set(rutasPrueba.map((r) => r.id));

  // Rutas REALES que quedaron con algún niño de prueba adentro (puede pasar si
  // se probó el armador con ellos). No se borran: se les quita el niño.
  const rutasALimpiar = rutas
    .filter((r) => !idsRutas.has(r.id))
    .map((ruta) => {
      const ninoIds = (ruta.ninoIds ?? []).filter((id) => !idsNinos.has(id));
      const ninosRuta = (ruta.ninos ?? []).filter((n) => !idsNinos.has(n.ninoId));
      const quitados = Math.max(
        (ruta.ninoIds ?? []).length - ninoIds.length,
        (ruta.ninos ?? []).length - ninosRuta.length
      );
      return { ruta, ninoIds, ninos: ninosRuta, quitados };
    })
    .filter((x) => x.quitados > 0);

  // Viajes de esas rutas y sus registros. Todas consultas por igualdad, sin
  // índices compuestos, igual que el resto del proyecto.
  const viajes: Viaje[] = [];
  for (const ruta of rutasPrueba) {
    const snap = await getDocs(query(collection(db, "viajes"), where("rutaId", "==", ruta.id)));
    snap.docs.forEach((d) => viajes.push({ id: d.id, ...d.data() } as Viaje));
  }

  const registros: string[] = [];
  for (const viaje of viajes) {
    const snap = await getDocs(
      query(collection(db, "registros"), where("viajeId", "==", viaje.id))
    );
    snap.docs.forEach((d) => registros.push(d.id));
  }

  // 'ubicaciones' tiene un documento por viaje EN CURSO (se borra al finalizar),
  // así que la colección entera son un puñado de documentos. Se lee completa y
  // se cruza con los viajes de prueba, en vez de suponer que existen.
  const snapUbicaciones = await getDocs(collection(db, "ubicaciones"));
  const idsViajes = new Set(viajes.map((v) => v.id));
  const ubicaciones = snapUbicaciones.docs.map((d) => d.id).filter((id) => idsViajes.has(id));

  return {
    escuelas: escuelasPrueba,
    puntos: puntosPrueba,
    buses: busesPrueba,
    padres: padresPrueba,
    ninos: ninosPrueba,
    rutas: rutasPrueba,
    viajes,
    registros,
    ubicaciones,
    rutasALimpiar,
  };
}

// Qué hay cargado, para mostrarlo ANTES de borrar nada.
export async function inspeccionarDatosDePrueba(): Promise<InventarioPrueba> {
  const h = await buscarDatosDePrueba();
  return {
    escuelas: h.escuelas.map((e) => e.nombre),
    puntos: h.puntos.map((p) => p.nombre),
    buses: h.buses.map((b) => b.placa),
    padres: h.padres.map((p) => p.nombre),
    ninos: h.ninos.map((n) => n.nombre),
    rutas: h.rutas.map((r) => r.nombre),
    viajes: h.viajes.length,
    registros: h.registros.length,
    ubicaciones: h.ubicaciones.length,
    rutasALimpiar: h.rutasALimpiar.map((x) => ({
      id: x.ruta.id,
      nombre: x.ruta.nombre,
      quitados: x.quitados,
    })),
    total:
      h.escuelas.length +
      h.puntos.length +
      h.buses.length +
      h.padres.length +
      h.ninos.length +
      h.rutas.length +
      h.viajes.length +
      h.registros.length +
      h.ubicaciones.length,
  };
}

export interface ResumenBorrado {
  borrados: number;
  rutasLimpiadas: number;
}

// Borra todo lo que encontró la inspección. Vuelve a buscar por su cuenta para
// no borrar sobre una foto vieja de la pantalla.
export async function borrarDatosDePrueba(): Promise<ResumenBorrado> {
  const h = await buscarDatosDePrueba();

  // Primero se arma la lista completa de lo que hay que hacer y recién después
  // se ejecuta. Cada operación es un dato simple, no una función: así se puede
  // contar, revisar y partir en lotes sin sorpresas.
  type Operacion =
    | { tipo: "borrar"; coleccion: string; id: string }
    | { tipo: "limpiarRuta"; id: string; ninoIds: string[]; ninos: NinoEnRuta[] };

  const operaciones: Operacion[] = [];
  const borrar = (coleccion: string, id: string) =>
    operaciones.push({ tipo: "borrar", coleccion, id });

  // De lo más dependiente a lo más base (registros antes que viajes, viajes
  // antes que rutas). Firestore no exige este orden, pero si el borrado se
  // cortara a la mitad quedarían sueltos los documentos menos importantes.
  h.registros.forEach((id) => borrar("registros", id));
  h.ubicaciones.forEach((id) => borrar("ubicaciones", id));
  h.viajes.forEach((v) => borrar("viajes", v.id));
  h.rutas.forEach((r) => borrar("rutas", r.id));
  h.ninos.forEach((n) => borrar("ninos", n.id));
  h.padres.forEach((p) => borrar("usuarios", p.id));
  h.buses.forEach((b) => borrar("buses", b.id));
  h.puntos.forEach((p) => borrar("puntos", p.id));
  h.escuelas.forEach((e) => borrar("escuelas", e.id));

  const borrados = operaciones.length;

  // Las rutas reales NO se borran: se les sacan los niños de prueba
  h.rutasALimpiar.forEach((x) =>
    operaciones.push({
      tipo: "limpiarRuta",
      id: x.ruta.id,
      ninoIds: x.ninoIds,
      ninos: x.ninos,
    })
  );

  for (let desde = 0; desde < operaciones.length; desde += MAX_OPS_BATCH) {
    const lote = writeBatch(db);
    for (const op of operaciones.slice(desde, desde + MAX_OPS_BATCH)) {
      if (op.tipo === "borrar") {
        lote.delete(doc(db, op.coleccion, op.id));
      } else {
        lote.update(doc(db, "rutas", op.id), { ninoIds: op.ninoIds, ninos: op.ninos });
      }
    }
    await lote.commit();
  }

  return { borrados, rutasLimpiadas: h.rutasALimpiar.length };
}
