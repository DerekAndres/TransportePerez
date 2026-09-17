import { useState } from "react";
import { Button, Card, Divider, List, Progress, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconKey, IconRefresh } from "@tabler/icons-react";
import { migrarRutas, type ResumenMigracion } from "../services/migracionService";
import { recalcularAccesosConductores } from "../services/accesoConductoresService";

// Herramienta de un solo uso: convierte las rutas al formato nuevo (paradas +
// transbordo). Es idempotente, así que se puede correr varias veces sin problema.
export default function MigracionScreen() {
  const [corriendo, setCorriendo] = useState(false);
  const [progreso, setProgreso] = useState({ procesadas: 0, total: 0 });
  const [resumen, setResumen] = useState<ResumenMigracion | null>(null);
  const [error, setError] = useState("");
  const [recalculando, setRecalculando] = useState(false);

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

  // Se hace sola al guardar rutas, unidades y suplencias, y una vez por día al
  // abrir el panel. Este botón es para forzarla (por ejemplo, la primera vez
  // después de publicar las reglas nuevas, o si un guardado quedó a medias).
  const recalcular = async () => {
    setRecalculando(true);
    try {
      const { actualizados } = await recalcularAccesosConductores();
      notifications.show({
        color: "green",
        message:
          actualizados > 0
            ? `Listo: se actualizaron ${actualizados} niño(s).`
            : "Listo: ya estaba todo al día.",
      });
    } catch {
      notifications.show({ color: "red", message: "No se pudieron recalcular los accesos." });
    } finally {
      setRecalculando(false);
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

      <Divider my="sm" />

      <Title order={4}>Qué niños ve cada conductor</Title>
      <Text c="dimmed" size="sm">
        Por seguridad, cada conductor solo puede leer en su app a los niños que lleva: los de las
        rutas de su unidad, más los de la unidad que cubre si tiene una suplencia. Esa lista se
        recalcula sola al guardar rutas, unidades o suplencias, y una vez por día al abrir el panel.
        Usá este botón la primera vez que se publiquen las reglas nuevas, o si un conductor dice que
        le falta un niño en su lista.
      </Text>
      <Button
        leftSection={<IconKey size={16} />}
        variant="light"
        onClick={recalcular}
        loading={recalculando}
        w="fit-content"
      >
        Recalcular accesos ahora
      </Button>
    </Stack>
  );
}
