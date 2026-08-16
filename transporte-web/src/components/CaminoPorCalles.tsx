import { useEffect, useState } from "react";
import { Polyline } from "react-leaflet";
import type { ParadaRecorrido } from "../utils/recorrido";

// Camino real POR LAS CALLES entre las paradas, con OSRM (motor de ruteo de
// OpenStreetMap, sin API key). Si no responde, queda la línea punteada recta —
// el mapa sigue sirviendo igual.
//
// Se monta con key={clave del recorrido} desde el mapa que lo usa: al cambiar
// de recorrido se crea una instancia nueva y el estado arranca limpio, sin
// tener que resetearlo dentro del efecto.
//
// Lo comparten el mapa de supervisión (MapaBuses) y el del armador de rutas
// (MapaArmador), para que el admin vea el mismo trazo en las dos pantallas.
export default function CaminoPorCalles({ recorrido }: { recorrido: ParadaRecorrido[] }) {
  const [calles, setCalles] = useState<[number, number][] | null>(null);

  useEffect(() => {
    if (recorrido.length < 2) return;
    let cancelado = false;
    const coords = recorrido.map((p) => `${p.lng},${p.lat}`).join(";");
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
    )
      .then((r) => r.json())
      .then((d) => {
        if (cancelado || !d.routes?.[0]) return;
        // GeoJSON viene [lng, lat]; Leaflet espera [lat, lng]
        setCalles(d.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]));
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [recorrido]);

  const rectas: [number, number][] = recorrido.map((p) => [p.lat, p.lng]);
  if (rectas.length < 2) return null;

  // Mientras llega el camino real se muestra la línea punteada de respaldo
  if (!calles) {
    return (
      <Polyline
        positions={rectas}
        pathOptions={{ color: "#1565C0", weight: 3, dashArray: "6 8", opacity: 0.8 }}
      />
    );
  }
  return (
    <>
      <Polyline positions={calles} pathOptions={{ color: "#fff", weight: 9, opacity: 0.9 }} />
      <Polyline positions={calles} pathOptions={{ color: "#1565C0", weight: 5, opacity: 0.95 }} />
    </>
  );
}
