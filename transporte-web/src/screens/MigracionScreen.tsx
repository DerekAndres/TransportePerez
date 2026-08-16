import { useState } from "react";
import { Button, Card, List, Progress, Stack, Text, Title } from "@mantine/core";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { migrarRutas, type ResumenMigracion } from "../services/migracionService";

// Herramienta de un solo uso: convierte las rutas al formato nuevo (paradas +
// transbordo). Es idempotente, así que se puede correr varias veces sin problema.
export default function MigracionScreen() {
  const [corriendo, setCorriendo] = useState(false);
  const [progreso, setProgreso] = useState({ procesadas: 0, total: 0 });
  const [resumen, setResumen] = useState<ResumenMigracion | null>(null);
  const [error, setError] = useState("");

  const correr = async () => {
    setCorriendo(true);
    setResumen(null);
    setError("");
    setProgreso({ procesadas: 0, total: 0 });
    try {
      const r = await migrarRutas((procesadas, total) => setProgreso({ procesadas, total }));
      setResumen(r);
    } catch {
      setError(
        "La migración falló. Podés volver a correrla: las rutas ya migradas se saltan."
      );
    } finally {
      setCorriendo(false);
    }
  };

  const pct =
    progreso.total > 0 ? Math.round((progreso.procesadas / progreso.total) * 100) : 0;

  return (
    <Stack maw={640}>
      <Title order={3}>Migración de rutas</Title>
      <Text c="dimmed" size="sm">
        Convierte las rutas al formato nuevo (con paradas y transbordo). Es seguro correrla
        varias veces: las rutas que ya están migradas se saltan. No modifica los niños
        asignados a cada ruta ni los deja como transbordo — todos quedan como directos
        (casa ↔ escuela según el turno).
      </Text>

      <Button
        leftSection={<IconRefresh size={16} />}
        onClick={correr}
        loading={corriendo}
        w="fit-content"
      >
        Migrar rutas
      </Button>

      {corriendo && (
        <Stack gap={4}>
          <Text size="sm">
            Procesando {progreso.procesadas} de {progreso.total}…
          </Text>
          <Progress value={pct} />
        </Stack>
      )}

      {error && <Text c="red">{error}</Text>}

      {resumen && (
        <Card withBorder>
          <Stack gap="xs">
            <Text fw={600}>Resultado</Text>
            <Text>Total de rutas: {resumen.total}</Text>
            <Text c="green">Migradas: {resumen.migradas}</Text>
            <Text c="dimmed">Saltadas (ya estaban en formato nuevo): {resumen.saltadas}</Text>
            <Text c={resumen.errores.length ? "red" : "dimmed"}>
              Con error: {resumen.errores.length}
            </Text>
            {resumen.errores.length > 0 && (
              <List size="sm" icon={<IconAlertTriangle size={14} color="red" />}>
                {resumen.errores.map((e, i) => (
                  <List.Item key={i}>
                    {e.ruta}: {e.motivo}
                  </List.Item>
                ))}
              </List>
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
