import { arrayUnion, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

// ============================================
// EL RECORRIDO DEL VIAJE (un punto por minuto)
// ============================================
// `ubicaciones` guarda solo la ÚLTIMA posición del bus y se pisa cada 15
// segundos: sirve para el mapa en vivo, pero al terminar el viaje no queda
// nada. Esto guarda el CAMINO: un punto por minuto en `recorridos/{viajeId}`,
// para que días después la administración pueda ver por dónde pasó el bus
// ante un reclamo.
//
// Costo: ~60 escrituras por hora de viaje por bus, muy lejos del tope del plan
// gratuito. Y el documento no crece de más: 3 horas son ~180 puntos (~10 KB).
//
// Se usa setDoc con merge + arrayUnion: la primera vez crea el documento con
// sus datos y el primer punto; las siguientes solo agregan. Las reglas solo
// dejan AGREGAR puntos, nunca reemplazar la lista (nadie reescribe el camino).

export async function agregarPuntoRecorrido(
  viaje: { viajeId: string; rutaId: string; busId: string; conductorId: string; fecha: string },
  lat: number,
  lng: number
): Promise<void> {
  await setDoc(
    doc(db, 'recorridos', viaje.viajeId),
    {
      viajeId: viaje.viajeId,
      rutaId: viaje.rutaId,
      busId: viaje.busId,
      conductorId: viaje.conductorId,
      fecha: viaje.fecha,
      // Cinco decimales son ~1 metro: más precisión no aporta y ocupa lugar
      puntos: arrayUnion({
        lat: Number(lat.toFixed(5)),
        lng: Number(lng.toFixed(5)),
        t: Timestamp.now(),
      }),
    },
    { merge: true }
  );
}
