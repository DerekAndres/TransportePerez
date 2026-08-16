import { useEffect, useState } from "react";
import { Card, Group, Loader, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
  IconBus,
  IconMap2,
  IconMoodKid,
  IconSchool,
  IconSteeringWheel,
} from "@tabler/icons-react";
import { obtenerTotales, type Totales } from "../services/dashboardService";

export default function DashboardScreen() {
  const [totales, setTotales] = useState<Totales | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    obtenerTotales()
      .then(setTotales)
      .catch(() => setError("No se pudieron cargar los totales."));
  }, []);

  if (error) {
    return <Text c="red">{error}</Text>;
  }

  if (!totales) {
    return <Loader />;
  }

  const cards = [
    { etiqueta: "Niños activos", valor: totales.ninosActivos, icono: IconMoodKid },
    { etiqueta: "Buses activos", valor: totales.busesActivos, icono: IconBus },
    { etiqueta: "Rutas activas", valor: totales.rutasActivas, icono: IconMap2 },
    { etiqueta: "Escuelas activas", valor: totales.escuelasActivas, icono: IconSchool },
    { etiqueta: "Viajes de hoy", valor: totales.viajesHoy, icono: IconSteeringWheel },
  ];

  return (
    <Stack>
      <Title order={3}>Dashboard</Title>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        {cards.map((card) => (
          <Card key={card.etiqueta} withBorder padding="lg">
            <Group>
              <card.icono size={32} stroke={1.5} />
              <div>
                <Text size="xl" fw={700}>
                  {card.valor}
                </Text>
                <Text size="sm" c="dimmed">
                  {card.etiqueta}
                </Text>
              </div>
            </Group>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
