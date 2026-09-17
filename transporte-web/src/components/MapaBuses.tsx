import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import BotonCentrarMapa from "./BotonCentrarMapa";
import CapaTeselas from "./CapaTeselas";
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
  // Foto de la unidad (base64, la sube el admin al dar de alta el bus) y su
  // placa. Van al marcador del mapa: ver `iconoBus`.
  foto?: string;
  placa?: string;
}

// ============================================
// EL MARCADOR DEL BUS
// ============================================
// Muestra la FOTO REAL de la unidad, no un emoji. Para Francis no es un detalle
// estético: cuando hay ocho buses moviéndose a la vez en el mismo mapa, ocho
// emojis idénticos obligan a pasar el mouse por cada uno para saber cuál es
// cuál. Con la foto los reconoce de un vistazo, igual que los reconoce en el
// patio de la empresa.
//
// Debajo de la foto va la PLACA, que es como se nombran las unidades por radio
// y por teléfono. Las dos cosas juntas hacen que el mapa se pueda leer sin
// tocar nada.
//
// Si la unidad no tiene foto cargada, queda la burbuja azul con el emoji: se
// degrada, no se rompe.
function iconoBus(bus: BusEnVivo) {
  const interior = bus.foto
    ? `<img src="${bus.foto}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`
    : '<span style="font-size:20px">🚌</span>';

  // La placa va en una cápsula debajo del círculo, montada con posición
  // absoluta para que no empuje al marcador y este siga centrado en su
  // coordenada real.
  const placa = bus.placa
    ? `<div style="position:absolute;top:42px;left:50%;transform:translateX(-50%);` +
      `background:rgba(10,52,102,.92);color:#fff;font:700 10px/1 sans-serif;letter-spacing:.03em;` +
      `padding:3px 7px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px rgba(13,40,84,.4)">` +
      `${bus.placa}</div>`
    : "";

  return L.divIcon({
    html:
      '<div style="position:relative;width:40px;height:40px">' +
      '<div style="width:40px;height:40px;border-radius:50%;background:#1565C0;border:3px solid #fff;' +
      'box-shadow:0 3px 10px rgba(13,40,84,.4);display:flex;align-items:center;justify-content:center;' +
      'overflow:hidden;box-sizing:border-box">' +
      interior +
      "</div>" +
      placa +
      "</div>",
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

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
  encuadres,
}: {
  buses: BusEnVivo[];
  recorrido: ParadaRecorrido[];
  clave: string;
  encuadres: number;
}) {
  const map = useMap();
  const ultimaClave = useRef<string | null>(null);
  const ultimoEncuadre = useRef(encuadres);

  useEffect(() => {
    // Además de cuando cambia el enfoque, se reencuadra cuando Francis lo pide
    // con el botón. Lo que NO se hace es reencuadrar con cada posición nueva:
    // los buses mandan la suya cada 15 s y el mapa se le movería de las manos.
    const pidioAMano = ultimoEncuadre.current !== encuadres;
    if (ultimaClave.current === clave && !pidioAMano) return;
    const puntos: [number, number][] = [
      ...buses.map((b) => [b.lat, b.lng] as [number, number]),
      ...recorrido.map((p) => [p.lat, p.lng] as [number, number]),
    ];
    if (puntos.length === 0) return;
    ultimaClave.current = clave;
    ultimoEncuadre.current = encuadres;
    if (puntos.length === 1) {
      map.setView(puntos[0], 15);
    } else {
      map.fitBounds(L.latLngBounds(puntos), { padding: [60, 60], maxZoom: 16 });
    }
  }, [buses, recorrido, clave, encuadres, map]);

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
  // Cada clic en "centrar" sube el contador; AjustarVista lo mira para saber que
  // el reencuadre lo pidió Francis y no un cambio de enfoque
  const [encuadres, setEncuadres] = useState(0);

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
    <MapContainer center={CENTRO_LA_CEIBA} zoom={12} style={{ height: "100%", width: "100%" }}>
      {/* El mismo proveedor de teselas que la app móvil, con respaldo (utils/mapa.ts) */}
      <CapaTeselas />

      <AjustarVista
        buses={buses}
        recorrido={recorrido}
        clave={claveVista}
        encuadres={encuadres}
      />

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
        <Marker key={bus.viajeId} position={[bus.lat, bus.lng]} icon={iconoBus(bus)}>
          <Tooltip direction="top" offset={[0, -24]}>
            <strong>{bus.titulo}</strong>
            <br />
            {bus.subtitulo}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>

      {/* Con el mapa vacío no hay nada que encuadrar (ningún bus en la calle y
          ninguna ruta elegida), así que el botón ni aparece */}
      {buses.length + recorrido.length > 0 && (
        <BotonCentrarMapa
          titulo={
            recorrido.length > 0 ? "Centrar el mapa en la ruta" : "Centrar el mapa en los buses"
          }
          onClick={() => setEncuadres((n) => n + 1)}
        />
      )}
    </div>
  );
}
