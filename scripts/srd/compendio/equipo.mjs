// Capítulo "Equipo": armas, armaduras, propiedades de armas, propiedades de
// maestría y equipo de aventureros.
//
// Las tablas de armas y armaduras salen desordenadas en el texto plano: los
// nombres, daños y propiedades vienen en orden, pero las columnas
// Maestría/Peso/Precio aparecen después como secuencias de valores. Se leen
// esas secuencias en orden y se comprueba que cuadran (los valores se han
// cotejado a mano con es.txt y con la tabla inglesa de en.txt).

import { slugify } from '../lib.mjs'
import { srdLines, findLine, pdfItems, leadinIndex, richFromLines, mdTable } from './texto.mjs'
import { applyOverrides, OVERRIDES, T } from './tablas.mjs'

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/** Entradas con encabezado h3 del PDF entre dos páginas y dos líneas. */
function rulesBetween(pFrom, pTo, startLine, endLine, kind, headFilter = () => true) {
  const lines = srdLines()
  const heads = pdfItems()
    .filter((x) => x.p >= pFrom && x.p <= pTo && x.k === 'h3' && headFilter(x))
    .map((x) => x.t)
  const leadins = leadinIndex(pFrom, pTo)
  const pos = []
  let from = startLine
  for (const h of heads) {
    const i = findLine(h, from, endLine)
    pos.push(i)
    from = i + 1
  }
  return heads.map((name, k) => {
    let body = lines.slice(pos[k] + 1, k + 1 < heads.length ? pos[k + 1] : endLine)
    const id = slugify(name.replace(/ \(.*\)$/, ''))
    body = applyOverrides(kind, id, body)
    return { id, head: name, text: richFromLines(body, leadins.near(name), leadins.all) }
  })
}

// ───────────────────────── Propiedades ─────────────────────────

const PROPERTY_NAMES = ['A dos manos', 'Alcance', 'Arrojadiza', 'Gran alcance', 'Ligera', 'Munición', 'Pesada', 'Recarga', 'Sutil', 'Versátil']
export const MASTERY_NAMES = ['Debilitar', 'Derribar', 'Empujar', 'Hender', 'Mellar', 'Molestar', 'Ralentizar', 'Rozar']

export function buildWeaponProperties() {
  const lines = srdLines()
  const start = findLine('Aquí se definen las propiedades que aparecen en la columna “Propiedades” de la tabla “Armas”.', 11000)
  const end = findLine('Propiedades de maestría', start)
  return rulesBetween(97, 98, start, end, 'propiedad', (x) => PROPERTY_NAMES.includes(x.t)).map(({ id, head, text }) => ({ id, name: head, text }))
}

export function buildMasteries() {
  const lines = srdLines()
  const start = findLine('Propiedades de maestría', 11000)
  const end = findLine('Armas', start) // título de la tabla "Armas"
  // el recuadro "Armas improvisadas" cae entre la introducción y "Debilitar": no está dentro de ninguna entrada
  return rulesBetween(98, 98, start, end, 'maestria', (x) => MASTERY_NAMES.includes(x.t)).map(({ id, head, text }) => ({ id, name: head, text }))
}

// ───────────────────────── Armas ─────────────────────────

const WEAPON_CATEGORIES = {
  'Armas cuerpo a cuerpo sencillas': ['sencilla', 'cuerpo-a-cuerpo'],
  'Armas a distancia sencillas': ['sencilla', 'distancia'],
  'Armas cuerpo a cuerpo marciales': ['marcial', 'cuerpo-a-cuerpo'],
  'Armas a distancia marciales': ['marcial', 'distancia'],
}
// Nombre canónico de cada propiedad (la tabla en español mezcla "ligero/ligera", "pesado/pesada"...).
const PROPERTY_CANON = { ligero: 'Ligera', ligera: 'Ligera', arrojadizo: 'Arrojadiza', arrojadiza: 'Arrojadiza', pesado: 'Pesada', pesada: 'Pesada' }

function normProperty(p) {
  const m = p.match(/^(\S+)(.*)$/)
  const canon = PROPERTY_CANON[m[1].toLowerCase()]
  return canon ? canon + m[2] : cap(p)
}

export function buildWeapons() {
  const lines = srdLines()
  const masteryStart = findLine('Propiedades de maestría', 11000)
  const tStart = findLine('Armas', masteryStart)
  const split = findLine('Maestría Peso Precio', tStart)
  const tEnd = findLine('Armaduras', split)

  // 1) nombre, daño y propiedades (en orden, por categoría)
  const rows = []
  let cat = null
  let buf = ''
  const flush = () => {
    if (!cat || !buf) return
    const re = / (\d+d\d+|1) (contundente|perforante|cortante)(?= )/g
    const marks = [...(' ' + buf + ' ').matchAll(re)]
    const s = ' ' + buf + ' '
    let name = s.slice(0, marks[0].index).trim()
    marks.forEach((m, i) => {
      const after = s.slice(m.index + m[0].length, i + 1 < marks.length ? marks[i + 1].index : s.length).trim()
      let props = after
      let nextName = ''
      if (i + 1 < marks.length) {
        const nm = after.match(/^(.*?)\s*([A-ZÁÉÍÓÚ][^A-ZÁÉÍÓÚ]*)$/)
        props = nm[1]
        nextName = nm[2].trim()
      }
      rows.push({ name, damage: m[1], damageType: m[2], props: props.trim(), cat })
      name = nextName
    })
    buf = ''
  }
  for (let i = tStart + 1; i < split; i++) {
    const l = lines[i]
    if (!l || ['Nombre', 'Daño', 'Propiedades'].includes(l)) continue
    if (WEAPON_CATEGORIES[l]) {
      flush()
      cat = WEAPON_CATEGORIES[l]
      continue
    }
    buf = buf ? buf + ' ' + l : l
  }
  flush()

  // 2) secuencias de maestría, peso y precio
  const rest = lines.slice(split + 1, tEnd).join(' ')
  const masteries = [...rest.matchAll(new RegExp(`\\b(${MASTERY_NAMES.join('|')})\\b`, 'g'))].map((m) => m[1])
  const weights = [...rest.matchAll(/(\d+(?:,\d+)? (?:kg|g)|—)/g)].map((m) => m[1])
  const costs = [...rest.matchAll(/(\d+ (?:po|pp|pc))/g)].map((m) => m[1])
  if (![masteries, weights, costs].every((a) => a.length === rows.length)) {
    throw new Error(`Tabla de armas: ${rows.length} armas, ${masteries.length} maestrías, ${weights.length} pesos, ${costs.length} precios`)
  }

  return rows.map((r, i) => ({
    id: slugify(r.name),
    name: r.name,
    category: r.cat[0],
    kind: r.cat[1],
    damage: r.damage,
    damageType: r.damageType,
    properties: r.props === '—' ? [] : r.props.split(/, (?![^()]*\))/).map(normProperty),
    mastery: slugify(masteries[i]),
    weight: weights[i],
    cost: costs[i],
  }))
}

// ───────────────────────── Armaduras ─────────────────────────

const ARMORS = [
  ['Armadura acolchada', 'ligera'],
  ['Armadura de cuero', 'ligera'],
  ['Armadura de cuero tachonado', 'ligera'],
  ['Armadura de pieles', 'media'],
  ['Camisa de malla', 'media'],
  ['Cota de escamas', 'media'],
  ['Coraza', 'media'],
  ['Media armadura', 'media'],
  ['Cota guarnecida', 'pesada'],
  ['Cota de malla', 'pesada'],
  ['Armadura de bandas', 'pesada'],
  ['Armadura de placas', 'pesada'],
  ['Escudo', 'escudo'],
]

export function buildArmor() {
  const lines = srdLines()
  const a = findLine('Armaduras', findLine('Solo un tipo', 11000)) // título de la tabla
  const sig = findLine('Sigilo', a)
  const end = findLine('Herramientas', sig)
  const first = lines.slice(a + 1, sig).filter(Boolean)
  const firstText = first.join(' ')
  // los nombres deben aparecer (el de cuero tachonado sale partido: "Armadura de cuero 12 + ... tachonado")
  for (const [n] of ARMORS) {
    const probe = n === 'Armadura de cuero tachonado' ? 'tachonado' : n
    if (!firstText.includes(probe)) throw new Error(`Armadura no encontrada en la tabla: ${n}`)
  }
  const acs = []
  const strs = []
  for (const l of first) {
    if (/^Armaduras (ligeras|medias|pesadas)|^Escudos \(|^Armadura$|^Clase de armadura|^Fuerza$/.test(l)) continue
    for (const m of l.matchAll(/(\d+) \+ modificador por Des( \(máx\. 2\))?|Fue (\d+)|—|\+2|\b(\d+)\b/g)) {
      if (m[1]) acs.push(Number(m[1]))
      else if (m[3]) strs.push(Number(m[3]))
      else if (m[0] === '—') strs.push(null)
      else if (m[0] === '+2') acs.push(2)
      else acs.push(Number(m[4])) // armaduras pesadas: CA fija
    }
  }
  const rest = lines.slice(sig + 1, end).join(' ')
  const peso = rest.indexOf('Peso Precio')
  const stealth = [...rest.slice(0, peso).matchAll(/Desventaja|—/g)].map((m) => m[0] === 'Desventaja')
  const weights = [...rest.slice(peso).matchAll(/(\d+(?:,\d+)? kg)/g)].map((m) => m[1])
  const costs = [...rest.slice(peso).matchAll(/(\d+ po)/g)].map((m) => m[1])
  const n = ARMORS.length
  if (![acs, strs, stealth, weights, costs].every((x) => x.length === n)) {
    throw new Error(`Tabla de armaduras: CA ${acs.length}, Fue ${strs.length}, sigilo ${stealth.length}, peso ${weights.length}, precio ${costs.length}`)
  }
  return ARMORS.map(([name, category], i) => {
    const o = {
      id: slugify(name),
      name,
      category,
      baseAC: acs[i],
      dexCap: category === 'ligera' ? null : category === 'media' ? 2 : category === 'pesada' ? 0 : null,
    }
    if (strs[i]) o.strength = strs[i]
    o.stealthDisadvantage = stealth[i]
    o.weight = weights[i]
    o.cost = costs[i]
    return o
  })
}

// ───────────────────────── Equipo de aventureros ─────────────────────────

OVERRIDES.push(
  // la tabla general cae dentro del texto de "Abrojos"
  { kind: 'equipo', id: 'abrojos', from: 'Equipo de aventureros', to: '1 po 2 pc 50 po', lines: [] },
  {
    kind: 'equipo',
    id: 'canalizador-arcano',
    from: 'Canalizadores arcanos',
    to: '20 po 10 po 10 po',
    lines: T('Canalizadores arcanos', ['Canalizador', 'Peso', 'Precio'], [
      ['Bastón', '2 kg', '5 po'],
      ['Cristal', '0,5 kg', '10 po'],
      ['Orbe', '1,5 kg', '20 po'],
      ['Vara', '1 kg', '10 po'],
      ['Varita', '0,5 kg', '10 po'],
    ]),
  },
  {
    kind: 'equipo',
    id: 'canalizador-druidico',
    from: 'Canalizadores druídicos',
    to: '— 1 po 0,5 kg 10 po',
    lines: T('Canalizadores druídicos', ['Canalizador', 'Peso', 'Precio'], [
      ['Bastón de madera (también bastón)', '2 kg', '5 po'],
      ['Rama de muérdago', '—', '1 po'],
      ['Varita de tejo', '0,5 kg', '10 po'],
    ]),
  },
  {
    kind: 'equipo',
    id: 'municion',
    from: 'Munición',
    to: '20 Estuche',
    lines: T('Munición', ['Tipo', 'Cantidad', 'Recipiente', 'Peso', 'Precio'], [
      ['Balas de arma de fuego', '10', 'Bolsa', '1 kg', '3 po'],
      ['Dardos', '50', 'Bolsa', '0,5 kg', '1 po'],
      ['Flechas', '20', 'Aljaba', '0,5 kg', '1 po'],
      ['Proyectiles de honda', '20', 'Bolsa', '0,75 kg', '4 pc'],
      ['Virotes', '20', 'Estuche', '0,75 kg', '1 po'],
    ]),
  },
  {
    kind: 'equipo',
    id: 'simbolo-sagrado',
    from: 'Símbolos sagrados',
    to: '— 5 po 1 kg 5 po',
    lines: T('Símbolos sagrados', ['Símbolo', 'Peso', 'Precio'], [
      ['Amuleto (puesto o sostenido)', '0,5 kg', '5 po'],
      ['Emblema (en tela o en escudo)', '—', '5 po'],
      ['Relicario (sostenido)', '1 kg', '5 po'],
    ]),
  },
)

/** Pesos (y precios, para comprobar) de la tabla "Equipo de aventureros". */
function gearTable() {
  const lines = srdLines()
  const o1 = lines.findIndex((l) => l.startsWith('Objeto Abrojos'))
  const o2 = lines.findIndex((l, i) => i > o1 && l.startsWith('Objeto Mochila'))
  const endT = lines.findIndex((l, i) => i > o2 && l.startsWith('Aceite ('))
  const TOK = /\(llena\)|—|Variable|\d+(?:,\d+)? (?:kg|g)|\d+ (?:po|pp|pc)/g
  // parte 1: pares peso-precio seguidos
  const t1 = lines.slice(o1 + 1, o2).filter((l) => !l.startsWith('Catalejo') && l).join(' ')
  const pairs = []
  let pending = null
  for (const m of t1.matchAll(TOK)) {
    const t = m[0]
    if (t === '(llena)') {
      pairs[pairs.length - 1][0] += ' (llena)'
      continue
    }
    if (pending === null) pending = t
    else {
      pairs.push([pending, t])
      pending = null
    }
  }
  // parte 2: líneas de pesos y líneas de precios intercaladas
  const w2 = []
  const c2 = []
  for (const l of lines.slice(o2 + 1, endT)) {
    if (!l) continue
    const toks = [...l.matchAll(TOK)].map((m) => m[0])
    if (/\d (po|pp|pc)\b/.test(l)) c2.push(...toks)
    else w2.push(...toks)
  }
  const names1 = lines[o1].replace(/^Objeto /, '') + ' ' + lines[o1 + 1]
  return { pairs, w2, c2, names1 }
}

export function buildGear() {
  const lines = srdLines()
  const start = findLine('Equipo de aventureros', 11000)
  const end = findLine('Monturas y vehículos', start)
  // solo los encabezados posteriores al h1 "Equipo de aventureros" (en la pág. 102 aún hay herramientas)
  const items = pdfItems()
  const h1 = items.findIndex((x) => x.k === 'h1' && x.t === 'Equipo de aventureros')
  const after = new Set(items.slice(h1))
  const entries = rulesBetween(102, 108, start, end, 'equipo', (x) => after.has(x))
  const { pairs, w2, c2 } = gearTable()

  // la tabla tiene una fila por objeto, salvo el pergamino de conjuro, que tiene dos
  const rowsNeeded = entries.length + 1
  if (pairs.length + w2.length !== rowsNeeded || w2.length !== c2.length) {
    throw new Error(`Tabla de equipo: ${entries.length} objetos, ${pairs.length}+${w2.length} pesos, ${c2.length} precios parte 2`)
  }
  const table = [...pairs, ...w2.map((w, i) => [w, c2[i]])]

  let row = 0
  return entries.map(({ id, head, text }) => {
    const m = head.match(/^(.*) \((.+)\)$/)
    const name = m[1]
    let cost = m[2] === 'variable' ? 'Variable' : m[2]
    let [weight, tcost] = table[row++]
    if (name === 'Pergamino de conjuro') {
      const [w2b, c2b] = table[row++]
      tcost = `truco, ${tcost}; nivel 1, ${c2b}`
      if (w2b !== weight) weight = `${weight} / ${w2b}`
    }
    if (tcost.toLowerCase() !== cost.toLowerCase()) throw new Error(`Precio distinto en tabla y texto para ${name}: ${tcost} / ${cost}`)
    return { id, name, weight, cost, text }
  })
}

export { mdTable }
