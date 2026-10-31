// Tipos de los datos de reglas (SRD 5.2.1 en español + contenido propio de la mesa).
// Los JSON de src/data/srd/ los generan los scripts de scripts/srd/ a partir de
// srd/text/es-raw.txt. No se editan a mano: se corrige el script y se regenera.
//
// Convenciones:
// - Todos los `id` son slugs ASCII en minúsculas del nombre en español:
//   "Palabra de curación" -> "palabra-de-curacion". Sin tildes, ñ -> n.
// - Distancias en metros, como en el SRD en español (1 casilla = 1,5 m).
// - `text` es texto enriquecido mínimo (ver RichText abajo).
// - `source` dice de dónde sale: 'srd' (SRD 5.2.1, CC-BY-4.0) o 'mesa'
//   (contenido de vuestro manual o reglas de la casa, solo para uso privado).

export type Source = 'srd' | 'mesa'

export type Ability = 'fue' | 'des' | 'con' | 'int' | 'sab' | 'car'
export const ABILITIES: Ability[] = ['fue', 'des', 'con', 'int', 'sab', 'car']

export type SkillId =
  | 'acrobacias'
  | 'arcanos'
  | 'atletismo'
  | 'engano'
  | 'historia'
  | 'interpretacion'
  | 'intimidacion'
  | 'investigacion'
  | 'juego-de-manos'
  | 'medicina'
  | 'naturaleza'
  | 'percepcion'
  | 'perspicacia'
  | 'persuasion'
  | 'religion'
  | 'sigilo'
  | 'supervivencia'
  | 'trato-con-animales'

/**
 * Texto enriquecido mínimo:
 * - Párrafos separados por una línea en blanco ("\n\n").
 * - Una línea que empieza por "• " es un punto de lista.
 * - **negrita** para los encabezados en línea ("**Número de usos.** Puedes...").
 * - Tablas: un bloque cuyas líneas empiezan y acaban por "|" (formato Markdown,
 *   la segunda línea es "|---|---|").
 */
export type RichText = string

export type Recharge = 'corto' | 'largo' | 'corto-uno' | 'amanecer'
// 'corto'     -> se recupera todo en descanso corto o largo
// 'largo'     -> se recupera todo solo en descanso largo
// 'corto-uno' -> el descanso corto recupera 1 uso; el largo, todos
// 'amanecer'  -> objetos mágicos

/** Cuántos usos tiene un recurso. */
export type ResourceMax =
  | { perLevel: number[] } // 20 valores, índice 0 = nivel 1 de la clase. 0 = aún no.
  | { abilityMod: Ability; min: number } // p. ej. Inspiración bárdica: mod. Car, mínimo 1
  | { levelTimes: number } // p. ej. Imposición de manos: 5 × nivel (es una reserva de PG)
  | { proficiencyBonus: true }

export interface ResourceDef {
  id: string // único dentro de la clase/especie/dote: "inspiracion-bardica"
  name: string
  max: ResourceMax
  recharge: Recharge
  /** Cambios de recarga por nivel, p. ej. bardo nivel 5 -> 'corto'. */
  rechargeFrom?: { level: number; recharge: Recharge }[]
  /** Dado asociado por nivel (20 valores), p. ej. ["d6","d6",...,"d12"]. */
  die?: string[]
  /** true si es una reserva de puntos (PG de Imposición de manos, puntos de hechicería). */
  pool?: boolean
  /** Nivel de clase en el que aparece. Por defecto 1. */
  fromLevel?: number
}

/** Qué tiene que elegir el jugador al obtener un rasgo (lo usa el asistente de subir de nivel). */
export type ChoiceKind =
  | 'subclase'
  | 'dote' // dote general u otra para la que cumpla requisitos (niveles 4, 8, 12, 16)
  | 'dote-origen'
  | 'don-epico'
  | 'estilo-combate'
  | 'pericia'
  | 'habilidad'
  | 'maestria-armas'
  | 'metamagia'
  | 'invocacion'
  | 'truco'
  | 'conjuro'
  | 'idioma'
  | 'herramienta'
  | 'opcion' // elegir una de `options` (p. ej. Orden divina del clérigo)

/** Conjuro que da una opción: el linaje élfico da su truco a nivel 1 y otros dos a los niveles 3 y 5. */
export interface OptionSpell {
  level: number // nivel de personaje a partir del que se tiene
  id: string
  freeCast?: 'largo' // se lanza una vez gratis y se recupera con un descanso largo
}

export interface ChoiceOption {
  id: string
  name: string
  text?: RichText
  /** Una línea para novatos; el texto entero queda tras «Leer más». */
  summary?: string
  /** Conjuros que da esta opción (linajes de especie). */
  spells?: OptionSpell[]
  /** Visión en la oscuridad que da esta opción, si mejora la de la especie (drow: 36 m). */
  darkvision?: number
  /** Trucos de otra lista que da esta opción (Guerrero druídico: dos trucos de druida con Sabiduría). */
  cantrips?: { list: string; count: number; ability: Ability; suggested?: string[] }
}

/** De dónde salen los conjuros de una elección de tipo 'conjuro' (Arcanum místico...). */
export interface SpellChoiceDef {
  lists: string[] // listas de clase
  levels?: number[] // niveles permitidos
  /** Trucos o conjuros de cualquier nivel para el que tengas espacios (Descubrimientos mágicos). */
  upToSlots?: boolean
  /** Uno de cada nivel de `levels` (Maestría sobre conjuros: uno de nivel 1 y otro de nivel 2). */
  onePerLevel?: boolean
  school?: string // "Evocación"
  castingTime?: string // "Acción"
  /** Los elegidos van a la ficha como conjuros extra (siempre preparados, no cuentan para el límite). */
  toSheet?: boolean
}

export interface ChoiceDef {
  id: string // clave con la que se guarda en Character.choices: "<featureId>"
  kind: ChoiceKind
  count: number
  /**
   * Para kind 'opcion' (o para acotar habilidades/herramientas). En 'estilo-combate',
   * las alternativas que no son dotes (Guerrero druídico).
   */
  options?: ChoiceOption[]
  /** Opciones recomendadas (las que pone «Elegir por mí»). */
  suggested?: string[]
  /** Idiomas que se aprenden con el mismo rasgo (Explorador hábil: 2). */
  languages?: number
  /** Para kind 'conjuro'. */
  spells?: SpellChoiceDef
  /** Restricción en texto libre si no cabe en options. */
  note?: string
}

export interface Feature {
  id: string // "bardo-inspiracion-bardica"
  name: string // "Inspiración bárdica"
  level: number // nivel de clase (o de personaje para especies) en que se obtiene
  text: RichText // texto oficial del SRD
  /** Explicación corta y llana para novatos (1-3 frases, nuestras palabras). */
  summary?: string
  choice?: ChoiceDef
  /** Recursos con usos que define este rasgo. */
  resources?: ResourceDef[]
}

export type CasterProgression = 'completo' | 'medio' | 'pacto'

export interface Spellcasting {
  ability: Ability
  progression: CasterProgression
  focus: string // "instrumento musical", "símbolo sagrado"...
  /** 20 valores, índice 0 = nivel 1. */
  cantrips: number[]
  /** 20 valores. Conjuros preparados de nivel 1+. */
  prepared: number[]
  ritual?: boolean // puede lanzar como ritual los rituales que tenga preparados
}

export interface ClassColumn {
  key: string // "dado-bardico"
  label: string // "Dado bárdico"
  values: (string | number)[] // 20 valores
}

export interface ClassData {
  id: string // "bardo"
  name: string // "Bardo"
  source: Source
  hitDie: 6 | 8 | 10 | 12
  primaryAbilities: Ability[]
  savingThrows: Ability[]
  skillChoices: { count: number; from: SkillId[] | 'cualquiera' }
  weaponText: string // "Armas sencillas"
  /** 'ligeras' = marciales con la propiedad Ligera (monje); 'sutiles-o-ligeras' = con Sutil o Ligera (pícaro). */
  weapons: { simple: boolean; martial: boolean | 'ligeras' | 'sutiles-o-ligeras' }
  armor: { ligera: boolean; media: boolean; pesada: boolean; escudo: boolean }
  toolText?: string
  startingEquipment: { option: string; text: string }[] // A, B, C...
  spellcasting?: Spellcasting
  /** Nº de armas con Maestría con armas por nivel (20 valores), si la clase la tiene. */
  weaponMastery?: number[]
  columns: ClassColumn[] // columnas propias de la tabla de la clase (sin espacios de conjuro)
  features: Feature[] // ordenados por nivel; incluye "Subclase de X", "Mejora de característica", etc.
  subclassLevel: number // 3 en 2024
  subclasses: string[] // ids de SubclassData
  /** Ids de conjuros de la lista de la clase. */
  spellList?: string[]
  summary?: string // para novatos: qué es la clase en 1-2 frases
}

export interface SubclassData {
  id: string // "colegio-del-conocimiento"
  classId: string
  name: string
  source: Source
  text?: RichText // introducción
  features: Feature[]
  /** Conjuros siempre preparados por nivel de clase. */
  alwaysPrepared?: { level: number; spells: string[] }[]
  summary?: string
}

export interface SpeciesData {
  id: string // "draconido"
  name: string
  source: Source
  creatureType: string // "Humanoide"
  sizeText: string // "Mediano (alrededor de 1,5-2,1 m)"
  sizes: ('Pequeño' | 'Mediano')[]
  speed: number // metros
  darkvision?: number // metros
  traits: Feature[] // level = nivel de personaje
  /** Elecciones de la especie, p. ej. linaje dracónico, legado élfico. */
  choices?: ChoiceDef[]
  summary?: string
}

export interface BackgroundData {
  id: string // "criminal"
  name: string
  source: Source
  abilities: Ability[] // las 3 que puede subir (+2/+1 o +1/+1/+1)
  feat: { id: string; note?: string } // dote de origen, con elección si la hay
  skills: SkillId[]
  tool: string
  equipment: { option: string; text: string }[]
  text?: RichText
  /** Clases para las que el creador lo recomienda (contenido de la mesa; los del SRD los elige create.ts). */
  recommendedFor?: string[]
  /** Nombre en femenino, si la mesa lo trae; los del SRD están en common.tsx. */
  nameF?: string
}

export type FeatCategory = 'origen' | 'general' | 'estilo-combate' | 'don-epico'

export interface FeatData {
  id: string
  name: string
  source: Source
  category: FeatCategory
  prerequisite?: string
  repeatable?: boolean
  text: RichText
  summary?: string
  /** Subida de característica que concede (dotes generales, dones épicos). */
  abilityIncrease?: { options: Ability[]; amount: number; max: number }
  /** PG máximos extra por cada nivel de personaje (dotes de la mesa que lo den). */
  hpPerLevel?: number
  choice?: ChoiceDef
  resources?: ResourceDef[]
}

export interface SpellData {
  id: string
  name: string
  level: number // 0 = truco
  school: string // "Evocación"
  classes: string[] // ids de clase
  castingTime: string // "Acción", "Acción adicional", "Reacción, que llevas a cabo cuando..."
  range: string // "18 m"
  components: string // "V, S, M (la pata trasera de un saltamontes)"
  duration: string // "Concentración, hasta 1 minuto"
  concentration: boolean
  ritual: boolean
  text: RichText // descripción sin la parte de nivel superior / mejora de truco
  higherLevels?: RichText // "Con un espacio de conjuro de nivel superior..." / "Mejora de truco..."
}

export interface WeaponData {
  id: string
  name: string
  category: 'sencilla' | 'marcial'
  kind: 'cuerpo-a-cuerpo' | 'distancia'
  damage: string // "1d8" o "1" (cerbatana)
  damageType: string // "perforante"
  properties: string[] // tal cual: "Sutil", "Ligera", "Arrojadiza (alcance 6/18)", "Versátil (1d10)"
  mastery: string // id de MasteryData: "rozar"
  weight: string
  cost: string
}

export interface ArmorData {
  id: string
  name: string
  category: 'ligera' | 'media' | 'pesada' | 'escudo'
  baseAC: number // escudo: 2
  dexCap: number | null // ligera: null (sin límite), media: 2, pesada: 0
  strength?: number // requisito de Fuerza
  stealthDisadvantage: boolean
  weight: string
  cost: string
}

export interface RuleEntry {
  id: string
  name: string
  text: RichText
  /** Para el glosario: etiqueta entre corchetes del SRD, p. ej. "Estado", "Acción", "Peligro". */
  tag?: string
}

export interface GearData {
  id: string
  name: string
  weight: string
  cost: string
  text?: RichText
}
