import { useEffect, useMemo, useState } from "react";
import { Badge, Group, Select, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconSearch } from "@tabler/icons-react";
import { listarAuditoria } from "../services/auditoriaService";
import { listarUsuarios } from "../services/usuariosService";
import { listarBuses } from "../services/busesService";
import { listarRutas } from "../services/rutasService";
import { listarNinos } from "../services/ninosService";
import { listarEscuelas } from "../services/escuelasService";
import type { Auditoria, ColeccionAuditada } from "../types/models";
import CargandoBus from "../components/CargandoBus";

// ============================================
// AUDITORÍA
// ============================================
// Quién hizo cada cambio sensible desde el panel, cuándo y qué cambió: el padre
// de un niño, su casa, quién maneja una unidad, qué niños van en una ruta, las
// bajas de cuentas, las suplencias. Los registros los crea el propio panel en el
// mismo lote que el cambio (las reglas de Firestore no aceptan el cambio sin su
// registro) y no se pueden editar ni borrar, ni siquiera desde acá.

const ETIQUETA_COLECCION: Record<ColeccionAuditada, string> = {
  usuarios: "Cuenta",
  ninos: "Niño",
  buses: "Unidad",
  rutas: "Ruta",
  suplencias: "Suplencia",
};

const ETIQUETA_ACCION: Record<string, string> = {
  crear: "Alta",
  editar: "Edición",
  activar: "Reactivación",
  desactivar: "Desactivación",
  archivar: "Archivado",
  restaurar: "Restauración",
  borrar: "Borrado",
  asignar_suplente: "Suplente asignado",
  cancelar_suplencia: "Suplencia cancelada",
  cambiar_ubicacion: "Cambio de ubicación",
  cambiar_escuela: "Cambio de escuela",
  cambiar_turno: "Cambio de turno",
  deshacer_transbordo: "Transbordo deshecho",
  migrar: "Migración",
  datos_prueba: "Datos de prueba",
};

// Las acciones que quitan acceso o borran algo se destacan en rojo
const ACCIONES_FUERTES = new Set(["desactivar", "archivar", "borrar"]);

const ETIQUETA_CAMPO: Record<string, string> = {
  padreId: "Padre",
  parada: "Casa (recogida)",
  paradaTarde: "Entrega de la tarde",
  escuelaId: "Escuela",
  turno: "Turno",
  nombre: "Nombre",
  grado: "Grado",
  conductorId: "Conductor",
  placa: "Placa",
  capacidad: "Capacidad",
  busId: "Unidad",
  horaSalida: "Hora de salida",
};

const OPCIONES_COLECCION = [
  { value: "", label: "Todo" },
  ...Object.entries(ETIQUETA_COLECCION).map(([value, label]) => ({ value, label })),
];

function fechaHora(a: Auditoria): string {
  const f = a.hora?.toDate();
  if (!f) return "—";
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()} ${f.getHours()}:${dos(f.getMinutes())}`;
}

export default function AuditoriaScreen() {
  const [registros, setRegistros] = useState<Auditoria[] | null>(null);
  // Un solo mapa id → nombre para todo lo que puede aparecer en un registro:
  // cuentas, unidades (por placa), rutas, niños y escuelas
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());
  const [coleccion, setColeccion] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    Promise.all([
      listarAuditoria(),
      listarUsuarios(),
      listarBuses(),
      listarRutas(),
      listarNinos(),
      listarEscuelas(),
    ])
      .then(([auditoria, usuarios, buses, rutas, ninos, escuelas]) => {
        setRegistros(auditoria);
        setNombres(
          new Map<string, string>([
            ...usuarios.map((u) => [u.id, u.nombre] as [string, string]),
            ...buses.map((b) => [b.id, `Unidad ${b.placa}`] as [string, string]),
            ...rutas.map((r) => [r.id, r.nombre] as [string, string]),
            ...ninos.map((n) => [n.id, n.nombre] as [string, string]),
            ...escuelas.map((e) => [e.id, e.nombre] as [string, string]),
          ])
        );
      })
      .catch(() =>
        notifications.show({ color: "red", message: "No se pudo cargar la auditoría." })
      );
  }, []);

  // Nombre de un documento. Una suplencia tiene id "<busId>_<fecha>".
  const nombreDe = (id: string, col: ColeccionAuditada): string => {
    if (col === "suplencias") {
      const corte = id.lastIndexOf("_");
      return `${nombres.get(id.slice(0, corte)) ?? "Unidad"} · ${id.slice(corte + 1)}`;
    }
    return nombres.get(id) ?? "(ya no existe)";
  };

  const sobreQue = (a: Auditoria): string => {
    const lista = a.docIds.map((id) => nombreDe(id, a.coleccion));
    return lista.length <= 3 ? lista.join(", ") : `${lista.slice(0, 3).join(", ")} y ${lista.length - 3} más`;
  };

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return (registros ?? []).filter((a) => {
      if (coleccion && a.coleccion !== coleccion) return false;
      if (!texto) return true;
      const enTexto = [
        a.detalle,
        nombres.get(a.actorId),
        ...a.docIds.map((id) => nombres.get(id)),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return enTexto.includes(texto);
    });
  }, [registros, coleccion, busqueda, nombres]);

  if (!registros) {
    return <CargandoBus texto="Cargando la auditoría…" />;
  }

  return (
    <Stack>
      <Title order={3}>Auditoría</Title>
      <Text c="dimmed" size="sm" maw={760}>
        Cada cambio sensible hecho desde el panel, con quién lo hizo y la hora del servidor. Estos
        registros no se pueden editar ni borrar. Se muestran los últimos {registros.length}.
      </Text>

      <Group align="flex-end">
        <TextInput
          label="Buscar"
          placeholder="Nombre, detalle o admin"
          leftSection={<IconSearch size={16} />}
          value={busqueda}
          onChange={(e) => setBusqueda(e.currentTarget.value)}
          w={280}
        />
        <Select
          label="Sobre"
          data={OPCIONES_COLECCION}
          value={coleccion}
          onChange={(v) => setColeccion(v ?? "")}
          allowDeselect={false}
          w={170}
        />
      </Group>

      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Cuándo</Table.Th>
            <Table.Th>Quién</Table.Th>
            <Table.Th>Qué</Table.Th>
            <Table.Th>Sobre</Table.Th>
            <Table.Th>Detalle</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filtrados.map((a) => (
            <Table.Tr key={a.id}>
              <Table.Td style={{ whiteSpace: "nowrap" }}>{fechaHora(a)}</Table.Td>
              <Table.Td>{nombres.get(a.actorId) ?? "—"}</Table.Td>
              <Table.Td>
                <Badge variant="light" color={ACCIONES_FUERTES.has(a.accion) ? "red" : "blue"}>
                  {ETIQUETA_ACCION[a.accion] ?? a.accion}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="xs" c="dimmed">
                  {ETIQUETA_COLECCION[a.coleccion]}
                </Text>
                <Text size="sm">{sobreQue(a)}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{a.detalle}</Text>
                {(a.cambios ?? []).map((c, i) => (
                  <Text key={i} size="xs" c="dimmed">
                    {ETIQUETA_CAMPO[c.campo] ?? c.campo}: {nombres.get(c.antes) ?? c.antes} →{" "}
                    <strong>{nombres.get(c.despues) ?? c.despues}</strong>
                  </Text>
                ))}
              </Table.Td>
            </Table.Tr>
          ))}
          {filtrados.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text c="dimmed" ta="center" py="lg" size="sm">
                  {registros.length === 0
                    ? "Todavía no hay cambios auditados."
                    : "Ningún registro coincide con la búsqueda."}
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
