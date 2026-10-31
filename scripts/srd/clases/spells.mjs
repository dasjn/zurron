// Listas de conjuros por clase ("Lista de conjuros de X") y, para contrastarlas,
// las clases que indica cada descripción de conjuro ("Evocación de nivel 1 (bardo, mago)").

import { slugify } from '../lib.mjs'

export const SCHOOLS = [
  'Abjuración',
  'Adivinación',
  'Conjuración',
  'Encantamiento',
  'Evocación',
  'Ilusionismo',
  'Nigromancia',
  'Transmutación',
]
const SCHOOL_RE = new RegExp(`(^|\\s)(${SCHOOLS.join('|')})(?=\\s|$)`, 'g')
// Una o varias marcas de la columna "Especial": "—", "C", "R, M", "C, M M"...
const SPECIAL_ONLY = /^((—|[CRM](, ?[CRM])*)\s*)+$/
const TRAILING_SPECIALS = /(^|\s+)((—|[CRM](, ?[CRM])*)\s*)+$/

/**
 * Lee la sección "Lista de conjuros de X" (líneas [a, b)).
 * Devuelve { byLevel: { 0: [nombres], 1: [...], ... }, problems: [] }.
 */
export function parseSpellList(L, [a, b]) {
  const byLevel = {}
  const problems = []
  let level = null
  // Las tablas salen como secuencias nombre / escuela / especial, a veces en la
  // misma línea y a veces con toda una columna de nombres en una sola línea
  // ("Conjuro Silencio Sordera/ceguera ..."), seguida de sus escuelas.
  let expect = 'name' // 'name' | 'school' | 'special'
  let pendingSchools = 0 // escuelas que faltan por consumir tras un bloque de nombres
  const push = (n, l) => {
    n = n.trim()
    if (!/^[A-ZÁÉÍÓÚÑ]/.test(n)) problems.push(`nivel ${level}: "${n}" (línea "${l}")`)
    byLevel[level].push(n)
  }
  for (let i = a + 1; i < b; i++) {
    const l = L[i]
    if (!l) continue
    let m
    if ((m = l.match(/^Trucos \(conjuros de .+ de nivel 0\)$/))) {
      level = 0
      byLevel[0] = []
      expect = 'name'
      pendingSchools = 0
      continue
    }
    if ((m = l.match(/^Conjuros de .+ de nivel (\d)$/))) {
      level = Number(m[1])
      byLevel[level] = []
      expect = 'name'
      pendingSchools = 0
      continue
    }
    if (level === null) continue
    if (/^(Conjuro|Escuela|Especial)$/.test(l)) continue
    if (l.startsWith('Conjuro ')) {
      const names = l.slice('Conjuro '.length).split(/ (?=[A-ZÁÉÍÓÚÑ])/)
      for (const n of names) push(n, l)
      pendingSchools = names.length
      expect = 'school'
      continue
    }
    const schools = l.match(SCHOOL_RE) || []
    const rest = l
      .replace(SCHOOL_RE, ' ')
      .replace(/(^|\s)(Escuela|Especial)(?=\s|$)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const hasSpecial = TRAILING_SPECIALS.test(rest)
    const nameText = SPECIAL_ONLY.test(rest) ? '' : rest.replace(TRAILING_SPECIALS, '').trim()
    if (pendingSchools > 0) {
      // Dentro de un bloque: solo escuelas y marcas especiales.
      pendingSchools -= schools.length
      if (nameText) problems.push(`nivel ${level}: texto inesperado en bloque "${l}"`)
      if (pendingSchools <= 0) expect = hasSpecial ? 'name' : 'special'
      continue
    }
    if (!nameText && schools.length === 1 && rest === '' && expect === 'name') {
      // Conjuro cuyo nombre coincide con una escuela ("Adivinación").
      push(l, l)
      expect = 'school'
      continue
    }
    if (nameText) {
      if (/^[a-záéíóúñ]/.test(nameText) && byLevel[level].length) {
        // Nombre partido en dos líneas: "Bola de fuego de explosión" + "retardada".
        const arr = byLevel[level]
        arr[arr.length - 1] += ' ' + nameText
      } else push(nameText, l)
    }
    if (hasSpecial) expect = 'name'
    else if (schools.length) expect = 'special'
    else if (nameText) expect = 'school'
  }
  return { byLevel, problems }
}

/**
 * Recorre "Descripciones de conjuros" y devuelve Map id -> { name, level, classes[] }.
 */
export function parseSpellDescriptions(L) {
  const start = L.findIndex((l, i) => i > 5000 && l === 'Descripciones de conjuros')
  const map = new Map()
  const HEAD = /^(?:Truco de ([a-záéíóú]+)|([A-ZÁÉÍÓÚ][a-záéíóú]+) de nivel (\d)) \(([^)]+)\)$/
  for (let i = start + 1; i < L.length - 1; i++) {
    const m = L[i + 1].match(HEAD)
    if (!m || !L[i]) continue
    const name = L[i]
    const level = m[1] ? 0 : Number(m[3])
    const classes = m[4].split(',').map((c) => slugify(c.trim()))
    map.set(slugify(name), { name, level, classes })
  }
  return map
}
