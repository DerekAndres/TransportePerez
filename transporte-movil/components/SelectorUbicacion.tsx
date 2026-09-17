import { useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import BotonMapa from '@/components/BotonMapa';
import { COLORES_MAPA, CSS_MAPA, JS_ENTRADA_MAPA, TESELAS } from '@/constants/mapa';

// ============================================
// SELECTOR DE UBICACIÓN (formularios del padre)
// ============================================
// Marcar una casa en un mapa desde el teléfono es incómodo si hay que ACERTARLE
// con el dedo a un punto exacto en un mapa chico embebido en un formulario: el
// dedo tapa el lugar y los arrastres se los roba el scroll de la pantalla.
//
// Por eso acá se usan las dos soluciones que aplican las apps de mapas:
//
//   1. "Usar mi ubicación actual": el padre casi siempre llena este formulario
//      DESDE su casa, así que un botón de GPS resuelve el caso normal sin tocar
//      el mapa una sola vez.
//   2. Pin fijo en el centro y el mapa se mueve por debajo: no hay que acertarle
//      a nada, se arrastra hasta que el pin quede en el lugar. Y se hace a
//      PANTALLA COMPLETA, en un modal, para que ningún scroll compita con el
//      dedo mientras se ajusta.
//
// En el formulario solo queda una vista previa que no se puede tocar, así que
// desplazar la pantalla nunca mueve el mapa por accidente.

// Centro por defecto: La Ceiba, Atlántida
const CENTRO_LA_CEIBA = { lat: 15.7597, lng: -86.7822 };

// Zoom al que se abre el mapa cuando ya sabemos dónde estamos parados
const ZOOM_CERCA = 17;

interface Coordenada {
  lat: number;
  lng: number;
}

// --- Vista previa: el lugar ya elegido, sin interacción ---
function htmlVistaPrevia(lat: number, lng: number) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    /* Teselas oscuras compartidas con los otros mapas (constants/mapa.ts) */
    ${CSS_MAPA}
    /* La misma burbuja de vidrio que el mapa del bus, con borde cian: acá el
       marcador señala un DATO de ubicación, no un estado de un niño */
    .burbuja {
      width: 40px; height: 40px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px;
      background: rgba(15, 23, 42, .92);
      border: 2px solid ${COLORES_MAPA.cian};
      box-shadow: 0 4px 14px rgba(0, 0, 0, .6), 0 0 12px rgba(56, 189, 248, .45);
      box-sizing: border-box;
    }
  </style>
</head>
<body>
  <div id="mapa"></div>
  <script>
    // Todo desactivado: es una foto del lugar, no un control
    ${JS_ENTRADA_MAPA}

    var mapa = L.map('mapa', {
      zoomControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false,
      doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false,
      attributionControl: false
    }).setView([${lat}, ${lng}], ${ZOOM_CERCA});
    L.tileLayer('${TESELAS.url}', {
      attribution: '${TESELAS.atribucion}',
      maxZoom: ${TESELAS.maxZoom}
    }).addTo(mapa);
    L.marker([${lat}, ${lng}], {
      icon: L.divIcon({ className: '', html: '<div class="burbuja">📍</div>', iconSize: [40, 40], iconAnchor: [20, 20] })
    }).addTo(mapa);
  </script>
</body>
</html>`;
}

// --- Mapa a pantalla completa: se mueve el mapa, el pin queda fijo en el centro ---
// El pin NO se dibuja acá: es una vista de React Native encima del WebView,
// perfectamente centrada. Así siempre coincide con el centro real del mapa.
function htmlSelector(lat: number, lng: number, zoom: number) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    /* Teselas oscuras compartidas con los otros mapas (constants/mapa.ts) */
    ${CSS_MAPA}
  </style>
</head>
<body>
  <div id="mapa"></div>
  <script>
    ${JS_ENTRADA_MAPA}

    var mapa = L.map('mapa', { zoomControl: false }).setView([${lat}, ${lng}], ${zoom});
    L.tileLayer('${TESELAS.url}', {
      attribution: '${TESELAS.atribucion}',
      maxZoom: ${TESELAS.maxZoom}
    }).addTo(mapa);


    // Cada vez que el mapa deja de moverse, se avisa a React Native cuál quedó
    // siendo el centro: esa es la coordenada que el pin está marcando.
    function avisarCentro() {
      var c = mapa.getCenter();
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: c.lat, lng: c.lng }));
    }
    mapa.on('moveend', avisarCentro);

    // Tocar un lugar también sirve: en vez de clavar el marcador ahí (que exige
    // puntería), se desplaza el mapa para que ESE punto quede bajo el pin.
    mapa.on('click', function (e) { mapa.panTo(e.latlng); });

    // React Native pide centrar el mapa (botón "Mi ubicación")
    function recibirMensaje(evento) {
      try {
        var datos = JSON.parse(evento.data);
        if (datos.accion === 'centrar') {
          mapa.setView([datos.lat, datos.lng], datos.zoom || ${ZOOM_CERCA});
        }
      } catch (e) { /* mensaje no reconocido: se ignora */ }
    }
    // iOS entrega los mensajes en window; Android en document — se escuchan ambos
    window.addEventListener('message', recibirMensaje);
    document.addEventListener('message', recibirMensaje);

    avisarCentro();
  </script>
</body>
</html>`;
}

export default function SelectorUbicacion({
  valor,
  onCambio,
  etiqueta,
}: {
  valor: Coordenada | null;
  onCambio: (lat: number, lng: number) => void;
  etiqueta?: string;
}) {
  const tema = useTheme();
  const insets = useSafeAreaInsets();

  const [abierto, setAbierto] = useState(false);
  // HTML del mapa grande: se arma UNA vez al abrir. Si se regenerara con cada
  // movimiento, el mapa se reiniciaría a cada rato.
  const [htmlModal, setHtmlModal] = useState('');
  // Centro actual del mapa grande = lo que el pin está marcando
  const [centro, setCentro] = useState<Coordenada>(valor ?? CENTRO_LA_CEIBA);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [aviso, setAviso] = useState('');

  const webviewRef = useRef<WebView>(null);
  // El WebView tarda en cargar: si se pide centrar antes, el mensaje se pierde.
  // Se guarda pendiente y se manda apenas el mapa está listo.
  const listoRef = useRef(false);
  const pendienteRef = useRef<Coordenada | null>(null);

  const enviarPendiente = () => {
    if (!listoRef.current || !pendienteRef.current) return;
    webviewRef.current?.postMessage(
      JSON.stringify({ accion: 'centrar', ...pendienteRef.current, zoom: ZOOM_CERCA })
    );
    pendienteRef.current = null;
  };

  const centrarEn = (lat: number, lng: number) => {
    setCentro({ lat, lng });
    pendienteRef.current = { lat, lng };
    enviarPendiente();
  };

  // Pide el GPS del teléfono. Es el camino rápido: el padre llena esto en su casa.
  const ubicarme = async () => {
    setBuscandoGps(true);
    setAviso('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAviso('No diste permiso de ubicación. Podés marcar el lugar moviendo el mapa.');
        return;
      }
      const posicion = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      centrarEn(posicion.coords.latitude, posicion.coords.longitude);
    } catch {
      setAviso('No se pudo obtener tu ubicación. Marcá el lugar moviendo el mapa.');
    } finally {
      setBuscandoGps(false);
    }
  };

  const abrirMapa = () => {
    const inicio = valor ?? CENTRO_LA_CEIBA;
    setCentro(inicio);
    setHtmlModal(htmlSelector(inicio.lat, inicio.lng, valor ? ZOOM_CERCA : 13));
    listoRef.current = false;
    pendienteRef.current = null;
    setAviso('');
    setAbierto(true);
    // Sin lugar previo, se arranca buscando dónde está parado el usuario
    if (!valor) ubicarme();
  };

  const confirmar = () => {
    onCambio(centro.lat, centro.lng);
    setAbierto(false);
  };

  // Desde el formulario, el GPS puede fijar el lugar sin abrir el mapa siquiera
  const usarMiUbicacionDirecto = async () => {
    setBuscandoGps(true);
    setAviso('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setAviso('No diste permiso de ubicación. Usá "Marcar en el mapa".');
        return;
      }
      const posicion = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      onCambio(posicion.coords.latitude, posicion.coords.longitude);
    } catch {
      setAviso('No se pudo obtener tu ubicación. Usá "Marcar en el mapa".');
    } finally {
      setBuscandoGps(false);
    }
  };

  return (
    <View style={styles.contenedor}>
      {!!etiqueta && (
        <Text variant="bodySmall" style={styles.etiqueta}>
          {etiqueta}
        </Text>
      )}

      {/* Vista previa (o hueco si todavía no se eligió). No recibe toques: así
          desplazar el formulario nunca mueve el mapa sin querer. */}
      <View
        style={[styles.marcoPrevia, { borderColor: tema.colors.outlineVariant }]}
        pointerEvents="none"
      >
        {valor ? (
          <WebView
            source={{ html: htmlVistaPrevia(valor.lat, valor.lng) }}
            style={styles.previa}
            scrollEnabled={false}
          />
        ) : (
          <View style={[styles.vacio, { backgroundColor: tema.colors.surfaceVariant }]}>
            <Text variant="bodySmall" style={styles.dimmed}>
              Todavía no marcaste el lugar
            </Text>
          </View>
        )}
      </View>

      <View style={styles.filaBotones}>
        <Button
          mode="contained-tonal"
          icon="crosshairs-gps"
          onPress={usarMiUbicacionDirecto}
          loading={buscandoGps && !abierto}
          disabled={buscandoGps && !abierto}
          style={styles.boton}
        >
          Estoy aquí
        </Button>
        <Button mode="outlined" icon="map-search" onPress={abrirMapa} style={styles.boton}>
          {valor ? 'Ajustar' : 'Marcar en el mapa'}
        </Button>
      </View>

      {aviso !== '' && (
        <Text variant="bodySmall" style={{ color: tema.colors.error }}>
          {aviso}
        </Text>
      )}
      <Text variant="bodySmall" style={styles.dimmed}>
        {valor
          ? '✓ Lugar marcado'
          : 'Tocá "Estoy aquí" si estás en el lugar, o marcalo en el mapa.'}
      </Text>

      {/* --- Mapa a pantalla completa --- */}
      <Modal
        visible={abierto}
        animationType="slide"
        onRequestClose={() => setAbierto(false)}
        statusBarTranslucent
      >
        <View style={[styles.modal, { backgroundColor: tema.colors.background }]}>
          <View style={[styles.mapaGrande, { marginTop: insets.top }]}>
            <WebView
              ref={webviewRef}
              source={{ html: htmlModal }}
              style={styles.webviewGrande}
              onLoadEnd={() => {
                listoRef.current = true;
                enviarPendiente();
              }}
              onMessage={(evento) => {
                try {
                  const datos = JSON.parse(evento.nativeEvent.data);
                  if (typeof datos.lat === 'number' && typeof datos.lng === 'number') {
                    setCentro({ lat: datos.lat, lng: datos.lng });
                  }
                } catch {
                  // mensaje no reconocido: se ignora
                }
              }}
            />

            {/* El pin: fijo en el centro exacto, por encima del mapa. El punto
                de abajo es la coordenada real; la burbuja va justo arriba. */}
            <View style={styles.capaPin} pointerEvents="none">
              <View style={styles.grupoPin}>
                <View style={styles.burbujaPin}>
                  <Text style={styles.emojiPin}>📍</Text>
                </View>
                <View style={[styles.puntoExacto, { backgroundColor: tema.colors.tertiary }]} />
              </View>
            </View>

            {/* Los botones que acomodan el mapa, los mismos de toda la app
                (components/BotonMapa.tsx): ir a donde estoy parado y, si ya
                había un lugar marcado, volver a él después de haber movido el
                mapa buscando. */}
            <View style={styles.controles}>
              {!!valor && (
                <BotonMapa
                  icono="map-marker-check"
                  accesibilidad="Volver al lugar ya marcado"
                  onPress={() => centrarEn(valor.lat, valor.lng)}
                />
              )}
              <BotonMapa
                icono="crosshairs-gps"
                cargando={buscandoGps}
                accesibilidad="Centrar el mapa en mi ubicación"
                onPress={ubicarme}
              />
            </View>
          </View>

          {/* Barra inferior: instrucción y confirmación */}
          <View style={[styles.barraInferior, { paddingBottom: insets.bottom + 12 }]}>
            <Text variant="bodyMedium" style={styles.instruccion}>
              Movés el mapa hasta que el pin quede en el lugar
            </Text>
            {aviso !== '' && (
              <Text variant="bodySmall" style={{ color: tema.colors.error }}>
                {aviso}
              </Text>
            )}
            <View style={styles.filaBotones}>
              <Button mode="outlined" onPress={() => setAbierto(false)} style={styles.boton}>
                Cancelar
              </Button>
              <Button mode="contained" icon="check" onPress={confirmar} style={styles.boton}>
                Confirmar
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: 8 },
  etiqueta: { opacity: 0.7 },
  dimmed: { opacity: 0.6 },
  marcoPrevia: { height: 160, borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  previa: { flex: 1, backgroundColor: 'transparent' },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filaBotones: { flexDirection: 'row', gap: 8 },
  boton: { flex: 1 },

  // --- pantalla completa ---
  modal: { flex: 1 },
  mapaGrande: { flex: 1, position: 'relative' },
  webviewGrande: { flex: 1, backgroundColor: 'transparent' },
  // React Native 0.86 quitó `StyleSheet.absoluteFillObject`, así que las cuatro
  // posiciones van escritas: la capa del pin cubre todo el mapa y centra su
  // contenido
  capaPin: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sube el grupo media burbuja para que el PUNTO quede en el centro exacto
  // (burbuja 44 + punto 8 = 52 de alto; centrado y subido 22 → el punto cae justo)
  grupoPin: { alignItems: 'center', transform: [{ translateY: -22 }] },
  // La misma burbuja de vidrio que usan los marcadores DENTRO del mapa
  // (ver constants/mapa.ts). Acá se dibuja con React Native y no con HTML,
  // porque este pin va fijo en el centro de la pantalla mientras el mapa se
  // mueve por debajo — pero tiene que verse idéntico a los otros.
  burbujaPin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderWidth: 2,
    borderColor: COLORES_MAPA.cian,
    shadowColor: COLORES_MAPA.cian,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  emojiPin: { fontSize: 21 },
  puntoExacto: { width: 8, height: 8, borderRadius: 4 },
  // Abajo a la derecha, donde llega el pulgar. Los 30 px de abajo dejan a la
  // vista la atribución de OpenStreetMap, que es obligatoria.
  controles: { position: 'absolute', right: 14, bottom: 30, gap: 10, alignItems: 'flex-end' },
  barraInferior: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  instruccion: { textAlign: 'center', opacity: 0.75 },
});
