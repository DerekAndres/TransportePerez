import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

// ============================================
// Fotos de perfil SIN Firebase Storage
// ============================================
// Firebase Storage exige el plan Blaze (de pago) en proyectos nuevos, y este
// proyecto es solo plan Spark. Decisión: las fotos se comprimen a ~300 px de
// ancho y se guardan como data-URI base64 DENTRO del documento de Firestore
// (usuarios, ninos o buses). Una foto así pesa ~40-60 KB, muy por debajo del
// límite de 1 MB por documento, y a la escala de esta empresa funciona bien.

const ANCHO_MAXIMO = 300;
const CALIDAD_JPEG = 0.6;

// Abre la galería, deja recortar cuadrado, comprime y devuelve el data-URI
// listo para guardar en Firestore. Devuelve null si el usuario canceló.
export async function elegirFotoComprimida(): Promise<string | null> {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) return null;

  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true, // recorte cuadrado del propio sistema
    aspect: [1, 1],
    quality: 1, // la compresión real la hace el manipulador abajo
  });
  if (resultado.canceled || resultado.assets.length === 0) return null;

  const contexto = ImageManipulator.ImageManipulator.manipulate(resultado.assets[0].uri);
  contexto.resize({ width: ANCHO_MAXIMO });
  const imagen = await contexto.renderAsync();
  const guardada = await imagen.saveAsync({
    compress: CALIDAD_JPEG,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });

  if (!guardada.base64) return null;
  return `data:image/jpeg;base64,${guardada.base64}`;
}
