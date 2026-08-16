import { useEffect, useState } from "react";
import {
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
  actualizarPunto,
  cambiarActivoPunto,
  crearPunto,
  listarPuntos,
} from "../services/puntosService";
import type { Punto } from "../types/models";

// Puntos de transbordo: lugares donde los niños cambian de bus. Misma pantalla que
// Escuelas (tabla + modal con mapa de un marcador).
export default function PuntosScreen() {
  const [puntos, setPuntos] = useState<Punto[] | null>(null);
  const [modalAbierto, { open, close }] = useDisclosure(false);
  const [editando, setEditando] = useState<Punto | null>(null);
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const form = useForm({
    initialValues: { nombre: "" },
    validate: {
      nombre: (v) => (v.trim() ? null : "El nombre es obligatorio"),
    },
  });

  const cargar = () => {
    listarPuntos()
      .then((lista) => {
        setError("");
        setPuntos(lista);
      })
      .catch(() =>
        setError(
          "No se pudieron cargar los puntos. Revisá tu conexión y que la regla de 'puntos' esté desplegada en Firestore (firebase deploy --only firestore:rules)."
        )
      );
  };

  useEffect(cargar, []);

  const abrirCrear = () => {
    setEditando(null);
    form.reset();
    setUbicacion(null);
    open();
  };

  const abrirEditar = (punto: Punto) => {
    setEditando(punto);
    form.setValues({ nombre: punto.nombre });
    setUbicacion({ lat: punto.lat, lng: punto.lng });
    open();
  };

  const guardar = form.onSubmit(async (valores) => {
    if (!ubicacion) {
      notifications.show({
        color: "orange",
        message: "Marcá la ubicación del punto en el mapa.",
      });
      return;
    }
    setGuardando(true);
    try {
      const datos = { nombre: valores.nombre.trim(), lat: ubicacion.lat, lng: ubicacion.lng };
      if (editando) {
        await actualizarPunto(editando.id, datos);
        notifications.show({ color: "green", message: "Punto actualizado." });
      } else {
        await crearPunto(datos);
        notifications.show({ color: "green", message: "Punto creado." });
      }
      close();
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo guardar el punto." });
    } finally {
      setGuardando(false);
    }
  });

  const alternarActivo = async (punto: Punto) => {
    try {
      await cambiarActivoPunto(punto.id, !punto.activo);
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo cambiar el estado." });
    }
  };

  if (error) {
    return (
      <Stack>
        <Text c="red">{error}</Text>
        <Button
          variant="light"
          w="fit-content"
          onClick={() => {
            setError("");
            cargar();
          }}
        >
          Reintentar
        </Button>
      </Stack>
    );
  }

  if (!puntos) {
    return <Loader />;
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Puntos de transbordo</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirCrear}>
          Nuevo punto
        </Button>
      </Group>

      <Text size="sm" c="dimmed">
        Lugares donde un niño cambia de un bus a otro. Se usan al armar rutas con transbordo.
      </Text>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nombre</Table.Th>
            <Table.Th>Ubicación</Table.Th>
            <Table.Th>Activo</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {puntos.map((punto) => (
            <Table.Tr key={punto.id}>
              <Table.Td>{punto.nombre}</Table.Td>
              <Table.Td>
                <Text size="xs" c="dimmed">
                  {punto.lat.toFixed(5)}, {punto.lng.toFixed(5)}
                </Text>
              </Table.Td>
              <Table.Td>
                <Switch checked={punto.activo} onChange={() => alternarActivo(punto)} />
              </Table.Td>
              <Table.Td>
                <Button
                  variant="subtle"
                  size="compact-sm"
                  leftSection={<IconPencil size={14} />}
                  onClick={() => abrirEditar(punto)}
                >
                  Editar
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
          {puntos.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={4}>
                <Text c="dimmed" ta="center">
                  Todavía no hay puntos registrados.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal
        opened={modalAbierto}
        onClose={close}
        title={editando ? "Editar punto" : "Nuevo punto"}
        size="lg"
      >
        <form onSubmit={guardar}>
          <Stack gap="sm">
            <TextInput label="Nombre" required {...form.getInputProps("nombre")} />
            <Text size="sm" c="dimmed">
              Hacé clic en el mapa para marcar la ubicación del punto.
            </Text>
            <MapaUbicacion
              tipo="punto"
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
              {editando ? "Guardar cambios" : "Crear punto"}
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
