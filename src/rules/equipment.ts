// Equipo inicial: convierte el texto de una opción de equipo de clase o trasfondo
// ("cota de malla, espadón, 8 jabalinas, paquete de explorador de mazmorras y 4 po")
// en objetos de la ficha y monedas.
//
// Convenciones (las mismas para todas las clases y trasfondos):
// - Cada trozo del texto da UN objeto o unas monedas. Nada se tira: lo que no se
//   reconoce entra como objeto con su texto tal cual (con mayúscula inicial).
// - Nombre: el del SRD si es un arma, armadura o equipo de los datos ("Jabalina",
//   "Cota de malla", "Ropas de viaje"); si no, el del texto. Siempre en singular
//   con la cantidad en `qty`: "8 jabalinas" -> Jabalina ×8, "2 bolsas" -> Bolsa ×2.
// - Armas y armaduras del SRD llevan `ref` (es lo que usa derive.ts para ataques y
//   CA). Aquí no se marca nada como puesto (`equipped`): eso lo decide el creador
//   según el entrenamiento con armaduras de la clase.
//   La munición ("20 flechas", "virotes") es un objeto normal, sin `ref`.
// - `weight`: el peso de UNA unidad según los datos, si es un número.
// - Paréntesis: el detalle se queda en el NOMBRE, entre paréntesis y tal como
//   viene ("Canalizador arcano (orbe)", "Libro (de oraciones)"), así el nombre
//   empieza siempre por el objeto del SRD. Si el paréntesis es una cantidad
//   ("pergamino (10 hojas)"), el número pasa a `qty` y la unidad se va:
//   "Pergamino" ×10 (cada pergamino del SRD ya es una hoja).
// - Notas (`notes`): solo lo que hace falta saber: qué lleva un paquete, qué es un
//   canalizador mágico (y si además sirve de arma) y qué falta por elegir.
// - Elecciones ("de tu elección", "X o Y", "el mismo que...", "un tipo de..."):
//   objeto genérico con una nota que lo explica y el trozo original en `pending`.

import type { Rules } from './book'
import type { Coins, Item } from '../model/character'

export interface ParsedEquipment {
  items: Item[]
  coins: Partial<Coins>
  /** Partes del texto que piden elegir algo ("un instrumento musical a tu elección"). */
  pending?: string[]
}

/** Lo que sale de cada trozo del texto (para el creador y para los tests). */
export interface EquipmentPart {
  /** El trozo tal como aparece en el texto original. */
  text: string
  item?: Item
  coins?: Partial<Coins>
  /** El trozo pide una elección del jugador: va a `pending`. */
  pending?: boolean
}

// ---------------------------------------------------------------------------
// API

/** Convierte el texto de una opción de equipo en objetos, monedas y elecciones. */
export function parseEquipment(text: string, rules: Rules): ParsedEquipment {
  const parts = parseEquipmentParts(text, rules)
  const items: Item[] = []
  const coins: Partial<Coins> = {}
  const pending: string[] = []
  for (const p of parts) {
    if (p.item) items.push(p.item)
    if (p.coins) addCoins(coins, p.coins)
    if (p.pending) pending.push(p.text)
  }
  return pending.length ? { items, coins, pending } : { items, coins }
}

/** Como parseEquipment, pero trozo a trozo: qué ha salido de cada parte del texto. */
export function parseEquipmentParts(text: string, rules: Rules): EquipmentPart[] {
  const raw = typeof text === 'string' ? text : String(text ?? '')
  let ix: Index
  try {
    ix = indexOf(rules)
  } catch {
    ix = EMPTY_INDEX
  }
  let fragments: string[]
  try {
    fragments = splitEquipment(raw, rules)
  } catch {
    fragments = raw.trim() ? [raw.trim()] : []
  }
  const parts = fragments.map((f) => {
    try {
      return parsePart(f, ix)
    } catch {
      return { text: f, item: plainItem(f) }
    }
  })
  uniqueIds(parts.flatMap((p) => (p.item ? [p.item] : [])))
  return parts
}

/**
 * Parte el texto en trozos: por comas (y punto y coma) y por la «y» final de la
 * lista. No corta dentro de paréntesis ni dentro de un nombre conocido que lleve
 * «y». Cada trozo es un fragmento literal del texto original.
 */
export function splitEquipment(text: string, rules?: Rules): string[] {
  const src = typeof text === 'string' ? text : ''
  let ix = EMPTY_INDEX
  if (rules) {
    try {
      ix = indexOf(rules)
    } catch {
      /* sin índice: se parte igual */
    }
  }
  const segments = splitTopLevel(src, (s, i) => (s[i] === ',' || s[i] === ';' ? 1 : 0))
  const out: string[] = []
  const last = segments.map((x) => cleanEdges(x)).findLastIndex(Boolean)
  segments.forEach((seg, n) => {
    let s = cleanEdges(seg)
    if (!s) return
    // "…, y 4 po": la «y» tras la última coma.
    s = s.replace(/^(?:y|e)\s+/i, '')
    if (/^(?:y|e)$/i.test(s)) return
    if (n === last) {
      const pair = splitLastAnd(s, ix)
      for (const p of pair) if (p) out.push(p)
    } else out.push(s)
  })
  return out
}

// ---------------------------------------------------------------------------
// Índice de nombres (armas, armaduras, munición y equipo de los datos)

type EntryKind = 'arma' | 'armadura' | 'municion' | 'equipo'

interface Entry {
  kind: EntryKind
  id: string
  name: string
  weight?: string
  notes?: string
  /** Canalizador mágico (símbolo sagrado, canalizador arcano o druídico). */
  focus?: boolean
  /** Formas que puede tener el canalizador ("amuleto, emblema o relicario"). */
  forms?: string
}

interface Index {
  exact: Map<string, Entry>
  /** Armas y armaduras, de nombre más largo a más corto ("bastón de madera" -> bastón). */
  prefix: { key: string; entry: Entry }[]
  /** Nombres conocidos que llevan «y» o «e» dentro: no se parten. */
  withAnd: string[]
}

const EMPTY_INDEX: Index = { exact: new Map(), prefix: [], withAnd: [] }

/** La munición del SRD (tabla «Munición» de gear.json), en singular. */
const AMMO: { keys: string[]; name: string }[] = [
  { keys: ['flecha'], name: 'Flecha' },
  { keys: ['virote', 'virote de ballesta'], name: 'Virote' },
  { keys: ['proyectil de honda'], name: 'Proyectil de honda' },
  { keys: ['bala', 'bala de arma de fuego'], name: 'Bala de arma de fuego' },
  { keys: ['aguja', 'aguja de cerbatana'], name: 'Aguja de cerbatana' },
]

/** Otras formas de llamar a armas y armaduras del SRD. */
const ALIASES: { key: string; kind: 'arma' | 'armadura'; id: string }[] = [
  { key: 'armadura de piel', kind: 'armadura', id: 'armadura-de-pieles' },
  { key: 'cuero tachonado', kind: 'armadura', id: 'armadura-de-cuero-tachonado' },
  { key: 'cota de malla', kind: 'armadura', id: 'cota-de-malla' },
  { key: 'cota de mallas', kind: 'armadura', id: 'cota-de-malla' },
  { key: 'camisa de mallas', kind: 'armadura', id: 'camisa-de-malla' },
  { key: 'baston de combate', kind: 'arma', id: 'baston' },
]

/** "8 frascos de aceite", "10 hojas de pergamino": recipiente o unidad + objeto de equipo. */
const CONTAINERS = /^(?:frasco|vial|hoja|botella|saco|bolsa|lote|odre|jarra|caja) (?:de|con) (.+)$/

const cache = new WeakMap<object, Index>()

function indexOf(rules: Rules): Index {
  const hit = cache.get(rules)
  if (hit) return hit
  const book = rules?.book
  const exact = new Map<string, Entry>()
  const put = (k: string, e: Entry) => {
    if (k && !exact.has(k)) exact.set(k, e)
  }
  const prefix: Index['prefix'] = []

  for (const w of book?.weapons ?? []) {
    const e: Entry = { kind: 'arma', id: w.id, name: w.name, weight: concrete(w.weight) }
    put(nameKey(w.name), e)
    prefix.push({ key: nameKey(w.name), entry: e })
  }
  for (const a of book?.armor ?? []) {
    const e: Entry = { kind: 'armadura', id: a.id, name: a.name, weight: concrete(a.weight) }
    put(nameKey(a.name), e)
    prefix.push({ key: nameKey(a.name), entry: e })
  }
  for (const al of ALIASES) {
    const d = al.kind === 'arma' ? book?.weapons?.find((w) => w.id === al.id) : book?.armor?.find((a) => a.id === al.id)
    if (d) put(al.key, { kind: al.kind, id: d.id, name: d.name, weight: concrete(d.weight) })
  }
  for (const am of AMMO) {
    const e: Entry = { kind: 'municion', id: slug(am.name), name: am.name }
    for (const k of am.keys) put(k, e)
  }
  for (const g of book?.gear ?? []) {
    const text = typeof g.text === 'string' ? g.text : ''
    const e: Entry = { kind: 'equipo', id: g.id, name: g.name, weight: concrete(g.weight) }
    const contents = packContents(text)
    if (contents) e.notes = `Contiene ${contents}.`
    if (/canalizador(?:es)? m[aá]gicos?/i.test(text)) {
      e.focus = true
      const forms = tableFirstColumn(text)
      e.notes = 'Canalizador mágico: sustituye a los componentes materiales que no tienen coste.'
      if (forms.length) e.forms = orList(forms)
    }
    put(nameKey(g.name), e)
  }

  prefix.sort((a, b) => b.key.length - a.key.length)
  const withAnd = [...exact.keys()].filter((k) => /\s(?:y|e)\s/.test(k))
  const ix: Index = { exact, prefix, withAnd }
  if (rules && typeof rules === 'object') cache.set(rules, ix)
  return ix
}

/** "Un paquete de erudito contiene los siguientes objetos: 10 frascos de aceite, … y yesquero." */
function packContents(text: string): string | undefined {
  const m = text.match(/contienen? (?:los )?siguientes objetos:\s*([^\n]+)/i)
  return m ? m[1].trim().replace(/\.+$/, '') : undefined
}

/** Primera columna de la tabla markdown del texto, sin la cabecera ni paréntesis. */
function tableFirstColumn(text: string): string[] {
  const rows = text.split('\n').filter((l) => l.trim().startsWith('|'))
  return rows
    .slice(2)
    .map((r) => r.split('|')[1]?.replace(/\([^)]*\)/g, '').trim() ?? '')
    .filter(Boolean)
    .map((s) => s.charAt(0).toLowerCase() + s.slice(1))
}

function orList(xs: string[]): string {
  return xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} o ${xs[xs.length - 1]}`
}

function concrete(w: string | undefined): string | undefined {
  if (!w) return undefined
  const t = w.trim()
  return /\d/.test(t) && !/variable/i.test(t) ? t : undefined
}

// ---------------------------------------------------------------------------
// Partir el texto

/** Parte `s` por los separadores que diga `sep` (longitud del separador en i) fuera de paréntesis. */
function splitTopLevel(s: string, sep: (s: string, i: number) => number): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '(' || ch === '[' || ch === '{' || ch === '«') depth++
    else if ((ch === ')' || ch === ']' || ch === '}' || ch === '»') && depth > 0) depth--
    else if (depth === 0) {
      const n = sep(s, i)
      if (n > 0) {
        out.push(s.slice(start, i))
        start = i + n
        i += n - 1
      }
    }
  }
  out.push(s.slice(start))
  return out
}

/** Quita espacios y puntuación suelta de los bordes (sin tocar paréntesis). */
function cleanEdges(s: string): string {
  return s.replace(/^[\s,;:.]+/, '').replace(/[\s,;:.]+$/, '')
}

/** Corta "paquete de explorador y 15 po" por la última «y»/«e» fuera de paréntesis. */
function splitLastAnd(s: string, ix: Index): string[] {
  const positions: number[] = []
  splitTopLevel(s, (str, i) => {
    if (/\s/.test(str[i]) && /^\s(?:y|e)\s/i.test(str.slice(i, i + 3))) positions.push(i)
    return 0
  })
  for (let n = positions.length - 1; n >= 0; n--) {
    const i = positions[n]
    const left = cleanEdges(s.slice(0, i))
    const right = cleanEdges(s.slice(i + 3))
    if (!left || !right) continue
    // No partir un nombre conocido que lleve «y» ("…de pintor y …").
    const whole = nameKey(stripQty(s))
    if (ix.withAnd.some((k) => whole === k || whole.startsWith(k + ' ') || whole.endsWith(' ' + k))) continue
    return [left, right]
  }
  return [s]
}

// ---------------------------------------------------------------------------
// Cada trozo

function parsePart(text: string, ix: Index): EquipmentPart {
  const clean = cleanEdges(text)
  if (!clean) return { text }
  const coins = coinsOf(clean)
  if (coins) return { text, coins }
  // "bolsa con 15 po"
  const withCoins = clean.match(/^(.+?)\s+con\s+(\S+\s*(?:pc|pp|pe|po|ppt))$/i)
  if (withCoins) {
    const c = coinsOf(withCoins[2])
    if (c) return { text, coins: c, ...itemOf(withCoins[1], ix) }
  }
  return { text, ...itemOf(clean, ix) }
}

function itemOf(clean: string, ix: Index): { item: Item; pending?: boolean } {
  const { qty, rest, counted } = takeQty(clean)
  const { base, details } = takeParens(rest)
  let n = qty
  const shown: string[] = []
  const choiceDetails: string[] = []
  for (const d of details) {
    if (isChoiceText(d)) {
      choiceDetails.push(d)
      continue
    }
    const c = countDetail(d)
    if (c) n *= c.n
    else shown.push(d)
  }
  // Solo paréntesis ("(10 hojas)"): se queda tal cual.
  if (!base) return { item: { id: '', name: display(rest || clean, false), qty } }
  const suffix = shown.map((d) => ` (${d})`).join('')
  const baseText = base

  // ¿Elección? "X o Y" (salvo nombres del SRD con «o»), "de tu elección", "el mismo que"...
  const known = lookup(baseText, ix)
  const alts = splitTopLevel(clean, (s, i) => (/^\s(?:o|u)\s/i.test(s.slice(i, i + 3)) ? 3 : 0))
  if (alts.length > 1 && !known?.exact) {
    // Cada alternativa lleva su cantidad y sus paréntesis: "dos dagas o una espada corta".
    return { item: choiceItem(clean, alts, true, [], 1, false, '', ix), pending: true }
  }
  if (isChoiceText(baseText) || choiceDetails.length) {
    return { item: choiceItem(baseText, [baseText], false, choiceDetails, n, counted, suffix, ix), pending: true }
  }

  if (!known) return { item: { id: '', name: display(baseText, counted) + suffix, qty: n } }
  const { entry, exact } = known
  const item: Item = {
    id: '',
    name: (exact ? entry.name : display(baseText, counted)) + suffix,
    qty: n,
  }
  if (entry.kind === 'arma' || entry.kind === 'armadura') item.ref = { kind: entry.kind, id: entry.id }
  let notes = entry.notes
  // Símbolo sagrado sin más: qué formas puede tener.
  if (entry.focus && entry.forms && !shown.length) notes = `${notes ?? ''} Puede ser ${entry.forms}.`.trim()
  // "canalizador arcano (bastón)": el bastón también es un arma.
  if (entry.focus && !item.ref) {
    for (const d of shown) {
      const w = lookup(d, ix)
      if (w && w.entry.kind === 'arma') {
        item.ref = { kind: 'arma', id: w.entry.id }
        notes = `${notes ?? ''} También sirve como arma: ${w.entry.name.toLowerCase()}.`.trim()
        break
      }
    }
  }
  if (notes) item.notes = notes
  if (entry.weight) item.weight = entry.weight
  return { item }
}

function choiceItem(
  baseText: string,
  alts: string[],
  isAlt: boolean,
  choiceDetails: string[],
  n: number,
  counted: boolean,
  suffix: string,
  ix: Index,
): Item {
  const all = [baseText, ...choiceDetails].join(' ')
  let reason: string
  const chosen = all.match(/\bque\s+(?:has|hayas|hubieras)\s+elegido\b\s*(.*)$/i)
  if (chosen) reason = `Es el que has elegido${chosen[1] ? ' ' + chosen[1].replace(/[.\s]+$/, '') : ''}.`
  else if (/\bmism[oa]s?\s+que\b/i.test(all)) reason = 'Es el mismo que elegiste para la competencia con herramientas.'
  else if (isAlt) reason = `Elige uno: ${alts.map((a) => cleanChoice(a)).filter(Boolean).join(' o ')}.`
  else reason = 'A tu elección.'

  const cleaned = isAlt
    ? alts.map((a) => cleanChoice(a)).filter(Boolean).join(' o ')
    : cleanChoice(baseText)
  const known = !isAlt && cleaned ? lookup(cleaned, ix) : undefined
  const item: Item = { id: '', name: (known?.exact ? known.entry.name : display(cleaned || baseText, counted)) + suffix, qty: n }
  if (known && (known.entry.kind === 'arma' || known.entry.kind === 'armadura')) item.ref = { kind: known.entry.kind, id: known.entry.id }
  item.notes = `${reason} Cuando lo sepas, cámbiale el nombre.`
  if (known?.entry.weight) item.weight = known.entry.weight
  return item
}

/** Quita de una elección las coletillas ("de tu elección", "que has elegido…", "un tipo de"). */
function cleanChoice(s: string): string {
  let t = s
    .replace(/\s*\((?:[^()]*\b(?:elecci[oó]n|elegir|elegido|mism[oa]s?\s+que)\b[^()]*)\)/gi, '')
    .replace(/\s+(?:a|de)\s+(?:tu|su)\s+elecci[oó]n\b.*$/i, '')
    .replace(/\s+que\s+(?:has|hayas|hubieras)\s+elegido\b.*$/i, '')
    .replace(/\s+a\s+elegir\b.*$/i, '')
    .replace(/\s+que\s+elijas\b.*$/i, '')
    .replace(/\s+(?:el|la|los|las)\s+mism[oa]s?\s+que\b.*$/i, '')
    .trim()
  // Quita el artículo ("un símbolo sagrado"), pero no una cantidad ("dos dagas o una espada").
  const q = takeQty(t)
  if (!q.counted) t = q.rest
  t = t.replace(/^(?:tipo|clase)\s+de\s+/i, '').replace(/^cualquier(?:a)?\s+/i, '')
  return t.trim()
}

function isChoiceText(s: string): boolean {
  return /\b(?:a|de)\s+(?:tu|su)\s+elecci[oó]n\b|\ba\s+elegir\b|\bque\s+elijas\b|\bque\s+(?:has|hayas|hubieras)\s+elegido\b|\bmism[oa]s?\s+que\b|^(?:(?:un|una)\s+)?(?:tipo|clase)\s+de\b|^cualquier/i.test(
    s.trim(),
  )
}

function lookup(text: string, ix: Index): { entry: Entry; exact: boolean } | undefined {
  const k = nameKey(text)
  if (!k) return undefined
  const e = ix.exact.get(k)
  if (e) return { entry: e, exact: true }
  const c = k.match(CONTAINERS)
  if (c) {
    const inner = ix.exact.get(c[1])
    if (inner && (inner.kind === 'equipo' || inner.kind === 'municion')) return { entry: inner, exact: false }
  }
  for (const p of ix.prefix) if (k.startsWith(p.key + ' ')) return { entry: p.entry, exact: false }
  return undefined
}

// ---------------------------------------------------------------------------
// Cantidades, monedas y paréntesis

const NUMBER_WORDS = new Map<string, number>(Object.entries({
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  cien: 100,
}))
const ARTICLES = new Set(['el', 'la', 'los', 'las', 'unos', 'unas'])
const PREPOSITIONS = new Set(['de', 'del', 'para', 'con', 'a', 'al', 'en', 'sin', 'por', 'sobre', 'o', 'u', 'y', 'e'])
const MEASURES = new Set(['m', 'cm', 'km', 'kg', 'g', 'l', 'ml', 'metro', 'centimetro', 'litro', 'mililitro', 'pie', 'palmo', 'gramo', 'kilo', 'kilogramo', 'libra', 'onza', 'hora', 'minuto'])

const COIN_UNITS = new Map<string, keyof Coins>([
  ['pc', 'pc'],
  ['pp', 'pp'],
  ['pe', 'pe'],
  ['po', 'po'],
  ['ppt', 'ppt'],
])
const COIN_METALS: Record<string, keyof Coins> = { cobre: 'pc', plata: 'pp', electro: 'pe', oro: 'po', platino: 'ppt' }

/** "8 jabalinas" -> 8; "dos hachas" -> 2; "un instrumento" -> 1. `counted`: la cantidad venía escrita (>1). */
function takeQty(s: string): { qty: number; rest: string; counted: boolean } {
  const t = s.trim()
  const d = t.match(/^(\d+)\s+(.+)$/s)
  if (d) {
    const q = Number(d[1])
    return { qty: q > 0 ? q : 1, rest: d[2].trim(), counted: q > 1 }
  }
  const w = t.match(/^(\S+)\s+(.+)$/s)
  if (w) {
    const word = strip(w[1])
    const n = NUMBER_WORDS.get(word)
    if (n !== undefined) return { qty: n, rest: w[2].trim(), counted: n > 1 }
    if (ARTICLES.has(word)) return { qty: 1, rest: w[2].trim(), counted: false }
  }
  return { qty: 1, rest: t, counted: false }
}

function stripQty(s: string): string {
  return takeQty(s).rest
}

/** Cifra o número en palabras al principio del texto ("15 po", "cinco po"); si no hay, undefined. */
function leadingNumber(s: string): { n: number; rest: string } | undefined {
  const t = s.trim()
  const d = t.match(/^(\d+)\s*(.*)$/s)
  if (d) return { n: Number(d[1]), rest: d[2].trim() }
  const w = t.match(/^(\S+)\s+(.+)$/s)
  const n = w ? NUMBER_WORDS.get(strip(w[1])) : undefined
  return w && n !== undefined ? { n, rest: w[2].trim() } : undefined
}

function coinsOf(s: string): Partial<Coins> | undefined {
  const lead = leadingNumber(s)
  if (!lead) return undefined
  const r = strip(lead.rest).replace(/\.$/, '').trim()
  const unit = COIN_UNITS.get(r)
  if (unit) return { [unit]: lead.n }
  const m = r.match(/^(?:pieza|piezas|moneda|monedas)\s+de\s+(cobre|plata|electro|oro|platino)$/)
  if (m) return { [COIN_METALS[m[1]]]: lead.n }
  return undefined
}

function addCoins(into: Partial<Coins>, add: Partial<Coins>) {
  for (const k of Object.keys(add) as (keyof Coins)[]) {
    const v = add[k]
    if (typeof v === 'number' && Number.isFinite(v)) into[k] = (into[k] ?? 0) + v
  }
}

/** "libro (de oraciones)" -> base "libro", detalles ["de oraciones"]. */
function takeParens(s: string): { base: string; details: string[] } {
  const details: string[] = []
  let base = ''
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') {
      if (depth === 0) cur = ''
      else cur += ch
      depth++
    } else if (ch === ')' && depth > 0) {
      depth--
      if (depth === 0) {
        if (cur.trim()) details.push(cur.trim())
      } else cur += ch
    } else if (depth > 0) cur += ch
    else base += ch
  }
  if (depth > 0 && cur.trim()) details.push(cur.trim()) // paréntesis sin cerrar
  return { base: base.replace(/\s+/g, ' ').trim(), details }
}

/** "(10 hojas)" -> 10 × hoja. Las medidas ("15 m", "2 kg") no son cantidades. */
function countDetail(d: string): { n: number; unit: string } | undefined {
  const lead = leadingNumber(d)
  if (!lead) return undefined
  const { n: qty, rest } = lead
  if (qty <= 1 || !rest || /\d/.test(rest)) return undefined
  const words = rest.split(/\s+/)
  if (MEASURES.has(nameKey(words[0]))) return undefined
  return { n: qty, unit: singularPhrase(rest) }
}

// ---------------------------------------------------------------------------
// Nombres

/** Minúsculas, sin tildes. */
function strip(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Slug ASCII como los ids de los datos: "Canalizador arcano (orbe)" -> "canalizador-arcano-orbe". */
export function slug(s: string): string {
  return (
    strip(s)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'objeto'
  )
}

/** Clave para comparar nombres: sin tildes, sin artículo inicial y en singular ("Las hachas de mano" -> "hacha de mano"). */
function nameKey(s: string): string {
  const words = strip(s)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  while (words.length > 1 && (ARTICLES.has(words[0]) || words[0] === 'un' || words[0] === 'una')) words.shift()
  let head = true
  return words
    .map((w) => {
      if (PREPOSITIONS.has(w)) head = false
      return head ? strip(singularWord(w)) : w
    })
    .join(' ')
}

/** Singular de una palabra en castellano (lo justo para nombres de equipo). */
function singularWord(w: string): string {
  const lower = w.toLowerCase()
  if (lower.length <= 3 || !lower.endsWith('s')) return w
  if (lower.endsWith('ces')) return w.slice(0, -3) + 'z' // hoces -> hoz
  if (lower.endsWith('iones')) return w.slice(0, -5) + 'ión' // raciones -> ración
  if (lower.endsWith('ones')) return w.slice(0, -4) + 'ón' // bastones -> bastón
  if (/[aeiouáéíóú][lrndjy]es$/.test(lower)) return w.slice(0, -2) // útiles -> útil
  if (/[aeiouáéíóú]s$/.test(lower)) return w.slice(0, -1) // dagas -> daga, virotes -> virote
  return w
}

/** Pasa a singular las palabras hasta la primera preposición: "hachas de mano" -> "hacha de mano". */
function singularPhrase(s: string): string {
  let head = true
  return s
    .split(/(\s+)/)
    .map((w) => {
      if (/^\s+$/.test(w) || !w) return w
      if (PREPOSITIONS.has(strip(w))) head = false
      return head ? singularWord(w) : w
    })
    .join('')
}

/** Nombre para mostrar: mayúscula inicial y, si venía con cantidad, en singular. */
function display(s: string, plural: boolean): string {
  const t = (plural ? singularPhrase(s) : s).replace(/\s+/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function plainItem(text: string): Item {
  const t = cleanEdges(text) || text.trim() || 'Objeto'
  return { id: slug(t), name: t.charAt(0).toUpperCase() + t.slice(1), qty: 1 }
}

// ---------------------------------------------------------------------------
// Ids únicos

/** Slug del nombre, con sufijo -2, -3... si se repite. */
function uniqueIds(items: Item[]) {
  const used = new Set<string>()
  for (const it of items) {
    const want = it.id || slug(it.name)
    let id = want
    for (let n = 2; used.has(id); n++) id = `${want}-${n}`
    used.add(id)
    it.id = id
  }
}
