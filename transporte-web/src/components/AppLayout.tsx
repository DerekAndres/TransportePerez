import { AppShell, Burger, Button, Group, NavLink, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconArchive,
  IconBus,
  IconDatabase,
  IconFileCheck,
  IconGps,
  IconLayoutDashboard,
  IconLogout,
  IconMap2,
  IconMapPin,
  IconMessage,
  IconMoodKid,
  IconRefresh,
  IconReportAnalytics,
  IconSchool,
  IconSpeakerphone,
  IconSteeringWheel,
  IconUsers,
} from "@tabler/icons-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const enlaces = [
  { ruta: "/", etiqueta: "Dashboard", icono: IconLayoutDashboard },
  { ruta: "/supervision", etiqueta: "Supervisión", icono: IconGps },
  { ruta: "/conductores", etiqueta: "Conductores", icono: IconSteeringWheel },
  { ruta: "/padres", etiqueta: "Padres", icono: IconUsers },
  { ruta: "/buses", etiqueta: "Buses", icono: IconBus },
  { ruta: "/escuelas", etiqueta: "Escuelas", icono: IconSchool },
  { ruta: "/puntos", etiqueta: "Puntos", icono: IconMapPin },
  { ruta: "/ninos", etiqueta: "Niños", icono: IconMoodKid },
  { ruta: "/rutas", etiqueta: "Rutas", icono: IconMap2 },
  { ruta: "/mensajes", etiqueta: "Mensajes", icono: IconMessage },
  { ruta: "/canales", etiqueta: "Canales", icono: IconSpeakerphone },
  { ruta: "/solicitudes", etiqueta: "Solicitudes", icono: IconFileCheck },
  { ruta: "/reportes", etiqueta: "Reportes", icono: IconReportAnalytics },
  { ruta: "/historial", etiqueta: "Historial", icono: IconArchive },
  { ruta: "/migracion", etiqueta: "Migración", icono: IconRefresh },
  { ruta: "/datos-prueba", etiqueta: "Datos de prueba", icono: IconDatabase },
];

export default function AppLayout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // En pantallas chicas el menú se colapsa; el burger lo abre/cierra
  const [menuAbierto, { toggle }] = useDisclosure();

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !menuAbierto } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={menuAbierto} onClick={toggle} hiddenFrom="sm" size="sm" />
            <img
              src="/logo.png"
              alt=""
              width={28}
              height={28}
              style={{ borderRadius: 6, display: "block" }}
            />
            <Title order={4}>Transporte Perez</Title>
          </Group>
          <Group>
            <Text size="sm" c="dimmed">
              {usuario?.nombre}
            </Text>
            <Button
              variant="subtle"
              size="compact-sm"
              leftSection={<IconLogout size={16} />}
              onClick={() => logout()}
            >
              Salir
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        {enlaces.map((enlace) => (
          <NavLink
            key={enlace.ruta}
            label={enlace.etiqueta}
            leftSection={<enlace.icono size={18} />}
            active={location.pathname === enlace.ruta}
            onClick={() => {
              navigate(enlace.ruta);
              if (menuAbierto) toggle();
            }}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
