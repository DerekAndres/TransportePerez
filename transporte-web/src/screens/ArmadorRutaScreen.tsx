import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Center, Loader, Stack, Text } from "@mantine/core";
import ArmadorRuta from "../components/ArmadorRuta";
import { listarRutas } from "../services/rutasService";
import { listarBuses } from "../services/busesService";
import { listarEscuelas } from "../services/escuelasService";
import { listarPuntos } from "../services/puntosService";
import { listarNinos } from "../services/ninosService";
import type { Bus, Escuela, Nino, Punto, Ruta } from "../types/models";

// Página del armador de rutas: /rutas/nueva y /rutas/:id
//
// Es una página y no un modal a propósito: así el menú lateral del panel queda
// a la vista, el botón "atrás" del navegador funciona, y se puede volver a
// entrar a una ruta con el enlace directo (por ejemplo después de recargar).
// Por eso carga sus propios datos en vez de recibirlos de la lista de rutas.

interface Datos {
  rutas: Ruta[];
  buses: Bus[];
  ninos: Nino[];
  escuelas: Escuela[];
  puntos: Punto[];
}

export default function ArmadorRutaScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelado = false;
    Promise.all([listarRutas(), listarBuses(), listarNinos(), listarEscuelas(), listarPuntos()])
      .then(([rutas, buses, ninos, escuelas, puntos]) => {
        if (cancelado) return;
        setDatos({
          rutas,
          // Solo lo activo se puede usar para armar una ruta nueva
          buses: buses.filter((b) => b.activo),
          ninos: ninos.filter((n) => n.activo),
          escuelas: escuelas.filter((e) => e.activa),
          puntos: puntos.filter((p) => p.activo),
        });
      })
      .catch(() => {
        if (!cancelado)
          setError(
            "No se pudieron cargar los datos. Revisá tu conexión y que las reglas de Firestore estén desplegadas."
          );
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const volver = () => navigate("/rutas");

  if (error) {
    return (
      <Stack>
        <Text c="red">{error}</Text>
        <Button variant="light" w="fit-content" onClick={volver}>
          Volver a rutas
        </Button>
      </Stack>
    );
  }

  if (!datos) {
    return (
      <Center mih={300}>
        <Loader />
      </Center>
    );
  }

  // Sin id en la URL (/rutas/nueva) se arma una ruta nueva
  const esNueva = !id || id === "nueva";
  const ruta = esNueva ? null : (datos.rutas.find((r) => r.id === id) ?? null);

  if (!esNueva && !ruta) {
    return (
      <Stack>
        <Text c="dimmed">Esa ruta ya no existe.</Text>
        <Button variant="light" w="fit-content" onClick={volver}>
          Volver a rutas
        </Button>
      </Stack>
    );
  }

  return (
    <ArmadorRuta
      ruta={ruta}
      rutas={datos.rutas}
      buses={datos.buses}
      ninos={datos.ninos}
      escuelas={datos.escuelas}
      puntos={datos.puntos}
      onCerrar={volver}
      onGuardado={volver}
    />
  );
}
