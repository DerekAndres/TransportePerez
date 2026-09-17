import { useRef, useState } from "react";
import { TileLayer } from "react-leaflet";
import { ERRORES_PARA_RESPALDO, TESELAS } from "../utils/mapa";

// La capa de teselas de TODOS los mapas del panel (ver utils/mapa.ts).
//
// Con respaldo automático: si el servidor principal falla varias veces seguidas
// (caído o bloqueando), la capa se reemplaza por la de Esri. Una tesela que carga
// bien reinicia la cuenta, así un error suelto no cambia de proveedor.
//
// ⚠️ Lo que el respaldo NO cubre: un bloqueo servido como IMAGEN (HTTP 200 con un
// dibujo que dice "Access blocked", como hizo OSM con la app). Para Leaflet eso
// es una tesela válida y el evento de error nunca llega; eso se ve con el ojo.
export default function CapaTeselas() {
  const [usarRespaldo, setUsarRespaldo] = useState(false);
  // En un ref y no en el estado: contar errores no tiene por qué redibujar el mapa
  const erroresSeguidos = useRef(0);

  return (
    <TileLayer
      // Una capa nueva al cambiar de proveedor: Leaflet no reemplaza de forma
      // confiable la URL de una capa ya creada
      key={usarRespaldo ? "respaldo" : "principal"}
      url={usarRespaldo ? TESELAS.urlRespaldo : TESELAS.url}
      attribution={usarRespaldo ? TESELAS.atribucionRespaldo : TESELAS.atribucion}
      maxZoom={TESELAS.maxZoom}
      eventHandlers={{
        tileerror: () => {
          if (usarRespaldo) return;
          erroresSeguidos.current += 1;
          if (erroresSeguidos.current >= ERRORES_PARA_RESPALDO) setUsarRespaldo(true);
        },
        tileload: () => {
          erroresSeguidos.current = 0;
        },
      }}
    />
  );
}
