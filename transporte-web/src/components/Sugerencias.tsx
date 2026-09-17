import { Alert, Button, Group, List, Text } from "@mantine/core";
import { IconBulb } from "@tabler/icons-react";

// ============================================
// SUGERENCIAS DEL PANEL
// ============================================
// Un panel que le dice al admin QUÉ LE FALTA HACER en la pantalla en la que
// está, con el botón para hacerlo al lado.
//
// POR QUÉ EXISTE. El sistema tiene seis entidades que se relacionan entre sí
// (usuarios, buses, rutas, escuelas, canales, niños) y muchas combinaciones
// quedan a medio armar sin que NADA falle: una escuela sin canal de avisos, un
// conductor sin unidad, un niño sin ruta. No hay error, no hay pantalla roja —
// simplemente esa parte del sistema no funciona para alguien, y el admin se
// entera cuando un padre llama a quejarse.
//
// El panel convierte eso en algo visible ANTES de que alguien reclame. Es la
// diferencia entre un sistema que responde y uno que avisa.
//
// TRES REGLAS PARA QUE NO SE VUELVA RUIDO:
//   1. Si no hay nada que sugerir, el panel NO SE DIBUJA. Un cartel que dice
//      "todo en orden" ocupa lugar todos los días para no informar nada, y
//      entrena al ojo a saltearlo — que es justo lo que no queremos el día que
//      sí diga algo.
//   2. Cada sugerencia trae SU ACCIÓN. "Faltan canales" obliga a averiguar
//      dónde se crean; "Faltan canales [Crear el de Mazapán]" no.
//   3. Se nombra lo concreto que falta, no la categoría. "3 escuelas sin
//      canal: Mazapán, San Isidro y El Naranjal" se puede resolver; "hay
//      escuelas sin canal" hay que investigarlo primero.

export interface Sugerencia {
  id: string;
  // Qué falta, en una línea y nombrando lo concreto
  texto: string;
  // Qué hacer al respecto. Si no se pasa, la sugerencia solo informa.
  accion?: { etiqueta: string; alTocar: () => void };
}

export default function Sugerencias({
  titulo = "Sugerencias",
  sugerencias,
}: {
  titulo?: string;
  sugerencias: Sugerencia[];
}) {
  // Regla 1: sin nada que sugerir, no hay panel
  if (sugerencias.length === 0) return null;

  return (
    <Alert
      variant="light"
      color="blue"
      icon={<IconBulb size={18} />}
      title={titulo}
      mb="md"
      radius="md"
    >
      <List spacing="xs" size="sm" listStyleType="none" withPadding={false}>
        {sugerencias.map((s) => (
          <List.Item key={s.id}>
            <Group justify="space-between" wrap="nowrap" gap="sm">
              <Text size="sm">{s.texto}</Text>
              {s.accion && (
                <Button
                  size="compact-sm"
                  variant="light"
                  onClick={s.accion.alTocar}
                  style={{ flexShrink: 0 }}
                >
                  {s.accion.etiqueta}
                </Button>
              )}
            </Group>
          </List.Item>
        ))}
      </List>
    </Alert>
  );
}
