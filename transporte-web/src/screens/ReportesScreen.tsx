import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Group,
  Loader,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconDownload, IconReportAnalytics, IconUser } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "../services/firebase";
import { listarRutas } from "../services/rutasService";
import { listarBuses } from "../services/busesService";
import { listarUsuarios } from "../services/usuariosService";
import { listarNinos } from "../services/ninosService";
import {
  contarNinosTransportados,
  listarRegistrosDeNino,
  listarViajesEnRango,
} from "../services/reportesService";
import { descargarCSV } from "../utils/csv";
import type { Bus, Nino, Registro, Ruta, Usuario, Viaje } from "../types/models";

// Fecha local "YYYY-MM-DD" (mismo formato que Viaje.fecha)
function fechaISO(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

// Hora "H:mm" de un Timestamp
function horaCorta(ts?: Timestamp): string {
  if (!ts) return "—";
  const fecha = ts.toDate();
  return `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, "0")}`;
}

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  finalizado: "Finalizado",
};

interface FilaViaje {
  viaje: Viaje;
  rutaNombre: string;
  conductorNombre: string;
  busPlaca: string;
  ninos: number;
}

interface FilaHistorial {
  fecha: string;
  rutaNombre: string;
  evento: string;
  hora: string;
}

// Pantalla de reportes (Fase 8): dos pestañas.
//  - "Viajes": filtra por rango de fechas / ruta / conductor y cuenta niños
//    transportados por viaje. Exporta CSV.
//  - "Por niño": historial de asistencia (subió/bajó) de un niño. Exporta CSV.
export default function ReportesScreen() {
  // Catálogos (se cargan una vez, para nombres y para los selectores de filtro)
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [conductores, setConductores] = useState<Usuario[]>([]);
  const [ninos, setNinos] = useState<Nino[]>([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const rutasPorId = useMemo(() => new Map(rutas.map((r) => [r.id, r])), [rutas]);
  const [busesPorId, setBusesPorId] = useState<Map<string, Bus>>(new Map());
  const [usuariosPorId, setUsuariosPorId] = useState<Map<string, Usuario>>(new Map());

  useEffect(() => {
    Promise.all([listarRutas(), listarBuses(), listarUsuarios(), listarNinos()])
      .then(([rs, bs, us, ns]) => {
        setRutas(rs);
        setBusesPorId(new Map(bs.map((b) => [b.id, b])));
        setUsuariosPorId(new Map(us.map((u) => [u.id, u])));
        setConductores(us.filter((u) => u.rol === "conductor"));
        setNinos(ns);
      })
      .catch(() => notifications.show({ color: "red", message: "No se pudieron cargar los datos." }))
      .finally(() => setCargandoCatalogos(false));
  }, []);

  if (cargandoCatalogos) {
    return <Loader />;
  }

  return (
    <Stack>
      <Title order={3}>Reportes</Title>
      <Tabs defaultValue="viajes">
        <Tabs.List>
          <Tabs.Tab value="viajes" leftSection={<IconReportAnalytics size={16} />}>
            Viajes
          </Tabs.Tab>
          <Tabs.Tab value="nino" leftSection={<IconUser size={16} />}>
            Por niño
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="viajes" pt="md">
          <ReporteViajes
            rutas={rutas}
            conductores={conductores}
            rutasPorId={rutasPorId}
            busesPorId={busesPorId}
            usuariosPorId={usuariosPorId}
          />
        </Tabs.Panel>

        <Tabs.Panel value="nino" pt="md">
          <ReportePorNino ninos={ninos} rutasPorId={rutasPorId} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

// ============================================
// Pestaña "Viajes"
// ============================================
function ReporteViajes({
  rutas,
  conductores,
  rutasPorId,
  busesPorId,
  usuariosPorId,
}: {
  rutas: Ruta[];
  conductores: Usuario[];
  rutasPorId: Map<string, Ruta>;
  busesPorId: Map<string, Bus>;
  usuariosPorId: Map<string, Usuario>;
}) {
  const hoy = new Date();
  const haceUnaSemana = new Date();
  haceUnaSemana.setDate(hoy.getDate() - 7);

  const [desde, setDesde] = useState(fechaISO(haceUnaSemana));
  const [hasta, setHasta] = useState(fechaISO(hoy));
  const [filtroRuta, setFiltroRuta] = useState<string | null>(null);
  const [filtroConductor, setFiltroConductor] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaViaje[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  const buscar = async () => {
    setBuscando(true);
    try {
      let viajes = await listarViajesEnRango(desde, hasta);
      if (filtroRuta) viajes = viajes.filter((v) => v.rutaId === filtroRuta);
      if (filtroConductor) viajes = viajes.filter((v) => v.conductorId === filtroConductor);
      // Orden: fecha desc y, dentro del día, por hora de inicio
      viajes.sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
        return (a.horaInicio?.toMillis() ?? 0) - (b.horaInicio?.toMillis() ?? 0);
      });
      // Niños transportados por viaje (una consulta a registros por viaje)
      const conteos = await Promise.all(viajes.map((v) => contarNinosTransportados(v.id)));
      setFilas(
        viajes.map((viaje, i) => ({
          viaje,
          rutaNombre: rutasPorId.get(viaje.rutaId)?.nombre ?? "Ruta",
          conductorNombre: usuariosPorId.get(viaje.conductorId)?.nombre ?? "—",
          busPlaca: busesPorId.get(viaje.busId)?.placa ?? "—",
          ninos: conteos[i],
        }))
      );
    } catch {
      notifications.show({ color: "red", message: "No se pudo generar el reporte." });
    } finally {
      setBuscando(false);
    }
  };

  const exportar = () => {
    if (!filas || filas.length === 0) return;
    descargarCSV(
      `viajes_${desde}_a_${hasta}.csv`,
      ["Fecha", "Ruta", "Conductor", "Bus", "Estado", "Inicio", "Fin", "Niños transportados"],
      filas.map((f) => [
        f.viaje.fecha,
        f.rutaNombre,
        f.conductorNombre,
        f.busPlaca,
        ETIQUETA_ESTADO[f.viaje.estado] ?? f.viaje.estado,
        horaCorta(f.viaje.horaInicio),
        horaCorta(f.viaje.horaFin),
        f.ninos,
      ])
    );
  };

  const totalNinos = filas?.reduce((suma, f) => suma + f.ninos, 0) ?? 0;

  return (
    <Stack>
      <Group align="flex-end" gap="sm">
        <TextInput
          label="Desde"
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.currentTarget.value)}
        />
        <TextInput
          label="Hasta"
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.currentTarget.value)}
        />
        <Select
          label="Ruta"
          placeholder="Todas"
          clearable
          data={rutas.map((r) => ({ value: r.id, label: r.nombre }))}
          value={filtroRuta}
          onChange={setFiltroRuta}
        />
        <Select
          label="Conductor"
          placeholder="Todos"
          clearable
          data={conductores.map((c) => ({ value: c.id, label: c.nombre }))}
          value={filtroConductor}
          onChange={setFiltroConductor}
        />
        <Button onClick={buscar} loading={buscando}>
          Buscar
        </Button>
        <Button
          variant="light"
          leftSection={<IconDownload size={16} />}
          onClick={exportar}
          disabled={!filas || filas.length === 0}
        >
          Exportar CSV
        </Button>
      </Group>

      {filas && (
        <>
          <Text size="sm" c="dimmed">
            {filas.length} viaje{filas.length === 1 ? "" : "s"} · {totalNinos} niño
            {totalNinos === 1 ? "" : "s"} transportado{totalNinos === 1 ? "" : "s"} (suma)
          </Text>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Fecha</Table.Th>
                <Table.Th>Ruta</Table.Th>
                <Table.Th>Conductor</Table.Th>
                <Table.Th>Bus</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Inicio</Table.Th>
                <Table.Th>Fin</Table.Th>
                <Table.Th>Niños</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filas.map((f) => (
                <Table.Tr key={f.viaje.id}>
                  <Table.Td>{f.viaje.fecha}</Table.Td>
                  <Table.Td>{f.rutaNombre}</Table.Td>
                  <Table.Td>{f.conductorNombre}</Table.Td>
                  <Table.Td>{f.busPlaca}</Table.Td>
                  <Table.Td>{ETIQUETA_ESTADO[f.viaje.estado] ?? f.viaje.estado}</Table.Td>
                  <Table.Td>{horaCorta(f.viaje.horaInicio)}</Table.Td>
                  <Table.Td>{horaCorta(f.viaje.horaFin)}</Table.Td>
                  <Table.Td>{f.ninos}</Table.Td>
                </Table.Tr>
              ))}
              {filas.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text c="dimmed" ta="center">
                      No hay viajes en ese rango con esos filtros.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  );
}

// ============================================
// Pestaña "Por niño"
// ============================================
function ReportePorNino({
  ninos,
  rutasPorId,
}: {
  ninos: Nino[];
  rutasPorId: Map<string, Ruta>;
}) {
  const [ninoSel, setNinoSel] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaHistorial[] | null>(null);
  const [cargando, setCargando] = useState(false);

  const nombreNino = ninos.find((n) => n.id === ninoSel)?.nombre ?? "";

  // Al elegir un niño se cargan sus registros. Para nombrar la ruta de cada
  // registro se usa el viaje (registro.viajeId → viaje.rutaId). Se cargan solo
  // los viajes referenciados por esos registros, con getDoc puntual.
  const seleccionar = async (id: string | null) => {
    setNinoSel(id);
    setFilas(null);
    if (!id) return;
    setCargando(true);
    try {
      const registros = await listarRegistrosDeNino(id);
      const filasHist = await construirHistorial(registros, rutasPorId);
      setFilas(filasHist);
    } catch {
      notifications.show({ color: "red", message: "No se pudo cargar el historial." });
    } finally {
      setCargando(false);
    }
  };

  const exportar = () => {
    if (!filas || filas.length === 0) return;
    descargarCSV(
      `asistencia_${nombreNino.replace(/\s+/g, "_")}.csv`,
      ["Fecha", "Ruta", "Evento", "Hora"],
      filas.map((f) => [f.fecha, f.rutaNombre, f.evento, f.hora])
    );
  };

  return (
    <Stack>
      <Group align="flex-end" gap="sm">
        <Select
          label="Niño"
          placeholder="Elegí un niño"
          searchable
          data={ninos.map((n) => ({ value: n.id, label: n.nombre }))}
          value={ninoSel}
          onChange={seleccionar}
          w={280}
        />
        <Button
          variant="light"
          leftSection={<IconDownload size={16} />}
          onClick={exportar}
          disabled={!filas || filas.length === 0}
        >
          Exportar CSV
        </Button>
      </Group>

      {cargando && <Loader />}

      {filas && !cargando && (
        <>
          <Text size="sm" c="dimmed">
            {filas.length} registro{filas.length === 1 ? "" : "s"} de asistencia
          </Text>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Fecha</Table.Th>
                <Table.Th>Ruta</Table.Th>
                <Table.Th>Evento</Table.Th>
                <Table.Th>Hora</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filas.map((f, i) => (
                <Table.Tr key={i}>
                  <Table.Td>{f.fecha}</Table.Td>
                  <Table.Td>{f.rutaNombre}</Table.Td>
                  <Table.Td>{f.evento}</Table.Td>
                  <Table.Td>{f.hora}</Table.Td>
                </Table.Tr>
              ))}
              {filas.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text c="dimmed" ta="center">
                      Este niño todavía no tiene registros de asistencia.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  );
}

// Construye las filas del historial de un niño a partir de sus registros. La
// fecha sale del Timestamp del registro; la ruta, del viaje asociado (se cachea
// para no pedir dos veces el mismo viaje).
async function construirHistorial(
  registros: Registro[],
  rutasPorId: Map<string, Ruta>
): Promise<FilaHistorial[]> {
  const cacheViajes = new Map<string, Viaje | null>();

  const filas: FilaHistorial[] = [];
  for (const r of registros) {
    let viaje = cacheViajes.get(r.viajeId);
    if (viaje === undefined) {
      const snap = await getDoc(doc(db, "viajes", r.viajeId));
      viaje = snap.exists() ? ({ id: snap.id, ...snap.data() } as Viaje) : null;
      cacheViajes.set(r.viajeId, viaje);
    }
    const fechaTs = r.hora.toDate();
    filas.push({
      fecha: viaje?.fecha ?? fechaISO(fechaTs),
      rutaNombre: viaje ? (rutasPorId.get(viaje.rutaId)?.nombre ?? "Ruta") : "—",
      evento: r.evento === "subio" ? "Subió" : "Bajó",
      hora: horaCorta(r.hora),
    });
  }
  return filas;
}
