import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Drawer,
  Flex,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconBus,
  IconClock,
  IconInfoCircle,
  IconMapPin,
  IconRoute,
} from "@tabler/icons-react";
import { listarRutas } from "../services/rutasService";
import { listarBuses } from "../services/busesService";
import { listarUsuarios } from "../services/usuariosService";
import { listarNinos } from "../services/ninosService";
import { listarEscuelas } from "../services/escuelasService";
import { listarPuntos } from "../services/puntosService";
import {
  escucharUbicaciones,
  escucharViajesDeFecha,
  listarCambiosPuntuales,
} from "../services/supervisionService";
import MapaBuses, { type BusEnVivo } from "../components/MapaBuses";
import DetalleViaje from "../components/DetalleViaje";
import { derivarRecorrido } from "../utils/recorrido";
import type {
  Bus,
  Escuela,
  Nino,
  Punto,
  Ruta,
  Solicitud,
  UbicacionActual,
  Usuario,
  Viaje,
} from "../types/models";

// Fecha local "YYYY-MM-DD" (mismo formato que Viaje.fecha)
function fechaDeHoy(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

function hora(momento?: { toDate: () => Date }): string {
  if (!momento) return "—";
  const f = momento.toDate();
  return `${f.getHours()}:${String(f.getMinutes()).padStart(2, "0")}`;
}

// Pantalla de supervisión: el mapa con TODOS los buses en viaje ahora mismo, y
// al costado el día completo — los viajes en curso y los ya finalizados. Al
// elegir uno se abre su detalle con la hora exacta de cada subida y bajada.
export default function SupervisionScreen() {
  // Datos que cambian poco: se cargan una vez para resolver nombres
  const [rutas, setRutas] = useState<Map<string, Ruta>>(new Map());
  const [buses, setBuses] = useState<Map<string, Bus>>(new Map());
  const [usuarios, setUsuarios] = useState<Map<string, Usuario>>(new Map());
  const [ninos, setNinos] = useState<Map<string, Nino>>(new Map());
  const [escuelas, setEscuelas] = useState<Map<string, Escuela>>(new Map());
  const [puntos, setPuntos] = useState<Map<string, Punto>>(new Map());
  const [cargandoLabels, setCargandoLabels] = useState(true);

  // Datos en vivo
  const [fecha, setFecha] = useState(fechaDeHoy());
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [ubicaciones, setUbicaciones] = useState<Map<string, UbicacionActual>>(new Map());
  const [detalleId, setDetalleId] = useState<string | null>(null);
  // Qué se muestra en el mapa: "todos" los buses, o el viaje elegido con su ruta
  const [enfoqueId, setEnfoqueId] = useState<string>("todos");
  const [verRecorrido, setVerRecorrido] = useState(true);
  // Cambios de ubicación de un día aprobados para la fecha (ninoId → solicitud)
  const [cambiosDelDia, setCambiosDelDia] = useState<Map<string, Solicitud>>(new Map());

  useEffect(() => {
    Promise.all([
      listarRutas(),
      listarBuses(),
      listarUsuarios(),
      listarNinos(),
      listarEscuelas(),
      listarPuntos(),
    ])
      .then(([rs, bs, us, ns, es, ps]) => {
        setRutas(new Map(rs.map((r) => [r.id, r])));
        setBuses(new Map(bs.map((b) => [b.id, b])));
        setUsuarios(new Map(us.map((u) => [u.id, u])));
        setNinos(new Map(ns.map((n) => [n.id, n])));
        setEscuelas(new Map(es.map((e) => [e.id, e])));
        setPuntos(new Map(ps.map((p) => [p.id, p])));
      })
      .finally(() => setCargandoLabels(false));
  }, []);

  useEffect(() => escucharViajesDeFecha(fecha, setViajes), [fecha]);
  useEffect(() => escucharUbicaciones(setUbicaciones), []);

  // Cambios de un día de esa fecha: el recorrido del mapa refleja lo mismo que
  // ve el conductor (una parada movida "solo hoy")
  useEffect(() => {
    let cancelado = false;
    listarCambiosPuntuales(fecha)
      .then((lista) => {
        if (cancelado) return;
        setCambiosDelDia(
          new Map(lista.filter((s) => s.ninoId).map((s) => [s.ninoId as string, s]))
        );
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [fecha]);

  // Al cambiar de fecha se vuelve a "todos" en el mismo acto (no en un efecto):
  // el viaje que estaba enfocado no existe en la fecha nueva
  const cambiarFecha = (nueva: string) => {
    setFecha(nueva || fechaDeHoy());
    setEnfoqueId("todos");
  };

  // Arma la fila de cada viaje con sus nombres y si tiene señal GPS
  const filas = useMemo(
    () =>
      viajes
        .map((viaje) => ({
          viaje,
          ruta: rutas.get(viaje.rutaId),
          rutaNombre: rutas.get(viaje.rutaId)?.nombre ?? "Ruta",
          busPlaca: buses.get(viaje.busId)?.placa ?? "—",
          conductorNombre: usuarios.get(viaje.conductorId)?.nombre ?? "—",
          conductorFoto: usuarios.get(viaje.conductorId)?.foto,
          ubic: ubicaciones.get(viaje.id),
        }))
        // Los más recientes primero
        .sort(
          (a, b) =>
            (b.viaje.horaInicio?.toMillis() ?? 0) - (a.viaje.horaInicio?.toMillis() ?? 0)
        ),
    [viajes, rutas, buses, usuarios, ubicaciones]
  );

  const enCurso = filas.filter((f) => f.viaje.estado === "en_curso");
  const finalizados = filas.filter((f) => f.viaje.estado === "finalizado");

  // El viaje enfocado (si se eligió uno en el selector)
  const enfocado = enfoqueId === "todos" ? null : (filas.find((f) => f.viaje.id === enfoqueId) ?? null);

  // Solo los que tienen ubicación van al mapa; con un bus enfocado, solo ese
  const busesEnVivo: BusEnVivo[] = enCurso
    .filter((f) => f.ubic && (!enfocado || f.viaje.id === enfocado.viaje.id))
    .map((f) => ({
      viajeId: f.viaje.id,
      lat: f.ubic!.lat,
      lng: f.ubic!.lng,
      titulo: f.rutaNombre,
      subtitulo: `${f.conductorNombre} · ${f.busPlaca}`,
    }));

  // El recorrido de la ruta enfocada: el MISMO que ve el conductor en su
  // teléfono (misma derivación, incluidos los cambios de un día)
  const recorrido =
    enfocado?.ruta && verRecorrido
      ? derivarRecorrido(
          enfocado.ruta,
          [...ninos.values()],
          [...escuelas.values()],
          [...puntos.values()],
          enfocado.ruta.turno ?? "manana",
          cambiosDelDia
        )
      : [];

  const detalle = filas.find((f) => f.viaje.id === detalleId) ?? null;
  const esHoy = fecha === fechaDeHoy();

  // Opciones del selector: todos, o cada viaje de la fecha
  const opcionesMapa = [
    { value: "todos", label: `Todos los buses (${enCurso.length} en curso)` },
    ...filas.map((f) => ({
      value: f.viaje.id,
      label: `${f.rutaNombre} — ${f.conductorNombre} (${f.busPlaca})`,
    })),
  ];

  if (cargandoLabels) {
    return <Loader />;
  }

  // Una fila de la lista lateral: se puede enfocar en el mapa o abrir su detalle
  const fila = (f: (typeof filas)[number]) => {
    const esEnfocado = enfoqueId === f.viaje.id;
    return (
      <Paper
        key={f.viaje.id}
        withBorder
        p="xs"
        bg={esEnfocado ? "var(--mantine-color-blue-light)" : undefined}
      >
        <Group justify="space-between" wrap="nowrap" gap="xs" align="flex-start">
          <Box style={{ minWidth: 0 }}>
            <Text size="sm" fw={500} truncate>
              {f.rutaNombre}
            </Text>
            <Text size="xs" c="dimmed" truncate>
              {f.conductorNombre} · {f.busPlaca}
            </Text>
            <Group gap={4} mt={2}>
              <IconClock size={12} opacity={0.6} />
              <Text size="xs" c="dimmed">
                {hora(f.viaje.horaInicio)}
                {f.viaje.horaFin ? ` – ${hora(f.viaje.horaFin)}` : ""}
              </Text>
            </Group>
          </Box>
          <Stack gap={4} align="flex-end">
            {f.viaje.estado === "en_curso" &&
              (f.ubic ? (
                <Badge color="green" variant="light">
                  En vivo
                </Badge>
              ) : (
                <Badge color="gray" variant="light">
                  Sin señal
                </Badge>
              ))}
            {f.viaje.demorado && (
              <Badge color="orange" variant="light">
                Demora
              </Badge>
            )}
          </Stack>
        </Group>

        <Group gap={4} mt={6}>
          <Button
            size="compact-xs"
            variant={esEnfocado ? "filled" : "light"}
            leftSection={<IconMapPin size={12} />}
            onClick={() => setEnfoqueId(esEnfocado ? "todos" : f.viaje.id)}
          >
            {esEnfocado ? "En el mapa" : "Ver ruta"}
          </Button>
          <Button
            size="compact-xs"
            variant="subtle"
            leftSection={<IconInfoCircle size={12} />}
            onClick={() => setDetalleId(f.viaje.id)}
          >
            Detalle
          </Button>
        </Group>
      </Paper>
    );
  };

  return (
    <Stack h="calc(100vh - 92px)">
      <Group justify="space-between">
        <Title order={3}>Supervisión</Title>
        <Group gap="sm">
          <TextInput
            type="date"
            value={fecha}
            max={fechaDeHoy()}
            onChange={(e) => cambiarFecha(e.currentTarget.value)}
            size="xs"
          />
          <Badge size="lg" variant="light" leftSection={<IconBus size={14} />}>
            {enCurso.length} en curso · {finalizados.length} finalizado
            {finalizados.length === 1 ? "" : "s"}
          </Badge>
        </Group>
      </Group>

      <Flex gap="md" style={{ flex: 1, minHeight: 0 }}>
        <Paper
          withBorder
          style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}
        >
          {/* Qué mostrar en el mapa: todos los buses o uno con su recorrido */}
          <Group
            p="xs"
            gap="sm"
            wrap="nowrap"
            style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}
          >
            <Select
              style={{ flex: 1 }}
              size="xs"
              leftSection={<IconRoute size={14} />}
              data={opcionesMapa}
              value={enfoqueId}
              onChange={(v) => setEnfoqueId(v ?? "todos")}
              allowDeselect={false}
              searchable
              comboboxProps={{ zIndex: 2000 }} // por encima de las capas de Leaflet
            />
            <Switch
              size="xs"
              checked={verRecorrido}
              onChange={(e) => setVerRecorrido(e.currentTarget.checked)}
              label="Ver recorrido"
              disabled={!enfocado}
            />
            {enfocado && (
              <Button size="compact-xs" variant="subtle" onClick={() => setEnfoqueId("todos")}>
                Ver todos
              </Button>
            )}
          </Group>

          <Box style={{ flex: 1, minHeight: 0 }}>
            {busesEnVivo.length === 0 && recorrido.length === 0 ? (
              <Flex align="center" justify="center" h="100%" p="md">
                <Text c="dimmed" ta="center">
                  {!esHoy
                    ? "El seguimiento en vivo es solo de hoy. Elegí un viaje para ver su recorrido y su detalle."
                    : enfocado
                      ? "Ese viaje no tiene señal GPS ni un recorrido con ubicaciones cargadas."
                      : enCurso.length === 0
                        ? "No hay viajes en curso ahora mismo."
                        : "Esperando la señal GPS de los buses en viaje…"}
                </Text>
              </Flex>
            ) : (
              <MapaBuses
                buses={busesEnVivo}
                recorrido={recorrido}
                claveVista={`${enfoqueId}:${recorrido.length}`}
              />
            )}
          </Box>
        </Paper>

        <Paper withBorder p="xs" w={320} style={{ display: "flex", flexDirection: "column" }}>
          <Tabs defaultValue="curso" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <Tabs.List>
              <Tabs.Tab value="curso">En curso ({enCurso.length})</Tabs.Tab>
              <Tabs.Tab value="fin">Completados ({finalizados.length})</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="curso" pt="xs" style={{ flex: 1, minHeight: 0 }}>
              <ScrollArea h="100%">
                <Stack gap="xs">
                  {enCurso.length === 0 && (
                    <Text c="dimmed" size="sm" ta="center" mt="md">
                      Ningún viaje en curso.
                    </Text>
                  )}
                  {enCurso.map(fila)}
                </Stack>
              </ScrollArea>
            </Tabs.Panel>

            <Tabs.Panel value="fin" pt="xs" style={{ flex: 1, minHeight: 0 }}>
              <ScrollArea h="100%">
                <Stack gap="xs">
                  {finalizados.length === 0 && (
                    <Text c="dimmed" size="sm" ta="center" mt="md">
                      Todavía no hay viajes completados en esta fecha.
                    </Text>
                  )}
                  {finalizados.map(fila)}
                </Stack>
              </ScrollArea>
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </Flex>

      {/* Detalle del viaje elegido: resumen + línea de tiempo con las horas */}
      <Drawer
        opened={!!detalle}
        onClose={() => setDetalleId(null)}
        position="right"
        size="lg"
        title="Detalle del viaje"
        // Leaflet pinta sus capas entre z-index 400 y 1000; el Drawer de Mantine
        // viene en 200, así que sin esto el mapa se dibuja ENCIMA del panel.
        zIndex={2000}
      >
        {detalle && (
          <DetalleViaje
            key={detalle.viaje.id} // instancia nueva por viaje: estado limpio
            viaje={detalle.viaje}
            ruta={detalle.ruta}
            ninos={ninos}
            escuelas={escuelas}
            puntos={puntos}
            conductorNombre={detalle.conductorNombre}
            busPlaca={detalle.busPlaca}
          />
        )}
      </Drawer>
    </Stack>
  );
}
