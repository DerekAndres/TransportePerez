// ============================================
// EL MAPA
// ============================================
// Los mapas de la app viven dentro de un WebView — son HTML con Leaflet, un
// mundo aparte que NO ve el tema de React Native Paper. Este archivo es el
// puente: el CSS que hace que ese HTML se vea como el resto de la app.
//
// Existe para que haya UNA sola copia. Hay tres mapas en la app (el bus en
// vivo, el selector de ubicación y el recorrido del conductor) y antes cada uno
// traía sus propios colores escritos a mano; alcanzaba con tocar uno y olvidar
// otro para que dos mapas de la misma app se vieran distintos.
//
// ⚠️ DE DÓNDE SALEN LAS TESELAS, Y POR QUÉ SE CAMBIÓ DE PROVEEDOR (2026-09-08)
//
// Hasta ahora los tres mapas pedían las teselas a `tile.openstreetmap.org`.
// Eso dejó de funcionar: el servidor de OSM empezó a devolver una tesela de
// **403 "Access blocked — App is not following the tile usage policy of
// OpenStreetMap's volunteer-run servers"**. Se verificó bajando la tesela real
// de La Ceiba, con y sin User-Agent de navegador: las dos vuelven bloqueadas.
// O sea que el mapa no se veía mal, se veía el CARTEL DE BLOQUEO.
//
// No es un capricho: la política de uso de OSM dice que sus servidores los
// mantienen voluntarios y no están para el consumo sistemático de una app
// (https://operations.osmfoundation.org/policies/tiles/). Tres pantallas de
// mapa que se recargan solas son exactamente ese caso.
//
// PROVEEDORES EVALUADOS, con la tesela real en la mano:
//   · CARTO → responde 200, pero la imagen trae incrustada la marca de agua
//     "API KEY REQUIRED". Inservible sin cuenta paga.
//   · Stadia / Thunderforest → piden API key.
//   · Esri World Street Map → limpio y sin clave, pero apagado: casi sin verde
//     ni azul, y los edificios apenas se ven. Queda como RESPALDO.
//   · **OpenStreetMap Alemania** (tile.openstreetmap.de, de FOSSGIS e.V.) →
//     responde con el estilo CLÁSICO de OSM, que es justo el que tenía la app
//     antes del bloqueo. Es el que se usa.
//
// ⚠️ RIESGO CONOCIDO: el servidor alemán también es comunitario y tiene su
// propia política de uso. Podría bloquear en el futuro, igual que el oficial.
// Por eso la URL vive en UN solo lugar (acá) y hay una capa de respaldo: si un
// día deja de servir, se cambia una línea y los tres mapas la siguen.
//
// EL MAPA VA CLARO, aunque la app sea oscura. Se probó oscurecerlo (invertido,
// y también con el lienzo "Dark Gray" de Esri) y el resultado fue peor por dos
// motivos: los lienzos oscuros son NEUTROS a propósito —casi sin color y con
// muy poco detalle— y oscurecer un mapa claro apaga justamente lo que sirve,
// que es distinguir una calle de un parque y de un río. Un padre mira este
// mapa diez segundos para reconocer SU barrio; el contraste de color es la
// herramienta principal para eso, y no se sacrifica por coherencia estética.
//
// Lo que sí mantiene la unidad con el resto de la app es lo que va ENCIMA del
// mapa: las cápsulas de vidrio oscuro, la línea de zafiro y las pastillas de
// estado. El mapa es el fondo; la app es lo que flota sobre él.
//
// CONSECUENCIA PARA EL INFORME (hay que anotarla): el informe entregado declara
// "Leaflet / OpenStreetMap". Leaflet SIGUE siendo la librería; lo que cambia es
// el proveedor de teselas, y el motivo es técnico y verificable, no estético:
// el proveedor anterior bloqueó a la aplicación. La atribución de Esri es
// obligatoria y va puesta en el control del mapa.

/**
 * La capa de teselas, en el formato que espera Leaflet.
 *
 * PRINCIPAL — OpenStreetMap Alemania (FOSSGIS e.V.). Es el estilo CLÁSICO de
 * OpenStreetMap, el mismo que tenía la app antes del bloqueo: agua azul,
 * parques verdes, calles amarillas y blancas, edificios y nombres. Se eligió
 * comparando la tesela real de La Ceiba contra las otras opciones: es la única
 * que conserva el color y el detalle que sirven para reconocer un barrio.
 *
 * RESPALDO — Esri World Street Map. Se usa solo si el principal deja de
 * responder. Es más apagado, pero es un servicio comercial y no se cae.
 *
 * ⚠️ EL RESPALDO NO CUBRE EL CASO QUE NOS PASÓ, y conviene saberlo: cuando el
 * servidor oficial de OSM bloqueó a la app, no devolvió un error — devolvió
 * HTTP 200 con una IMAGEN que dice "Access blocked". Para Leaflet eso es una
 * tesela válida, así que `tileerror` no dispara. El respaldo cubre caídas y
 * 404 de verdad; un bloqueo servido como imagen hay que verlo con el ojo.
 */
export const TESELAS = {
  url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
  urlRespaldo:
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  atribucion: "&copy; OpenStreetMap · estilo OSM Deutschland",
  atribucionRespaldo: "&copy; Esri, HERE, Garmin, &copy; OpenStreetMap",
  maxZoom: 19,
} as const;

/** Colores del tema repetidos acá porque el WebView no puede leer `tema.ts` */
export const COLORES_MAPA = {
  obsidiana: '#0F131D',
  zafiro: '#2563EB',
  zafiroClaro: '#60A5FA',
  cian: '#38BDF8',
  ambar: '#F59E0B',
  esmeralda: '#10B981',
  texto: '#DFE2F1',
  textoTenue: '#C3C6D7',
  /** El contorno de las líneas de ruta.
   *  Va BLANCO porque el mapa es claro: es el recurso de todos los navegadores
   *  —un trazo de color con una funda blanca alrededor— y es lo que hace que la
   *  ruta se lea igual de bien sobre una calle, un parque o un río. */
  contorno: '#FFFFFF',
} as const;

/**
 * CSS común a los tres mapas: la entrada animada, las cápsulas de los
 * marcadores y el aspecto de los controles de Leaflet.
 * Se pega dentro del `<style>` de cada mapa.
 */
export const CSS_MAPA = `
    /* Mientras las teselas cargan se ve este color. Es el mismo crema del mapa
       del mapa de OpenStreetMap, así que no hay salto entre el "cargando" y el
       mapa ya dibujado. */
    html, body, #mapa { height: 100%; margin: 0; background: #F2EFE9; }

    /* NINGÚN filtro sobre las teselas: el mapa se muestra tal cual viene, a
       color y con todo su detalle. Cualquier filtro apaga justamente lo que
       sirve — distinguir una calle de un parque y de un río. */
    /* Un velo de obsidiana encima de las teselas para que el gris del mapa
       invertido termine de casar con el azul de la app. Va sobre la capa de
       teselas y debajo de los marcadores, y no recibe toques. */
    /* La atribución de OpenStreetMap: es obligatoria, así que en vez de
       esconderla se la hace legible sobre el fondo oscuro */
    .leaflet-control-attribution {
      background: rgba(255, 255, 255, .82) !important;
      color: #4A4A4A !important;
      font-size: 9px;
    }
    .leaflet-control-attribution a { color: #1D4ED8 !important; }

    /* Las fichas que se abren al tocar un marcador, en vidrio oscuro */
    .leaflet-popup-content-wrapper, .leaflet-popup-tip {
      background: rgba(15, 23, 42, .96) !important;
      color: ${COLORES_MAPA.texto} !important;
      box-shadow: 0 12px 40px rgba(0, 0, 0, .7) !important;
      border: 1px solid rgba(255, 255, 255, .12) !important;
    }
    .leaflet-popup-close-button { color: ${COLORES_MAPA.textoTenue} !important; }

    /* ============================================
       LA ENTRADA DEL MAPA
       ============================================
       El mapa aparece con un fundido y una escala mínima en vez de aparecer de
       golpe. No es adorno: las teselas cargan de a uno y el armado se ve feo:
       primero gris, después parches, después el mapa. Con el contenedor
       invisible hasta que Leaflet avisa que terminó la primera tanda, el
       usuario ve el mapa YA HECHO. La clase "listo" la pone el propio HTML.

       El desenfoque inicial acompaña ese armado: entra apenas borroso y se
       enfoca, que es lo que hace que se lea como una cámara que abre y no como
       un rectángulo que se prende. */
    #mapa {
      opacity: 0;
      transform: scale(1.06);
      filter: blur(6px);
      transition: opacity .7s ease, transform .9s cubic-bezier(.22,.61,.36,1),
                  filter .7s ease;
    }
    #mapa.listo { opacity: 1; transform: scale(1); filter: blur(0); }

    /* ============================================
       MARCADORES EN PASTILLA
       ============================================
       El diseño no usa alfileres sino CÁPSULAS CON NOMBRE: un punto de color y
       el texto al lado, sobre vidrio oscuro. La diferencia es de fondo, no de
       estilo — un alfiler obliga a tocarlo para saber qué es; la cápsula ya lo
       dice. En un mapa que el padre mira diez segundos, eso es todo. */
    .pastilla-mapa {
      display: flex; align-items: center; gap: 7px;
      padding: 6px 11px 6px 9px;
      border-radius: 999px;
      background: rgba(10, 14, 24, .82);
      -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, .16);
      box-shadow: 0 4px 14px rgba(0, 0, 0, .35);
      font: 600 12px/1 -apple-system, 'Segoe UI', Roboto, sans-serif;
      color: ${COLORES_MAPA.texto};
      white-space: nowrap;
      /* El divIcon ancla arriba-izquierda: esto centra la cápsula sobre su
         coordenada real */
      transform: translate(-50%, -50%);
    }
    .pastilla-mapa .punto {
      width: 8px; height: 8px; border-radius: 50%; flex: none;
    }
    .pastilla-mapa .sub {
      font-weight: 500; opacity: .7; margin-left: 2px;
    }

    /* El bus: la única cápsula encendida, y la única que se mueve */
    .pastilla-bus {
      background: rgba(37, 99, 235, .92);
      border-color: rgba(255, 255, 255, .34);
      box-shadow: 0 8px 26px rgba(0, 0, 0, .6), 0 0 22px rgba(37, 99, 235, .7);
      color: #FFFFFF;
      /* La transición hace que el marcador VIAJE hacia la posición nueva en vez
         de saltar. Con actualizaciones cada ~15 s, sin esto el bus teletransporta */
      transition: transform .9s linear;
    }
    .pastilla-bus .punto { background: #FFFFFF; box-shadow: 0 0 8px #FFFFFF; }

    /* El latido alrededor del bus: se ve de un vistazo que la posición está
       viva y no es la última conocida */
    .aura-bus {
      position: absolute; inset: -6px;
      border-radius: 999px; border: 2px solid ${COLORES_MAPA.zafiroClaro};
      animation: latido 2.2s ease-out infinite;
      pointer-events: none;
    }
    @keyframes latido {
      0%   { transform: scale(1);   opacity: .75; }
      100% { transform: scale(1.6); opacity: 0; }
    }

    /* Sobre un mapa CLARO, el halo de color que usa el resto de la app
       ensuciaría el trazo. Acá la ruta se despega con una sombra oscura corta,
       que es lo que hacen los navegadores. */
    .leaflet-overlay-pane { filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .35)); }
`;

/**
 * Script de arranque común a los TRES mapas.
 *
 * ⚠️ ES OBLIGATORIO: el CSS deja `#mapa` en `opacity: 0` y solo se ve cuando
 * algo le agrega la clase "listo". Si un mapa se olvida de incluir esto, queda
 * INVISIBLE para siempre — y como el WebView no da ningún error, parece que el
 * mapa "no funciona". Pasó exactamente eso con el mapa del conductor y con el
 * selector de ubicación, que no tenían la lógica que sí tenía el del padre.
 *
 * Deja `window.entrarMapa()` disponible por si el mapa quiere adelantar la
 * entrada (el del bus la llama cuando termina de cargar la primera tanda de
 * teselas), y de todas formas entra solo a los 1,8 s. Ese respaldo no es
 * opcional: si una tesela no llega, el evento de carga nunca dispara.
 */
export const JS_ENTRADA_MAPA = `
    var yaEntro = false;
    function entrarMapa() {
      if (yaEntro) return;
      yaEntro = true;
      var el = document.getElementById('mapa');
      if (el) el.classList.add('listo');
    }
    window.entrarMapa = entrarMapa;
    setTimeout(entrarMapa, 1800);
`;