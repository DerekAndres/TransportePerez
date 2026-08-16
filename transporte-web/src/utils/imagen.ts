// Comprime una imagen elegida en el navegador a un data-URI base64 chico,
// usando un <canvas> (sin librerías). Mismo criterio que el móvil: las fotos
// viven dentro del documento de Firestore porque Firebase Storage exige plan
// Blaze y este proyecto es solo Spark.

const CALIDAD_JPEG = 0.6;

export async function comprimirImagen(archivo: File, anchoMaximo = 480): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const imagen = await new Promise<HTMLImageElement>((resolver, rechazar) => {
      const img = new Image();
      img.onload = () => resolver(img);
      img.onerror = () => rechazar(new Error("No se pudo leer la imagen"));
      img.src = url;
    });

    // Escala manteniendo la proporción; si ya es chica, no se agranda
    const escala = Math.min(1, anchoMaximo / imagen.width);
    const ancho = Math.round(imagen.width * escala);
    const alto = Math.round(imagen.height * escala);

    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const contexto = lienzo.getContext("2d");
    if (!contexto) throw new Error("Canvas no disponible");
    contexto.drawImage(imagen, 0, 0, ancho, alto);

    return lienzo.toDataURL("image/jpeg", CALIDAD_JPEG);
  } finally {
    URL.revokeObjectURL(url);
  }
}
