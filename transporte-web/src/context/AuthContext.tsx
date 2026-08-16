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
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unsubscribe = escucharCambiosSesion(async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const datos = await obtenerPerfilUsuario(firebaseUser.uid);
        setUsuario(datos);
      } else {
        setUsuario(null);
      }
      setCargando(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await loginService(email, password);
  };

  const logout = async () => {
    await logoutService();
  };

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout }}>
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
