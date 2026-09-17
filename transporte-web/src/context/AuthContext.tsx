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
  // Por qué se cerró la sesión sin que la persona lo pidiera (cuenta dada de
  // baja, inactividad). La pantalla de login lo muestra; vacío si no hay nada.
  avisoSesion: string;
  login: (email: string, password: string) => Promise<void>;
  logout: (motivo?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AVISO_CUENTA_DESACTIVADA =
  "Tu cuenta está desactivada. Comunicate con la administración de Inversiones Perez.";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [avisoSesion, setAvisoSesion] = useState("");

  useEffect(() => {
    const unsubscribe = escucharCambiosSesion(async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const datos = await obtenerPerfilUsuario(firebaseUser.uid).catch(() => null);
        // Una cuenta dada de baja puede seguir teniendo la contraseña: Firebase
        // Authentication no deja deshabilitarla sin un servidor. Las reglas de
        // Firestore ya le niegan todos los datos; acá además se cierra la sesión
        // y se le dice por qué, en vez de dejarla frente a un panel vacío.
        if (datos?.activo === false) {
          setAvisoSesion(AVISO_CUENTA_DESACTIVADA);
          await logoutService();
          return; // el cambio de sesión vuelve a entrar acá con firebaseUser = null
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

  const logout = async (motivo?: string) => {
    setAvisoSesion(motivo ?? "");
    await logoutService();
  };

  return (
    <AuthContext.Provider value={{ usuario, cargando, avisoSesion, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- Provider y hook juntos a propósito: es el patrón estándar de Context y mantiene todo lo de sesión en un solo archivo
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
}
