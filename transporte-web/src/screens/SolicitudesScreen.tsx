import { useEffect, useMemo, useState } from "react";
import {
  Anchor,
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Tabs,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconMapPin, IconX } from "@tabler/icons-react";

import {
  aprobarCambio,
  aprobarInscripcion,
  escucharSolicitudes,
  rechazarSolicitud,
} from "../services/solicitudesService";
import { listarUsuarios } from "../services/usuariosService";
import { listarNinos } from "../services/ninosService";
import { listarEscuelas } from "../services/escuelasService";
import type { Escuela, Nino, ParadaNino, Solicitud, Usuario } from "../types/models";

const ETIQUETA_TURNO: Record<string, string> = {
  manana: "Mañana",
  tarde: "Tarde",
  ambos: "Mañana y tarde",
};

const ETIQUETA_ALCANCE: Record<string, string> = {
  recogida: "dónde se recoge (mañana)",
  entrega: "dónde se entrega (tarde)",
  ambas: "dónde se recoge Y dónde se entrega",
};

// Enlace para ver una coordenada en OpenStreetMap (verificación rápida del admin)
function enlaceMapa(p: ParadaNino) {
  return `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`;
}

// Muestra los puntos de referencia que escribió el padre (los mismos que ve el
// conductor en el mapa). Sirven para verificar que la dirección tenga sentido.
function referencias(...lugares: (ParadaNino | undefined)[]) {
  const conReferencia = lugares.filter((l): l is ParadaNino => !!l?.referencia);
  if (conReferencia.length === 0) return null;
  return (
    <Stack gap={2}>
      {conReferencia.map((l, i) => (
        <Text key={i} size="xs" c="dimmed">
          <b>Referencia de {l.nombre}:</b> {l.referencia}
        </Text>
      ))}
    </Stack>
  );
}

// Bandeja de solicitudes de los padres: inscripciones de hijos y cambios de
// ubicación. Aprobar una inscripción crea el niño (queda pendiente asignarle
// ruta en el armador); aprobar una mudanza actualiza la casa del niño.
export default function SolicitudesScreen() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [ninos, setNinos] = useState<Nino[]>([]);
  const [escuelas, setEscuelas] = useState<Escuela[]>([]);
  // Modal de resolución: qué solicitud y en qué sentido
  const [resolviendo, setResolviendo] = useState<{
    solicitud: Solicitud;
    aprobar: boolean;
  } | null>(null);
  const [respuesta, setRespuesta] = useState("");
  const [procesando, setProcesando] = useState(false);

  useEffect(() => escucharSolicitudes(setSolicitudes), []);
  useEffect(() => {
    listarUsuarios().then(setUsuarios).catch(() => {});
    listarNinos().then(setNinos).catch(() => {});
    listarEscuelas().then(setEscuelas).catch(() => {});
  }, []);

  const nombrePadre = useMemo(() => {
    const mapa = new Map(usuarios.map((u) => [u.id, u.nombre]));
    return (id: string) => mapa.get(id) ?? "—";
  }, [usuarios]);
  const nombreNino = useMemo(() => {
    const mapa = new Map(ninos.map((n) => [n.id, n.nombre]));
    return (id?: string) => (id ? (mapa.get(id) ?? "—") : "—");
  }, [ninos]);
  const nombreEscuela = useMemo(() => {
    const mapa = new Map(escuelas.map((e) => [e.id, e.nombre]));
    return (id?: string) => (id ? (mapa.get(id) ?? "—") : "—");
  }, [escuelas]);

  const pendientes = solicitudes.filter((s) => s.estado === "pendiente");
  const resueltas = solicitudes.filter((s) => s.estado !== "pendiente");

  const resolver = async () => {
    if (!resolviendo) return;
    const { solicitud, aprobar } = resolviendo;
    setProcesando(true);
    try {
      if (!aprobar) {
        await rechazarSolicitud(solicitud.id, respuesta.trim() || undefined);
        notifications.show({ message: "Solicitud rechazada.", color: "gray" });
      } else if (solicitud.tipo === "inscripcion") {
        await aprobarInscripcion(solicitud, respuesta.trim() || undefined);
        notifications.show({
          message:
            "Inscripción aprobada: el niño quedó creado. Recordá asignarle ruta en la sección Rutas.",
          color: "blue",
        });
      } else {
        await aprobarCambio(solicitud, respuesta.trim() || undefined);
        notifications.show({ message: "Cambio de ubicación aprobado.", color: "blue" });
      }
      setResolviendo(null);
      setRespuesta("");
    } catch {
      notifications.show({ message: "No se pudo resolver la solicitud.", color: "red" });
    } finally {
      setProcesando(false);
    }
  };

  const tarjeta = (s: Solicitud) => (
    <Card key={s.id} withBorder padding="md">
      <Stack gap={6}>
        <Group justify="space-between" align="flex-start">
          <Group gap="sm" wrap="nowrap">
            {s.tipo === "inscripcion" && (
              <Avatar src={s.datosNino?.foto} radius="xl" color="blue">
                {(s.datosNino?.nombre ?? "?").trim().charAt(0).toUpperCase()}
              </Avatar>
            )}
            <div>
              <Text fw={600}>
                {s.tipo === "inscripcion"
                  ? `Inscripción: ${s.datosNino?.nombre ?? "—"}`
                  : `Cambio de ubicación: ${nombreNino(s.ninoId)}`}
              </Text>
              <Text size="sm" c="dimmed">
                Padre: {nombrePadre(s.padreId)} · {s.creadaEn.toDate().toLocaleString("es-HN")}
              </Text>
            </div>
          </Group>
          <Badge
            color={
              s.estado === "pendiente" ? "yellow" : s.estado === "aprobada" ? "blue" : "red"
            }
          >
            {s.estado}
          </Badge>
        </Group>

        {s.tipo === "inscripcion" && s.datosNino && (
          <>
            <Text size="sm">
              {s.datosNino.grado} · {nombreEscuela(s.datosNino.escuelaId)} · Turno:{" "}
              {ETIQUETA_TURNO[s.datosNino.turno] ?? s.datosNino.turno} · Casa:{" "}
              <Anchor href={enlaceMapa(s.datosNino.casa)} target="_blank" size="sm">
                <IconMapPin size={12} /> {s.datosNino.casa.nombre}
              </Anchor>
              {s.datosNino.entregaTarde && (
                <>
                  {" "}
                  · Entrega tarde:{" "}
                  <Anchor href={enlaceMapa(s.datosNino.entregaTarde)} target="_blank" size="sm">
                    <IconMapPin size={12} /> {s.datosNino.entregaTarde.nombre}
                  </Anchor>
                </>
              )}
            </Text>
            {referencias(s.datosNino.casa, s.datosNino.entregaTarde)}
          </>
        )}

        {s.tipo === "cambio_ubicacion" && (
          <>
            <Text size="sm">
              {s.permanente ? "Permanente (mudanza)" : `Solo el día ${s.fechaAplicacion}`} ·
              Cambia: {ETIQUETA_ALCANCE[s.alcance ?? "recogida"]}
              {s.nuevaUbicacion && (
                <>
                  {" "}
                  · Nuevo lugar:{" "}
                  <Anchor href={enlaceMapa(s.nuevaUbicacion)} target="_blank" size="sm">
                    <IconMapPin size={12} /> {s.nuevaUbicacion.nombre}
                  </Anchor>
                </>
              )}
              {s.motivo && ` · Motivo: ${s.motivo}`}
            </Text>
            {referencias(s.nuevaUbicacion)}
          </>
        )}

        {s.respuesta && (
          <Text size="sm" fs="italic" c="dimmed">
            Respuesta: {s.respuesta}
          </Text>
        )}

        {s.estado === "pendiente" && (
          <Group gap="xs">
            <Button
              size="compact-sm"
              leftSection={<IconCheck size={14} />}
              onClick={() => setResolviendo({ solicitud: s, aprobar: true })}
            >
              Aprobar
            </Button>
            <Button
              size="compact-sm"
              variant="light"
              color="red"
              leftSection={<IconX size={14} />}
              onClick={() => setResolviendo({ solicitud: s, aprobar: false })}
            >
              Rechazar
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );

  return (
    <Stack>
      <Title order={3}>Solicitudes de los padres</Title>
      <Text c="dimmed" size="sm">
        Inscripciones de hijos y cambios de ubicación pedidos desde la app. Al aprobar una
        inscripción el niño queda creado — falta solo asignarle ruta en el armador.
      </Text>

      <Tabs defaultValue="pendientes">
        <Tabs.List>
          <Tabs.Tab value="pendientes">
            Pendientes {pendientes.length > 0 ? `(${pendientes.length})` : ""}
          </Tabs.Tab>
          <Tabs.Tab value="resueltas">Resueltas</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="pendientes" pt="md">
          <Stack>
            {pendientes.length === 0 && <Text c="dimmed">No hay solicitudes pendientes.</Text>}
            {pendientes.map(tarjeta)}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="resueltas" pt="md">
          <Stack>
            {resueltas.length === 0 && <Text c="dimmed">Todavía no se resolvió ninguna.</Text>}
            {resueltas.map(tarjeta)}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={!!resolviendo}
        onClose={() => setResolviendo(null)}
        title={resolviendo?.aprobar ? "Aprobar solicitud" : "Rechazar solicitud"}
      >
        <Stack>
          <Textarea
            label="Nota para el padre (opcional)"
            placeholder={
              resolviendo?.aprobar
                ? "Ej. Aprobado — la ruta se asigna esta semana"
                : "Ej. Faltan datos, contactanos por mensaje"
            }
            value={respuesta}
            onChange={(e) => setRespuesta(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setResolviendo(null)}>
              Cancelar
            </Button>
            <Button
              color={resolviendo?.aprobar ? "blue" : "red"}
              loading={procesando}
              onClick={resolver}
            >
              {resolviendo?.aprobar ? "Aprobar" : "Rechazar"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
