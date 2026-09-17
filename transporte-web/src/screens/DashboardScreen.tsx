import { useEffect, useState } from "react";
import { Card, Group, SimpleGrid, Stack, Text, Title, UnstyledButton } from "@mantine/core";
import {
  IconAlertTriangle,
  IconBus,
  IconCircleCheck,
  IconClock,
  IconFileCheck,
  IconMap2,
  IconMoodKid,
  IconRoute,
  IconSchool,
  IconSteeringWheel,
  IconUsersGroup,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import {
  obtenerResumenHoy,
  obtenerTotales,
  type ResumenHoy,
  type Totales,
} from "../services/dashboardService";
import CargandoBus from "../components/CargandoBus";

// ============================================
// TABLERO DEL ADMIN
// ============================================
// Antes eran cinco contadores del sistema. El problema de eso es que un número
// dice cuánto hay, pero no dice QUÉ HACER: "142 niños activos" es cierto todos
// los días y no cambia ninguna decisión.
//
// Ahora la pantalla está ordenada por urgencia, de arriba hacia abajo:
//
//   1. REQUIERE ATENCIÓN — lo que está esperando una acción del admin y no
//      pasa solo. Se pinta de color únicamente cuando hay algo; en un día
//      tranquilo la fila se ve gris y eso ya es información.
//   2. CÓMO VA EL DÍA — el pulso de hoy: cuántas rutas salieron, cuántas
//      terminaron, cuántos niños viajaron.
//   3. EN EL SISTEMA — los totales de siempre, abajo y en chico, porque casi
//      nunca son lo que se vino a mirar.
//
// Las tarjetas de la primera fila son BOTONES: si algo requiere atención, hay
// que poder ir a resolverlo desde ahí y no buscarlo en el menú.

// Una tarjeta de número. `alerta` la enciende: es lo que separa "hay 3
// solicitudes esperando" de "no hay nada que hacer".
function Tarjeta({
  etiqueta,
  valor,
  icono: Icono,
  detalle,
  alerta,
  onClick,
}: {
  etiqueta: string;
  valor: number | string;
  icono: typeof IconBus;
  detalle?: string;
  alerta?: "atencion" | "problema";
  onClick?: () => void;
}) {
  const colorFondo =
    alerta === "problema" ? "#FDECEC" : alerta === "atencion" ? "#FFF6E3" : "#FFFFFF";
  const colorIcono =
    alerta === "problema" ? "#9F1218" : alerta === "atencion" ? "#8A5B00" : "#0A6E67";

  const contenido = (
    <Card padding="lg" shadow="md" style={{ backgroundColor: colorFondo, height: "100%" }}>
      <Group wrap="nowrap" gap="md">
        <Icono size={30} stroke={1.6} color={colorIcono} />
        <div>
          <Text size="1.6rem" fw={700} lh={1.1} style={{ letterSpacing: "-0.03em" }}>
            {valor}
          </Text>
          <Text size="sm" fw={500}>
            {etiqueta}
          </Text>
          {detalle && (
            <Text size="xs" c="dimmed">
              {detalle}
            </Text>
          )}
        </div>
      </Group>
    </Card>
  );

  if (!onClick) return contenido;
  return (
    <UnstyledButton onClick={onClick} style={{ height: "100%", textAlign: "left" }}>
      {contenido}
    </UnstyledButton>
  );
}

export default function DashboardScreen() {
  const navigate = useNavigate();
  const [totales, setTotales] = useState<Totales | null>(null);
  const [hoy, setHoy] = useState<ResumenHoy | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([obtenerTotales(), obtenerResumenHoy()])
      .then(([t, h]) => {
        setTotales(t);
        setHoy(h);
      })
      .catch(() => setError("No se pudieron cargar los datos del tablero."));
  }, []);

  if (error) return <Text c="red">{error}</Text>;
  if (!totales || !hoy) return <CargandoBus texto="Armando el tablero…" />;

  const fecha = new Date().toLocaleDateString("es-HN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <Stack gap="xl">
      <div>
        <Title order={2} style={{ letterSpacing: "-0.02em" }}>
          Buen día
        </Title>
        <Text c="dimmed" tt="capitalize">
          {fecha}
        </Text>
      </div>

      {/* ---------- 1. Lo que espera una acción ---------- */}
      <Stack gap="xs">
        <Text size="sm" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.08em" }}>
          Requiere tu atención
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          <Tarjeta
            etiqueta="Solicitudes sin responder"
            valor={hoy.solicitudesPendientes}
            icono={IconFileCheck}
            detalle={
              hoy.solicitudesPendientes > 0 ? "Los padres están esperando" : "Todo respondido"
            }
            alerta={hoy.solicitudesPendientes > 0 ? "atencion" : undefined}
            onClick={() => navigate("/solicitudes")}
          />
          <Tarjeta
            etiqueta="Niños que no estaban hoy"
            valor={hoy.noRecogidos}
            icono={IconAlertTriangle}
            detalle={
              hoy.noRecogidos > 0
                ? "El bus pasó y no estaban en la parada"
                : "Ningún niño quedó sin recoger"
            }
            alerta={hoy.noRecogidos > 0 ? "problema" : undefined}
            onClick={() => navigate("/reportes")}
          />
          <Tarjeta
            etiqueta="Rutas que no han salido"
            valor={hoy.rutasSinSalir}
            icono={IconRoute}
            detalle={
              hoy.rutasSinSalir > 0 ? "Todavía sin viaje registrado hoy" : "Todas salieron"
            }
            alerta={hoy.rutasSinSalir > 0 ? "atencion" : undefined}
            onClick={() => navigate("/supervision")}
          />
        </SimpleGrid>
      </Stack>

      {/* ---------- 2. El pulso del día ---------- */}
      <Stack gap="xs">
        <Text size="sm" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.08em" }}>
          Cómo va el día
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <Tarjeta
            etiqueta="Viajes en curso"
            valor={hoy.enCurso}
            icono={IconBus}
            detalle="Buses andando ahora"
            onClick={() => navigate("/supervision")}
          />
          <Tarjeta
            etiqueta="Viajes terminados"
            valor={hoy.finalizados}
            icono={IconCircleCheck}
            detalle="Ya completados hoy"
          />
          <Tarjeta
            etiqueta="Niños transportados"
            valor={hoy.ninosTransportados}
            icono={IconUsersGroup}
            detalle="Subieron al bus hoy"
          />
          <Tarjeta
            etiqueta="Viajes de hoy"
            valor={totales.viajesHoy}
            icono={IconClock}
            detalle="Registrados en total"
          />
        </SimpleGrid>
      </Stack>

      {/* ---------- 3. Los totales, al final ---------- */}
      <Stack gap="xs">
        <Text size="sm" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.08em" }}>
          En el sistema
        </Text>
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Tarjeta
            etiqueta="Niños activos"
            valor={totales.ninosActivos}
            icono={IconMoodKid}
            onClick={() => navigate("/ninos")}
          />
          <Tarjeta
            etiqueta="Buses activos"
            valor={totales.busesActivos}
            icono={IconSteeringWheel}
            onClick={() => navigate("/buses")}
          />
          <Tarjeta
            etiqueta="Rutas activas"
            valor={totales.rutasActivas}
            icono={IconMap2}
            onClick={() => navigate("/rutas")}
          />
          <Tarjeta
            etiqueta="Escuelas activas"
            valor={totales.escuelasActivas}
            icono={IconSchool}
            onClick={() => navigate("/escuelas")}
          />
        </SimpleGrid>
      </Stack>
    </Stack>
  );
}
