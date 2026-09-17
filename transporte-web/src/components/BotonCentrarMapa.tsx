import { ActionIcon } from "@mantine/core";
import { IconFocusCentered } from "@tabler/icons-react";

// ============================================
// "CENTRAR EL MAPA"
// ============================================
// El botón que reencuadra un mapa del panel. Existe porque los mapas NO se
// reencuadran solos mientras el admin trabaja: si lo hicieran, el mapa saltaría
// cada vez que se agrega un niño a la ruta o cada vez que un bus manda su
// posición (cada 15 s), justo mientras se lo está mirando. Entonces el mapa se
// queda quieto y el admin lo vuelve a su lugar cuando quiere, con un clic.
//
// Es un componente y no cuatro botones sueltos por la misma razón que en el
// móvil: la misma acción tiene que verse y estar en el mismo lugar en los
// cuatro mapas (supervisión, armador de rutas, recorrido de un viaje y el
// selector de ubicación de escuelas, puntos y casas).
//
// Va FUERA del contenedor de Leaflet, sobre un div con `position: relative`.
// Adentro, cada clic sobre el botón sería además un clic sobre el mapa — y en
// el selector de ubicación eso movería el marcador del lugar.
export default function BotonCentrarMapa({
  titulo,
  onClick,
}: {
  // Qué encuadra, dicho concreto ("Centrar el mapa en los buses"). Es el
  // tooltip y también lo que lee un lector de pantalla.
  titulo: string;
  onClick: () => void;
}) {
  return (
    <ActionIcon
      variant="default"
      size="lg"
      // `type="button"` porque varios de estos mapas viven dentro de un
      // formulario (alta de escuela, de punto, de niño): sin esto, el clic lo
      // enviaría.
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      // Por encima de los controles de Leaflet, que llegan hasta 1000
      style={{ position: "absolute", right: 10, top: 10, zIndex: 1000 }}
    >
      <IconFocusCentered size={18} />
    </ActionIcon>
  );
}
