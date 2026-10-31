// Contrasta los datos de clases con los JSON que genera scripts/srd/compendio/:
// - todas las ids de conjuros (spellList, alwaysPrepared...) existen en spells.json;
// - la lista de cada clase coincide con el campo `classes` de spells.json;
// - hay dotes para las elecciones de tipo 'estilo-combate' y 'don-epico'.
// Uso (desde app/):  node scripts/srd/clases/check.mjs

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { OUT_DIR } from '../lib.mjs'

const read = (name) => {
  const file = resolve(OUT_DIR, name)
  if (!existsSync(file)) return null
  return JSON.parse(readFileSync(file, 'utf8'))
}

const classes = read('classes.json')
const subclasses = read('subclasses.json')
const spells = read('spells.json')
const feats = read('feats.json')
if (!classes || !subclasses) {
  console.error('Falta classes.json o subclasses.json: ejecuta antes scripts/srd/clases/build.mjs')
  process.exit(1)
}
let problems = 0
const fail = (m) => {
  problems++
  console.log('  ✗ ' + m)
}

if (!spells) {
  console.log('spells.json no existe todavía: no se pueden contrastar las ids de conjuros.')
} else {
  const byId = new Map(spells.map((s) => [s.id, s]))
  console.log(`spells.json: ${spells.length} conjuros`)
  const refs = []
  for (const c of classes) {
    for (const id of c.spellList || []) refs.push([`${c.id}.spellList`, id])
    for (const ap of c.alwaysPrepared || []) for (const id of ap.spells) refs.push([`${c.id}.alwaysPrepared`, id])
  }
  for (const s of subclasses) {
    for (const ap of s.alwaysPrepared || []) for (const id of ap.spells) refs.push([`${s.id}.alwaysPrepared`, id])
    for (const [opt, list] of Object.entries(s.alwaysPreparedByOption?.options || {}))
      for (const ap of list) for (const id of ap.spells) refs.push([`${s.id}.alwaysPreparedByOption.${opt}`, id])
  }
  const missing = refs.filter(([, id]) => !byId.has(id))
  console.log(`Referencias a conjuros: ${refs.length}; sin coincidencia en spells.json: ${missing.length}`)
  for (const [where, id] of missing) fail(`${where}: "${id}" no está en spells.json`)

  // Lista de clase frente al campo `classes` de cada conjuro
  for (const c of classes.filter((x) => x.spellList)) {
    const mine = new Set(c.spellList)
    const theirs = new Set(spells.filter((s) => (s.classes || []).includes(c.id)).map((s) => s.id))
    const onlyMine = [...mine].filter((x) => !theirs.has(x))
    const onlyTheirs = [...theirs].filter((x) => !mine.has(x))
    if (onlyMine.length || onlyTheirs.length) {
      fail(
        `${c.id}: lista de clase ≠ spells.json[].classes` +
          (onlyMine.length ? ` | solo en la lista: ${onlyMine.join(', ')}` : '') +
          (onlyTheirs.length ? ` | solo en spells.json: ${onlyTheirs.join(', ')}` : ''),
      )
    } else console.log(`  ✓ ${c.id}: ${mine.size} conjuros, coincide con spells.json`)
  }
}

if (!feats) {
  console.log('feats.json no existe todavía: no se pueden contrastar las dotes.')
} else {
  for (const cat of ['estilo-combate', 'don-epico', 'general']) {
    const n = feats.filter((f) => f.category === cat).length
    if (!n) fail(`feats.json no tiene dotes de categoría "${cat}" (las elecciones de clase las necesitan)`)
    else console.log(`  ✓ feats.json: ${n} dotes de categoría "${cat}"`)
  }
}

console.log(problems ? `\n${problems} problemas` : '\nTodo coincide.')
process.exitCode = problems ? 1 : 0
