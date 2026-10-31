// Validación de classes.json / subclasses.json / spell-slots.json.
// Comprueba estructura, higiene del texto y contrasta los números de las tablas
// con las tablas en inglés (en.txt, -layout) y en español (es.txt, -layout).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { APP_DIR, slugify } from '../lib.mjs'

const CLASS_IDS = ['barbaro', 'bardo', 'brujo', 'clerigo', 'druida', 'explorador', 'guerrero', 'hechicero', 'mago', 'monje', 'paladin', 'picaro']
const EN_TITLE = {
  barbaro: 'Barbarian',
  bardo: 'Bard',
  brujo: 'Warlock',
  clerigo: 'Cleric',
  druida: 'Druid',
  explorador: 'Ranger',
  guerrero: 'Fighter',
  hechicero: 'Sorcerer',
  mago: 'Wizard',
  monje: 'Monk',
  paladin: 'Paladin',
  picaro: 'Rogue',
}
const ES_TITLE = {
  barbaro: 'bárbaro',
  bardo: 'bardo',
  brujo: 'brujo',
  clerigo: 'clérigo',
  druida: 'druida',
  explorador: 'explorador',
  guerrero: 'guerrero',
  hechicero: 'hechicero',
  mago: 'mago',
  monje: 'monje',
  paladin: 'paladín',
  picaro: 'pícaro',
}
const ASI_LEVELS = { guerrero: [4, 6, 8, 12, 14, 16], picaro: [4, 8, 10, 12, 16] }
const RECHARGES = new Set(['corto', 'largo', 'corto-uno', 'amanecer'])
const CHOICE_KINDS = new Set([
  'subclase', 'dote', 'dote-origen', 'don-epico', 'estilo-combate', 'pericia', 'habilidad', 'maestria-armas',
  'metamagia', 'invocacion', 'truco', 'conjuro', 'idioma', 'herramienta', 'opcion',
])

const readLines = (name) =>
  readFileSync(resolve(APP_DIR, '../srd/text', name), 'utf8').replace(/\r/g, '').split('\n')

// ---------------------------------------------------------------------------
// Búsqueda de una columna en una tabla -layout: se buscan todas las franjas
// horizontales [x0, x0+w] cuyos valores, leídos de arriba abajo, coincidan
// exactamente con los 20 esperados.

const VALUE = /^(\+?\d+(,\d+)?|—|[dD]\d+|\d+d\d+)$/
function tableTokens(lines, start, end) {
  const toks = []
  for (let i = start; i < end; i++) {
    for (const m of lines[i].matchAll(/\S+/g)) {
      if (VALUE.test(m[0])) toks.push({ line: i, x: m.index, xe: m.index + m[0].length, v: m[0].toLowerCase() })
    }
  }
  return toks
}
function searchColumn(toks, exp) {
  for (const anchor of ['x', 'xe']) {
    const xs = [...new Set(toks.map((t) => t[anchor]))]
    for (const x0 of xs) {
      for (let w = 0; w <= 3; w++) {
        const col = toks.filter((t) => t[anchor] >= x0 && t[anchor] <= x0 + w).sort((a, b) => a.line - b.line || a.x - b.x)
        const vals = col.map((t) => t.v)
        // la columna puede incluir la cabecera numérica (p. ej. "1 2 3 4 5"): se busca la secuencia contigua
        for (let k = 0; k + exp.length <= vals.length; k++) {
          if (exp.every((e, j) => vals[k + j] === e)) return { x: x0, w, anchor, first: col[k] }
        }
      }
    }
  }
  return null
}
function findColumn(toks, expected) {
  const exp = expected.map((v) => String(v).toLowerCase())
  const full = searchColumn(toks, exp)
  if (full) return full
  // En algunas tablas la fila del nivel 1 está desplazada unas columnas (va en
  // la línea de cabecera). Se acepta si los niveles 2-20 forman columna y el
  // valor del nivel 1 aparece justo encima, cerca horizontalmente.
  const rest = searchColumn(toks, exp.slice(1))
  if (!rest) return null
  const f = rest.first
  const above = toks.find((t) => t.v === exp[0] && t.line < f.line && t.line >= f.line - 7 && Math.abs(t.x - f.x) <= 8)
  return above ? { ...rest, shifted: true } : null
}
function slotRows(lines, start, end, cells) {
  const rows = []
  for (let i = start; i < end; i++) {
    for (const m of lines[i].matchAll(new RegExp(`(?<![\\d—])((?:[\\d—] ?){${cells}})(?![\\d—])`, 'g'))) {
      const compact = m[1].replace(/\s/g, '')
      if (compact.length === cells && /^[1-4]/.test(compact)) rows.push(compact)
    }
  }
  return rows
}
const slotStr = (row, cells) => row.slice(0, cells).map((n) => (n === 0 ? '—' : String(n))).join('')
function containsSeq(haystack, needle) {
  for (let k = 0; k + needle.length <= haystack.length; k++) if (needle.every((n, j) => haystack[k + j] === n)) return true
  return false
}

function tableRegion(lines, titleRe) {
  const start = lines.findIndex((l) => titleRe.test(l))
  if (start < 0) return null
  return [start, Math.min(lines.length, start + 75)]
}

// ---------------------------------------------------------------------------

export function validate({ classes, subclasses, slots, spellDescriptions, leadInsSeen }) {
  const errors = []
  const info = []
  const err = (m) => errors.push(m)
  const EN = readLines('en.txt')
  const ES = readLines('es.txt')

  // 1. Clases e ids
  const ids = classes.map((c) => c.id)
  if (JSON.stringify(ids) !== JSON.stringify(CLASS_IDS)) err(`ids de clase: ${ids.join(',')}`)
  if (subclasses.length !== 12) err(`subclases: ${subclasses.length}`)

  const is20 = (arr, what) => {
    if (!Array.isArray(arr) || arr.length !== 20) err(`${what}: no tiene 20 valores`)
  }
  const allFeatureIds = new Map()
  const regFeature = (f, owner) => {
    if (allFeatureIds.has(f.id)) err(`id de rasgo repetido: ${f.id} (${owner} y ${allFeatureIds.get(f.id)})`)
    allFeatureIds.set(f.id, owner)
  }

  const checkText = (txt, where) => {
    if (!txt) return err(`${where}: texto vacío`)
    if (/Documento de referencia|5\.2\.1/.test(txt)) err(`${where}: pie de página en el texto`)
    if (/[­‑]/.test(txt)) err(`${where}: guiones del PDF`)
    if (/[a-záéíóúñ]- [a-záéíóúñ]/.test(txt)) err(`${where}: palabra partida con guion`)
    if (/—{3,}/.test(txt)) err(`${where}: restos de tabla (rayas)`)
    if (/(^|\n)[\d +—]+(\n|$)/.test(txt)) err(`${where}: línea solo con números`)
    if (/ {2,}/.test(txt.replace(/\n\|.*$/gm, ''))) err(`${where}: espacios dobles`)
    if ((txt.match(/\*\*/g) || []).length % 2) err(`${where}: negrita desequilibrada`)
    for (const p of txt.split(/\n\n/)) {
      if (p.startsWith('|') || /^\*\*[^*]+\*\*$/.test(p)) continue
      if (!/[.:;!?…]["”»)]?$|[.:;!?]\)$|\*\*$/.test(p.split('\n').pop())) err(`${where}: párrafo sin cerrar: …${p.slice(-60)}`)
    }
  }
  const checkResources = (res, where) => {
    for (const r of res || []) {
      if (!RECHARGES.has(r.recharge)) err(`${where}/${r.id}: recarga ${r.recharge}`)
      if (r.max.perLevel) is20(r.max.perLevel, `${where}/${r.id}.perLevel`)
      if (r.die) is20(r.die, `${where}/${r.id}.die`)
      const shapes = ['perLevel', 'abilityMod', 'levelTimes', 'proficiencyBonus'].filter((k) => k in r.max)
      if (shapes.length !== 1) err(`${where}/${r.id}: max mal formado`)
    }
  }
  const checkChoice = (c, f, where) => {
    if (!c) return
    if (!CHOICE_KINDS.has(c.kind)) err(`${where}: tipo de elección ${c.kind}`)
    if (c.id !== f.id) err(`${where}: choice.id ≠ id del rasgo`)
    if (!(c.count >= 1)) err(`${where}: count ${c.count}`)
    if (c.kind === 'opcion' && !c.options?.length && !c.note) err(`${where}: opción sin opciones ni nota`)
    for (const o of c.options || []) if (o.text) checkText(o.text, `${where}/opción ${o.id}`)
  }

  let featureCount = 0
  for (const c of classes) {
    const where = c.id
    for (const col of c.columns) is20(col.values, `${where}.columns.${col.key}`)
    if (c.spellcasting) {
      is20(c.spellcasting.cantrips, `${where}.cantrips`)
      is20(c.spellcasting.prepared, `${where}.prepared`)
    }
    if (c.weaponMastery) is20(c.weaponMastery, `${where}.weaponMastery`)
    let prev = 0
    for (const f of c.features) {
      featureCount++
      regFeature(f, c.id)
      if (f.level < prev) err(`${where}: rasgos desordenados en ${f.id}`)
      prev = f.level
      if (f.level < 1 || f.level > 20) err(`${f.id}: nivel ${f.level}`)
      checkText(f.text, f.id)
      checkChoice(f.choice, f, f.id)
      checkResources(f.resources, f.id)
    }
    // Mejoras de característica, don épico y subclase
    const asi = c.features.filter((f) => f.choice?.kind === 'dote').map((f) => f.level)
    const expAsi = ASI_LEVELS[c.id] || [4, 8, 12, 16]
    if (JSON.stringify(asi) !== JSON.stringify(expAsi)) err(`${where}: mejoras de característica en ${asi} (esperado ${expAsi})`)
    if (!c.features.some((f) => f.level === 19 && f.choice?.kind === 'don-epico')) err(`${where}: falta Don épico en nivel 19`)
    const subF = c.features.find((f) => f.choice?.kind === 'subclase')
    if (!subF || subF.level !== 3) err(`${where}: falta elección de subclase en nivel 3`)
    const sub = subclasses.find((s) => s.classId === c.id)
    if (!sub || subF?.choice.options[0].id !== sub.id || c.subclasses[0] !== sub.id) err(`${where}: subclase no enlazada`)
    const placeholders = c.features.filter((f) => f.name === 'Rasgo de subclase').map((f) => f.level)
    const subLevels = [...new Set(sub.features.map((f) => f.level).filter((l) => l > 3))]
    if (JSON.stringify(placeholders) !== JSON.stringify(subLevels)) err(`${where}: "Rasgo de subclase" en ${placeholders}, la subclase tiene rasgos en ${subLevels}`)
    // nivel 20 con algo
    if (!c.features.some((f) => f.level === 20)) err(`${where}: sin rasgo de nivel 20`)

    // Conjuros
    if (c.spellcasting) {
      if (!c.spellList?.length) err(`${where}: spellList vacía`)
      const missing = (c.spellList || []).filter((s) => !spellDescriptions.has(s))
      if (missing.length) err(`${where}: conjuros sin descripción: ${missing.join(', ')}`)
    }
    for (const ap of c.alwaysPrepared || []) {
      for (const s of ap.spells) if (!spellDescriptions.has(s)) err(`${where}.alwaysPrepared: ${s} no existe`)
    }
  }

  let subFeatureCount = 0
  for (const s of subclasses) {
    checkText(s.text, `${s.id}.text`)
    let prev = 0
    for (const f of s.features) {
      subFeatureCount++
      regFeature(f, s.id)
      if (f.level < prev) err(`${s.id}: rasgos desordenados en ${f.id}`)
      prev = f.level
      checkText(f.text, f.id)
      checkChoice(f.choice, f, f.id)
      checkResources(f.resources, f.id)
    }
    if (s.features[0]?.level !== 3) err(`${s.id}: el primer rasgo no es de nivel 3`)
    const aps = [...(s.alwaysPrepared || []), ...Object.values(s.alwaysPreparedByOption?.options || {}).flat()]
    for (const ap of aps) for (const sp of ap.spells) if (!spellDescriptions.has(sp)) err(`${s.id}.alwaysPrepared: ${sp} no existe`)
  }

  // ---------------------------------------------------------------------------
  // Contraste numérico con las tablas en inglés y en español
  const feetOf = { '+3 m': '+10', '+4,5 m': '+15', '+6 m': '+20', '+7,5 m': '+25', '+9 m': '+30' }
  const numericLines = []
  for (const c of classes) {
    const enR = tableRegion(EN, new RegExp(`^\\s*${EN_TITLE[c.id]} Features\\s*$`))
    const esR = tableRegion(ES, new RegExp(`^\\s*Rasgos de ${ES_TITLE[c.id]}\\s*$`))
    const enT = enR ? tableTokens(EN, ...enR) : []
    const esT = esR ? tableTokens(ES, ...esR) : []
    const cols = c.columns.map((col) => ({ label: col.label, values: col.values }))
    if (c.spellcasting) {
      if (c.spellcasting.cantrips.some((n) => n > 0)) cols.push({ label: 'Trucos', values: c.spellcasting.cantrips })
      cols.push({ label: 'Conjuros preparados', values: c.spellcasting.prepared })
    }
    if (c.id === 'brujo') {
      cols.push({ label: 'Espacios (pacto)', values: slots.pacto.slots }, { label: 'Nivel de espacio (pacto)', values: slots.pacto.slotLevel })
    }
    const res = []
    for (const col of cols) {
      const enVals = col.values.map((v) => feetOf[v] ?? v)
      const enOk = findColumn(enT, enVals)
      // en español "+4,5 m" se parte en "+4,5" y "m"
      const esOk = findColumn(esT, col.values.map((v) => (typeof v === 'string' ? v.replace(/ m$/, '') : v)))
      if (!enOk) err(`${c.id}: columna "${col.label}" no coincide con la tabla en inglés`)
      res.push(`${col.label} EN${enOk ? (enOk.shifted ? "✓*" : "✓") : "✗"} ES${esOk ? (esOk.shifted ? "✓*" : "✓") : "·"}`)
    }
    // espacios de conjuro de la tabla de la clase
    if (c.spellcasting && c.spellcasting.progression !== 'pacto') {
      const cells = c.spellcasting.progression === 'completo' ? 9 : 5
      const exp = slots[c.spellcasting.progression].map((r) => slotStr(r, cells))
      const enOk = enR && containsSeq(slotRows(EN, ...enR, cells), exp)
      const esOk = esR && containsSeq(slotRows(ES, ...esR, cells), exp)
      if (!enOk) err(`${c.id}: espacios de conjuro no coinciden con la tabla en inglés`)
      res.push(`Espacios EN${enOk ? '✓' : '✗'} ES${esOk ? '✓' : '·'}`)
    }
    numericLines.push(`  ${c.id}: ${res.join(', ') || '(sin columnas numéricas)'}`)
  }
  // Tabla multiclase
  const mcEn = EN.findIndex((l) => /Multiclass Spellcaster:/.test(l))
  const mcRows = []
  for (let i = mcEn; i < mcEn + 30; i++) {
    const m = EN[i].match(/^\s{2,8}(\d{1,2}) ((?:[\d—] ?){9})/)
    if (m && Number(m[1]) === mcRows.length + 1) mcRows.push(m[2].replace(/\s/g, ''))
  }
  if (JSON.stringify(mcRows) !== JSON.stringify(slots.completo.map((r) => slotStr(r, 9))))
    err('spell-slots.completo no coincide con la tabla multiclase en inglés')
  if (slots.completo.length !== 20 || slots.medio.length !== 20) err('spell-slots: filas ≠ 20')
  for (const t of ['completo', 'medio']) for (const r of slots[t]) if (r.length !== 9) err(`spell-slots.${t}: fila sin 9 valores`)
  if (slots.medio[0][0] !== 2) err('spell-slots.medio: un lanzador medio de nivel 1 debería tener 2 espacios')

  // ---------------------------------------------------------------------------
  // Listas de conjuros contra las descripciones
  const listLines = []
  for (const c of classes.filter((x) => x.spellList)) {
    const byLevel = {}
    for (const s of c.spellList) {
      const l = spellDescriptions.get(s)?.level
      byLevel[l] = (byLevel[l] || 0) + 1
    }
    listLines.push(`  ${c.id}: ${c.spellList.length} (${Object.entries(byLevel).map(([l, n]) => `${l === '0' ? 'T' : 'N' + l}:${n}`).join(' ')})`)
  }

  const summary = [
    `Rasgos de clase: ${featureCount}; rasgos de subclase: ${subFeatureCount}; ids únicos: ${allFeatureIds.size}`,
    'Contraste de tablas (EN = en.txt obligatorio, ES = es.txt informativo; ✓ coincide, · no localizable en la maquetación):',
    ...numericLines,
    'Listas de conjuros (todas las ids existen en "Descripciones de conjuros"):',
    ...listLines,
    `Encabezados en línea detectados: ${leadInsSeen.size}`,
  ].join('\n')
  return { errors, summary }
}
