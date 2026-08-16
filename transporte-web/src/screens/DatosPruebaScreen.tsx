import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Divider,
  Group,
  List,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconDatabase, IconTrash, IconUsersGroup } from "@tabler/icons-react";
import { listarUsuarios } from "../services/usuariosService";
import {
  borrarDatosDePrueba,
  cargarDatosDePrueba,
  cargarNinosDePrueba,
  inspeccionarDatosDePrueba,
  type InventarioPrueba,
} from "../services/datosPruebaService";
import type { Usuario } from "../types/models";

// Herramienta de prueba: carga un set chico de datos (incluye un transbordo) para
// ver el sistema funcionando, y permite borrarlo después para dejar la base
// limpia antes de cargar los datos reales de la empresa. Todo se escribe con la
// sesión del admin (respeta las reglas).
export default function DatosPruebaScreen() {
  const [conductores, setConductores] = useState<Usuario[] | null>(null);
  const [c1, setC1] = useState<string | null>(null);
  const [c2, setC2] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState("");
  // Seed de solo gente (sin rutas), para armar rutas a mano
  const [cantidadNinos, setCantidadNinos] = useState<number>(30);
  const [cargandoNinos, setCargandoNinos] = useState(false);

  const [inventario, setInventario] = useState<InventarioPrueba | null>(null);
  const [revisando, setRevisando] = useState(true);
  const [borrando, setBorrando] = useState(false);
  const [confirmando, { open: abrirConfirmacion, close: cerrarConfirmacion }] =
    useDisclosure(false);

  // Qué datos de prueba hay cargados ahora mismo. No prende el indicador de
  // "revisando" por su cuenta: el estado arranca en true para la primera carga,
  // y quien la vuelva a llamar desde un botón lo prende antes.
  const revisar = useCallback(
    () =>
      inspeccionarDatosDePrueba()
        .then(setInventario)
        .catch(() => setInventario(null))
        .finally(() => setRevisando(false)),
    []
  );

  // Volver a revisar mostrando el indicador (desde un botón o después de escribir)
  const revisarDeNuevo = () => {
    setRevisando(true);
    return revisar();
  };

  useEffect(() => {
    listarUsuarios()
      .then((us) => {
        const cs = us.filter((u) => u.rol === "conductor" && u.activo);
        setConductores(cs);
        if (cs[0]) setC1(cs[0].id);
        if (cs[1]) setC2(cs[1].id);
      })
      .catch(() => setConductores([]));
    revisar();
  }, [revisar]);

  const cargar = async () => {
    setCargando(true);
    setResultado("");
    try {
      const r = await cargarDatosDePrueba(c1 ?? "", c2 ?? "");
      setResultado(r.mensaje);
      if (r.creado) notifications.show({ color: "green", message: "Datos de prueba cargados." });
      revisarDeNuevo();
    } catch {
      setResultado(
        "Ocurrió un error al cargar. Revisá que la regla de 'puntos' esté desplegada en Firestore."
      );
    } finally {
      setCargando(false);
    }
  };

  const cargarSoloNinos = async () => {
    setCargandoNinos(true);
    setResultado("");
    try {
      const r = await cargarNinosDePrueba(
        cantidadNinos,
        conductores?.map((c) => c.id) ?? []
      );
      setResultado(r.mensaje);
      notifications.show({
        color: r.creados > 0 ? "green" : "blue",
        message: r.creados > 0 ? `Se crearon ${r.creados} niños.` : "No hizo falta crear nada.",
      });
      revisarDeNuevo();
    } catch {
      setResultado(
        "Ocurrió un error al cargar. Revisá que las reglas de Firestore estén desplegadas."
      );
    } finally {
      setCargandoNinos(false);
    }
  };

  const borrar = async () => {
    setBorrando(true);
    cerrarConfirmacion();
    try {
      const r = await borrarDatosDePrueba();
      notifications.show({
        color: "green",
        message:
          `Se borraron ${r.borrados} documentos de prueba.` +
          (r.rutasLimpiadas > 0
            ? ` Se limpiaron además ${r.rutasLimpiadas} ruta(s) reales que los tenían asignados.`
            : ""),
      });
      setResultado("");
      revisarDeNuevo();
    } catch {
      notifications.show({
        color: "red",
        message: "No se pudo borrar. Revisá tu conexión y que las reglas estén desplegadas.",
      });
    } finally {
      setBorrando(false);
    }
  };

  if (!conductores) {
    return <Loader />;
  }

  const opciones = conductores.map((c) => ({ value: c.id, label: c.nombre }));
  const hayDatos = !!inventario && inventario.total > 0;
  // Solo el seed CON rutas se bloquea a sí mismo. El de "solo niños" puede
  // convivir con él: reutiliza las escuelas, el punto y los buses que ya estén.
  const hayRutasDePrueba = !!inventario && inventario.rutas.length > 0;

  // Renglón del inventario: "2 escuelas — Escuela San José (prueba), …"
  const renglon = (etiqueta: string, items: string[]) =>
    items.length > 0 ? (
      <List.Item key={etiqueta}>
        <Text size="sm">
          <strong>
            {items.length} {etiqueta}
          </strong>{" "}
          — {items.join(", ")}
        </Text>
      </List.Item>
    ) : null;

  return (
    <Stack maw={640}>
      <Title order={3}>Datos de prueba</Title>
      <Text c="dimmed" size="sm">
        Carga un set chico para ver el sistema funcionando, incluido un transbordo (un niño
        que cambia de bus en un punto). Todo se nombra "(prueba)" y no se duplica si ya está
        cargado. Elegí dos conductores distintos — vas a iniciar sesión con ellos en el móvil
        para probar cada bus.
      </Text>

      {conductores.length < 2 ? (
        <Text c="orange">
          Necesitás al menos 2 conductores activos. Creálos en la sección Conductores y volvé.
        </Text>
      ) : (
        <>
          <Group grow>
            <Select
              label="Conductor del bus PRU-001"
              data={opciones}
              value={c1}
              onChange={setC1}
              searchable
            />
            <Select
              label="Conductor del bus PRU-002"
              data={opciones}
              value={c2}
              onChange={setC2}
              searchable
            />
          </Group>
          <Button
            leftSection={<IconDatabase size={16} />}
            onClick={cargar}
            loading={cargando}
            disabled={hayRutasDePrueba}
            w="fit-content"
          >
            Cargar datos de prueba
          </Button>
          <Text size="xs" c="dimmed">
            Ojo: usá conductores que NO tengan otro bus activo asignado, para que en el móvil
            aparezca el bus de prueba y no otro.
          </Text>
        </>
      )}

      {resultado && (
        <Card withBorder>
          <Text>{resultado}</Text>
        </Card>
      )}

      <Divider my="sm" />

      {/* ---------- Solo gente y lugares, sin rutas ---------- */}
      <Title order={4}>Solo niños, padres y escuelas (sin rutas)</Title>
      <Text c="dimmed" size="sm">
        Crea escuelas, puntos, buses, padres y niños repartidos en 10 colonias de La Ceiba, pero{" "}
        <strong>no arma ninguna ruta</strong>: las armás vos en la sección Rutas. Es la forma de
        probar el armador con volumen real — subí el número para ver cómo se comporta con 100 o
        más. Si apretás dos veces no se duplica: solo completa hasta el número que pidas.
      </Text>

      <Group align="flex-end" gap="sm">
        <NumberInput
          label="¿Cuántos niños en total?"
          min={1}
          max={300}
          step={10}
          w={200}
          value={cantidadNinos}
          onChange={(v) => setCantidadNinos(typeof v === "number" ? v : 30)}
        />
        <Button
          leftSection={<IconUsersGroup size={16} />}
          onClick={cargarSoloNinos}
          loading={cargandoNinos}
        >
          Cargar niños y padres
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        Los niños quedan con turnos mezclados (mañana, tarde y ambos) y algunos son hermanos con
        la misma casa, para que puedas ver cómo el recorrido junta las dos subidas en una sola
        parada. Los buses se asignan a los conductores activos que tengas.
      </Text>

      <Divider my="sm" />

      {/* ---------- Borrar los datos de prueba ---------- */}
      <Title order={4}>Borrar los datos de prueba</Title>
      <Text c="dimmed" size="sm">
        Deja la base como estaba antes de cargarlos. Se borran de verdad (no se archivan): son
        datos ficticios y no tiene sentido conservarlos en el historial. Hacelo antes de cargar
        los datos reales de la empresa.
      </Text>

      {revisando ? (
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">
            Buscando datos de prueba…
          </Text>
        </Group>
      ) : !inventario ? (
        <Group gap="xs">
          <Text size="sm" c="red">
            No se pudo revisar la base.
          </Text>
          <Button size="compact-sm" variant="light" onClick={revisarDeNuevo}>
            Reintentar
          </Button>
        </Group>
      ) : !hayDatos ? (
        <Text size="sm" c="dimmed">
          No hay datos de prueba cargados.
        </Text>
      ) : (
        <Card withBorder>
          <Text size="sm" fw={600} mb={6}>
            Se van a borrar {inventario.total} documentos:
          </Text>
          <List spacing={2} size="sm">
            {renglon("escuelas", inventario.escuelas)}
            {renglon("puntos de transbordo", inventario.puntos)}
            {renglon("buses", inventario.buses)}
            {renglon("padres", inventario.padres)}
            {renglon("niños", inventario.ninos)}
            {renglon("rutas", inventario.rutas)}
            {inventario.viajes > 0 && (
              <List.Item>
                <Text size="sm">
                  <strong>{inventario.viajes} viajes</strong> con{" "}
                  {inventario.registros} registro(s) de asistencia
                  {inventario.ubicaciones > 0
                    ? ` y ${inventario.ubicaciones} ubicación(es) en vivo`
                    : ""}
                </Text>
              </List.Item>
            )}
          </List>

          {inventario.rutasALimpiar.length > 0 && (
            <Alert color="blue" variant="light" mt="sm" icon={<IconAlertTriangle size={16} />}>
              Estas rutas <strong>no</strong> se borran, pero se les va a quitar el niño de
              prueba que tienen asignado:{" "}
              {inventario.rutasALimpiar
                .map((r) => `${r.nombre} (${r.quitados})`)
                .join(", ")}
              .
            </Alert>
          )}

          <Button
            color="red"
            mt="md"
            leftSection={<IconTrash size={16} />}
            onClick={abrirConfirmacion}
            loading={borrando}
            w="fit-content"
          >
            Borrar datos de prueba
          </Button>
        </Card>
      )}

      <Modal opened={confirmando} onClose={cerrarConfirmacion} title="Confirmar borrado">
        <Stack>
          <Text size="sm">
            Se van a borrar <strong>{inventario?.total ?? 0} documentos</strong> de prueba de
            Firestore. Esta acción <strong>no se puede deshacer</strong>.
          </Text>
          <Text size="sm" c="dimmed">
            No se toca ningún conductor ni ningún dato real: los conductores que elegiste para
            los buses de prueba siguen igual.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={cerrarConfirmacion}>
              Cancelar
            </Button>
            <Button color="red" leftSection={<IconTrash size={16} />} onClick={borrar}>
              Sí, borrar todo
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
