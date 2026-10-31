# Zurrón

Fichas de personaje guiadas para la quinta edición con las reglas de 2024, pensadas para quien empieza a jugar. Es una web instalable (PWA) que funciona en Safari (iPhone) y en Chrome (Android), también sin conexión.

Necesita iOS 15.4 o más nuevo en iPhone, y Chrome 100 o más nuevo en Android. En móviles más viejos puede verse mal o no abrir.

**Ábrela en el móvil:** https://dasjn.github.io/zurron/

## Qué hace

- **Crear personaje paso a paso.** Cada decisión viene explicada, y «Elegir por mí» escoge algo sensato si no sabes qué poner.
- **La ficha calcula sola** la CA, los PG, los bonificadores, la CD, los ataques y los espacios de conjuro. Tú solo apuntas lo que pasa en la partida: daño, curación, usos gastados, estados y descansos.
- **Turno:** qué puedes hacer en tu turno, con cada ataque y conjuro explicado.
- **Subir de nivel** con un asistente que te dice qué ganas y qué tienes que elegir.
- **Reglas:** cómo se juega, glosario y todos los conjuros del SRD con buscador.
- **Diario de campaña** para apuntar lo que pasa en cada sesión.

## Tus datos

No hay cuentas ni servidor. Cada ficha se guarda en el navegador del móvil donde la creas. Para guardar una copia o pasarla a otro móvil, usa **Exportar copia** en Inicio y luego **Importar copia** en el otro móvil.

**En iPhone, la app instalada tiene sus propios datos,** separados de los de Safari: lo que hiciste en Safari no aparece al abrirla desde la pantalla de inicio. Si ya tienes fichas en Safari, sigue este orden:

1. En Safari, **Exportar copia** en Inicio.
2. Instala la app: Compartir → **Añadir a pantalla de inicio**.
3. Abre la app instalada y usa **Importar copia** con el archivo del paso 1.

## Contenido de tu mesa

La app solo trae lo que está en el SRD 5.2.1, las reglas que Wizards of the Coast publica con licencia libre. Tu personaje puede usar algo de otro libro, como un trasfondo, una dote o una subclase. En ese caso, eso viaja dentro de la copia de seguridad: al importarla, se guarda en ese móvil y la ficha lo usa como si viniera con la app.

En el JSON de la copia, ese contenido va en el campo `mesa`, con listas como `backgrounds`, `feats` o `subclasses`. Cada lista tiene la misma forma que en `src/data/types.ts`. Para desarrollar, también puedes ponerlo en `src/data/mesa/*.json`; esa carpeta está fuera de git.

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:5173 (solo en este ordenador)
npm run dev:red      # lo mismo, abierto a la red local (para el móvil)
npm test             # motor de reglas
npm run build        # genera dist/
npm run preview      # sirve dist/ (preview:red para la red local)
node scripts/check-dist.mjs   # comprueba que dist/ no lleva nada privado
```

- **Publicación:** cada `push` a `main` se publica solo en GitHub Pages (`.github/workflows/pages.yml`). Antes pasa los tests, hace el build y ejecuta `scripts/check-dist.mjs`, que para la publicación si `dist/` lleva fichas, retratos o contenido de la mesa.
- **Probar en el móvil sin publicar:** ejecuta `npm run dev:red` y abre la dirección «Network» que muestra Vite, con el móvil en la misma wifi. Cualquiera en esa wifi puede abrirla, y con ella las fichas de `src/data/party/`: úsalo solo en una red de confianza y ciérralo al acabar. Para instalarla y usarla sin conexión hace falta HTTPS.

## Cómo está hecho

- **Las fichas guardan decisiones, no números.**
  - `src/model/character.ts` es la forma de una ficha: clase, nivel, elecciones y equipo.
  - `src/data/types.ts` es la forma de los datos de reglas.
- **El motor está en `src/rules/`.**
  - `derive.ts` calcula CA, PG, bonificadores, CD, espacios, ataques y avisos.
  - `levelup.ts` es la subida de nivel.
  - `rests.ts` lleva el daño, la curación y los descansos.
  - `create.ts` es el creador de personajes.
- **Las reglas del SRD están en `src/data/srd/`.** Es JSON generado desde el SRD 5.2.1 en español con `npm run srd`, que lee el texto del PDF en `../srd/text/es-raw.txt` (no incluido). No se edita a mano: se arregla el script de `scripts/srd/` y se regenera.
- **Las fichas de mi grupo van en `src/data/party/`,** que tampoco está en git. Si existe, Inicio ofrece esas fichas como plantillas. Los tests que dependen de esas fichas o del contenido de la mesa viven dentro de esas carpetas (`src/data/party/*.test.ts`, `src/data/mesa/*.test.ts`), así que fuera de tu ordenador no existen. Los de `src/rules/` no dependen de ellas: usan personajes de prueba hechos con el SRD.
- **Un build local incluye `src/data/party/` y `src/data/mesa/`** si existen. No publiques a mano tu `dist/`: deja que lo haga la Action, que construye sin ellas.
- **La interfaz está en `src/ui/`,** hecha en Preact. La guía visual está en [DISENO.md](DISENO.md).

## Licencia

- **Código:** licencia MIT (ver [LICENSE](LICENSE)). Las licencias de las reglas y las tipografías están en [NOTICE](NOTICE).
- **Reglas** (`src/data/srd/`): esta obra incluye material procedente del documento de referencia del sistema 5.2.1 (“SRD 5.2.1”) de Wizards of the Coast LLC, disponible en https://www.dndbeyond.com/srd. La licencia sobre el SRD 5.2.1 se concede de acuerdo con la licencia internacional de atribución/reconocimiento 4.0 de Creative Commons, disponible en https://creativecommons.org/licenses/by/4.0/legalcode.
- **Tipografías:** Grenze y Alegreya Sans usan la SIL Open Font License 1.1 (ver [src/assets/fonts/OFL.txt](src/assets/fonts/OFL.txt)).

Zurrón es un proyecto de aficionados. No es un producto oficial de Wizards of the Coast ni cuenta con su respaldo.
