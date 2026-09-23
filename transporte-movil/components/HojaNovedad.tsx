import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import HojaInferior from '@/components/HojaInferior';
import BotonPrincipal from '@/components/BotonPrincipal';
import Campo from '@/components/Campo';
import { ESPACIO, RADIO, VIDRIO, estilosBase } from '@/constants/estilos';
import { AMBAR } from '@/constants/tema';
import { TIPOS_INCIDENCIA } from '@/services/incidenciasService';
import type { TipoIncidencia } from '@/types/models';

// ============================================
// AVISAR UNA NOVEDAD
// ============================================
// Lo que pasa a mitad de viaje y no es una marca de asistencia: se pinchó una
// rueda, hay un tranque, se largó a llover.
//
// EL CONDUCTOR ESTÁ MANEJANDO. Todo el diseño sale de ahí:
//
// 1. ES UNA HOJA QUE SUBE DESDE ABAJO, no un cuadro en el medio: el pulgar
//    llega sin cambiar la mano de posición (components/HojaInferior.tsx).
// 2. CINCO OPCIONES GRANDES, de 64 px, con su ícono en un cuadro de color. Se
//    tocan sin apuntar. Antes eran renglones de 48 px casi iguales entre sí.
// 3. LA ELEGIDA SE VE ELEGIDA: se pinta en ámbar —el color de "pide atención"
//    en toda la app— con su borde encendido, no solo con un tilde chiquito.
// 4. SE MUESTRA LO QUE VAN A LEER LOS PADRES. Es lo más importante que se
//    agregó: el conductor elige "Problema con la unidad" y ve, textual, el
//    mensaje que les va a llegar ("Los niños están bien; la ruta va a
//    demorarse"). Sin eso está mandando a ciegas un aviso a decenas de
//    familias, y el miedo a asustar a alguien es la razón por la que un
//    conductor no reporta nada.
// 5. EL DETALLE ES OPCIONAL Y VA AL FINAL. Si fuera obligatorio, nadie avisaría.
//
// El estado (qué tipo eligió, qué escribió) vive en la pantalla del conductor y
// no acá: esta hoja solo dibuja y avisa qué tocó, así el envío y el cálculo de
// quiénes van a bordo quedan donde están los datos del viaje.

export default function HojaNovedad({
  visible,
  ninosABordo,
  tipo,
  onElegirTipo,
  texto,
  onCambiarTexto,
  enviando,
  onCerrar,
  onEnviar,
}: {
  visible: boolean;
  // Cuántos niños van ARRIBA del bus ahora: son los padres que van a recibir el aviso
  ninosABordo: number;
  tipo: TipoIncidencia | null;
  onElegirTipo: (tipo: TipoIncidencia) => void;
  texto: string;
  onCambiarTexto: (texto: string) => void;
  enviando: boolean;
  onCerrar: () => void;
  onEnviar: () => void;
}) {
  const tema = useTheme();
  const elegido = TIPOS_INCIDENCIA.find((t) => t.tipo === tipo);

  return (
    <HojaInferior visible={visible} onCerrar={onCerrar} conTeclado>
      {/* ============ 1. QUÉ ES ESTO Y A QUIÉN LE LLEGA ============ */}
      <View style={styles.encabezado}>
        <View style={styles.circuloTitulo}>
          <MaterialCommunityIcons name="alert-outline" size={22} color={tema.colors.tertiary} />
        </View>
        <View style={styles.textoTitulo}>
          <Text variant="titleLarge">Avisar una novedad</Text>
          {/* Con el bus vacío se dice la verdad en vez de "a los 0 niños" */}
          <Text variant="bodySmall" style={estilosBase.tenue}>
            {ninosABordo > 0
              ? `Les llega a los padres de los ${ninosABordo} ${
                  ninosABordo === 1 ? 'niño que va' : 'niños que van'
                } a bordo y a la administración.`
              : 'Ahora no hay niños a bordo: le llega solo a la administración.'}
          </Text>
        </View>
      </View>

      {/* ============ 2. QUÉ PASÓ ============ */}
      <View style={styles.opciones}>
        {TIPOS_INCIDENCIA.map((t) => {
          const activo = t.tipo === tipo;
          return (
            <TouchableRipple
              key={t.tipo}
              onPress={() => onElegirTipo(t.tipo)}
              borderless
              style={styles.opcion}
              accessibilityRole="radio"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={t.etiqueta}
            >
              <View
                style={[
                  styles.filaOpcion,
                  activo ? styles.filaElegida : styles.filaNormal,
                ]}
              >
                <View
                  style={[
                    styles.iconoOpcion,
                    {
                      backgroundColor: activo
                        ? 'rgba(245, 158, 11, 0.20)'
                        : 'rgba(255, 255, 255, 0.06)',
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={t.icono as keyof typeof MaterialCommunityIcons.glyphMap}
                    size={22}
                    color={activo ? tema.colors.tertiary : tema.colors.onSurfaceVariant}
                  />
                </View>
                <Text variant="titleSmall" style={styles.etiquetaOpcion}>
                  {t.etiqueta}
                </Text>
                {activo && (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={22}
                    color={tema.colors.tertiary}
                  />
                )}
              </View>
            </TouchableRipple>
          );
        })}
      </View>

      {/* ============ 3. LO QUE VAN A LEER LOS PADRES ============ */}
      {/* Solo si hay alguien a bordo: si no le llega a ningún padre, mostrar
          "lo que van a leer" sería mentir sobre lo que hace el botón */}
      {!!elegido && ninosABordo > 0 && (
        <View style={styles.previa}>
          <Text variant="labelSmall" style={{ color: tema.colors.tertiary }}>
            LO QUE VAN A LEER LOS PADRES
          </Text>
          <Text variant="bodyMedium" style={styles.textoPrevia}>
            “{elegido.avisoAlPadre}”
          </Text>
        </View>
      )}

      {/* ============ 4. EL DETALLE, OPCIONAL ============ */}
      <Campo
        label="Detalle (opcional)"
        value={texto}
        onChangeText={onCambiarTexto}
        multiline
        numberOfLines={2}
        style={styles.campo}
      />

      {/* ============ 5. LAS ACCIONES ============ */}
      <View style={styles.acciones}>
        <View style={styles.accion}>
          <BotonPrincipal
            texto="Cancelar"
            icono="close"
            tono="suave"
            onPress={onCerrar}
            deshabilitado={enviando}
          />
        </View>
        <View style={styles.accion}>
          <BotonPrincipal
            texto="Avisar"
            icono="bullhorn"
            tono="aviso"
            onPress={onEnviar}
            cargando={enviando}
            deshabilitado={enviando || !tipo}
            accesibilidad={
              elegido ? `Avisar: ${elegido.etiqueta}` : 'Elegí primero qué pasó'
            }
          />
        </View>
      </View>
    </HojaInferior>
  );
}

const styles = StyleSheet.create({
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: ESPACIO.interno },
  circuloTitulo: {
    width: 44,
    height: 44,
    borderRadius: RADIO.pastilla,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
  },
  textoTitulo: { flex: 1, gap: 2 },

  opciones: { gap: ESPACIO.minimo },
  opcion: { borderRadius: RADIO.control },
  filaOpcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIO.interno,
    paddingHorizontal: ESPACIO.interno,
    // 64 px: se toca sin mirar, con el bus en movimiento
    minHeight: 64,
    borderRadius: RADIO.control,
    borderWidth: 1,
  },
  filaNormal: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: VIDRIO.borde },
  filaElegida: { backgroundColor: 'rgba(245, 158, 11, 0.14)', borderColor: AMBAR },
  iconoOpcion: {
    width: 40,
    height: 40,
    borderRadius: RADIO.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etiquetaOpcion: { flex: 1 },

  previa: {
    gap: 3,
    padding: ESPACIO.interno,
    borderRadius: RADIO.control,
    backgroundColor: 'rgba(245, 158, 11, 0.10)',
    borderLeftWidth: 3,
    borderLeftColor: AMBAR,
  },
  // En cursiva y entre comillas: se lee como una cita textual de lo que le va a
  // llegar al padre, no como texto de la app
  textoPrevia: { fontStyle: 'italic', lineHeight: 20 },

  campo: { maxHeight: 120 },
  acciones: { flexDirection: 'row', gap: 10, marginTop: 2 },
  accion: { flex: 1 },
});
