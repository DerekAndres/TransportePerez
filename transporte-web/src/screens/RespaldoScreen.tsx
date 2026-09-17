import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Loader,
  Progress,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconDownload, IconLock } from "@tabler/icons-react";
import {
  armarRespaldo,
  COLECCIONES_RESPALDO,
  contarDocumentos,
} from "../services/respaldoService";
import { fechaDeHoy } from "../utils/fechas";

// Por encima de este número se avisa en naranja: el plan gratuito de Firestore
// da 50.000 lecturas por día para TODO el sistema, y un respaldo completo con
// meses de asistencia puede llevarse una buena parte.
const LECTURAS_PARA_AVISAR = 20000;

export default function RespaldoScreen() {
  const [elegidas, setElegidas] = useState<string[]>(COLECCIONES_RESPALDO.map((c) => c.id));
  const [conteos, setConteos] = useState<Record<string, number> | null>(null);
  const [progreso, setProgreso] = useState<{ listas: number; total: number } | null>(null);

  useEffect(() => {
    contarDocumentos(COLECCIONES_RESPALDO.map((c) => c.id))
      .then(setConteos)
      .catch(() => setConteos({}));
  }, []);

  const lecturas = elegidas.reduce((suma, id) => suma + (conteos?.[id] ?? 0), 0);

  const descargar = async () => {
    setProgreso({ listas: 0, total: elegidas.length });
    try {
      const archivo = await armarRespaldo(elegidas, (listas, total) => setProgreso({ listas, total }));
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `respaldo-transporte-perez-${fechaDeHoy()}.json`;
      enlace.click();
      URL.revokeObjectURL(url);
      notifications.show({ color: "green", message: "Respaldo descargado." });
    } catch {
      notifications.show({ color: "red", message: "No se pudo armar el respaldo." });
    } finally {
      setProgreso(null);
    }
  };

  return (
    <Stack maw={680}>
      <Title order={3}>Respaldo de la base de datos</Title>
      <Text c="dimmed" size="sm">
        El plan gratuito de Firebase no guarda copias de seguridad: si algo se borra por error, no
        hay de dónde recuperarlo. Desde acá se descarga un archivo con toda la información para
        guardarlo aparte. Conviene hacerlo al menos una vez por semana.
      </Text>

      <Alert color="red" variant="light" icon={<IconLock size={16} />}>
        El archivo contiene datos personales de niños y familias: dónde viven, sus fotos y sus
        teléfonos. Guardalo en un lugar protegido y no lo mandes por WhatsApp ni por correo.
      </Alert>

      {!conteos ? (
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">
            Contando documentos…
          </Text>
        </Group>
      ) : (
        <Checkbox.Group value={elegidas} onChange={setElegidas}>
          <Stack gap={6}>
            {COLECCIONES_RESPALDO.map((c) => (
              <Checkbox
                key={c.id}
                value={c.id}
                label={`${c.etiqueta} (${conteos[c.id] ?? "?"})`}
              />
            ))}
          </Stack>
        </Checkbox.Group>
      )}

      {conteos && (
        <Text size="sm">
          Va a leer <strong>{lecturas.toLocaleString("es-HN")}</strong> documentos.
        </Text>
      )}
      {lecturas > LECTURAS_PARA_AVISAR && (
        <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
          Es mucho para un solo día: el plan gratuito da 50.000 lecturas diarias para todo el
          sistema, incluidas las apps de conductores y padres. Hacelo fuera del horario de las
          rutas, o destildá lo más pesado (registros, mensajes).
        </Alert>
      )}

      {progreso && (
        <Stack gap={4}>
          <Text size="sm">
            Leyendo colección {progreso.listas} de {progreso.total}…
          </Text>
          <Progress value={(progreso.listas / progreso.total) * 100} />
        </Stack>
      )}

      <Button
        leftSection={<IconDownload size={16} />}
        onClick={descargar}
        loading={!!progreso}
        disabled={elegidas.length === 0 || !conteos}
        w="fit-content"
      >
        Descargar respaldo
      </Button>

      <Text size="xs" c="dimmed">
        Restaurar desde este archivo no es automático: se hace con un script y conviene pedir ayuda
        técnica. Lo que el respaldo garantiza es que la información no se pierda.
      </Text>
    </Stack>
  );
}
