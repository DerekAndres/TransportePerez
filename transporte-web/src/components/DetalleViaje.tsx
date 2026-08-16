import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Group,
  Loader,
  Paper,
  Progress,
  ScrollArea,
  Stack,
  Text,
  Timeline,
} from "@mantine/core";
import { IconAlertTriangle, IconArrowDown, IconArrowUp } from "@tabler/icons-react";
import { escucharRegistrosDeViaje } from "../services/supervisionService";
import type { Escuela, Nino, Punto, Registro, Ruta, Viaje } from "../types/models";

// Detalle de UN viaje: resumen de arriba (horas, conteos) y la línea de tiempo
// de todo lo que pasó, con la hora exacta de cada subida y bajada. Sirve igual
// para un viaje en curso (los eventos van apareciendo solos, porque escucha en
// vivo) y para uno ya terminado.

// Hora "H:mm" de un registro
function hora(momento: { toDate: () => Date }): string {
  const f = momento.toDate();
  return `${f.getHours()}:${String(f.getMinutes()).padStart(2, "0")}`;
}

// Duración legible entre dos momentos ("1 h 25 min")
function duracion(desde: Date, hasta: Date): string {
  const minutos = Math.max(0, Math.round((hasta.getTime() - desde.getTime()) / 60000));
  const h = Math.floor(minutos / 60);
  return h > 0 ? `${h} h ${minutos % 60} min` : `${minutos} min`;
}

interface Props {
  viaje: Viaje;
  ruta?: Ruta;
  ninos: Map<string, Nino>;
  escuelas: Map<string, Escuela>;
  puntos: Map<string, Punto>;
  conductorNombre: string;
  busPlaca: string;
}

export default function DetalleViaje({
  viaje,
  ruta,
  ninos,
  escuelas,
  puntos,
  conductorNombre,
  busPlaca,
}: Props) {
  const [registros, setRegistros] = useState<Registro[] | null>(null);

  // El componente se monta con key={viaje.id} desde la pantalla, así que al
  // elegir otro viaje se crea una instancia nueva y el estado arranca limpio
  // (no hace falta resetearlo acá dentro).
  useEffect(() => escucharRegistrosDeViaje(viaje.id, setRegistros), [viaje.id]);

  // Estado actual de cada niño según su último registro (misma regla que usan
  // la app del conductor y la del padre: el estado se DERIVA, no se guarda)
  const resumen = useMemo(() => {
    const total = (ruta?.ninoIds ?? []).length;
    const ultimoPorNino = new Map<string, Registro>();
    (registros ?? []).forEach((r) => ultimoPorNino.set(r.ninoId, r)); // ya vienen ordenados
    let enBus = 0;
    let entregados = 0;
    ultimoPorNino.forEach((r) => {
      if (r.evento === "subio") enBus += 1;
      else entregados += 1;
    });
    const transportados = ultimoPorNino.size; // niños que al menos subieron
    return {
      total,
      enBus,
      entregados,
      transportados,
      pendientes: Math.max(0, total - transportados),
    };
  }, [registros, ruta]);

  // Nombre del lugar donde ocurrió el evento (solo los de transbordo lo traen)
  const lugarDe = (r: Registro): string | null => {
    if (r.lugarTipo === "punto" && r.lugarId) {
      return puntos.get(r.lugarId)?.nombre ?? "Punto de transbordo";
    }
    return null;
  };

  const inicio = viaje.horaInicio?.toDate() ?? null;
  const fin = viaje.horaFin?.toDate() ?? null;

  return (
    <Stack gap="sm">
      {/* Cabecera: quién, cuándo y cuánto duró */}
      <Paper withBorder p="sm">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Text fw={600}>{ruta?.nombre ?? "Ruta"}</Text>
            <Text size="sm" c="dimmed">
              {conductorNombre} · Bus {busPlaca} · {viaje.fecha}
            </Text>
          </Box>
          <Badge color={viaje.estado === "en_curso" ? "green" : "gray"} variant="light" size="lg">
            {viaje.estado === "en_curso" ? "En curso" : "Finalizado"}
          </Badge>
        </Group>

        <Group mt="xs" gap="lg">
          <Box>
            <Text size="xs" c="dimmed">
              Inicio
            </Text>
            <Text size="sm" fw={500}>
              {inicio ? hora(viaje.horaInicio!) : "—"}
            </Text>
          </Box>
          <Box>
            <Text size="xs" c="dimmed">
              Fin
            </Text>
            <Text size="sm" fw={500}>
              {fin ? hora(viaje.horaFin!) : "En curso"}
            </Text>
          </Box>
          <Box>
            <Text size="xs" c="dimmed">
              Duración
            </Text>
            <Text size="sm" fw={500}>
              {inicio ? duracion(inicio, fin ?? new Date()) : "—"}
            </Text>
          </Box>
        </Group>

        {viaje.demorado && (
          <Alert color="orange" mt="xs" icon={<IconAlertTriangle size={16} />} p="xs">
            El conductor marcó una demora en el punto de transbordo.
          </Alert>
        )}
      </Paper>

      {/* Conteos del viaje */}
      <Paper withBorder p="sm">
        <Group justify="space-between" mb={6}>
          <Text size="sm" fw={500}>
            Niños transportados
          </Text>
          <Text size="sm" c="dimmed">
            {resumen.transportados} de {resumen.total}
          </Text>
        </Group>
        <Progress.Root size="lg">
          <Progress.Section
            value={resumen.total ? (resumen.entregados / resumen.total) * 100 : 0}
            color="blue"
          >
            <Progress.Label>{resumen.entregados}</Progress.Label>
          </Progress.Section>
          <Progress.Section
            value={resumen.total ? (resumen.enBus / resumen.total) * 100 : 0}
            color="cyan"
          >
            <Progress.Label>{resumen.enBus}</Progress.Label>
          </Progress.Section>
        </Progress.Root>
        <Group gap="lg" mt={6}>
          <Text size="xs" c="dimmed">
            <b>{resumen.entregados}</b> entregados
          </Text>
          <Text size="xs" c="dimmed">
            <b>{resumen.enBus}</b> en el bus
          </Text>
          <Text size="xs" c="dimmed">
            <b>{resumen.pendientes}</b> sin recoger
          </Text>
        </Group>
      </Paper>

      {/* Línea de tiempo con la hora exacta de cada evento */}
      <Paper withBorder p="sm" style={{ flex: 1, minHeight: 0 }}>
        <Text size="sm" fw={500} mb="sm">
          Movimientos ({registros?.length ?? 0})
        </Text>
        {registros === null ? (
          <Loader size="sm" />
        ) : registros.length === 0 ? (
          <Text c="dimmed" size="sm">
            Todavía no se registró ningún movimiento en este viaje.
          </Text>
        ) : (
          <ScrollArea.Autosize mah={340}>
            <Timeline active={registros.length} bulletSize={26} lineWidth={2}>
              {registros.map((r) => {
                const nino = ninos.get(r.ninoId);
                const lugar = lugarDe(r);
                const subio = r.evento === "subio";
                return (
                  <Timeline.Item
                    key={r.id}
                    color={subio ? "blue" : "teal"}
                    bullet={
                      subio ? <IconArrowUp size={13} /> : <IconArrowDown size={13} />
                    }
                    title={
                      <Group gap="xs" wrap="nowrap">
                        <Avatar src={nino?.foto} size={22} radius="xl" color="blue">
                          {(nino?.nombre ?? "?").trim().charAt(0).toUpperCase()}
                        </Avatar>
                        <Text size="sm" fw={500}>
                          {nino?.nombre ?? "Niño"}
                        </Text>
                        <Badge size="sm" variant="light" color={subio ? "blue" : "teal"}>
                          {subio ? "Subió" : "Bajó"}
                        </Badge>
                        <Text size="sm" c="dimmed">
                          {hora(r.hora)}
                        </Text>
                      </Group>
                    }
                  >
                    <Text size="xs" c="dimmed">
                      {lugar
                        ? `En ${lugar} (transbordo)`
                        : nino?.escuelaId
                          ? `${escuelas.get(nino.escuelaId)?.nombre ?? "Escuela"} · ${nino?.parada?.nombre ?? "Casa"}`
                          : (nino?.parada?.nombre ?? "—")}
                    </Text>
                    <Group gap={6} mt={4}>
                      {r.excepcion && (
                        <Badge size="xs" color="orange" variant="light">
                          Excepción
                        </Badge>
                      )}
                      {r.discrepancia && (
                        <Badge size="xs" color="red" variant="light">
                          Discrepancia
                        </Badge>
                      )}
                      {r.motivo && (
                        <Text size="xs" fs="italic" c="dimmed">
                          {r.motivo}
                        </Text>
                      )}
                    </Group>
                  </Timeline.Item>
                );
              })}
            </Timeline>
          </ScrollArea.Autosize>
        )}
      </Paper>
    </Stack>
  );
}
