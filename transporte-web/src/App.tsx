import { Navigate, Route, Routes } from "react-router-dom";
import { Button, Center, Loader, Stack, Text, Title } from "@mantine/core";
import { useAuth } from "./context/AuthContext";
import LoginScreen from "./screens/LoginScreen";
import AppLayout from "./components/AppLayout";
import DashboardScreen from "./screens/DashboardScreen";
import GestionUsuariosScreen from "./screens/GestionUsuariosScreen";
import BusesScreen from "./screens/BusesScreen";
import EscuelasScreen from "./screens/EscuelasScreen";
import PuntosScreen from "./screens/PuntosScreen";
import RutasScreen from "./screens/RutasScreen";
import ArmadorRutaScreen from "./screens/ArmadorRutaScreen";
import NinosScreen from "./screens/NinosScreen";
import MensajesScreen from "./screens/MensajesScreen";
import SolicitudesScreen from "./screens/SolicitudesScreen";
import CanalesScreen from "./screens/CanalesScreen";
import HistorialScreen from "./screens/HistorialScreen";
import SupervisionScreen from "./screens/SupervisionScreen";
import ReportesScreen from "./screens/ReportesScreen";
import MigracionScreen from "./screens/MigracionScreen";
import DatosPruebaScreen from "./screens/DatosPruebaScreen";

function AccesoDenegado() {
  const { logout } = useAuth();

  return (
    <Center mih="100vh">
      <Stack align="center" gap="sm">
        <Title order={3}>Acceso denegado</Title>
        <Text c="dimmed">
          Esta plataforma es solo para administradores. Usá la app móvil.
        </Text>
        <Button variant="light" onClick={() => logout()}>
          Cerrar sesión
        </Button>
      </Stack>
    </Center>
  );
}

function App() {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <Center mih="100vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route
        path="/"
        element={
          !usuario ? (
            <Navigate to="/login" replace />
          ) : usuario.rol === "admin" ? (
            <AppLayout />
          ) : (
            <AccesoDenegado />
          )
        }
      >
        <Route index element={<DashboardScreen />} />
        {/* key fuerza una instancia nueva por sección (estado limpio al cambiar de rol) */}
        <Route
          path="conductores"
          element={<GestionUsuariosScreen key="conductor" rol="conductor" />}
        />
        <Route path="padres" element={<GestionUsuariosScreen key="padre" rol="padre" />} />
        <Route path="buses" element={<BusesScreen />} />
        <Route path="escuelas" element={<EscuelasScreen />} />
        <Route path="puntos" element={<PuntosScreen />} />
        <Route path="ninos" element={<NinosScreen />} />
        <Route path="rutas" element={<RutasScreen />} />
        {/* El armador es una página (no un modal): el menú lateral queda a la
            vista y el botón "atrás" del navegador funciona. */}
        <Route path="rutas/nueva" element={<ArmadorRutaScreen />} />
        <Route path="rutas/:id" element={<ArmadorRutaScreen />} />
        <Route path="mensajes" element={<MensajesScreen />} />
        <Route path="solicitudes" element={<SolicitudesScreen />} />
        <Route path="canales" element={<CanalesScreen />} />
        <Route path="supervision" element={<SupervisionScreen />} />
        <Route path="reportes" element={<ReportesScreen />} />
        <Route path="historial" element={<HistorialScreen />} />
        <Route path="migracion" element={<MigracionScreen />} />
        <Route path="datos-prueba" element={<DatosPruebaScreen />} />
      </Route>
    </Routes>
  );
}

export default App;
