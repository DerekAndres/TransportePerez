import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import BotonCentrarMapa from "./BotonCentrarMapa";
import CapaTeselas from "./CapaTeselas";
import type { PuntoRecorrido } from "../types/models";

// El camino que hizo el bus en un viaje, dibujado sobre el mapa: una línea con
// el punto de inicio (verde) y el último punto (rojo), cada uno con su hora.
// Es lo que permite contestar un reclamo días después: "el bus pasó por tu calle
// a las 6:41".

function hora(punto: PuntoRecorrido): string {
  const f = punto.t.toDate();
  return `${f.getHours()}:${String(f.getMinutes()).padStart(2, "0")}`;
}

// Encuadra el camino completo UNA vez. Si el viaje sigue en curso y llegan
// puntos nuevos, no vuelve a mover el mapa mientras el admin lo mira — salvo
// que lo pida con el botón de centrar, que es para lo que sirve `encuadres`
// (cada clic sube el contador).
function Encuadrar({ puntos, encuadres }: { puntos: PuntoRecorrido[]; encuadres: number }) {
  const map = useMap();
  const yaEncuadro = useRef(false);
  const ultimoEncuadre = useRef(encuadres);

  useEffect(() => {
    const pidioAMano = ultimoEncuadre.current !== encuadres;
    if ((yaEncuadro.current && !pidioAMano) || puntos.length === 0) return;
    yaEncuadro.current = true;
    ultimoEncuadre.current = encuadres;
    map.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lng] as [number, number])), {
      padding: [30, 30],
      maxZoom: 16,
    });
  }, [puntos, encuadres, map]);

  return null;
}

export default function MapaRecorrido({
  puntos,
  altura = 260,
}: {
  puntos: PuntoRecorrido[]; // al menos uno
  altura?: number;
}) {
  // Llegan en el orden en que se agregaron, pero se ordenan por hora por las dudas
  const ordenados = useMemo(
    () => [...puntos].sort((a, b) => a.t.toMillis() - b.t.toMillis()),
    [puntos]
  );
  const linea = ordenados.map((p) => [p.lat, p.lng] as [number, number]);
  const inicio = ordenados[0];
  const fin = ordenados[ordenados.length - 1];
  // Cada clic en "centrar" sube el contador; Encuadrar lo mira para saber que el
  // reencuadre lo pidió el admin
  const [encuadres, setEncuadres] = useState(0);

  return (
    <div style={{ position: "relative", width: "100%" }}>
    <MapContainer
      center={linea[0]}
      zoom={14}
      style={{ height: altura, width: "100%", borderRadius: 12, overflow: "hidden" }}
    >
      <CapaTeselas />
      <Encuadrar puntos={ordenados} encuadres={encuadres} />
      {/* Funda blanca debajo del trazo de color, como la ruta del móvil: así la
          línea se lee igual sobre una calle, un parque o un río */}
      <Polyline positions={linea} pathOptions={{ color: "#FFFFFF", weight: 7, opacity: 0.9 }} />
      <Polyline positions={linea} pathOptions={{ color: "#2563EB", weight: 4 }} />
      <CircleMarker
        center={[inicio.lat, inicio.lng]}
        radius={7}
        pathOptions={{ color: "#FFFFFF", weight: 2, fillColor: "#10B981", fillOpacity: 1 }}
      >
        <Tooltip>Inicio · {hora(inicio)}</Tooltip>
      </CircleMarker>
      <CircleMarker
        center={[fin.lat, fin.lng]}
        radius={7}
        pathOptions={{ color: "#FFFFFF", weight: 2, fillColor: "#C62828", fillOpacity: 1 }}
      >
        <Tooltip>Último punto · {hora(fin)}</Tooltip>
      </CircleMarker>
    </MapContainer>

      <BotonCentrarMapa
        titulo="Encuadrar todo el recorrido"
        onClick={() => setEncuadres((n) => n + 1)}
      />
    </div>
  );
}
