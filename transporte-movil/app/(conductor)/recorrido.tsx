import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import PantallaBase from '@/components/PantallaBase';
import type { ParadaRecorrido } from '@/services/conductorService';

// Mapa del recorrido del conductor: TODAS las paradas de la ruta numeradas en el
// orden de visita (casas donde recoger, punto de transbordo, escuelas), unidas con
// una línea. Mismo patrón que el mapa del padre: HTML con Leaflet en un WebView
// (decisión del informe: Leaflet/OpenStreetMap, no Google Maps). Acá el mapa es
// estático (los lugares no se mueven), así que no hace falta postMessage.
function generarHtmlRecorrido(paradas: ParadaRecorrido[]) {
  // El JSON se inyecta como literal en el script. Se escapa "<" para que un nombre
  // no pueda cerrar la etiqueta <script> del HTML.
  const datos = JSON.stringify(paradas).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #mapa { height: 100%; margin: 0; }
    /* El marcador muestra SOLO el número de orden: el conductor va en orden y
       no tiene que leer nada mientras maneja. El detalle está en la ficha que
       se abre al tocarlo. Colores de la marca (ver constants/tema.ts): las casas
       en blanco con el número coral; el punto de transbordo lleno de aqua (es la
       excepción, tiene que distinguirse) y las escuelas llenas de mango (el
       destino del viaje). */
    .parada {
      background: #fff; border-radius: 50%;
      width: 34px; height: 34px;
      display: flex; align-items: center; justify-content: center;
      font: 700 15px/1 -apple-system, 'Segoe UI', Roboto, sans-serif;
      color: #12659E;
      box-shadow: 0 2px 8px rgba(13, 40, 84, .35);
      border: 2px solid #12659E;
      box-sizing: border-box;
      /* centra el círculo sobre la coordenada (el divIcon ancla arriba-izquierda) */
      transform: translate(-50%, -50%);
    }
    .parada-punto { background: #1B7A5A; color: #fff; border-color: #fff; }
    .parada-escuela { background: #8A5B00; color: #fff; border-color: #fff; }

    /* Ficha que se abre al tocar una parada */
    .ficha { font: 13px/1.4 -apple-system, 'Segoe UI', Roboto, sans-serif; min-width: 180px; }
    .ficha-titulo { font-weight: 700; font-size: 14px; color: #3D0B00; margin-bottom: 2px; }
    .ficha-ref {
      background: #E8F5EF; border-left: 3px solid #1B7A5A;
      padding: 5px 7px; border-radius: 4px; margin: 6px 0; color: #4a3b2a;
    }
    .ficha-etiqueta { font-size: 11px; text-transform: uppercase; color: #74777F; margin-top: 8px; }
    .ficha-nino { display: flex; align-items: center; gap: 7px; margin-top: 5px; }
    .ficha-foto {
      width: 30px; height: 30px; border-radius: 50%; object-fit: cover;
      background: #FFDBCF; color: #8C2F0C;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 13px; flex: none;
    }
  </style>
</head>
<body>
  <div id="mapa"></div>
  <script>
    var paradas = ${datos};
    var EMOJI = { casa: '🏠', escuela: '🏫', punto: '🔄' };

    // Ficha de la parada: se arma con la API del DOM (textContent) para que un
    // nombre o una referencia escrita por un padre no pueda inyectar HTML.
    function fichaDe(p, i) {
      var caja = document.createElement('div');
      caja.className = 'ficha';

      var titulo = document.createElement('div');
      titulo.className = 'ficha-titulo';
      titulo.textContent = (i + 1) + '. ' + EMOJI[p.tipo] + ' ' + p.nombre;
      caja.appendChild(titulo);

      if (p.referencia) {
        var ref = document.createElement('div');
        ref.className = 'ficha-ref';
        ref.textContent = '📍 ' + p.referencia;
        caja.appendChild(ref);
      }

      var ninos = p.ninos || [];
      if (ninos.length > 0) {
        var etiqueta = document.createElement('div');
        etiqueta.className = 'ficha-etiqueta';
        etiqueta.textContent = ninos.length === 1 ? 'Niño' : ninos.length + ' niños';
        caja.appendChild(etiqueta);

        ninos.forEach(function (n) {
          var fila = document.createElement('div');
          fila.className = 'ficha-nino';
          if (n.foto) {
            var img = document.createElement('img');
            img.className = 'ficha-foto';
            img.src = n.foto;
            fila.appendChild(img);
          } else {
            var inicial = document.createElement('div');
            inicial.className = 'ficha-foto';
            inicial.textContent = (n.nombre || '?').trim().charAt(0).toUpperCase();
            fila.appendChild(inicial);
          }
          var nombre = document.createElement('span');
          nombre.textContent = n.nombre;
          fila.appendChild(nombre);
          caja.appendChild(fila);
        });
      }

      return caja;
    }

    var mapa = L.map('mapa');
    // Teselas CARTO Positron: estilo claro y elegante sobre datos OpenStreetMap
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(mapa);

    var linea = [];
    paradas.forEach(function (p, i) {
      linea.push([p.lat, p.lng]);
      // Solo el número: el detalle aparece al tocar
      var marcador = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: '',
          html: '<div class="parada parada-' + p.tipo + '">' + (i + 1) + '</div>',
          iconSize: null
        })
      }).addTo(mapa);
      marcador.bindPopup(fichaDe(p, i), { minWidth: 190, maxWidth: 260 });
    });

    // Línea punteada recta entre paradas: es el RESPALDO mientras se calcula el
    // camino real (o si el servicio de ruteo no responde)
    var respaldo = L.polyline(linea, { color: '#12659E', weight: 3, dashArray: '6 8', opacity: 0.8 }).addTo(mapa);
    mapa.fitBounds(L.latLngBounds(linea), { padding: [40, 40], maxZoom: 16 });

    // Camino real POR LAS CALLES con OSRM (ruteo de OpenStreetMap, sin API key):
    // se pide una sola vez con todas las paradas en orden y, si responde, la
    // línea de calles reemplaza a la punteada. Dos trazos
    // para que se lea nítida sobre el mapa claro (borde blanco + coral).
    if (linea.length >= 2) {
      var coords = linea.map(function (p) { return p[1] + ',' + p[0]; }).join(';');
      fetch('https://router.project-osrm.org/route/v1/driving/' + coords + '?overview=full&geometries=geojson')
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.routes || !d.routes[0]) return;
          // GeoJSON viene [lng, lat]; Leaflet espera [lat, lng]
          var puntos = d.routes[0].geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
          mapa.removeLayer(respaldo);
          L.polyline(puntos, { color: '#fff', weight: 9, opacity: .9, lineCap: 'round', lineJoin: 'round' }).addTo(mapa);
          L.polyline(puntos, { color: '#12659E', weight: 5, opacity: .95, lineCap: 'round', lineJoin: 'round' }).addTo(mapa);
        })
        .catch(function () { /* se queda la línea punteada, el mapa sigue sirviendo */ });
    }
  </script>
</body>
</html>`;
}

export default function RecorridoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ rutaNombre: string; paradas: string }>();

  // Las paradas llegan serializadas desde "Mi ruta de hoy" (ya derivadas y ordenadas)
  let paradas: ParadaRecorrido[] = [];
  try {
    paradas = JSON.parse(params.paradas ?? '[]');
  } catch {
    paradas = [];
  }

  return (
    <PantallaBase
      titulo={params.rutaNombre || 'Recorrido'}
      subtitulo="Orden de las paradas"
      alVolver={() => router.back()}
      scroll={false}
    >
      {paradas.length === 0 ? (
        <View style={styles.centrado}>
          <Text>La ruta no tiene lugares con ubicación para mostrar.</Text>
        </View>
      ) : (
        <>
          <WebView source={{ html: generarHtmlRecorrido(paradas) }} style={styles.mapa} />
          {/* Separado de la barra de navegación del teléfono */}
          <Text variant="bodySmall" style={[styles.pie, { paddingBottom: insets.bottom + 8 }]}>
            Los números marcan el orden del recorrido. Tocá una parada para ver el punto de
            referencia y quiénes suben o bajan ahí.
          </Text>
        </>
      )}
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
  },
  centrado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  mapa: {
    flex: 1,
  },
  pie: {
    padding: 8,
    opacity: 0.6,
    textAlign: 'center',
  },
});
