import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconArrowsExchange, IconInfoCircle, IconX } from "@tabler/icons-react";
import { listarBuses } from "../services/busesService";
import { listarUsuarios } from "../services/usuariosService";
import {
  asignarSuplente,
  cancelarSuplencia,
  idSuplencia,
  listarSuplenciasRecientes,
} from "../services/suplenciasService";
import {
  AVISO_ACCESOS_PENDIENTES,
  recalcularAccesosDespuesDeGuardar,
} from "../services/accesoConductoresService";
import { fechaDeHoy, fechaLegible } from "../utils/fechas";
import type { Bus, Suplencia, Usuario } from "../types/models";
import CargandoBus from "../components/CargandoBus";

// ============================================
// SUPLENCIAS
// ============================================
// Cuando el titular de una unidad no puede manejar un día, acá se asigna quién
// lo cubre. Es un cambio de UN DÍA: la unidad sigue siendo del titular, y al día
// siguiente todo vuelve solo a la normalidad. El recorrido completo de cómo
// funciona (qué ve el suplente, el titular y el padre) está explicado en
// services/suplenciasService.ts.

export default function SuplenciasScreen() {
  const [suplencias, setSuplencias] = useState<Suplencia[] | null>(null);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [modalAbierto, { open, close }] = useDisclosure(false);
  const [guardando, setGuardando] = useState(false);
  const [cancelando, setCancelando] = useState<string | null>(null);

  // --- Formulario ---
  const [busId, setBusId] = useState<string | null>(null);
  const [suplenteId, setSuplenteId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(fechaDeHoy());

  const cargar = () => {
    Promise.all([listarSuplenciasRecientes(), listarBuses(), listarUsuarios()])
      .then(([listaSuplencias, listaBuses, listaUsuarios]) => {
        setSuplencias(listaSuplencias);
        setBuses(listaBuses.filter((b) => b.activo));
        setUsuarios(listaUsuarios);
      })
      .catch(() =>
        notifications.show({ color: "red", message: "No se pudieron cargar las suplencias." })
      );
  };

  useEffect(cargar, []);

  const hoy = fechaDeHoy();
  const conductoresActivos = usuarios.filter((u) => u.rol === "conductor" && u.activo);
  const bus = buses.find((b) => b.id === busId);
  const titular = usuarios.find((u) => u.id === bus?.conductorId);
  const suplente = conductoresActivos.find((c) => c.id === suplenteId);

  // --- Lo que hay que revisar antes de guardar ---
  const revision = useMemo(() => {
    const vigentes = (suplencias ?? []).filter((s) => !s.cancelada && s.fecha === fecha);
    return {
      // Ya hay alguien cubriendo ESA unidad ese día: se reemplaza (se avisa)
      reemplaza: bus ? vigentes.find((s) => s.id === idSuplencia(bus.id, fecha)) : undefined,
      // El suplente ya cubre OTRA unidad ese día: no puede manejar dos a la vez
      yaCubreOtra: suplenteId
        ? vigentes.find((s) => s.conductorId === suplenteId && s.busId !== busId)
        : undefined,
      // El suplente es titular de otra unidad: ese día va a ver las dos
      esTitularDe: suplenteId
        ? buses.find((b) => b.conductorId === suplenteId && b.id !== busId)
        : undefined,
    };
  }, [suplencias, fecha, bus, busId, suplenteId, buses]);

  const errorFormulario = !busId
    ? "Elegí la unidad."
    : !suplenteId
      ? "Elegí quién la maneja ese día."
      : suplenteId === bus?.conductorId
        ? "El suplente no puede ser el mismo titular."
        : !fecha || fecha < hoy
          ? "La fecha tiene que ser hoy o un día que venga."
          : revision.yaCubreOtra
            ? `${suplente?.nombre} ya cubre la unidad ${revision.yaCubreOtra.busPlaca} ese día.`
            : "";

  const abrirNueva = () => {
    setBusId(null);
    setSuplenteId(null);
    setFecha(hoy);
    open();
  };

  const guardar = async () => {
    if (errorFormulario || !bus || !suplente) return;
    setGuardando(true);
    try {
      await asignarSuplente({ bus, titular, suplente, fecha });
      notifications.show({
        color: "green",
        message: `Listo: ${suplente.nombre} maneja la unidad ${bus.placa} el ${fechaLegible(fecha)}.`,
      });
      close();
      // El suplente tiene que poder ver a los niños de esa unidad en su app
      if (!(await recalcularAccesosDespuesDeGuardar())) {
        notifications.show(AVISO_ACCESOS_PENDIENTES);
      }
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo guardar la suplencia." });
    } finally {
      setGuardando(false);
    }
  };

  const cancelar = async (s: Suplencia) => {
    setCancelando(s.id);
    try {
      await cancelarSuplencia(s);
      notifications.show({
        color: "gray",
        message: `Suplencia cancelada: el ${fechaLegible(s.fecha)} maneja el titular.`,
      });
      if (!(await recalcularAccesosDespuesDeGuardar())) {
        notifications.show(AVISO_ACCESOS_PENDIENTES);
      }
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo cancelar la suplencia." });
    } finally {
      setCancelando(null);
    }
  };

  if (!suplencias) {
    return <CargandoBus texto="Cargando las suplencias…" />;
  }

  const estadoDe = (s: Suplencia) =>
    s.cancelada
      ? { texto: "Cancelada", color: "gray" }
      : s.fecha === hoy
        ? { texto: "Hoy", color: "green" }
        : s.fecha > hoy
          ? { texto: "Próxima", color: "blue" }
          : { texto: "Pasada", color: "gray" };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Suplencias</Title>
        <Button leftSection={<IconArrowsExchange size={16} />} onClick={abrirNueva}>
          Asignar suplente
        </Button>
      </Group>

      <Text c="dimmed" size="sm" maw={760}>
        Cuando el conductor de una unidad no puede trabajar un día, elegí quién lo cubre. Ese día el
        suplente ve las rutas de la unidad en su app y es quien inicia los viajes; el titular ve
        quién lo cubre; y los padres ven al suplente con su teléfono. La unidad sigue asignada al
        titular: al día siguiente todo vuelve solo a la normalidad.
      </Text>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Fecha</Table.Th>
            <Table.Th>Unidad</Table.Th>
            <Table.Th>Titular</Table.Th>
            <Table.Th>La maneja</Table.Th>
            <Table.Th>Estado</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {suplencias.map((s) => {
            const estado = estadoDe(s);
            const puedeCancelar = !s.cancelada && s.fecha >= hoy;
            return (
              <Table.Tr key={s.id} style={{ opacity: s.cancelada || s.fecha < hoy ? 0.6 : 1 }}>
                <Table.Td>{fechaLegible(s.fecha)}</Table.Td>
                <Table.Td>{s.busPlaca}</Table.Td>
                <Table.Td>{s.titularNombre || "—"}</Table.Td>
                <Table.Td>
                  <Text fw={600} size="sm">
                    {s.conductorNombre}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={estado.color} variant="light">
                    {estado.texto}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {puedeCancelar && (
                    <Button
                      variant="subtle"
                      color="red"
                      size="compact-sm"
                      leftSection={<IconX size={14} />}
                      loading={cancelando === s.id}
                      onClick={() => cancelar(s)}
                    >
                      Cancelar
                    </Button>
                  )}
                </Table.Td>
              </Table.Tr>
            );
          })}
          {suplencias.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed" ta="center" py="lg" size="sm">
                  No hay suplencias en los últimos siete días ni programadas.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={modalAbierto} onClose={close} title="Asignar suplente">
        <Stack gap="sm">
          <Select
            label="Unidad"
            placeholder="¿Qué unidad necesita conductor?"
            searchable
            data={buses.map((b) => ({
              value: b.id,
              label: `${b.placa} — titular: ${usuarios.find((u) => u.id === b.conductorId)?.nombre ?? "sin conductor"}`,
            }))}
            value={busId}
            onChange={setBusId}
          />
          <Select
            label="La maneja ese día"
            placeholder="Elegí el conductor suplente"
            searchable
            data={conductoresActivos
              .filter((c) => c.id !== bus?.conductorId)
              .map((c) => ({ value: c.id, label: c.nombre }))}
            value={suplenteId}
            onChange={setSuplenteId}
          />
          <TextInput
            label="Fecha"
            type="date"
            min={hoy}
            value={fecha}
            onChange={(e) => setFecha(e.currentTarget.value)}
          />

          {revision.reemplaza && (
            <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
              Ese día ya la cubría {revision.reemplaza.conductorNombre}: se va a reemplazar.
            </Alert>
          )}
          {revision.esTitularDe && !errorFormulario && (
            <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
              {suplente?.nombre} también es titular de la unidad {revision.esTitularDe.placa}. Ese
              día va a ver en su app las rutas de las dos unidades: asegurate de que alguien cubra
              la suya o de que no se crucen los horarios.
            </Alert>
          )}
          {errorFormulario && (busId || suplenteId) && (
            <Text size="sm" c="orange">
              {errorFormulario}
            </Text>
          )}

          <Button onClick={guardar} loading={guardando} disabled={!!errorFormulario}>
            Guardar suplencia
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
