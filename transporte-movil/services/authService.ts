import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { Usuario } from "../types/models";

// --- Inicia sesión con email y contraseña ---
export async function login(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

// --- Cierra la sesión actual ---
export async function logout(): Promise<void> {
  await signOut(auth);
}

// --- Busca el documento de Firestore (rol, nombre, etc.) del usuario autenticado ---
// Devuelve null SOLO si el documento no existe (esa cuenta no la creó la
// administración). Si falla la lectura —sin señal, permiso denegado— LANZA el
// error en vez de devolver null: quien llama tiene que poder distinguir "no
// está registrado" de "no se pudo averiguar", porque la primera cierra la
// sesión y la segunda no.
export async function obtenerPerfilUsuario(uid: string): Promise<Usuario | null> {
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Usuario;
}

// --- Se suscribe a los cambios de sesión de Firebase Auth ---
export function escucharCambiosSesion(
  callback: (firebaseUser: FirebaseUser | null) => void
) {
  return onAuthStateChanged(auth, callback);
}

// --- Envía el correo de restablecer contraseña de Firebase ---
// Es el MISMO mecanismo que usa el admin al crear cuentas: nadie maneja
// contraseñas en texto plano. Sirve para "¿Olvidaste tu contraseña?" del login
// y para "Cambiar contraseña" en Configuración.
//
// QUIÉN PUEDE CAMBIAR UNA CONTRASEÑA, de verdad: solo quien tenga acceso al
// BUZÓN de ese correo. Firebase manda un enlace con un código de un solo uso a
// esa casilla y a ninguna otra; escribir el correo de otra persona no cambia
// nada, solo le manda un correo a ella. Y esa casilla es la que registró la
// administración al dar de alta la cuenta, porque no hay registro público.
//
// ⚠️ ACÁ NO SE DISTINGUE si el correo está registrado o no, y es a propósito.
// Si "no existe" devolviera un error, la pantalla de acceso se convertiría en
// un buscador de clientes: probando correos, cualquiera podría averiguar qué
// familias usan Inversiones Perez. Ese caso se traga en ESTE único lugar para
// que ninguna pantalla pueda filtrar el dato sin querer.
export async function enviarRecuperacionPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error) {
    const codigo = (error as { code?: string }).code ?? "";
    if (codigo === "auth/user-not-found") return;
    // Lo demás (sin señal, demasiados intentos) sí se avisa: son problemas de
    // quien está pidiendo, no datos de terceros
    throw error;
  }
}

// --- Actualiza el perfil PROPIO (teléfono y/o foto) ---
// Las reglas de Firestore solo dejan que cada usuario cambie de su documento el
// teléfono, la foto y el token de avisos. El nombre, el correo y el rol los
// administra el panel: así nadie puede renombrarse "Administración" para
// confundir a otros en el chat.
export async function actualizarMiPerfil(
  uid: string,
  datos: { telefono?: string; foto?: string }
): Promise<void> {
  await updateDoc(doc(db, "usuarios", uid), datos);
}

// --- Cierra el alta: guarda los datos que faltaban del perfil ---
// La contraseña ya la definió el usuario en el enlace que le envió Firebase; acá
// solo completa lo que ese enlace no puede pedirle (teléfono y foto). Al quedar
// `debeCompletarPerfil` en false, la app lo deja entrar con normalidad.
export async function completarRegistro(
  uid: string,
  datos: { telefono: string; foto?: string }
): Promise<void> {
  await updateDoc(doc(db, "usuarios", uid), {
    ...datos,
    debeCompletarPerfil: false,
  });
}
