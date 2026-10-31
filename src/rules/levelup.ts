// Subir de nivel: qué cambia al pasar de nivel N a N+1 (plan) y cómo se
// aplica lo que elige el jugador (apply). El asistente de la interfaz enseña
// el plan paso a paso y al final llama a applyLevelUp. Aquí también está lo
// que pone «Elegir por mí» en cada paso y lo que falta para poder seguir.

import type { Ability, ChoiceDef, ChoiceOption, ClassData, Feature, SkillId, SpellData, SubclassData } from '../data/types'
import { ABILITIES } from '../data/types'
import type { Character, CharacterFeat, CustomFeature } from '../model/character'
import type { Rules } from './book'
import { FEAT, SKILLS } from './constants'
import {
  CANTRIPS,
  CLASS_SKILLS,
  PREPARED,
  STANDARD_LANGUAGES,
  masteryWeapons,
  optionAllowed,
  optionRepeatable,
  recommendedCastingAbility,
  recommendedMasteries,
  speciesSpellsAt,
} from './create'
import { atLevel, derive, proficiencyBonus, type Origin } from './derive'

type ExtraSpell = Character['spells']['extra'][number]

export interface PlannedChoice {
  origin: Origin
  feature: Feature
  choice: ChoiceDef
}

export interface LevelUpPlan {
  from: number
  to: number
  cls: ClassData
  hitDie: number
  hpAverage: number
  pbBefore: number
  pbAfter: number
  classFeatures: Feature[]
  needsSubclass: boolean
  subclassOptions: SubclassData[]
  subclass?: SubclassData
  subclassFeatures: Feature[]
  speciesTraits: Feature[]
  choices: PlannedChoice[]
  spells?: {
    cantripsBefore: number
    cantripsAfter: number
    preparedBefore: number
    preparedAfter: number
    maxLevelBefore: number
    maxLevelAfter: number
    slotsBefore: number[]
    slotsAfter: number[]
  }
  /** Conjuros de especie que llegan a este nivel (linaje élfico o legado infernal a los niveles 3 y 5). */
  speciesSpells: ExtraSpell[]
  masteriesBefore: number
  masteriesAfter: number
}

export interface LevelUpInput {
  /** null = media fija. */
  hpRoll: number | null
  subclassId?: string
  choices: Record<string, string[]>
  /** Dotes ganadas en este nivel (Mejora de característica, dote general, don épico). */
  feats: CharacterFeat[]
  addSkills: SkillId[]
  addExpertise: SkillId[]
  cantrips: string[]
  prepared: string[]
  masteries: string[]
  /** Conjuros que dan las elecciones (Guerrero druídico, Arcanum místico...). */
  extraSpells?: ExtraSpell[]
  /** Fuentes de spells.extra que esas elecciones sustituyen. */
  dropExtra?: string[]
  /** Idiomas nuevos (Explorador hábil). */
  languages?: string[]
  /** Rasgos copiados del libro de una subclase de la mesa para este nivel. */
  customFeatures?: CustomFeature[]
}

/** Lo elegido en una elección de rasgo (subida de nivel o pestaña Rasgos). */
export interface ChoiceValue {
  ids: string[]
  feat?: CharacterFeat
  expertise?: SkillId[]
  skills?: SkillId[]
  /** Conjuros que la elección pone en la ficha (trucos de Guerrero druídico, Arcanum místico...). */
  extra?: ExtraSpell[]
  /** Fuentes de spells.extra que esta elección sustituye (las suyas de antes). */
  extraSources?: string[]
  /** Idiomas que se aprenden con el rasgo (Explorador hábil). */
  languages?: string[]
}

/** Decisiones que el asistente pide en su propio paso (no en "elecciones"). */
const HANDLED_ELSEWHERE = new Set(['subclase', 'truco', 'maestria-armas'])

const uniq = <T>(xs: T[]) => [...new Set(xs)]
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/** Clave con la que se guardan los idiomas de un rasgo que también da idiomas. */
export const languagesKey = (choiceId: string) => `${choiceId}-idiomas`

export function planLevelUp(c: Character, rules: Rules, subclassId?: string): LevelUpPlan | undefined {
  const cls = rules.cls(c.classId)
  if (!cls || c.level >= 20) return undefined
  const from = c.level
  const to = from + 1
  const subId = subclassId ?? c.subclassId
  const subclass = rules.subclass(subId)
  const needsSubclass = to === cls.subclassLevel && !c.subclassId

  const classFeatures = cls.features.filter((f) => f.level === to)
  const subclassFeatures = (subclass?.features ?? []).filter((f) => f.level === to || (needsSubclass && f.level <= to))
  const speciesTraits = (rules.speciesOf(c.speciesId)?.traits ?? []).filter((f) => f.level === to)

  const choices: PlannedChoice[] = []
  for (const f of classFeatures) if (f.choice && !HANDLED_ELSEWHERE.has(f.choice.kind)) choices.push({ origin: 'clase', feature: f, choice: f.choice })
  for (const f of subclassFeatures) if (f.choice && !HANDLED_ELSEWHERE.has(f.choice.kind)) choices.push({ origin: 'subclase', feature: f, choice: f.choice })

  const sc = cls.spellcasting
  let spells: LevelUpPlan['spells']
  if (sc) {
    const slotsFor = (lvl: number) => {
      if (sc.progression === 'pacto') {
        const n = atLevel(rules.book.slots.pacto.slots, lvl) ?? 0
        const l = atLevel(rules.book.slots.pacto.slotLevel, lvl) ?? 1
        return Array.from({ length: l }, (_, i) => (i === l - 1 ? n : 0))
      }
      const row = [...(rules.book.slots[sc.progression][lvl - 1] ?? [])]
      while (row.length && row[row.length - 1] === 0) row.pop()
      return row
    }
    const slotsBefore = slotsFor(from)
    const slotsAfter = slotsFor(to)
    spells = {
      cantripsBefore: atLevel(sc.cantrips, from) ?? 0,
      cantripsAfter: atLevel(sc.cantrips, to) ?? 0,
      preparedBefore: atLevel(sc.prepared, from) ?? 0,
      preparedAfter: atLevel(sc.prepared, to) ?? 0,
      maxLevelBefore: slotsBefore.length,
      maxLevelAfter: slotsAfter.length,
      slotsBefore,
      slotsAfter,
    }
  }

  return {
    from,
    to,
    cls,
    hitDie: cls.hitDie,
    hpAverage: cls.hitDie / 2 + 1,
    pbBefore: proficiencyBonus(from),
    pbAfter: proficiencyBonus(to),
    classFeatures,
    needsSubclass,
    subclassOptions: rules.subclassesOf(cls.id),
    subclass,
    subclassFeatures,
    speciesTraits,
    choices,
    spells,
    speciesSpells: missingSpeciesSpells(c, rules, to),
    masteriesBefore: atLevel(cls.weaponMastery, from) ?? 0,
    masteriesAfter: atLevel(cls.weaponMastery, to) ?? 0,
  }
}

export function emptyInput(c: Character): LevelUpInput {
  return {
    hpRoll: null,
    choices: {},
    feats: [],
    addSkills: [],
    addExpertise: [],
    cantrips: [...c.spells.cantrips],
    prepared: [...c.spells.prepared],
    masteries: [...c.weaponMasteries],
    extraSpells: [],
    dropExtra: [],
    languages: [],
  }
}

/**
 * Conjuros de especie de los niveles 2+ que el personaje debería tener a `level`
 * y no tiene (los de nivel 3 y 5 del linaje). El truco del nivel 1 no se toca:
 * el alto elfo puede haberlo cambiado por otro.
 */
function missingSpeciesSpells(c: Character, rules: Rules, level: number): ExtraSpell[] {
  const own = c.spells.extra.find((e) => e.source.startsWith('especie:') && e.ability)
  const ability = own?.ability ?? recommendedCastingAbility(rules.cls(c.classId))
  const atOne = new Set(speciesSpellsAt(rules, c.speciesId, c.speciesChoices, 1, ability).map((s) => `${s.source}:${s.id}`))
  return speciesSpellsAt(rules, c.speciesId, c.speciesChoices, level, ability).filter(
    (s) => !atOne.has(`${s.source}:${s.id}`) && !c.spells.extra.some((e) => e.id === s.id && e.source === s.source),
  )
}

/** Dado de golpe escrito a mano: entero entre 1 y las caras del dado. */
export function clampHpRoll(roll: number | null, hitDie: number): number | null {
  if (roll === null || !Number.isFinite(roll)) return null
  return Math.min(hitDie, Math.max(1, Math.round(roll)))
}

/** Personaje tal y como quedaría (sin historial): sirve para la vista previa. A nivel 20 no cambia nada. */
export function previewLevelUp(c: Character, rules: Rules, input: LevelUpInput): Character {
  if (c.level >= 20) return c
  const to = c.level + 1
  const hitDie = rules.cls(c.classId)?.hitDie ?? 12
  const hpRolls = [...c.hpRolls]
  hpRolls[to - 2] = clampHpRoll(input.hpRoll, hitDie)
  const drop = new Set(input.dropExtra ?? [])
  const extra = [...c.spells.extra.filter((e) => !drop.has(e.source)), ...(input.extraSpells ?? []), ...missingSpeciesSpells(c, rules, to)]
  const next: Character = {
    ...c,
    level: to,
    subclassId: input.subclassId ?? c.subclassId,
    hpRolls,
    choices: { ...c.choices, ...input.choices },
    feats: [...c.feats, ...input.feats],
    skills: uniq([...c.skills, ...input.addSkills]),
    expertise: uniq([...c.expertise, ...input.addExpertise]),
    languages: uniq([...c.languages, ...(input.languages ?? [])]),
    customFeatures: [...c.customFeatures, ...(input.customFeatures ?? [])],
    spells: { ...c.spells, cantrips: input.cantrips, prepared: input.prepared, extra },
    weaponMasteries: input.masteries,
    updatedAt: new Date().toISOString(),
  }
  // Los PG actuales suben lo mismo que los máximos.
  const before = derive(c, rules).maxHp
  const after = derive(next, rules).maxHp
  next.state = { ...c.state, hp: Math.max(0, c.state.hp + (after - before)) }
  return next
}

/** Copia para el historial: sin el retrato, que puede pesar decenas de KB y llenaría el almacenamiento. */
function withoutLook<T extends { look?: unknown }>(x: T): Omit<T, 'look'> {
  const { look: _look, ...rest } = x
  return rest
}
const lightHistory = (h: Character['history']) => h.map((r) => (r.snapshot.look ? { ...r, snapshot: withoutLook(r.snapshot) } : r))

export function applyLevelUp(c: Character, rules: Rules, input: LevelUpInput, summary: string[]): Character {
  // A nivel 20 no se sube más.
  if (c.level >= 20) return c
  const next = previewLevelUp(c, rules, input)
  const { history, ...rest } = c
  const snapshot = withoutLook(rest)
  return {
    ...next,
    history: [...lightHistory(history), { date: new Date().toISOString(), fromLevel: c.level, toLevel: next.level, snapshot, summary }],
  }
}

/**
 * Deshace la última subida de nivel: vuelve lo que cambió al subir (nivel,
 * elecciones, dotes, conjuros, PG máximos...) y se conserva todo lo que se ha
 * hecho después (retrato, guía, notas, equipo, dinero, ajustes, rasgos de la
 * mesa y la partida). Los PG actuales no pasan del máximo de antes; con `rules`
 * se calcula ese máximo exacto, sin ellas no pasan de los que tenía al subir.
 */
export function undoLevelUp(c: Character, rules?: Rules): Character | undefined {
  const last = c.history[c.history.length - 1]
  if (!last) return undefined
  const snap = last.snapshot
  // Los rasgos de la mesa del nivel que se deshace (y los de más nivel que no estaban antes), fuera.
  const customFeatures = c.customFeatures.filter((f) => !(f.level && f.level > last.fromLevel && (f.level <= last.toLevel || !snap.customFeatures.some((x) => x.id === f.id))))
  const restored: Character = {
    ...snap,
    name: c.name,
    ...(c.player !== undefined ? { player: c.player } : {}),
    ...(c.tagline !== undefined ? { tagline: c.tagline } : {}),
    notes: c.notes,
    equipment: c.equipment,
    coins: c.coins,
    persona: c.persona,
    guide: c.guide,
    customFeatures,
    overrides: c.overrides,
    ...(c.look ? { look: c.look } : {}),
    state: c.state,
    history: lightHistory(c.history.slice(0, -1)),
    updatedAt: new Date().toISOString(),
  }
  if (!c.tagline) delete restored.tagline
  if (!c.player) delete restored.player
  if (!c.look) delete restored.look
  const maxHp = rules ? derive(restored, rules).maxHp : Math.max(snap.state.hp, 0)
  restored.state = {
    ...c.state,
    hp: Math.max(0, Math.min(c.state.hp, maxHp)),
    hitDiceUsed: Math.min(c.state.hitDiceUsed, snap.level),
  }
  return restored
}

/* ---------- Opciones de una elección ---------- */

/** «brujo-invocaciones-sobrenaturales-n5» -> «brujo-invocaciones-sobrenaturales». */
const baseId = (id: string) => id.replace(/-n\d+$/, '')

/** El mismo rasgo en otros niveles (Invocaciones de nivel 1, 2, 5...; Forma salvaje 2, 4, 8). */
function siblingChoices(c: Character, rules: Rules, choice: ChoiceDef, subclassId?: string): ChoiceDef[] {
  const feats = [...(rules.cls(c.classId)?.features ?? []), ...(rules.subclass(subclassId ?? c.subclassId)?.features ?? [])]
  return feats.filter((f) => f.choice && f.choice.id !== choice.id && f.choice.kind === choice.kind && baseId(f.choice.id) === baseId(choice.id)).map((f) => f.choice!)
}

/**
 * Opciones que se pueden elegir al llegar a `level`: las de la elección (o las
 * del mismo rasgo en otro nivel, si no trae), sin las ya elegidas en ese rasgo
 * (salvo las repetibles) y solo las que cumplen sus requisitos. `current` es lo
 * que ya va marcado en esta elección: sigue saliendo y cuenta como requisito.
 */
export function choiceOptions(c: Character, rules: Rules, choice: ChoiceDef, level: number, current: string[] = [], subclassId?: string): ChoiceOption[] {
  const sibs = siblingChoices(c, rules, choice, subclassId)
  const own = choice.options?.length ? choice.options : (sibs.find((s) => s.options?.length)?.options ?? [])
  const taken = sibs.flatMap((s) => c.choices[s.id] ?? [])
  const ctx = { taken: [...taken, ...current], cantrips: c.spells.cantrips, rules }
  return own.filter((o) => current.includes(o.id) || ((optionRepeatable(o) || !taken.includes(o.id)) && optionAllowed(o, level, ctx)))
}

/** Conjuros que se pueden elegir en una elección de tipo 'conjuro'. `maxSlot`: nivel de espacio más alto. */
export function spellChoicePool(rules: Rules, choice: ChoiceDef, maxSlot: number): SpellData[] {
  const cfg = choice.spells
  if (!cfg) return []
  const ids = new Set(cfg.lists.flatMap((l) => rules.cls(l)?.spellList ?? []))
  const levels = cfg.upToSlots ? Array.from({ length: maxSlot + 1 }, (_, i) => i) : (cfg.levels ?? [])
  return rules.book.spells
    .filter((s) => ids.has(s.id) && levels.includes(s.level) && (!cfg.school || s.school === cfg.school) && (!cfg.castingTime || s.castingTime === cfg.castingTime))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'es'))
}

/** Fuente con la que se apuntan en spells.extra los conjuros de una elección. */
export function choiceSpellSource(origin: Origin, feature: Feature, choice: ChoiceDef, option?: ChoiceOption): string {
  if (option) return `${origin}:${option.name}`
  const lvl = choice.spells?.levels
  return /-n\d+$/.test(feature.id) && lvl?.length === 1 ? `${origin}:${feature.name} (nivel ${lvl[0]})` : `${origin}:${feature.name}`
}

/** Valor de una elección de conjuros: los ids y, si van a la ficha, sus entradas de spells.extra. */
export function spellChoiceValue(c: Character, rules: Rules, origin: Origin, feature: Feature, choice: ChoiceDef, ids: string[]): ChoiceValue {
  if (!choice.spells?.toSheet) return { ids }
  const source = choiceSpellSource(origin, feature, choice)
  const ability = rules.cls(c.classId)?.spellcasting?.ability
  return { ids, extra: ids.map((id) => ({ id, source, ...(ability ? { ability } : {}) })), extraSources: [source] }
}

/** Valor de un estilo de combate: la dote o la alternativa (Guerrero druídico) con sus trucos. */
export function styleChoiceValue(origin: Origin, feature: Feature, choice: ChoiceDef, id: string, cantrips: string[] = []): ChoiceValue {
  const sources = (choice.options ?? []).map((o) => choiceSpellSource(origin, feature, choice, o))
  const alt = choice.options?.find((o) => o.id === id && o.cantrips)
  if (!alt) return { ids: [id], extra: [], extraSources: sources }
  const source = choiceSpellSource(origin, feature, choice, alt)
  return { ids: [id], extra: cantrips.map((x) => ({ id: x, source, ability: alt.cantrips!.ability })), extraSources: sources }
}

/* ---------- Lo que falta ---------- */

/** Qué falta para completar una elección («Te faltan 2 formas de bestia»). Vacío = lista. */
export function choiceMissing(choice: ChoiceDef, v: ChoiceValue | undefined, rules?: Rules): string | undefined {
  const ids = v?.ids ?? []
  if (choice.kind === 'dote' || choice.kind === 'don-epico') {
    const feat = v?.feat
    if (!feat) return choice.kind === 'don-epico' ? 'Elige un don épico o Mejora de característica.' : 'Elige Mejora de característica u otra dote.'
    const total = Object.values(feat.abilityIncrease ?? {}).reduce((a, b) => a + (b ?? 0), 0)
    if (feat.id === FEAT.mejoraCaracteristica) {
      if (total < 2) return `Te ${plural(2 - total, 'falta', 'faltan')} ${2 - total} ${plural(2 - total, 'punto', 'puntos')} de Mejora de característica por repartir.`
      return undefined
    }
    const data = rules?.feat(feat.id)
    const amount = data?.abilityIncrease?.amount ?? 0
    if (data?.abilityIncrease && total < amount) return `Elige a qué característica va el +${amount} de ${data.name}.`
    return undefined
  }
  const left = choice.count - ids.length
  if (choice.kind === 'estilo-combate') {
    if (left > 0) return 'Elige un estilo de combate.'
    const alt = choice.options?.find((o) => ids.includes(o.id) && o.cantrips)
    const n = alt ? alt.cantrips!.count - (v?.extra ?? []).length : 0
    if (alt && n > 0) return `Te ${plural(n, 'falta', 'faltan')} ${n} ${plural(n, 'truco', 'trucos')} de ${alt.name}.`
    return undefined
  }
  if (left > 0) {
    if (choice.kind === 'pericia') return `Te ${plural(left, 'falta', 'faltan')} ${left} ${plural(left, 'habilidad', 'habilidades')} para la pericia.`
    if (choice.kind === 'habilidad') return `Te ${plural(left, 'falta', 'faltan')} ${left} ${plural(left, 'habilidad', 'habilidades')}.`
    if (choice.kind === 'conjuro') return `Te ${plural(left, 'falta', 'faltan')} ${left} ${plural(left, 'conjuro', 'conjuros')}.`
    if (choice.kind === 'invocacion') return `Te ${plural(left, 'falta', 'faltan')} ${left} ${plural(left, 'invocación', 'invocaciones')}.`
    if (choice.kind === 'metamagia') return `Te ${plural(left, 'falta', 'faltan')} ${left} ${plural(left, 'opción', 'opciones')} de metamagia.`
    if (choice.kind === 'idioma') return `Te ${plural(left, 'falta', 'faltan')} ${left} ${plural(left, 'idioma', 'idiomas')}.`
    return `Te ${plural(left, 'falta', 'faltan')} ${left} por elegir.`
  }
  if (choice.spells?.onePerLevel && rules && choice.spells.levels) {
    for (const l of choice.spells.levels) if (!ids.some((id) => rules.spell(id)?.level === l)) return `Elige un conjuro de nivel ${l}.`
  }
  const langs = (choice.languages ?? 0) - (v?.languages ?? []).length
  if (langs > 0) return `Te ${plural(langs, 'falta', 'faltan')} ${langs} ${plural(langs, 'idioma', 'idiomas')}.`
  return undefined
}

export const choiceReady = (choice: ChoiceDef, v: ChoiceValue | undefined, rules?: Rules) => !choiceMissing(choice, v, rules)

/** Aplica una elección ya hecha a la ficha (desde la pestaña Rasgos). */
export function applyChoiceValue(c: Character, choice: ChoiceDef, v: ChoiceValue): Character {
  const next: Character = { ...c, choices: { ...c.choices, [choice.id]: v.ids } }
  if (v.feat) next.feats = [...c.feats.filter((f) => f.source !== v.feat!.source), v.feat]
  if (v.expertise) next.expertise = uniq([...c.expertise, ...v.expertise])
  if (v.skills) next.skills = uniq([...c.skills, ...v.skills])
  if (v.extra || v.extraSources) {
    const drop = new Set(v.extraSources ?? [])
    next.spells = { ...c.spells, extra: [...c.spells.extra.filter((e) => !drop.has(e.source)), ...(v.extra ?? [])] }
  }
  if (v.languages) {
    const key = languagesKey(choice.id)
    const old = new Set(c.choices[key] ?? [])
    next.languages = uniq([...c.languages.filter((l) => !old.has(l)), ...v.languages])
    next.choices[key] = v.languages
  }
  return next
}

/* ---------- «Elegir por mí» ---------- */

/** Conjuros que suelen funcionar bien, de más a menos, por nivel (se filtran con la lista de la clase). */
const GOOD_SPELLS: string[][] = [
  ['guia', 'llama-sagrada', 'descarga-sobrenatural', 'descarga-de-fuego', 'rayo-de-escarcha', 'luz', 'mano-de-mago', 'prestidigitacion', 'mensaje', 'voluta-estelar', 'crear-llama', 'burla-danina', 'resistencia', 'taumaturgia'],
  ['palabra-de-curacion', 'curar-heridas', 'escudo', 'proyectil-magico', 'bendicion', 'dormir', 'hechizar-persona', 'armadura-de-mago', 'saeta-guia', 'enmaranar', 'maleficio', 'detectar-magia', 'escudo-de-fe', 'heroismo', 'favor-divino'],
  ['paso-brumoso', 'arma-espiritual', 'restablecimiento-menor', 'inmovilizar-persona', 'rayo-abrasador', 'auxilio', 'contorno-borroso', 'invisibilidad', 'telarana', 'sugestion', 'silencio', 'crecimiento-espinoso', 'rayo-de-luna', 'potenciar-caracteristica', 'plegaria-de-curacion', 'calentar-metal'],
  ['bola-de-fuego', 'espiritus-guardianes', 'contrahechizo', 'revivir', 'disipar-magia', 'volar', 'palabra-de-curacion-en-masa', 'acelerar', 'patron-hipnotico', 'relampago', 'llamar-al-relampago', 'conjurar-animales', 'ralentizar', 'senal-de-esperanza', 'crecimiento-vegetal', 'toque-vampirico'],
  ['polimorfar', 'destierro', 'puerta-dimensional', 'invisibilidad-mejorada', 'guardian-de-la-fe', 'libertad-de-movimiento', 'muro-de-fuego', 'tormenta-de-hielo', 'piel-petrea', 'aura-de-vida', 'guarda-contra-la-muerte', 'confusion'],
  ['muro-de-fuerza', 'inmovilizar-monstruo', 'curar-heridas-en-masa', 'cono-de-frio', 'golpe-flamigero', 'restablecimiento-mayor', 'alzar-a-los-muertos', 'plaga-de-insectos', 'animar-objetos', 'telequinesis', 'muro-de-piedra', 'conjurar-elemental'],
  ['curar', 'desintegrar', 'relampago-en-cadena', 'barrera-de-cuchillas', 'globo-de-invulnerabilidad', 'sugestion-en-masa', 'rayo-solar', 'esfera-congelante', 'festin-de-heroes', 'vision-veraz', 'muro-de-hielo', 'circulo-de-muerte'],
  ['teletransporte', 'regenerar', 'resurreccion', 'rociada-prismatica', 'tormenta-de-fuego', 'dedo-de-la-muerte', 'bola-de-fuego-de-explosion-retardada', 'invertir-la-gravedad', 'jaula-de-fuerza', 'palabra-divina'],
  ['palabra-de-poder-aturdir', 'dominar-monstruo', 'explosion-solar', 'terremoto', 'aura-sagrada', 'mente-en-blanco', 'campo-antimagia', 'laberinto'],
  ['deseo', 'palabra-de-poder-matar', 'curar-en-masa', 'parar-el-tiempo', 'tormenta-de-meteoritos', 'presciencia', 'resurreccion-verdadera', 'polimorfar-verdadero', 'tormenta-de-la-venganza', 'portal'],
]
const spellRank = (s: SpellData, classId: string) => {
  const own = s.level === 0 ? (CANTRIPS[classId] ?? []) : s.level === 1 ? (PREPARED[classId] ?? []) : []
  const i = own.indexOf(s.id)
  if (i >= 0) return i
  const j = (GOOD_SPELLS[s.level] ?? []).indexOf(s.id)
  return j >= 0 ? 100 + j : 1000
}
const bySpellRank = (classId: string) => (a: SpellData, b: SpellData) => spellRank(a, classId) - spellRank(b, classId) || a.name.localeCompare(b.name, 'es')

/**
 * Elige `n` conjuros de `pool` repartidos por niveles: primero uno del nivel más
 * alto, luego del siguiente, y así en rueda; en cada nivel, los más útiles.
 */
function pickSpread(pool: SpellData[], n: number, classId: string): string[] {
  const levels = [...new Set(pool.map((s) => s.level))].sort((a, b) => b - a)
  const queues = levels.map((l) => pool.filter((s) => s.level === l).sort(bySpellRank(classId)))
  const out: string[] = []
  while (out.length < n && queues.some((q) => q.length)) for (const q of queues) if (q.length && out.length < n) out.push(q.shift()!.id)
  return out
}

/** Trucos y preparados recomendados: conserva lo que ya tiene y completa hasta el máximo del nivel nuevo. */
export function recommendSpells(c: Character, rules: Rules, plan: LevelUpPlan, input: LevelUpInput, alwaysPrepared: string[] = []): { cantrips: string[]; prepared: string[] } {
  const sp = plan.spells
  if (!sp) return { cantrips: input.cantrips, prepared: input.prepared }
  const list = new Set(plan.cls.spellList ?? [])
  const pool = rules.book.spells.filter((s) => list.has(s.id))
  const known = new Set([...c.spells.extra.map((e) => e.id), ...(input.extraSpells ?? []).map((e) => e.id)])
  const cantrips = input.cantrips.slice(0, sp.cantripsAfter)
  const freeC = pool.filter((s) => s.level === 0 && !cantrips.includes(s.id) && !known.has(s.id)).sort(bySpellRank(plan.cls.id))
  cantrips.push(...freeC.slice(0, Math.max(0, sp.cantripsAfter - cantrips.length)).map((s) => s.id))
  const always = new Set(alwaysPrepared)
  const own = input.prepared.filter((id) => !always.has(id))
  const kept = own.slice(0, sp.preparedAfter)
  const freeP = pool.filter((s) => s.level >= 1 && s.level <= sp.maxLevelAfter && !kept.includes(s.id) && !always.has(s.id) && !known.has(s.id))
  const prepared = [...input.prepared.filter((id) => always.has(id)), ...kept, ...pickSpread(freeP, sp.preparedAfter - kept.length, plan.cls.id)]
  return { cantrips, prepared }
}

/** Armas recomendadas para Maestría con armas: las que ya tiene elegidas, las que lleva y las del equipo inicial. */
export function recommendMasteries(c: Character, rules: Rules, n: number): string[] {
  const cls = rules.cls(c.classId)
  const allowed = new Set(masteryWeapons(cls, rules).map((w) => w.id))
  const carried = c.equipment.filter((i) => i.ref?.kind === 'arma').map((i) => i.ref!.id)
  // Si aún faltan, las de más daño que puede usar.
  const avg = (d: string) => Number(d.match(/d+d(d+)/)?.[1] ?? 0)
  const rest = masteryWeapons(cls, rules).sort((a, b) => avg(b.damage) - avg(a.damage)).map((w) => w.id)
  return uniq([...c.weaponMasteries, ...carried, ...recommendedMasteries(cls, rules), ...rest].filter((id) => allowed.has(id))).slice(0, n)
}

/** Características de la más importante a la menos: las principales de la clase y luego las más altas. */
function abilityOrder(c: Character, rules: Rules, scores: Record<Ability, number>): Ability[] {
  const primary = rules.cls(c.classId)?.primaryAbilities ?? []
  const p = [...primary].sort((a, b) => scores[b] - scores[a])
  const rest = ABILITIES.filter((a) => !p.includes(a)).sort((a, b) => (a === 'con' ? -1 : b === 'con' ? 1 : 0) || scores[b] - scores[a])
  return [...p, ...rest]
}

/** La característica a la que conviene el +N de una dote: la primera de la clase que aún pueda subir. */
export function recommendFeatAbility(c: Character, rules: Rules, options: Ability[], amount: number, max: number): Ability | undefined {
  const scores = derive(c, rules).scores
  return abilityOrder(c, rules, scores).find((a) => options.includes(a) && scores[a] + amount <= max) ?? options.find((a) => scores[a] < max)
}

/** Dote recomendada: Mejora de característica (+2 a la principal, o +1 y +1 si no cabe) o un don épico. */
export function recommendFeat(c: Character, rules: Rules, choice: ChoiceDef, level: number): CharacterFeat | undefined {
  const source = `nivel-${level}`
  const scores = derive(c, rules).scores
  if (choice.kind === 'don-epico') {
    const id = rules.cls(c.classId)?.spellcasting ? 'don-del-recuerdo-de-conjuros' : 'don-de-la-pericia-en-combate'
    const f = rules.feat(id)
    if (f?.abilityIncrease) {
      const a = recommendFeatAbility(c, rules, f.abilityIncrease.options, f.abilityIncrease.amount, f.abilityIncrease.max)
      return { id, source, abilityIncrease: a ? { [a]: f.abilityIncrease.amount } : {} }
    }
  }
  if (!rules.feat(FEAT.mejoraCaracteristica)) return undefined
  // +2 a la más importante que no esté en 20; si está en 19, +1 a ella y +1 a la siguiente.
  const open = abilityOrder(c, rules, scores).filter((a) => scores[a] < 20)
  const inc: Partial<Record<Ability, number>> = {}
  if (open[0] && scores[open[0]] <= 18) inc[open[0]] = 2
  else for (const a of open.slice(0, 2)) inc[a] = 1
  return { id: FEAT.mejoraCaracteristica, source, abilityIncrease: inc }
}

/** Opciones preferidas cuando el SRD no recomienda nada (por id del rasgo sin el -nN). */
const OPTION_PREFS: Record<string, string[]> = {
  'brujo-invocaciones-sobrenaturales': [
    'descarga-agonica',
    'pacto-del-filo',
    'armadura-de-sombras',
    'vista-del-diablo',
    'mente-sobrenatural',
    'filo-sediento',
    'descarga-ahuyentadora',
    'castigo-arcano',
    'don-de-las-profundidades',
    'uno-con-las-sombras',
    'devorador-de-vida',
    'vigor-infernal',
    'lanza-sobrenatural',
    'paso-ascendente',
    'hoja-devoradora',
    'vision-bruja',
  ],
  'hechicero-metamagia': ['conjuro-acelerado', 'conjuro-sutil', 'conjuro-gemelo', 'conjuro-cuidadoso', 'conjuro-distante', 'conjuro-extendido'],
  'clerigo-orden-divina': ['protector'],
  'druida-orden-primigenia': ['guardian'],
}

const STYLE_PREFS: Record<string, string[]> = {
  explorador: ['tiro-con-arco', 'defensa'],
  guerrero: ['defensa', 'tiro-con-arco'],
  paladin: ['defensa', 'combate-con-armas-a-dos-manos'],
}

/** Habilidades ordenadas por lo que el personaje suma ya en ellas (y, a igualdad, por las de su clase). */
function skillsByBonus(c: Character, rules: Rules, pool: SkillId[]): SkillId[] {
  const d = derive(c, rules)
  const pref = CLASS_SKILLS[c.classId] ?? []
  const rank = (s: SkillId) => (pref.includes(s) ? pref.indexOf(s) : 50)
  return [...pool].sort((a, b) => d.skills[b].bonus - d.skills[a].bonus || rank(a) - rank(b))
}

/** «Elegir por mí» en una elección de la subida de nivel. */
export function recommendChoice(c: Character, rules: Rules, pc: PlannedChoice, level: number, subclassId?: string): ChoiceValue {
  const { feature, choice, origin } = pc
  const n = choice.count
  switch (choice.kind) {
    case 'dote':
    case 'don-epico': {
      const feat = recommendFeat(c, rules, choice, level)
      return feat ? { ids: [feat.id], feat } : { ids: [] }
    }
    case 'estilo-combate': {
      const have = derive(c, rules).featIds
      const styles = rules.book.feats.filter((f) => f.category === 'estilo-combate').map((f) => f.id)
      const id = [...(STYLE_PREFS[c.classId] ?? []), ...styles].find((x) => styles.includes(x) && !have.has(x))
      return id ? styleChoiceValue(origin, feature, choice, id) : { ids: [] }
    }
    case 'pericia': {
      const pool = (choice.options?.length ? (choice.options.map((o) => o.id) as SkillId[]) : SKILLS.map((s) => s.id)).filter((s) => c.skills.includes(s) && !c.expertise.includes(s))
      const ids = skillsByBonus(c, rules, pool).slice(0, n)
      const v: ChoiceValue = { ids, expertise: ids }
      if (choice.languages) v.languages = STANDARD_LANGUAGES.filter((l) => !c.languages.includes(l)).slice(0, choice.languages)
      return v
    }
    case 'habilidad': {
      const pool = (choice.options?.length ? (choice.options.map((o) => o.id) as SkillId[]) : SKILLS.map((s) => s.id)).filter((s) => !c.skills.includes(s))
      const ids = skillsByBonus(c, rules, pool).slice(0, n)
      return { ids, skills: ids }
    }
    case 'conjuro': {
      const after = previewLevelUp(c, rules, { ...emptyInput(c), subclassId })
      const maxSlot = derive(after, rules).spell?.maxSpellLevel ?? 0
      const have = new Set([...c.spells.cantrips, ...c.spells.prepared, ...c.spells.extra.map((e) => e.id)])
      const pool = spellChoicePool(rules, choice, maxSlot).filter((s) => !have.has(s.id))
      let ids: string[]
      if (choice.spells?.onePerLevel) {
        ids = (choice.spells.levels ?? []).map((l) => pool.filter((s) => s.level === l).sort(bySpellRank(c.classId))[0]?.id).filter((x): x is string => !!x)
      } else ids = pickSpread(pool, n, c.classId)
      return spellChoiceValue(c, rules, origin, feature, choice, ids)
    }
    case 'idioma':
      return { ids: STANDARD_LANGUAGES.filter((l) => !c.languages.includes(l)).slice(0, n) }
    default: {
      // Opciones (Forma salvaje, órdenes...), invocaciones y metamagia, de una en una por los requisitos.
      const pref = [...(choice.suggested ?? []), ...(OPTION_PREFS[baseId(choice.id)] ?? [])]
      const ids: string[] = []
      while (ids.length < n) {
        const opts = choiceOptions(c, rules, choice, level, ids, subclassId).filter((o) => !ids.includes(o.id))
        const next = pref.find((id) => opts.some((o) => o.id === id)) ?? opts[0]?.id
        if (!next) break
        ids.push(next)
      }
      return { ids }
    }
  }
}

/** Opciones de la clase para Guerrero druídico o Guerrero bendito: sus trucos recomendados. */
export function recommendAltCantrips(c: Character, rules: Rules, option: ChoiceOption): string[] {
  const cfg = option.cantrips
  if (!cfg) return []
  const list = new Set(rules.cls(cfg.list)?.spellList ?? [])
  const have = new Set([...c.spells.cantrips, ...c.spells.extra.map((e) => e.id)])
  const pool = rules.book.spells.filter((s) => s.level === 0 && list.has(s.id) && !have.has(s.id))
  return uniq([...(cfg.suggested ?? []).filter((id) => pool.some((s) => s.id === id)), ...pool.sort(bySpellRank(cfg.list)).map((s) => s.id)]).slice(0, cfg.count)
}
