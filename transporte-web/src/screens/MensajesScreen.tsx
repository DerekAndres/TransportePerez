import { useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconSearch, IconSend } from "@tabler/icons-react";
import { useAuth } from "../context/AuthContext";
import { listarUsuarios } from "../services/usuariosService";
import { notificarMensajeNuevo } from "../services/notificacionesService";
import {
  escucharBandeja,
  escucharConversacion,
  enviarMensaje,
  idConversacion,
  marcarLeidos,
  type ResumenConversacion,
} from "../services/mensajesService";
import type { Mensaje, Usuario } from "../types/models";

// Pantalla de mensajería del admin (Fase 7). Dos paneles: a la izquierda las
// conversaciones (y un selector para iniciar una nueva con cualquier conductor o
// padre); a la derecha el chat en vivo con quien esté seleccionado. El admin es
// un participante más — solo ve las conversaciones donde él es 'de' o 'para'.
export default function MensajesScreen() {
  const { usuario } = useAuth();
  const miId = usuario?.id ?? "";

  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [resumenes, setResumenes] = useState<ResumenConversacion[]>([]);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  // Filtros de la bandeja: con muchos padres la lista se vuelve inmanejable
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState<"todos" | "padre" | "conductor" | "no_leidos">(
    "todos"
  );

  // Todos los usuarios (para nombres y para el selector de "nuevo mensaje")
  useEffect(() => {
    listarUsuarios().then(setUsuarios).catch(() => setUsuarios([]));
  }, []);

  const usuariosPorId = useMemo(
    () => new Map((usuarios ?? []).map((u) => [u.id, u])),
    [usuarios]
  );

  // Bandeja en vivo
  useEffect(() => {
    if (!miId) return;
    return escucharBandeja(miId, setResumenes);
  }, [miId]);

  // Conversación seleccionada en vivo + marcar como leídos lo que me llega
  useEffect(() => {
    if (!miId || !seleccion) return;
    const conversacionId = idConversacion(miId, seleccion);
    return escucharConversacion(conversacionId, (msgs) => {
      setMensajes(msgs);
      marcarLeidos(msgs, miId).catch(() => {});
    });
  }, [miId, seleccion]);

  // Abrir una conversación: se limpian los mensajes de la anterior en el mismo
  // acto (no en un efecto) para no mostrar por un instante el hilo previo
  const seleccionar = (otroId: string) => {
    setSeleccion(otroId);
    setMensajes([]);
  };

  // Auto-scroll al último mensaje
  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: "smooth" });
  }, [mensajes]);

  const nombreDe = (id: string) => usuariosPorId.get(id)?.nombre ?? "Usuario";

  // Bandeja filtrada: por rol, por no leídos y por nombre. El filtrado es en
  // memoria sobre lo que ya llegó por los listeners (no cuesta lecturas extra).
  const resumenesFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return resumenes.filter((r) => {
      const otro = usuariosPorId.get(r.otroId);
      if (filtroRol === "no_leidos" && r.noLeidos === 0) return false;
      if ((filtroRol === "padre" || filtroRol === "conductor") && otro?.rol !== filtroRol) {
        return false;
      }
      if (texto && !(otro?.nombre ?? "").toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [resumenes, usuariosPorId, filtroRol, busqueda]);

  const totalNoLeidos = useMemo(
    () => resumenes.reduce((suma, r) => suma + r.noLeidos, 0),
    [resumenes]
  );

  // Opciones para iniciar una conversación nueva: conductores y padres (no el
  // propio admin), agrupados
  // Los eliminados no aparecen para iniciar una conversación nueva (sus hilos
  // viejos siguen visibles en la bandeja, con el nombre resuelto)
  const opcionesNuevo = useMemo(() => {
    const disponibles = (usuarios ?? []).filter((u) => !u.eliminado);
    const conductores = disponibles.filter((u) => u.rol === "conductor");
    const padres = disponibles.filter((u) => u.rol === "padre");
    return [
      { group: "Conductores", items: conductores.map((u) => ({ value: u.id, label: u.nombre })) },
      { group: "Padres", items: padres.map((u) => ({ value: u.id, label: u.nombre })) },
    ];
  }, [usuarios]);

  const enviar = async () => {
    const limpio = texto.trim();
    if (!limpio || !seleccion || enviando) return;
    setEnviando(true);
    setTexto("");
    try {
      await enviarMensaje(miId, seleccion, limpio);
      // Push al destinatario, por si tiene la app cerrada. Va sin await: el
      // mensaje ya se guardó y un fallo del aviso no debe deshacer el envío.
      if (usuario) {
        notificarMensajeNuevo(seleccion, miId, usuario.nombre, limpio).catch(() => {});
      }
    } catch {
      setTexto(limpio); // se devuelve el texto si falló, para reintentar
    } finally {
      setEnviando(false);
    }
  };

  if (!usuarios) {
    return <Loader />;
  }

  const seleccionado = seleccion ? usuariosPorId.get(seleccion) : null;

  return (
    <Stack h="calc(100vh - 92px)">
      <Title order={3}>Mensajes</Title>

      <Flex gap="md" style={{ flex: 1, minHeight: 0 }}>
        {/* Panel izquierdo: iniciar nueva + lista de conversaciones */}
        <Paper withBorder p="xs" w={300} style={{ display: "flex", flexDirection: "column" }}>
          <Select
            placeholder="Nuevo mensaje…"
            data={opcionesNuevo}
            value={null}
            onChange={(v) => v && seleccionar(v)}
            searchable
            nothingFoundMessage="Sin resultados"
            mb="xs"
          />

          {/* Filtros: con muchos padres la bandeja se vuelve larga */}
          <TextInput
            placeholder="Buscar por nombre…"
            leftSection={<IconSearch size={14} />}
            value={busqueda}
            onChange={(e) => setBusqueda(e.currentTarget.value)}
            size="xs"
            mb={6}
          />
          <SegmentedControl
            fullWidth
            size="xs"
            value={filtroRol}
            onChange={(v) => setFiltroRol(v as typeof filtroRol)}
            data={[
              { value: "todos", label: "Todos" },
              { value: "padre", label: "Padres" },
              { value: "conductor", label: "Conduct." },
              { value: "no_leidos", label: `Sin leer${totalNoLeidos ? ` (${totalNoLeidos})` : ""}` },
            ]}
            mb="xs"
          />

          <ScrollArea style={{ flex: 1 }}>
            <Stack gap={4}>
              {resumenes.length === 0 && (
                <Text c="dimmed" size="sm" ta="center" mt="md">
                  No hay conversaciones todavía.
                </Text>
              )}
              {resumenes.length > 0 && resumenesFiltrados.length === 0 && (
                <Text c="dimmed" size="sm" ta="center" mt="md">
                  Ninguna conversación coincide con el filtro.
                </Text>
              )}
              {resumenesFiltrados.map((r) => {
                const otro = usuariosPorId.get(r.otroId);
                return (
                  <Paper
                    key={r.otroId}
                    p="xs"
                    withBorder={seleccion === r.otroId}
                    bg={seleccion === r.otroId ? "var(--mantine-color-blue-light)" : undefined}
                    style={{ cursor: "pointer" }}
                    onClick={() => seleccionar(r.otroId)}
                  >
                    <Group justify="space-between" wrap="nowrap" gap="xs">
                      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                        <Avatar src={otro?.foto} radius="xl" size={34} color="blue">
                          {nombreDe(r.otroId).trim().charAt(0).toUpperCase()}
                        </Avatar>
                        <Box style={{ minWidth: 0 }}>
                          <Text size="sm" fw={500} truncate>
                            {nombreDe(r.otroId)}
                          </Text>
                          <Text size="xs" c="dimmed" truncate>
                            {r.ultimoTexto}
                          </Text>
                        </Box>
                      </Group>
                      {r.noLeidos > 0 && (
                        <Badge circle color="red">
                          {r.noLeidos}
                        </Badge>
                      )}
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          </ScrollArea>
        </Paper>

        {/* Panel derecho: el chat */}
        <Paper withBorder style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {!seleccion ? (
            <Flex align="center" justify="center" style={{ flex: 1 }}>
              <Text c="dimmed">Elegí una conversación o empezá una nueva.</Text>
            </Flex>
          ) : (
            <>
              <Group
                p="sm"
                gap="sm"
                style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}
              >
                <Avatar src={seleccionado?.foto} radius="xl" size={38} color="blue">
                  {(seleccionado?.nombre ?? "?").trim().charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Text fw={600}>{seleccionado?.nombre ?? "Usuario"}</Text>
                  {seleccionado && (
                    <Text size="sm" c="dimmed">
                      {seleccionado.rol === "conductor" ? "Conductor" : "Padre / Madre"}
                      {seleccionado.telefono ? ` · ${seleccionado.telefono}` : ""}
                    </Text>
                  )}
                </Box>
              </Group>

              <ScrollArea style={{ flex: 1 }} viewportRef={viewport} p="sm">
                <Stack gap="xs">
                  {mensajes.length === 0 && (
                    <Text c="dimmed" size="sm" ta="center" mt="md">
                      No hay mensajes. Escribí el primero.
                    </Text>
                  )}
                  {mensajes.map((m) => {
                    const mio = m.de === miId;
                    return (
                      <Box
                        key={m.id}
                        style={{
                          alignSelf: mio ? "flex-end" : "flex-start",
                          maxWidth: "72%",
                          background: mio
                            ? "var(--mantine-color-blue-6)"
                            : "var(--mantine-color-default-hover)",
                          color: mio ? "white" : undefined,
                          padding: "6px 10px",
                          borderRadius: 10,
                        }}
                      >
                        <Text size="sm">{m.texto}</Text>
                        <Text size="10px" ta="right" style={{ opacity: 0.7 }}>
                          {horaCorta(m)}
                        </Text>
                      </Box>
                    );
                  })}
                </Stack>
              </ScrollArea>

              <Group p="sm" gap="xs" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
                <TextInput
                  style={{ flex: 1 }}
                  placeholder="Escribí un mensaje"
                  value={texto}
                  onChange={(e) => setTexto(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviar();
                    }
                  }}
                />
                <Button
                  leftSection={<IconSend size={16} />}
                  onClick={enviar}
                  loading={enviando}
                  disabled={!texto.trim()}
                >
                  Enviar
                </Button>
              </Group>
            </>
          )}
        </Paper>
      </Flex>
    </Stack>
  );
}

// Hora "H:mm" del mensaje
function horaCorta(m: Mensaje): string {
  const fecha = m.hora.toDate();
  return `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, "0")}`;
}
