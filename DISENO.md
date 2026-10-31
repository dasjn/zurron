# Diseño de Zurrón

Guía visual de la app. Los estilos base están en `src/styles.css` y los componentes comunes en `src/ui/common.tsx`. Cada pantalla añade lo suyo en su propio archivo de `src/ui/css/`.

## Para qué es y para quién

- **Uso:** jugar a D&D en la mesa con el móvil, a menudo de noche y con poca luz.
- **Quién la usa:** gente que empieza; no sabe reglas ni jerga.
- **Lo que más se hace:**
  - mirar un número de un vistazo (CA, PG, bonificadores);
  - tocar para apuntar PG y usos gastados;
  - leer qué se puede hacer en el turno.
- **Dirección elegida por el grupo:** interfaz de videojuego de rol (en la línea de Baldur's Gate 3). Siempre oscura, con marcos dorados finos, retrato en medallón, barra de vida grande y rombos para los usos.

## Colores (tokens en `:root`)

| Token | Valor | Para qué |
|---|---|---|
| `--bg` | #14100c | Fondo de página (cuero muy oscuro, nunca negro puro) |
| `--bg-inset` | #0e0b08 | Campos de texto, interior de barras |
| `--panel` / `--panel-2` | #1f1913 / #29211a | Paneles; `--panel-2` para lo que va encima de un panel o dentro de una hoja |
| `--line` / `--line-2` | #3a2f23 / #4d3f2d | Filetes y bordes discretos (decorativos) |
| `--line-3` | #806f58 | Borde de los campos de texto (`.input`): 3,3:1 sobre `--panel-2`, el mínimo de WCAG para el contorno de un control |
| `--gold` / `--gold-hi` | #c9a35c / #ecd29a | Estructura: títulos de sección, marcos, rombos de la franja, acción principal |
| `--gold-line` / `--gold-soft` | oro al 42 % / #2e2417 | Bordes dorados finos / fondo dorado tenue |
| `--ink` / `--muted` / `--faint` | #ece1c9 / #a8977c / #9b8b73 | Texto, texto secundario, pistas (`--faint` da 4,8:1 sobre `--panel-2`, 4,6:1 sobre `--gold-soft` y 5,3:1 sobre `--panel`) |
| `--blood` / `--blood-soft` | #b8352b / #2c1512 | Vida y avisos graves |
| `--steel` | #8fb3d9 | PG temporales |
| `--good` / `--bad` | #8cc283 / #e8735f | Éxito y fallo |
| `--accent` / `--accent-soft` | color del personaje | Lo que es «suyo»: rombos de usos, opciones marcadas, chips activos, brillo del retrato |

**Reparto del color:**

- **Oro** es la estructura de la interfaz: lo mismo en todas las fichas.
- **El color del personaje** se usa solo en lo interactivo y propio. Llega solo con `paletteStyle(c)` en el contenedor `.sheet`.
- **Sin color fijo:** no escribas colores en hexadecimal en los componentes; usa los tokens.

## Tipografía

- **Grenze** (`--f-display`), una serif medieval afilada y algo estrecha. Va en:
  - nombres de personaje;
  - títulos `h2` y `h3`;
  - números grandes (`.v` en franjas, losetas y PG);
  - botón principal.
- **Alegreya Sans** (`--f-body`) para todo lo demás. Tamaño base `106.25%` en `html` (17 px con la letra de serie del navegador). Va en % para respetar la letra que cada persona elija; no lo fijes en px.
- Escala: 0,72 rem (etiquetas pequeñas), 0,8 (`.label`), 0,88 (`.small`), 0,95 (`.lede`), 1 (texto), 1,15 (`h3`), 1,4 (`h2`), 2 a 2,4 (cifras), 2,1 a 2,8 (nombres y marca).
- **Mayúsculas:** nada en mayúsculas ni versalitas. Etiquetas, títulos y botones en tipo frase («Puntos de golpe», no «PUNTOS DE GOLPE»).
- **Cifras:** con `font-variant-numeric: tabular-nums lining-nums` (clase `.num` o ya incluido en `.v`).

## Espaciado

- **Escala:** 4, 8, 12, 16, 24 y 32 px. Margen lateral `--gutter` (16 px o la zona segura).
- **Secciones:** un `h2` deja 28 px arriba y 12 abajo. El primer elemento de una pestaña no lleva margen superior extra; el contenedor de la pestaña ya deja 16 px bajo la cabecera.
- **Separación entre piezas hermanas:** 8 px (`.stack`, `.card + .card`, rejillas `.grid2` y `.grid3`).
- **Interior de paneles:** 14 px arriba y abajo, 16 a los lados. Filas de lista: 10 a 12 px arriba y abajo, 14 a los lados.
- **Nada pegado:** todo bloque visible necesita aire respecto al anterior. Los textos sueltos (`.lede`, `p.small`) bajo una rejilla o franja llevan al menos 8 px encima.
- **Tamaños táctiles:** mínimo 44 px de alto para botones y 36 para controles secundarios.
  - «Inicio», «Cerrar» y «Cancelar» (`.btn.sm.ghost`) se tocan en 44 px aunque se vean como `.sm` (márgenes negativos: la fila no crece).
  - Entre huecos de 36 seguidos (rombos de usos, pasos del asistente) deja al menos 6 px o reparte todo el ancho entre ellos.

## Piezas base (no redefinirlas en las pantallas)

- **`.band`**: franja de cifras con filetes dorados arriba y abajo y rombos en las juntas. Cada hijo es una celda con este orden:
  - `.label` arriba;
  - `.v` grande en medio;
  - `.s` como pista abajo.

  Una celda que se puede tocar es un `<button>`; su etiqueta sale subrayada con puntos. Es para CA, iniciativa, velocidad, CD, ataque mágico, percepción pasiva y bonificador por competencia.
- **`.card`**: panel. **`.card.frame`** añade esquinas doradas. Úsalo solo para la pieza principal de una pantalla (los PG en Estado), como mucho una por pantalla.
- **`.vital`**: loseta suelta, por ejemplo las seis características en una rejilla de tres columnas.
- **`.list` + `.li`**: lista en un solo panel con filas separadas por filetes. Los `.li` pueden ser `a`, `button` o `div`; `.li .v` va a la derecha.
- **`details.item`** (componente `Disclosure`): fila desplegable con el chevrón dorado.
  - Varios seguidos forman una sola lista con las esquinas redondeadas fuera.
  - Dentro de `.stack` van sueltos, cada uno con su borde.
- **Botones (`.btn`):**
  - `.primary`: marco de oro y letra Grenze. Una acción principal por pantalla u hoja.
  - `.soft`: color del personaje.
  - `.brass`: dorado tenue, para acciones secundarias destacadas.
  - `.ghost`: solo texto dorado, para «Inicio» y «Cerrar».
  - `.danger`.
  - Modificadores: `.sm` y `.block`.
- **`.iconbtn`**: botón cuadrado de 44 px para − y +.
- **`Icon`**: iconos de trazo de 24 px que toman el color del texto. Nombres: estado, turno, conjuros, habilidades, rasgos, equipo, personaje, notas, mas, glosario, subir, atras y adelante.
- **`Pips`** (rombos de usos):
  - Los disponibles se ven llenos con el color del personaje y los gastados, huecos.
  - `count` invierte la lógica (se rellenan los marcados), para salvaciones de muerte.
  - `tone="good"` o `"bad"` cambia el color; `centered` los centra.
- **`Stepper`**: «− valor +»; `compact` lo hace más pequeño para filas.
- **`.chip`** y `.chip.on`: fichas pequeñas con borde. Si es un `<a>`, no lleva subrayado.
- **Control segmentado** (`.pt-seg` y `.cr-seg`): botones de 44 px en un marco dorado; el marcado lleva `aria-pressed="true"` o `aria-current="page"`. El aspecto está en `styles.css`; cada zona solo decide cómo se reparten el ancho.
- **`.tag`**: etiqueta dorada pequeña («Nv 3», «C», «Estado»). Ya trae margen a la izquierda; no añadas `marginLeft` en línea.
- **`.dot`**: rombo de competencia en cuatro variantes: vacío, `.on`, `.double` (pericia) y `.half` (mitad).
- **`.notice`** y `.notice.error`: aviso con borde izquierdo dorado o rojo. Los enlaces de dentro se ven dorados.
- **`Modal`**: hoja inferior con título Grenze y «Cerrar». Dentro, los paneles suben a `--panel-2` solos. Con `dirty` (cambios sin guardar), tocar fuera no la cierra y «Cerrar», Escape o Atrás preguntan «¿Descartar los cambios?».
- **`.footerbar`**: barra de acciones fija al pie dentro de asistentes y hojas.
- **`Option`**: opción marcable, casilla o radio.
- **`.portrait`**: retrato en medallón redondo con doble aro dorado y brillo del color del personaje. El tamaño se cambia con `size`.
- **`.bnav`**: barra de navegación inferior de la ficha, con cinco huecos: icono y texto. La activa lleva `aria-current="page"`. Su alto (`--bnav-h`) crece con la letra; el texto crece solo hasta donde cabe «Habilidades».
- **`.wrap`**: columna de contenido. Con barra inferior, añade `.with-nav`.

## Principios

1. **Lo llamativo en un solo sitio.** En la ficha son la cabecera (medallón y nombre), la franja de cifras y los PG. Todo lo demás, sobrio: filas, filetes y texto.
2. **Filas mejor que tarjetas sueltas.** Las cosas del mismo tipo van en una lista con filetes, no en muchas tarjetas iguales.
3. **La estructura informa.** Usa rombos, marcos y filetes solo donde separan o agrupan algo de verdad. Numera solo lo que es una secuencia (pasos del asistente).
4. **Movimiento:** solo en respuesta a lo que toca la persona (abrir, desplegar, confirmar). Nada de animaciones de entrada por sección.
5. **Accesible:** foco visible, `aria-label` en los botones de solo icono o símbolo, contraste suficiente y movimiento reducido respetado.

## Móviles viejos, letra grande y pantallas bajas

Hay jugadores con iPhone que se quedan en iOS 15 y Android con Chrome antiguo. Comprueba cada cambio a 320×568, 360×740, 390×844 y 844×390 (horizontal), y con la letra de la raíz al 130 % y al 200 %.

- **`color-mix()`** (no existe en iOS 15 ni en Chrome < 111): como siempre lleva `var()`, la declaración no se descarta al leerla sino al calcularla, así que un color de repuesto escrito justo antes **no sirve**. Pon el repuesto en un bloque `@supports not (color: color-mix(in srgb, red, red))` al final del archivo de la zona, con la mezcla ya calculada.
- **`dvh`** (iOS < 15.4, Chrome < 108): escribe antes la misma medida en `vh` (`max-height: 88vh; max-height: 88dvh;`).
- **`:has()`** (iOS < 15.4, Chrome < 105): nunca en una lista de selectores junto a otros (si no lo entiende, se pierde la regla entera); si hace falta, alternativa con `@supports not selector(:has(*))`.
- **Letra grande:** nada de altos fijos en px para cajas con texto. Las palabras largas se parten dentro de botones y celdas de franja (`overflow-wrap: break-word`); el nombre del personaje, con guiones (`hyphens: auto`).
- **Pantallas bajas:** `@media (max-height: 600px)` compacta la cabecera de la ficha y el título, el buscador y el pie de las hojas.

## Textos

- Castellano de España, tuteando y en tipo frase.
- Explica las cosas para alguien que no sabe jugar, sin jerga sin explicar.
- **Botones:** dicen exactamente lo que pasa («Terminar descanso corto», «Guardar»). Nada de «Enviar», nada de flechas «→» al final.
- **Metadatos:** prefiere frases cortas («Guerrero de nivel 1, orco») a cadenas con puntos medios. Los puntos medios solo valen en datos técnicos compactos, como «Evocación de nivel 1 · Acción · 36 m» en un conjuro.
- **Errores y vacíos:** dicen qué pasa y qué hacer, sin disculparse.

## Archivos por zona (cada zona añade su CSS con su prefijo de clase)

| Zona | Archivos | CSS y prefijo |
|---|---|---|
| Ficha: cabecera, navegación, Estado | `ui/Sheet.tsx`, `ui/tabs/Estado.tsx` | `css/ficha.css`, `.fi-` |
| Combate y magia | `ui/tabs/Turno.tsx`, `ui/tabs/Conjuros.tsx`, `ui/SpellEditor.tsx`, `ui/tabs/Habilidades.tsx` | `css/combate.css`, `.cb-` |
| Rasgos, equipo, personaje, notas | `ui/tabs/Rasgos.tsx`, `ui/ChoiceEditor.tsx`, `ui/tabs/Equipo.tsx`, `ui/tabs/Personaje.tsx`, `ui/tabs/Notas.tsx` | `css/fichero.css`, `.fx-` |
| Inicio, reglas, subir de nivel | `ui/Home.tsx`, `ui/RulesScreen.tsx`, `ui/LevelUp.tsx` | `css/portada.css`, `.pt-` |
| Crear personaje | `ui/Create.tsx` (y `ui/create/*`), `rules/create.ts` | `css/crear.css`, `.cr-` |
| Datos: copias, avisos de guardado, errores, actualización | `ui/common.tsx` (Modal, avisos), `app.tsx`, `ui/photo.ts` | `css/datos.css`, `.dt-` |

**Normas para todas las zonas:**

- Cada CSS se importa desde el componente principal de su zona (`import './css/ficha.css'`).
- Todos los selectores llevan el prefijo de la zona.
- Las piezas base solo se cambian en `styles.css` o `common.tsx`.
- Nada de estilos en línea con números: Preact 11 no añade «px», así que `style={{ marginTop: 8 }}` no hace nada. Usa una clase de tu zona (o, si no hay más remedio, `'8px'`).
