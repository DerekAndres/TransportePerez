import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

import { escucharUbicacion } from '@/services/padreService';
import type { UbicacionActual } from '@/types/models';

// Mapa del bus en vivo, reutilizable: lo usan la pantalla completa del mapa y la
// vista previa embebida en el inicio del padre. Antes este HTML vivía suelto
// dentro de la pantalla del mapa; se extrajo para no tener dos copias del mismo
// Leaflet que después se desincronizan.
//
// Todo el stack de mapas es ecosistema OpenStreetMap, gratis y sin API key:
//   - Teselas CARTO Positron: el estilo claro y elegante (datos OSM renderizados
//     por CARTO) que usan las apps modernas de delivery/transporte.
//   - Ruteo OSRM (router.project-osrm.org): dibuja el camino del bus a la casa
//     SIGUIENDO LAS CALLES. Es el servidor público de demostración de OSRM; si
//     no responde, el mapa sigue funcionando igual, solo sin la línea.

// Centro por defecto si la parada no tiene coordenadas: La Ceiba, Atlántida
export const CENTRO_LA_CEIBA = { lat: 15.7597, lng: -86.7822 };

// Qué está pasando con la señal del bus (lo muestra quien use el componente)
export type EstadoMapa =
  | { tipo: 'esperando' }
  | { tipo: 'en_vivo'; hora: string }
  | { tipo: 'finalizado' };

function generarHtmlMapa(
  paradaLat: number,
  paradaLng: number,
  paradaNombre: string,
  interactivo: boolean
) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    /* Los colores de acá replican los del tema (constants/tema.ts): coral para
       el bus —lo que se mueve— y aqua para la parada —el destino—. Van escritos
       a mano porque este HTML corre dentro del WebView, aislado de React. */
    html, body, #mapa { height: 100%; margin: 0; background: #FFFFFF; }
    /* Transición suave: el marcador "viaja" hacia la posición nueva en vez de saltar */
    .marcador-bus { transition: transform 0.9s linear; }
    /* Marcadores tipo burbuja: círculo con sombra, como en las apps modernas */
    .burbuja {
      width: 42px; height: 42px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 21px; background: #fff;
      border: 3px solid #1B7A5A;
      box-shadow: 0 3px 12px rgba(90, 31, 10, .35);
      box-sizing: border-box;
      /* referencia para el halo del bus, que se posiciona sobre esta burbuja */
      position: relative;
    }
    .burbuja-bus { background: #12659E; border-color: #fff; }
    /* Halo que late alrededor del bus: se ve de un vistazo que la posición está
       viva y no es una foto vieja del mapa */
    .burbuja-bus::after {
      content: ''; position: absolute; inset: -3px;
      border-radius: 50%; border: 2px solid #12659E;
      animation: latido 2s ease-out infinite;
    }
    @keyframes latido {
      0%   { transform: scale(1);   opacity: .8; }
      100% { transform: scale(2.1); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="mapa"></div>
  <script>
    var PARADA = { lat: ${paradaLat}, lng: ${paradaLng} };
    var INTERACTIVO = ${interactivo};

    // En la vista previa del inicio el mapa NO se puede arrastrar ni hacer zoom:
    // el dedo tiene que poder seguir desplazando la lista de hijos por encima.
    var mapa = L.map('mapa', {
      zoomControl: false,
      dragging: INTERACTIVO,
      touchZoom: INTERACTIVO,
      scrollWheelZoom: INTERACTIVO,
      doubleClickZoom: INTERACTIVO,
      boxZoom: INTERACTIVO,
      keyboard: INTERACTIVO,
      tap: INTERACTIVO,
      attributionControl: INTERACTIVO
    }).setView([PARADA.lat, PARADA.lng], 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(mapa);

    // Marcador fijo: la casa/parada del niño (burbuja blanca con borde aqua)
    var marcadorParada = L.marker([PARADA.lat, PARADA.lng], {
      icon: L.divIcon({
        className: '',
        html: '<div class="burbuja">🏠</div>',
        iconSize: [42, 42],
        iconAnchor: [21, 21]
      })
    }).addTo(mapa);
    if (INTERACTIVO) marcadorParada.bindPopup(${JSON.stringify(paradaNombre || 'Parada')});

    // Marcador móvil: el bus (burbuja coral; se crea con la primera coordenada)
    var marcadorBus = null;
    var primeraVez = true;

    // Camino por las calles del bus a la casa (dos líneas: borde blanco + coral,
    // para que se lea nítida sobre el mapa claro)
    var rutaBorde = null;
    var rutaLinea = null;
    var ultimoRuteo = null;

    // Distancia aproximada en metros (suficiente para decidir si re-rutear)
    function distanciaM(aLat, aLng, bLat, bLng) {
      var dLat = (bLat - aLat) * 111320;
      var dLng = (bLng - aLng) * 111320 * Math.cos(aLat * Math.PI / 180);
      return Math.sqrt(dLat * dLat + dLng * dLng);
    }

    // Pide a OSRM el camino bus → casa. Solo se re-pide si el bus se movió más
    // de 120 m desde el último cálculo (no satura el servidor de demostración).
    function actualizarRuta(lat, lng) {
      if (ultimoRuteo && distanciaM(lat, lng, ultimoRuteo.lat, ultimoRuteo.lng) < 120) return;
      ultimoRuteo = { lat: lat, lng: lng };
      var url = 'https://router.project-osrm.org/route/v1/driving/' +
        lng + ',' + lat + ';' + PARADA.lng + ',' + PARADA.lat +
        '?overview=full&geometries=geojson';
      fetch(url)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.routes || !d.routes[0]) return;
          // GeoJSON viene [lng, lat]; Leaflet espera [lat, lng]
          var puntos = d.routes[0].geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
          if (!rutaLinea) {
            rutaBorde = L.polyline(puntos, { color: '#fff', weight: 9, opacity: .9, lineCap: 'round', lineJoin: 'round' }).addTo(mapa);
            rutaLinea = L.polyline(puntos, { color: '#12659E', weight: 5, opacity: .95, lineCap: 'round', lineJoin: 'round' }).addTo(mapa);
          } else {
            rutaBorde.setLatLngs(puntos);
            rutaLinea.setLatLngs(puntos);
          }
        })
        .catch(function () { /* sin ruta el mapa sigue sirviendo igual */ });
    }

    function actualizarBus(lat, lng) {
      if (!marcadorBus) {
        marcadorBus = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'marcador-bus',
            html: '<div class="burbuja burbuja-bus">🚌</div>',
            iconSize: [42, 42],
            iconAnchor: [21, 21]
          })
        }).addTo(mapa);
      } else {
        marcadorBus.setLatLng([lat, lng]);
      }
      actualizarRuta(lat, lng);
      if (primeraVez) {
        // Encuadra bus + parada juntos solo la primera vez (después no molesta al usuario)
        mapa.fitBounds([[lat, lng], [PARADA.lat, PARADA.lng]], { padding: [50, 50] });
        primeraVez = false;
      }
    }

    function recibirMensaje(evento) {
      try {
        var datos = JSON.parse(evento.data);
        if (typeof datos.lat === 'number' && typeof datos.lng === 'number') {
          actualizarBus(datos.lat, datos.lng);
        }
      } catch (e) { /* mensaje no reconocido: se ignora */ }
    }

    // iOS entrega los mensajes en window; Android en document — se escuchan ambos
    window.addEventListener('message', recibirMensaje);
    document.addEventListener('message', recibirMensaje);
  </script>
</body>
</html>`;
}

interface Props {
  viajeId: string;
  paradaLat: number;
  paradaLng: number;
  paradaNombre?: string;
  // false = vista previa: sin arrastrar ni zoom, para embeberlo en una lista
  interactivo?: boolean;
  onEstado?: (estado: EstadoMapa) => void;
  style?: StyleProp<ViewStyle>;
}

export default function MapaBusEnVivo({
  viajeId,
  paradaLat,
  paradaLng,
  paradaNombre = '',
  interactivo = true,
  onEstado,
  style,
}: Props) {
  const webviewRef = useRef<WebView>(null);
  const [ubicacion, setUbicacion] = useState<UbicacionActual | null>(null);
  const [webviewListo, setWebviewListo] = useState(false);

  // El callback se guarda en una ref para que el efecto de suscripción NO dependa
  // de él: si dependiera, pasarle una función anónima desde el padre resuscribiría
  // el listener en cada render (mismo patrón que use-emision-ubicacion).
  const onEstadoRef = useRef(onEstado);
  useEffect(() => {
    onEstadoRef.current = onEstado;
  }, [onEstado]);

  // Suscripción en tiempo real a la ubicación del viaje
  useEffect(() => {
    if (!viajeId) return;
    let huboUbicacion = false;
    const cancelar = escucharUbicacion(viajeId, (nueva) => {
      if (nueva) {
        huboUbicacion = true;
        setUbicacion(nueva);
        onEstadoRef.current?.({
          tipo: 'en_vivo',
          hora: nueva.timestamp.toDate().toLocaleTimeString('es-HN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
      } else {
        // null después de haber tenido ubicación = el conductor finalizó el viaje
        setUbicacion(null);
        onEstadoRef.current?.(huboUbicacion ? { tipo: 'finalizado' } : { tipo: 'esperando' });
      }
    });
    return cancelar;
  }, [viajeId]);

  // Cada ubicación nueva se manda al HTML del mapa vía postMessage
  useEffect(() => {
    if (ubicacion && webviewListo) {
      webviewRef.current?.postMessage(JSON.stringify({ lat: ubicacion.lat, lng: ubicacion.lng }));
    }
  }, [ubicacion, webviewListo]);

  return (
    // En vista previa el mapa no recibe toques: los recibe la tarjeta de atrás,
    // que es la que abre el mapa completo. El pointerEvents va en el contenedor
    // (una View de React Native) porque el WebView no garantiza reenviarlo a su
    // vista nativa.
    <View style={[styles.contenedor, style]} pointerEvents={interactivo ? 'auto' : 'none'}>
      <WebView
        ref={webviewRef}
        source={{ html: generarHtmlMapa(paradaLat, paradaLng, paradaNombre, interactivo) }}
        onLoadEnd={() => setWebviewListo(true)}
        style={styles.mapa}
        scrollEnabled={interactivo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, overflow: 'hidden' },
  mapa: { flex: 1, backgroundColor: 'transparent' },
});
