import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import {
  collection,
  deleteField,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, firebaseConfig } from "./firebase";
import { auditar } from "./auditoriaService";
import type { Nino, Rol, Usuario } from "../types/models";

// Dar de alta, dar de baja, archivar y restaurar una cuenta son cambios
// SENSIBLES: van en un lote junto con su registro de auditoría (ver
// auditoriaService.ts). Editar nombre, teléfono o foto no lo es.

// --- Lista todos los usuarios, ordenados por nombre ---
export async function listarUsuarios(): Promise<Usuario[]> {
  const snap = await getDocs(query(collection(db, "usuarios"), orderBy("nombre")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Usuario);
}

// --- Crea un conductor o padre (registro cerrado: solo el admin crea cuentas) ---
//
// Problema: crear un usuario con el SDK cliente inicia sesión automáticamente
// con esa cuenta nueva, deslogueando al admin. Solución: usamos una SEGUNDA
// instancia de Firebase App solo para este flujo — el usuario nuevo queda
// logueado en esa instancia descartable y la sesión del admin (instancia
// principal) no se toca. Así evitamos necesitar Cloud Functions/Admin SDK.
//
// Entrega de contraseña: la cuenta se crea con una contraseña aleatoria que
// NADIE ve, y Firebase le envía al usuario su correo de restablecimiento para
// que defina la suya. Nadie maneja contraseñas en texto plano, y el correo lo
// manda la infraestructura de Google (gratis en plan Spark, sin servicios de
// terceros).
//
// El usuario nace con `debeCompletarPerfil: true`: después de definir su
// contraseña e iniciar sesión, la app lo lleva una única vez a completar su
// perfil (teléfono y foto) antes de dejarlo entrar.
export async function crearUsuario(datos: {
  nombre: string;
  telefono: string;
  email: string;
  rol: Rol;
  foto?: string; // base64 comprimida (opcional; el usuario también puede subirla desde la app)
}): Promise<void> {
  const appSecundaria = initializeApp(firebaseConfig, "secundaria");
  const authSecundaria = getAuth(appSecundaria);

  try {
    // Contraseña temporal aleatoria — el usuario nunca la conoce
    const passwordTemporal = crypto.randomUUID();

    const credencial = await createUserWithEmailAndPassword(
      authSecundaria,
      datos.email,
      passwordTemporal
    );
    const uid = credencial.user.uid;

    // El doc de Firestore se escribe con la sesión del ADMIN (instancia
    // principal), porque las reglas solo permiten crear usuarios a un admin, y
    // en el mismo lote que su registro de auditoría
    const lote = writeBatch(db);
    const auditoriaId = auditar(
      lote,
      "usuarios",
      "crear",
      [uid],
      `Alta de ${datos.rol} ${datos.nombre} (${datos.email})`
    );
    lote.set(doc(db, "usuarios", uid), {
      rol: datos.rol,
      nombre: datos.nombre,
      telefono: datos.telefono,
      email: datos.email,
      ...(datos.foto ? { foto: datos.foto } : {}),
      // Al entrar por primera vez tendrá que completar teléfono y foto
      debeCompletarPerfil: true,
      activo: true,
      creadoEn: Timestamp.now(),
      auditoriaId,
    });
    await lote.commit();

    // Email para que el usuario defina su propia contraseña
    await sendPasswordResetEmail(authSecundaria, datos.email);

    // Cerramos la sesión del usuario nuevo en la instancia descartable
    await signOut(authSecundaria);
  } finally {
    // Liberamos la instancia secundaria (permite volver a crearla después)
    await deleteApp(appSecundaria);
  }
}

// --- Reenvía el correo de Firebase para definir/restablecer la contraseña ---
// Se usa cuando el usuario no recibió el correo original o lo perdió. Va por una
// instancia secundaria para no tocar la sesión del admin.
export async function enviarCorreoRestablecer(email: string): Promise<void> {
  const appSecundaria = initializeApp(firebaseConfig, "secundaria-reset");
  try {
    await sendPasswordResetEmail(getAuth(appSecundaria), email);
  } finally {
    await deleteApp(appSecundaria);
  }
}

// --- Actualiza nombre/teléfono/foto de un usuario existente ---
// El nombre lo administra SOLO el panel: desde la app el usuario no puede
// cambiárselo (así nadie se renombra "Administración" para confundir en el chat).
export async function actualizarUsuario(
  id: string,
  datos: { nombre: string; telefono: string; foto?: string }
): Promise<void> {
  await updateDoc(doc(db, "usuarios", id), datos);
}

// --- Activa o desactiva un usuario (no se borran: se conserva el historial) ---
// Desactivar es lo que le quita el acceso: las reglas de Firestore rechazan todo
// lo que pida una cuenta con activo == false, aunque tenga la sesión abierta.
export async function cambiarActivoUsuario(id: string, activo: boolean): Promise<void> {
  const lote = writeBatch(db);
  const auditoriaId = auditar(
    lote,
    "usuarios",
    activo ? "activar" : "desactivar",
    [id],
    activo ? "Cuenta reactivada" : "Cuenta desactivada: ya no puede usar la app"
  );
  lote.update(doc(db, "usuarios", id), { activo, auditoriaId });
  await lote.commit();
}

// --- Los hijos de un padre (para saber a cuántos alcanza el archivado) ---
export async function listarHijosDePadre(padreId: string): Promise<Nino[]> {
  const snap = await getDocs(query(collection(db, "ninos"), where("padreId", "==", padreId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Nino);
}

// --- Archiva un usuario ("eliminar") y, si es padre, también a sus hijos ---
// No borra nada: marca `eliminado` y apaga `activo`, así desaparece de todas las
// listas y selectores (que ya filtran por activo) pero sigue existiendo para los
// reportes históricos y para la pantalla de Historial. Ver el bloque
// "BORRADO LÓGICO" en models.ts para el porqué.
//
// Todo va en un solo lote: o se archivan el padre y sus hijos, o no se archiva
// nada. Nunca queda un niño suelto sin padre. El usuario y los niños llevan cada
// uno su registro de auditoría, porque las reglas los validan por colección.
export async function eliminarUsuario(usuario: Usuario, motivo: string): Promise<void> {
  const lote = writeBatch(db);
  const marca = {
    eliminado: true,
    eliminadoEn: Timestamp.now(),
    motivoEliminacion: motivo,
    activo: false,
  };

  const auditoriaUsuario = auditar(
    lote,
    "usuarios",
    "archivar",
    [usuario.id],
    `Archivó a ${usuario.nombre}. Motivo: ${motivo || "—"}`
  );
  lote.update(doc(db, "usuarios", usuario.id), { ...marca, auditoriaId: auditoriaUsuario });

  if (usuario.rol === "padre") {
    const hijos = await listarHijosDePadre(usuario.id);
    if (hijos.length > 0) {
      const auditoriaHijos = auditar(
        lote,
        "ninos",
        "archivar",
        hijos.map((h) => h.id),
        `Archivados junto con su padre, ${usuario.nombre}`
      );
      hijos.forEach((h) =>
        lote.update(doc(db, "ninos", h.id), { ...marca, auditoriaId: auditoriaHijos })
      );
    }
  }

  await lote.commit();
}

// --- Restaura un usuario archivado (y sus hijos, si es padre) ---
// Quita las marcas de archivado y lo vuelve a activar. `deleteField()` borra el
// campo del documento en vez de dejarlo en false: así el documento queda igual
// que antes de archivarse, sin residuos.
export async function restaurarUsuario(usuario: Usuario): Promise<void> {
  const lote = writeBatch(db);
  const restaurar = {
    eliminado: deleteField(),
    eliminadoEn: deleteField(),
    motivoEliminacion: deleteField(),
    activo: true,
  };

  const auditoriaUsuario = auditar(
    lote,
    "usuarios",
    "restaurar",
    [usuario.id],
    `Restauró a ${usuario.nombre}`
  );
  lote.update(doc(db, "usuarios", usuario.id), { ...restaurar, auditoriaId: auditoriaUsuario });

  if (usuario.rol === "padre") {
    const hijos = (await listarHijosDePadre(usuario.id)).filter((h) => h.eliminado);
    if (hijos.length > 0) {
      const auditoriaHijos = auditar(
        lote,
        "ninos",
        "restaurar",
        hijos.map((h) => h.id),
        `Restaurados junto con su padre, ${usuario.nombre}`
      );
      hijos.forEach((h) =>
        lote.update(doc(db, "ninos", h.id), { ...restaurar, auditoriaId: auditoriaHijos })
      );
    }
  }

  await lote.commit();
}
