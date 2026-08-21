import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  FileInput,
  Flex,
  Group,
  Image,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCamera,
  IconInfoCircle,
  IconPencil,
  IconPlus,
  IconSend,
  IconUsers,
} from "@tabler/icons-react";
import { useAuth } from "../context/AuthContext";
import {
  actualizarCanal,
  cambiarActivoCanal,
  crearCanal,
  escucharAvisos,
  listarCanales,
  padresDeEscuela,
  publicarAviso,
} from "../services/canalesService";
import { notificarAvisoNuevo } from "../services/notificacionesService";
import { listarEscuelas } from "../services/escuelasService";
import { listarNinos } from "../services/ninosService";
import { listarUsuarios } from "../services/usuariosService";
import { comprimirImagen } from "../utils/imagen";
import type { Aviso, Canal, Escuela, Nino, Usuario } from "../types/models";

// Fecha y hora legible de un aviso
function cuando(a: Aviso): string {
  return a.hora.toDate().toLocaleString("es-HN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Canales informativos por escuela: el admin publica, los padres de esa escuela
// leen. Nadie se inscribe a mano — reciben el canal los padres con hijos activos
// en la escuela del canal (un padre con hijos en dos escuelas recibe los dos).
export default function CanalesScreen() {
  const { usuario } = useAuth();

  const [canales, setCanales] = useState<Canal[] | null>(null);
  const [escuelas, setEscuelas] = useState<Escuela[]>([]);
  const [ninos, setNinos] = useState<Nino[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [texto, setTexto] = useState("");
  const [publicando, setPublicando] = useState(false);

  const [modalAbierto, { open, close }] = useDisclosure(false);
  const [editando, setEditando] = useState<Canal | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [verMiembros, { open: abrirMiembros, close: cerrarMiembros }] = useDisclosure(false);

  const form = useForm({
    initialValues: { nombre: "", escuelaId: "", descripcion: "" },
    validate: {
      nombre: (v) => (v.trim() ? null : "El nombre es obligatorio"),
      escuelaId: (v) => (v ? null : "Elegí la escuela"),
    },
  });

  const cargar = () => {
    Promise.all([listarCanales(), listarEscuelas(), listarNinos(), listarUsuarios()])
      .then(([cs, es, ns, us]) => {
        setCanales(cs);
        setEscuelas(es.filter((e) => e.activa));
        setNinos(ns);
        setUsuarios(us);
      })
      .catch(() => {
        notifications.show({
          color: "red",
          message:
            "No se pudieron cargar los canales. Si es la primera vez, desplegá las reglas de Firestore.",
        });
        setCanales([]);
      });
  };

  useEffect(cargar, []);

  // Avisos del canal seleccionado, en vivo
  useEffect(() => {
    if (!seleccionId) return;
    return escucharAvisos(seleccionId, setAvisos);
  }, [seleccionId]);

  // Al abrir otro canal se limpian los avisos del anterior en el mismo acto (no
  // en un efecto), para no mostrar por un instante los avisos del canal previo
  const seleccionarCanal = (canalId: string) => {
    setSeleccionId(canalId);
    setAvisos([]);
  };

  const escuelaNombre = (id: string) => escuelas.find((e) => e.id === id)?.nombre ?? "—";
  const seleccion = (canales ?? []).find((c) => c.id === seleccionId) ?? null;

  // Padres que reciben cada canal (derivados de los niños de esa escuela)
  const miembrosPorCanal = useMemo(() => {
    const mapa = new Map<string, Set<string>>();
    (canales ?? []).forEach((c) => mapa.set(c.id, padresDeEscuela(ninos, c.escuelaId)));
    return mapa;
  }, [canales, ninos]);

  const miembrosDeSeleccion = useMemo(() => {
    const ids = seleccionId ? (miembrosPorCanal.get(seleccionId) ?? new Set<string>()) : new Set<string>();
    return usuarios.filter((u) => ids.has(u.id));
  }, [seleccionId, miembrosPorCanal, usuarios]);

  const abrirCrear = () => {
    setEditando(null);
    form.reset();
    setFoto(null);
    open();
  };

  const abrirEditar = (canal: Canal) => {
    setEditando(canal);
    form.setValues({
      nombre: canal.nombre,
      escuelaId: canal.escuelaId,
      descripcion: canal.descripcion ?? "",
    });
    setFoto(canal.foto ?? null);
    open();
  };

  const elegirFoto = async (archivo: File | null) => {
    if (!archivo) return;
    try {
      setFoto(await comprimirImagen(archivo, 480)); // portada: un poco más ancha
    } catch {
      notifications.show({ color: "red", message: "No se pudo procesar la imagen." });
    }
  };

  const guardar = form.onSubmit(async (valores) => {
    setGuardando(true);
    try {
      if (editando) {
        await actualizarCanal(editando.id, {
          nombre: valores.nombre.trim(),
          descripcion: valores.descripcion.trim(),
          ...(foto ? { foto } : {}),
        });
        notifications.show({ color: "green", message: "Canal actualizado." });
      } else {
        await crearCanal({
          nombre: valores.nombre.trim(),
          escuelaId: valores.escuelaId,
          descripcion: valores.descripcion.trim(),
          ...(foto ? { foto } : {}),
        });
        notifications.show({ color: "green", message: "Canal creado." });
      }
      close();
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo guardar el canal." });
    } finally {
      setGuardando(false);
    }
  });

  const alternarActivo = async (canal: Canal) => {
    try {
      await cambiarActivoCanal(canal.id, !canal.activo);
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo cambiar el estado." });
    }
  };

  const publicar = async () => {
    const limpio = texto.trim();
    if (!limpio || !seleccionId || !usuario) return;
    setPublicando(true);
    setTexto("");
    try {
      await publicarAviso(seleccionId, limpio, usuario.id);
      // Push a los padres del canal, para que les llegue al teléfono aunque
      // tengan la app cerrada. Va sin await: el aviso ya quedó publicado, y un
      // fallo de envío no debe hacerle creer al admin que no se publicó.
      if (seleccion) {
        notificarAvisoNuevo(seleccion.id, seleccion.nombre, miembrosDeSeleccion, limpio).catch(
          () => {}
        );
      }
    } catch {
      setTexto(limpio); // se devuelve el texto para reintentar
      notifications.show({ color: "red", message: "No se pudo publicar el aviso." });
    } finally {
      setPublicando(false);
    }
  };

  if (!canales) {
    return <Loader />;
  }

  return (
    <Stack h="calc(100vh - 92px)">
      <Group justify="space-between">
        <Title order={3}>Canales informativos</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirCrear}>
          Nuevo canal
        </Button>
      </Group>

      <Alert icon={<IconInfoCircle size={16} />} color="blue" p="xs">
        Son de una sola vía: solo vos publicás, los padres únicamente leen. Cada padre recibe
        automáticamente el canal de la escuela de cada uno de sus hijos — no hay que inscribir
        a nadie.
      </Alert>

      <Flex gap="md" style={{ flex: 1, minHeight: 0 }}>
        {/* Lista de canales */}
        <Paper withBorder p="xs" w={300} style={{ display: "flex", flexDirection: "column" }}>
          <ScrollArea style={{ flex: 1 }}>
            <Stack gap="xs">
              {canales.length === 0 && (
                <Text c="dimmed" size="sm" ta="center" mt="md">
                  Todavía no hay canales. Creá el primero para una escuela.
                </Text>
              )}
              {canales.map((c) => (
                <Card
                  key={c.id}
                  withBorder
                  padding="xs"
                  bg={seleccionId === c.id ? "var(--mantine-color-blue-light)" : undefined}
                  style={{ cursor: "pointer" }}
                  onClick={() => seleccionarCanal(c.id)}
                >
                  <Group wrap="nowrap" gap="sm">
                    <Avatar src={c.foto} radius="md" size={40} color="blue">
                      {c.nombre.trim().charAt(0).toUpperCase()}
                    </Avatar>
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Text size="sm" fw={500} truncate>
                        {c.nombre}
                      </Text>
                      <Text size="xs" c="dimmed" truncate>
                        {escuelaNombre(c.escuelaId)}
                      </Text>
                    </Box>
                    <Stack gap={2} align="flex-end">
                      <Tooltip label="Padres que lo reciben">
                        <Badge variant="light" leftSection={<IconUsers size={11} />}>
                          {miembrosPorCanal.get(c.id)?.size ?? 0}
                        </Badge>
                      </Tooltip>
                      {!c.activo && (
                        <Badge color="gray" variant="light" size="sm">
                          Inactivo
                        </Badge>
                      )}
                    </Stack>
                  </Group>
                </Card>
              ))}
            </Stack>
          </ScrollArea>
        </Paper>

        {/* Panel del canal: portada, publicación y avisos */}
        <Paper withBorder style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {!seleccion ? (
            <Flex align="center" justify="center" style={{ flex: 1 }}>
              <Text c="dimmed">Elegí un canal para publicar avisos.</Text>
            </Flex>
          ) : (
            <>
              {seleccion.foto && (
                <Image src={seleccion.foto} h={120} fit="cover" alt={seleccion.nombre} />
              )}
              <Group
                p="sm"
                justify="space-between"
                style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}
              >
                <Box>
                  <Text fw={600}>{seleccion.nombre}</Text>
                  <Text size="sm" c="dimmed">
                    {escuelaNombre(seleccion.escuelaId)} ·{" "}
                    {miembrosPorCanal.get(seleccion.id)?.size ?? 0} padres
                    {seleccion.descripcion ? ` · ${seleccion.descripcion}` : ""}
                  </Text>
                </Box>
                <Group gap="xs">
                  <Switch
                    checked={seleccion.activo}
                    onChange={() => alternarActivo(seleccion)}
                    label="Activo"
                    labelPosition="left"
                  />
                  <Button
                    variant="subtle"
                    size="compact-sm"
                    leftSection={<IconUsers size={14} />}
                    onClick={abrirMiembros}
                  >
                    Ver padres
                  </Button>
                  <Button
                    variant="subtle"
                    size="compact-sm"
                    leftSection={<IconPencil size={14} />}
                    onClick={() => abrirEditar(seleccion)}
                  >
                    Editar
                  </Button>
                </Group>
              </Group>

              {/* Publicar */}
              <Group p="sm" gap="xs" align="flex-end">
                <Textarea
                  style={{ flex: 1 }}
                  placeholder="Escribí el aviso para los padres…"
                  autosize
                  minRows={1}
                  maxRows={4}
                  value={texto}
                  onChange={(e) => setTexto(e.currentTarget.value)}
                />
                <Button
                  leftSection={<IconSend size={16} />}
                  onClick={publicar}
                  loading={publicando}
                  disabled={!texto.trim() || !seleccion.activo}
                >
                  Publicar
                </Button>
              </Group>

              {/* Avisos publicados (los más nuevos arriba) */}
              <ScrollArea style={{ flex: 1 }} p="sm">
                <Stack gap="xs">
                  {avisos.length === 0 && (
                    <Text c="dimmed" size="sm" ta="center" mt="md">
                      Todavía no publicaste nada en este canal.
                    </Text>
                  )}
                  {avisos.map((a) => (
                    <Paper key={a.id} withBorder p="sm">
                      <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                        {a.texto}
                      </Text>
                      <Text size="xs" c="dimmed" mt={4}>
                        {cuando(a)}
                      </Text>
                    </Paper>
                  ))}
                </Stack>
              </ScrollArea>
            </>
          )}
        </Paper>
      </Flex>

      {/* Alta / edición del canal */}
      <Modal opened={modalAbierto} onClose={close} title={editando ? "Editar canal" : "Nuevo canal"}>
        <form onSubmit={guardar}>
          <Stack gap="sm">
            <Group align="flex-end" gap="sm">
              <Avatar src={foto} size={56} radius="md" color="blue">
                {form.values.nombre.trim().charAt(0).toUpperCase() || "C"}
              </Avatar>
              <FileInput
                style={{ flex: 1 }}
                label="Portada (ej. el logo de la escuela)"
                placeholder="Elegir imagen"
                accept="image/*"
                leftSection={<IconCamera size={16} />}
                onChange={elegirFoto}
                clearable={false}
              />
            </Group>
            <TextInput
              label="Nombre del canal"
              placeholder="Ej. Avisos Escuela Bella Vista"
              required
              {...form.getInputProps("nombre")}
            />
            <Select
              label="Escuela"
              description="Los padres de los niños de esta escuela reciben el canal automáticamente"
              required
              searchable
              disabled={!!editando} // cambiar la escuela cambiaría a quién le llega
              data={escuelas.map((e) => ({ value: e.id, label: e.nombre }))}
              {...form.getInputProps("escuelaId")}
            />
            <Textarea
              label="Descripción (opcional)"
              autosize
              minRows={2}
              {...form.getInputProps("descripcion")}
            />
            {escuelas.length === 0 && (
              <Text size="xs" c="orange">
                No hay escuelas activas. Creá primero la escuela.
              </Text>
            )}
            <Button type="submit" loading={guardando}>
              {editando ? "Guardar cambios" : "Crear canal"}
            </Button>
          </Stack>
        </form>
      </Modal>

      {/* Quiénes reciben el canal */}
      <Modal opened={verMiembros} onClose={cerrarMiembros} title="Padres que reciben este canal">
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            Se calcula solo: son los padres con hijos activos en{" "}
            {seleccion ? escuelaNombre(seleccion.escuelaId) : "la escuela"}.
          </Text>
          {miembrosDeSeleccion.length === 0 && (
            <Text size="sm">Ningún padre todavía (esa escuela no tiene niños activos).</Text>
          )}
          {miembrosDeSeleccion.map((p) => (
            <Group key={p.id} gap="sm">
              <Avatar src={p.foto} radius="xl" size={32} color="blue">
                {p.nombre.trim().charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Text size="sm">{p.nombre}</Text>
                <Text size="xs" c="dimmed">
                  {p.telefono || p.email}
                </Text>
              </Box>
            </Group>
          ))}
        </Stack>
      </Modal>
    </Stack>
  );
}
