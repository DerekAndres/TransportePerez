// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // ============================================
    // DOS REGLAS BAJADAS A "AVISO" (no error)
    // ============================================
    // Las trajo el ESLint de Expo SDK 57. Las dos vienen del React Compiler y
    // marcan patrones que en esta app son correctos y están documentados por
    // React Native. Se dejan como AVISO —siguen apareciendo en la consola, no
    // se ocultan— pero no cortan la verificación.
    //
    // 'react-hooks/refs' — "no leas un ref durante el render".
    //   La app anima con `useRef(new Animated.Value(0)).current`, que es
    //   EXACTAMENTE el patrón que enseña la documentación de React Native para
    //   animaciones: el valor tiene que sobrevivir a los redibujos sin
    //   reiniciarse. Se usa en la portada de arranque y en la barra de abajo.
    //   La regla no distingue ese caso de un ref de datos.
    //
    // 'react-hooks/set-state-in-effect' — "no cambies estado dentro de un
    //   efecto".
    //   La app carga datos de Firestore en un efecto y guarda el resultado en
    //   el estado. Es el flujo normal de cualquier pantalla que lee de una base
    //   de datos remota, y está protegido con la bandera `cancelado` para no
    //   escribir estado después de desmontarse.
    //
    // Si en el futuro se quiere dejarlas en error, el camino es migrar las
    // animaciones al hook `useAnimatedValue` de React Native y mover las cargas
    // a un hook de datos. No se hizo ahora para no tocar código ya probado.
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
