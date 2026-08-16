import { useEffect, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TipoLugar } from "../types/models";

// Centro por defecto: La Ceiba, Atlántida
const CENTRO_LA_CEIBA: [number, number] = [15.7597, -86.7822];

// Estilo del marcador según el tipo de lugar. Son los MISMOS colores y la misma
// burbuja que usan el mapa de supervisión (MapaBuses) y los mapas del móvil, para
// que un punto de transbordo se vea rojo en todas las pantallas y una escuela
// azul marino en todas: el admin marca el lugar con el mismo símbolo con el que
// después lo va a ver el conductor.
const ESTILO_LUGAR: Record<TipoLugar, { emoji: string; fondo: string; borde: string }> = {
  casa: { emoji: "🏠", fondo: "#fff", borde: "#1565C0" },
  escuela: { emoji: "🏫", fondo: "#0A3466", borde: "#fff" },
  punto: { emoji: "🔄", fondo: "#C62828", borde: "#fff" },
};

function iconoLugar(tipo: TipoLugar) {
  const { emoji, fondo, borde } = ESTILO_LUGAR[tipo];
  return L.divIcon({
    html:
      `<div style="width:40px;height:40px;border-radius:50%;background:${fondo};` +
      `border:3px solid ${borde};box-shadow:0 3px 10px rgba(13,40,84,.4);display:flex;` +
      `align-items:center;justify-content:center;font-size:20px;box-sizing:border-box">${emoji}</div>`,
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

// Componente interno: escucha los clics del mapa y avisa al padre
function CapturadorDeClics({ onClic }: { onClic: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (evento) => onClic(evento.latlng.lat, evento.latlng.lng),
  });
  return null;
}

// Acerca el mapa a la ubicación ya marcada, UNA sola vez (al abrir el formulario
// de algo que ya tiene lugar). Después no se vuelve a mover: si reencuadrara en
// cada clic, el mapa saltaría mientras el admin corrige la posición.
function EncuadrarUnaVez({ ubicacion }: { ubicacion: { lat: number; lng: number } | null }) {
  const map = useMap();
  const yaEncuadro = useRef(false);

  useEffect(() => {
    if (yaEncuadro.current || !ubicacion) return;
    yaEncuadro.current = true;
    map.setView([ubicacion.lat, ubicacion.lng], 16);
  }, [ubicacion, map]);

  return null;
}

interface Props {
  // Ubicación elegida (null si todavía no se marcó)
  ubicacion: { lat: number; lng: number } | null;
  onElegirUbicacion: (lat: number, lng: number) => void;
  // Qué se está marcando; solo cambia el ícono. Por defecto, una casa.
  tipo?: TipoLugar;
  altura?: number;
}

// Mapa genérico de UN solo marcador: clic para fijar la ubicación de un lugar.
// Reutilizado para escuelas, puntos de transbordo y la casa de cada niño. Cada
// clic reemplaza la ubicación anterior.
export default function MapaUbicacion({
  ubicacion,
  onElegirUbicacion,
  tipo = "casa",
  altura = 320,
}: Props) {
  return (
    <MapContainer
      center={ubicacion ? [ubicacion.lat, ubicacion.lng] : CENTRO_LA_CEIBA}
      zoom={ubicacion ? 16 : 13}
      // Esquinas redondeadas como el resto de los mapas del sistema. El overflow
      // es lo que recorta las teselas, que son cuadradas.
      style={{ height: altura, width: "100%", borderRadius: 12, overflow: "hidden" }}
    >
      {/* Teselas CARTO Positron: estilo claro, sobre datos de OpenStreetMap.
          Las mismas que usan supervisión y los mapas del móvil. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />
      <EncuadrarUnaVez ubicacion={ubicacion} />
      <CapturadorDeClics onClic={onElegirUbicacion} />
      {ubicacion && (
        <Marker position={[ubicacion.lat, ubicacion.lng]} icon={iconoLugar(tipo)} />
      )}
    </MapContainer>
  );
}
