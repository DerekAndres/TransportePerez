import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArchive,
  IconInfoCircle,
  IconRestore,
  IconSearch,
} from "@tabler/icons-react";
import {
  listarUsuarios,
  restaurarUsuario,
} from "../services/usuariosService";
import { listarNinos, restaurarNino } from "../services/ninosService";
import { listarEscuelas } from "../services/escuelasService";
import type { Escuela, Nino, Usuario } from "../types/models";

// Fecha y hora legibles de un archivado
function cuando(momento?: { toDate: () => Date }): string {
  if (!momento) return "—";
  return momento.toDate().toLocaleString("es-HN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Historial: todo lo que el admin eliminó (padres, conductores y niños). Los
// documentos nunca se borran de Firestore — se archivan — así que acá queda su
// ficha completa y se pueden restaurar. Ver "BORRADO LÓGICO" en models.ts.
export default function HistorialScreen() {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [ninos, setNinos] = useState<Nino[]>([]);
  const [escuelas, setEscuelas] = useState<Escuela[]>([]);
  const [vista, setVista] = useState<"padres" | "conductores" | "ninos">("padres");
  const [busqueda, setBusqueda] = useState("");
  const [restaurando, setRestaurando] = useState<string | null>(null);

  const cargar = () => {
    Promise.all([listarUsuarios(), listarNinos(), listarEscuelas()])
      .then(([us, ns, es]) => {
        setUsuarios(us.filter((u) => u.eliminado));
        setNinos(ns.filter((n) => n.eliminado));
        setEscuelas(es);
      })
      .catch(() => {
        notifications.show({ color: "red", message: "No se pudo cargar el historial." });
        setUsuarios([]);
      });
  };

  useEffect(cargar, []);

  const nombreEscuela = (id?: string) => escuelas.find((e) => e.id === id)?.nombre ?? "—";
  // Los padres archivados también sirven para nombrar al padre de un niño
  const todosLosNombres = useMemo(
    () => new Map((usuarios ?? []).map((u) => [u.id, u.nombre])),
    [usuarios]
  );

  const coincide = (texto: string) =>
    texto.toLowerCase().includes(busqueda.trim().toLowerCase());

  const padres = (usuarios ?? []).filter((u) => u.rol === "padre" && coincide(u.nombre));
  const conductores = (usuarios ?? []).filter((u) => u.rol === "conductor" && coincide(u.nombre));
  const ninosFiltrados = ninos.filter((n) => coincide(n.nombre));

  const devolverUsuario = async (usuario: Usuario) => {
    setRestaurando(usuario.id);
    try {
      await restaurarUsuario(usuario);
      notifications.show({
        color: "green",
        message:
          usuario.rol === "padre"
            ? "Padre restaurado junto con sus hijos."
            : "Conductor restaurado.",
      });
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo restaurar." });
    } finally {
      setRestaurando(null);
    }
  };

  const devolverNino = async (nino: Nino) => {
    setRestaurando(nino.id);
    try {
      await restaurarNino(nino.id);
      notifications.show({ color: "green", message: "Niño restaurado." });
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo restaurar." });
    } finally {
      setRestaurando(null);
    }
  };

  if (!usuarios) {
    return <Loader />;
  }

  // Tabla de padres o conductores
  const tablaUsuarios = (lista: Usuario[], vacio: string) => (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Nombre</Table.Th>
          <Table.Th>Correo</Table.Th>
          <Table.Th>Teléfono</Table.Th>
          <Table.Th>Eliminado</Table.Th>
          <Table.Th>Motivo</Table.Th>
          <Table.Th />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {lista.map((u) => (
          <Table.Tr key={u.id}>
            <Table.Td>
              <Group gap="sm" wrap="nowrap">
                <Avatar src={u.foto} radius="xl" color="gray">
                  {u.nombre.trim().charAt(0).toUpperCase()}
                </Avatar>
                {u.nombre}
              </Group>
            </Table.Td>
            <Table.Td>{u.email}</Table.Td>
            <Table.Td>{u.telefono || "—"}</Table.Td>
            <Table.Td>{cuando(u.eliminadoEn)}</Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed" fs={u.motivoEliminacion ? undefined : "italic"}>
                {u.motivoEliminacion || "sin motivo"}
              </Text>
            </Table.Td>
            <Table.Td>
              <Button
                variant="light"
                size="compact-sm"
                leftSection={<IconRestore size={14} />}
                loading={restaurando === u.id}
                onClick={() => devolverUsuario(u)}
              >
                Restaurar
              </Button>
            </Table.Td>
          </Table.Tr>
        ))}
        {lista.length === 0 && (
          <Table.Tr>
            <Table.Td colSpan={6}>
              <Text c="dimmed" ta="center">
                {vacio}
              </Text>
            </Table.Td>
          </Table.Tr>
        )}
      </Table.Tbody>
    </Table>
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Historial</Title>
        <Badge size="lg" variant="light" leftSection={<IconArchive size={14} />}>
          {(usuarios?.length ?? 0) + ninos.length} registro
          {(usuarios?.length ?? 0) + ninos.length === 1 ? "" : "s"}
        </Badge>
      </Group>

      <Alert icon={<IconInfoCircle size={16} />} color="blue" p="xs">
        Acá queda todo lo que eliminaste, con su información completa. Nada se borra de la
        base de datos: los viajes y la asistencia ya registrados siguen mostrando estos
        nombres, y cualquier registro se puede restaurar.
      </Alert>

      <Group>
        <SegmentedControl
          value={vista}
          onChange={(v) => setVista(v as typeof vista)}
          data={[
            { value: "padres", label: `Padres (${padres.length})` },
            { value: "conductores", label: `Conductores (${conductores.length})` },
            { value: "ninos", label: `Niños (${ninosFiltrados.length})` },
          ]}
        />
        <TextInput
          style={{ flex: 1 }}
          placeholder="Buscar por nombre…"
          leftSection={<IconSearch size={14} />}
          value={busqueda}
          onChange={(e) => setBusqueda(e.currentTarget.value)}
        />
      </Group>

      {vista === "padres" && tablaUsuarios(padres, "No hay padres eliminados.")}
      {vista === "conductores" && tablaUsuarios(conductores, "No hay conductores eliminados.")}

      {vista === "ninos" && (
        <Stack gap="xs">
          {ninosFiltrados.length === 0 && <Text c="dimmed">No hay niños eliminados.</Text>}
          {ninosFiltrados.map((n) => (
            <Card key={n.id} withBorder padding="sm">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Avatar src={n.foto} radius="xl" size={44} color="gray">
                    {n.nombre.trim().charAt(0).toUpperCase()}
                  </Avatar>
                  <Stack gap={2} style={{ minWidth: 0 }}>
                    <Text fw={600}>{n.nombre}</Text>
                    <Text size="sm" c="dimmed">
                      {n.grado} · {nombreEscuela(n.escuelaId)} · Padre:{" "}
                      {todosLosNombres.get(n.padreId) ?? "—"}
                    </Text>
                    <Text size="sm" c="dimmed">
                      Casa: {n.parada?.nombre ?? "—"}
                      {n.parada?.referencia ? ` — ${n.parada.referencia}` : ""}
                    </Text>
                    {n.paradaTarde && (
                      <Text size="sm" c="dimmed">
                        Entrega de la tarde: {n.paradaTarde.nombre}
                      </Text>
                    )}
                    <Text size="xs" c="dimmed">
                      Eliminado el {cuando(n.eliminadoEn)}
                      {n.motivoEliminacion ? ` · ${n.motivoEliminacion}` : ""}
                    </Text>
                  </Stack>
                </Group>
                <Button
                  variant="light"
                  size="compact-sm"
                  leftSection={<IconRestore size={14} />}
                  loading={restaurando === n.id}
                  onClick={() => devolverNino(n)}
                >
                  Restaurar
                </Button>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
