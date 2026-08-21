import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, useWindowDimensions } from 'react-native';

// ============================================
// ALTURA DEL TECLADO — cuánto tapa de la pantalla
// ============================================
// Devuelve cuántos píxeles hay que "levantar" el contenido para que el teclado
// no lo tape. Se usa en el chat (la barra de escribir) y en los formularios
// largos.
//
// Por qué un hook propio y no <KeyboardAvoidingView>: en Android el resultado
// depende de cómo esté configurada la ventana, y esta app usa "edge to edge"
// (dibuja detrás de las barras del sistema, ver app.json). En ese modo Android
// muchas veces NO achica la ventana al abrir el teclado, así que
// KeyboardAvoidingView no mueve nada y el campo de texto queda tapado — que es
// exactamente el problema que se reportó. Acá se resuelve midiendo las dos
// cosas y compensando solo lo que falta:
//
//   alto del teclado  −  lo que la ventana YA se achicó  =  lo que hay que subir
//
//   - iPhone y Android edge-to-edge: la ventana no cambia → se sube todo.
//   - Android que sí redimensiona: la ventana ya se achicó → no se sube nada
//     (si no, el campo saltaría el doble de alto).
//
// Así funciona igual en cualquier teléfono sin agregar ninguna librería.
export function useAlturaTeclado(): number {
  const { height: altoVentana } = useWindowDimensions();
  const [altoTeclado, setAltoTeclado] = useState(0);
  // Alto de la ventana con el teclado cerrado, que es la referencia para saber
  // si el sistema la redimensionó
  const altoLibre = useRef(altoVentana);

  useEffect(() => {
    if (altoTeclado === 0) altoLibre.current = altoVentana;
  }, [altoVentana, altoTeclado]);

  useEffect(() => {
    // En iOS los eventos "will" empiezan junto con la animación del teclado, así
    // el contenido sube acompañándolo. Android solo tiene los "did".
    const eventoAbre = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const eventoCierra = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const abre = Keyboard.addListener(eventoAbre, (e) => setAltoTeclado(e.endCoordinates.height));
    const cierra = Keyboard.addListener(eventoCierra, () => setAltoTeclado(0));

    return () => {
      abre.remove();
      cierra.remove();
    };
  }, []);

  if (altoTeclado === 0) return 0;

  // Cuánto se achicó la ventana al abrirse el teclado (0 si no se achicó)
  const yaCompensado = Math.max(0, altoLibre.current - altoVentana);
  return Math.max(0, altoTeclado - yaCompensado);
}
