import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  FileInput,
  Group,
  Image,
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
import {
  AVISO_ACCESOS_PENDIENTES,
  recalcularAccesosDespuesDeGuardar,
} from "../services/accesoConductoresService";
import Sugerencias from "../components/Sugerencias";
import { enumerar, plural } from "../utils/texto";
import { comprimirImagen } from "../utils/imagen";
import FiltrosCatalogo, { PiePaginacion } from "../components/FiltrosCatalogo";
import { usePaginacion } from "../hooks/use-paginacion";
import {
  filtrarPorEstado,
  filtrarTexto,
  OPCIONES_ESTADO,
  type FiltroEstado,
} from "../utils/filtros";
import type { Bus, Usuario } from "../types/models";
import CargandoBus from "../components/CargandoBus";

export default function BusesScreen() {
  const [buses, setBuses] = useState<Bus[] | null>(null);
  const [conductores, setConductores] = useState<Usuario[]>([]);
  const [modalAbierto, { open, close }] = useDisclosure(false);
  const [editando, setEditando] = useState<Bus | null>(null);
  const [guardando, setGuardando] = useState(false);

  // --- Filtros de la tabla ---
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<FiltroEstado>("activos");

  // Se busca por placa Y por nombre del conductor: el admin piensa en "el bus
  // de Marlon" tanto como en "PRU-001". El nombre se resuelve acá dentro y no
  // con el ayudante de abajo, porque ese vive despues del return temprano.
  const filtrados = useMemo(() => {
    const nombrePorId = new Map(conductores.map((c) => [c.id, c.nombre]));
    const base = filtrarPorEstado(buses ?? [], estado, (b) => b.activo);
    return filtrarTexto(base, busqueda, (b) => [b.placa, nombrePorId.get(b.conductorId)]);
  }, [buses, conductores, busqueda, estado]);

  const pag = usePaginacion(filtrados);
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
      // Quién maneja la unidad decide a qué niños ve cada conductor en su app
      if (!(await recalcularAccesosDespuesDeGuardar())) {
        notifications.show(AVISO_ACCESOS_PENDIENTES);
      }
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
      if (!(await recalcularAccesosDespuesDeGuardar())) {
        notifications.show(AVISO_ACCESOS_PENDIENTES);
      }
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo cambiar el estado." });
    }
  };

  // ============================================
  // QUÉ LE FALTA A ESTA PANTALLA
  // ============================================
  // Un conductor sin unidad asignada abre su app y ve "no tenés un bus
  // asignado": no puede trabajar, y desde acá no se nota — la lista de buses se
  // ve completa, porque el que falta es un usuario, no un bus.
  //
  // Es el mismo agujero que la insignia "No le llega al conductor" de la
  // pantalla de Rutas, visto desde el otro lado de la cadena.
  const faltantes = useMemo(() => {
    if (!buses) return { conductoresSinBus: [] as Usuario[], busesSinConductor: [] as Bus[] };

    const asignados = new Set(
      buses.filter((b) => b.activo).map((b) => b.conductorId).filter(Boolean)
    );

    return {
      conductoresSinBus: conductores.filter((c) => c.activo && !asignados.has(c.id)),
      // Una unidad cuyo conductor se dio de baja queda huérfana: sigue activa,
      // sigue teniendo rutas, y nadie las ve en su teléfono.
      busesSinConductor: buses.filter(
        (b) =>
          b.activo &&
          (!b.conductorId || !conductores.some((c) => c.id === b.conductorId && c.activo))
      ),
    };
  }, [buses, conductores]);

  if (!buses) {
    return <CargandoBus texto="Cargando las unidades…" />;
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

      <Sugerencias
        sugerencias={[
          ...(faltantes.conductoresSinBus.length > 0
            ? [
                {
                  id: "conductor-sin-bus",
                  texto: `${plural(faltantes.conductoresSinBus.length, "conductor no tiene", "conductores no tienen")} unidad asignada (${enumerar(
                    faltantes.conductoresSinBus.map((c) => c.nombre)
                  )}). En su app van a ver "no tenés un bus asignado".`,
                },
              ]
            : []),
          ...(faltantes.busesSinConductor.length > 0
            ? [
                {
                  id: "bus-sin-conductor",
                  texto: `${plural(faltantes.busesSinConductor.length, "unidad activa", "unidades activas")} sin conductor activo (${enumerar(
                    faltantes.busesSinConductor.map((b) => b.placa)
                  )}). Sus rutas no le llegan a nadie.`,
                },
              ]
            : []),
        ]}
      />

      <FiltrosCatalogo
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Placa o conductor"
        mostrados={filtrados.length}
        total={buses.length}
        onLimpiar={() => {
          setBusqueda("");
          setEstado("activos");
        }}
      >
        <Select
          label="Estado"
          data={OPCIONES_ESTADO}
          value={estado}
          onChange={(v) => setEstado((v as FiltroEstado) ?? "activos")}
          w={150}
          allowDeselect={false}
        />
      </FiltrosCatalogo>

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
          {pag.visibles.map((bus) => (
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
          {filtrados.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed" ta="center" py="lg" size="sm">
                  {buses.length === 0
                    ? "Todavía no hay buses registrados."
                    : "Ningún bus coincide con la búsqueda."}
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <PiePaginacion
        pagina={pag.pagina}
        totalPaginas={pag.totalPaginas}
        onPagina={pag.setPagina}
      />

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
