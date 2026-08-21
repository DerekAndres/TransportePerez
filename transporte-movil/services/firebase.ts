import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth } from "firebase/auth";
// @ts-expect-error: getReactNativePersistence existe en el build de React Native, pero falta en los typings públicos de firebase v12
import { getReactNativePersistence } from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

// ============================================
// CONEXIÓN CON FIREBASE
// ============================================
// Las credenciales NO están escritas acá: llegan por variables de entorno
// (`.env` en la computadora de Derek, variables del proyecto en EAS cuando se
// compila el APK). Por eso el archivo se puede subir a GitHub sin exponer nada.
//
// CUIDADO AL COMPILAR: `.env` está en .gitignore, así que EAS no lo sube al
// servidor de compilación. Las mismas variables tienen que estar cargadas en
// EAS (`eas env:push preview --path .env`); si faltan, el APK se compila sin
// credenciales. Eso pasó una vez y la app se cerraba sola al abrirla, sin decir
// por qué. De ahí la comprobación de abajo.

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Qué credenciales faltan (vacío = todo en orden). La pantalla raíz
// (app/_layout.tsx) lo consulta y, si falta algo, muestra un aviso explicando
// qué pasa en vez de dejar que la app se cierre sola.
export const CREDENCIALES_FALTANTES: string[] = Object.entries(firebaseConfig)
  .filter(([, valor]) => !valor)
  .map(([clave]) => clave);

export const CONFIGURACION_COMPLETA = CREDENCIALES_FALTANTES.length === 0;

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

// Con AsyncStorage la sesión sobrevive al cerrar y reabrir la app
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});
