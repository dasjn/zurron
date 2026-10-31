// Trasfondos -> BackgroundData[] y dotes -> FeatData[].

import { slugify } from '../lib.mjs'
import { srdLines, findLine, pdfItems, leadinIndex, joinParagraphs, applyLeadins, toRich } from './texto.mjs'

export const ABILITY_IDS = {
  Fuerza: 'fue',
  Destreza: 'des',
  Constitución: 'con',
  Inteligencia: 'int',
  Sabiduría: 'sab',
  Carisma: 'car',
}
const ALL_ABILITIES = ['fue', 'des', 'con', 'int', 'sab', 'car']

// Nombres de habilidad tal como aparecen en este SRD -> SkillId de types.ts
export const SKILL_IDS = {
  Acrobacias: 'acrobacias',
  'Conocimiento arcano': 'arcanos',
  Atletismo: 'atletismo',
  Engaño: 'engano',
  Historia: 'historia',
  Interpretación: 'interpretacion',
  Intimidación: 'intimidacion',
  Investigación: 'investigacion',
  'Juego de manos': 'juego-de-manos',
  Medicina: 'medicina',
  Naturaleza: 'naturaleza',
  Percepción: 'percepcion',
  Perspicacia: 'perspicacia',
  Persuasión: 'persuasion',
  Religión: 'religion',
  Sigilo: 'sigilo',
  Supervivencia: 'supervivencia',
  'Trato con animales': 'trato-con-animales',
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

function joinAll(lines) {
  // une todo el bloque en una sola línea respetando los guiones de fin de línea
  let s = ''
  for (const raw of lines) {
    const l = raw.trim()
    if (!l) continue
    if (/[a-záéíóúñ]-$/i.test(s) && /^[a-záéíóúñ]/.test(l)) s = s.slice(0, -1) + l
    else s = s ? s + ' ' + l : l
  }
  return s
}

// ───────────────────────── Trasfondos ─────────────────────────

const BACKGROUNDS = ['Acólito', 'Criminal', 'Erudito', 'Soldado']
const FIELDS = ['Puntuaciones de característica', 'Dote', 'Competencias en habilidades', 'Competencia con herramientas', 'Equipo']

export function buildBackgrounds() {
  const lines = srdLines()
  const start = findLine('Descripciones de trasfondos', 10000)
  const end = findLine('Especies de personaje', start)
  const pos = BACKGROUNDS.map((n) => findLine(n, start, end))

  return BACKGROUNDS.map((name, k) => {
    const s = joinAll(lines.slice(pos[k] + 1, k + 1 < pos.length ? pos[k + 1] : end))
    const re = new RegExp('^' + FIELDS.map((f) => `${f}: (.+?)`).join(' ') + '$')
    const m = s.match(re)
    if (!m) throw new Error(`No puedo leer el trasfondo ${name}: ${s}`)
    const [, abil, dote, skills, tool, equip] = m

    const abilities = abil.split(/,\s*/).map((a) => {
      if (!ABILITY_IDS[a]) throw new Error(`Característica desconocida ${a}`)
      return ABILITY_IDS[a]
    })
    const fm = dote.replace(/ \(consulta el capítulo “Dotes”\)$/, '').match(/^(.+?)(?: \((.+)\))?$/)
    const feat = { id: slugify(fm[1]) }
    if (fm[2]) feat.note = fm[2]
    const skillIds = skills.split(/ [ye] /).map((x) => {
      if (!SKILL_IDS[x]) throw new Error(`Habilidad desconocida ${x}`)
      return SKILL_IDS[x]
    })
    const em = equip.match(/^elige A o B: \(A\) (.+), o \(B\) (.+)$/)
    if (!em) throw new Error(`Equipo raro en ${name}: ${equip}`)
    const equipment = [
      { option: 'A', text: cap(em[1]) },
      { option: 'B', text: em[2] },
    ]
    const text = FIELDS.map((f, i) => `**${f}:** ${m[i + 1]}`).join('\n\n')
    return {
      id: slugify(name),
      name,
      source: 'srd',
      abilities,
      feat,
      skills: skillIds,
      tool: cap(tool),
      equipment,
      text,
    }
  })
}

// ───────────────────────── Dotes ─────────────────────────

const CATEGORY = {
  'Dote de origen': 'origen',
  'Dote general': 'general',
  'Dote de estilo de combate': 'estilo-combate',
  'Dote de don épico': 'don-epico',
}

const PB_ONE = { perLevel: Array(20).fill(1) }

/** Resúmenes para novatos y datos que no salen limpios del texto. */
const FEAT_EXTRA = {
  alerta: {
    summary: 'Sumas tu bonificador por competencia a la iniciativa, así que sueles actuar antes. Además, puedes intercambiar tu iniciativa con la de un aliado justo después de tirar.',
  },
  'atacante-salvaje': {
    summary: 'Una vez por turno, al acertar con un arma, tiras dos veces los dados de daño y te quedas con el mejor resultado.',
  },
  habilidoso: {
    summary: 'Ganas competencia en tres habilidades o herramientas a tu elección, en cualquier combinación.',
    choice: { kind: 'habilidad', count: 3, note: 'Cualquier combinación de habilidades o herramientas.' },
  },
  'iniciado-en-la-magia': {
    summary: 'Aprendes dos trucos y un conjuro de nivel 1 de la lista de clérigo, druida o mago. Puedes lanzar ese conjuro gratis una vez por descanso largo.',
    choice: {
      kind: 'opcion',
      count: 1,
      options: [
        { id: 'clerigo', name: 'Clérigo' },
        { id: 'druida', name: 'Druida' },
        { id: 'mago', name: 'Mago' },
      ],
      note: 'Después elige 2 trucos y 1 conjuro de nivel 1 de esa lista, y la aptitud mágica (Inteligencia, Sabiduría o Carisma).',
    },
    resources: [{ id: 'iniciado-en-la-magia', name: 'Conjuro de nivel 1 sin espacio', max: PB_ONE, recharge: 'largo' }],
  },
  apresador: {
    summary: 'Te especializas en agarrar: +1 a Fuerza o Destreza, puedes golpear y agarrar con el mismo ataque sin armas y tienes ventaja al atacar a quien tienes agarrado.',
  },
  'mejora-de-caracteristica': {
    summary: 'Sube una característica en 2, o dos características en 1 cada una (máximo 20). Es la opción clásica al llegar a ciertos niveles.',
    abilityIncrease: { options: ALL_ABILITIES, amount: 2, max: 20 },
    choice: { kind: 'opcion', count: 1, note: '+2 a una característica o +1 a dos características distintas (máximo 20).', options: [
      { id: 'mas-2', name: '+2 a una característica' },
      { id: 'mas-1-mas-1', name: '+1 a dos características' },
    ] },
  },
  'combate-con-armas-a-dos-manos': {
    summary: 'Con armas a dos manos o versátiles usadas a dos manos, los 1 y 2 en los dados de daño cuentan como 3.',
  },
  'combate-con-dos-armas': {
    summary: 'Cuando haces el ataque extra por luchar con dos armas ligeras, también sumas tu modificador por característica al daño.',
  },
  defensa: {
    summary: 'Mientras llevas armadura ligera, media o pesada, tienes +1 a la clase de armadura.',
  },
  'tiro-con-arco': {
    summary: 'Tienes +2 a las tiradas de ataque con armas a distancia.',
  },
  'don-de-la-pericia-en-combate': {
    summary: '+1 a una característica (hasta 30). Cuando fallas un ataque, puedes convertirlo en acierto una vez por turno.',
  },
  'don-de-la-vision-verdadera': {
    summary: '+1 a una característica (hasta 30) y ves la verdad hasta 18 m: invisibles, ilusiones y formas transformadas.',
  },
  'don-del-ataque-imparable': {
    summary: '+1 a Fuerza o Destreza (hasta 30). Tu daño físico ignora la resistencia y los 20 naturales hacen mucho daño extra.',
  },
  'don-del-destino': {
    summary: '+1 a una característica (hasta 30). Puedes sumar o restar 2d4 a una prueba con d20 cercana; se recarga al tirar iniciativa o descansar.',
    resources: [{ id: 'mejorar-el-destino', name: 'Mejorar el destino', max: PB_ONE, recharge: 'corto' }],
  },
  'don-del-espiritu-de-la-noche': {
    summary: '+1 a una característica (hasta 30). En la penumbra o la oscuridad puedes volverte invisible y resistes casi todo el daño.',
  },
  'don-del-recuerdo-de-conjuros': {
    summary: '+1 a Inteligencia, Sabiduría o Carisma (hasta 30). A veces lanzas conjuros de nivel 1 a 4 sin gastar el espacio.',
  },
  'don-del-viaje-dimensional': {
    summary: '+1 a una característica (hasta 30). Tras atacar o usar la acción de magia, puedes teletransportarte hasta 9 m.',
  },
}

function parseAbilityIncrease(text) {
  const m = text.match(/\*\*Mejora de característica\.\*\* Aumenta (.+?) en 1, hasta un máximo de (\d+)\./)
  if (!m) return undefined
  let options
  if (/una puntuación de característica de tu elección/.test(m[1])) options = ALL_ABILITIES
  else {
    const names = m[1].replace(/^tu puntuación de /, '').split(/, | o /)
    options = names.map((n) => {
      if (!ABILITY_IDS[n]) throw new Error(`Característica desconocida en dote: ${n}`)
      return ABILITY_IDS[n]
    })
  }
  return { options, amount: 1, max: Number(m[2]) }
}

export function buildFeats() {
  const lines = srdLines()
  const start = findLine('Descripciones de dotes', 10000)
  let end = findLine('Monedas', start)
  while (lines[end - 1] === '' || lines[end - 1] === 'Equipo') end-- // título del capítulo siguiente
  const heads = pdfItems().filter((x) => x.p >= 94 && x.p <= 96 && x.k === 'h3').map((x) => x.t)
  const leadins = leadinIndex(94, 96)

  const pos = []
  let from = start
  for (const h of heads) {
    const i = findLine(h, from, end)
    pos.push(i)
    from = i + 1
  }

  return heads.map((name, k) => {
    const id = slugify(name)
    const block = lines.slice(pos[k] + 1, k + 1 < heads.length ? pos[k + 1] : end)
    // quitar encabezados de sección que caen al final del bloque ("Dotes generales"...)
    while (block.length && /^(Dotes (de origen|generales|de estilo de combate|de don épico)|)$/.test(block[block.length - 1])) block.pop()
    const header = block.shift()
    const hm = header.match(/^(Dote (?:de origen|general|de estilo de combate|de don épico))(?: \(requisitos?: (.+)\))?$/)
    if (!hm) throw new Error(`Cabecera rara en dote ${name}: ${header}`)
    const text = toRich(applyLeadins(joinParagraphs(block), leadins.near(name), leadins.all))
    const extra = FEAT_EXTRA[id] ?? {}
    const feat = {
      id,
      name,
      source: 'srd',
      category: CATEGORY[hm[1]],
    }
    if (hm[2]) feat.prerequisite = cap(hm[2])
    if (/\*\*Repetible\.\*\*/.test(text)) feat.repeatable = true
    feat.text = text
    if (extra.summary) feat.summary = extra.summary
    const ai = extra.abilityIncrease ?? parseAbilityIncrease(text)
    if (ai) feat.abilityIncrease = ai
    if (extra.choice) feat.choice = { id, ...extra.choice }
    if (extra.resources) feat.resources = extra.resources
    return feat
  })
}
