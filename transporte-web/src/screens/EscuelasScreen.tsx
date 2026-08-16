import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Group,
  Loader,
  Modal,
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
import { IconPencil, IconPlus } from "@tabler/icons-react";
import MapaUbicacion from "../components/MapaUbicacion";
import {
  actualizarEscuela,
  cambiarActivaEscuela,
  contarNinosPorEscuela,
  crearEscuela,
  listarEscuelas,
} from "../services/escuelasService";
import type { Escuela } from "../types/models";

export default function EscuelasScreen() {
  const [escuelas, setEscuelas] = useState<Escuela[] | null>(null);
  // Cuántos niños activos van a cada escuela (por escuelaId)
  const [conteoNinos, setConteoNinos] = useState<Record<string, number>>({});
  const [modalAbierto, { open, close }] = useDisclosure(false);
  const [editando, setEditando] = useState<Escuela | null>(null);
  // La ubicación se maneja aparte del form (viene del mapa, no de un input)
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const form = useForm({
    initialValues: { nombre: "" },
    validate: {
      nombre: (v) => (v.trim() ? null : "El nombre es obligatorio"),
    },
  });

  const cargar = () => {
    Promise.all([listarEscuelas(), contarNinosPorEscuela()])
      .then(([listaEscuelas, conteo]) => {
        setEscuelas(listaEscuelas);
        setConteoNinos(conteo);
      })
      .catch(() =>
        notifications.show({ color: "red", message: "No se pudieron cargar las escuelas." })
      );
  };

  useEffect(cargar, []);

  const abrirCrear = () => {
    setEditando(null);
    form.reset();
    setUbicacion(null);
    open();
  };

  const abrirEditar = (escuela: Escuela) => {
    setEditando(escuela);
    form.setValues({ nombre: escuela.nombre });
    setUbicacion({ lat: escuela.lat, lng: escuela.lng });
    open();
  };

  const guardar = form.onSubmit(async (valores) => {
    if (!ubicacion) {
      notifications.show({
        color: "orange",
        message: "Marcá la ubicación de la escuela en el mapa.",
      });
      return;
    }
    setGuardando(true);
    try {
      const datos = { nombre: valores.nombre.trim(), lat: ubicacion.lat, lng: ubicacion.lng };
      if (editando) {
        await actualizarEscuela(editando.id, datos);
        notifications.show({ color: "green", message: "Escuela actualizada." });
      } else {
        await crearEscuela(datos);
        notifications.show({ color: "green", message: "Escuela creada." });
      }
      close();
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo guardar la escuela." });
    } finally {
      setGuardando(false);
    }
  });

  const alternarActiva = async (escuela: Escuela) => {
    try {
      await cambiarActivaEscuela(escuela.id, !escuela.activa);
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo cambiar el estado." });
    }
  };

  if (!escuelas) {
    return <Loader />;
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Escuelas</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirCrear}>
          Nueva escuela
        </Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nombre</Table.Th>
            <Table.Th>Ubicación</Table.Th>
            <Table.Th>Niños</Table.Th>
            <Table.Th>Activa</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {escuelas.map((escuela) => (
            <Table.Tr key={escuela.id}>
              <Table.Td>{escuela.nombre}</Table.Td>
              <Table.Td>
                <Text size="xs" c="dimmed">
                  {escuela.lat.toFixed(5)}, {escuela.lng.toFixed(5)}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge variant="light">{conteoNinos[escuela.id] ?? 0}</Badge>
              </Table.Td>
              <Table.Td>
                <Switch checked={escuela.activa} onChange={() => alternarActiva(escuela)} />
              </Table.Td>
              <Table.Td>
                <Button
                  variant="subtle"
                  size="compact-sm"
                  leftSection={<IconPencil size={14} />}
                  onClick={() => abrirEditar(escuela)}
                >
                  Editar
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
          {escuelas.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text c="dimmed" ta="center">
                  Todavía no hay escuelas registradas.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal
        opened={modalAbierto}
        onClose={close}
        title={editando ? "Editar escuela" : "Nueva escuela"}
        size="lg"
      >
        <form onSubmit={guardar}>
          <Stack gap="sm">
            <TextInput label="Nombre" required {...form.getInputProps("nombre")} />
            <Text size="sm" c="dimmed">
              Hacé clic en el mapa para marcar la ubicación de la escuela.
            </Text>
            <MapaUbicacion
              tipo="escuela"
              ubicacion={ubicacion}
              onElegirUbicacion={(lat, lng) => setUbicacion({ lat, lng })}
            />
            {ubicacion ? (
              <Text size="xs" c="dimmed">
                Ubicación: {ubicacion.lat.toFixed(5)}, {ubicacion.lng.toFixed(5)}
              </Text>
            ) : (
              <Text size="xs" c="orange">
                Todavía no marcaste la ubicación.
              </Text>
            )}
            <Button type="submit" loading={guardando}>
              {editando ? "Guardar cambios" : "Crear escuela"}
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
