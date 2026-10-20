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
export async function obtenerPerfilUsuario(uid: string): Promise<Usuario | null> {
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Usuario;
}

// --- Edita el propio perfil (teléfono y foto) ---
// Son los ÚNICOS campos que las reglas de Firestore dejan cambiar a cada quien
// sobre su propio documento (ver firestore.rules: `cambiados().hasOnly([...])`).
// El nombre, el correo y el rol los administra el admin desde Conductores/Padres:
// si cada uno pudiera renombrarse, alguien podría hacerse pasar por
// "Administración" en el chat.
export async function actualizarMiPerfil(
  uid: string,
  datos: { telefono?: string; foto?: string }
): Promise<void> {
  await updateDoc(doc(db, "usuarios", uid), datos);
}

// --- Envía el correo para definir una contraseña nueva ---
// Mismo mecanismo que usa el alta de usuarios: nadie maneja contraseñas en
// texto plano, el enlace va al buzón del dueño de la cuenta y es de un solo uso.
export async function enviarRecuperacionPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

// --- Se suscribe a los cambios de sesión de Firebase Auth ---
export function escucharCambiosSesion(
  callback: (firebaseUser: FirebaseUser | null) => void
) {
  return onAuthStateChanged(auth, callback);
}
