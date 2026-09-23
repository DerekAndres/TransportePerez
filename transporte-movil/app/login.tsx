import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import Campo from '@/components/Campo';
import Vidrio from '@/components/Vidrio';
import BotonPrincipal from '@/components/BotonPrincipal';
import CargandoBus from '@/components/CargandoBus';
import { useAlturaTeclado } from '@/hooks/use-teclado';
import { enviarRecuperacionPassword } from '@/services/authService';
import { ESPACIO, RADIO, VIDRIO, estilosBase, halo } from '@/constants/estilos';
import { OBSIDIANA, ZAFIRO } from '@/constants/tema';

// ============================================
// ENTRADA A LA APP — portada animada + hoja de acceso
// ============================================
// Es la PRIMERA pantalla que ve cualquiera, y la única oportunidad de mostrar la
// identidad completa. Por eso es la única de la app que se arma en dos piezas:
//
//   ARRIBA — LA PORTADA. Un cielo de zafiro con esferas de luz que flotan muy
//   despacio. Es la puesta en escena del sistema "Liquid Obsidian & Specular
//   Glass": las esferas son la FUENTE de la luz que después se refleja en el
//   filo de cada lámina de vidrio del resto de la app. Sin ellas, ese filo es un
//   efecto suelto; con ellas, tiene de dónde venir.
//
//   ABAJO — LA HOJA. Una lámina con las esquinas de arriba muy redondeadas que
//   SUBE al abrirse la pantalla y tapa un poco la portada. El gesto de la hoja
//   que se levanta es lo que hace que entrar se sienta como abrir algo, y no
//   como llenar un formulario.
//
// LA TRANSICIÓN NO ES DECORATIVA: mientras Firebase revisa si hay sesión
// guardada se ve SOLO la portada con el busito de carga; cuando resuelve y no
// hay sesión, la hoja sube. O sea que la animación cuenta algo real —"estoy
// revisando" y después "te toca a vos"— en lugar de rellenar una espera. Si hay
// sesión guardada, la hoja no llega a aparecer nunca.
//
// ⚠️ QUÉ SE DEJÓ AFUERA DE LA MAQUETA DE STITCH, Y POR QUÉ (esto hay que poder
// defenderlo: son cosas que el diseño muestra y el sistema NO tiene):
//   · "Correo, teléfono o DNI" y "PIN escolar" → el proyecto usa Firebase
//     Authentication con Email/Password y nada más (CLAUDE.md §4). Ofrecer tres
//     formas de identificarse cuando solo funciona una es prometer de más.
//   · "Recordar este dispositivo" con casilla → la sesión SIEMPRE sobrevive al
//     cerrar la app, porque `services/firebase.ts` usa AsyncStorage como
//     persistencia. Una casilla que no se puede desmarcar de verdad es peor que
//     no tenerla.
//   · Las fichas "Rol Padres / Conductor / Admin" como forma de ingresar → el
//     rol NO se elige: sale del documento del usuario en Firestore DESPUÉS de
//     autenticar. Dejarlas invitaría a tocarlas esperando que hicieran algo.
//   · "Autenticar con Face ID / Huella" → haría falta `expo-local-authentication`,
//     que no está instalada, y además no reemplaza a la contraseña: Firebase
//     igual necesita credenciales. Es una función a decidir, no a dibujar.
//   · "Volver" y "Flota En Línea" → no hay pantalla anterior a la que volver, y
//     el estado de la flota no se puede consultar sin haber entrado: las reglas
//     de Firestore bloquean toda lectura sin sesión (ver `firestore.rules`).
//
// Lo que SÍ se conserva del diseño: la portada con las esferas, la hoja que
// sube, las etiquetas en mayúsculas con las letras separadas, el "¿Olvidaste tu
// contraseña?" pegado a su etiqueta, el botón grande en degradado y el aire
// entre bloques.

const BLANCO = '#FFFFFF';
const BLANCO_TENUE = 'rgba(255, 255, 255, 0.82)';

// La ÚNICA respuesta de "¿olvidaste tu contraseña?", exista o no el correo.
// Está redactada para que el que sí es usuario entienda qué hacer, y el que no
// lo es no aprenda nada (ver el comentario largo en `olvidePassword`).
const AVISO_CORREO_ENVIADO =
  'Si ese correo está registrado por Inversiones Perez, te va a llegar un enlace para definir tu contraseña. Revisá también la carpeta de spam.';

// Cuánto hay que esperar entre un correo y el siguiente
const ESPERA_ENTRE_ENVIOS_MS = 60 * 1000;

// Formato mínimo de un correo: algo@algo.algo
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Cuánto de la pantalla se lleva la portada. Va como PROPORCIÓN y no como un
// número de píxeles: con una altura fija, la portada se come media pantalla en
// un teléfono chico y apenas un tercio en uno grande.
const PROPORCION_PORTADA = 0.4;
// Con el teclado abierto la portada se encoge para dejarle lugar al formulario.
// Sin esto, en un teléfono chico el botón de entrar queda debajo del teclado.
const PROPORCION_PORTADA_TECLADO = 0.16;

// Cuánto dura el splash antes de que suba la hoja de acceso.
//
// Es un tiempo MÍNIMO, no un tiempo fijo: si Firebase tarda más en revisar la
// sesión, el splash se queda hasta que termine. Lo que hace este número es
// evitar el parpadeo — sin él, cuando Firebase responde en 200 ms la portada
// aparece y desaparece de un tirón y no se ve nada.
//
// Y no le hace perder tiempo a nadie en el uso diario: esta pantalla solo se ve
// cuando NO hay sesión guardada, y la sesión sobrevive a cerrar la app. El
// conductor que abre la app dos veces por día nunca pasa por acá.
const DURACION_SPLASH = 1700;
// Lo que tarda la portada en encogerse de pantalla completa a su tamaño normal
const DURACION_TRANSICION = 620;

export default function LoginScreen() {
  const { usuario, cargando, login, avisoSesion } = useAuth();
  const tema = useTheme();
  const insets = useSafeAreaInsets();
  const altoTeclado = useAlturaTeclado();
  const { height: altoPantalla } = useWindowDimensions();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  // Cuándo se mandó el último correo de recuperación. Va en una ref y no en
  // estado porque solo se lee al tocar el enlace: no hay nada que redibujar.
  const ultimoEnvio = useRef(0);

  const tecladoAbierto = altoTeclado > 0;
  const altoPortada =
    altoPantalla * (tecladoAbierto ? PROPORCION_PORTADA_TECLADO : PROPORCION_PORTADA);

  // ============================================
  // EL SPLASH Y SU TRANSICIÓN
  // ============================================
  // Son dos momentos, y el orden importa:
  //
  //   1. SPLASH — la portada ocupa la pantalla ENTERA, con el logo y el busito.
  //      Dura hasta que Firebase termine de revisar si hay sesión guardada, y
  //      nunca menos de DURACION_SPLASH.
  //   2. TRANSICIÓN — la portada se encoge hasta su tamaño normal y, mientras
  //      tanto, la hoja del formulario sube desde abajo.
  //
  // `esperaMinima` es lo que separa un splash de un parpadeo.
  const [esperaMinima, setEsperaMinima] = useState(true);
  useEffect(() => {
    const reloj = setTimeout(() => setEsperaMinima(false), DURACION_SPLASH);
    return () => clearTimeout(reloj);
  }, []);

  const enSplash = cargando || esperaMinima;

  // 1 = la portada ocupa toda la pantalla · 0 = su tamaño normal.
  // ⚠️ Esta es la ÚNICA animación de la app con `useNativeDriver: false`, y hay
  // motivo: se anima el ALTO, y el hilo nativo solo sabe animar opacidad y
  // transformaciones, no propiedades de layout. Es un costo aceptable porque
  // ocurre una sola vez, en una pantalla que no tiene nada más que hacer.
  const encoger = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (enSplash) return;
    Animated.timing(encoger, {
      toValue: 0,
      duration: DURACION_TRANSICION,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [enSplash, encoger]);

  const altoAnimado = encoger.interpolate({
    inputRange: [0, 1],
    outputRange: [altoPortada, altoPantalla],
  });

  // Si ya hay sesión, index.tsx decide a qué grupo mandarlo según su rol
  if (usuario) {
    return <Redirect href="/" />;
  }

  const handleLogin = async () => {
    setError('');
    setAviso('');
    setEnviando(true);
    try {
      await login(email.trim(), password);
    } catch {
      setError('Correo o contraseña incorrectos.');
    } finally {
      setEnviando(false);
    }
  };

  // ============================================
  // RECUPERAR LA CONTRASEÑA
  // ============================================
  // Quien cambia la contraseña es SIEMPRE el dueño del buzón: Firebase manda un
  // enlace de un solo uso a ese correo y a ningún otro. Escribir el correo de
  // otra persona no cambia nada — solo le manda un correo a ella. Y ese correo
  // es el que registró la administración, porque no hay registro público.
  //
  // ⚠️ LA RESPUESTA ES SIEMPRE LA MISMA, exista o no el correo. Antes decía
  // "te enviamos un correo a X" cuando existía y "verificá que esté bien
  // escrito" cuando no: eso convertía la pantalla de acceso en un buscador de
  // clientes — probando correos, cualquiera podía averiguar qué familias usan
  // Inversiones Perez. Con un solo mensaje para los dos casos, el que pregunta
  // no aprende nada que no supiera.
  //
  // Y hay una espera entre un envío y el siguiente: sin eso, cualquiera puede
  // llenarle la bandeja de entrada a un padre tocando el enlace muchas veces.
  const olvidePassword = async () => {
    setError('');
    setAviso('');
    const correo = email.trim();

    // El formato sí se revisa: avisar de un correo mal escrito no delata a
    // nadie (no depende de si está registrado) y evita esperar un correo que
    // nunca iba a salir
    if (!FORMATO_EMAIL.test(correo)) {
      setError('Escribí tu correo completo arriba y volvé a tocar el enlace.');
      return;
    }

    if (Date.now() - ultimoEnvio.current < ESPERA_ENTRE_ENVIOS_MS) {
      setAviso(AVISO_CORREO_ENVIADO);
      return;
    }
    ultimoEnvio.current = Date.now();

    setEnviando(true);
    try {
      await enviarRecuperacionPassword(correo);
      setAviso(AVISO_CORREO_ENVIADO);
    } catch {
      // Un fallo real (sin señal, demasiados intentos): no dice nada del correo
      setError('No se pudo enviar. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={[styles.pantalla, { backgroundColor: OBSIDIANA }]}>
      <Portada
        alto={altoAnimado}
        altoBase={enSplash ? altoPantalla : altoPortada}
        insetSuperior={insets.top}
        compacta={tecladoAbierto}
        enSplash={enSplash}
      />

      {enSplash ? (
        // Durante el splash no hay formulario: la portada ocupa todo y el
        // busito dice que se está revisando la sesión. Si resulta que hay
        // sesión guardada, el usuario nunca llega a ver la hoja.
        <View style={styles.cargandoSplash} pointerEvents="none">
          <CargandoBus color={BLANCO} colorRaya={BLANCO_TENUE} />
        </View>
      ) : (
        <HojaAcceso>
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              { paddingBottom: insets.bottom + ESPACIO.seccion + altoTeclado },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* El tirador: la pista visual de que esto es un panel que subió y
                no el fondo de la pantalla */}
            <View style={[styles.tirador, { backgroundColor: VIDRIO.bordeFuerte }]} />

            <Text variant="headlineMedium">Bienvenido de nuevo</Text>
            <Text variant="bodyMedium" style={[estilosBase.tenue, styles.lema]}>
              Acceso seguro para padres, conductores y administración.
            </Text>

            <Text variant="labelMedium" style={[estilosBase.tenue, styles.etiqueta]}>
              CORREO REGISTRADO
            </Text>
            <Campo
              value={email}
              onChangeText={setEmail}
              placeholder="tucorreo@ejemplo.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              left={<TextInput.Icon icon="email-outline" />}
            />

            <View style={styles.filaEtiqueta}>
              <Text variant="labelMedium" style={[estilosBase.tenue, styles.etiqueta]}>
                CONTRASEÑA
              </Text>
              {/* Va acá, pegado a su etiqueta y no perdido abajo: quien no se
                  acuerda de la contraseña lo busca mirando ESTE campo */}
              <Button
                mode="text"
                compact
                onPress={olvidePassword}
                disabled={enviando}
                labelStyle={styles.enlace}
              >
                ¿Olvidaste tu contraseña?
              </Button>
            </View>
            <Campo
              value={password}
              onChangeText={setPassword}
              placeholder="Tu contraseña"
              secureTextEntry={!verPassword}
              left={<TextInput.Icon icon="lock-outline" />}
              right={
                <TextInput.Icon
                  icon={verPassword ? 'eye-off' : 'eye'}
                  onPress={() => setVerPassword((v) => !v)}
                  forceTextInputFocus={false}
                />
              }
            />

            {/* El aviso de sesión (cuenta dada de baja) se muestra acá mismo:
                sin él, la persona vuelve al login sin entender por qué */}
            <HelperText type="error" visible={!!(error || avisoSesion)}>
              {error || avisoSesion}
            </HelperText>
            <HelperText type="info" visible={!!aviso}>
              {aviso}
            </HelperText>

            {/* El mismo "espejo de zafiro" que usa "Iniciar viaje" del conductor:
                entrar es LA acción de esta pantalla */}
            <BotonPrincipal
              texto="Iniciar sesión"
              icono="login-variant"
              onPress={handleLogin}
              cargando={enviando}
              deshabilitado={enviando}
            />

            {/* --- Por qué no hay "crear cuenta" --- */}
            {/* Las cuentas las crea la administración y Firebase envía el correo
                para definir la contraseña (CLAUDE.md §6). Quien llega por primera
                vez busca un botón de registro; si no lo encuentra y nadie se lo
                explica, asume que la app está fallada. Este bloque ocupa el lugar
                que en la maqueta tenían las tres fichas de rol, y dice lo que
                ésas sugerían sin poder cumplirlo: quién define tu rol. */}
            <Vidrio style={styles.nota}>
              <View style={styles.filaNota}>
                <MaterialCommunityIcons
                  name="shield-check-outline"
                  size={20}
                  color={tema.colors.primary}
                />
                <Text variant="titleSmall" style={styles.tituloNota}>
                  ¿Primer ingreso?
                </Text>
              </View>
              <Text variant="bodySmall" style={estilosBase.tenue}>
                Las cuentas las crea la administración de Inversiones Perez con el correo que
                dejaste inscrito, y ahí mismo queda definido si entrás como padre, conductor o
                administración. Vas a recibir un mensaje para elegir tu contraseña.
              </Text>
              <View style={styles.filaNota}>
                <MaterialCommunityIcons
                  name="account-off-outline"
                  size={14}
                  color={tema.colors.onSurfaceVariant}
                />
                <Text variant="labelMedium" style={estilosBase.tenue}>
                  Sin registro público ni cuentas anónimas
                </Text>
              </View>
            </Vidrio>
          </ScrollView>
        </HojaAcceso>
      )}
    </View>
  );
}

// ============================================
// LA PORTADA — el cielo de zafiro con esferas de luz
// ============================================
// Tres esferas de distinto tamaño flotando muy despacio sobre un degradado de
// zafiro. La lentitud es deliberada: el ciclo más corto dura siete segundos, así
// el movimiento se percibe pero nunca compite con el formulario ni marea a quien
// está tratando de escribir su contraseña.
//
// Toda la animación corre con `useNativeDriver: true`, o sea en el hilo nativo.
// Eso importa acá más que en ninguna otra pantalla: justo mientras las esferas
// se mueven, JavaScript está ocupado hablando con Firebase para ver si hay
// sesión. Sin el hilo nativo, la portada se trabaría exactamente en el momento
// en que el usuario la está mirando.
function Portada({
  alto,
  altoBase,
  insetSuperior,
  compacta,
  enSplash,
}: {
  // El alto ANIMADO (se encoge al terminar el splash)
  alto: Animated.AnimatedInterpolation<number>;
  // El alto en números, para calcular el tamaño de las esferas: una
  // interpolación animada no se puede multiplicar a mano
  altoBase: number;
  insetSuperior: number;
  compacta: boolean;
  enSplash: boolean;
}) {
  return (
    <Animated.View style={[styles.portada, { height: alto, backgroundColor: ZAFIRO }]}>
      <LinearGradient
        // Del zafiro claro de arriba a la obsidiana de abajo, para que la
        // portada se funda con el fondo de la pantalla en vez de cortarse
        colors={['#4C8DFF', '#2563EB', '#12245C', OBSIDIANA]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Los tamaños y las posiciones van como proporción del alto de la
          portada, no en píxeles: así la composición se ve igual en un teléfono
          chico que en uno grande, y también cuando la portada se encoge. */}
      <Esfera
        tam={altoBase * 0.85}
        x={-altoBase * 0.2}
        y={-altoBase * 0.3}
        opacidad={0.5}
        duracion={9000}
      />
      <Esfera
        tam={altoBase * 0.42}
        x={altoBase * 0.62}
        y={altoBase * 0.34}
        opacidad={0.75}
        duracion={7000}
      />
      <Esfera
        tam={altoBase * 0.18}
        x={altoBase * 0.18}
        y={altoBase * 0.58}
        opacidad={0.4}
        duracion={11000}
      />

      {/* El logo solo cuando hay lugar: con el teclado abierto la portada se
          encoge tanto que quedaría aplastado contra la barra de estado */}
      {!compacta && (
        <Marca insetSuperior={insetSuperior} enSplash={enSplash} />
      )}
    </Animated.View>
  );
}

// --- El logo y el nombre ---
// Aparecen con una entrada propia: el logo crece desde el 88 % mientras se
// desvanece hacia adentro. Es "la animación de la tarjeta" del diseño — lo
// primero que se ve al abrir la app, antes de que exista el formulario.
//
// Durante el splash el bloque va centrado en la pantalla; cuando la portada se
// encoge, queda arriba. Esa diferencia la resuelve `justifyContent`, no una
// animación aparte: la portada ya se está encogiendo, y el contenido se
// reacomoda solo con ella.
function Marca({ insetSuperior, enSplash }: { insetSuperior: number; enSplash: boolean }) {
  const entrada = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrada, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrada]);

  return (
    <Animated.View
      style={[
        styles.marca,
        {
          paddingTop: insetSuperior + 24,
          // En el splash el bloque se centra en toda la pantalla; después queda
          // arriba, que es donde lo deja la portada ya encogida
          justifyContent: enSplash ? 'center' : 'flex-start',
          opacity: entrada,
          transform: [
            { scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
          ],
        },
      ]}
    >
      <View style={[styles.cajaLogo, halo(ZAFIRO)]}>
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Inversiones Perez, transporte escolar"
        />
      </View>
      <Text variant="titleLarge" style={styles.nombreMarca}>
        Inversiones Perez
      </Text>
      <Text variant="labelMedium" style={styles.lemaMarca}>
        TRANSPORTE ESCOLAR · LA CEIBA
      </Text>
    </Animated.View>
  );
}

// --- Una esfera de luz ---
// Sube y baja en bucle y, al mismo tiempo, crece y se achica apenas. Las dos
// cosas juntas son las que dan la sensación de flotar: solo con el
// desplazamiento parecería un ascensor.
//
// React Native no dibuja degradados RADIALES (los que harían una esfera de
// verdad), así que se resuelve con un degradado diagonal dentro de un círculo:
// la luz entra por arriba a la izquierda y el color se hunde hacia abajo a la
// derecha. A este tamaño el ojo lo lee como volumen igual.
function Esfera({
  tam,
  x,
  y,
  opacidad,
  duracion,
}: {
  tam: number;
  x: number;
  y: number;
  opacidad: number;
  duracion: number;
}) {
  const flotar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bucle = Animated.loop(
      Animated.sequence([
        Animated.timing(flotar, {
          toValue: 1,
          duration: duracion,
          // `sin` en vez de una curva lineal: la esfera desacelera al llegar
          // arriba y al llegar abajo, que es lo que hace el movimiento orgánico
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(flotar, {
          toValue: 0,
          duration: duracion,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    bucle.start();
    // Se detiene al desmontar: un bucle que sigue vivo después de entrar a la
    // app gasta batería sin que nadie lo vea
    return () => bucle.stop();
  }, [flotar, duracion]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.esfera,
        {
          width: tam,
          height: tam,
          borderRadius: tam / 2,
          left: x,
          top: y,
          opacity: opacidad,
          transform: [
            {
              translateY: flotar.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -tam * 0.12],
              }),
            },
            { scale: flotar.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={['#DBEAFE', '#60A5FA', '#1D4ED8']}
        start={{ x: 0.25, y: 0.05 }}
        end={{ x: 0.85, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: tam / 2 }]}
      />
    </Animated.View>
  );
}

// ============================================
// LA HOJA QUE SUBE
// ============================================
// Entra desde abajo y aparece al montarse. Es UNA sola animación de resorte, no
// una cadena de efectos: el gesto tiene que leerse como "algo se abrió", y para
// eso alcanza con que suba y aparezca.
function HojaAcceso({ children }: { children: ReactNode }) {
  // ⚠️ ARRANCA EN 1, O SEA VISIBLE, Y RECIÉN AHÍ SE ANIMA.
  // Antes arrancaba en 0 (invisible) y subía con el efecto. Eso deja el
  // formulario colgando de que la animación llegue a correr: si el efecto no
  // se ejecuta —o si el compilador de React memoiza el estilo, que es
  // exactamente lo que el aviso `react-hooks/refs` de ESLint advierte sobre
  // este patrón—, la hoja se queda en opacidad 0 y el usuario ve una pantalla
  // sin nada que tocar. Nunca se debe esconder contenido detrás del éxito de
  // una animación: la animación es un adorno, el formulario no.
  const subir = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Se lleva al estado inicial y se suelta. Si por lo que sea esto no corre,
    // la hoja ya estaba visible desde el primer dibujado.
    subir.setValue(0);
    Animated.spring(subir, {
      toValue: 1,
      useNativeDriver: true,
      friction: 9,
      tension: 46,
    }).start();
  }, [subir]);

  return (
    <Animated.View
      style={[
        styles.hoja,
        {
          opacity: subir,
          transform: [
            { translateY: subir.interpolate({ inputRange: [0, 1], outputRange: [64, 0] }) },
          ],
        },
      ]}
    >
      {/* El filo especular del borde de arriba, el mismo de todas las láminas de
          la app. Acá se ve mejor que en ninguna otra parte, porque la luz que lo
          justifica está dibujada justo encima. */}
      <LinearGradient
        colors={['transparent', VIDRIO.filo, VIDRIO.filo, 'transparent']}
        locations={[0, 0.3, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.filoHoja}
        pointerEvents="none"
      />
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1 },

  // --- Portada ---
  portada: { overflow: 'hidden' },
  esfera: { position: 'absolute', overflow: 'hidden' },
  // Ocupa todo el alto de la portada: así puede centrarse durante el splash y
  // quedar arriba después, sin cambiar de contenedor
  // (`StyleSheet.absoluteFillObject` ya no existe en React Native 0.86 —
  // ver AGENTS.md—, así que las cuatro posiciones van escritas)
  marca: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: 6,
  },
  cajaLogo: {
    width: 78,
    height: 78,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 14, 32, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    marginBottom: 6,
  },
  logo: { width: 56, height: 56, borderRadius: 16 },
  nombreMarca: { color: BLANCO },
  lemaMarca: { color: BLANCO_TENUE },

  // El busito del splash va SUPERPUESTO a la portada, abajo, para no pelearse
  // con el logo que está centrado
  cargandoSplash: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 72,
    alignItems: 'center',
  },

  // --- La hoja ---
  // El margen negativo es lo que la hace TAPAR la portada: sin ese solape se
  // leería como dos pantallas pegadas en vez de un panel que subió por encima.
  hoja: {
    flex: 1,
    marginTop: -30,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    borderTopWidth: 1,
    borderColor: VIDRIO.borde,
    overflow: 'hidden',
  },
  filoHoja: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, zIndex: 1 },
  scroll: {
    paddingHorizontal: ESPACIO.pantalla,
    paddingTop: ESPACIO.interno,
    gap: ESPACIO.interno,
  },
  tirador: {
    width: 42,
    height: 4,
    borderRadius: RADIO.pastilla,
    alignSelf: 'center',
    marginBottom: ESPACIO.interno,
  },
  lema: { marginBottom: ESPACIO.minimo },
  // Las mayúsculas y la separación entre letras ya vienen de la variante
  // `labelMedium` del tema (constants/tema.ts): acá solo se acomoda el espacio
  // respecto del campo que va debajo.
  etiqueta: { marginTop: ESPACIO.minimo },
  filaEtiqueta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  enlace: { fontSize: 12 },

  nota: { marginTop: ESPACIO.minimo },
  filaNota: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tituloNota: { flex: 1 },
});
