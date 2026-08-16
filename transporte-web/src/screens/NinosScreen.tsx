import { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Divider,
  FileInput,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconCamera, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import MapaUbicacion from "../components/MapaUbicacion";
import { comprimirImagen } from "../utils/imagen";
import {
  actualizarNino,
  cambiarActivoNino,
  crearNino,
  eliminarNino,
  listarNinos,
} from "../services/ninosService";
import { listarUsuarios } from "../services/usuariosService";
import { listarEscuelas } from "../services/escuelasService";
import type { Escuela, Nino, TurnoNino, Usuario } from "../types/models";

const TURNOS: { value: TurnoNino; label: string }[] = [
  { value: "manana", label: "Mañana" },
  { value: "tarde", label: "Tarde" },
  { value: "ambos", label: "Ambos" },
];

const etiquetaTurno = (t?: TurnoNino) => TURNOS.find((x) => x.value === t)?.label ?? "—";

export default function NinosScreen() {
  const [ninos, setNinos] = useState<Nino[] | null>(null);
  const [padres, setPadres] = useState<Usuario[]>([]);
  const [escuelas, setEscuelas] = useState<Escuela[]>([]);
  const [modalAbierto, { open, close }] = useDisclosure(false);
  const [editando, setEditando] = useState<Nino | null>(null);
  // Ubicación de la parada (casa) — viene del mapa, se maneja aparte del form
  const [ubicacion, setUbicacion] = useState<{ lat: number; lng: number } | null>(null);
  // Foto del niño (data-URI comprimida); el padre también puede subirla desde la app
  const [foto, setFoto] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  // Confirmación de eliminación (archivado)
  const [porEliminar, setPorEliminar] = useState<Nino | null>(null);
  const [motivo, setMotivo] = useState("");
  const [eliminando, setEliminando] = useState(false);

  const form = useForm({
    initialValues: {
      nombre: "",
      grado: "",
      padreId: "",
      escuelaId: "",
      turno: "" as TurnoNino | "",
      paradaNombre: "",
      paradaReferencia: "",
    },
    validate: {
      nombre: (v) => (v.trim() ? null : "El nombre es obligatorio"),
      grado: (v) => (v.trim() ? null : "El grado es obligatorio"),
      padreId: (v) => (v ? null : "Elegí un padre"),
      escuelaId: (v) => (v ? null : "Elegí una escuela"),
      turno: (v) => (v ? null : "Elegí el turno"),
      paradaNombre: (v) => (v.trim() ? null : "Poné un nombre a la parada (casa)"),
    },
  });

  const cargar = () => {
    Promise.all([listarNinos(), listarUsuarios(), listarEscuelas()])
      .then(([listaNinos, listaUsuarios, listaEscuelas]) => {
        setError("");
        // Los eliminados no salen acá: se ven (y se restauran) en Historial
        setNinos(listaNinos.filter((n) => !n.eliminado));
        setPadres(listaUsuarios.filter((u) => u.rol === "padre" && u.activo));
        setEscuelas(listaEscuelas.filter((e) => e.activa));
      })
      .catch(() =>
        setError(
          "No se pudieron cargar los niños. Revisá tu conexión y que las reglas de Firestore estén desplegadas."
        )
      );
  };

  useEffect(cargar, []);

  const abrirCrear = () => {
    setEditando(null);
    form.reset();
    setUbicacion(null);
    setFoto(null);
    open();
  };

  const elegirFoto = async (archivo: File | null) => {
    if (!archivo) return;
    try {
      setFoto(await comprimirImagen(archivo, 300));
    } catch {
      notifications.show({ color: "red", message: "No se pudo procesar la imagen." });
    }
  };

  const abrirEditar = (nino: Nino) => {
    setEditando(nino);
    form.setValues({
      nombre: nino.nombre,
      grado: nino.grado,
      padreId: nino.padreId,
      escuelaId: nino.escuelaId ?? "",
      turno: nino.turno ?? "",
      paradaNombre: nino.parada?.nombre ?? "",
      paradaReferencia: nino.parada?.referencia ?? "",
    });
    setUbicacion(nino.parada ? { lat: nino.parada.lat, lng: nino.parada.lng } : null);
    setFoto(nino.foto ?? null);
    open();
  };

  const guardar = form.onSubmit(async (valores) => {
    if (!ubicacion) {
      notifications.show({
        color: "orange",
        message: "Marcá la casa del niño en el mapa.",
      });
      return;
    }
    setGuardando(true);
    try {
      const datos = {
        nombre: valores.nombre.trim(),
        grado: valores.grado.trim(),
        padreId: valores.padreId,
        escuelaId: valores.escuelaId,
        turno: valores.turno as TurnoNino,
        parada: {
          nombre: valores.paradaNombre.trim(),
          lat: ubicacion.lat,
          lng: ubicacion.lng,
          // El punto de referencia que ve el conductor al tocar la parada
          ...(valores.paradaReferencia.trim()
            ? { referencia: valores.paradaReferencia.trim() }
            : {}),
        },
        ...(foto ? { foto } : {}),
      };
      if (editando) {
        await actualizarNino(editando.id, datos);
        notifications.show({ color: "green", message: "Niño actualizado." });
      } else {
        await crearNino(datos);
        notifications.show({ color: "green", message: "Niño registrado." });
      }
      close();
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo guardar el registro." });
    } finally {
      setGuardando(false);
    }
  });

  const alternarActivo = async (nino: Nino) => {
    try {
      await cambiarActivoNino(nino.id, !nino.activo);
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo cambiar el estado." });
    }
  };

  // Archiva al niño: sale de las listas pero queda en Historial y sus viajes
  // pasados siguen mostrando su nombre
  const confirmarEliminar = async () => {
    if (!porEliminar) return;
    setEliminando(true);
    try {
      await eliminarNino(porEliminar.id, motivo.trim());
      notifications.show({
        color: "green",
        message: "Niño eliminado. Podés verlo en Historial.",
      });
      setPorEliminar(null);
      close();
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo eliminar el registro." });
    } finally {
      setEliminando(false);
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

  if (!ninos) {
    return <Loader />;
  }

  const nombrePadre = (id: string) => padres.find((p) => p.id === id)?.nombre ?? "—";
  const nombreEscuela = (id?: string) => escuelas.find((e) => e.id === id)?.nombre ?? "—";

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Niños</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirCrear}>
          Nuevo niño
        </Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nombre</Table.Th>
            <Table.Th>Grado</Table.Th>
            <Table.Th>Escuela</Table.Th>
            <Table.Th>Turno</Table.Th>
            <Table.Th>Parada (casa)</Table.Th>
            <Table.Th>Padre</Table.Th>
            <Table.Th>Activo</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {ninos.map((nino) => (
            <Table.Tr key={nino.id}>
              <Table.Td>
                <Group gap="sm" wrap="nowrap">
                  <Avatar src={nino.foto} radius="xl" color="blue">
                    {nino.nombre.trim().charAt(0).toUpperCase() || "?"}
                  </Avatar>
                  {nino.nombre}
                </Group>
              </Table.Td>
              <Table.Td>{nino.grado}</Table.Td>
              <Table.Td>{nombreEscuela(nino.escuelaId)}</Table.Td>
              <Table.Td>{etiquetaTurno(nino.turno)}</Table.Td>
              <Table.Td>{nino.parada?.nombre ?? "—"}</Table.Td>
              <Table.Td>{nombrePadre(nino.padreId)}</Table.Td>
              <Table.Td>
                <Switch checked={nino.activo} onChange={() => alternarActivo(nino)} />
              </Table.Td>
              <Table.Td>
                <Button
                  variant="subtle"
                  size="compact-sm"
                  leftSection={<IconPencil size={14} />}
                  onClick={() => abrirEditar(nino)}
                >
                  Editar
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
          {ninos.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={8}>
                <Text c="dimmed" ta="center">
                  Todavía no hay niños registrados.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal
        opened={modalAbierto}
        onClose={close}
        title={editando ? "Editar niño" : "Nuevo niño"}
        size="lg"
      >
        <form onSubmit={guardar}>
          <Stack gap="sm">
            <Group align="flex-end" gap="sm">
              <Avatar src={foto} size={56} radius="xl" color="blue">
                {form.values.nombre.trim().charAt(0).toUpperCase() || "?"}
              </Avatar>
              <FileInput
                style={{ flex: 1 }}
                label="Foto del niño (opcional)"
                placeholder="Elegir imagen"
                accept="image/*"
                leftSection={<IconCamera size={16} />}
                onChange={elegirFoto}
                clearable={false}
              />
            </Group>
            <TextInput label="Nombre" required {...form.getInputProps("nombre")} />
            <Group grow>
              <TextInput label="Grado" required {...form.getInputProps("grado")} />
              <Select
                label="Turno"
                required
                data={TURNOS}
                {...form.getInputProps("turno")}
              />
            </Group>
            <Select
              label="Padre"
              required
              searchable
              data={padres.map((p) => ({ value: p.id, label: p.nombre }))}
              {...form.getInputProps("padreId")}
            />
            <Select
              label="Escuela"
              required
              searchable
              data={escuelas.map((e) => ({ value: e.id, label: e.nombre }))}
              {...form.getInputProps("escuelaId")}
            />
            <TextInput
              label="Parada (nombre de la casa/colonia)"
              placeholder="Col. Bella Vista"
              required
              {...form.getInputProps("paradaNombre")}
            />
            <TextInput
              label="Punto de referencia"
              description="Lo ve el conductor al tocar la parada en el mapa"
              placeholder="Casa verde de dos pisos, frente a la pulpería Doña Mari"
              {...form.getInputProps("paradaReferencia")}
            />
            <Text size="sm" c="dimmed">
              Hacé clic en el mapa para marcar la casa donde se recoge y deja al niño.
            </Text>
            <MapaUbicacion
              tipo="casa"
              ubicacion={ubicacion}
              onElegirUbicacion={(lat, lng) => setUbicacion({ lat, lng })}
            />
            {ubicacion ? (
              <Text size="xs" c="dimmed">
                Ubicación: {ubicacion.lat.toFixed(5)}, {ubicacion.lng.toFixed(5)}
              </Text>
            ) : (
              <Text size="xs" c="orange">
                Todavía no marcaste la casa en el mapa.
              </Text>
            )}
            {padres.length === 0 && (
              <Text size="xs" c="orange">
                No hay padres activos. Creá primero el padre en Usuarios.
              </Text>
            )}
            {escuelas.length === 0 && (
              <Text size="xs" c="orange">
                No hay escuelas activas. Creá primero la escuela en Escuelas.
              </Text>
            )}
            <Button type="submit" loading={guardando}>
              {editando ? "Guardar cambios" : "Registrar niño"}
            </Button>
          </Stack>
        </form>

        {/* Acción delicada: solo dentro del perfil, nunca en la fila */}
        {editando && (
          <>
            <Divider my="md" label="Acciones" labelPosition="center" />
            <Stack gap={6}>
              <Button
                variant="light"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={() => {
                  setPorEliminar(editando);
                  setMotivo("");
                }}
              >
                Eliminar niño
              </Button>
              <Text size="xs" c="dimmed">
                Los datos quedan guardados en Historial y se pueden restaurar. Sus viajes ya
                registrados siguen mostrando su nombre.
              </Text>
            </Stack>
          </>
        )}
      </Modal>

      {/* Confirmación de eliminación */}
      <Modal opened={!!porEliminar} onClose={() => setPorEliminar(null)} title="Eliminar niño">
        {porEliminar && (
          <Stack>
            <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
              Vas a eliminar a <b>{porEliminar.nombre}</b>. Dejará de aparecer en las rutas y
              en las listas del conductor.
            </Alert>
            <Text size="sm">
              Los datos <b>no se borran</b>: quedan en la pantalla de <b>Historial</b> y desde
              ahí se pueden restaurar.
            </Text>
            <Textarea
              label="Motivo (opcional)"
              placeholder="Ej. cambió de colegio / dejó el servicio"
              value={motivo}
              onChange={(e) => setMotivo(e.currentTarget.value)}
              autosize
              minRows={2}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPorEliminar(null)}>
                Cancelar
              </Button>
              <Button color="red" loading={eliminando} onClick={confirmarEliminar}>
                Eliminar
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
