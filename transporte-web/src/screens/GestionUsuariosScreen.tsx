import { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Divider,
  FileInput,
  Group,
  Loader,
  Modal,
  Stack,
  Switch,
  Table,
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
  IconAlertTriangle,
  IconCamera,
  IconMail,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import {
  actualizarUsuario,
  cambiarActivoUsuario,
  crearUsuario,
  eliminarUsuario,
  enviarCorreoRestablecer,
  listarHijosDePadre,
  listarUsuarios,
} from "../services/usuariosService";
import { comprimirImagen } from "../utils/imagen";
import type { Usuario } from "../types/models";

// Inicial del nombre para el avatar cuando no hay foto
function inicial(nombre: string): string {
  return nombre.trim().charAt(0).toUpperCase() || "?";
}


// Pantalla reutilizable para gestionar usuarios de UN rol (conductores o padres).
// Antes era una sola pantalla "Usuarios" que mezclaba ambos; ahora se muestra
// separada por rol. La lógica es idéntica; solo cambian el rol fijo y los textos.
interface Props {
  rol: "conductor" | "padre";
}

const TEXTOS = {
  conductor: {
    titulo: "Conductores",
    nuevo: "Nuevo conductor",
    editar: "Editar conductor",
    crear: "Crear conductor",
    vacio: "Todavía no hay conductores registrados.",
  },
  padre: {
    titulo: "Padres",
    nuevo: "Nuevo padre",
    editar: "Editar padre",
    crear: "Crear padre",
    vacio: "Todavía no hay padres registrados.",
  },
} as const;

export default function GestionUsuariosScreen({ rol }: Props) {
  const textos = TEXTOS[rol];
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [modalAbierto, { open, close }] = useDisclosure(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Foto de perfil (data-URI comprimida); el usuario también puede subir la suya desde la app
  const [foto, setFoto] = useState<string | null>(null);
  // Correo cuyo reenvío está en curso (para mostrar el botón cargando)
  const [reenviando, setReenviando] = useState<string | null>(null);
  // Confirmación de archivado: a quién y a cuántos hijos alcanza
  const [porEliminar, setPorEliminar] = useState<{ usuario: Usuario; hijos: number } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [eliminando, setEliminando] = useState(false);

  const form = useForm({
    initialValues: { nombre: "", telefono: "", email: "" },
    validate: {
      nombre: (v) => (v.trim() ? null : "El nombre es obligatorio"),
      email: (v) => (editando || /^\S+@\S+\.\S+$/.test(v) ? null : "Correo inválido"),
    },
  });

  const cargar = () => {
    listarUsuarios()
      // Los archivados no salen acá: se ven (y se restauran) en Historial
      .then((lista) => setUsuarios(lista.filter((u) => u.rol === rol && !u.eliminado)))
      .catch(() =>
        notifications.show({ color: "red", message: "No se pudieron cargar los datos." })
      );
  };

  useEffect(cargar, [rol]);

  const abrirCrear = () => {
    setEditando(null);
    form.reset();
    setFoto(null);
    open();
  };

  const abrirEditar = (usuario: Usuario) => {
    setEditando(usuario);
    form.setValues({
      nombre: usuario.nombre,
      telefono: usuario.telefono,
      email: usuario.email,
    });
    setFoto(usuario.foto ?? null);
    open();
  };

  const elegirFoto = async (archivo: File | null) => {
    if (!archivo) return;
    try {
      setFoto(await comprimirImagen(archivo, 300)); // cuadrada chica: es un avatar
    } catch {
      notifications.show({ color: "red", message: "No se pudo procesar la imagen." });
    }
  };

  const guardar = form.onSubmit(async (valores) => {
    setGuardando(true);
    try {
      if (editando) {
        await actualizarUsuario(editando.id, {
          nombre: valores.nombre.trim(),
          telefono: valores.telefono.trim(),
          ...(foto ? { foto } : {}),
        });
        notifications.show({ color: "green", message: "Registro actualizado." });
      } else {
        await crearUsuario({
          nombre: valores.nombre.trim(),
          telefono: valores.telefono.trim(),
          email: valores.email.trim().toLowerCase(),
          rol, // el rol lo fija la sección, no un selector
          ...(foto ? { foto } : {}),
        });
        notifications.show({
          color: "green",
          message: `Creado. Le llegó un correo a ${valores.email.trim().toLowerCase()} para definir su contraseña.`,
        });
      }
      close();
      cargar();
    } catch (error) {
      const codigo = (error as { code?: string }).code ?? "";
      notifications.show({
        color: "red",
        message:
          codigo === "auth/email-already-in-use"
            ? "Ya existe una cuenta con ese correo."
            : "No se pudo guardar el registro.",
      });
    } finally {
      setGuardando(false);
    }
  });

  const alternarActivo = async (usuario: Usuario) => {
    try {
      await cambiarActivoUsuario(usuario.id, !usuario.activo);
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo cambiar el estado." });
    }
  };

  // Reenvía el correo de Firebase para definir la contraseña. Sirve si el
  // usuario no lo recibió, lo borró o el enlace ya venció.
  const reenviarCorreo = async (email: string) => {
    setReenviando(email);
    try {
      await enviarCorreoRestablecer(email);
      notifications.show({ color: "green", message: `Correo reenviado a ${email}.` });
    } catch {
      notifications.show({ color: "red", message: "No se pudo enviar el correo." });
    } finally {
      setReenviando(null);
    }
  };

  // Abre la confirmación de eliminar: antes averigua a cuántos hijos alcanza
  const pedirEliminar = async () => {
    if (!editando) return;
    let hijos = 0;
    if (editando.rol === "padre") {
      hijos = (await listarHijosDePadre(editando.id).catch(() => [])).filter(
        (h) => !h.eliminado
      ).length;
    }
    setPorEliminar({ usuario: editando, hijos });
    setMotivo("");
  };

  // Archiva al usuario (y a sus hijos si es padre). No borra: queda en Historial
  const confirmarEliminar = async () => {
    if (!porEliminar) return;
    setEliminando(true);
    try {
      await eliminarUsuario(porEliminar.usuario, motivo.trim());
      notifications.show({
        color: "green",
        message:
          porEliminar.hijos > 0
            ? `Perfil archivado junto con ${porEliminar.hijos} niño(s). Podés verlo en Historial.`
            : "Perfil archivado. Podés verlo en Historial.",
      });
      setPorEliminar(null);
      close();
      cargar();
    } catch {
      notifications.show({ color: "red", message: "No se pudo archivar el perfil." });
    } finally {
      setEliminando(false);
    }
  };

  if (!usuarios) {
    return <Loader />;
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>{textos.titulo}</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirCrear}>
          {textos.nuevo}
        </Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nombre</Table.Th>
            <Table.Th>Correo</Table.Th>
            <Table.Th>Teléfono</Table.Th>
            <Table.Th>Registro</Table.Th>
            <Table.Th>Activo</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {usuarios.map((usuario) => (
            <Table.Tr key={usuario.id}>
              <Table.Td>
                <Group gap="sm" wrap="nowrap">
                  <Avatar src={usuario.foto} radius="xl" color="blue">
                    {inicial(usuario.nombre)}
                  </Avatar>
                  {usuario.nombre}
                </Group>
              </Table.Td>
              <Table.Td>{usuario.email}</Table.Td>
              <Table.Td>{usuario.telefono || "—"}</Table.Td>
              <Table.Td>
                {usuario.debeCompletarPerfil ? (
                  <Tooltip label="Todavía no definió su contraseña ni entró a la app">
                    <Badge color="orange" variant="light">
                      Pendiente
                    </Badge>
                  </Tooltip>
                ) : (
                  <Badge color="green" variant="light">
                    Activo
                  </Badge>
                )}
              </Table.Td>
              <Table.Td>
                <Switch checked={usuario.activo} onChange={() => alternarActivo(usuario)} />
              </Table.Td>
              <Table.Td>
                {/* Una sola acción en la fila: abrir el perfil. Las acciones
                    delicadas (reenviar contraseña, eliminar) viven adentro, para
                    que no se disparen por un clic al pasar. */}
                <Button
                  variant="subtle"
                  size="compact-sm"
                  leftSection={<IconPencil size={14} />}
                  onClick={() => abrirEditar(usuario)}
                >
                  Abrir perfil
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
          {usuarios.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed" ta="center">
                  {textos.vacio}
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={modalAbierto} onClose={close} title={editando ? textos.editar : textos.nuevo}>
        <form onSubmit={guardar}>
          <Stack gap="sm">
            <TextInput label="Nombre" required {...form.getInputProps("nombre")} />
            <TextInput label="Teléfono" {...form.getInputProps("telefono")} />
            <TextInput
              label="Correo"
              required
              disabled={!!editando} // el correo es la identidad de la cuenta, no se edita
              {...form.getInputProps("email")}
            />
            {!editando && (
              <Text size="xs" c="dimmed">
                Firebase le enviará a ese correo un enlace para que defina su propia
                contraseña. Al entrar por primera vez, la app le pedirá completar su
                teléfono y su foto.
              </Text>
            )}
            <Group align="flex-end" gap="sm">
              <Avatar src={foto} size={56} radius="xl" color="blue">
                {inicial(form.values.nombre)}
              </Avatar>
              <FileInput
                style={{ flex: 1 }}
                label="Foto de perfil (opcional)"
                placeholder="Elegir imagen"
                accept="image/*"
                leftSection={<IconCamera size={16} />}
                onChange={elegirFoto}
                clearable={false}
              />
            </Group>
            <Button type="submit" loading={guardando}>
              {editando ? "Guardar cambios" : textos.crear}
            </Button>
          </Stack>
        </form>

        {/* Acciones delicadas: solo acá adentro, nunca en la fila de la tabla */}
        {editando && (
          <>
            <Divider my="md" label="Acciones de la cuenta" labelPosition="center" />
            <Stack gap={6}>
              <Button
                variant="light"
                leftSection={<IconMail size={16} />}
                loading={reenviando === editando.email}
                onClick={() => reenviarCorreo(editando.email)}
              >
                Enviar correo para restablecer la contraseña
              </Button>
              <Text size="xs" c="dimmed">
                Le llega un enlace de Firebase para definir una contraseña nueva. Sirve si
                nunca recibió el correo original o si la olvidó.
              </Text>

              <Button
                variant="light"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={pedirEliminar}
                mt="sm"
              >
                Eliminar perfil
              </Button>
              <Text size="xs" c="dimmed">
                {editando.rol === "padre"
                  ? "Se elimina junto con sus hijos. Los datos quedan guardados en Historial."
                  : "Los datos quedan guardados en Historial."}
              </Text>
            </Stack>
          </>
        )}
      </Modal>

      {/* Confirmación de eliminación */}
      <Modal opened={!!porEliminar} onClose={() => setPorEliminar(null)} title="Eliminar perfil">
        {porEliminar && (
          <Stack>
            <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
              Vas a eliminar a <b>{porEliminar.usuario.nombre}</b>.
              {porEliminar.hijos > 0 && (
                <>
                  {" "}
                  Se eliminarán también sus <b>{porEliminar.hijos} niño(s)</b>, que dejarán de
                  aparecer en rutas y listas.
                </>
              )}
            </Alert>

            <Text size="sm">
              Los datos <b>no se borran</b>: quedan guardados en la pantalla de <b>Historial</b>{" "}
              con toda su información, y desde ahí se pueden restaurar. Los viajes y la
              asistencia ya registrados siguen mostrando sus nombres.
            </Text>

            <Textarea
              label="Motivo (opcional)"
              placeholder="Ej. se mudó de ciudad / dejó el servicio"
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
