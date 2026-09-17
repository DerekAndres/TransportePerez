import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import PantallaBase from '@/components/PantallaBase';
import ListaAvisos from '@/components/ListaAvisos';
import CargandoBus from '@/components/CargandoBus';
import { escucharAvisosDeCanales, listarCanalesDeEscuelas } from '@/services/canalesService';
import { escucharRutasDeBuses, obtenerUnidadesDelDia } from '@/services/conductorService';
import { estilosBase } from '@/constants/estilos';
import type { Aviso, Canal } from '@/types/models';

// ============================================
// AVISOS DEL CONDUCTOR
// ============================================
// Los mismos comunicados que ve el padre, pero de las escuelas A LAS QUE ÉL
// LLEVA. Es la pantalla nueva de esta sección, y el motivo es concreto: un
// aviso como "mañana no hay clases" o "salida temprano por reunión" le cambia
// el día de trabajo al conductor tanto como al padre, y hasta ahora se enteraba
// por un mensaje suelto de la administración, o no se enteraba.
//
// NO ve todos los canales de la empresa: solo los de las escuelas de las rutas
// de las unidades que maneja HOY (incluida la que esté cubriendo por una
// suplencia). Con eso alcanza y no se le llena la pantalla de comunicados de
// escuelas con las que no tiene nada que ver.
//
// De dónde sale cada cosa, en cadena:
//   unidades de hoy → sus rutas (en vivo) → las escuelas de esas rutas →
//   los canales de esas escuelas → los avisos de esos canales (en vivo).
export default function AvisosConductorScreen() {
  const { usuario } = useAuth();

  // Las claves van como cadena y no como arreglo a propósito: un arreglo nuevo
  // en cada render volvería a disparar el efecto siguiente aunque los ids sean
  // los mismos. null = todavía no se sabe; '' = se sabe que no hay ninguno.
  const [busIds, setBusIds] = useState<string | null>(null);
  const [escuelaIds, setEscuelaIds] = useState<string | null>(null);
  const [canales, setCanales] = useState<Canal[] | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  // 1. Qué unidades maneja hoy (la suya, o la que cubre si hay suplencia)
  useEffect(() => {
    if (!usuario) return;
    let cancelado = false;
    obtenerUnidadesDelDia(usuario.id)
      .then(({ buses }) => {
        if (cancelado) return;
        const ids = buses.map((b) => b.id).sort();
        setBusIds(ids.join(','));
        // Si no maneja ninguna unidad, no hay rutas ni escuelas que consultar:
        // se cierra la cadena acá para que la pantalla no quede cargando para
        // siempre esperando un paso que nunca va a llegar
        if (ids.length === 0) setEscuelaIds('');
      })
      .catch(() => {
        if (cancelado) return;
        setBusIds('');
        setEscuelaIds('');
      });
    return () => {
      cancelado = true;
    };
  }, [usuario]);

  // 2. Las rutas de esas unidades, EN VIVO: si el admin le cambia una escuela a
  //    la ruta desde el panel, los avisos que ve se acomodan solos
  useEffect(() => {
    // null = todavía no se sabe cuáles son; '' = no maneja ninguna (ya lo
    // resolvió el efecto de arriba). En los dos casos no hay a qué suscribirse.
    if (!busIds) return;
    return escucharRutasDeBuses(busIds.split(','), (rutas) => {
      const escuelas = [...new Set(rutas.flatMap((r) => r.escuelaIds ?? []))].sort();
      setEscuelaIds(escuelas.join(','));
    });
  }, [busIds]);

  // 3. Los canales de esas escuelas
  useEffect(() => {
    if (escuelaIds === null) return;
    let cancelado = false;
    listarCanalesDeEscuelas(escuelaIds ? escuelaIds.split(',') : [])
      .then((lista) => {
        if (!cancelado) setCanales(lista);
      })
      .catch(() => {
        if (!cancelado) setCanales([]);
      });
    return () => {
      cancelado = true;
    };
  }, [escuelaIds]);

  // 4. Los avisos de esos canales, en vivo
  const clavesCanales = (canales ?? []).map((c) => c.id).join(',');
  useEffect(
    // Sin canales, el servicio ya devuelve la lista vacía y una baja que no
    // hace nada, así que no hace falta el caso especial acá. Además evita tocar
    // el estado dentro del cuerpo del efecto, que provoca renders en cascada.
    () => escucharAvisosDeCanales(clavesCanales ? clavesCanales.split(',') : [], setAvisos),
    [clavesCanales]
  );

  if (canales === null) {
    return (
      <PantallaBase titulo="Avisos" scroll={false}>
        <View style={estilosBase.centrado}>
          <CargandoBus texto="Cargando los avisos…" />
        </View>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase titulo="Avisos" subtitulo="De las escuelas de tu ruta">
      <ListaAvisos
        canales={canales}
        avisos={avisos}
        tituloVacio={
          canales.length === 0 ? 'Todavía no hay canal de avisos' : 'Todavía no hay avisos'
        }
        textoVacio={
          canales.length === 0
            ? 'Acá te van a aparecer los comunicados de las escuelas a las que llevás niños.'
            : 'Cuando la administración publique algo de las escuelas de tu ruta, te aparece acá.'
        }
      />
    </PantallaBase>
  );
}
