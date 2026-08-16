import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Badge,
  Button,
  Collapse,
  Group,
  List,
  Loader,
  Modal,
  Progress,
  ScrollArea,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconArrowsExchange,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import {
  analizarBorradoDeRuta,
  borrarRuta,
  cambiarActivaRuta,
  listarRutas,
  type ImpactoBorradoRuta,
} from "../services/rutasService";
import { listarBuses } from "../services/busesService";
import { listarEscuelas } from "../services/escuelasService";
import { listarNinos } from "../services/ninosService";
import { TURNOS, etiquetaTurno, viajaEnTurno } from "../utils/turnos";
import type { Bus, Escuela, Nino, Ruta, Turno } from "../types/models";

// Pantalla de Rutas: la lista y el acceso al armador. Todo el trabajo de
// asignar niños y marcar transbordos vive en /rutas/:id (ArmadorRutaScreen),
// que es una PÁGINA — así el menú lateral queda a la vista mientras se arma.
export default function RutasScreen() {
  const navigate = useNavigate();
  const [rutas, setRutas] = useState<Ruta[] | null>(null);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [ninos, setNinos] = useState<Nino[]>([]);
  const [escuelas, setEscuelas] = useState<Escuela[]>([]);
  const [error, setError] = useState("");
  const [verSinRuta, setVerSinRuta] = useState(false);

  // --- Borrado de una ruta, con doble confirmación ---
  // Paso 1: se muestra qué se pierde y qué otras rutas se van a tocar.
  // Paso 2: hay que escribir el nombre de la ruta para habilitar el botón.
  // Es una acción que no se puede deshacer, así que no alcanza con un "¿seguro?".
  const [aBorrar, setABorrar] = useState<Ruta | null>(null);
  const [impacto, setImpacto] = useState<ImpactoBorradoRuta | null>(null);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [nombreEscrito, setNombreEscrito] = useState("");
  const [borrandoRuta, setBorrandoRuta] = useState(false);

  const cargar = () => {
    Promise.all([listarRutas(), listarBuses(), listarNinos(), listarEscuelas()])
      .then(([listaRutas, listaBuses, listaNinos, listaEscuelas]) => {
        setError("");
        setRutas(listaRutas);
        setBuses(listaBuses.filter((b) => b.activo));
        setNinos(listaNinos.filter((n) => n.activo));
        setEscuelas(listaEscuelas.filter((e) => e.activa));
      })
      .catch(() =>
        setError(
          "No se pudieron cargar las rutas. Revisá tu conexión y que las reglas de Firestore estén desplegadas."
        )
      );
  };

  useEffect(cargar, []);

  const busesPorId = useMemo(() => new Map(buses.map((b) => [b.id, b])), [buses]);

  // --- Niños que no viajan en ninguna ruta activa de su turno ---
  // Es el dato operativo que faltaba: un niño sin ruta no lo recoge nadie y
  // hasta ahora no aparecía en ninguna pantalla. Se cuenta por turno porque un
  // niño de turno "ambos" puede tener bus en la mañana y no en la tarde.
  const sinRuta = useMemo(() => {
    if (!rutas) return [];
    return TURNOS.map(({ value }) => {
      const cubiertos = new Set<string>();
      rutas
        .filter((r) => r.activa && r.turno === value)
        .forEach((r) => (r.ninoIds ?? []).forEach((id) => cubiertos.add(id)));
      return {
        turno: value as Turno,
        ninos: ninos.filter((n) => viajaEnTurno(n.turno, value) && !cubiertos.has(n.id)),
      };
    }).filter((x) => x.ninos.length > 0);
  }, [rutas, ninos]);

  const totalSinRuta = sinRuta.reduce((suma, x) => suma + x.ninos.length, 0);

  const alternarActiva = async (ruta: Ruta) => {
    try {
      await cambiarActivaRuta(ruta.id, !ruta.activa);
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo cambiar el estado." });
    }
  };

  const abrirBorrado = async (ruta: Ruta) => {
    setABorrar(ruta);
    setImpacto(null);
    setPaso(1);
    setNombreEscrito("");
    try {
      setImpacto(await analizarBorradoDeRuta(ruta, rutas ?? [], ninos));
    } catch {
      notifications.show({
        color: "red",
        message: "No se pudo revisar qué afecta borrar esta ruta.",
      });
      setABorrar(null);
    }
  };

  const cerrarBorrado = () => {
    setABorrar(null);
    setImpacto(null);
  };

  const confirmarBorrado = async () => {
    if (!aBorrar || !impacto) return;
    setBorrandoRuta(true);
    try {
      await borrarRuta(impacto.otrasRutas, aBorrar.id);
      notifications.show({
        color: "green",
        message:
          `Se borró la ruta ${aBorrar.nombre}.` +
          (impacto.otrasRutas.length > 0
            ? ` Se actualizaron ${impacto.otrasRutas.length} ruta(s) que tenían transbordo con ella.`
            : ""),
      });
      cerrarBorrado();
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo borrar la ruta." });
    } finally {
      setBorrandoRuta(false);
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

  if (!rutas) {
    return <Loader />;
  }

  const placaBus = (id: string) => busesPorId.get(id)?.placa ?? "(sin bus)";
  const nombreEscuela = (id?: string) => escuelas.find((e) => e.id === id)?.nombre ?? "—";
  const nombreNino = (id: string) => ninos.find((n) => n.id === id)?.nombre ?? id;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Rutas</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => navigate("/rutas/nueva")}>
          Nueva ruta
        </Button>
      </Group>

      {/* Aviso de cobertura: quiénes se quedaron sin bus */}
      {totalSinRuta > 0 && (
        <Alert
          color="orange"
          variant="light"
          icon={<IconAlertTriangle size={18} />}
          title={`${totalSinRuta} niño${totalSinRuta === 1 ? "" : "s"} sin ruta asignada`}
        >
          <Group gap="xs" mb={verSinRuta ? "xs" : 0}>
            {sinRuta.map((x) => (
              <Badge key={x.turno} variant="light" color="orange">
                {etiquetaTurno(x.turno)}: {x.ninos.length}
              </Badge>
            ))}
            <Button size="compact-xs" variant="subtle" onClick={() => setVerSinRuta((v) => !v)}>
              {verSinRuta ? "Ocultar" : "Ver quiénes"}
            </Button>
          </Group>
          <Collapse expanded={verSinRuta} keepMounted={false}>
            <ScrollArea.Autosize mah={200}>
              <Stack gap={6}>
                {sinRuta.map((x) => (
                  <div key={x.turno}>
                    <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                      {etiquetaTurno(x.turno)}
                    </Text>
                    {x.ninos.map((n) => (
                      <Text key={n.id} size="sm">
                        {n.nombre} — {nombreEscuela(n.escuelaId)}
                        {n.parada ? ` · ${n.parada.nombre}` : " · ⚠ sin casa marcada"}
                      </Text>
                    ))}
                  </div>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          </Collapse>
        </Alert>
      )}

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nombre</Table.Th>
            <Table.Th>Unidad</Table.Th>
            <Table.Th>Turno</Table.Th>
            <Table.Th>Escuelas</Table.Th>
            <Table.Th>Ocupación</Table.Th>
            <Table.Th>Transbordo</Table.Th>
            <Table.Th>Activa</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rutas.map((ruta) => {
            const entrega = (ruta.ninos ?? []).some((n) => n.bajaEn.tipo === "punto");
            const recibe = (ruta.ninos ?? []).some((n) => n.subeEn.tipo === "punto");
            const aBordo = ruta.ninoIds?.length ?? 0;
            const capacidad = busesPorId.get(ruta.busId)?.capacidad ?? 0;
            const excedido = capacidad > 0 && aBordo > capacidad;
            return (
              <Table.Tr key={ruta.id}>
                <Table.Td>{ruta.nombre}</Table.Td>
                <Table.Td>{placaBus(ruta.busId)}</Table.Td>
                <Table.Td>{etiquetaTurno(ruta.turno)}</Table.Td>
                <Table.Td>
                  <Badge variant="light">{ruta.escuelaIds?.length ?? 0}</Badge>
                </Table.Td>
                <Table.Td>
                  {/* Cuántos niños lleva contra los asientos de la unidad */}
                  <Stack gap={2} w={90}>
                    <Text size="xs" fw={600} c={excedido ? "red" : undefined}>
                      {aBordo}
                      {capacidad > 0 ? ` / ${capacidad}` : ""}
                    </Text>
                    {capacidad > 0 && (
                      <Progress
                        value={Math.min(100, (aBordo / capacidad) * 100)}
                        color={excedido ? "red" : aBordo / capacidad > 0.85 ? "orange" : "blue"}
                        size="xs"
                      />
                    )}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  {entrega || recibe ? (
                    <Group gap={4}>
                      {entrega && (
                        <Badge
                          variant="light"
                          color="grape"
                          leftSection={<IconArrowsExchange size={12} />}
                        >
                          Entrega
                        </Badge>
                      )}
                      {recibe && (
                        <Badge
                          variant="light"
                          color="cyan"
                          leftSection={<IconArrowsExchange size={12} />}
                        >
                          Recibe
                        </Badge>
                      )}
                    </Group>
                  ) : (
                    <Text size="xs" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Switch checked={ruta.activa} onChange={() => alternarActiva(ruta)} />
                </Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap" justify="flex-end">
                    <Button
                      variant="light"
                      size="xs"
                      leftSection={<IconPencil size={14} />}
                      onClick={() => navigate(`/rutas/${ruta.id}`)}
                    >
                      Editar
                    </Button>
                    <Tooltip label="Borrar esta ruta">
                      <Button
                        variant="light"
                        color="red"
                        size="xs"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => abrirBorrado(ruta)}
                      >
                        Borrar
                      </Button>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
          {rutas.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={8}>
                <Text c="dimmed" ta="center">
                  Todavía no hay rutas registradas.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      {/* ---------- Borrar ruta: confirmación en dos pasos ---------- */}
      <Modal
        opened={!!aBorrar}
        onClose={cerrarBorrado}
        title={paso === 1 ? "Borrar ruta" : "Confirmá el borrado"}
        size="lg"
      >
        {!impacto ? (
          <Group gap="xs">
            <Loader size="xs" />
            <Text size="sm" c="dimmed">
              Revisando qué afecta borrar esta ruta…
            </Text>
          </Group>
        ) : paso === 1 ? (
          <Stack>
            <Text size="sm">
              Vas a borrar la ruta <strong>{aBorrar?.nombre}</strong> (
              {aBorrar?.ninoIds?.length ?? 0} niño
              {(aBorrar?.ninoIds?.length ?? 0) === 1 ? "" : "s"}).
            </Text>

            <List size="sm" spacing={4}>
              <List.Item>
                Los niños de esta ruta <strong>no se borran</strong>: quedan sin bus y van a
                aparecer en el aviso de «niños sin ruta».
              </List.Item>
              {impacto.viajes > 0 && (
                <List.Item>
                  <Text size="sm" c="orange.9">
                    Hay <strong>{impacto.viajes} viaje(s) ya registrados</strong> con esta ruta. No
                    se borran (son historial real), pero en los reportes van a quedar sin nombre de
                    ruta. Si solo querés sacarla de circulación, es mejor{" "}
                    <strong>desactivarla</strong> con el interruptor.
                  </Text>
                </List.Item>
              )}
            </List>

            {impacto.otrasRutas.length > 0 && (
              <Alert color="grape" variant="light" icon={<IconArrowsExchange size={18} />}>
                <Text size="sm" fw={600} mb={4}>
                  Esta ruta tiene transbordos con otras. Se van a arreglar solas:
                </Text>
                <List size="sm" spacing={2}>
                  {impacto.otrasRutas.map((r) => (
                    <List.Item key={r.rutaId}>
                      <strong>{r.rutaNombre}</strong>:{" "}
                      {r.vueltosDirectos.length > 0 && (
                        <>
                          {r.vueltosDirectos.map(nombreNino).join(", ")} pasa
                          {r.vueltosDirectos.length === 1 ? "" : "n"} a viajar directo
                          {r.quitados.length > 0 ? "; " : "."}
                        </>
                      )}
                      {r.quitados.length > 0 && (
                        <>
                          {r.quitados.map(nombreNino).join(", ")} queda
                          {r.quitados.length === 1 ? "" : "n"} sin bus.
                        </>
                      )}
                    </List.Item>
                  ))}
                </List>
              </Alert>
            )}

            <Group justify="flex-end">
              <Button variant="default" onClick={cerrarBorrado}>
                Cancelar
              </Button>
              <Button color="red" onClick={() => setPaso(2)}>
                Continuar
              </Button>
            </Group>
          </Stack>
        ) : (
          <Stack>
            <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />}>
              Esta acción <strong>no se puede deshacer</strong>.
            </Alert>
            <Text size="sm">
              Para confirmar, escribí el nombre exacto de la ruta:{" "}
              <strong>{aBorrar?.nombre}</strong>
            </Text>
            <TextInput
              placeholder={aBorrar?.nombre}
              value={nombreEscrito}
              onChange={(e) => setNombreEscrito(e.currentTarget.value)}
              autoFocus
            />
            <Group justify="space-between">
              <Button variant="default" onClick={() => setPaso(1)}>
                Volver
              </Button>
              <Group gap="xs">
                <Button variant="default" onClick={cerrarBorrado}>
                  Cancelar
                </Button>
                <Button
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  loading={borrandoRuta}
                  disabled={nombreEscrito.trim() !== aBorrar?.nombre}
                  onClick={confirmarBorrado}
                >
                  Borrar definitivamente
                </Button>
              </Group>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
