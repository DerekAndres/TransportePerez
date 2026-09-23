import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User as FirebaseUser } from "firebase/auth";
import {
  login as loginService,
  logout as logoutService,
  obtenerPerfilUsuario,
  escucharCambiosSesion,
} from "../services/authService";
import type { Usuario } from "../types/models";

interface AuthContextValue {
  usuario: Usuario | null;
  cargando: boolean;
  // Por qué se cerró la sesión sin que la persona lo pidiera (por ejemplo, la
  // administración dio de baja la cuenta). El login lo muestra; vacío si nada.
  avisoSesion: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Vuelve a leer el perfil de Firestore (ej. después de editar teléfono/foto
  // en Configuración, para que toda la app vea el dato nuevo)
  refrescarPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AVISO_CUENTA_DESACTIVADA =
  "Tu cuenta está desactivada. Comunicate con la administración de Inversiones Perez.";

// Autenticado en Firebase, pero SIN perfil en el sistema: esa cuenta no la creó
// la administración. Puede pasar porque la clave del proyecto es pública (va
// dentro de la app, es así por diseño en Firebase) y alguien podría llamar
// directo a la API para crearse una cuenta. No podría ver NADA —las reglas de
// Firestore exigen un perfil con rol—, pero sin este aviso quedaría dando
// vueltas en un login que no falla y tampoco explica nada.
const AVISO_SIN_PERFIL =
  "Ese correo no está habilitado en el sistema de Inversiones Perez. Las cuentas las crea la administración.";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [avisoSesion, setAvisoSesion] = useState("");

  useEffect(() => {
    const unsubscribe = escucharCambiosSesion(async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Se distingue "no tiene perfil" de "no se pudo leer": lo primero
        // significa que la cuenta no la creó la administración y cierra la
        // sesión; lo segundo es falta de señal y no puede acusar a nadie.
        let datos: Usuario | null = null;
        let falloLectura = false;
        try {
          datos = await obtenerPerfilUsuario(firebaseUser.uid);
        } catch {
          falloLectura = true;
        }

        // Una cuenta dada de baja puede seguir teniendo su contraseña (Firebase
        // no deja deshabilitarla sin un servidor). Las reglas de Firestore ya le
        // niegan todos los datos; acá además se cierra la sesión y se le dice
        // por qué, en vez de dejarla frente a pantallas vacías.
        if (datos?.activo === false) {
          setAvisoSesion(AVISO_CUENTA_DESACTIVADA);
          await logoutService().catch(() => {});
          return; // el cambio de sesión vuelve a entrar acá con firebaseUser = null
        }

        // Autenticado pero sin perfil: no es un usuario del sistema (ver arriba)
        if (!datos && !falloLectura) {
          setAvisoSesion(AVISO_SIN_PERFIL);
          await logoutService().catch(() => {});
          return;
        }

        setUsuario(datos);
      } else {
        setUsuario(null);
      }
      setCargando(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    setAvisoSesion("");
    await loginService(email, password);
  };

  const logout = async () => {
    await logoutService();
  };

  const refrescarPerfil = async () => {
    if (!usuario) return;
    const datos = await obtenerPerfilUsuario(usuario.id);
    if (datos?.activo === false) {
      setAvisoSesion(AVISO_CUENTA_DESACTIVADA);
      await logoutService();
      return;
    }
    if (datos) setUsuario(datos);
  };

  return (
    <AuthContext.Provider value={{ usuario, cargando, avisoSesion, login, logout, refrescarPerfil }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
}
