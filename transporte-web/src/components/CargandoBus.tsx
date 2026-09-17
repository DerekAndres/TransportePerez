import { Center, Stack, Text } from "@mantine/core";
import { IconBus } from "@tabler/icons-react";

// ============================================
// EL BUSITO DE CARGANDO
// ============================================
// Reemplaza a la rueda gris de Mantine mientras el panel espera datos. Es la
// misma animación que la app móvil (`components/CargandoBus.tsx` allá), para
// que esperar se sienta igual en las dos mitades del sistema.
//
// No es solo decoración: una rueda no dice nada, y este bus le recuerda al
// admin qué está usando mientras espera. El mensaje opcional dice QUÉ se está
// cargando, que es lo que de verdad acorta la sensación de espera — "Cargando
// las rutas…" se siente más corto que un círculo girando.
//
// El movimiento vive en index.css (`@keyframes carretera-corre` y
// `bus-rebota`), donde además se apaga solo para quien pidió menos animación en
// su sistema operativo.

// Suficientes rayas para cubrir el ancho aunque la fila se desplace
const RAYAS = 14;

export default function CargandoBus({
  texto,
  ancho = 190,
}: {
  texto?: string;
  ancho?: number;
}) {
  return (
    <Center py="xl">
      <Stack align="center" gap={6}>
        <IconBus size={44} stroke={1.5} color="#0A6E67" className="cargando-bus__bus" />

        {/* La carretera: una fila de rayas que se desplaza un paso y reinicia */}
        <div className="cargando-bus__carretera" style={{ width: ancho }}>
          <div className="cargando-bus__rayas">
            {Array.from({ length: RAYAS }).map((_, i) => (
              <span key={i} className="cargando-bus__raya" />
            ))}
          </div>
        </div>

        {texto && (
          <Text size="sm" c="dimmed" mt={4}>
            {texto}
          </Text>
        )}
      </Stack>
    </Center>
  );
}
