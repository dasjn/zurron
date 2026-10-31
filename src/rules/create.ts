// Crear un personaje de nivel 1 desde cero (reglas de 2024). Lógica pura: el
// asistente de la interfaz (ui/Create.tsx) guarda un borrador (Draft) con las
// decisiones a medio tomar y al final lo convierte en ficha con buildCharacter.
//
// Convención del borrador: un campo sin definir significa «lo recomendado».
// fillUpTo lo rellena al entrar en su paso; si la persona lo cambia, se respeta
// (aunque quede incompleto: la validación del paso dice qué falta).

import type { Ability, ArmorData, BackgroundData, ChoiceDef, ChoiceOption, ClassData, Feature, SkillId, SpeciesData, WeaponData } from '../data/types'
import { ABILITIES } from '../data/types'
import { CHARACTER_SCHEMA, type Character, type CharacterFeat, type Coins, type Item, type Look } from '../model/character'
import type { Rules } from './book'
import { SKILLS } from './constants'
import { atLevel, derive, mod } from './derive'
import { parseEquipmentParts, type EquipmentPart } from './equipment'

/* ---------- Pasos ---------- */

export type StepId = 'clase' | 'trasfondo' | 'especie' | 'caracteristicas' | 'habilidades' | 'conjuros' | 'equipo' | 'idiomas' | 'quien' | 'repaso'

export const STEP_ORDER: StepId[] = ['clase', 'trasfondo', 'especie', 'caracteristicas', 'habilidades', 'conjuros', 'equipo', 'idiomas', 'quien', 'repaso']

export const STEP_TITLES: Record<StepId, string> = {
  clase: 'Clase',
  trasfondo: 'Trasfondo',
  especie: 'Especie',
  caracteristicas: 'Características',
  habilidades: 'Habilidades y rasgos',
  conjuros: 'Conjuros',
  equipo: 'Equipo',
  idiomas: 'Idiomas',
  quien: 'Quién es',
  repaso: 'Repaso',
}

/* ---------- Borrador ---------- */

export type Method = 'estandar' | 'puntos' | 'tirada'

/** Una tirada de 4d6 (se quita el dado más bajo) o un total escrito a mano. */
export interface Roll {
  dice?: number[]
  total: number
}

/** Dote de origen con sus elecciones (Iniciado en la magia: lista, trucos, conjuro, aptitud; Habilidoso: competencias). */
export interface FeatPick {
  id: string
  choices: Record<string, string[]>
}

export interface Draft {
  v: 1
  /** Paso en el que está la persona. */
  at: StepId
  classId?: string
  backgroundId?: string
  speciesId?: string
  /** Claves = ChoiceDef.id de la especie (linaje, tamaño, habilidad...). */
  speciesChoices: Record<string, string>
  /** Aptitud mágica de los conjuros del linaje (elfo, gnomo, tiefling). */
  speciesAbility?: Ability
  /** Dote de origen extra del humano (Versátil). */
  speciesFeat?: FeatPick
  /** Elecciones de la dote de origen del trasfondo (la dote la fija el trasfondo). */
  bgFeat?: FeatPick
  /** Herramienta del trasfondo cuando hay que elegirla («un tipo de juego»). */
  bgTool?: string
  method: Method
  base?: Record<Ability, number>
  rolls?: Roll[]
  /** Lo que suma el trasfondo: { fue: 2, con: 1 } o tres +1. */
  bonus?: Partial<Record<Ability, number>>
  classSkills?: SkillId[]
  /** Herramientas o instrumentos de clase cuando hay que elegirlos (bardo, monje). */
  classTools?: string[]
  /** Elecciones de rasgos de clase de nivel 1. Clave = ChoiceDef.id. */
  classChoices: Record<string, string[]>
  masteries?: string[]
  cantrips?: string[]
  prepared?: string[]
  /** Truco extra de Taumaturgo (clérigo) o Naturalista (druida). */
  orderCantrip?: string[]
  equipClass?: string
  equipBg?: string
  /** Lo que la persona escribe para cada parte «a tu elección» del equipo. */
  pendingNotes: Record<string, string>
  /** Idiomas elegidos (sin el común ni los que dan los rasgos). */
  languages?: string[]
  name: string
  player: string
  tagline: string
  appearance: string
  personality: string
  color?: string
  portrait?: string
}

export function emptyDraft(): Draft {
  return {
    v: 1,
    at: 'clase',
    speciesChoices: {},
    classChoices: {},
    method: 'estandar',
    pendingNotes: {},
    name: '',
    player: '',
    tagline: '',
    appearance: '',
    personality: '',
  }
}

/** ¿Hay algo que merezca la pena recuperar? */
export function draftHasProgress(d: Draft | undefined): boolean {
  return !!d && (!!d.classId || !!d.name.trim())
}

/* ---------- Utilidades ---------- */

export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Id estable a partir del nombre; si ya existe, añade -2, -3... */
export function uniqueId(name: string, exists: (id: string) => boolean): string {
  const base = slug(name) || 'personaje'
  if (!exists(base)) return base
  for (let n = 2; ; n++) if (!exists(`${base}-${n}`)) return `${base}-${n}`
}

const uniq = <T>(xs: T[]) => [...new Set(xs)]
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/* ---------- Clase ---------- */

/** «Para quién es» cada clase, en una frase. */
export const CLASS_FOR_WHOM: Record<string, string> = {
  barbaro: 'Para quien quiere ir delante, aguantar muchos golpes y no complicarse.',
  bardo: 'Para quien quiere hablar por el grupo, ayudar a los demás y hacer un poco de todo.',
  brujo: 'Para quien quiere magia potente y sencilla, con pocos conjuros que se recuperan rápido.',
  clerigo: 'Para quien quiere curar y proteger al grupo sin dejar de pelear.',
  druida: 'Para quien quiere magia de la naturaleza y, más adelante, convertirse en animal.',
  explorador: 'Para quien quiere disparar con arco, rastrear y moverse por la naturaleza.',
  guerrero: 'Para quien empieza o quiere estar en primera línea sin complicarse.',
  hechicero: 'Para quien quiere lanzar conjuros potentes y retorcerlos a su gusto.',
  mago: 'Para quien disfruta eligiendo entre muchos conjuros y resolviendo problemas con magia.',
  monje: 'Para quien quiere moverse rápido y pelear a puñetazo limpio, sin armadura.',
  paladin: 'Para quien quiere ser el caballero del grupo: golpes fuertes, armadura pesada y algo de curación.',
  picaro: 'Para quien quiere sigilo, abrir cerraduras y golpes certeros por sorpresa.',
}

export const RECOMMENDED_CLASS = 'guerrero'

/** Tabla «Conjunto estándar por clase» del SRD 5.2.1 (Fue, Des, Con, Int, Sab, Car). */
const CLASS_ARRAY_ROWS: Record<string, number[]> = {
  barbaro: [15, 13, 14, 10, 12, 8],
  bardo: [8, 14, 12, 13, 10, 15],
  brujo: [8, 14, 13, 12, 10, 15],
  clerigo: [14, 8, 13, 10, 15, 12],
  druida: [8, 12, 14, 13, 15, 10],
  explorador: [12, 15, 13, 8, 14, 10],
  guerrero: [15, 14, 13, 8, 10, 12],
  hechicero: [10, 13, 14, 8, 12, 15],
  mago: [8, 12, 13, 15, 14, 10],
  monje: [12, 15, 13, 10, 14, 8],
  paladin: [15, 10, 13, 8, 12, 14],
  picaro: [12, 15, 13, 14, 10, 8],
}

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

const toScores = (row: number[]) => Object.fromEntries(ABILITIES.map((a, i) => [a, row[i]])) as Record<Ability, number>

/** Matriz estándar colocada según la clase (la tabla oficial del SRD). */
export function classArray(cls: ClassData | undefined): Record<Ability, number> {
  const row = cls && CLASS_ARRAY_ROWS[cls.id]
  if (row) return toScores(row)
  // Clase de la mesa sin fila: lo más alto a sus características principales y luego Constitución.
  const order = abilityOrderFromPrimary(cls?.primaryAbilities ?? [])
  const out = {} as Record<Ability, number>
  order.forEach((a, i) => (out[a] = STANDARD_ARRAY[i]))
  return out
}

function abilityOrderFromPrimary(primary: Ability[]): Ability[] {
  const order = [...primary]
  for (const a of ['con', 'des', 'sab', 'fue', 'car', 'int'] as Ability[]) if (!order.includes(a)) order.push(a)
  return order
}

/** Características de la clase de más a menos importante. */
export function abilityPriority(cls: ClassData | undefined): Ability[] {
  const s = classArray(cls)
  return [...ABILITIES].sort((a, b) => s[b] - s[a] || ABILITIES.indexOf(a) - ABILITIES.indexOf(b))
}

/** Reparte seis valores (tirada) según la prioridad de la clase. */
export function assignByPriority(values: number[], cls: ClassData | undefined): Record<Ability, number> {
  const sorted = [...values].sort((a, b) => b - a)
  const out = {} as Record<Ability, number>
  abilityPriority(cls).forEach((a, i) => (out[a] = sorted[i] ?? 8))
  return out
}

/* ---------- Compra por puntos ---------- */

export const POINT_BUDGET = 27
export const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }

export function pointCost(scores: Record<Ability, number>): number {
  return ABILITIES.reduce((n, a) => n + (POINT_COST[scores[a]] ?? 99), 0)
}

/* ---------- Tirada ---------- */

/** 4d6 quitando el más bajo. `die` recibe el número de caras y devuelve el resultado. */
export function roll4d6(die: (sides: number) => number): Roll {
  const dice = [die(6), die(6), die(6), die(6)]
  return { dice, total: rollTotal({ dice, total: 0 }) }
}

export function rollTotal(r: Roll): number {
  if (!r.dice) return r.total
  const sorted = [...r.dice].sort((a, b) => a - b)
  return sorted.slice(1).reduce((a, b) => a + b, 0)
}

/* ---------- Bonus del trasfondo ---------- */

/** +2 a la característica del trasfondo que más le importa a la clase y +1 a la siguiente. */
export function recommendedBonus(bg: BackgroundData, cls: ClassData | undefined, base?: Record<Ability, number>): Partial<Record<Ability, number>> {
  const order = abilityPriority(cls).filter((a) => bg.abilities.includes(a))
  const can = (a: Ability, n: number) => !base || base[a] + n <= 20
  const two = order.find((a) => can(a, 2))
  if (!two) return Object.fromEntries(bg.abilities.map((a) => [a, 1]))
  const one = order.find((a) => a !== two && can(a, 1))
  return one ? { [two]: 2, [one]: 1 } : { [two]: 2 }
}

export function bonusIssue(bg: BackgroundData | undefined, bonus: Partial<Record<Ability, number>> | undefined, base?: Record<Ability, number>): string | undefined {
  if (!bg) return undefined
  const entries = Object.entries(bonus ?? {}).filter(([, v]) => v) as [Ability, number][]
  if (entries.some(([a]) => !bg.abilities.includes(a))) return 'Tu trasfondo solo deja subir sus tres características.'
  const vals = entries.map(([, v]) => v).sort()
  const ok = (vals.length === 2 && vals[0] === 1 && vals[1] === 2) || (vals.length === 3 && vals.every((v) => v === 1))
  if (!ok) return 'Reparte lo que da tu trasfondo: +2 a una y +1 a otra, o +1 a las tres.'
  if (base && entries.some(([a, v]) => base[a] + v > 20)) return 'Ninguna característica puede pasar de 20.'
  return undefined
}

/* ---------- Trasfondo y especie recomendados ---------- */

/** Trasfondo del SRD que mejor encaja con cada clase (sube su característica principal). */
const BG_FOR_CLASS: Record<string, string[]> = {
  barbaro: ['soldado'],
  bardo: ['acolito'],
  brujo: ['acolito'],
  clerigo: ['acolito'],
  druida: ['erudito'],
  explorador: ['soldado'],
  guerrero: ['soldado'],
  hechicero: ['acolito'],
  mago: ['erudito'],
  monje: ['soldado'],
  paladin: ['soldado'],
  picaro: ['criminal'],
}

/**
 * Trasfondo recomendado: el que la mesa marque para la clase (`recommendedFor` en su
 * JSON) y, si no, el del SRD que mejor encaja.
 */
export function recommendedBackground(rules: Rules, classId: string | undefined): string | undefined {
  const own = rules.book.backgrounds.find((b) => b.source === 'mesa' && classId && b.recommendedFor?.includes(classId))
  if (own) return own.id
  for (const id of BG_FOR_CLASS[classId ?? ''] ?? []) if (rules.background(id)) return id
  return rules.book.backgrounds[0]?.id
}

const SPECIES_FOR_CLASS: Record<string, string> = {
  barbaro: 'orco',
  bardo: 'mediano',
  brujo: 'tiefling',
  clerigo: 'enano',
  druida: 'elfo',
  explorador: 'elfo',
  guerrero: 'humano',
  hechicero: 'draconido',
  mago: 'gnomo',
  monje: 'humano',
  paladin: 'draconido',
  picaro: 'mediano',
}

export function recommendedSpecies(rules: Rules, classId: string | undefined): string | undefined {
  const id = SPECIES_FOR_CLASS[classId ?? '']
  return id && rules.speciesOf(id) ? id : rules.book.species[0]?.id
}

/* ---------- Herramientas ---------- */

export const INSTRUMENTS = ['Chirimía', 'Cuerno', 'Dulcémele', 'Flauta', 'Flauta de pan', 'Gaita', 'Laúd', 'Lira', 'Tambor', 'Viola']
export const GAMES = ['Ajedrez dragón', 'Apuesta de los tres dragones', 'Dados', 'Naipes']
export const ARTISAN_TOOLS = [
  'Herramientas de albañil',
  'Herramientas de alfarero',
  'Herramientas de carpintero',
  'Herramientas de cartógrafo',
  'Herramientas de curtidor',
  'Herramientas de ebanista',
  'Herramientas de herrero',
  'Herramientas de joyero',
  'Herramientas de manitas',
  'Herramientas de soplador de vidrio',
  'Herramientas de tejedor',
  'Herramientas de zapatero',
  'Suministros de alquimista',
  'Suministros de calígrafo',
  'Suministros de cervecero',
  'Suministros de pintor',
  'Útiles de cocinero',
]
export const OTHER_TOOLS = ['Herramientas de ladrón', 'Herramientas de navegante', 'Útiles de envenenador', 'Útiles de herborista', 'Útiles para disfrazarse', 'Útiles para falsificar']
/** Herramientas que se pueden coger con Habilidoso. */
export const ALL_TOOLS = [...OTHER_TOOLS, ...ARTISAN_TOOLS, ...INSTRUMENTS, ...GAMES]
const TOOL_BY_ID = new Map(ALL_TOOLS.map((t) => [slug(t), t]))
export const toolName = (id: string) => TOOL_BY_ID.get(id) ?? id

export interface ToolRule {
  fixed?: string
  count: number
  options: string[]
  text: string
}

/** Lee «Elige tres instrumentos musicales», «Elige un tipo de juego»... */
export function toolRule(text: string | undefined): ToolRule | undefined {
  if (!text) return undefined
  if (!/^elige/i.test(text.trim())) return { fixed: text.trim(), count: 0, options: [], text }
  const count = /\btres\b/i.test(text) ? 3 : /\bdos\b/i.test(text) ? 2 : 1
  const options: string[] = []
  if (/artesano/i.test(text)) options.push(...ARTISAN_TOOLS)
  if (/instrumento/i.test(text)) options.push(...INSTRUMENTS)
  if (/juego/i.test(text)) options.push(...GAMES)
  return { count, options: options.length ? options : ALL_TOOLS, text: text.replace(/\s*\(consulta[^)]*\)/i, '') }
}

const TOOL_DEFAULTS = ['Laúd', 'Flauta', 'Tambor', 'Dados', 'Herramientas de carpintero']
function recommendedTools(rule: ToolRule): string[] {
  const out = TOOL_DEFAULTS.filter((t) => rule.options.includes(t))
  for (const t of rule.options) if (!out.includes(t)) out.push(t)
  return out.slice(0, rule.count)
}

/* ---------- Habilidades ---------- */

const GENERAL_SKILLS: SkillId[] = [
  'percepcion',
  'perspicacia',
  'sigilo',
  'persuasion',
  'atletismo',
  'medicina',
  'supervivencia',
  'investigacion',
  'acrobacias',
  'engano',
  'arcanos',
  'historia',
  'naturaleza',
  'religion',
  'intimidacion',
  'interpretacion',
  'juego-de-manos',
  'trato-con-animales',
]

export const CLASS_SKILLS: Record<string, SkillId[]> = {
  barbaro: ['percepcion', 'atletismo', 'supervivencia', 'intimidacion'],
  bardo: ['persuasion', 'engano', 'perspicacia', 'percepcion', 'interpretacion', 'sigilo'],
  brujo: ['engano', 'arcanos', 'intimidacion', 'investigacion', 'historia'],
  clerigo: ['perspicacia', 'medicina', 'religion', 'persuasion', 'historia'],
  druida: ['percepcion', 'naturaleza', 'perspicacia', 'medicina', 'supervivencia', 'trato-con-animales'],
  explorador: ['percepcion', 'sigilo', 'supervivencia', 'naturaleza', 'perspicacia', 'atletismo'],
  guerrero: ['atletismo', 'percepcion', 'intimidacion', 'supervivencia', 'acrobacias'],
  hechicero: ['persuasion', 'arcanos', 'perspicacia', 'engano', 'intimidacion'],
  mago: ['arcanos', 'investigacion', 'historia', 'perspicacia', 'medicina'],
  monje: ['acrobacias', 'perspicacia', 'sigilo', 'atletismo'],
  paladin: ['atletismo', 'persuasion', 'perspicacia', 'intimidacion', 'medicina'],
  picaro: ['sigilo', 'percepcion', 'acrobacias', 'engano', 'perspicacia', 'investigacion', 'persuasion', 'juego-de-manos'],
}

export function classSkillPool(cls: ClassData | undefined): SkillId[] {
  if (!cls) return []
  return cls.skillChoices.from === 'cualquiera' ? SKILLS.map((s) => s.id) : cls.skillChoices.from
}

const isSkill = (id: string): id is SkillId => SKILLS.some((s) => s.id === id)

function pickSkills(n: number, pool: SkillId[], taken: Set<string>, priority: SkillId[]): SkillId[] {
  const out: SkillId[] = []
  for (const s of [...priority, ...GENERAL_SKILLS, ...pool]) {
    if (out.length >= n) break
    if (pool.includes(s) && !taken.has(s) && !out.includes(s)) out.push(s)
  }
  return out
}

/**
 * Para lo que no es de la clase (especie, dotes): las habilidades de las
 * características más altas del personaje, las más útiles en general y, a
 * igualdad, las que la clase NO puede coger (así la clase aún elige las suyas).
 * Las puntuaciones son las del borrador o, si aún no las ha repartido, las
 * recomendadas para su clase y trasfondo.
 */
function originSkillPriority(d: Draft, rules: Rules): SkillId[] {
  const { cls, bg } = ctx(d, rules)
  const base = d.base ?? classArray(cls)
  const bonus = d.bonus ?? (bg ? recommendedBonus(bg, cls, base) : {})
  const pool = new Set(classSkillPool(cls))
  const score = (s: SkillId) => {
    const ability = SKILLS.find((x) => x.id === s)!.ability
    const m = mod(base[ability] + (bonus[ability] ?? 0))
    const rank = GENERAL_SKILLS.indexOf(s)
    const useful = rank < 4 ? 2 : rank < 9 ? 1 : rank < 14 ? 0 : -1
    return m * 2 + useful + (pool.has(s) ? 0 : 1)
  }
  return [...GENERAL_SKILLS].sort((a, b) => score(b) - score(a) || GENERAL_SKILLS.indexOf(a) - GENERAL_SKILLS.indexOf(b))
}

/* ---------- Rasgos de clase de nivel 1 ---------- */

/** Elecciones que se hacen en el paso «Habilidades y rasgos» (las demás tienen su paso). */
const OWN_STEP_KINDS = new Set(['subclase', 'truco', 'conjuro', 'maestria-armas', 'idioma', 'dote', 'don-epico'])

export function classFeatureChoices(cls: ClassData | undefined): { feature: Feature; choice: ChoiceDef }[] {
  return (cls?.features ?? [])
    .filter((f) => f.level === 1 && f.choice && !OWN_STEP_KINDS.has(f.choice.kind))
    .map((f) => ({ feature: f, choice: { ...f.choice!, options: f.choice!.options?.filter((o) => optionAllowed(o, 1, { taken: [], cantrips: [] })) } }))
}

/** Lo que el personaje ya tiene y cuenta para los requisitos de una opción. */
export interface OptionContext {
  /** Opciones ya elegidas en este rasgo y sus repeticiones (invocaciones que ya tiene). */
  taken: string[]
  /** Trucos de clase que conoce. */
  cantrips: string[]
  rules?: Rules
}

/** ¿Se puede repetir esta opción? (Descarga agónica, Lecciones de los primeros...) */
export const optionRepeatable = (o: ChoiceOption) => /\*\*Repetible\.\*\*/.test(o.text ?? '')

/**
 * ¿Cumple los requisitos de una opción a este nivel de clase? Lee la línea
 * «Requisitos:» de las invocaciones: nivel de brujo, otra invocación y truco
 * de brujo que cause daño (con tirada de ataque, si lo pide).
 */
export function optionAllowed(o: ChoiceOption, level: number, x: OptionContext): boolean {
  const req = o.text?.match(/\*\*Requisitos?:\*\*([^\n]*)/)?.[1] ?? ''
  const lvl = req.match(/de nivel (\d+) o superior/) ?? o.text?.match(/de nivel (\d+) o superior/)
  if (lvl && Number(lvl[1]) > level) return false
  const inv = req.match(/invocación ([^,.]+)/)
  if (inv && !x.taken.includes(slug(inv[1]))) return false
  if (/truco de brujo que cause daño/.test(req)) {
    const attack = /mediante una tirada de ataque/.test(req)
    const ok = x.cantrips.some((id) => {
      const sp = x.rules?.spell(id)
      if (!sp) return !x.rules // sin reglas a mano no se puede comprobar: se deja
      return sp.level === 0 && sp.classes.includes('brujo') && /de daño/.test(sp.text) && (!attack || /tirada de ataque/.test(sp.text))
    })
    if (!ok) return false
  }
  return true
}

const CHOICE_DEFAULTS: Record<string, string[]> = {
  'guerrero-estilo-de-combate': ['defensa'],
  'clerigo-orden-divina': ['protector'],
  'druida-orden-primigenia': ['guardian'],
  'brujo-invocaciones-sobrenaturales-n1': ['mente-sobrenatural'],
}

/** Efectos de elegir una orden (clérigo, druida). Clave: "<choiceId>:<opción>". */
const ORDER_EFFECTS: Record<string, { proficiencies?: string[]; cantripList?: string; label: string }> = {
  'clerigo-orden-divina:protector': { proficiencies: ['Armas marciales', 'Armadura pesada'], label: 'Protector' },
  'clerigo-orden-divina:taumaturgo': { cantripList: 'clerigo', label: 'Taumaturgo' },
  'druida-orden-primigenia:guardian': { proficiencies: ['Armas marciales', 'Armadura media'], label: 'Guardián' },
  'druida-orden-primigenia:naturalista': { cantripList: 'druida', label: 'Naturalista' },
}

function orderEffects(d: Draft) {
  return Object.entries(d.classChoices).flatMap(([k, ids]) => ids.map((id) => ORDER_EFFECTS[`${k}:${id}`]).filter(Boolean))
}

export function extraProficiencies(d: Draft): string[] {
  return uniq(orderEffects(d).flatMap((e) => e.proficiencies ?? []))
}

/** Lista de la que sale el truco extra de Taumaturgo o Naturalista, si lo hay. */
export function orderCantripList(d: Draft): { list: string; label: string } | undefined {
  const e = orderEffects(d).find((x) => x.cantripList)
  return e ? { list: e.cantripList!, label: e.label } : undefined
}

/** Idiomas que dan los rasgos de clase de nivel 1. */
const AUTO_LANGUAGES: Record<string, string> = {
  'picaro-jerga-de-ladrones': 'Jerga de ladrones',
  'druida-druidico': 'Druídico',
}

export function classLanguages(cls: ClassData | undefined): string[] {
  return (cls?.features ?? []).filter((f) => f.level === 1 && AUTO_LANGUAGES[f.id]).map((f) => AUTO_LANGUAGES[f.id])
}

/** Conjuros que la clase siempre tiene preparados a nivel 1 (no cuentan para el límite). */
const CLASS_ALWAYS: Record<string, { id: string; source: string; freeCast?: 'largo' }[]> = {
  druida: [{ id: 'hablar-con-los-animales', source: 'clase:Druídico' }],
  // los usos gratis ya los cuenta el recurso «Enemigo predilecto» de la clase (2, 3...)
  explorador: [{ id: 'marca-del-cazador', source: 'clase:Enemigo predilecto' }],
}

export function classAlwaysPrepared(classId: string | undefined): string[] {
  return (CLASS_ALWAYS[classId ?? ''] ?? []).map((x) => x.id)
}

/* ---------- Maestría con armas ---------- */

export function masteryCount(cls: ClassData | undefined): number {
  return atLevel(cls?.weaponMastery, 1) ?? 0
}

function proficientWith(cls: ClassData, w: WeaponData, extra: string[]): boolean {
  const ex = extra.map((x) => x.toLowerCase())
  if (w.category === 'sencilla') return cls.weapons.simple
  if (cls.weapons.martial === true || ex.includes('armas marciales')) return true
  if (cls.weapons.martial === 'ligeras') return w.properties.some((p) => /^ligera/i.test(p))
  if (cls.weapons.martial === 'sutiles-o-ligeras') return w.properties.some((p) => /^(sutil|ligera)/i.test(p))
  return false
}

/** Armas con las que la clase puede elegir maestría (el bárbaro, solo cuerpo a cuerpo). */
export function masteryWeapons(cls: ClassData | undefined, rules: Rules): WeaponData[] {
  if (!cls) return []
  return rules.book.weapons.filter((w) => proficientWith(cls, w, []) && (cls.id !== 'barbaro' || w.kind === 'cuerpo-a-cuerpo'))
}

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Armas que aparecen en un texto de equipo («2 dagas, espada corta, arco corto...»), en orden. */
export function weaponsInText(text: string, rules: Rules): WeaponData[] {
  const t = norm(text)
  const found: { w: WeaponData; at: number }[] = []
  for (const w of rules.book.weapons) {
    const n = norm(w.name)
    const words = n.split(' ')
    const plural = [words[0].endsWith('s') ? words[0] : `${words[0]}${/[aeiou]$/.test(words[0]) ? 's' : 'es'}`, ...words.slice(1)].join(' ')
    const re = new RegExp(`(^|[^a-z])(${n}|${plural})(?![a-z])`)
    const m = re.exec(t)
    if (m) found.push({ w, at: m.index })
  }
  // «Espada corta» no debe contar también como «espada»; «hacha a dos manos» no es «hacha de mano».
  return found.sort((a, b) => a.at - b.at).map((x) => x.w)
}

const dieAvg = (dmg: string) => {
  const m = dmg.match(/(\d+)d(\d+)/)
  return m ? (Number(m[1]) * (Number(m[2]) + 1)) / 2 : Number(dmg) || 0
}

/** Las armas del equipo inicial: la mejor cuerpo a cuerpo, la mejor a distancia y el resto por orden. */
export function recommendedMasteries(cls: ClassData | undefined, rules: Rules, equipOption?: string): string[] {
  const n = masteryCount(cls)
  if (!cls || !n) return []
  const allowed = new Set(masteryWeapons(cls, rules).map((w) => w.id))
  const opt = cls.startingEquipment.find((e) => e.option === equipOption) ?? cls.startingEquipment[0]
  let ws = weaponsInText(opt?.text ?? '', rules).filter((w) => allowed.has(w.id))
  if (!ws.length) ws = weaponsInText(cls.startingEquipment[0]?.text ?? '', rules).filter((w) => allowed.has(w.id))
  const best = (kind: WeaponData['kind']) => [...ws].filter((w) => w.kind === kind).sort((a, b) => dieAvg(b.damage) - dieAvg(a.damage))[0]
  const out: string[] = []
  for (const w of [best('cuerpo-a-cuerpo'), best('distancia'), ...ws]) if (w && !out.includes(w.id)) out.push(w.id)
  for (const id of ['espada-larga', 'arco-corto', 'lanza', 'daga', 'jabalina']) if (allowed.has(id) && !out.includes(id)) out.push(id)
  return out.slice(0, n)
}

/* ---------- Dotes de origen ---------- */

export const FEAT_INITIATE = 'iniciado-en-la-magia'
export const FEAT_SKILLED = 'habilidoso'
export const INITIATE_LISTS = ['clerigo', 'druida', 'mago']

export function originFeats(rules: Rules) {
  return rules.book.feats.filter((f) => f.category === 'origen')
}

/** Lista de Iniciado en la magia que fija el trasfondo («clérigo», «mago»). */
function bgInitiateList(bg: BackgroundData | undefined): string | undefined {
  const n = bg?.feat.note ? slug(bg.feat.note) : ''
  return INITIATE_LISTS.find((l) => n === l || n.startsWith(l))
}

/** Aptitud recomendada para magia ajena a la clase: la de la clase si es Int/Sab/Car; si no, la más alta de esas tres. */
export function recommendedCastingAbility(cls: ClassData | undefined): Ability {
  const sc = cls?.spellcasting?.ability
  if (sc === 'int' || sc === 'sab' || sc === 'car') return sc
  return abilityPriority(cls).find((a) => a === 'int' || a === 'sab' || a === 'car') ?? 'car'
}

function humanInitiateList(cls: ClassData | undefined, avoid?: string): string {
  const pref = cls?.id === 'clerigo' || cls?.id === 'paladin' ? 'clerigo' : cls?.id === 'druida' || cls?.id === 'explorador' ? 'druida' : 'mago'
  return [pref, ...INITIATE_LISTS].find((l) => l !== avoid) ?? 'mago'
}

/* ---------- Conjuros ---------- */

export const CANTRIPS: Record<string, string[]> = {
  bardo: ['burla-danina', 'luz', 'mano-de-mago', 'mensaje', 'ilusion-menor', 'prestidigitacion'],
  brujo: ['descarga-sobrenatural', 'mano-de-mago', 'prestidigitacion', 'ilusion-menor', 'toque-helado'],
  clerigo: ['llama-sagrada', 'guia', 'luz', 'taumaturgia', 'piedad-con-los-moribundos', 'resistencia', 'reparar'],
  druida: ['crear-llama', 'guia', 'saber-druidico', 'shillelagh', 'mensaje', 'resistencia'],
  hechicero: ['descarga-de-fuego', 'rayo-de-escarcha', 'mano-de-mago', 'luz', 'agarre-electrizante', 'mensaje', 'prestidigitacion'],
  mago: ['descarga-de-fuego', 'mano-de-mago', 'luz', 'rayo-de-escarcha', 'mensaje', 'prestidigitacion'],
}

export const PREPARED: Record<string, string[]> = {
  bardo: ['palabra-de-curacion', 'dormir', 'susurros-discordantes', 'hechizar-persona', 'heroismo', 'risa-horrible'],
  brujo: ['maleficio', 'hechizar-persona', 'reprension-infernal', 'proteccion-contra-el-bien-y-el-mal'],
  clerigo: ['palabra-de-curacion', 'curar-heridas', 'bendicion', 'saeta-guia', 'escudo-de-fe', 'santuario'],
  druida: ['palabra-de-curacion', 'enmaranar', 'fuego-feerico', 'ola-atronadora', 'curar-heridas', 'buenas-bayas'],
  explorador: ['curar-heridas', 'enmaranar', 'buenas-bayas', 'golpe-apresador'],
  hechicero: ['proyectil-magico', 'escudo', 'dormir', 'manos-ardientes'],
  mago: ['armadura-de-mago', 'proyectil-magico', 'escudo', 'dormir', 'manos-ardientes', 'detectar-magia'],
  paladin: ['bendicion', 'castigo-divino', 'curar-heridas', 'escudo-de-fe', 'favor-divino'],
}

const FEAT_CANTRIPS: Record<string, string[]> = {
  clerigo: ['guia', 'luz', 'llama-sagrada', 'taumaturgia', 'piedad-con-los-moribundos', 'resistencia'],
  druida: ['guia', 'saber-druidico', 'crear-llama', 'shillelagh', 'mensaje', 'resistencia'],
  mago: ['mano-de-mago', 'luz', 'mensaje', 'prestidigitacion', 'descarga-de-fuego', 'rayo-de-escarcha'],
}

const FEAT_SPELL: Record<string, string[]> = {
  clerigo: ['bendicion', 'palabra-de-curacion', 'curar-heridas', 'santuario', 'saeta-guia'],
  druida: ['buenas-bayas', 'curar-heridas', 'palabra-de-curacion', 'enmaranar'],
  mago: ['armadura-de-mago', 'escudo', 'dormir', 'detectar-magia', 'proyectil-magico'],
}

/** Trucos y conjuros de una lista de clase hasta el nivel 1. */
export function listSpells(rules: Rules, listId: string, level: 0 | 1): string[] {
  const ids = new Set(rules.cls(listId)?.spellList ?? [])
  return rules.book.spells.filter((s) => ids.has(s.id) && s.level === level).map((s) => s.id)
}

function pickSpells(n: number, pool: string[], taken: Set<string>, priority: string[]): string[] {
  const out: string[] = []
  for (const id of [...priority, ...pool]) {
    if (out.length >= n) break
    if (pool.includes(id) && !taken.has(id) && !out.includes(id)) out.push(id)
  }
  return out
}

/** Rasgos de especie que dan un conjuro fijo. */
const TRAIT_SPELLS: Record<string, string> = { 'tiefling-presencia-sobrenatural': 'taumaturgia' }

/** Elección de especie que da conjuros y pide aptitud mágica (Int, Sab o Car). */
export function lineageChoice(species: SpeciesData | undefined): ChoiceDef | undefined {
  return species?.choices?.find((ch) => /aptitud m[aá]gica/i.test(ch.note ?? '') || (ch.options ?? []).some((o) => o.spells?.length))
}

type ExtraSpell = Character['spells']['extra'][number]

/**
 * Conjuros que da la especie hasta un nivel de personaje: el truco del linaje
 * desde el nivel 1 y los de los niveles 3 y 5 (elfo, tiefling), con su aptitud.
 */
export function speciesSpellsAt(rules: Rules, speciesId: string, choices: Record<string, string>, level: number, ability: Ability | undefined): ExtraSpell[] {
  const species = rules.speciesOf(speciesId)
  if (!species) return []
  const out: ExtraSpell[] = []
  for (const ch of species.choices ?? []) {
    const picked = choices[ch.id]
    const opt = ch.options?.find((o) => o.id === picked)
    for (const s of opt?.spells ?? [])
      if (s.level <= level) out.push({ id: s.id, source: `especie:${picked}`, ability, ...(s.freeCast ? { freeCast: s.freeCast } : {}) })
  }
  for (const t of species.traits) {
    const id = TRAIT_SPELLS[t.id]
    if (id && t.level <= level) out.push({ id, source: `especie:${t.id.replace(`${species.id}-`, '')}`, ability })
  }
  return out.filter((s) => rules.spell(s.id))
}

/** Conjuros que da la especie a nivel 1 (con su aptitud). */
export function speciesSpells(d: Draft, rules: Rules): ExtraSpell[] {
  return speciesSpellsAt(rules, d.speciesId ?? '', d.speciesChoices, 1, d.speciesAbility)
}

export interface FeatSpellNeed {
  key: 'bgFeat' | 'speciesFeat'
  list: string
}

export interface SpellNeeds {
  cantrips: number
  prepared: number
  order?: { list: string; label: string }
  feats: FeatSpellNeed[]
  any: boolean
}

export function spellNeeds(d: Draft, rules: Rules): SpellNeeds {
  const sc = rules.cls(d.classId ?? '')?.spellcasting
  const cantrips = sc ? (atLevel(sc.cantrips, 1) ?? 0) : 0
  const prepared = sc ? (atLevel(sc.prepared, 1) ?? 0) : 0
  const order = orderCantripList(d)
  const feats: FeatSpellNeed[] = []
  for (const key of ['bgFeat', 'speciesFeat'] as const) {
    const p = d[key]
    const list = p?.id === FEAT_INITIATE ? p.choices.lista?.[0] : undefined
    if (list) feats.push({ key, list })
  }
  return { cantrips, prepared, order, feats, any: cantrips + prepared > 0 || !!order || feats.length > 0 }
}

/* ---------- Idiomas ---------- */

export const STANDARD_LANGUAGES = ['Dracónico', 'Elfo', 'Enano', 'Gigante', 'Gnomo', 'Goblin', 'Lengua de signos común', 'Mediano', 'Orco']
export const RARE_LANGUAGES = ['Abisal', 'Celestial', 'Druídico', 'Habla de las profundidades', 'Infernal', 'Infracomún', 'Jerga de ladrones', 'Primordial', 'Silvano']

const SPECIES_LANGUAGE: Record<string, string> = {
  draconido: 'Dracónico',
  elfo: 'Elfo',
  enano: 'Enano',
  gnomo: 'Gnomo',
  goliat: 'Gigante',
  mediano: 'Mediano',
  orco: 'Orco',
}

/** Idiomas que da la ficha sin elegir: común y los de los rasgos de clase. */
export function fixedLanguages(d: Draft, rules: Rules): string[] {
  return ['Común', ...classLanguages(rules.cls(d.classId ?? ''))]
}

/** Cuántos idiomas elige la persona: 2 de la creación y los que pidan los rasgos (pícaro: 1 más). */
export function languageCount(d: Draft, rules: Rules): number {
  const cls = rules.cls(d.classId ?? '')
  const extra = (cls?.features ?? []).filter((f) => f.level === 1 && f.choice?.kind === 'idioma').reduce((n, f) => n + (f.choice?.count ?? 0), 0)
  return 2 + extra
}

function recommendedLanguages(d: Draft, rules: Rules, n: number, current: string[]): string[] {
  const fixed = new Set(fixedLanguages(d, rules))
  const own = SPECIES_LANGUAGE[d.speciesId ?? '']
  const out = current.filter((l) => !fixed.has(l))
  for (const l of [own, 'Elfo', 'Enano', 'Mediano', 'Dracónico', 'Gnomo', 'Goblin', 'Orco', 'Gigante', 'Lengua de signos común'])
    if (l && out.length < n && !fixed.has(l) && !out.includes(l)) out.push(l)
  return out
}

/* ---------- Colores ---------- */

export interface ColorPreset {
  id: string
  name: string
  dark: [string, string]
  light: [string, string]
}

/** Colores del personaje que se ven bien sobre el fondo oscuro: [accent, accent-soft]. */
export const COLORS: ColorPreset[] = [
  { id: 'rubi', name: 'Rubí', dark: ['#F07A62', '#3D1F1A'], light: ['#A3311F', '#F6E2DD'] },
  { id: 'ambar', name: 'Ámbar', dark: ['#F2A65A', '#3A2614'], light: ['#9A5410', '#F7E7D6'] },
  { id: 'esmeralda', name: 'Esmeralda', dark: ['#8CC283', '#243323'], light: ['#3E6B3A', '#E2EDE0'] },
  { id: 'turquesa', name: 'Turquesa', dark: ['#6CC7D1', '#1B3438'], light: ['#1E6A73', '#DDEDEF'] },
  { id: 'zafiro', name: 'Zafiro', dark: ['#86A9F0', '#1D2742'], light: ['#2F4F9A', '#E1E8F7'] },
  { id: 'amatista', name: 'Amatista', dark: ['#B892E6', '#2D2440'], light: ['#6A3D9A', '#EEE6F7'] },
  { id: 'rosa', name: 'Rosa', dark: ['#F08DB8', '#3B1C2C'], light: ['#A3315F', '#F7E1EB'] },
  { id: 'plata', name: 'Plata', dark: ['#C3CCD6', '#272B30'], light: ['#4F5B67', '#E6EAEE'] },
]

const CLASS_COLOR: Record<string, string> = {
  barbaro: 'rubi',
  bardo: 'amatista',
  brujo: 'rosa',
  clerigo: 'ambar',
  druida: 'esmeralda',
  explorador: 'esmeralda',
  guerrero: 'zafiro',
  hechicero: 'rubi',
  mago: 'turquesa',
  monje: 'ambar',
  paladin: 'plata',
  picaro: 'amatista',
}

/** Paleta con la forma de data/party/looks.json; solo cuentan accent y accent-soft del oscuro. */
export function makePalette(colorId: string | undefined): NonNullable<Look['palette']> {
  const c = COLORS.find((x) => x.id === colorId) ?? COLORS[0]
  return {
    light: { bg: '#F4F1EA', surface: '#FFFFFF', ink: '#221C14', muted: '#6A5E4C', line: '#E2DACB', accent: c.light[0], 'accent-soft': c.light[1], brass: '#8A6410', 'brass-soft': '#F5ECD6', good: '#2E7D4F', bad: '#B23A3A' },
    dark: { bg: '#14100C', surface: '#1F1913', ink: '#ECE1C9', muted: '#A8977C', line: '#3A2F23', accent: c.dark[0], 'accent-soft': c.dark[1], brass: '#C9A35C', 'brass-soft': '#2E2417', good: '#8CC283', bad: '#E8735F' },
  }
}

/** Ideas de nombre por especie para quien se queda en blanco. */
export const NAME_IDEAS: Record<string, string[]> = {
  draconido: ['Vorasha', 'Kethrin', 'Brasmor', 'Ilyx'],
  elfo: ['Sileth', 'Iriel', 'Faelan', 'Naevra'],
  enano: ['Borin Pizarra', 'Helga Yunque', 'Durgan', 'Thora'],
  gnomo: ['Pipwick', 'Nim Tornillo', 'Bimble', 'Tizzy'],
  goliat: ['Kavor', 'Thura Cumbrealta', 'Gauth', 'Mira Piedrafría'],
  humano: ['Alba de Vado', 'Rodrigo', 'Lucía', 'Tomás el Rojo'],
  mediano: ['Rosa Matojo', 'Pim Bellota', 'Tobías Ligero', 'Margarita'],
  orco: ['Grusha', 'Ruk', 'Varga', 'Thokk'],
  tiefling: ['Ceniza', 'Penitencia', 'Azkar', 'Lírica'],
}

/* ---------- Cambiar clase, trasfondo o especie ---------- */

/** Cambiar de clase deshace lo que dependía de ella. */
export function setClass(d: Draft, classId: string): Draft {
  if (d.classId === classId) return d
  return {
    ...d,
    classId,
    // La matriz se recoloca para la clase nueva; las tiradas se conservan y se reparten otra vez.
    base: undefined,
    bonus: undefined,
    classSkills: undefined,
    classTools: undefined,
    classChoices: {},
    masteries: undefined,
    cantrips: undefined,
    prepared: undefined,
    orderCantrip: undefined,
    equipClass: undefined,
    pendingNotes: {},
    languages: undefined,
    color: undefined,
  }
}

export function setBackground(d: Draft, backgroundId: string): Draft {
  if (d.backgroundId === backgroundId) return d
  return { ...d, backgroundId, bgFeat: undefined, bgTool: undefined, bonus: undefined, equipBg: undefined, pendingNotes: {} }
}

export function setSpecies(d: Draft, speciesId: string): Draft {
  if (d.speciesId === speciesId) return d
  return { ...d, speciesId, speciesChoices: {}, speciesAbility: undefined, speciesFeat: undefined, languages: undefined }
}

export function setMethod(d: Draft, method: Method): Draft {
  if (d.method === method) return d
  return { ...d, method, base: undefined, rolls: method === 'tirada' ? d.rolls : undefined }
}

/* ---------- Contexto común ---------- */

function ctx(d: Draft, rules: Rules) {
  const cls = rules.cls(d.classId ?? '')
  const bg = rules.background(d.backgroundId ?? '')
  const species = rules.speciesOf(d.speciesId ?? '')
  return { cls, bg, species }
}

const speciesSkillChoices = (species: SpeciesData | undefined) => (species?.choices ?? []).filter((ch) => ch.kind === 'habilidad')
const speciesFeatChoice = (species: SpeciesData | undefined) => species?.choices?.find((ch) => ch.kind === 'dote-origen')

/** Habilidades que da todo menos la clase, en orden de prioridad (trasfondo > dote del trasfondo > especie > dote de especie). */
function nonClassSkills(d: Draft, rules: Rules): SkillId[] {
  const { bg, species } = ctx(d, rules)
  const out: SkillId[] = [...(bg?.skills ?? [])]
  for (const id of d.bgFeat?.id === FEAT_SKILLED ? (d.bgFeat.choices.competencias ?? []) : []) if (isSkill(id)) out.push(id)
  for (const ch of speciesSkillChoices(species)) {
    const v = d.speciesChoices[ch.id]
    if (v && isSkill(v)) out.push(v)
  }
  for (const id of d.speciesFeat?.id === FEAT_SKILLED ? (d.speciesFeat.choices.competencias ?? []) : []) if (isSkill(id)) out.push(id)
  return uniq(out)
}

/** Todas las competencias en habilidades del borrador. */
export function draftSkills(d: Draft, rules: Rules): SkillId[] {
  return uniq([...nonClassSkills(d, rules), ...(d.classSkills ?? [])])
}

/** Opciones de habilidad de una elección de especie (Sentidos agudos) o cualquiera (Diestro). */
export function speciesSkillOptions(ch: ChoiceDef): SkillId[] {
  return ch.options?.length ? (ch.options.map((o) => o.id).filter(isSkill) as SkillId[]) : SKILLS.map((s) => s.id)
}

/* ---------- Normalizar: quitar lo que ya no cuadra ---------- */

/**
 * Deja el borrador coherente: sin habilidades repetidas (la que llega después
 * cede y hay que elegir otra), sin elecciones que ya no existen y sin pasarse
 * de los límites. No inventa nada: lo que falte lo dice la validación.
 */
export function normalize(d: Draft, rules: Rules): Draft {
  const { cls, bg, species } = ctx(d, rules)
  const out: Draft = { ...d, speciesChoices: { ...d.speciesChoices }, classChoices: { ...d.classChoices } }
  const taken = new Set<string>(bg?.skills ?? [])

  const fixFeat = (p: FeatPick | undefined, allowed?: (id: string) => boolean): FeatPick | undefined => {
    if (!p) return p
    if (allowed && !allowed(p.id)) return undefined
    if (p.id !== FEAT_SKILLED) return p
    const comp = uniq((p.choices.competencias ?? []).filter((x) => !taken.has(x) && (isSkill(x) || TOOL_BY_ID.has(x)))).slice(0, 3)
    comp.forEach((x) => taken.add(x))
    return { ...p, choices: { ...p.choices, competencias: comp } }
  }

  // Dote del trasfondo: tiene que ser la del trasfondo.
  if (out.bgFeat && out.bgFeat.id !== bg?.feat.id) out.bgFeat = undefined
  out.bgFeat = fixFeat(out.bgFeat)

  // Elecciones de especie
  const validChoice = new Map((species?.choices ?? []).map((ch) => [ch.id, ch]))
  for (const k of Object.keys(out.speciesChoices)) if (!validChoice.has(k)) delete out.speciesChoices[k]
  for (const ch of speciesSkillChoices(species)) {
    const v = out.speciesChoices[ch.id]
    if (!v) continue
    if (taken.has(v) || !speciesSkillOptions(ch).includes(v as SkillId)) delete out.speciesChoices[ch.id]
    else taken.add(v)
  }
  const featCh = speciesFeatChoice(species)
  if (!featCh) out.speciesFeat = undefined
  // La dote extra no puede repetir la del trasfondo salvo que sea repetible (y entonces con otra lista).
  out.speciesFeat = fixFeat(out.speciesFeat, (id) => {
    const f = rules.feat(id)
    return !!f && f.category === 'origen' && id !== bg?.feat.id
  })
  if (featCh && out.speciesFeat) out.speciesChoices[featCh.id] = out.speciesFeat.id
  else if (featCh) delete out.speciesChoices[featCh.id]

  // Habilidades de clase
  if (out.classSkills) {
    const pool = classSkillPool(cls)
    out.classSkills = uniq(out.classSkills.filter((s) => pool.includes(s) && !taken.has(s))).slice(0, cls?.skillChoices.count ?? 0)
  }
  const skills = new Set(draftSkills(out, rules))

  // Rasgos de clase: solo los de esta clase; la pericia, sobre habilidades competentes.
  const feats = classFeatureChoices(cls)
  const ids = new Set(feats.map((x) => x.choice.id))
  for (const k of Object.keys(out.classChoices)) if (!ids.has(k)) delete out.classChoices[k]
  for (const { choice } of feats) {
    const v = out.classChoices[choice.id]
    if (!v) continue
    let next = uniq(v)
    if (choice.kind === 'pericia') next = next.filter((s) => skills.has(s as SkillId))
    if (choice.options?.length) next = next.filter((id) => choice.options!.some((o) => o.id === id))
    out.classChoices[choice.id] = next.slice(0, choice.count)
  }

  // Herramientas de clase
  const tr = toolRule(cls?.toolText)
  if (out.classTools) out.classTools = tr && !tr.fixed ? uniq(out.classTools.filter((t) => tr.options.includes(t))).slice(0, tr.count) : undefined
  const btr = toolRule(bg?.tool)
  if (out.bgTool && (!btr || btr.fixed || !btr.options.includes(out.bgTool))) out.bgTool = undefined

  // Maestrías
  if (out.masteries) {
    const allowed = new Set(masteryWeapons(cls, rules).map((w) => w.id))
    out.masteries = uniq(out.masteries.filter((id) => allowed.has(id))).slice(0, masteryCount(cls))
  }

  // Conjuros: los de la especie mandan; luego la clase, la orden y las dotes.
  const needs = spellNeeds(out, rules)
  const known = new Set(speciesSpells(out, rules).map((s) => s.id))
  const always = new Set(classAlwaysPrepared(out.classId))
  if (out.cantrips) {
    const pool = cls?.spellList ? new Set(listSpells(rules, cls.id, 0)) : new Set<string>()
    out.cantrips = uniq(out.cantrips.filter((id) => pool.has(id) && !known.has(id))).slice(0, needs.cantrips)
    out.cantrips.forEach((id) => known.add(id))
  }
  if (out.prepared) {
    const pool = cls?.spellList ? new Set(listSpells(rules, cls.id, 1)) : new Set<string>()
    out.prepared = uniq(out.prepared.filter((id) => pool.has(id) && !always.has(id))).slice(0, needs.prepared)
  }
  if (out.orderCantrip) {
    if (!needs.order) out.orderCantrip = undefined
    else {
      const pool = new Set(listSpells(rules, needs.order.list, 0))
      out.orderCantrip = out.orderCantrip.filter((id) => pool.has(id) && !known.has(id)).slice(0, 1)
      out.orderCantrip.forEach((id) => known.add(id))
    }
  }
  for (const key of ['bgFeat', 'speciesFeat'] as const) {
    const p = out[key]
    if (p?.id !== FEAT_INITIATE) continue
    const list = p.choices.lista?.[0]
    const ch = { ...p.choices }
    if (!list || !INITIATE_LISTS.includes(list)) {
      delete ch.trucos
      delete ch.conjuro
    } else {
      const c0 = new Set(listSpells(rules, list, 0))
      const c1 = new Set(listSpells(rules, list, 1))
      if (ch.trucos) ch.trucos = uniq(ch.trucos.filter((id) => c0.has(id) && !known.has(id))).slice(0, 2)
      ch.trucos?.forEach((id) => known.add(id))
      if (ch.conjuro) ch.conjuro = ch.conjuro.filter((id) => c1.has(id)).slice(0, 1)
    }
    out[key] = { ...p, choices: ch }
  }
  // Dos Iniciados en la magia no pueden usar la misma lista.
  if (out.bgFeat?.id === FEAT_INITIATE && out.speciesFeat?.id === FEAT_INITIATE && out.bgFeat.choices.lista?.[0] === out.speciesFeat.choices.lista?.[0]) {
    out.speciesFeat = { ...out.speciesFeat, choices: { ...out.speciesFeat.choices, lista: [] } }
  }

  // Bonus del trasfondo
  if (out.bonus && bg) out.bonus = Object.fromEntries(Object.entries(out.bonus).filter(([a, v]) => v && bg.abilities.includes(a as Ability)))
  if (out.bonus && !bg) out.bonus = undefined

  // Equipo
  if (out.equipClass && !cls?.startingEquipment.some((e) => e.option === out.equipClass)) out.equipClass = undefined
  if (out.equipBg && !bg?.equipment.some((e) => e.option === out.equipBg)) out.equipBg = undefined

  // Idiomas
  if (out.languages) {
    const fixed = new Set(fixedLanguages(out, rules))
    out.languages = uniq(out.languages.filter((l) => l.trim() && !fixed.has(l))).slice(0, languageCount(out, rules))
  }

  // Puntuaciones
  if (out.base && ABILITIES.some((a) => typeof out.base![a] !== 'number')) out.base = undefined
  return out
}

/* ---------- Rellenar lo recomendado ---------- */

function fillFeat(p: FeatPick, d: Draft, rules: Rules, initiateList: string): FeatPick {
  const { cls } = ctx(d, rules)
  const choices = { ...p.choices }
  if (p.id === FEAT_INITIATE) {
    if (!choices.lista?.length) choices.lista = [initiateList]
    if (!choices.aptitud?.length) choices.aptitud = [recommendedCastingAbility(cls)]
  }
  if (p.id === FEAT_SKILLED) {
    const cur = choices.competencias ?? []
    if (cur.length < 3) {
      const taken = new Set<string>([...nonClassSkills(d, rules), ...(d.classSkills ?? []), ...cur])
      const pool = SKILLS.map((s) => s.id)
      // Las opciones de una elección de habilidad de la especie aún sin hacer (Sentidos agudos del
      // elfo) se dejan para el final: si Habilidoso se las lleva todas, la especie no tendría qué elegir.
      const { species } = ctx(d, rules)
      const reserved = speciesSkillChoices(species)
        .filter((ch) => !d.speciesChoices[ch.id] && ch.options?.length)
        .flatMap((ch) => speciesSkillOptions(ch))
      const priority = originSkillPriority(d, rules)
      const first = pickSkills(3 - cur.length, pool, new Set([...taken, ...reserved]), priority)
      const rest = pickSkills(3 - cur.length - first.length, pool, new Set([...taken, ...first]), priority)
      choices.competencias = [...cur, ...first, ...rest]
    }
  }
  return { ...p, choices }
}

function fillStep(d: Draft, rules: Rules, step: StepId): Draft {
  const { cls, bg, species } = ctx(d, rules)
  switch (step) {
    case 'trasfondo': {
      if (!bg) return d
      const out = { ...d }
      const btr = toolRule(bg.tool)
      if (btr && !btr.fixed && !out.bgTool) out.bgTool = recommendedTools(btr)[0]
      out.bgFeat = fillFeat(out.bgFeat ?? { id: bg.feat.id, choices: {} }, out, rules, bgInitiateList(bg) ?? 'mago')
      return out
    }
    case 'especie': {
      if (!species) return d
      let out: Draft = { ...d, speciesChoices: { ...d.speciesChoices } }
      for (const ch of species.choices ?? []) {
        if (out.speciesChoices[ch.id] || ch.kind === 'dote-origen') continue
        if (ch.kind === 'habilidad') {
          const taken = new Set<string>(nonClassSkills(out, rules))
          const pick = pickSkills(1, speciesSkillOptions(ch), taken, originSkillPriority(out, rules))[0]
          if (pick) out.speciesChoices[ch.id] = pick
          continue
        }
        const def = SPECIES_CHOICE_DEFAULTS[ch.id]
        const opt = ch.options?.find((o) => o.id === def) ?? ch.options?.[0]
        if (opt) out.speciesChoices[ch.id] = opt.id
      }
      if (lineageChoice(species) && !out.speciesAbility) out.speciesAbility = recommendedCastingAbility(cls)
      const featCh = speciesFeatChoice(species)
      if (featCh && !out.speciesFeat) {
        const id = [FEAT_SKILLED, 'alerta', FEAT_INITIATE].find((x) => rules.feat(x) && x !== bg?.feat.id) ?? originFeats(rules)[0]?.id
        if (id) out.speciesFeat = { id, choices: {} }
      }
      if (out.speciesFeat) {
        out = normalize(out, rules)
        const avoid = out.bgFeat?.id === FEAT_INITIATE ? out.bgFeat.choices.lista?.[0] : undefined
        if (out.speciesFeat) out.speciesFeat = fillFeat(out.speciesFeat, out, rules, humanInitiateList(cls, avoid))
      }
      return out
    }
    case 'caracteristicas': {
      const out = { ...d }
      if (!out.base) {
        if (out.method === 'tirada') {
          if (out.rolls?.length === 6) out.base = assignByPriority(out.rolls.map(rollTotal), cls)
        } else out.base = classArray(cls)
      }
      if (!out.bonus && bg) out.bonus = recommendedBonus(bg, cls, out.base)
      return out
    }
    case 'habilidades': {
      if (!cls) return d
      const out: Draft = { ...d, classChoices: { ...d.classChoices } }
      const n = cls.skillChoices.count
      const cur = out.classSkills ?? []
      if (cur.length < n) {
        const taken = new Set<string>([...nonClassSkills(out, rules), ...cur])
        out.classSkills = [...cur, ...pickSkills(n - cur.length, classSkillPool(cls), taken, CLASS_SKILLS[cls.id] ?? [])]
      }
      const tr = toolRule(cls.toolText)
      if (tr && !tr.fixed && (out.classTools ?? []).length < tr.count) {
        const have = out.classTools ?? []
        out.classTools = [...have, ...recommendedTools(tr).filter((t) => !have.includes(t))].slice(0, tr.count)
      }
      const skills = draftSkills(out, rules)
      for (const { choice } of classFeatureChoices(cls)) {
        const have = out.classChoices[choice.id] ?? []
        if (have.length >= choice.count) continue
        let rec: string[]
        if (choice.kind === 'pericia') rec = pickSkills(choice.count, skills, new Set(have), CLASS_SKILLS[cls.id] ?? [])
        else rec = [...(CHOICE_DEFAULTS[choice.id] ?? []), ...(choice.options ?? []).map((o) => o.id)]
        if (choice.kind === 'estilo-combate') rec = rec.filter((id) => rules.feat(id)?.category === 'estilo-combate')
        if (choice.options?.length) rec = rec.filter((id) => choice.options!.some((o) => o.id === id))
        out.classChoices[choice.id] = uniq([...have, ...rec]).slice(0, choice.count)
      }
      const nm = masteryCount(cls)
      if (nm && (out.masteries ?? []).length < nm) {
        const have = out.masteries ?? []
        out.masteries = uniq([...have, ...recommendedMasteries(cls, rules, out.equipClass)]).slice(0, nm)
      }
      return out
    }
    case 'conjuros': {
      const needs = spellNeeds(d, rules)
      if (!needs.any) return d
      const out: Draft = { ...d }
      const known = new Set(speciesSpells(out, rules).map((s) => s.id))
      if (cls && needs.cantrips) {
        const cur = (out.cantrips ?? []).filter((id) => !known.has(id))
        out.cantrips = [...cur, ...pickSpells(needs.cantrips - cur.length, listSpells(rules, cls.id, 0), new Set([...known, ...cur]), CANTRIPS[cls.id] ?? [])]
      }
      out.cantrips?.forEach((id) => known.add(id))
      if (cls && needs.prepared) {
        const always = new Set(classAlwaysPrepared(cls.id))
        const cur = out.prepared ?? []
        out.prepared = [...cur, ...pickSpells(needs.prepared - cur.length, listSpells(rules, cls.id, 1), new Set([...always, ...cur]), PREPARED[cls.id] ?? [])]
      }
      if (needs.order && !(out.orderCantrip ?? []).length) {
        const list = needs.order.list
        out.orderCantrip = pickSpells(1, listSpells(rules, list, 0), known, CANTRIPS[list] ?? [])
      }
      out.orderCantrip?.forEach((id) => known.add(id))
      const prepared = new Set([...(out.prepared ?? []), ...classAlwaysPrepared(cls?.id)])
      for (const need of needs.feats) {
        const p = out[need.key]!
        const ch = { ...p.choices }
        const tr = (ch.trucos ?? []).filter((id) => !known.has(id))
        ch.trucos = [...tr, ...pickSpells(2 - tr.length, listSpells(rules, need.list, 0), new Set([...known, ...tr]), FEAT_CANTRIPS[need.list] ?? [])]
        ch.trucos.forEach((id) => known.add(id))
        if (!(ch.conjuro ?? []).length) ch.conjuro = pickSpells(1, listSpells(rules, need.list, 1), prepared, FEAT_SPELL[need.list] ?? [])
        ch.conjuro.forEach((id) => prepared.add(id))
        out[need.key] = { ...p, choices: ch }
      }
      return out
    }
    case 'equipo': {
      const out = { ...d, pendingNotes: { ...d.pendingNotes } }
      if (cls && !out.equipClass) out.equipClass = cls.startingEquipment[0]?.option
      if (bg && !out.equipBg) out.equipBg = bg.equipment[0]?.option
      // «Instrumento musical de tu elección», «juego (el mismo que arriba)»: lo que ya eligió en competencias.
      for (const p of draftGear(out, rules).pending) {
        if (p.text in out.pendingNotes) continue
        const s = suggestPending(out, p.text)
        if (s) out.pendingNotes[p.text] = s
      }
      return out
    }
    case 'idiomas': {
      const n = languageCount(d, rules)
      const cur = d.languages ?? []
      if (cur.length >= n) return d
      return { ...d, languages: recommendedLanguages(d, rules, n, cur) }
    }
    case 'quien': {
      if (d.color) return d
      return { ...d, color: CLASS_COLOR[d.classId ?? ''] ?? COLORS[0].id }
    }
    default:
      return d
  }
}

const SPECIES_CHOICE_DEFAULTS: Record<string, string> = {
  'draconido-linaje-draconico': 'rojo',
  'elfo-linaje-elfico': 'alto-elfo',
  'gnomo-linaje-gnomo': 'gnomo-de-los-bosques',
  'goliat-linaje-gigante': 'abrasion-del-fuego',
  'tiefling-legado-infernal': 'infernal',
  'humano-tamano': 'mediano',
  'tiefling-tamano': 'mediano',
}

/** Rellena con lo recomendado lo que falte en los pasos hasta `step` (incluido). */
export function fillUpTo(d: Draft, rules: Rules, step: StepId): Draft {
  let out = normalize(d, rules)
  for (const s of STEP_ORDER) {
    out = normalize(fillStep(out, rules, s), rules)
    if (s === step) break
  }
  return out
}

export const fillAll = (d: Draft, rules: Rules) => fillUpTo(d, rules, 'repaso')

/** «Elegir por mí»: vuelve a lo recomendado en un paso (y elige clase, trasfondo o especie si falta). */
export function recommendStep(d: Draft, rules: Rules, step: StepId): Draft {
  let out = { ...d }
  switch (step) {
    case 'clase':
      out = setClass(out, RECOMMENDED_CLASS)
      break
    case 'trasfondo': {
      const id = recommendedBackground(rules, out.classId)
      if (id) out = setBackground(out, id)
      out = { ...out, bgFeat: undefined, bgTool: undefined }
      break
    }
    case 'especie': {
      const id = recommendedSpecies(rules, out.classId)
      if (id) out = setSpecies(out, id)
      out = { ...out, speciesChoices: {}, speciesAbility: undefined, speciesFeat: undefined }
      break
    }
    case 'caracteristicas':
      out = { ...out, method: 'estandar', base: undefined, rolls: undefined, bonus: undefined }
      break
    case 'habilidades':
      out = { ...out, classSkills: undefined, classTools: undefined, classChoices: {}, masteries: undefined }
      break
    case 'conjuros': {
      out = { ...out, cantrips: undefined, prepared: undefined, orderCantrip: undefined }
      for (const key of ['bgFeat', 'speciesFeat'] as const) {
        const p = out[key]
        if (p?.id === FEAT_INITIATE) {
          const { trucos: _t, conjuro: _c, ...rest } = p.choices
          out[key] = { ...p, choices: rest }
        }
      }
      break
    }
    case 'equipo':
      out = { ...out, equipClass: undefined, equipBg: undefined, pendingNotes: {} }
      break
    case 'idiomas':
      out = { ...out, languages: undefined }
      break
    case 'quien': {
      const ideas = NAME_IDEAS[out.speciesId ?? ''] ?? NAME_IDEAS.humano
      out = { ...out, color: undefined, name: out.name.trim() ? out.name : ideas[0] }
      break
    }
  }
  return fillUpTo(out, rules, step)
}

/* ---------- Validación por paso ---------- */

/** Pasos del asistente para este borrador (Conjuros solo si hace falta). */
export function stepsFor(d: Draft, rules: Rules): StepId[] {
  const needs = spellNeeds(d, rules)
  return STEP_ORDER.filter((s) => s !== 'conjuros' || needs.any)
}

function featIssues(p: FeatPick | undefined, rules: Rules, owner: string): string[] {
  if (!p) return [`Elige la dote de origen ${owner}.`]
  const f = rules.feat(p.id)
  if (!f) return [`No encuentro la dote «${p.id}».`]
  const out: string[] = []
  if (p.id === FEAT_INITIATE) {
    if (!p.choices.lista?.[0]) out.push(`Elige la lista de conjuros de ${f.name} ${owner}.`)
    if (!p.choices.aptitud?.[0]) out.push(`Elige con qué característica lanzas los conjuros de ${f.name}.`)
  }
  if (p.id === FEAT_SKILLED) {
    const left = 3 - (p.choices.competencias ?? []).length
    if (left > 0) out.push(`Te ${plural(left, 'falta', 'faltan')} ${left} ${plural(left, 'competencia', 'competencias')} de ${f.name}.`)
  }
  return out
}

/** Lo que falta en un paso. Vacío = se puede seguir. */
export function stepIssues(d: Draft, rules: Rules, step: StepId): string[] {
  const { cls, bg, species } = ctx(d, rules)
  const out: string[] = []
  switch (step) {
    case 'clase':
      if (!cls) out.push('Elige una clase.')
      break
    case 'trasfondo': {
      if (!bg) {
        out.push('Elige un trasfondo.')
        break
      }
      const btr = toolRule(bg.tool)
      if (btr && !btr.fixed && !d.bgTool) out.push('Elige tu herramienta del trasfondo.')
      out.push(...featIssues(d.bgFeat, rules, 'del trasfondo'))
      break
    }
    case 'especie': {
      if (!species) {
        out.push('Elige una especie.')
        break
      }
      for (const ch of species.choices ?? []) {
        if (ch.kind === 'dote-origen') continue
        if (!d.speciesChoices[ch.id]) out.push(`Falta elegir: ${choiceName(species, ch)}.`)
      }
      if (lineageChoice(species) && !d.speciesAbility) out.push('Elige con qué característica lanzas los conjuros de tu linaje.')
      if (speciesFeatChoice(species)) out.push(...featIssues(d.speciesFeat, rules, `de ${species.name.toLowerCase()}`))
      break
    }
    case 'caracteristicas': {
      const b = d.base
      if (!b) {
        out.push(d.method === 'tirada' ? 'Tira los dados o escribe tus seis tiradas.' : 'Reparte tus puntuaciones.')
        break
      }
      const vals = ABILITIES.map((a) => b[a]).sort((x, y) => x - y)
      if (d.method === 'estandar' && vals.join() !== [...STANDARD_ARRAY].sort((x, y) => x - y).join()) out.push('Usa cada número de la matriz estándar una sola vez.')
      if (d.method === 'tirada' && vals.join() !== (d.rolls ?? []).map(rollTotal).sort((x, y) => x - y).join()) out.push('Usa cada tirada una sola vez.')
      if (d.method === 'puntos') {
        if (ABILITIES.some((a) => b[a] < 8 || b[a] > 15)) out.push('Con la compra por puntos cada puntuación va de 8 a 15.')
        else if (pointCost(b) > POINT_BUDGET) out.push(`Te has pasado ${pointCost(b) - POINT_BUDGET} puntos: baja alguna puntuación.`)
      }
      const issue = bonusIssue(bg, d.bonus, b)
      if (issue) out.push(issue)
      break
    }
    case 'habilidades': {
      if (!cls) break
      const left = cls.skillChoices.count - (d.classSkills ?? []).length
      if (left > 0) out.push(`Te ${plural(left, 'falta', 'faltan')} ${left} ${plural(left, 'habilidad', 'habilidades')} de clase.`)
      const tr = toolRule(cls.toolText)
      if (tr && !tr.fixed) {
        const t = tr.count - (d.classTools ?? []).length
        if (t > 0) out.push(`Elige ${t} ${plural(t, 'herramienta o instrumento', 'herramientas o instrumentos')} más.`)
      }
      for (const { feature, choice } of classFeatureChoices(cls)) if ((d.classChoices[choice.id] ?? []).length < choice.count) out.push(`Falta elegir: ${feature.name}.`)
      const nm = masteryCount(cls)
      const m = nm - (d.masteries ?? []).length
      if (m > 0) out.push(`Elige ${m} ${plural(m, 'arma', 'armas')} más para Maestría con armas.`)
      break
    }
    case 'conjuros': {
      const needs = spellNeeds(d, rules)
      const c = needs.cantrips - (d.cantrips ?? []).length
      if (c > 0) out.push(`Te ${plural(c, 'falta', 'faltan')} ${c} ${plural(c, 'truco', 'trucos')}.`)
      const p = needs.prepared - (d.prepared ?? []).length
      if (p > 0) out.push(`Te ${plural(p, 'falta', 'faltan')} ${p} ${plural(p, 'conjuro', 'conjuros')} por preparar.`)
      if (needs.order && !(d.orderCantrip ?? []).length) out.push(`Elige el truco extra de ${needs.order.label}.`)
      for (const need of needs.feats) {
        const ch = d[need.key]?.choices ?? {}
        const t = 2 - (ch.trucos ?? []).length
        if (t > 0) out.push(`Te ${plural(t, 'falta', 'faltan')} ${t} ${plural(t, 'truco', 'trucos')} de Iniciado en la magia.`)
        if (!(ch.conjuro ?? []).length) out.push('Elige el conjuro de nivel 1 de Iniciado en la magia.')
      }
      break
    }
    case 'equipo':
      if (cls && !d.equipClass) out.push('Elige tu equipo de clase.')
      if (bg && !d.equipBg) out.push('Elige tu equipo del trasfondo.')
      break
    case 'idiomas': {
      const left = languageCount(d, rules) - (d.languages ?? []).length
      if (left > 0) out.push(`Elige ${left} ${plural(left, 'idioma', 'idiomas')} más.`)
      break
    }
    case 'quien':
      if (!d.name.trim()) out.push('Escribe un nombre para tu personaje.')
      break
    case 'repaso':
      for (const s of STEP_ORDER) if (s !== 'repaso' && stepsFor(d, rules).includes(s)) out.push(...stepIssues(d, rules, s))
      break
  }
  return out
}

/** Nombre legible de una elección de especie («Linaje dracónico», «Tamaño»...). */
export function choiceName(species: SpeciesData, ch: ChoiceDef): string {
  const t = species.traits.find((x) => x.id === ch.id)
  if (t) return t.name
  if (/tamano$/.test(ch.id)) return 'Tamaño'
  return ch.id.replace(`${species.id}-`, '').replace(/-/g, ' ')
}

/* ---------- Equipo ---------- */

/** Analizador de equipo trozo a trozo (el de equipment.ts; los tests pueden pasar otro). */
export type PartsParser = (text: string, rules: Rules) => EquipmentPart[]

export interface PendingGear {
  /** El trozo del texto que pide elegir («instrumento musical de tu elección»). */
  text: string
  from: 'clase' | 'trasfondo'
  /** Nombre del objeto genérico que pone el analizador («Instrumento musical»). */
  name: string
}

export interface GearResult {
  items: Item[]
  coins: Coins
  /** Partes «a tu elección», con de dónde salen. */
  pending: PendingGear[]
}

/**
 * Convierte las opciones de equipo elegidas en objetos y monedas. Las partes
 * «a tu elección» ya traen un objeto genérico: si la persona ha escrito qué
 * escoge, ese objeto pasa a llamarse así.
 */
export function draftGear(d: Draft, rules: Rules, parse: PartsParser = parseEquipmentParts): GearResult {
  const { cls, bg } = ctx(d, rules)
  const coins: Coins = { pc: 0, pp: 0, pe: 0, po: 0, ppt: 0 }
  const items: Item[] = []
  const pending: PendingGear[] = []
  const fromOf = new Map<Item, 'clase' | 'trasfondo'>()
  const add = (it: Item, from: 'clase' | 'trasfondo') => {
    const same = items.find((x) => x.id === it.id)
    if (same && same.name === it.name && same.ref?.id === it.ref?.id) {
      // Un objeto suelto que dan la clase y el trasfondo (el símbolo sagrado del clérigo acólito): se dice por qué hay dos.
      if (fromOf.get(same) !== from && !same.ref && same.qty === 1 && it.qty === 1)
        same.notes = `${same.notes ? `${same.notes} ` : ''}Te dan uno tu clase y otro tu trasfondo.`
      same.qty += it.qty
      return
    }
    const base = it.id || slug(it.name) || 'objeto'
    let id = base
    for (let n = 2; items.some((x) => x.id === id); n++) id = `${base}-${n}`
    const item = { ...it, id }
    items.push(item)
    fromOf.set(item, from)
  }
  /** El objeto genérico de una elección, con el nombre de lo elegido (y su arma o armadura si la hay). */
  const named = (item: Item, answer: string, notes: string): Item => {
    const w = rules.book.weapons.find((x) => norm(x.name) === norm(answer))
    const a = rules.book.armor.find((x) => norm(x.name) === norm(answer))
    const ref: Item['ref'] = w ? { kind: 'arma', id: w.id } : a ? { kind: 'armadura', id: a.id } : item.ref
    return { ...item, id: slug(answer) || item.id, name: capital(answer), notes, ...(ref ? { ref } : {}) }
  }
  const take = (text: string | undefined, from: 'clase' | 'trasfondo') => {
    if (!text) return
    let parts: EquipmentPart[]
    try {
      parts = parse(text, rules)
    } catch {
      parts = [{ text, item: { id: slug(text).slice(0, 40) || 'equipo', name: text, qty: 1 } }]
    }
    for (const p of parts) {
      for (const k of Object.keys(coins) as (keyof Coins)[]) coins[k] += p.coins?.[k] ?? 0
      if (!p.item) continue
      if (!p.pending) {
        add({ ...p.item }, from)
        continue
      }
      // «juego (el mismo que arriba)»: no es una elección nueva, es el juego que ya eligió en competencias.
      const same = sameAsChosen(d, p.text)
      if (same) {
        add(named(p.item, same, 'El mismo con el que tienes competencia.'), from)
        continue
      }
      pending.push({ text: p.text, from, name: p.item.name })
      const answer = (d.pendingNotes[p.text] ?? '').trim()
      if (!answer) {
        add({ ...p.item }, from)
        continue
      }
      add(named(p.item, answer, `Elegido en «${p.text}».`), from)
    }
  }
  take(cls?.startingEquipment.find((e) => e.option === d.equipClass)?.text, 'clase')
  take(bg?.equipment.find((e) => e.option === d.equipBg)?.text, 'trasfondo')
  equipArmor(items, cls, rules, extraProficiencies(d))
  return { items, coins, pending }
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Marca como puesta la mejor armadura y el escudo con los que la clase tiene entrenamiento. */
function equipArmor(items: Item[], cls: ClassData | undefined, rules: Rules, extra: string[]) {
  const ex = extra.map((x) => x.toLowerCase())
  const trained = (a: ArmorData) => !!cls?.armor[a.category] || ex.some((e) => e.includes(a.category))
  let best: { it: Item; ac: number } | undefined
  let shield: Item | undefined
  for (const it of items) {
    if (it.ref?.kind !== 'armadura') continue
    const a = rules.armor(it.ref.id)
    if (!a || !trained(a)) continue
    if (a.category === 'escudo') shield ??= it
    else if (!best || a.baseAC > best.ac) best = { it, ac: a.baseAC }
  }
  if (best) best.it.equipped = true
  if (shield) shield.equipped = true
}

/** Lo que conviene escribir en cada parte «a tu elección» con lo que ya se ha elegido (instrumento, juego...). */
export function suggestPending(d: Draft, text: string): string | undefined {
  const t = norm(text)
  if (/instrumento|artesano|herramientas/.test(t) && d.classTools?.length) return d.classTools[0]
  if (/juego/.test(t) && d.bgTool) return d.bgTool
  return undefined
}

/** Parte «el mismo que…» ya decidida por otra elección (el juego del soldado sale de su competencia). */
function sameAsChosen(d: Draft, text: string): string | undefined {
  return /\bmism[oa]s?\s+que\b/i.test(text) ? suggestPending(d, text) : undefined
}

/**
 * Texto de una opción de equipo para enseñarlo. «Juego (el mismo que arriba)» remite a una
 * línea del libro que aquí no se ve: se dice con palabras llanas y, si ya lo eligió, con lo elegido.
 */
export function gearText(text: string, d: Draft): string {
  return text.replace(/(\p{L}+) \(el mismo que arriba\)/giu, (whole, noun: string) => {
    const same = sameAsChosen(d, whole)
    return same ? `${same.toLowerCase()} (el ${noun.toLowerCase()} con el que tienes competencia)` : `un ${noun} (el mismo con el que tienes competencia)`
  })
}

/* ---------- Construir la ficha ---------- */

export interface BuildOptions {
  parse?: PartsParser
  now?: string
  /** Para que el id no choque con fichas existentes. */
  exists?: (id: string) => boolean
}

function featEntry(id: string, source: string, p: FeatPick | undefined): CharacterFeat {
  const choices = Object.fromEntries(Object.entries(p?.choices ?? {}).filter(([, v]) => v.length))
  return Object.keys(choices).length ? { id, source, choices } : { id, source }
}

export function buildCharacter(d: Draft, rules: Rules, opts: BuildOptions = {}): Character {
  const { cls, bg, species } = ctx(d, rules)
  const now = opts.now ?? new Date().toISOString()
  const name = d.name.trim() || 'Sin nombre'

  // Dotes
  const feats: CharacterFeat[] = []
  if (bg) feats.push(featEntry(bg.feat.id, 'trasfondo', d.bgFeat?.id === bg.feat.id ? d.bgFeat : undefined))
  const featCh = speciesFeatChoice(species)
  const speciesChoices = { ...d.speciesChoices }
  if (featCh && d.speciesFeat && species) {
    feats.push(featEntry(d.speciesFeat.id, species.id, d.speciesFeat))
    speciesChoices[featCh.id] = d.speciesFeat.id
  }

  // Competencias
  const skills = draftSkills(d, rules)
  const expertise = uniq(
    classFeatureChoices(cls)
      .filter((x) => x.choice.kind === 'pericia')
      .flatMap((x) => d.classChoices[x.choice.id] ?? []),
  ).filter(isSkill)
  const tools: string[] = []
  const btr = toolRule(bg?.tool)
  if (btr?.fixed) tools.push(btr.fixed)
  else if (d.bgTool) tools.push(d.bgTool)
  const ctr = toolRule(cls?.toolText)
  if (ctr?.fixed) tools.push(ctr.fixed)
  else tools.push(...(d.classTools ?? []))
  for (const p of [d.bgFeat, d.speciesFeat]) if (p?.id === FEAT_SKILLED) for (const id of p.choices.competencias ?? []) if (!isSkill(id)) tools.push(toolName(id))

  // Idiomas: común, los de los rasgos y los elegidos. Los que pide un rasgo (pícaro) son los últimos elegidos.
  const chosenLangs = d.languages ?? []
  const languages = uniq([...fixedLanguages(d, rules), ...chosenLangs])
  const choices: Record<string, string[]> = {}
  for (const { choice } of classFeatureChoices(cls)) if (d.classChoices[choice.id]?.length) choices[choice.id] = d.classChoices[choice.id]
  let fromEnd = chosenLangs.length
  for (const f of (cls?.features ?? []).filter((x) => x.level === 1 && x.choice?.kind === 'idioma')) {
    const n = f.choice!.count
    const picked = chosenLangs.slice(Math.max(0, fromEnd - n), fromEnd)
    fromEnd -= n
    if (picked.length) choices[f.choice!.id] = picked
  }

  // Conjuros de otras fuentes
  const extra: ExtraSpell[] = [...speciesSpells(d, rules)]
  const castAbility = cls?.spellcasting?.ability
  for (const s of CLASS_ALWAYS[cls?.id ?? ''] ?? []) extra.push({ ...s, ability: castAbility })
  const order = orderCantripList(d)
  for (const id of d.orderCantrip ?? []) extra.push({ id, source: `clase:${order?.label ?? 'Orden'}`, ability: castAbility })
  for (const p of [d.bgFeat, d.speciesFeat]) {
    if (p?.id !== FEAT_INITIATE) continue
    const ability = p.choices.aptitud?.[0] as Ability | undefined
    for (const id of p.choices.trucos ?? []) extra.push({ id, source: `dote:${FEAT_INITIATE}`, ability })
    for (const id of p.choices.conjuro ?? []) extra.push({ id, source: `dote:${FEAT_INITIATE}`, ability, freeCast: 'largo' })
  }

  // Equipo
  const gear = draftGear(d, rules, opts.parse)

  const persona: Character['persona'] = {}
  if (d.appearance.trim()) persona.appearance = d.appearance.trim()
  if (d.personality.trim()) persona.personality = d.personality.trim()

  const look: Look = { palette: makePalette(d.color) }
  if (d.portrait) look.portrait = d.portrait

  const guide: Character['guide'] = []
  if (cls?.summary) guide.push({ id: 'como-se-juega', title: `Cómo se juega ${name}`, body: `${cls.summary}\n\n${CLASS_FOR_WHOM[cls.id] ?? ''}`.trim() })
  const undecided = gear.pending.filter((p) => !(d.pendingNotes[p.text] ?? '').trim())
  if (undecided.length) guide.push({ id: 'por-decidir', title: 'Por decidir', body: undecided.map((p) => `• **Equipo:** ${p.text} (decídelo con la DM).`).join('\n') })

  const c: Character = {
    schema: CHARACTER_SCHEMA,
    id: uniqueId(name, opts.exists ?? (() => false)),
    name,
    ...(d.player.trim() ? { player: d.player.trim() } : {}),
    ...(d.tagline.trim() ? { tagline: d.tagline.trim() } : {}),
    createdAt: now,
    updatedAt: now,
    speciesId: d.speciesId ?? '',
    speciesChoices,
    backgroundId: d.backgroundId ?? '',
    baseScores: d.base ?? classArray(cls),
    backgroundBonus: d.bonus ?? {},
    classId: d.classId ?? '',
    level: 1,
    hpRolls: [],
    skills,
    expertise,
    tools: uniq(tools),
    languages,
    ...(extraProficiencies(d).length ? { extraProficiencies: extraProficiencies(d) } : {}),
    choices,
    feats,
    weaponMasteries: d.masteries ?? [],
    spells: { cantrips: d.cantrips ?? [], prepared: d.prepared ?? [], extra },
    equipment: gear.items,
    coins: gear.coins,
    customFeatures: [],
    overrides: {},
    persona,
    look,
    guide,
    notes: [],
    state: {
      hp: 0,
      tempHp: 0,
      hitDiceUsed: 0,
      slotsUsed: [],
      pactSlotsUsed: 0,
      resourcesUsed: {},
      conditions: [],
      exhaustion: 0,
      deathSaves: { success: 0, fail: 0 },
      // Humano (Ingenioso): empieza con inspiración heroica, como tras un descanso largo.
      heroicInspiration: d.speciesId === 'humano',
      toggles: {},
    },
    history: [],
  }
  c.state.hp = derive(c, rules).maxHp
  return c
}

/** Puntuación final y modificador de cada característica (base + trasfondo). */
export function finalScores(d: Draft): Record<Ability, { score: number; mod: number; base: number; bonus: number }> | undefined {
  if (!d.base) return undefined
  const out = {} as Record<Ability, { score: number; mod: number; base: number; bonus: number }>
  for (const a of ABILITIES) {
    const bonus = d.bonus?.[a] ?? 0
    const score = d.base[a] + bonus
    out[a] = { score, mod: mod(score), base: d.base[a], bonus }
  }
  return out
}
