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
export async function enviarRecuperacionPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

// --- Actualiza el perfil PROPIO (nombre, teléfono y/o foto) ---
// Las reglas permiten que cada usuario edite su documento siempre que no se
// cambie el rol — acá solo se tocan campos inofensivos.
export async function actualizarMiPerfil(
  uid: string,
  datos: { nombre?: string; telefono?: string; foto?: string }
): Promise<void> {
  await updateDoc(doc(db, "usuarios", uid), datos);
}

// --- Cierra el alta: guarda los datos que faltaban del perfil ---
// La contraseña ya la definió el usuario en el enlace que le envió Firebase; acá
// solo completa lo que ese enlace no puede pedirle (teléfono y foto). Al quedar
// `debeCompletarPerfil` en false, la app lo deja entrar con normalidad.
export async function completarRegistro(
  uid: string,
  datos: { nombre: string; telefono: string; foto?: string }
): Promise<void> {
  await updateDoc(doc(db, "usuarios", uid), {
    ...datos,
    debeCompletarPerfil: false,
  });
}
