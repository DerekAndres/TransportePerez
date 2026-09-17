import { useEffect, useRef } from "react";

// ============================================
// CIERRE DE SESIÓN POR INACTIVIDAD
// ============================================
// El panel muestra datos de niños y familias: dónde viven, sus fotos, sus
// teléfonos. Firebase deja la sesión abierta en el navegador para siempre, así
// que en una computadora compartida de oficina, cualquiera que se sentara tenía
// el panel completo. Ahora, pasados MINUTOS_INACTIVIDAD sin tocar el mouse ni el
// teclado, la sesión se cierra sola.
//
// La última actividad se guarda en localStorage (no en memoria) por dos razones:
//   - se comparte entre pestañas: trabajar en una mantiene viva la otra;
//   - sobrevive a cerrar el navegador: quien vuelve al día siguiente encuentra la
//     sesión cerrada, no abierta.
//
// Una hora y no menos: el admin puede dejar el mapa de Supervisión mirando los
// buses durante una ruta de la mañana. Es una constante: se cambia acá.

export const MINUTOS_INACTIVIDAD = 60;

const CLAVE = "panel.ultimaActividad";
const LIMITE_MS = MINUTOS_INACTIVIDAD * 60 * 1000;
// No se escribe en cada movimiento del mouse: una vez cada 30 segundos alcanza
const INTERVALO_ESCRITURA_MS = 30 * 1000;

export function registrarActividad(): void {
  try {
    localStorage.setItem(CLAVE, String(Date.now()));
  } catch {
    // Sin almacenamiento local: el cierre por inactividad no funciona, el panel sí
  }
}

function ultimaActividad(): number {
  try {
    const valor = localStorage.getItem(CLAVE);
    // Sin marca guardada (primera vez con esta versión) cuenta como "recién"
    return valor ? Number(valor) : Date.now();
  } catch {
    return Date.now();
  }
}

export function useCierrePorInactividad(alVencer: () => void): void {
  // El callback vive en un ref: así el efecto de abajo se monta una sola vez y
  // no reinicia la cuenta cada vez que la pantalla se vuelve a dibujar
  const alVencerRef = useRef(alVencer);
  useEffect(() => {
    alVencerRef.current = alVencer;
  });

  useEffect(() => {
    let yaVencio = false;
    const vencer = () => {
      if (yaVencio) return;
      yaVencio = true;
      alVencerRef.current();
    };

    // Al entrar o recargar: si la última actividad es de hace mucho, se cierra ya
    if (Date.now() - ultimaActividad() > LIMITE_MS) {
      vencer();
      return;
    }
    registrarActividad();

    let ultimaEscritura = Date.now();
    const alUsar = () => {
      const ahora = Date.now();
      if (ahora - ultimaEscritura < INTERVALO_ESCRITURA_MS) return;
      ultimaEscritura = ahora;
      registrarActividad();
    };

    const eventos = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    eventos.forEach((e) => window.addEventListener(e, alUsar, { passive: true }));
    const reloj = window.setInterval(() => {
      if (Date.now() - ultimaActividad() > LIMITE_MS) vencer();
    }, 60 * 1000);

    return () => {
      eventos.forEach((e) => window.removeEventListener(e, alUsar));
      window.clearInterval(reloj);
    };
  }, []);
}
