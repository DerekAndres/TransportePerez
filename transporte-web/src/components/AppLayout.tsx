import { useEffect } from "react";
import { AppShell, Avatar, Burger, Button, Group, NavLink, ScrollArea, Text, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconArchive,
  IconArrowsExchange,
  IconBus,
  IconDatabase,
  IconDownload,
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
  IconShieldCheck,
  IconSpeakerphone,
  IconSteeringWheel,
  IconUsers,
} from "@tabler/icons-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { MINUTOS_INACTIVIDAD, useCierrePorInactividad } from "../hooks/use-cierre-por-inactividad";
import { recalcularAccesosSiHaceFalta } from "../services/accesoConductoresService";

// ============================================
// ESQUELETO DEL PANEL
// ============================================
// Mismo lenguaje visual que la app móvil (identidad "Aurora Caribe"): el fondo
// de luz de agua lo pinta index.css sobre el body, y acá las tres zonas del
// AppShell se dejan TRANSLÚCIDAS para que ese degradado se vea a través de todo
// el panel en lugar de quedar tapado por bloques blancos.
//
// El encabezado va esmerilado (blanco al 75 % con desenfoque): el contenido
// pasa por debajo al hacer scroll y se sigue intuyendo, que es el mismo recurso
// de vidrio que usan los velos sobre los mapas del móvil.
//
// LOS DESTINOS SE AGRUPARON. Eran dieciséis enlaces en una lista plana, y con
// esa cantidad el ojo no encuentra nada: hay que leerlos todos. Ahora están en
// cuatro bloques según para qué se entra —ver cómo va el día, mantener el
// catálogo, analizar, y las herramientas de una sola vez—, que es como el admin
// realmente usa el panel.

interface Enlace {
  ruta: string;
  etiqueta: string;
  icono: typeof IconBus;
}

interface Grupo {
  titulo: string;
  enlaces: Enlace[];
}

const GRUPOS: Grupo[] = [
  {
    // Lo del día a día: se entra acá varias veces por jornada
    titulo: "Operación",
    enlaces: [
      { ruta: "/", etiqueta: "Dashboard", icono: IconLayoutDashboard },
      { ruta: "/supervision", etiqueta: "Supervisión", icono: IconGps },
      { ruta: "/suplencias", etiqueta: "Suplencias", icono: IconArrowsExchange },
      { ruta: "/solicitudes", etiqueta: "Solicitudes", icono: IconFileCheck },
      { ruta: "/mensajes", etiqueta: "Mensajes", icono: IconMessage },
      { ruta: "/canales", etiqueta: "Canales", icono: IconSpeakerphone },
    ],
  },
  {
    // Lo que se configura y después se toca poco
    titulo: "Catálogo",
    enlaces: [
      { ruta: "/conductores", etiqueta: "Conductores", icono: IconSteeringWheel },
      { ruta: "/padres", etiqueta: "Padres", icono: IconUsers },
      { ruta: "/buses", etiqueta: "Buses", icono: IconBus },
      { ruta: "/escuelas", etiqueta: "Escuelas", icono: IconSchool },
      { ruta: "/puntos", etiqueta: "Puntos", icono: IconMapPin },
      { ruta: "/ninos", etiqueta: "Niños", icono: IconMoodKid },
      { ruta: "/rutas", etiqueta: "Rutas", icono: IconMap2 },
    ],
  },
  {
    titulo: "Análisis",
    enlaces: [
      { ruta: "/reportes", etiqueta: "Reportes", icono: IconReportAnalytics },
      { ruta: "/historial", etiqueta: "Historial", icono: IconArchive },
      { ruta: "/auditoria", etiqueta: "Auditoría", icono: IconShieldCheck },
    ],
  },
  {
    // Herramientas que se usan de vez en cuando
    titulo: "Herramientas",
    enlaces: [
      { ruta: "/respaldo", etiqueta: "Respaldo", icono: IconDownload },
      { ruta: "/migracion", etiqueta: "Migración", icono: IconRefresh },
      { ruta: "/datos-prueba", etiqueta: "Datos de prueba", icono: IconDatabase },
    ],
  },
];

export default function AppLayout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // En pantallas chicas el menú se colapsa; el burger lo abre/cierra
  const [menuAbierto, { toggle }] = useDisclosure();

  // Pasado un rato sin usar el panel, la sesión se cierra sola (ver el hook)
  useCierrePorInactividad(() => {
    logout(
      `La sesión se cerró sola después de ${MINUTOS_INACTIVIDAD} minutos sin usar el panel. Volvé a entrar.`
    );
  });

  // Una vez por día (o si quedó pendiente) se recalcula qué niños ve cada
  // conductor. Así una suplencia que ya pasó deja de dar acceso al día
  // siguiente sin que nadie se acuerde (ver accesoConductoresService.ts).
  useEffect(() => {
    recalcularAccesosSiHaceFalta().catch(() => {});
  }, []);

  const ir = (ruta: string) => {
    navigate(ruta);
    if (menuAbierto) toggle();
  };

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 248, breakpoint: "sm", collapsed: { mobile: !menuAbierto } }}
      padding="lg"
      styles={{
        header: {
          background: "rgba(255, 255, 255, 0.75)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(10, 110, 103, 0.10)",
        },
        navbar: {
          background: "rgba(255, 255, 255, 0.55)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRight: "1px solid rgba(10, 110, 103, 0.10)",
        },
        // Transparente: es lo que deja ver el degradado del body
        main: { background: "transparent" },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={menuAbierto} onClick={toggle} hiddenFrom="sm" size="sm" />
            <img
              src="/logo.png"
              alt=""
              width={32}
              height={32}
              style={{ borderRadius: 9, display: "block" }}
            />
            <Title order={4} style={{ letterSpacing: "-0.02em" }}>
              Transportes Perez
            </Title>
          </Group>

          <Group gap="sm" wrap="nowrap">
            {/* La burbuja del perfil, igual que en el móvil */}
            <Avatar color="marca" radius="xl" size={34}>
              {usuario?.nombre?.trim().charAt(0).toUpperCase() ?? "?"}
            </Avatar>
            <Text size="sm" c="dimmed" visibleFrom="sm">
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

      <AppShell.Navbar p="sm">
        <ScrollArea type="scroll">
          {GRUPOS.map((grupo) => (
            <div key={grupo.titulo} style={{ marginBottom: 18 }}>
              <Text
                size="xs"
                fw={600}
                c="dimmed"
                tt="uppercase"
                style={{ letterSpacing: "0.09em", padding: "0 10px 6px" }}
              >
                {grupo.titulo}
              </Text>
              {grupo.enlaces.map((enlace) => (
                <NavLink
                  key={enlace.ruta}
                  label={enlace.etiqueta}
                  leftSection={<enlace.icono size={18} />}
                  active={location.pathname === enlace.ruta}
                  onClick={() => ir(enlace.ruta)}
                  // Pastilla, como los destinos de la barra flotante del móvil
                  style={{ borderRadius: 12, marginBottom: 2 }}
                />
              ))}
            </div>
          ))}
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
