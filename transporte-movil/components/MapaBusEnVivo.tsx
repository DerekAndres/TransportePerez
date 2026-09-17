import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

import BotonMapa from '@/components/BotonMapa';
import { escucharUbicacion } from '@/services/padreService';
import type { UbicacionActual } from '@/types/models';
import { ESPACIO } from '@/constants/estilos';
import { COLORES_MAPA, CSS_MAPA, JS_ENTRADA_MAPA, TESELAS } from '@/constants/mapa';

// Mapa del bus en vivo, reutilizable: lo usan la pantalla completa del mapa y la
// vista previa embebida en el inicio del padre. Antes este HTML vivía suelto
// dentro de la pantalla del mapa; se extrajo para no tener dos copias del mismo
// Leaflet que después se desincronizan.
//
// Todo el stack de mapas es ecosistema OpenStreetMap, gratis y sin API key:
//   - Teselas del servidor oficial de OpenStreetMap. Se venia usando CARTO
//     Positron, mas elegante, pero CARTO pasó a exigir una API key y los mapas
//     empezaron a mostrar el cartel "API KEY REQUIRED" encima. OSM es el que el
//     informe declara y no pide clave. Para que el mapa acompañe a la identidad
//     oscura de la app, las teselas se invierten por CSS en vez de cambiar de
//     proveedor — la explicación completa está en el <style> del HTML.
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
  interactivo: boolean,
  // Placa de la unidad, para la cápsula del bus ("UNIDAD HAB-1234").
  // Si no se pasa, la cápsula dice solo "Bus".
  unidad: string
) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    /* Los colores de acá replican los del tema (constants/tema.ts): zafiro para
       el bus —lo que está pasando ahora— y cian para la parada —el dato de
       ubicación—. Van escritos a mano porque este HTML corre dentro del WebView,
       aislado de React: el WebView no ve el tema de Paper.
       El CSS que oscurece las teselas es compartido por los tres mapas de la
       app y vive en constants/mapa.ts, con la explicación de por qué se
       invierten en vez de cambiar de proveedor. */
    ${CSS_MAPA}
    /* Transición suave: el marcador "viaja" hacia la posición nueva en vez de saltar */
    .marcador-bus { transition: transform 0.9s linear; }
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

    var capa = L.tileLayer('${TESELAS.url}', {
      attribution: '${TESELAS.atribucion}',
      maxZoom: ${TESELAS.maxZoom}
    }).addTo(mapa);

    // Si el servidor de teselas deja de responder, se pasa al de respaldo en vez
    // de dejar la pantalla vacía. Se espera a varios fallos seguidos porque una
    // tesela suelta puede fallar por señal y no por el servidor.
    var fallos = 0;
    capa.on('tileerror', function () {
      fallos++;
      if (fallos < 5 || mapa.__respaldo) return;
      mapa.__respaldo = true;
      mapa.removeLayer(capa);
      L.tileLayer('${TESELAS.urlRespaldo}', {
        attribution: '${TESELAS.atribucionRespaldo}',
        maxZoom: ${TESELAS.maxZoom}
      }).addTo(mapa);
    });



    ${JS_ENTRADA_MAPA}
    // Se adelanta la entrada al momento en que termina de cargar la PRIMERA
    // tanda de teselas: así el usuario ve el mapa ya dibujado y no armándose
    capa.on('load', entrarMapa);

    // Cápsula con nombre: un punto de color y el texto al lado. Se arma con
    // textContent y no con HTML para que el nombre de una parada escrito por
    // un padre no pueda inyectar marcado.
    function capsula(texto, color, clases, sub) {
      var caja = document.createElement('div');
      caja.className = 'pastilla-mapa ' + (clases || '');
      var punto = document.createElement('span');
      punto.className = 'punto';
      if (color) { punto.style.background = color; punto.style.boxShadow = '0 0 8px ' + color; }
      caja.appendChild(punto);
      var etiqueta = document.createElement('span');
      etiqueta.textContent = texto;
      caja.appendChild(etiqueta);
      if (sub) {
        var extra = document.createElement('span');
        extra.className = 'sub';
        extra.textContent = sub;
        caja.appendChild(extra);
      }
      return caja;
    }

    // Marcador fijo: el destino del niño. Va en ÁMBAR, que en toda la app
    // significa "hacia allá vamos", y no en el zafiro del bus: si los dos
    // fueran del mismo color habría que leerlos para distinguirlos.
    L.marker([PARADA.lat, PARADA.lng], {
      icon: L.divIcon({
        className: '',
        html: capsula(${JSON.stringify(paradaNombre || 'Parada')}, '${COLORES_MAPA.ambar}').outerHTML,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      })
    }).addTo(mapa);

    // Marcador móvil: el bus (cápsula de zafiro; se crea con la primera coordenada)
    var marcadorBus = null;
    var ultimoBus = null;

    // ============================================
    // EL MAPA SE ACOMODA SOLO
    // ============================================
    // El bus manda su posición cada ~15 s. Si el mapa se quedara quieto, a los
    // pocos minutos el bus se habría ido de la pantalla y el padre tendría que
    // arrastrar el mapa con el dedo para encontrarlo — justo lo que no se puede
    // hacer parado en la vereda con un niño de la mano.
    //
    // Así que el mapa SIGUE al bus: en cada posición nueva vuelve a encuadrar el
    // bus y la parada juntos, que es la pregunta real ("¿cuánto le falta para
    // llegar a mi casa?"). Con una excepción: en cuanto el padre mueve el mapa
    // con el dedo, el mapa deja de seguirlo. Un mapa que se reacomoda solo
    // mientras alguien lo está mirando es peor que uno quieto. Ahí se le avisa a
    // React Native, que enciende el botón "Centrar" para volver.
    var seguir = true;

    function avisarSeguimiento() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ tipo: 'seguimiento', activo: seguir }));
      }
    }

    function encuadrar() {
      if (ultimoBus) {
        // El relleno de abajo es más grande: ahí flota el botón de centrar
        mapa.fitBounds([[ultimoBus.lat, ultimoBus.lng], [PARADA.lat, PARADA.lng]], {
          paddingTopLeft: L.point(45, 45),
          paddingBottomRight: L.point(45, 85),
          maxZoom: 17
        });
      } else {
        // Todavía no llegó ninguna posición del bus: al menos, la parada
        mapa.setView([PARADA.lat, PARADA.lng], 15);
      }
    }

    function dejarDeSeguir() {
      if (!seguir) return;
      seguir = false;
      avisarSeguimiento();
    }

    // 'dragstart' lo dispara SOLO el dedo (encuadrar por código no lo dispara).
    // El zoom con dos dedos no distingue quién lo pidió, así que se mira el
    // toque: dos dedos sobre el mapa es siempre una persona.
    mapa.on('dragstart', dejarDeSeguir);
    mapa.on('dblclick', dejarDeSeguir);
    mapa.getContainer().addEventListener('touchstart', function (evento) {
      if (evento.touches && evento.touches.length > 1) dejarDeSeguir();
    }, { passive: true });

    // Camino por las calles del bus a la casa
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
            rutaLinea = L.polyline(puntos, { color: '${COLORES_MAPA.zafiroClaro}', weight: 4, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(mapa);
          } else {
            // Se MUEVE la línea que ya existe en vez de dibujar otra encima:
            // si no, a los veinte minutos de viaje el mapa tendría ochenta
            // líneas apiladas. (Acá antes se tocaba una segunda línea que no
            // existía: el error rompía la actualización en silencio —queda
            // adentro de un .then— y el camino se congelaba en el primero que
            // se había calculado, aunque el bus siguiera avanzando.)
            rutaLinea.setLatLngs(puntos);
          }
        })
        .catch(function () { /* sin ruta el mapa sigue sirviendo igual */ });
    }

    function actualizarBus(lat, lng) {
      if (!marcadorBus) {
        // La cápsula del bus lleva el aura que late: es lo único del mapa que
        // está pasando AHORA, y tiene que distinguirse del destino sin leer.
        var caja = capsula(${JSON.stringify(unidad ? `Unidad ${unidad}` : 'Bus')}, null, 'pastilla-bus');
        var aura = document.createElement('span');
        aura.className = 'aura-bus';
        caja.appendChild(aura);
        marcadorBus = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'marcador-bus',
            html: caja.outerHTML,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
          })
        }).addTo(mapa);
      } else {
        marcadorBus.setLatLng([lat, lng]);
      }
      actualizarRuta(lat, lng);
      ultimoBus = { lat: lat, lng: lng };
      if (seguir) encuadrar();
    }

    function recibirMensaje(evento) {
      try {
        var datos = JSON.parse(evento.data);
        // El padre tocó "Centrar": el mapa vuelve al bus y retoma el seguimiento
        if (datos.accion === 'centrar') {
          seguir = true;
          avisarSeguimiento();
          encuadrar();
          return;
        }
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
  // Placa de la unidad, para la etiqueta del bus en el mapa
  unidad?: string;
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
  unidad = '',
  interactivo = true,
  onEstado,
  style,
}: Props) {
  const webviewRef = useRef<WebView>(null);
  const [ubicacion, setUbicacion] = useState<UbicacionActual | null>(null);
  const [webviewListo, setWebviewListo] = useState(false);
  // ¿El mapa está siguiendo al bus? Lo decide el HTML (deja de seguir cuando el
  // padre mueve el mapa con el dedo) y lo avisa por postMessage. Acá solo sirve
  // para una cosa: encender el botón cuando hay algo que centrar.
  const [siguiendo, setSiguiendo] = useState(true);

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
        source={{ html: generarHtmlMapa(paradaLat, paradaLng, paradaNombre, interactivo, unidad) }}
        onLoadEnd={() => setWebviewListo(true)}
        onMessage={(evento) => {
          try {
            const datos = JSON.parse(evento.nativeEvent.data);
            if (datos.tipo === 'seguimiento') setSiguiendo(!!datos.activo);
          } catch {
            // mensaje no reconocido: se ignora
          }
        }}
        style={styles.mapa}
        scrollEnabled={interactivo}
      />

      {/* CENTRAR: en la vista previa del inicio no va —ahí el mapa no se puede
          tocar, así que nunca se descoloca—. En el mapa completo está siempre,
          para que se lo encuentre cuando hace falta, y se ENCIENDE en zafiro
          justo cuando el padre movió el mapa y perdió de vista al bus. */}
      {interactivo && (
        <View style={styles.controles}>
          <BotonMapa
            icono="crosshairs-gps"
            texto={siguiendo ? undefined : 'Centrar'}
            tono={siguiendo ? 'vidrio' : 'zafiro'}
            accesibilidad="Centrar el mapa en el bus y tu parada"
            onPress={() =>
              webviewRef.current?.postMessage(JSON.stringify({ accion: 'centrar' }))
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, overflow: 'hidden' },
  mapa: { flex: 1, backgroundColor: 'transparent' },
  // Abajo a la derecha, donde llega el pulgar. Los 30 px de abajo dejan a la
  // vista la atribución de OpenStreetMap, que es obligatoria.
  controles: { position: 'absolute', right: ESPACIO.interno, bottom: 30 },
});
