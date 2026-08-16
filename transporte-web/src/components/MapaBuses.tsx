import { useEffect, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { Avatar, Group, Stack, Text } from "@mantine/core";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import CaminoPorCalles from "./CaminoPorCalles";
import type { ParadaRecorrido } from "../utils/recorrido";

// Centro por defecto: La Ceiba, Atlántida
const CENTRO_LA_CEIBA: [number, number] = [15.7597, -86.7822];

// Un bus en el mapa: su posición y las etiquetas para el tooltip.
export interface BusEnVivo {
  viajeId: string;
  lat: number;
  lng: number;
  titulo: string; // nombre de la ruta
  subtitulo: string; // conductor · placa
}

// Ícono de bus: burbuja azul con sombra, igual que en la app del padre
const iconoBus = L.divIcon({
  html:
    '<div style="width:40px;height:40px;border-radius:50%;background:#1565C0;border:3px solid #fff;' +
    'box-shadow:0 3px 10px rgba(13,40,84,.4);display:flex;align-items:center;justify-content:center;' +
    'font-size:20px;box-sizing:border-box">🚌</div>',
  className: "",
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// Marcador de parada: solo el número de orden (el detalle va en el popup).
// Casas en blanco con número azul, transbordo en rojo, escuelas en azul marino.
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

const EMOJI_LUGAR: Record<ParadaRecorrido["tipo"], string> = {
  casa: "🏠",
  escuela: "🏫",
  punto: "🔄",
};

// Encuadra el mapa. Cuando cambia el enfoque (todos los buses ↔ uno solo) se
// vuelve a ajustar; mientras el enfoque no cambie, el admin puede moverlo libre.
function AjustarVista({
  buses,
  recorrido,
  clave,
}: {
  buses: BusEnVivo[];
  recorrido: ParadaRecorrido[];
  clave: string;
}) {
  const map = useMap();
  const ultimaClave = useRef<string | null>(null);

  useEffect(() => {
    if (ultimaClave.current === clave) return;
    const puntos: [number, number][] = [
      ...buses.map((b) => [b.lat, b.lng] as [number, number]),
      ...recorrido.map((p) => [p.lat, p.lng] as [number, number]),
    ];
    if (puntos.length === 0) return;
    ultimaClave.current = clave;
    if (puntos.length === 1) {
      map.setView(puntos[0], 15);
    } else {
      map.fitBounds(L.latLngBounds(puntos), { padding: [60, 60], maxZoom: 16 });
    }
  }, [buses, recorrido, clave, map]);

  return null;
}

// Mapa de supervisión: los buses en curso y, si se eligió uno, el recorrido que
// está siguiendo — el mismo que ve el conductor en su teléfono.
export default function MapaBuses({
  buses,
  recorrido = [],
  claveVista = "todos",
}: {
  buses: BusEnVivo[];
  recorrido?: ParadaRecorrido[];
  claveVista?: string;
}) {
  // Identifica el recorrido por sus coordenadas: si cambia, el camino por calles
  // se vuelve a montar y se recalcula
  const claveRecorrido = recorrido.map((p) => `${p.lat},${p.lng}`).join("|");

  return (
    <MapContainer center={CENTRO_LA_CEIBA} zoom={12} style={{ height: "100%", width: "100%" }}>
      {/* Teselas CARTO Positron: estilo claro, sobre datos de OpenStreetMap */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />

      <AjustarVista buses={buses} recorrido={recorrido} clave={claveVista} />

      {/* El recorrido de la ruta elegida */}
      <CaminoPorCalles key={claveRecorrido} recorrido={recorrido} />
      {recorrido.map((p, i) => (
        <Marker key={`${p.lat},${p.lng},${i}`} position={[p.lat, p.lng]} icon={iconoParada(i, p.tipo)}>
          <Popup>
            <Stack gap={4}>
              <Text size="sm" fw={700}>
                {i + 1}. {EMOJI_LUGAR[p.tipo]} {p.nombre}
              </Text>
              {p.referencia && (
                <Text
                  size="xs"
                  style={{
                    background: "#FFF3E0",
                    borderLeft: "3px solid #C62828",
                    padding: "4px 6px",
                    borderRadius: 4,
                  }}
                >
                  📍 {p.referencia}
                </Text>
              )}
              {p.ninos.map((n) => (
                <Group key={n.id} gap={6} wrap="nowrap">
                  <Avatar src={n.foto} size={24} radius="xl" color="blue">
                    {n.nombre.trim().charAt(0).toUpperCase()}
                  </Avatar>
                  <Text size="xs">{n.nombre}</Text>
                </Group>
              ))}
            </Stack>
          </Popup>
        </Marker>
      ))}

      {/* Los buses en viaje */}
      {buses.map((bus) => (
        <Marker key={bus.viajeId} position={[bus.lat, bus.lng]} icon={iconoBus}>
          <Tooltip direction="top" offset={[0, -20]}>
            <strong>{bus.titulo}</strong>
            <br />
            {bus.subtitulo}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
