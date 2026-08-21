import { Redirect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import PortadaAnimada from '@/components/PortadaAnimada';

// Pantalla "despachadora": según quién esté logueado, redirige a su sección.
export default function IndexScreen() {
  const { usuario, cargando } = useAuth();

  // Mientras se resuelve la sesión, la PORTADA de la app: la marca y el busito
  // andando. Es el único momento en que el usuario ve esta pantalla.
  if (cargando) {
    return <PortadaAnimada />;
  }

  if (!usuario) {
    return <Redirect href="/login" />;
  }

  // Cuenta recién creada por el admin: primero completa su teléfono y su foto
  // (la contraseña ya la definió con el correo de Firebase). Una sola vez.
  if (usuario.debeCompletarPerfil) {
    return <Redirect href="/completar-perfil" />;
  }

  if (usuario.rol === 'conductor') {
    return <Redirect href="/hoy" />;
  }

  if (usuario.rol === 'padre') {
    return <Redirect href="/hijos" />;
  }

  // rol === 'admin': en el teléfono tiene la parte de VIGILANCIA (cómo van las
  // rutas, mensajes y avisos). Administrar —crear usuarios, buses, escuelas,
  // niños y rutas— sigue siendo del panel web.
  return <Redirect href="/monitoreo" />;
}
