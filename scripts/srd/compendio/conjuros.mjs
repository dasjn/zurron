// Conjuros: capítulo "Descripciones de conjuros" -> SpellData[].

import { slugify } from '../lib.mjs'
import { srdLines, findLine, leadinIndex, joinParagraphs, splitBullets, applyLeadins, toRich } from './texto.mjs'
import { applyOverrides } from './tablas.mjs'

export const CLASS_IDS = {
  bárbaro: 'barbaro',
  bardo: 'bardo',
  brujo: 'brujo',
  clérigo: 'clerigo',
  druida: 'druida',
  explorador: 'explorador',
  guerrero: 'guerrero',
  hechicero: 'hechicero',
  mago: 'mago',
  monje: 'monje',
  paladín: 'paladin',
  pícaro: 'picaro',
}

const SCHOOLS = 'Abjuración|Adivinación|Conjuración|Encantamiento|Evocación|Ilusionismo|Nigromancia|Transmutación'
const RE_LEVELED = new RegExp(`^(${SCHOOLS}) de nivel ([1-9]) \\((.+)\\)$`)
const RE_CANTRIP = new RegExp(`^Truco de (${SCHOOLS.toLowerCase()}) \\((.+)\\)$`)
const RE_HEADER = /^Tiempo de lanzamiento: (.+?) Alcance: (.+?) Componentes: (.+?) Duración: (.+)$/

const HIGHER = ['Con un espacio de conjuro de nivel superior.', 'Mejora de truco.']

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Erratas del SRD en español, corregidas con el SRD en inglés (en.txt).
 * Cada corrección tiene que aplicarse: si el texto cambia, el script avisa.
 */
const ERRATAS = [
  // es-raw.txt pone «V, S, M»; el original inglés es «S, M (a pinch of confetti)»:
  // el conjuro no tiene componente verbal.
  { id: 'patron-hipnotico', field: 'components', find: 'V, S, M (una pizca de confeti)', replace: 'S, M (una pizca de confeti)' },
  // «la zona de 4,5 m» no existe: el área son los cubos (inglés: «each creature in the area»).
  { id: 'tormenta-de-fuego', field: 'text', find: 'Todas las criaturas situadas en la zona de 4,5 m', replace: 'Todas las criaturas situadas en el área' },
]

function applyErratas(spell) {
  for (const e of ERRATAS.filter((x) => x.id === spell.id)) {
    if (!spell[e.field].includes(e.find)) throw new Error(`Errata de ${spell.id} sin aplicar: ${e.find}`)
    spell[e.field] = spell[e.field].replace(e.find, e.replace)
    e.applied = true
  }
}

export function buildSpells() {
  const lines = srdLines()
  const start = findLine('Descripciones de conjuros', 12000) + 1
  const end = findLine('Glosario de reglas', start)
  const leadins = leadinIndex(118, 193)

  // 1) localizar cabeceras: línea de nombre seguida de la de escuela/nivel
  const heads = []
  for (let i = start; i < end; i++) {
    const m = lines[i].match(RE_LEVELED) || lines[i].match(RE_CANTRIP)
    if (!m) continue
    let n = i - 1
    while (n > start && lines[n] === '') n--
    heads.push({ nameLine: n, schoolLine: i, m })
  }

  const spells = []
  for (let h = 0; h < heads.length; h++) {
    const { nameLine, schoolLine, m } = heads[h]
    const next = h + 1 < heads.length ? heads[h + 1].nameLine : end
    const name = lines[nameLine]
    let level, school, classText
    if (m[0].startsWith('Truco')) {
      level = 0
      school = cap(m[1])
      classText = m[2]
    } else {
      level = Number(m[2])
      school = m[1]
      classText = m[3]
    }
    const classes = classText.split(/,\s*/).map((c) => {
      const id = CLASS_IDS[c.trim()]
      if (!id) throw new Error(`Clase desconocida "${c}" en ${name}`)
      return id
    })

    // 2) bloque de cabecera: desde "Tiempo de lanzamiento:" hasta completar "Duración:"
    let j = schoolLine + 1
    while (lines[j] === '') j++
    if (!lines[j].startsWith('Tiempo de lanzamiento:')) throw new Error(`Cabecera rara en ${name}: ${lines[j]}`)
    let header = lines[j]
    j++
    while (!/ Duración: /.test(header)) {
      if (lines[j] !== '') header = joinHeader(header, lines[j])
      j++
    }
    const hm = header.match(RE_HEADER)
    if (!hm) throw new Error(`No puedo leer la cabecera de ${name}: ${header}`)
    const [, castingTime, range, components, duration] = hm.map((s) => s.trim())

    // 3) cuerpo
    const id = slugify(name)
    let body = lines.slice(j, next)
    body = applyOverrides('conjuro', id, body)
    let paras = applyLeadins(splitBullets(joinParagraphs(body)), leadins.near(name), leadins.all)
    const textParas = []
    const higherParas = []
    for (const p of paras) {
      if (HIGHER.some((hl) => p.startsWith(`**${hl}**`))) higherParas.push(p)
      else textParas.push(p)
    }

    const spell = {
      id,
      name,
      level,
      school,
      classes,
      castingTime,
      range,
      components,
      duration,
      concentration: /^Concentración/.test(duration),
      ritual: /\britual\b/.test(castingTime),
      text: toRich(textParas),
    }
    if (higherParas.length) spell.higherLevels = toRich(higherParas)
    applyErratas(spell)
    spells.push(spell)
  }
  for (const e of ERRATAS) if (!e.applied) throw new Error(`Errata sin conjuro: ${e.id}`)
  return spells
}

function joinHeader(a, b) {
  if (/[a-záéíóúñ]-$/i.test(a) && /^[a-záéíóúñ]/.test(b)) return a.slice(0, -1) + b
  return a + ' ' + b
}
