import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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

// --- Se suscribe a los cambios de sesión de Firebase Auth ---
export function escucharCambiosSesion(
  callback: (firebaseUser: FirebaseUser | null) => void
) {
  return onAuthStateChanged(auth, callback);
}
