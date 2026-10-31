// Validación de los JSON del compendio. Se ejecuta al final de build.mjs y
// también por separado:  node scripts/srd/compendio/check.mjs

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OUT_DIR } from '../lib.mjs'

export const EXPECTED = {
  'spells.json': 339, // igual que el SRD 5.2.1 en inglés
  'species.json': 9,
  'backgrounds.json': 4,
  'feats.json': 17,
  'weapons.json': 38,
  'armor.json': 13,
  'masteries.json': 8,
  'weapon-properties.json': 10,
  'glossary.json': 155,
  'gear.json': 81,
}

const CLASS_IDS = ['barbaro', 'bardo', 'brujo', 'clerigo', 'druida', 'explorador', 'guerrero', 'hechicero', 'mago', 'monje', 'paladin', 'picaro']
const SKILLS = ['acrobacias', 'arcanos', 'atletismo', 'engano', 'historia', 'interpretacion', 'intimidacion', 'investigacion', 'juego-de-manos', 'medicina', 'naturaleza', 'percepcion', 'perspicacia', 'persuasion', 'religion', 'sigilo', 'supervivencia', 'trato-con-animales']
const ABILITIES = ['fue', 'des', 'con', 'int', 'sab', 'car']
const SPELL_HEADER = /(Abjuración|Adivinación|Conjuración|Encantamiento|Evocación|Ilusionismo|Nigromancia|Transmutación) de nivel \d \(|Truco de [a-záéíóú]+ \(|Tiempo de lanzamiento:/
const ARTIFACTS = [
  ['pie de página', /Documento de referencia del sistema/],
  ['guion U+2011', /‑/],
  ['guion blando', /­/],
  ['espacio de ancho cero', /​/],
  ['restos de perfil', /MOD\. SALV\./],
  ['salto de línea triple', /\n\n\n/],
  ['espacio doble', / {2}/],
]

/** Recorre todos los strings de un valor JSON con su ruta. */
function* strings(v, path = '') {
  if (typeof v === 'string') yield [path, v]
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* strings(v[i], `${path}[${i}]`)
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) yield* strings(x, path ? `${path}.${k}` : k)
}

/** Comprueba bloques de tabla Markdown y negritas de un RichText. */
function richProblems(t) {
  const out = []
  if ((t.match(/\*\*/g) ?? []).length % 2) out.push('negritas desparejadas')
  for (const block of t.split('\n\n')) {
    const ls = block.split('\n')
    if (!ls[0].startsWith('|')) {
      if (ls.some((l) => l.startsWith('|'))) out.push('tabla pegada a un párrafo')
      continue
    }
    if (!/^\|(---\|)+$/.test(ls[1] ?? '')) out.push('tabla sin separador')
    const cols = ls[0].split('|').length
    if (ls.some((l) => !l.startsWith('|') || !l.endsWith('|') || l.split('|').length !== cols)) out.push('tabla con columnas irregulares')
  }
  return out
}

export function runChecks(data) {
  const errors = []
  const warn = []
  const err = (file, msg) => errors.push(`${file}: ${msg}`)

  for (const [file, arr] of Object.entries(data)) {
    if (!Array.isArray(arr)) {
      err(file, 'no es un array')
      continue
    }
    if (EXPECTED[file] !== undefined && arr.length !== EXPECTED[file]) err(file, `${arr.length} entradas, se esperaban ${EXPECTED[file]}`)
    const ids = new Set()
    const names = new Set(arr.map((x) => x.name))
    for (const x of arr) {
      if (!x.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(x.id)) err(file, `id no válido "${x.id}"`)
      if (ids.has(x.id)) err(file, `id duplicado ${x.id}`)
      ids.add(x.id)
      if (!x.name) err(file, `${x.id}: sin nombre`)
      if ('text' in x && !String(x.text ?? '').trim()) err(file, `${x.id}: text vacío`)
      for (const [path, s] of strings(x)) {
        if (!s.trim() && path !== 'note') err(file, `${x.id}.${path}: cadena vacía`)
        for (const [what, re] of ARTIFACTS) if (re.test(s)) err(file, `${x.id}.${path}: ${what}`)
        if (/(^|\.)(text|higherLevels)$/.test(path)) {
          for (const p of richProblems(s)) err(file, `${x.id}.${path}: ${p}`)
          // un párrafo que es exactamente el nombre de otra entrada = entradas pegadas
          for (const para of s.split(/\n+/)) if (para !== x.name && names.has(para)) err(file, `${x.id}.${path}: contiene el encabezado "${para}"`)
        }
      }
    }
  }

  // ── conjuros
  const spells = data['spells.json'] ?? []
  for (const s of spells) {
    for (const f of ['name', 'school', 'castingTime', 'range', 'components', 'duration', 'text']) if (!s[f]) err('spells.json', `${s.id}: ${f} vacío`)
    if (!(s.level >= 0 && s.level <= 9)) err('spells.json', `${s.id}: nivel ${s.level}`)
    if (!s.classes?.length) err('spells.json', `${s.id}: sin clases`)
    for (const c of s.classes ?? []) if (!CLASS_IDS.includes(c)) err('spells.json', `${s.id}: clase desconocida ${c}`)
    if (SPELL_HEADER.test(s.text) || SPELL_HEADER.test(s.higherLevels ?? '')) err('spells.json', `${s.id}: contiene una cabecera de conjuro`)
    if (s.concentration !== /^Concentración/.test(s.duration)) err('spells.json', `${s.id}: concentración incoherente`)
    if (s.higherLevels && !/^\*\*(Con un espacio de conjuro de nivel superior|Mejora de truco)\.\*\*/.test(s.higherLevels)) err('spells.json', `${s.id}: higherLevels raro`)
    if (s.level === 0 && s.higherLevels && !s.higherLevels.startsWith('**Mejora de truco.**')) err('spells.json', `${s.id}: truco con mejora de espacio`)
  }
  if (spells.length) {
    const n = (f) => spells.filter(f).length
    // cifras del SRD 5.2.1 en inglés (en.txt)
    if (n((s) => s.ritual) !== 29) err('spells.json', `rituales: ${n((s) => s.ritual)} (inglés: 29)`)
    if (n((s) => s.concentration) !== 133) err('spells.json', `concentración: ${n((s) => s.concentration)} (inglés: 133)`)
    if (n((s) => s.higherLevels) !== 124) err('spells.json', `con mejora: ${n((s) => s.higherLevels)} (inglés: 109 + 15 = 124)`)
  }

  // ── especies, trasfondos, dotes
  for (const sp of data['species.json'] ?? []) {
    if (!sp.summary) err('species.json', `${sp.id}: sin resumen`)
    if (!sp.sizes?.length || !(sp.speed > 0)) err('species.json', `${sp.id}: tamaño/velocidad`)
    for (const t of sp.traits) if (!t.summary) err('species.json', `${t.id}: sin resumen`)
    for (const c of sp.choices ?? []) {
      if (c.kind === 'opcion' && !c.options?.length) err('species.json', `${c.id}: elección sin opciones`)
      for (const o of c.options ?? []) if (c.kind === 'habilidad' && !SKILLS.includes(o.id)) err('species.json', `${c.id}: habilidad ${o.id}`)
      // Conjuros de linaje: tienen que existir y ser del nivel que toca (truco a nivel 1).
      for (const o of c.options ?? [])
        for (const x of o.spells ?? []) {
          const s = spells.find((y) => y.id === x.id)
          if (!s) err('species.json', `${c.id}/${o.id}: conjuro ${x.id} no existe`)
          else if (x.level === 1 && s.level !== 0 && !x.freeCast) err('species.json', `${c.id}/${o.id}: ${x.id} no es un truco`)
        }
    }
  }
  const featIds = new Set((data['feats.json'] ?? []).map((f) => f.id))
  for (const b of data['backgrounds.json'] ?? []) {
    if (b.abilities.length !== 3 || b.abilities.some((a) => !ABILITIES.includes(a))) err('backgrounds.json', `${b.id}: características`)
    if (b.skills.length !== 2 || b.skills.some((s) => !SKILLS.includes(s))) err('backgrounds.json', `${b.id}: habilidades`)
    if (!featIds.has(b.feat.id)) err('backgrounds.json', `${b.id}: dote ${b.feat.id} no existe`)
    if (b.equipment.length !== 2) err('backgrounds.json', `${b.id}: equipo`)
  }
  for (const f of data['feats.json'] ?? []) {
    if (!f.summary) err('feats.json', `${f.id}: sin resumen`)
    if (f.abilityIncrease && f.abilityIncrease.options.some((a) => !ABILITIES.includes(a))) err('feats.json', `${f.id}: abilityIncrease`)
    if (f.category === 'don-epico' && f.abilityIncrease?.max !== 30) err('feats.json', `${f.id}: los dones épicos suben hasta 30`)
  }

  // ── armas y armaduras
  const masteryIds = new Set((data['masteries.json'] ?? []).map((m) => m.id))
  const propIds = new Set((data['weapon-properties.json'] ?? []).map((m) => m.id))
  for (const w of data['weapons.json'] ?? []) {
    if (!masteryIds.has(w.mastery)) err('weapons.json', `${w.id}: maestría ${w.mastery} no existe`)
    for (const p of w.properties) {
      const base = p.replace(/ \(.*\)$/, '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ /g, '-')
      if (!propIds.has(base)) err('weapons.json', `${w.id}: propiedad "${p}" sin definición`)
    }
    if (!/^(\d+d\d+|1)$/.test(w.damage)) err('weapons.json', `${w.id}: daño ${w.damage}`)
  }
  for (const a of data['armor.json'] ?? []) if (!(a.baseAC > 0)) err('armor.json', `${a.id}: CA`)

  // ── glosario: estados
  const glossary = data['glossary.json'] ?? []
  const estados = glossary.filter((g) => g.tag === 'Estado').map((g) => g.id)
  const ESTADOS = ['agarrado', 'apresado', 'asustado', 'aturdido', 'cansancio', 'cegado', 'derribado', 'ensordecido', 'envenenado', 'hechizado', 'incapacitado', 'inconsciente', 'invisible', 'paralizado', 'petrificado']
  for (const e of ESTADOS) if (!estados.includes(e)) err('glossary.json', `falta el estado ${e}`)
  if (estados.length !== ESTADOS.length) err('glossary.json', `${estados.length} estados (esperados 15)`)

  // ── tabla resumen
  const rows = Object.entries(data).map(([file, arr]) => {
    const fileErrors = errors.filter((e) => e.startsWith(file + ':')).length
    return { archivo: file, entradas: arr.length, esperadas: EXPECTED[file] ?? '-', errores: fileErrors }
  })
  console.table(rows)
  if (spells.length) {
    const byLevel = {}
    for (const s of spells) byLevel[s.level] = (byLevel[s.level] ?? 0) + 1
    console.log('Conjuros por nivel:', JSON.stringify(byLevel), '| rituales', spells.filter((s) => s.ritual).length, '| concentración', spells.filter((s) => s.concentration).length, '| con mejora', spells.filter((s) => s.higherLevels).length)
  }
  for (const w of warn) console.warn('AVISO', w)
  if (errors.length) {
    console.error(`\n${errors.length} errores:`)
    for (const e of errors.slice(0, 80)) console.error(' -', e)
    return false
  }
  console.log('\nValidación correcta.')
  return true
}

// Ejecución directa: valida los JSON ya escritos.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const data = {}
  for (const file of Object.keys(EXPECTED)) data[file] = JSON.parse(readFileSync(resolve(OUT_DIR, file), 'utf8'))
  process.exit(runChecks(data) ? 0 : 1)
}
