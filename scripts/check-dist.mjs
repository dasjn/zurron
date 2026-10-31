// Guardia de privacidad del build: comprueba que dist/ no lleva nada del grupo
// (fichas, retratos, material de la mesa). Uso:
//   node scripts/check-dist.mjs [carpeta] [--strict]
//
// En CI (variable CI) es estricto: cualquier hallazgo hace fallar el build.
// En local, src/data/party y src/data/mesa existen y el build los incluye a
// propósito (plantillas y contenido de la mesa para probar): ahí solo informa,
// salvo con --strict.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const dist = resolve(root, args.find((a) => !a.startsWith('--')) ?? 'dist')
const ci = !!process.env.CI && process.env.CI !== 'false'
const strict = ci || args.includes('--strict')

const PARTY = join(root, 'src/data/party')
const MESA = join(root, 'src/data/mesa')

if (!existsSync(dist)) {
  console.error(`No existe ${relative(root, dist) || dist}: ejecuta antes «npm run build».`)
  process.exit(1)
}

/** Todos los ficheros de una carpeta, con ruta relativa a ella. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const files = walk(dist)
/** Ruta dentro de dist/, con barras normales también en Windows. */
const rel = (f) => relative(dist, f).replaceAll('\\', '/')
const TEXT = /\.(?:js|mjs|css|html|json|webmanifest|svg|txt|map)$/i
const texts = files.filter((f) => TEXT.test(f)).map((f) => ({ file: rel(f), body: readFileSync(f, 'utf8') }))
/** Nombre del trozo sin el hash de Vite: "assets/looks-B186ZSZQ.js" → "looks". */
const chunk = (f) => basename(f).replace(/-[\w-]{8}\.\w+$/, '')

const findings = []
const found = (what, where) => findings.push(`${what}: ${where}`)

// 1. Comprobaciones que no necesitan las carpetas privadas (las que valen en CI).

// import.meta.glob deja en el JS las rutas de lo que ha empaquetado.
for (const { file, body } of texts) {
  for (const m of new Set(body.match(/\.\.\/data\/(?:party|mesa)\/[\w.-]+/g) ?? [])) found('carpeta privada empaquetada', `${m} en ${file}`)
}
// Los retratos y colores de las fichas van en looks.json.
for (const f of files) if (chunk(f) === 'looks') found('retratos de las fichas', rel(f))
// Un retrato es una imagen incrustada (data URL); la app no usa ninguna.
for (const { file, body } of texts) {
  const n = (body.match(/data:image\/(?:jpe?g|png|webp|gif|avif|bmp)/gi) ?? []).length
  if (n) found('imagen incrustada (¿un retrato?)', `${n} en ${file}`)
}
// En CI las carpetas privadas no pueden existir: están en .gitignore. Si están,
// alguien las ha subido al repositorio.
if (ci) for (const dir of [PARTY, MESA]) if (existsSync(dir)) found('carpeta privada en el repositorio', relative(root, dir).replaceAll('\\', '/'))

// 2. Si están las carpetas privadas, buscamos su contenido concreto.

const json = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return undefined
  }
}
const jsonFiles = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [])
/** Trozo de texto sin comillas, saltos ni escapes, para buscarlo tal cual en el JS minimizado. */
const snippet = (s) => (typeof s === 'string' ? (s.split(/[\n\r"'`\\$]/)[0] ?? '').trim().slice(0, 60) : '')
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

for (const f of jsonFiles(PARTY)) {
  if (f === 'expected.json' || f === 'looks.json') continue
  const base = f.replace(/\.json$/, '')
  for (const d of files) if (chunk(d) === base) found('ficha del grupo', rel(d))
  const name = json(join(PARTY, f))?.name
  if (typeof name === 'string' && name.length >= 4) {
    const re = new RegExp(`(?<![\\p{L}\\d])${escape(name)}(?![\\p{L}\\d])`, 'u')
    for (const { file, body } of texts) if (re.test(body)) found('nombre de una ficha del grupo', `«${name}» en ${file}`)
  }
}

for (const f of jsonFiles(MESA)) {
  const list = json(join(MESA, f))
  if (!Array.isArray(list)) continue
  for (const e of list) {
    if (!e || typeof e.id !== 'string') continue
    // La entrada como dato: { id: "…" } con cualquier comilla.
    const idRe = new RegExp(`["']?id["']?\\s*:\\s*["'\`]${escape(e.id)}["'\`]`)
    // Y sus textos (los del SRD no se repiten aquí: son de la mesa).
    const bits = [e.text, e.summary, ...(Array.isArray(e.equipment) ? e.equipment.map((x) => x?.text) : [])].map(snippet).filter((s) => s.length >= 25)
    for (const { file, body } of texts) {
      if (idRe.test(body)) found(`contenido de la mesa (${f})`, `id «${e.id}» en ${file}`)
      for (const b of bits) if (body.includes(b)) found(`texto de la mesa (${f})`, `«${b}…» en ${file}`)
    }
  }
}

// 3. Resultado.

const where = relative(root, dist).replaceAll('\\', '/') || dist
if (!findings.length) {
  console.log(`check-dist: ${where} no lleva nada privado (${files.length} ficheros revisados).`)
  process.exit(0)
}
const unique = [...new Set(findings)]
if (strict) {
  console.error(`check-dist: ${where} lleva contenido privado del grupo. No se publica.\n`)
  for (const x of unique) console.error(`  - ${x}`)
  console.error('\nLas fichas, retratos y el material de la mesa van en src/data/party y src/data/mesa, fuera de git (ver README).')
  process.exit(1)
}
console.log(`check-dist: ${where} lleva contenido privado (${unique.length} hallazgos).`)
for (const x of unique) console.log(`  - ${x}`)
console.log('\nEs lo normal en local, porque src/data/party y src/data/mesa existen. En CI esto fallaría.')
console.log('Para comprobar en serio, haz el build sin esas carpetas o usa --strict.')
