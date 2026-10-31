// Motor de reglas: a partir de las decisiones del personaje calcula todo lo
// que se ve en la ficha. Función pura: mismo personaje + mismas reglas =>
// mismos números.

import type {
  Ability,
  ArmorData,
  BackgroundData,
  ChoiceDef,
  ClassData,
  FeatData,
  Feature,
  Recharge,
  ResourceDef,
  SkillId,
  SpeciesData,
  SubclassData,
  WeaponData,
} from '../data/types'
import { ABILITIES } from '../data/types'
import type { Character, CharacterFeat } from '../model/character'
import type { Rules } from './book'
import { ABILITY_NAMES, ABILITY_SHORT, FEAT, SKILLS, SPECIES, SUBCLASS, signed } from './constants'

export type Origin = 'clase' | 'subclase' | 'especie' | 'trasfondo' | 'dote' | 'mesa'

export interface FeatureView {
  key: string
  origin: Origin
  name: string
  level?: number
  summary?: string
  text: string
  choice?: ChoiceDef
  chosen?: string[]
}

export interface ResourceView {
  key: string // clave en state.resourcesUsed
  name: string
  max: number
  used: number
  recharge: Recharge
  die?: string
  pool: boolean
  origin: Origin
  /** Si son usos gratis de un conjuro de dote o especie («Santuario gratis»): el id del conjuro. */
  spell?: string
}

export interface Attack {
  key: string
  name: string
  itemId?: string
  attack: number
  damage: string
  damageType: string
  /** Daño a dos manos si es Versátil. */
  versatile?: string
  range?: string
  properties: string[]
  mastery?: { id: string; name: string; text?: string }
  notes: string[]
  proficient: boolean
}

export interface Warning {
  kind: 'falta' | 'error' | 'aviso'
  text: string
  tab?: string
  /** id del elemento de esa pestaña donde se arregla; el aviso de la ficha baja hasta él. */
  target?: string
}

export interface SpellInfo {
  ability: Ability
  dc: number
  attack: number
  /** Espacios por nivel de conjuro (índice 0 = nivel 1). */
  slots: number[]
  pact?: { slots: number; level: number }
  cantripsMax: number
  preparedMax: number
  /** Nivel de conjuro más alto que puede lanzar/preparar. */
  maxSpellLevel: number
  alwaysPrepared: string[]
}

export interface Derived {
  level: number
  cls?: ClassData
  sub?: SubclassData
  species?: SpeciesData
  background?: BackgroundData
  scores: Record<Ability, number>
  mods: Record<Ability, number>
  pb: number
  saves: Record<Ability, { bonus: number; proficient: boolean }>
  skills: Record<SkillId, { bonus: number; proficient: boolean; expertise: boolean; half: boolean }>
  passivePerception: number
  initiative: number
  ac: { value: number; parts: string[]; overridden: boolean }
  speed: number
  /**
   * Cansancio: nivel y lo que ya va restado en las cifras. `d20` sale de salvaciones,
   * habilidades, iniciativa y ataques (no de la percepción pasiva ni de las CD);
   * `speed`, en metros, de la velocidad.
   */
  exhaustion: { level: number; d20: number; speed: number }
  maxHp: number
  hitDie: number
  spell?: SpellInfo
  attacks: Attack[]
  resources: ResourceView[]
  features: FeatureView[]
  feats: { entry: CharacterFeat; data?: FeatData }[]
  /** Ids de todas las dotes efectivas (las de `feats` y las elegidas como estilo de combate). */
  featIds: Set<string>
  warnings: Warning[]
}

export const mod = (score: number) => Math.floor((score - 10) / 2)
export const proficiencyBonus = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4)

/** Valor de una columna/array por nivel (índice 0 = nivel 1). */
export function atLevel<T>(values: T[] | undefined, level: number): T | undefined {
  if (!values || values.length === 0) return undefined
  return values[Math.min(values.length, Math.max(1, level)) - 1]
}

/** Rasgos de clase hasta un nivel. */
export function classFeatures(cls: ClassData | undefined, level: number): Feature[] {
  return (cls?.features ?? []).filter((f) => f.level <= level)
}

export function subclassFeatures(sub: SubclassData | undefined, level: number): Feature[] {
  return (sub?.features ?? []).filter((f) => f.level <= level)
}

export function resourceMax(def: ResourceDef, level: number, mods: Record<Ability, number>, pb: number): number {
  const m = def.max
  if ('perLevel' in m) return atLevel(m.perLevel, level) ?? 0
  if ('abilityMod' in m) return Math.max(m.min, mods[m.abilityMod])
  if ('levelTimes' in m) return m.levelTimes * level
  return pb
}

export function rechargeAt(def: ResourceDef, level: number): Recharge {
  let r = def.recharge
  for (const step of def.rechargeFrom ?? []) if (level >= step.level) r = step.recharge
  return r
}

function hasProperty(w: WeaponData, name: string) {
  const n = name.toLowerCase()
  return w.properties.some((p) => p.toLowerCase().startsWith(n))
}

function propertyArg(w: WeaponData, name: string): string | undefined {
  const p = w.properties.find((x) => x.toLowerCase().startsWith(name.toLowerCase()))
  const m = p?.match(/\(([^)]*)\)/)
  return m?.[1]
}

function weaponProficient(c: Character, cls: ClassData | undefined, w: WeaponData) {
  const extra = (c.extraProficiencies ?? []).map((x) => x.toLowerCase())
  if (extra.includes(w.id) || extra.includes(w.name.toLowerCase())) return true
  if (w.category === 'sencilla') return !!cls?.weapons.simple || extra.includes('armas sencillas')
  if (extra.includes('armas marciales')) return true
  // 'ligeras': marciales con la propiedad Ligera (monje); 'sutiles-o-ligeras': con Sutil o Ligera (pícaro)
  const m = cls?.weapons.martial as boolean | 'ligeras' | 'sutiles-o-ligeras' | undefined
  if (m === true) return true
  if (m === 'ligeras') return hasProperty(w, 'ligera')
  if (m === 'sutiles-o-ligeras') return hasProperty(w, 'sutil') || hasProperty(w, 'ligera')
  return false
}

/** Armas de monje: cuerpo a cuerpo sencillas y cuerpo a cuerpo marciales con la propiedad Ligera. */
function monkWeapon(w: WeaponData) {
  return w.kind === 'cuerpo-a-cuerpo' && (w.category === 'sencilla' || hasProperty(w, 'ligera'))
}

/** Daño medio de un dado («1d8» = 4,5; «1» = 1), para quedarse con el mayor. */
function dieAverage(die: string) {
  const m = die.match(/(\d+)d(\d+)/)
  return m ? (Number(m[1]) * (Number(m[2]) + 1)) / 2 : Number(die) || 0
}

/** «1d8 + 3», «1d8 − 1» o «1d8» si no suma nada. */
function withBonus(die: string, b: number) {
  return b === 0 ? die : `${die} ${b > 0 ? '+' : '−'} ${Math.abs(b)}`
}

function armorTrained(c: Character, cls: ClassData | undefined, a: ArmorData) {
  const extra = (c.extraProficiencies ?? []).map((x) => x.toLowerCase())
  const key = a.category === 'escudo' ? 'escudo' : a.category
  if (extra.some((e) => e.includes(key))) return true
  return !!cls?.armor[key]
}

export function derive(c: Character, rules: Rules): Derived {
  const warnings: Warning[] = []
  const level = Math.max(1, Math.min(20, c.level))
  const cls = rules.cls(c.classId)
  const sub = rules.subclass(c.subclassId)
  const species = rules.speciesOf(c.speciesId)
  const background = rules.background(c.backgroundId)
  if (!cls) warnings.push({ kind: 'error', text: `No encuentro la clase "${c.classId}" en las reglas.` })
  if (!species) warnings.push({ kind: 'aviso', text: `La especie "${c.speciesId}" no está en las reglas cargadas.` })
  if (!background) warnings.push({ kind: 'aviso', text: `El trasfondo "${c.backgroundId}" no está en las reglas cargadas.` })

  // Dotes efectivas: las de la lista y las elegidas como estilo de combate / dote en rasgos de clase.
  const feats = c.feats.map((entry) => ({ entry, data: rules.feat(entry.id) }))
  const featIds = new Set(c.feats.map((f) => f.id))
  const allClassFeatures = [...classFeatures(cls, level), ...subclassFeatures(sub, level)]
  for (const f of allClassFeatures) {
    const ch = f.choice
    if (!ch) continue
    if (ch.kind === 'estilo-combate' || ch.kind === 'dote' || ch.kind === 'don-epico' || ch.kind === 'dote-origen') {
      for (const id of c.choices[ch.id] ?? []) featIds.add(id)
    }
  }
  for (const ch of species?.choices ?? []) {
    if (ch.kind === 'dote-origen' && c.speciesChoices[ch.id]) featIds.add(c.speciesChoices[ch.id])
  }

  // Características
  const scores = {} as Record<Ability, number>
  for (const a of ABILITIES) {
    let s = (c.baseScores[a] ?? 10) + (c.backgroundBonus[a] ?? 0)
    for (const f of c.feats) s += f.abilityIncrease?.[a] ?? 0
    scores[a] = s
  }
  for (const a of ABILITIES) {
    const isEpic = c.feats.some((f) => (f.abilityIncrease?.[a] ?? 0) > 0 && rules.feat(f.id)?.category === 'don-epico')
    if (scores[a] > (isEpic ? 30 : 20))
      warnings.push({ kind: 'error', text: `${ABILITY_NAMES[a]} ${scores[a]} supera el máximo de 20.`, tab: 'habilidades', target: 'revisar-caracteristicas' })
  }
  const mods = {} as Record<Ability, number>
  for (const a of ABILITIES) mods[a] = mod(scores[a])
  const pb = proficiencyBonus(level)

  // Cansancio (2024): cada nivel resta 2 a toda prueba con d20 y 1,5 m de velocidad
  const exLevel = Math.max(0, Math.min(6, c.state.exhaustion ?? 0))
  const exhaustion = { level: exLevel, d20: 2 * exLevel, speed: 1.5 * exLevel }

  // Salvaciones
  const saveProfs = new Set<Ability>(cls?.savingThrows ?? [])
  for (const f of c.feats) for (const a of f.choices?.salvacion ?? []) saveProfs.add(a as Ability)
  const saves = {} as Derived['saves']
  for (const a of ABILITIES) {
    const proficient = saveProfs.has(a)
    saves[a] = { proficient, bonus: mods[a] + (proficient ? pb : 0) - exhaustion.d20 }
  }

  // Habilidades
  const jack = c.classId === 'bardo' && level >= 2 // Aprendiz de mucho
  // Taumaturgo (clérigo) y Naturalista (druida): + Sabiduría (mínimo +1) a dos habilidades de Inteligencia
  const order =
    c.classId === 'clerigo' && c.choices['clerigo-orden-divina']?.includes('taumaturgo')
      ? ['arcanos', 'religion']
      : c.classId === 'druida' && c.choices['druida-orden-primigenia']?.includes('naturalista')
        ? ['arcanos', 'naturaleza']
        : []
  const skills = {} as Derived['skills']
  for (const s of SKILLS) {
    const proficient = c.skills.includes(s.id)
    const expertise = proficient && c.expertise.includes(s.id)
    const half = !proficient && jack
    const bonus =
      mods[s.ability] + (expertise ? pb * 2 : proficient ? pb : half ? Math.floor(pb / 2) : 0) + (order.includes(s.id) ? Math.max(1, mods.sab) : 0) - exhaustion.d20
    skills[s.id] = { bonus, proficient, expertise, half }
  }
  for (const s of c.expertise)
    if (!c.skills.includes(s)) warnings.push({ kind: 'error', text: `Tienes pericia en ${s} sin ser competente.`, tab: 'habilidades', target: 'revisar-habilidades' })
  // La pasiva no es una tirada: el cansancio no la baja
  const passivePerception = 10 + skills.percepcion.bonus + exhaustion.d20

  // Iniciativa (el ajuste de la DM es la cifra normal; el cansancio se resta encima)
  let initiative = mods.des + (featIds.has(FEAT.alerta) ? pb : 0)
  if (c.overrides.initiative !== undefined) initiative = c.overrides.initiative
  initiative -= exhaustion.d20

  // Clase de Armadura
  const ac = armorClass(c, rules, cls, sub, level, mods, featIds, warnings)

  // Velocidad
  let speed = species?.speed ?? 9
  if (c.speciesChoices['elfo-linaje-elfico'] === 'elfo-de-los-bosques') speed = 10.5
  const worn = equippedArmor(c, rules)
  if (worn?.category === 'pesada' && worn.strength && scores.fue < worn.strength) {
    speed -= 3
    warnings.push({ kind: 'aviso', text: `${worn.name} pide Fuerza ${worn.strength}: tu velocidad baja 3 m.`, tab: 'estado' })
  }
  if (c.classId === 'barbaro' && level >= 5 && worn?.category !== 'pesada') speed += 3
  if (c.classId === 'monje' && !worn && !equippedShield(c, rules)) {
    const col = cls?.columns.find((k) => k.key.includes('movimiento'))
    const v = atLevel(col?.values, level)
    const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d,]/g, '').replace(',', '.'))
    if (n > 0) speed += n
  }
  if (c.overrides.speed !== undefined) speed = c.overrides.speed
  speed = Math.max(0, speed - exhaustion.speed)

  // Puntos de golpe
  const hitDie = cls?.hitDie ?? 8
  const avg = hitDie / 2 + 1
  let maxHp = Math.max(1, hitDie + mods.con)
  for (let l = 2; l <= level; l++) {
    const roll = c.hpRolls[l - 2]
    maxHp += Math.max(1, (roll ?? avg) + mods.con)
  }
  maxHp += hpBonusPerLevel(c, featIds, rules) * level
  if (c.subclassId === SUBCLASS.hechiceriaDraconica && level >= 3) maxHp += level
  if (c.overrides.maxHp !== undefined) maxHp = c.overrides.maxHp

  // Conjuros
  const spell = spellInfo(c, rules, cls, sub, level, mods, pb, warnings)
  // El ataque mágico es una prueba con d20: el cansancio lo baja (la CD no)
  if (spell) spell.attack -= exhaustion.d20

  // Ataques
  const attacks = weaponAttacks(c, rules, cls, level, mods, pb, featIds, exhaustion.d20)

  // Rasgos y recursos
  const features: FeatureView[] = []
  const resources: ResourceView[] = []
  const addRes = (origin: Origin, prefix: string, defs: ResourceDef[] | undefined, lvl: number) => {
    for (const r of defs ?? []) {
      if ((r.fromLevel ?? 1) > lvl) continue
      const max = resourceMax(r, lvl, mods, pb)
      if (max <= 0) continue
      const key = `${prefix}:${r.id}`
      // Una dote repetida trae el mismo recurso: comparten la cuenta de usos
      if (resources.some((x) => x.key === key)) continue
      resources.push({
        key,
        name: r.name,
        max,
        used: Math.min(max, c.state.resourcesUsed[key] ?? 0),
        recharge: rechargeAt(r, lvl),
        die: atLevel(r.die, lvl),
        pool: !!r.pool,
        origin,
      })
    }
  }
  // Conjuros que se lanzan gratis (Iniciado en la magia, gnomo de los bosques...): van como un recurso
  // por conjuro, con su nombre («Santuario gratis»). Sustituyen al recurso genérico de los datos de la
  // dote o la especie, del que toman el número de usos.
  const freeSpells = c.spells.extra.filter((x) => x.freeCast)
  const freeUses = new Map<string, number>() // id del conjuro u origen «dote:<id>» → usos
  const withoutFreeCasts = (prefix: string, defs: ResourceDef[] | undefined) =>
    (defs ?? []).filter((r) => {
      // Recurso con nombre de conjuro (Hablar con los animales del gnomo) o de una dote que da conjuros gratis
      const bySpell = !!rules.spell(r.id)
      const bySource = prefix.startsWith('dote:') && freeSpells.some((x) => x.source === prefix)
      if (!bySpell && !bySource) return true
      if (bySpell && !freeSpells.some((x) => x.id === r.id)) {
        // Sin el conjuro (otro linaje), el recurso sobra; con el conjuro pero sin uso gratis apuntado, se queda
        return c.spells.extra.some((x) => x.id === r.id)
      }
      if ((r.fromLevel ?? 1) <= level) freeUses.set(bySpell ? r.id : prefix, resourceMax(r, level, mods, pb))
      return false
    })
  const pushFeature = (origin: Origin, f: Feature, prefix: string) => {
    features.push({
      key: `${prefix}:${f.id}`,
      origin,
      name: f.name,
      level: f.level,
      summary: f.summary,
      text: f.text,
      choice: f.choice,
      chosen: f.choice ? c.choices[f.choice.id] : undefined,
    })
  }
  for (const f of classFeatures(cls, level)) {
    pushFeature('clase', f, 'clase')
    addRes('clase', 'clase', f.resources, level)
  }
  for (const f of subclassFeatures(sub, level)) {
    pushFeature('subclase', f, 'subclase')
    addRes('subclase', 'subclase', f.resources, level)
  }
  for (const f of species?.traits ?? []) {
    if (f.level > level) continue
    // Las elecciones de especie (linaje...) usan el id del rasgo y se guardan en speciesChoices.
    const picked = c.speciesChoices[f.id]
    features.push({
      key: `especie:${f.id}`,
      origin: 'especie',
      name: f.name,
      level: f.level,
      summary: f.summary,
      text: f.text,
      choice: species?.choices?.find((ch) => ch.id === f.id),
      chosen: picked ? [picked] : undefined,
    })
    addRes('especie', 'especie', withoutFreeCasts('especie', f.resources), level)
  }
  for (const { entry, data } of feats) {
    if (!data) {
      warnings.push({ kind: 'aviso', text: `La dote "${entry.id}" no está en las reglas cargadas.`, tab: 'rasgos' })
      continue
    }
    // Con el origen en la clave: la mejora de característica puede salir varias veces
    features.push({ key: `dote:${data.id}:${entry.source}`, origin: 'dote', name: data.name, summary: data.summary, text: data.text, choice: data.choice, chosen: entry.choices ? Object.values(entry.choices).flat() : undefined })
    addRes('dote', `dote:${data.id}`, withoutFreeCasts(`dote:${data.id}`, data.resources), level)
  }
  // Dotes elegidas en rasgos (estilo de combate...) que no están en la lista de dotes
  for (const id of featIds) {
    if (c.feats.some((f) => f.id === id)) continue
    const data = rules.feat(id)
    if (!data) continue
    features.push({ key: `dote:${data.id}`, origin: 'dote', name: data.name, summary: data.summary, text: data.text })
    addRes('dote', `dote:${data.id}`, withoutFreeCasts(`dote:${data.id}`, data.resources), level)
  }
  for (const f of c.customFeatures) {
    if (f.level && f.level > level) continue
    features.push({ key: `mesa:${f.id}`, origin: 'mesa', name: f.name, level: f.level, summary: f.summary, text: f.text })
    for (const r of f.resources ?? []) {
      const key = `mesa:${f.id}:${r.id}`
      resources.push({ key, name: r.name, max: r.max, used: Math.min(r.max, c.state.resourcesUsed[key] ?? 0), recharge: r.recharge, pool: false, origin: 'mesa' })
    }
  }
  for (const x of freeSpells) {
    const s = rules.spell(x.id)
    if (!s) continue
    const key = `gratis:${x.id}`
    const max = freeUses.get(x.id) ?? freeUses.get(x.source) ?? 1
    const same = resources.find((r) => r.key === key)
    // El mismo conjuro gratis por dos vías: se suman los usos
    if (same) {
      same.max += max
      same.used = Math.min(same.max, c.state.resourcesUsed[key] ?? 0)
      continue
    }
    const kind = x.source.split(':')[0]
    const origin: Origin = kind === 'dote' || kind === 'especie' || kind === 'clase' ? kind : 'mesa'
    resources.push({ key, name: `${s.name} gratis`, max, used: Math.min(max, c.state.resourcesUsed[key] ?? 0), recharge: x.freeCast!, pool: false, origin, spell: x.id })
  }
  // Claves únicas para las listas de la interfaz
  const seenKeys = new Map<string, number>()
  for (const f of features) {
    const n = (seenKeys.get(f.key) ?? 0) + 1
    seenKeys.set(f.key, n)
    if (n > 1) f.key = `${f.key}#${n}`
  }

  pendingChoices(c, rules, cls, sub, level, warnings)
  if (cls && level >= cls.subclassLevel && !c.subclassId)
    warnings.push({ kind: 'falta', text: `A nivel ${cls.subclassLevel} eliges subclase de ${cls.name.toLowerCase()}.`, tab: 'rasgos', target: 'revisar-subclase' })
  if (cls?.weaponMastery) {
    const n = atLevel(cls.weaponMastery, level) ?? 0
    if (c.weaponMasteries.length < n)
      warnings.push({ kind: 'falta', text: `Puedes tener maestría con ${n} armas y has elegido ${c.weaponMasteries.length}.`, tab: 'turno', target: 'revisar-maestrias' })
    if (c.weaponMasteries.length > n)
      warnings.push({ kind: 'error', text: `Tienes maestría con ${c.weaponMasteries.length} armas; a tu nivel son ${n}.`, tab: 'turno', target: 'revisar-maestrias' })
  }
  if (worn && !armorTrained(c, cls, worn))
    warnings.push({ kind: 'error', text: `No tienes entrenamiento con ${worn.name}: desventaja en todo lo que use Fuerza o Destreza y no puedes lanzar conjuros.`, tab: 'equipo' })
  const shield = equippedShield(c, rules)
  if (shield && !armorTrained(c, cls, shield))
    warnings.push({ kind: 'error', text: 'No tienes entrenamiento con escudos: no sumas su CA.', tab: 'equipo' })

  return {
    level,
    cls,
    sub,
    species,
    background,
    scores,
    mods,
    pb,
    saves,
    skills,
    passivePerception,
    initiative,
    ac,
    speed,
    exhaustion,
    maxHp,
    hitDie,
    spell,
    attacks,
    resources,
    features,
    feats,
    featIds,
    warnings,
  }
}

/** PG extra por nivel: dotes con `hpPerLevel` y la Dureza enana. */
export function hpBonusPerLevel(c: Character, featIds: Set<string>, rules: Rules) {
  let n = 0
  for (const id of featIds) n += rules.feat(id)?.hpPerLevel ?? 0
  if (c.speciesId === SPECIES.enano) n += 1
  return n
}

function equippedArmor(c: Character, rules: Rules): ArmorData | undefined {
  for (const it of c.equipment) {
    if (!it.equipped || it.ref?.kind !== 'armadura') continue
    const a = rules.armor(it.ref.id)
    if (a && a.category !== 'escudo') return a
  }
  return undefined
}

function equippedShield(c: Character, rules: Rules): ArmorData | undefined {
  for (const it of c.equipment) {
    if (!it.equipped || it.ref?.kind !== 'armadura') continue
    const a = rules.armor(it.ref.id)
    if (a?.category === 'escudo') return a
  }
  return undefined
}

function armorClass(
  c: Character,
  rules: Rules,
  cls: ClassData | undefined,
  sub: SubclassData | undefined,
  level: number,
  mods: Record<Ability, number>,
  featIds: Set<string>,
  _warnings: Warning[],
): Derived['ac'] {
  const armor = equippedArmor(c, rules)
  const shield = equippedShield(c, rules)
  const parts: string[] = []
  let value: number
  if (armor) {
    // La armadura pesada no suma Destreza, pero tampoco la resta si es negativa
    const dex = armor.category === 'pesada' ? 0 : armor.dexCap === null ? mods.des : Math.min(mods.des, armor.dexCap)
    value = armor.baseAC + dex
    parts.push(`${armor.name} ${armor.baseAC}`)
    if (dex !== 0) parts.push(`${ABILITY_SHORT.des} ${signed(dex)}`)
    if (featIds.has(FEAT.defensa)) {
      value += 1
      parts.push('Defensa +1')
    }
  } else {
    // Cada parte es «nombre valor», con signo en los modificadores: «Sin armadura 10», «Des +1»
    const m = (a: Ability) => `${ABILITY_SHORT[a]} ${signed(mods[a])}`
    const options: { v: number; label: string[] }[] = [{ v: 10 + mods.des, label: ['Sin armadura 10', m('des')] }]
    if (cls?.id === 'barbaro') options.push({ v: 10 + mods.des + mods.con, label: ['Defensa sin armadura 10', m('des'), m('con')] })
    if (cls?.id === 'monje' && !shield) options.push({ v: 10 + mods.des + mods.sab, label: ['Defensa sin armadura 10', m('des'), m('sab')] })
    if (sub?.id === SUBCLASS.hechiceriaDraconica && level >= 3)
      options.push({ v: 10 + mods.des + mods.car, label: ['Resiliencia dracónica 10', m('des'), m('car')] })
    if (c.state.toggles['armadura-de-mago']) options.push({ v: 13 + mods.des, label: ['Armadura de mago 13', m('des')] })
    const best = options.reduce((a, b) => (b.v > a.v ? b : a))
    value = best.v
    parts.push(...best.label)
  }
  // Sin entrenamiento con escudos, el escudo no suma nada a la CA
  if (shield && armorTrained(c, cls, shield)) {
    value += shield.baseAC
    parts.push(`Escudo +${shield.baseAC}`)
  } else if (shield) parts.push('Escudo sin entrenamiento +0')
  if (c.overrides.ac !== undefined) return { value: c.overrides.ac, parts: [c.overrides.note ?? 'Ajuste de la DM'], overridden: true }
  return { value, parts, overridden: false }
}

function spellInfo(
  c: Character,
  rules: Rules,
  cls: ClassData | undefined,
  sub: SubclassData | undefined,
  level: number,
  mods: Record<Ability, number>,
  pb: number,
  warnings: Warning[],
): SpellInfo | undefined {
  const sc = cls?.spellcasting
  if (!sc) {
    if (c.spells.cantrips.length || c.spells.prepared.length)
      warnings.push({ kind: 'error', text: `${cls?.name ?? 'Tu clase'} no lanza conjuros, pero tienes conjuros de clase apuntados.`, tab: 'conjuros' })
    return undefined
  }
  const table = sc.progression === 'pacto' ? undefined : rules.book.slots[sc.progression]
  const slots = table ? [...(table[level - 1] ?? [])] : []
  while (slots.length && slots[slots.length - 1] === 0) slots.pop()
  let pact: SpellInfo['pact']
  let maxSpellLevel = slots.length
  if (sc.progression === 'pacto') {
    pact = { slots: rules.book.slots.pacto.slots[level - 1] ?? 0, level: rules.book.slots.pacto.slotLevel[level - 1] ?? 1 }
    maxSpellLevel = pact.level
  }
  const alwaysPrepared = (sub?.alwaysPrepared ?? []).filter((x) => x.level <= level).flatMap((x) => x.spells)
  const info: SpellInfo = {
    ability: sc.ability,
    dc: 8 + pb + mods[sc.ability],
    attack: pb + mods[sc.ability],
    slots,
    pact,
    cantripsMax: atLevel(sc.cantrips, level) ?? 0,
    preparedMax: atLevel(sc.prepared, level) ?? 0,
    maxSpellLevel,
    alwaysPrepared,
  }

  // Validación
  const list = new Set(cls?.spellList ?? [])
  const bardSecrets = c.classId === 'bardo' && level >= 10
  const check = (id: string, isCantrip: boolean) => {
    const s = rules.spell(id)
    if (!s) {
      warnings.push({ kind: 'aviso', text: `No encuentro el conjuro "${id}".`, tab: 'conjuros', target: 'revisar-conjuros' })
      return
    }
    if (isCantrip && s.level !== 0) warnings.push({ kind: 'error', text: `${s.name} no es un truco.`, tab: 'conjuros', target: 'revisar-conjuros' })
    if (!isCantrip && s.level === 0) warnings.push({ kind: 'error', text: `${s.name} es un truco: va en la lista de trucos.`, tab: 'conjuros', target: 'revisar-conjuros' })
    if (!isCantrip && s.level > maxSpellLevel)
      warnings.push({ kind: 'error', text: `${s.name} es de nivel ${s.level}; aún solo tienes espacios hasta nivel ${maxSpellLevel}.`, tab: 'conjuros', target: 'revisar-conjuros' })
    if (list.size && !list.has(id) && !alwaysPrepared.includes(id) && !(bardSecrets && !isCantrip))
      warnings.push({ kind: 'error', text: `${s.name} no está en la lista de conjuros de ${cls?.name.toLowerCase()}.`, tab: 'conjuros', target: 'revisar-conjuros' })
  }
  c.spells.cantrips.forEach((id) => check(id, true))
  c.spells.prepared.forEach((id) => check(id, false))
  // «1 truco», «2 trucos»; el límite, «a tu nivel es 1», «son 2» o «no tienes ninguno»
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`
  const limit = (k: number) => (k === 0 ? 'a tu nivel no tienes ninguno' : k === 1 ? 'a tu nivel es 1' : `a tu nivel son ${k}`)
  const cantripCount = c.spells.cantrips.length
  if (cantripCount > info.cantripsMax)
    warnings.push({ kind: 'error', text: `Tienes ${n(cantripCount, 'truco', 'trucos')}; ${limit(info.cantripsMax)}.`, tab: 'conjuros', target: 'revisar-conjuros' })
  if (cantripCount < info.cantripsMax) {
    const k = info.cantripsMax - cantripCount
    warnings.push({ kind: 'falta', text: `Te ${k === 1 ? 'falta' : 'faltan'} ${n(k, 'truco', 'trucos')} por elegir.`, tab: 'conjuros', target: 'revisar-conjuros' })
  }
  const preparedCount = c.spells.prepared.filter((id) => !alwaysPrepared.includes(id)).length
  if (preparedCount > info.preparedMax)
    warnings.push({ kind: 'error', text: `Tienes ${n(preparedCount, 'conjuro preparado', 'conjuros preparados')}; ${limit(info.preparedMax)}.`, tab: 'conjuros', target: 'revisar-conjuros' })
  if (preparedCount < info.preparedMax)
    warnings.push({ kind: 'falta', text: `Puedes preparar ${n(info.preparedMax - preparedCount, 'conjuro', 'conjuros')} más.`, tab: 'conjuros', target: 'revisar-conjuros' })
  return info
}

/** CD de salvación y ataque mágico de un conjuro lanzado con `ability` (los de dotes y especie usan su propia aptitud). El cansancio baja el ataque, no la CD. */
export function spellNumbers(d: Pick<Derived, 'pb' | 'mods' | 'exhaustion'>, ability: Ability): { dc: number; attack: number } {
  return { dc: 8 + d.pb + d.mods[ability], attack: d.pb + d.mods[ability] - d.exhaustion.d20 }
}

function weaponAttacks(
  c: Character,
  rules: Rules,
  cls: ClassData | undefined,
  level: number,
  mods: Record<Ability, number>,
  pb: number,
  featIds: Set<string>,
  exhaustion: number,
): Attack[] {
  const out: Attack[] = []
  const seen = new Set<string>()
  const better = (a: Ability, b: Ability): Ability => (mods[b] > mods[a] ? b : a)
  // Artes marciales (monje): sin armadura ni escudo, las armas de monje y los ataques sin armas
  // usan Destreza si es mejor y el dado de la columna «Artes marciales» si es mayor que el del arma.
  const martialArts = c.classId === 'monje' && !equippedArmor(c, rules) && !equippedShield(c, rules)
  const maDie = martialArts ? String(atLevel(cls?.columns.find((k) => k.key.includes('artes-marciales'))?.values, level) ?? '1d6') : ''
  const bigger = (die: string) => (maDie && dieAverage(maDie) > dieAverage(die) ? maDie : die)
  for (const it of c.equipment) {
    if (it.ref?.kind !== 'arma') continue
    const w = rules.weapon(it.ref.id)
    if (!w || seen.has(w.id)) continue
    seen.add(w.id)
    const ranged = w.kind === 'distancia'
    const finesse = hasProperty(w, 'sutil')
    const monk = martialArts && monkWeapon(w)
    // Sutil va antes que distancia: el dardo usa la mejor de Fuerza y Destreza
    const ability: Ability = finesse || monk ? better('fue', 'des') : ranged ? 'des' : 'fue'
    const m = mods[ability]
    const proficient = weaponProficient(c, cls, w)
    const notes: string[] = []
    let attack = m + (proficient ? pb : 0) - exhaustion
    if (!proficient) notes.push('Sin competencia: no sumas tu bonificador por competencia.')
    if (ranged && featIds.has(FEAT.tiroConArco)) {
      attack += 2
      notes.push('Tiro con arco: +2 al ataque.')
    }
    let dmgBonus = m
    const twoHanded = hasProperty(w, 'a dos manos')
    if (!ranged && !twoHanded && featIds.has(FEAT.duelo)) {
      notes.push('Duelo: +2 al daño si no llevas otra arma (ya sumado).')
      dmgBonus += 2
    }
    const die = monk ? bigger(w.damage) : w.damage
    const versatileArg = propertyArg(w, 'versátil')
    const versatileDie = versatileArg && monk ? bigger(versatileArg) : versatileArg
    if (monk) {
      const why = [die !== w.damage && `tiras ${die} de daño`, ability === 'des' && !finesse && 'usas tu Destreza'].filter(Boolean)
      if (why.length) notes.push(`Artes marciales: ${why.join(' y ')}.`)
    }
    const rangeText = propertyArg(w, 'arrojadiza') ?? propertyArg(w, 'munición')
    const range = rangeText?.match(/alcance\s*([\d,./]+)/i)?.[1]
    const hasMastery = c.weaponMasteries.includes(w.id)
    const mastery = hasMastery ? rules.mastery(w.mastery) : undefined
    out.push({
      key: `arma:${it.id}`,
      itemId: it.id,
      name: w.name,
      attack,
      damage: withBonus(die, dmgBonus),
      damageType: w.damageType,
      versatile: versatileDie ? withBonus(versatileDie, m) : undefined,
      range,
      properties: w.properties,
      mastery: hasMastery ? { id: w.mastery, name: mastery?.name ?? w.mastery, text: mastery?.text } : undefined,
      notes,
      proficient,
    })
  }
  // Ataque sin armas (siempre disponible): 1 + Fuerza, o el dado de Artes marciales del monje
  const ability: Ability = martialArts ? better('fue', 'des') : 'fue'
  const um = mods[ability]
  const notes = ['Puñetazo, patada o cabezazo. También puedes usarlo para agarrar o empujar.']
  if (c.classId === 'monje' && !martialArts) notes.push('Con armadura o escudo pierdes Artes marciales: sin tu dado ni tu Destreza.')
  out.push({
    key: 'sin-armas',
    name: 'Ataque sin armas',
    attack: um + pb - exhaustion,
    damage: martialArts ? withBonus(maDie, um) : String(Math.max(0, 1 + um)),
    damageType: 'contundente',
    properties: [],
    notes,
    proficient: true,
  })
  return out
}

function pendingChoices(
  c: Character,
  _rules: Rules,
  cls: ClassData | undefined,
  sub: SubclassData | undefined,
  level: number,
  warnings: Warning[],
) {
  const all = [...classFeatures(cls, level), ...subclassFeatures(sub, level)]
  for (const f of all) {
    const ch = f.choice
    // Los conjuros de un rasgo (Arcanum místico, Descubrimientos mágicos...) también se avisan.
    if (!ch || ch.kind === 'subclase' || ch.kind === 'truco' || ch.kind === 'maestria-armas') continue
    const chosen = c.choices[ch.id] ?? []
    // Explorador hábil: además de la pericia, dos idiomas (se guardan en «<id>-idiomas»).
    if (ch.languages && (c.choices[`${ch.id}-idiomas`] ?? []).length < ch.languages)
      warnings.push({ kind: 'falta', text: `Nivel ${f.level}: faltan los idiomas de «${f.name}».`, tab: 'rasgos', target: `revisar-${ch.id}` })
    // Guerrero druídico o bendito en lugar de una dote: faltan sus trucos.
    const alt = ch.kind === 'estilo-combate' ? ch.options?.find((o) => chosen.includes(o.id) && o.cantrips) : undefined
    if (alt && c.spells.extra.filter((e) => e.source === `${f.id.startsWith(`${cls?.id}-`) ? 'clase' : 'subclase'}:${alt.name}`).length < alt.cantrips!.count)
      warnings.push({ kind: 'falta', text: `Nivel ${f.level}: faltan los trucos de ${alt.name}.`, tab: 'rasgos', target: `revisar-${ch.id}` })
    if (ch.kind === 'dote' || ch.kind === 'don-epico') {
      // Las dotes de nivel se guardan como CharacterFeat con source "nivel-N".
      if (c.feats.some((x) => x.source === `nivel-${f.level}`)) continue
      if (chosen.length >= ch.count) continue
    }
    if (ch.kind === 'pericia' && chosen.length < ch.count) {
      // La pericia también se guarda en c.expertise; si ya hay suficientes, no avisamos.
      const expected = all.filter((x) => x.choice?.kind === 'pericia').reduce((n, x) => n + (x.choice?.count ?? 0), 0)
      if (c.expertise.length >= expected) continue
    }
    if (chosen.length < ch.count)
      warnings.push({ kind: 'falta', text: `Nivel ${f.level}: falta elegir en «${f.name}».`, tab: 'rasgos', target: `revisar-${ch.id}` })
  }
}
