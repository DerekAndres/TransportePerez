import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  Timestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Mensaje } from "../types/models";

// ============================================
// FASE 7 — Chat (lado admin / web)
// ============================================
// Misma mecánica que en la app móvil (services/mensajesService.ts): el id de la
// conversación son los dos uids ordenados y unidos, y el orden por hora se hace
// en el cliente para no depender de índices compuestos. El admin es un
// participante más de la conversación (no lee las ajenas desde acá).

export function idConversacion(a: string, b: string): string {
  return [a, b].sort().join("_");
}

// --- Envía un mensaje. Nace sin leer ---
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
export function escucharConversacion(
  conversacionId: string,
  callback: (mensajes: Mensaje[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, "mensajes"), where("conversacionId", "==", conversacionId)),
    (snap) => {
      const mensajes = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Mensaje);
      mensajes.sort((a, b) => a.hora.toMillis() - b.hora.toMillis());
      callback(mensajes);
    },
    () => callback([])
  );
}

// --- Marca como leídos los mensajes que recibió `miId` y siguen sin leer ---
export async function marcarLeidos(mensajes: Mensaje[], miId: string): Promise<void> {
  const pendientes = mensajes.filter((m) => m.para === miId && !m.leido);
  if (pendientes.length === 0) return;
  const lote = writeBatch(db);
  pendientes.forEach((m) => lote.update(doc(db, "mensajes", m.id), { leido: true }));
  await lote.commit();
}

// --- Resumen de una conversación para la bandeja ---
export interface ResumenConversacion {
  otroId: string;
  ultimoTexto: string;
  ultimaHora: Timestamp;
  noLeidos: number;
}

// --- Escucha TODAS las conversaciones del admin (dos listeners combinados) ---
// Un filtro de igualdad por dirección (enviados / recibidos), unidos en memoria:
// evita el índice compuesto y da un resumen por conversación con el último
// mensaje y los no leídos.
export function escucharBandeja(
  miId: string,
  callback: (resumenes: ResumenConversacion[]) => void
): Unsubscribe {
  let enviados: Mensaje[] = [];
  let recibidos: Mensaje[] = [];
  let listoEnviados = false;
  let listoRecibidos = false;

  const emitir = () => {
    if (!listoEnviados || !listoRecibidos) return;
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
