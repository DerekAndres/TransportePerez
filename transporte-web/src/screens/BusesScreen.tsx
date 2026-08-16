import { useEffect, useState } from "react";
import {
  Avatar,
  Button,
  FileInput,
  Group,
  Image,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconBus, IconCamera, IconPencil, IconPlus } from "@tabler/icons-react";
import {
  actualizarBus,
  cambiarActivoBus,
  crearBus,
  listarBuses,
} from "../services/busesService";
import { listarUsuarios } from "../services/usuariosService";
import { comprimirImagen } from "../utils/imagen";
import type { Bus, Usuario } from "../types/models";

export default function BusesScreen() {
  const [buses, setBuses] = useState<Bus[] | null>(null);
  const [conductores, setConductores] = useState<Usuario[]>([]);
  const [modalAbierto, { open, close }] = useDisclosure(false);
  const [editando, setEditando] = useState<Bus | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Foto de la unidad (data-URI comprimida); el padre la ve en su app
  const [foto, setFoto] = useState<string | null>(null);

  const form = useForm({
    initialValues: { placa: "", capacidad: 0, conductorId: "" },
    validate: {
      placa: (v) => (v.trim() ? null : "La placa es obligatoria"),
      capacidad: (v) => (v > 0 ? null : "La capacidad debe ser mayor a 0"),
      conductorId: (v) => (v ? null : "Elegí un conductor"),
    },
  });

  const cargar = () => {
    Promise.all([listarBuses(), listarUsuarios()])
      .then(([listaBuses, listaUsuarios]) => {
        setBuses(listaBuses);
        setConductores(listaUsuarios.filter((u) => u.rol === "conductor" && u.activo));
      })
      .catch(() =>
        notifications.show({ color: "red", message: "No se pudieron cargar los buses." })
      );
  };

  useEffect(cargar, []);

  const abrirCrear = () => {
    setEditando(null);
    form.reset();
    setFoto(null);
    open();
  };

  const abrirEditar = (bus: Bus) => {
    setEditando(bus);
    form.setValues({
      placa: bus.placa,
      capacidad: bus.capacidad,
      conductorId: bus.conductorId,
    });
    setFoto(bus.foto ?? null);
    open();
  };

  const elegirFoto = async (archivo: File | null) => {
    if (!archivo) return;
    try {
      setFoto(await comprimirImagen(archivo));
    } catch {
      notifications.show({ color: "red", message: "No se pudo procesar la imagen." });
    }
  };

  const guardar = form.onSubmit(async (valores) => {
    setGuardando(true);
    try {
      const datos = {
        placa: valores.placa.trim().toUpperCase(),
        capacidad: valores.capacidad,
        conductorId: valores.conductorId,
        ...(foto ? { foto } : {}),
      };
      if (editando) {
        await actualizarBus(editando.id, datos);
        notifications.show({ color: "green", message: "Bus actualizado." });
      } else {
        await crearBus(datos);
        notifications.show({ color: "green", message: "Bus creado." });
      }
      close();
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo guardar el bus." });
    } finally {
      setGuardando(false);
    }
  });

  const alternarActivo = async (bus: Bus) => {
    try {
      await cambiarActivoBus(bus.id, !bus.activo);
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo cambiar el estado." });
    }
  };

  if (!buses) {
    return <Loader />;
  }

  const nombreConductor = (id: string) =>
    conductores.find((c) => c.id === id)?.nombre ?? "(sin asignar)";

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Buses</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirCrear}>
          Nuevo bus
        </Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Unidad</Table.Th>
            <Table.Th>Placa</Table.Th>
            <Table.Th>Capacidad</Table.Th>
            <Table.Th>Conductor</Table.Th>
            <Table.Th>Activo</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {buses.map((bus) => (
            <Table.Tr key={bus.id}>
              <Table.Td>
                {bus.foto ? (
                  <Image src={bus.foto} w={56} h={38} radius="sm" fit="cover" />
                ) : (
                  <Avatar radius="sm">
                    <IconBus size={18} />
                  </Avatar>
                )}
              </Table.Td>
              <Table.Td>{bus.placa}</Table.Td>
              <Table.Td>{bus.capacidad}</Table.Td>
              <Table.Td>{nombreConductor(bus.conductorId)}</Table.Td>
              <Table.Td>
                <Switch checked={bus.activo} onChange={() => alternarActivo(bus)} />
              </Table.Td>
              <Table.Td>
                <Button
                  variant="subtle"
                  size="compact-sm"
                  leftSection={<IconPencil size={14} />}
                  onClick={() => abrirEditar(bus)}
                >
                  Editar
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
          {buses.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed" ta="center">
                  Todavía no hay buses registrados.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal
        opened={modalAbierto}
        onClose={close}
        title={editando ? "Editar bus" : "Nuevo bus"}
      >
        <form onSubmit={guardar}>
          <Stack gap="sm">
            <TextInput label="Placa" required {...form.getInputProps("placa")} />
            <NumberInput
              label="Capacidad (asientos)"
              required
              min={1}
              {...form.getInputProps("capacidad")}
            />
            <Select
              label="Conductor"
              required
              searchable
              data={conductores.map((c) => ({ value: c.id, label: c.nombre }))}
              {...form.getInputProps("conductorId")}
            />
            {conductores.length === 0 && (
              <Text size="xs" c="orange">
                No hay conductores activos. Creá primero el conductor en Usuarios.
              </Text>
            )}
            <FileInput
              label="Foto de la unidad (opcional — el padre la ve en su app)"
              placeholder="Elegir imagen"
              accept="image/*"
              leftSection={<IconCamera size={16} />}
              onChange={elegirFoto}
              clearable={false}
            />
            {foto && <Image src={foto} w={160} radius="sm" />}
            <Button type="submit" loading={guardando}>
              {editando ? "Guardar cambios" : "Crear bus"}
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
