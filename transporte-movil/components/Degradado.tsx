import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { NOCHE_OBSIDIANA } from '@/constants/tema';

// ============================================
// DEGRADADO
// ============================================
// Pinta una transición suave entre varios colores. Lo usan el fondo de todas
// las pantallas (la "noche obsidiana"), la portada de arranque y las cabeceras
// grandes.
//
// NOTA PARA LA DEFENSA — POR QUÉ ESTE ARCHIVO CAMBIÓ:
// antes acá había un degradado hecho a mano, apilando decenas de franjas de
// colores intermedios, para no sumar una dependencia. Funcionaba, pero tenía
// dos límites que el diseño nuevo vuelve insalvables:
//
//   1. Solo sabía hacer degradados VERTICALES. El sistema "Liquid Obsidian"
//      pide degradados en DIAGONAL (135° y 165°) en cada lámina de vidrio y en
//      el botón principal — es lo que simula una superficie curva tomando la
//      luz. Con franjas horizontales eso no se puede dibujar.
//   2. Cada degradado eran entre 20 y 32 vistas de verdad. La app ahora dibuja
//      un degradado por lámina, no uno por pantalla: hubiera pasado de ~20
//      vistas a varios cientos, justo en los teléfonos de gama baja que tienen
//      los padres (CLAUDE.md §2).
//
// `expo-linear-gradient` lo resuelve con UNA vista dibujada por el sistema
// operativo. Es un paquete oficial de Expo, ya viene compilado en Expo Go y no
// necesita configuración nativa.

export default function Degradado({
  colores = NOCHE_OBSIDIANA,
  inicio = { x: 0, y: 0 },
  fin = { x: 0, y: 1 },
  style,
  pointerEvents,
  children,
}: {
  // Por defecto, el fondo de la app (constants/tema.ts)
  colores?: readonly string[];
  // Por dónde entra y por dónde sale el degradado, en proporciones de 0 a 1
  // sobre el contenedor. {0,0}→{0,1} es de arriba abajo; {0,0}→{1,1}, diagonal.
  inicio?: { x: number; y: number };
  fin?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
  // 'none' cuando el degradado se usa como CAPA DE FONDO detrás del contenido:
  // sin esto se comería los toques de lo que tiene encima
  pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only';
  children?: ReactNode;
}) {
  return (
    <LinearGradient
      // El tipo de expo-linear-gradient pide al menos dos colores; todas las
      // paletas del tema los tienen, y el `as` evita pedirle a cada pantalla que
      // lo demuestre.
      colors={colores as readonly [string, string, ...string[]]}
      start={inicio}
      end={fin}
      style={[styles.base, style]}
      pointerEvents={pointerEvents}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // Sin esto, un degradado sin hijos colapsa a alto cero
  base: { flexGrow: 0 },
});
