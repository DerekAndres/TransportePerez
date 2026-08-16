import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  Timestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Mensaje, Usuario } from "../types/models";

// ============================================
// FASE 7 — Chat padre ↔ conductor / administración
// ============================================
// Un chat es una conversación entre DOS usuarios. Su id es determinístico: los
// dos uids ordenados alfabéticamente y unidos. Así da igual quién escriba
// primero, ambos calculan el mismo `conversacionId` y ven el mismo hilo.
//
// Todas las consultas usan solo filtros de igualdad (sin orderBy en servidor):
// el orden por hora se resuelve en el cliente, para no depender de índices
// compuestos (misma convención que el resto del proyecto).

export function idConversacion(a: string, b: string): string {
  return [a, b].sort().join("_");
}

// --- Envía un mensaje. Nace sin leer; el destinatario lo marca al abrir el chat ---
export async function enviarMensaje(de: string, para: string, texto: string): Promise<void> {
  const limpio = texto.trim();
  if (!limpio) return;
  await addDoc(collection(db, "mensajes"), {
    conversacionId: idConversacion(de, para),
    de,
    para,
    texto: limpio,
    hora: Timestamp.now(),
    leido: false,
  });
}

// --- Escucha EN TIEMPO REAL una conversación, ordenada por hora (cliente) ---
// Usa DOS consultas (los mensajes que YO envié + los que YO recibí) en vez de
// una sola por conversacionId. Motivo: las reglas de Firestore solo permiten
// leer mensajes donde soy `de` o `para`, y en una consulta de LISTA eso tiene
// que ser demostrable desde los propios filtros — filtrar solo por
// conversacionId no lo demuestra y Firestore rechaza la consulta entera.
// Fijar de==yo (o para==yo) con igualdad sí lo demuestra. Es el mismo patrón
// de dos listeners que ya usa escucharBandeja, abajo. (En la web del admin la
// consulta simple funciona porque el admin pasa por esAdmin() en la regla.)
export function escucharConversacion(
  conversacionId: string,
  miId: string,
  callback: (mensajes: Mensaje[]) => void
): Unsubscribe {
  let enviados: Mensaje[] = [];
  let recibidos: Mensaje[] = [];
  let listoEnviados = false;
  let listoRecibidos = false;

  const emitir = () => {
    if (!listoEnviados || !listoRecibidos) return; // espera la primera lectura de ambos
    const mensajes = [...enviados, ...recibidos];
    mensajes.sort((a, b) => a.hora.toMillis() - b.hora.toMillis());
    callback(mensajes);
  };

  const desEnviados = onSnapshot(
    query(
      collection(db, "mensajes"),
      where("conversacionId", "==", conversacionId),
      where("de", "==", miId)
    ),
    (snap) => {
      enviados = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Mensaje);
      listoEnviados = true;
      emitir();
    },
    () => {
      listoEnviados = true;
      emitir();
    }
  );
  const desRecibidos = onSnapshot(
    query(
      collection(db, "mensajes"),
      where("conversacionId", "==", conversacionId),
      where("para", "==", miId)
    ),
    (snap) => {
      recibidos = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Mensaje);
      listoRecibidos = true;
      emitir();
    },
    () => {
      listoRecibidos = true;
      emitir();
    }
  );

  return () => {
    desEnviados();
    desRecibidos();
  };
}

// --- Marca como leídos los mensajes que YO recibí (soy `para`) y siguen sin leer ---
// Se llama al abrir/actualizar el chat. Un solo batch para no gastar N escrituras
// sueltas. Los mensajes que envié no se tocan.
export async function marcarLeidos(mensajes: Mensaje[], miId: string): Promise<void> {
  const pendientes = mensajes.filter((m) => m.para === miId && !m.leido);
  if (pendientes.length === 0) return;
  const lote = writeBatch(db);
  pendientes.forEach((m) => lote.update(doc(db, "mensajes", m.id), { leido: true }));
  await lote.commit();
}

// --- Resumen de una conversación para la bandeja de entrada ---
export interface ResumenConversacion {
  otroId: string; // el otro participante (no yo)
  ultimoTexto: string;
  ultimaHora: Timestamp;
  noLeidos: number;
}

// --- Escucha TODAS mis conversaciones y arma un resumen por cada una ---
// Usa DOS listeners (los mensajes que envié + los que recibí), cada uno con un
// filtro de igualdad simple (auto-indexado). Se combinan en memoria: así una
// bandeja completa no necesita índice compuesto ni un listener por contacto.
export function escucharBandeja(
  miId: string,
  callback: (resumenes: ResumenConversacion[]) => void
): Unsubscribe {
  let enviados: Mensaje[] = [];
  let recibidos: Mensaje[] = [];
  let listoEnviados = false;
  let listoRecibidos = false;

  const emitir = () => {
    if (!listoEnviados || !listoRecibidos) return; // espera la primera lectura de ambos
    const porConversacion = new Map<string, Mensaje[]>();
    for (const m of [...enviados, ...recibidos]) {
      const arr = porConversacion.get(m.conversacionId);
      if (arr) arr.push(m);
      else porConversacion.set(m.conversacionId, [m]);
    }
    const resumenes: ResumenConversacion[] = [];
    porConversacion.forEach((mensajes) => {
      mensajes.sort((a, b) => a.hora.toMillis() - b.hora.toMillis());
      const ultimo = mensajes[mensajes.length - 1];
      resumenes.push({
        otroId: ultimo.de === miId ? ultimo.para : ultimo.de,
        ultimoTexto: ultimo.texto,
        ultimaHora: ultimo.hora,
        noLeidos: mensajes.filter((m) => m.para === miId && !m.leido).length,
      });
    });
    resumenes.sort((a, b) => b.ultimaHora.toMillis() - a.ultimaHora.toMillis());
    callback(resumenes);
  };

  const desEnviados = onSnapshot(
    query(collection(db, "mensajes"), where("de", "==", miId)),
    (snap) => {
      enviados = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Mensaje);
      listoEnviados = true;
      emitir();
    },
    () => {
      listoEnviados = true;
      emitir();
    }
  );
  const desRecibidos = onSnapshot(
    query(collection(db, "mensajes"), where("para", "==", miId)),
    (snap) => {
      recibidos = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Mensaje);
      listoRecibidos = true;
      emitir();
    },
    () => {
      listoRecibidos = true;
      emitir();
    }
  );

  return () => {
    desEnviados();
    desRecibidos();
  };
}

// --- Cuenta EN VIVO el total de mensajes que recibí sin leer (para el badge del
// botón "Mensajes"). Un solo listener con filtro de igualdad ---
export function escucharTotalNoLeidos(
  miId: string,
  callback: (total: number) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "mensajes"), where("para", "==", miId)),
    (snap) => callback(snap.docs.filter((d) => (d.data() as Mensaje).leido === false).length),
    () => callback(0)
  );
}

// --- Todos los usuarios (para resolver nombres/teléfonos y encontrar al admin) ---
// Cualquier autenticado puede leer usuarios (regla de Fase 7): el chat necesita
// mostrar el nombre del otro y su teléfono para la llamada directa.
export async function listarUsuarios(): Promise<Usuario[]> {
  const snap = await getDocs(collection(db, "usuarios"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Usuario);
}
