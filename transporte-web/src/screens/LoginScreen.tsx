import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { usuario, login } = useAuth();
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
    try {
      await login(email, password);
    } catch {
      setError("Correo o contraseña incorrectos.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Center mih="100vh">
      <Paper
        component="form"
        onSubmit={handleSubmit}
        withBorder
        shadow="md"
        p={32}
        radius="md"
        w={360}
      >
        <Stack gap="sm">
          <div style={{ textAlign: "center" }}>
            {/* Logo de la empresa (vive en public/, se sirve tal cual) */}
            <img
              src="/logo.png"
              alt="Inversiones Perez, transporte escolar"
              width={96}
              height={96}
              style={{ borderRadius: 20, marginBottom: 8 }}
            />
            <Title order={2}>Transporte Perez</Title>
            <Text c="dimmed" size="sm">
              Panel de administración
            </Text>
          </div>

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

          <Button type="submit" loading={enviando} fullWidth>
            Ingresar
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
