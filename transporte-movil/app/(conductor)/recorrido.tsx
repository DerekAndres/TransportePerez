import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';

import BotonMapa from '@/components/BotonMapa';
import PantallaBase from '@/components/PantallaBase';
import Vidrio from '@/components/Vidrio';
import PastillaEstado from '@/components/PastillaEstado';
import { ESPACIO, RADIO, estilosBase } from '@/constants/estilos';
import { ZAFIRO } from '@/constants/tema';
import type { ParadaRecorrido } from '@/services/conductorService';
import { COLORES_MAPA, CSS_MAPA, JS_ENTRADA_MAPA, TESELAS } from '@/constants/mapa';

// Mapa del recorrido del conductor: TODAS las paradas de la ruta numeradas en el
// orden de visita (casas donde recoger, punto de transbordo, escuelas), unidas con
// una línea. Mismo patrón que el mapa del padre: HTML con Leaflet en un WebView
// (decisión del informe: Leaflet/OpenStreetMap, no Google Maps).
//
// EL MAPA SE ACOMODA SOLO (lo que se agregó acá):
//   · El conductor se ve a sí mismo como un punto azul, igual que en cualquier
//     app de mapas. Sin eso, un mapa de paradas no dice lo único que importa
//     mientras se maneja: a cuál le toca ahora y para qué lado queda.
//   · "Siguiente" encuadra la parada que toca AHORA junto con el conductor, y
//     desde ahí el mapa lo SIGUE: cada posición nueva vuelve a encuadrar los
//     dos. Es lo que evita tener que acomodar el mapa con la mano manejando.
//     En cuanto toca el mapa con el dedo, deja de seguirlo.
//   · "Ver toda la ruta" vuelve a la vista completa.
//   · Tocar una parada de la lista lleva el mapa hasta ella.
//
// Los encuadres reciben desde React Native cuánto le tapan al mapa la fila de
// botones (arriba) y el panel del orden (abajo), así lo que se encuadra queda
// en la parte del mapa que de verdad se ve y no debajo del panel.
function generarHtmlRecorrido(paradas: ParadaRecorrido[], siguiente: number) {
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
    /* Teselas oscuras compartidas con los otros mapas (constants/mapa.ts) */
    ${CSS_MAPA}

    /* El marcador muestra SOLO el número de orden: el conductor va en orden y
       no tiene que leer nada mientras maneja. El detalle está en la ficha que
       se abre al tocarlo. Colores de la marca (ver constants/tema.ts): las casas
       son burbujas de vidrio con el número en zafiro; el punto de transbordo va
       lleno de cian (es la excepción, tiene que distinguirse) y las escuelas
       llenas de ámbar (el destino del viaje). */
    .parada {
      position: relative;
      background: rgba(15, 23, 42, .94); border-radius: 50%;
      width: 34px; height: 34px;
      display: flex; align-items: center; justify-content: center;
      font: 700 15px/1 -apple-system, 'Segoe UI', Roboto, sans-serif;
      color: ${COLORES_MAPA.zafiroClaro};
      box-shadow: 0 3px 12px rgba(0, 0, 0, .6), 0 0 10px rgba(37, 99, 235, .4);
      border: 2px solid ${COLORES_MAPA.zafiro};
      box-sizing: border-box;
      /* centra el círculo sobre la coordenada (el divIcon ancla arriba-izquierda) */
      transform: translate(-50%, -50%);
    }
    .parada-punto {
      background: ${COLORES_MAPA.cian}; color: #04202B;
      border-color: rgba(255, 255, 255, .8);
      box-shadow: 0 3px 12px rgba(0, 0, 0, .6), 0 0 14px rgba(56, 189, 248, .6);
    }
    .parada-escuela {
      background: ${COLORES_MAPA.ambar}; color: #2A1700;
      border-color: rgba(255, 255, 255, .8);
      box-shadow: 0 3px 12px rgba(0, 0, 0, .6), 0 0 14px rgba(245, 158, 11, .55);
    }

    /* LA PARADA QUE TOCA AHORA. En un mapa quieto, lo único que se mueve se
       encuentra sin buscar: el aro late (la misma animación 'latido' que usa el
       bus en el mapa del padre, definida en constants/mapa.ts). */
    .anillo-siguiente {
      position: absolute; inset: -7px;
      border-radius: 50%; border: 2px solid ${COLORES_MAPA.zafiroClaro};
      animation: latido 2.2s ease-out infinite;
      pointer-events: none;
    }

    /* DÓNDE ESTÁ EL CONDUCTOR: el punto azul con anillo blanco de cualquier app
       de mapas. Se deja igual a propósito — es el símbolo que ya conoce. */
    .yo {
      width: 18px; height: 18px; border-radius: 50%;
      background: ${COLORES_MAPA.zafiro};
      border: 3px solid #FFFFFF;
      box-shadow: 0 0 0 6px rgba(37, 99, 235, .22), 0 2px 8px rgba(0, 0, 0, .55);
      box-sizing: border-box;
      transform: translate(-50%, -50%);
    }

    /* Ficha que se abre al tocar una parada */
    .ficha { font: 13px/1.4 -apple-system, 'Segoe UI', Roboto, sans-serif; min-width: 180px; color: ${COLORES_MAPA.texto}; }
    .ficha-titulo { font-weight: 700; font-size: 14px; color: #FFFFFF; margin-bottom: 2px; }
    .ficha-ref {
      background: rgba(37, 99, 235, .16); border-left: 3px solid ${COLORES_MAPA.zafiro};
      padding: 5px 7px; border-radius: 4px; margin: 6px 0; color: ${COLORES_MAPA.textoTenue};
    }
    .ficha-etiqueta { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #8D90A0; margin-top: 8px; }
    .ficha-nino { display: flex; align-items: center; gap: 7px; margin-top: 5px; }
    .ficha-foto {
      width: 30px; height: 30px; border-radius: 50%; object-fit: cover;
      background: rgba(37, 99, 235, .28); color: ${COLORES_MAPA.zafiroClaro};
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 13px; flex: none;
    }
  </style>
</head>
<body>
  <div id="mapa"></div>
  <script>
    var paradas = ${datos};
    // Índice de la parada que toca ahora (-1 = ninguna). Lo calcula la pantalla
    // "Mi ruta de hoy", que es la que sabe qué niño ya subió y cuál no.
    var SIGUIENTE = ${siguiente};
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

    ${JS_ENTRADA_MAPA}

    var mapa = L.map('mapa');
    // Teselas oscuras compartidas por los tres mapas (ver constants/mapa.ts)
    L.tileLayer('${TESELAS.url}', {
      attribution: '${TESELAS.atribucion}',
      maxZoom: ${TESELAS.maxZoom}
    }).addTo(mapa);


    var linea = [];
    paradas.forEach(function (p, i) {
      linea.push([p.lat, p.lng]);
      // Solo el número: el detalle aparece al tocar. La que toca ahora lleva
      // además el aro que late.
      var marcador = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: '',
          html: '<div class="parada parada-' + p.tipo + '">' + (i + 1) +
            (i === SIGUIENTE ? '<span class="anillo-siguiente"></span>' : '') + '</div>',
          iconSize: null
        })
      }).addTo(mapa);
      marcador.bindPopup(fichaDe(p, i), { minWidth: 190, maxWidth: 260 });
    });

    // Línea punteada recta entre paradas: es el RESPALDO mientras se calcula el
    // camino real (o si el servicio de ruteo no responde)
    var respaldo = L.polyline(linea, { color: '${COLORES_MAPA.zafiro}', weight: 3, dashArray: '6 8', opacity: 0.85 }).addTo(mapa);
    mapa.fitBounds(L.latLngBounds(linea), { padding: [40, 40], maxZoom: 16 });

    // ============================================
    // LOS ENCUADRES
    // ============================================
    // 'margen' es cuánto del mapa tapan la fila de botones (arriba) y el panel
    // del orden (abajo). Sin eso, "centrar" dejaría la parada justo debajo del
    // panel: centrada en el mapa, invisible para el conductor.
    var YO = null;
    var marcadorYo = null;
    var seguir = false;
    var margen = { arriba: 0, abajo: 0 };

    function encuadrar(puntos, zoomMax) {
      if (!puntos.length) return;
      mapa.fitBounds(L.latLngBounds(puntos), {
        paddingTopLeft: L.point(40, margen.arriba + 20),
        paddingBottomRight: L.point(40, margen.abajo + 20),
        maxZoom: zoomMax || 16
      });
    }

    function puntosDeTodo() {
      var todos = paradas.map(function (p) { return [p.lat, p.lng]; });
      if (YO) todos.push([YO.lat, YO.lng]);
      return todos;
    }

    // La parada que toca y el conductor, juntos en pantalla: eso contesta
    // "¿para qué lado queda y cuánto falta?" sin leer nada
    function irASiguiente() {
      if (SIGUIENTE < 0 || !paradas[SIGUIENTE]) return;
      var destino = paradas[SIGUIENTE];
      var puntos = [[destino.lat, destino.lng]];
      if (YO) puntos.push([YO.lat, YO.lng]);
      encuadrar(puntos, 17);
    }

    function actualizarYo(lat, lng) {
      YO = { lat: lat, lng: lng };
      if (!marcadorYo) {
        marcadorYo = L.marker([lat, lng], {
          icon: L.divIcon({ className: '', html: '<div class="yo"></div>', iconSize: null }),
          // Por encima de las paradas: si el conductor está PARADO sobre una,
          // el punto que tiene que ver es el suyo
          zIndexOffset: 500
        }).addTo(mapa);
      } else {
        marcadorYo.setLatLng([lat, lng]);
      }
      if (seguir) irASiguiente();
    }

    // Tocar el mapa con el dedo manda: deja de seguir y se queda donde lo
    // dejaron (mismo criterio que el mapa del padre)
    function dejarDeSeguir() { seguir = false; }
    mapa.on('dragstart', dejarDeSeguir);
    mapa.on('dblclick', dejarDeSeguir);
    mapa.getContainer().addEventListener('touchstart', function (evento) {
      if (evento.touches && evento.touches.length > 1) dejarDeSeguir();
    }, { passive: true });

    function recibirMensaje(evento) {
      try {
        var datos = JSON.parse(evento.data);
        if (datos.margen) margen = datos.margen;

        // Posición nueva del conductor
        if (typeof datos.lat === 'number' && typeof datos.lng === 'number') {
          actualizarYo(datos.lat, datos.lng);
          return;
        }
        if (datos.accion === 'todo') {
          seguir = false;
          encuadrar(puntosDeTodo(), 16);
        } else if (datos.accion === 'siguiente') {
          seguir = true;
          irASiguiente();
        } else if (datos.accion === 'parada') {
          seguir = false;
          var p = paradas[datos.indice];
          if (p) encuadrar([[p.lat, p.lng]], 17);
        }
      } catch (e) { /* mensaje no reconocido: se ignora */ }
    }

    // iOS entrega los mensajes en window; Android en document — se escuchan ambos
    window.addEventListener('message', recibirMensaje);
    document.addEventListener('message', recibirMensaje);

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
          // Funda BLANCA y trazo de zafiro encima: el recurso de todos los
          // navegadores, y lo que hace que la ruta se lea igual sobre una
          // calle, un parque o un río
          L.polyline(puntos, { color: '${COLORES_MAPA.contorno}', weight: 11, opacity: .95, lineCap: 'round', lineJoin: 'round' }).addTo(mapa);
          L.polyline(puntos, { color: '${COLORES_MAPA.zafiro}', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(mapa);
        })
        .catch(function () { /* se queda la línea punteada, el mapa sigue sirviendo */ });
    }
  </script>
</body>
</html>`;
}

// Qué es cada lugar del recorrido, de un vistazo
const EMOJI_LUGAR: Record<string, string> = {
  casa: '🏠',
  escuela: '🏫',
  punto: '🔄',
};

// Cuánto le tapa al mapa la fila de botones de arriba (alto del botón + su aire
// arriba y abajo). Se manda al mapa para que los encuadres la esquiven.
const ALTO_CONTROLES = 48 + ESPACIO.interno * 2;

export default function RecorridoScreen() {
  const router = useRouter();
  const tema = useTheme();
  const insets = useSafeAreaInsets();
  // Arranca ABIERTO: lo primero que el conductor quiere al abrir el mapa es
  // saber el orden. Plegarlo es la excepción, no el estado normal.
  const [abierto, setAbierto] = useState(true);
  const params = useLocalSearchParams<{
    rutaNombre: string;
    paradas: string;
    siguiente?: string;
  }>();

  const webviewRef = useRef<WebView>(null);
  const [posicion, setPosicion] = useState<{ lat: number; lng: number } | null>(null);
  const [mapaListo, setMapaListo] = useState(false);
  // Cuánto tapan del mapa los controles (arriba) y el panel del orden (abajo).
  // Va en una ref y no en estado porque solo se lee al mandar un mensaje: como
  // estado, cada vez que el panel se abre volvería a dibujarse toda la pantalla.
  const margenRef = useRef({ arriba: ALTO_CONTROLES, abajo: 0 });

  // Las paradas llegan serializadas desde "Mi ruta de hoy" (ya derivadas y
  // ordenadas), junto con cuál es la que toca ahora
  const paradas = useMemo<ParadaRecorrido[]>(() => {
    try {
      return JSON.parse(params.paradas ?? '[]');
    } catch {
      return [];
    }
  }, [params.paradas]);

  const crudo = Number(params.siguiente ?? -1);
  const siguiente = Number.isInteger(crudo) && crudo >= 0 && crudo < paradas.length ? crudo : -1;

  // El HTML se arma UNA vez: si se regenerara en cada render, el mapa se
  // reiniciaría cada vez que llega una posición nueva
  const html = useMemo(() => generarHtmlRecorrido(paradas, siguiente), [paradas, siguiente]);

  const enviar = useCallback((mensaje: Record<string, unknown>) => {
    webviewRef.current?.postMessage(JSON.stringify({ ...mensaje, margen: margenRef.current }));
  }, []);

  // --- Dónde está el conductor ---
  // NO se pide el permiso acá: el conductor ya se lo dio a la app al iniciar un
  // viaje, y un permiso que salta al abrir un mapa asusta más de lo que ayuda.
  // Si no lo dio, el mapa funciona igual, solo sin el punto azul.
  useEffect(() => {
    let suscripcion: Location.LocationSubscription | null = null;
    let cancelado = false;

    (async () => {
      const permiso = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (!permiso?.granted || cancelado) return;
      suscripcion = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 15 },
        (p) => setPosicion({ lat: p.coords.latitude, lng: p.coords.longitude })
      );
      // Si la pantalla se cerró mientras se pedía el GPS, se corta acá
      if (cancelado) {
        suscripcion.remove();
        suscripcion = null;
      }
    })().catch(() => {});

    return () => {
      cancelado = true;
      suscripcion?.remove();
    };
  }, []);

  // Cada posición nueva viaja al mapa (y si está siguiendo, él se reencuadra)
  useEffect(() => {
    if (!mapaListo || !posicion) return;
    enviar({ lat: posicion.lat, lng: posicion.lng });
  }, [mapaListo, posicion, enviar]);

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
          <WebView
            ref={webviewRef}
            source={{ html }}
            style={styles.mapa}
            onLoadEnd={() => {
              setMapaListo(true);
              // Primer encuadre ya sabiendo qué tapa el panel
              enviar({ accion: 'todo' });
            }}
          />

          {/* ================================================================
              LOS DOS BOTONES QUE ACOMODAN EL MAPA
              ================================================================
              Van ARRIBA y no abajo porque abajo está el panel del orden, que
              cambia de alto al plegarse: un botón que se mueve de lugar es un
              botón que hay que buscar cada vez.

              `box-none` en el contenedor es lo que hace que la franja vacía
              entre los dos botones siga siendo mapa y no una barra invisible
              que se come los toques. */}
          <View style={[styles.controles, { top: ESPACIO.interno }]} pointerEvents="box-none">
            <View style={styles.controlIzquierdo} pointerEvents="box-none">
              {siguiente >= 0 && (
                <BotonMapa
                  icono="navigation-variant"
                  tono="zafiro"
                  texto={`Siguiente · ${siguiente + 1}. ${paradas[siguiente].nombre}`}
                  accesibilidad={`Centrar el mapa en la siguiente parada: ${paradas[siguiente].nombre}`}
                  onPress={() => enviar({ accion: 'siguiente' })}
                  estilo={styles.botonSiguiente}
                />
              )}
            </View>
            <BotonMapa
              icono="arrow-expand-all"
              accesibilidad="Ver toda la ruta en el mapa"
              onPress={() => enviar({ accion: 'todo' })}
            />
          </View>

          {/* ================================================================
              EL ORDEN DEL RECORRIDO, ENCIMA DEL MAPA
              ================================================================
              Los números en el mapa dicen el orden, pero para saber QUÉ es cada
              número hay que tocarlos uno por uno — y el conductor necesita la
              lista de corrido: dónde está ahora y qué sigue.

              Va SUPERPUESTO y no debajo del mapa porque el mapa tiene que
              seguir ocupando la pantalla; y se puede PLEGAR porque a veces se
              necesita justo lo contrario: ver el mapa entero sin nada encima.
              Plegado deja la barra del título a la vista, así que nunca
              desaparece del todo — un panel que se esconde entero es un panel
              que el conductor no vuelve a encontrar. */}
          <View
            style={[
              styles.panelOrden,
              { bottom: insets.bottom + 12 },
              abierto && styles.panelAbierto,
            ]}
            // Cuánto tapa el panel del mapa, contando lo que está separado del
            // borde de abajo. Es lo que hace que "centrar" deje la parada a la
            // vista y no escondida detrás de esta lista.
            onLayout={(evento) => {
              margenRef.current = {
                arriba: ALTO_CONTROLES,
                abajo: evento.nativeEvent.layout.height + insets.bottom + 12,
              };
            }}
          >
            <Vidrio nivel="superpuesto" radio={RADIO.lamina} elevado translucido sinRelleno>
              <TouchableRipple
                onPress={() => setAbierto((v) => !v)}
                borderless
                accessibilityRole="button"
                accessibilityLabel={abierto ? 'Ocultar el orden' : 'Ver el orden del recorrido'}
              >
                <View style={styles.cabeceraPanel}>
                  <MaterialCommunityIcons
                    name="format-list-numbered"
                    size={18}
                    color={tema.colors.primary}
                  />
                  <Text variant="titleSmall" style={styles.tituloPanel}>
                    Orden del recorrido
                  </Text>
                  <Text variant="labelMedium" style={estilosBase.tenue}>
                    {paradas.length} paradas
                  </Text>
                  <MaterialCommunityIcons
                    name={abierto ? 'chevron-down' : 'chevron-up'}
                    size={22}
                    color={tema.colors.onSurfaceVariant}
                  />
                </View>
              </TouchableRipple>

              {abierto && (
                <ScrollView style={styles.listaPanel} showsVerticalScrollIndicator={false}>
                  {paradas.map((parada, i) => (
                    // Tocar una parada de la lista lleva el mapa hasta ella: es
                    // la forma de mirar una parada cualquiera sin tener que
                    // encontrar su número entre los marcadores
                    <TouchableRipple
                      key={parada.nombre + '-' + i}
                      onPress={() => enviar({ accion: 'parada', indice: i })}
                      borderless
                      accessibilityRole="button"
                      accessibilityLabel={`Centrar el mapa en la parada ${i + 1}: ${parada.nombre}`}
                    >
                      <View style={styles.filaParada}>
                        {/* El mismo número que se ve en el mapa: es lo que ata la
                            lista con los marcadores. La parada que toca ahora va
                            en zafiro lleno, como su marcador. */}
                        <View
                          style={[
                            styles.numero,
                            {
                              backgroundColor:
                                i === siguiente
                                  ? ZAFIRO
                                  : parada.tipo === 'escuela'
                                    ? 'rgba(245, 158, 11, 0.22)'
                                    : parada.tipo === 'punto'
                                      ? 'rgba(56, 189, 248, 0.22)'
                                      : 'rgba(37, 99, 235, 0.22)',
                            },
                          ]}
                        >
                          <Text variant="labelLarge" style={estilosBase.cifra}>
                            {i + 1}
                          </Text>
                        </View>

                        <View style={styles.datosParada}>
                          {i === siguiente && (
                            <Text variant="labelSmall" style={{ color: tema.colors.primary }}>
                              LE TOCA AHORA
                            </Text>
                          )}
                          <Text variant="titleSmall" numberOfLines={1}>
                            {EMOJI_LUGAR[parada.tipo] ?? ''} {parada.nombre}
                          </Text>
                          {parada.ninos.length > 0 && (
                            <Text variant="bodySmall" numberOfLines={2} style={estilosBase.tenue}>
                              {parada.ninos.map((n) => n.nombre).join(' · ')}
                            </Text>
                          )}
                          {!!parada.referencia && (
                            <Text variant="bodySmall" numberOfLines={1} style={estilosBase.tenue}>
                              📍 {parada.referencia}
                            </Text>
                          )}
                        </View>

                        {parada.ninos.length > 0 && (
                          <PastillaEstado
                            texto={String(parada.ninos.length)}
                            tono={parada.tipo === 'escuela' ? 'aviso' : 'vivo'}
                          />
                        )}
                      </View>
                    </TouchableRipple>
                  ))}
                </ScrollView>
              )}
            </Vidrio>
          </View>
        </>
      )}
    </PantallaBase>
  );
}

const styles = StyleSheet.create({
  centrado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  mapa: {
    flex: 1,
  },
  // Los controles flotan sobre el mapa, sin tocar los bordes
  controles: {
    position: 'absolute',
    left: ESPACIO.interno,
    right: ESPACIO.interno,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ESPACIO.minimo,
  },
  // Se achica cuando el nombre de la parada es largo, para no empujar al otro
  // botón fuera de la pantalla
  controlIzquierdo: { flexShrink: 1 },
  botonSiguiente: { flexShrink: 1 },
  // El panel flota sobre el mapa, sin tocar los bordes
  panelOrden: {
    position: 'absolute',
    left: ESPACIO.interno,
    right: ESPACIO.interno,
  },
  // Abierto ocupa como mucho media pantalla: más que eso y deja de ser un panel
  // sobre el mapa para ser otra pantalla tapándolo
  panelAbierto: { maxHeight: '52%' },
  cabeceraPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIO.minimo + 2,
    paddingHorizontal: ESPACIO.canal,
    paddingVertical: ESPACIO.interno,
  },
  tituloPanel: { flex: 1 },
  listaPanel: { paddingHorizontal: ESPACIO.canal, paddingBottom: ESPACIO.interno },
  filaParada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIO.interno,
    paddingVertical: ESPACIO.minimo + 2,
  },
  numero: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datosParada: { flex: 1, gap: 1 },
});
