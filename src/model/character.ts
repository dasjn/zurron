// Modelo de personaje. Guardamos DECISIONES, no números derivados: la CA, los
// bonificadores, la CD de conjuros, los espacios... los calcula el motor de
// reglas (src/rules/) a partir de estas decisiones y de los datos del SRD.
// Si la DM aprueba algo que no sale de las reglas, va a `overrides` o a
// `customFeatures`, nunca a mano en otro sitio.

import type { Ability, SkillId, RichText } from '../data/types'

export const CHARACTER_SCHEMA = 1

export interface Character {
  schema: typeof CHARACTER_SCHEMA
  id: string // slug estable: "nombre-del-personaje"
  name: string
  player?: string
  /** Frase o lema que se muestra bajo el nombre. */
  tagline?: string
  createdAt: string // ISO
  updatedAt: string // ISO

  speciesId: string
  /** Elecciones de especie: { linaje: "rojo", tamano: "Mediano" }. Claves = ChoiceDef.id. */
  speciesChoices: Record<string, string>
  backgroundId: string
  /** Puntuaciones tras la tirada/compra, ANTES de sumar trasfondo y dotes. */
  baseScores: Record<Ability, number>
  /** Lo que suma el trasfondo: { fue: 2, con: 1 } o tres +1. */
  backgroundBonus: Partial<Record<Ability, number>>

  classId: string
  level: number
  subclassId?: string
  /**
   * Puntos de golpe ganados en los niveles 2+ (índice 0 = nivel 2).
   * null = usar la media fija (dado/2 + 1). Un número = lo que salió en el dado.
   * El nivel 1 siempre es el máximo del dado.
   */
  hpRolls: (number | null)[]

  skills: SkillId[] // competencias en habilidades (de clase, trasfondo, especie, dotes)
  expertise: SkillId[] // pericia
  tools: string[] // texto libre: "Herramientas de ladrón"
  languages: string[]
  /** Competencias extra de armas/armaduras fuera de la clase (dotes, especie). */
  extraProficiencies?: string[]

  /** Elecciones de rasgos de clase/subclase. Clave = ChoiceDef.id; valor = ids elegidos. */
  choices: Record<string, string[]>
  feats: CharacterFeat[]
  /** Armas con maestría elegidas (ids de WeaponData). */
  weaponMasteries: string[]

  spells: {
    cantrips: string[] // ids de trucos de la clase
    prepared: string[] // ids de conjuros preparados de nivel 1+
    /** Conjuros de otras fuentes (dotes, especie): no cuentan para el límite de preparados. */
    extra: { id: string; source: string; ability?: Ability; freeCast?: Recharge1 }[]
  }

  equipment: Item[]
  coins: Coins

  /** Rasgos que no salen del SRD: reglas de la casa, contenido de vuestro manual. */
  customFeatures: CustomFeature[]
  /** Ajustes manuales aprobados por la DM. Se muestran marcados. */
  overrides: Overrides

  persona: Persona
  /** Retrato y colores propios de la ficha. */
  look?: Look
  /** Guía personal: "Cómo se juega X", estrategia, combos... */
  guide: GuideSection[]
  notes: Note[]
  state: PlayState
  /** Historial de subidas de nivel, para poder deshacer. */
  history: LevelUpRecord[]
}

export type Recharge1 = 'largo' | 'corto'

export interface CharacterFeat {
  id: string // id de FeatData (o de una dote 'mesa')
  /** De dónde sale: "trasfondo", "nivel-4", "humano"... */
  source: string
  /** Para dotes con subida de característica: { car: 1 } o { fue: 2 }. */
  abilityIncrease?: Partial<Record<Ability, number>>
  /** Elecciones de la dote (Iniciado en la magia: lista, trucos, conjuro...). */
  choices?: Record<string, string[]>
}

export interface Item {
  id: string // único dentro del personaje
  name: string
  qty: number
  /** Si es un arma o armadura del SRD, su id (para calcular ataque o CA). */
  ref?: { kind: 'arma' | 'armadura'; id: string }
  equipped?: boolean
  notes?: string
  weight?: string
}

export interface Coins {
  pc: number // cobre
  pp: number // plata
  pe: number // electro
  po: number // oro
  ppt: number // platino
}

export interface CustomFeature {
  id: string
  name: string
  text: RichText
  summary?: string
  /** "mesa" (manual propio), "dm" (regla de la casa), "trasfondo", etc. */
  source: string
  level?: number
  resources?: {
    id: string
    name: string
    max: number
    recharge: 'corto' | 'largo' | 'corto-uno'
  }[]
}

export interface Overrides {
  ac?: number
  speed?: number
  maxHp?: number
  initiative?: number
  /** Explicación de por qué (se muestra junto al valor). */
  note?: string
}

export interface Persona {
  appearance?: string
  personality?: string
  ideals?: string
  bonds?: string
  flaws?: string
  backstory?: RichText
  pronouns?: string
  age?: string
  height?: string
  alignment?: string
}

export interface Look {
  /** data URL (jpeg/webp) para que la copia de seguridad lo incluya. */
  portrait?: string
  portraitPosition?: string // CSS object-position
  /** Variables CSS sin "--": bg, surface, ink, muted, line, accent, accent-soft, brass, brass-soft, good, bad. */
  palette?: { light: Record<string, string>; dark: Record<string, string> }
}

export interface GuideSection {
  id: string
  title: string
  body: RichText
}

export interface Note {
  id: string
  date: string // ISO (día)
  title: string
  body: string
}

export interface PlayState {
  hp: number
  tempHp: number
  hitDiceUsed: number
  /** Espacios gastados por nivel de conjuro (índice 0 = nivel 1). */
  slotsUsed: number[]
  pactSlotsUsed: number
  /** Usos gastados de cada recurso. Clave = "<origen>:<ResourceDef.id>". */
  resourcesUsed: Record<string, number>
  conditions: string[] // ids de RuleEntry de estados
  exhaustion: number // 0-6
  /**
   * Tiradas de salvación contra muerte a 0 PG. Tres éxitos: estable (sigue a 0 PG, ya no tira).
   * Tres fallos: muerto (la muerte instantánea también se apunta como tres fallos).
   * Vuelven a 0 al recuperar PG.
   */
  deathSaves: { success: number; fail: number }
  heroicInspiration: boolean
  concentration?: string // id del conjuro
  /** Interruptores temporales: { "armadura-de-mago": true }. */
  toggles: Record<string, boolean>
}

export interface LevelUpRecord {
  date: string
  fromLevel: number
  toLevel: number
  /** Copia del personaje antes de subir (sin history), para deshacer. */
  snapshot: Omit<Character, 'history'>
  summary: string[]
}
