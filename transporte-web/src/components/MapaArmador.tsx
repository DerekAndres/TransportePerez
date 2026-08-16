import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { ActionIcon, Button, Group, Stack, Text } from "@mantine/core";
import { IconFocusCentered } from "@tabler/icons-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import CaminoPorCalles from "./CaminoPorCalles";
import { formatearDistancia } from "../utils/geo";
import type { ParadaRecorrido } from "../utils/recorrido";
import type { Escuela } from "../types/models";

// Centro por defecto: La Ceiba, Atlántida
const CENTRO_LA_CEIBA: [number, number] = [15.7597, -86.7822];

// Un niño que TODAVÍA no está en la ruta, con su casa marcada.
export interface CandidatoEnMapa {
  id: string;
  nombre: string;
  escuela: string;
  lat: number;
  lng: number;
  distancia: number; // metros a lo más cercano que ya lleva el bus (Infinity si no hay con qué medir)
}

// Mismos íconos que el mapa de supervisión: una parada de la ruta es un círculo
// numerado (casa blanca, punto de transbordo rojo, escuela azul marino).
function iconoParada(indice: number, tipo: ParadaRecorrido["tipo"]) {
  const relleno = tipo === "punto" ? "#C62828" : tipo === "escuela" ? "#0A3466" : "#fff";
  const texto = tipo === "casa" ? "#1565C0" : "#fff";
  const borde = tipo === "casa" ? "#1565C0" : "#fff";
  return L.divIcon({
    html:
      `<div style="width:30px;height:30px;border-radius:50%;background:${relleno};color:${texto};` +
      `border:2px solid ${borde};box-shadow:0 2px 6px rgba(13,40,84,.35);display:flex;` +
      `align-items:center;justify-content:center;font:700 14px/1 sans-serif;box-sizing:border-box">${indice + 1}</div>`,
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// Escuela de la ruta a la que todavía no baja nadie: se dibuja igual que una
// parada pero sin número, para que el mapa tenga referencia desde el arranque
// (una ruta recién creada no tiene ni un niño y si no el mapa saldría vacío).
const iconoEscuelaSuelta = L.divIcon({
  html:
    '<div style="width:28px;height:28px;border-radius:50%;background:#0A3466;border:2px solid #fff;' +
    'box-shadow:0 2px 6px rgba(13,40,84,.35);display:flex;align-items:center;justify-content:center;' +
    'font-size:14px;box-sizing:border-box">🏫</div>',
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Casa de un niño sin asignar: círculo hueco ámbar, más chico que una parada,
// para que se lea claro que es "algo que podés agregar" y no parte de la ruta.
function iconoCandidato(cantidad: number) {
  const etiqueta = cantidad > 1 ? `${cantidad}` : "";
  return L.divIcon({
    html:
      `<div style="width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.9);` +
      `color:#B26A00;border:2px dashed #F59F00;display:flex;align-items:center;justify-content:center;` +
      `font:700 11px/1 sans-serif;box-sizing:border-box">${etiqueta}</div>`,
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const EMOJI_LUGAR: Record<ParadaRecorrido["tipo"], string> = {
  casa: "🏠",
  escuela: "🏫",
  punto: "🔄",
};

// Encuadra el mapa cuando cambia la ruta que se está armando (otra ruta, otro
// turno, otras escuelas), NO cada vez que se agrega un niño: si reencuadrara en
// cada clic, el mapa saltaría todo el tiempo mientras el admin trabaja. Para
// reencuadrar a mano está el botón de la esquina.
function AjustarVista({
  posiciones,
  clave,
  encuadres,
}: {
  posiciones: [number, number][];
  clave: string;
  encuadres: number;
}) {
  const map = useMap();
  const ultima = useRef<string | null>(null);
  const ultimoEncuadre = useRef(encuadres);

  useEffect(() => {
    const pidioAMano = ultimoEncuadre.current !== encuadres;
    if (ultima.current === clave && !pidioAMano) return;
    if (posiciones.length === 0) return;
    ultima.current = clave;
    ultimoEncuadre.current = encuadres;
    if (posiciones.length === 1) {
      map.setView(posiciones[0], 15);
    } else {
      map.fitBounds(L.latLngBounds(posiciones), { padding: [50, 50], maxZoom: 16 });
    }
  }, [posiciones, clave, encuadres, map]);

  return null;
}

interface Props {
  // El recorrido tal cual lo va a ver el conductor (derivarRecorrido)
  recorrido: ParadaRecorrido[];
  // Escuelas elegidas para la ruta (las que ya son parada no se repiten)
  escuelasRuta: Escuela[];
  // Niños sin asignar que se pueden sumar tocando el mapa
  candidatos: CandidatoEnMapa[];
  onAgregar: (ninoIds: string[]) => void;
  // Cambia cuando hay que reencuadrar solo (otra ruta / otro turno / otras escuelas)
  claveVista: string;
}

// Mapa del armador de rutas: muestra el recorrido que se está armando y, sobre
// el mismo mapa, las casas de los niños que todavía no tienen bus. Así el admin
// arma la ruta viendo la geografía real y no una lista de nombres.
export default function MapaArmador({
  recorrido,
  escuelasRuta,
  candidatos,
  onAgregar,
  claveVista,
}: Props) {
  // Cada clic en "centrar" sube el contador; AjustarVista lo mira para saber
  // que el reencuadre lo pidió el admin y no un cambio de ruta.
  const [encuadres, setEncuadres] = useState(0);

  // Escuelas de la ruta que todavía no son parada (nadie baja ahí)
  const escuelasSueltas = escuelasRuta.filter(
    (e) => !recorrido.some((p) => p.tipo === "escuela" && p.lat === e.lat && p.lng === e.lng)
  );

  // Los hermanos comparten casa: un marcador por coordenada, con los niños
  // adentro. Si no, quedarían marcadores encimados imposibles de tocar.
  const casasCandidatas = useMemo(() => {
    const porCoordenada = new Map<string, CandidatoEnMapa[]>();
    for (const c of candidatos) {
      const clave = `${c.lat},${c.lng}`;
      const lista = porCoordenada.get(clave);
      if (lista) lista.push(c);
      else porCoordenada.set(clave, [c]);
    }
    return [...porCoordenada.entries()].map(([clave, ninos]) => ({ clave, ninos }));
  }, [candidatos]);

  const posiciones: [number, number][] = [
    ...recorrido.map((p) => [p.lat, p.lng] as [number, number]),
    ...escuelasSueltas.map((e) => [e.lat, e.lng] as [number, number]),
  ];

  const claveRecorrido = recorrido.map((p) => `${p.lat},${p.lng}`).join("|");

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <MapContainer
        center={CENTRO_LA_CEIBA}
        zoom={12}
        style={{ height: "100%", width: "100%", borderRadius: 8 }}
      >
        {/* Teselas CARTO Positron: las mismas de supervisión y del móvil */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />

        <AjustarVista posiciones={posiciones} clave={claveVista} encuadres={encuadres} />

        {/* El recorrido que se está armando, por las calles */}
        <CaminoPorCalles key={claveRecorrido} recorrido={recorrido} />

        {recorrido.map((p, i) => (
          <Marker
            key={`parada-${p.lat},${p.lng},${i}`}
            position={[p.lat, p.lng]}
            icon={iconoParada(i, p.tipo)}
          >
            <Popup>
              <Stack gap={4}>
                <Text size="sm" fw={700}>
                  {i + 1}. {EMOJI_LUGAR[p.tipo]} {p.nombre}
                </Text>
                {p.suben.length > 0 && (
                  <Text size="xs">Suben: {p.suben.map((n) => n.nombre).join(", ")}</Text>
                )}
                {p.bajan.length > 0 && (
                  <Text size="xs">Bajan: {p.bajan.map((n) => n.nombre).join(", ")}</Text>
                )}
              </Stack>
            </Popup>
          </Marker>
        ))}

        {/* Escuelas de la ruta a las que todavía no baja nadie */}
        {escuelasSueltas.map((e) => (
          <Marker key={`escuela-${e.id}`} position={[e.lat, e.lng]} icon={iconoEscuelaSuelta}>
            <Tooltip direction="top" offset={[0, -16]}>
              {e.nombre}
            </Tooltip>
          </Marker>
        ))}

        {/* Casas de niños sin bus: tocarlas los agrega a la ruta */}
        {casasCandidatas.map(({ clave, ninos }) => (
          <Marker
            key={`candidato-${clave}`}
            position={[ninos[0].lat, ninos[0].lng]}
            icon={iconoCandidato(ninos.length)}
          >
            <Popup>
              <Stack gap={6}>
                <Text size="xs" c="dimmed">
                  Sin bus asignado
                  {isFinite(ninos[0].distancia)
                    ? ` · a ${formatearDistancia(ninos[0].distancia)} de la ruta`
                    : ""}
                </Text>
                {ninos.map((n) => (
                  <Group key={n.id} gap={6} wrap="nowrap" justify="space-between">
                    <div>
                      <Text size="sm" fw={600}>
                        {n.nombre}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {n.escuela}
                      </Text>
                    </div>
                    <Button size="compact-xs" variant="light" onClick={() => onAgregar([n.id])}>
                      Agregar
                    </Button>
                  </Group>
                ))}
                {ninos.length > 1 && (
                  <Button
                    size="compact-xs"
                    onClick={() => onAgregar(ninos.map((n) => n.id))}
                  >
                    Agregar los {ninos.length}
                  </Button>
                )}
              </Stack>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Reencuadrar a mano, sin que el mapa salte solo mientras se trabaja */}
      <ActionIcon
        variant="default"
        size="lg"
        title="Centrar el mapa en la ruta"
        onClick={() => setEncuadres((n) => n + 1)}
        style={{ position: "absolute", right: 10, top: 10, zIndex: 1000 }}
      >
        <IconFocusCentered size={18} />
      </ActionIcon>
    </div>
  );
}
