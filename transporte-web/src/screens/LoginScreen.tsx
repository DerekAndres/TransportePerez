import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Center,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconAlertCircle, IconLock } from "@tabler/icons-react";
import { useAuth } from "../context/AuthContext";
import { registrarActividad } from "../hooks/use-cierre-por-inactividad";

// ============================================
// ENTRADA AL PANEL
// ============================================
// Es la versión de escritorio de la pantalla de entrada del móvil, donde el mar
// ocupa el fondo y el formulario vive en una hoja blanca. Acá la pantalla es
// ancha, así que en vez de apilar (mar arriba, hoja abajo) se PARTE en dos: el
// mar a la izquierda con la marca, el formulario a la derecha sobre blanco.
//
// Es la misma idea traducida a la proporción de una pantalla de computadora —
// en un monitor, un degradado a lo alto con el formulario encima se vería vacío
// y perdido en el medio.
//
// El degradado es el mismo GRADIENTE_MARCA del móvil (constants/tema.ts): del
// agua clara de la orilla al azul profundo de mar abierto.
const MAR =
  "linear-gradient(160deg, #3FC9BC 0%, #12938A 26%, #0A6E67 52%, #08544F 78%, #063C39 100%)";

export default function LoginScreen() {
  const { usuario, login, avisoSesion } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (usuario) {
      navigate("/", { replace: true });
    }
  }, [usuario, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setEnviando(true);
    // La cuenta regresiva de inactividad arranca de cero al entrar: sin esto,
    // la marca de la última visita (quizá de ayer) cerraría la sesión recién abierta
    registrarActividad();
    try {
      await login(email, password);
    } catch {
      setError("Correo o contraseña incorrectos.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Box style={{ minHeight: "100vh", display: "flex" }}>
      {/* --- El mar, con la marca. Se oculta en pantallas chicas: ahí el
              formulario necesita todo el ancho. --- */}
      <Box
        visibleFrom="sm"
        style={{
          flex: "1 1 46%",
          background: MAR,
          color: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 56px",
          gap: 14,
        }}
      >
        <img
          src="/logo.png"
          alt="Inversiones Perez, transporte escolar"
          width={92}
          height={92}
          style={{ borderRadius: 24, marginBottom: 10 }}
        />
        <Title order={1} style={{ letterSpacing: "-0.03em", lineHeight: 1.08 }}>
          Panel de
          <br />
          administración
        </Title>
        <Text size="lg" style={{ color: "rgba(255,255,255,0.85)", maxWidth: "34ch" }}>
          Rutas, unidades y estudiantes de Inversiones Perez, en un solo lugar.
        </Text>
        <Text size="sm" style={{ color: "rgba(255,255,255,0.6)", marginTop: 6 }}>
          La Ceiba · El Porvenir · El Pino · La Unión
        </Text>
      </Box>

      {/* --- El formulario, sobre blanco --- */}
      <Center style={{ flex: "1 1 54%", background: "#FFFFFF", padding: 24 }}>
        <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 380 }}>
          <Stack gap="sm">
            {/* En pantallas chicas no se ve el panel del mar, así que el logo
                y el nombre se repiten acá para que la pantalla tenga identidad */}
            <Box hiddenFrom="sm" style={{ textAlign: "center", marginBottom: 4 }}>
              <img
                src="/logo.png"
                alt="Inversiones Perez, transporte escolar"
                width={84}
                height={84}
                style={{ borderRadius: 20 }}
              />
            </Box>

            <div>
              <Title order={3} style={{ letterSpacing: "-0.02em" }}>
                Iniciar sesión
              </Title>
              <Text c="dimmed" size="sm">
                Con la cuenta de administración.
              </Text>
            </div>

            {/* Por qué se cerró la sesión sin que se pidiera: cuenta dada de baja
                o inactividad. Sin esto la persona vuelve al login sin entender. */}
            {avisoSesion && (
              <Alert color="orange" icon={<IconLock size={16} />}>
                {avisoSesion}
              </Alert>
            )}

            <TextInput
              label="Correo"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
            />

            <PasswordInput
              label="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
            />

            {error && (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                {error}
              </Alert>
            )}

            <Button type="submit" loading={enviando} fullWidth size="md" mt={4}>
              Entrar
            </Button>

            <Text c="dimmed" size="xs" ta="center" mt={4}>
              Los conductores y padres usan la aplicación del teléfono.
            </Text>
          </Stack>
        </form>
      </Center>
    </Box>
  );
}
