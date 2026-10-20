import { useState } from "react";
import {
  Avatar,
  Button,
  Divider,
  FileInput,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCamera, IconLockOpen, IconTrash } from "@tabler/icons-react";

import { useAuth } from "../context/AuthContext";
import { actualizarMiPerfil, enviarRecuperacionPassword } from "../services/authService";
import { comprimirImagen } from "../utils/imagen";

// Perfil propio del panel web. Se abre desde la burbuja del encabezado.
//
// Es el espejo de la pantalla "Configuración" de la app móvil, y a propósito
// hace exactamente lo mismo y nada más: foto, teléfono y cambio de contraseña.
// El nombre, el correo y el rol se muestran pero no se editan — las reglas de
// Firestore solo dejan cambiar esos tres campos del propio documento, para que
// nadie pueda renombrarse "Administración" ni reactivarse una cuenta dada de baja.
// Lo monta AppLayout SOLO mientras está abierto. Por eso el estado se inicializa
// de una vez y no hace falta un efecto que lo resincronice al abrir: cada vez
// que se abre, el componente nace de nuevo con lo que hay hoy en el perfil.
export default function PanelPerfil({ alCerrar }: { alCerrar: () => void }) {
  const { usuario, refrescarPerfil } = useAuth();

  const [telefono, setTelefono] = useState(usuario?.telefono ?? "");
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [correoEnviado, setCorreoEnviado] = useState(false);

  if (!usuario) return null;

  const etiquetaRol =
    usuario.rol === "conductor"
      ? "Conductor"
      : usuario.rol === "admin"
        ? "Administración"
        : "Padre de familia";

  const cambiarFoto = async (archivo: File | null) => {
    if (!archivo) return;
    setSubiendoFoto(true);
    try {
      const foto = await comprimirImagen(archivo);
      await actualizarMiPerfil(usuario.id, { foto });
      await refrescarPerfil();
      notifications.show({ color: "teal", message: "Foto actualizada." });
    } catch {
      notifications.show({ color: "red", message: "No se pudo actualizar la foto." });
    } finally {
      setSubiendoFoto(false);
    }
  };

  // Cadena vacía en vez de borrar el campo: en todo el sistema la foto se lee
  // como `foto ? <imagen> : <inicial>`, así que "" ya vuelve a la inicial y el
  // tipo del campo sigue siendo string en las dos copias de models.ts.
  const quitarFoto = async () => {
    setSubiendoFoto(true);
    try {
      await actualizarMiPerfil(usuario.id, { foto: "" });
      await refrescarPerfil();
      notifications.show({ color: "teal", message: "Foto quitada." });
    } catch {
      notifications.show({ color: "red", message: "No se pudo quitar la foto." });
    } finally {
      setSubiendoFoto(false);
    }
  };

  const guardarTelefono = async () => {
    setGuardando(true);
    try {
      await actualizarMiPerfil(usuario.id, { telefono: telefono.trim() });
      await refrescarPerfil();
      notifications.show({ color: "teal", message: "Teléfono actualizado." });
    } catch {
      notifications.show({ color: "red", message: "No se pudo guardar el teléfono." });
    } finally {
      setGuardando(false);
    }
  };

  const cambiarPassword = async () => {
    try {
      await enviarRecuperacionPassword(usuario.email);
      setCorreoEnviado(true);
    } catch {
      notifications.show({ color: "red", message: "No se pudo enviar el correo." });
    }
  };

  return (
    <Modal opened onClose={alCerrar} title="Mi perfil" size="md">
      <Stack gap="lg">
        <Group gap="md" wrap="nowrap" align="center">
          <Avatar color="marca" radius="xl" size={72} src={usuario.foto || undefined}>
            {usuario.nombre.trim().charAt(0).toUpperCase() || "?"}
          </Avatar>
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Text fw={600} size="lg" truncate>
              {usuario.nombre}
            </Text>
            <Text size="sm" c="dimmed" truncate>
              {usuario.email}
            </Text>
            <Text size="sm" c="dimmed">
              {etiquetaRol}
            </Text>
          </Stack>
        </Group>

        <Group gap="sm" wrap="nowrap" align="flex-end">
          <FileInput
            style={{ flex: 1 }}
            label="Foto de perfil"
            placeholder="Elegir imagen"
            accept="image/*"
            leftSection={<IconCamera size={16} />}
            disabled={subiendoFoto}
            value={null}
            onChange={cambiarFoto}
          />
          {/* Solo aparece si hay algo que quitar */}
          {!!usuario.foto && (
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconTrash size={16} />}
              onClick={quitarFoto}
              disabled={subiendoFoto}
            >
              Quitar
            </Button>
          )}
        </Group>

        <Divider />

        <Group gap="sm" wrap="nowrap" align="flex-end">
          <TextInput
            style={{ flex: 1 }}
            label="Mi teléfono"
            description="Es el número al que llaman desde el chat."
            placeholder="Ej. 9999-9999"
            value={telefono}
            onChange={(e) => setTelefono(e.currentTarget.value)}
          />
          <Button
            onClick={guardarTelefono}
            loading={guardando}
            disabled={guardando || telefono.trim() === (usuario.telefono ?? "")}
          >
            Guardar
          </Button>
        </Group>

        <Divider />

        <Stack gap={6}>
          <Button
            variant="light"
            leftSection={<IconLockOpen size={16} />}
            onClick={cambiarPassword}
            disabled={correoEnviado}
          >
            Cambiar contraseña
          </Button>
          <Text size="xs" c="dimmed">
            {correoEnviado
              ? `Correo enviado a ${usuario.email} — revisá tu bandeja.`
              : "Te llega un correo para definir la nueva."}
          </Text>
        </Stack>
      </Stack>
    </Modal>
  );
}
