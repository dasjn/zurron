import type { Ability, SkillId } from '../data/types'

export const ABILITY_NAMES: Record<Ability, string> = {
  fue: 'Fuerza',
  des: 'Destreza',
  con: 'Constitución',
  int: 'Inteligencia',
  sab: 'Sabiduría',
  car: 'Carisma',
}

/** Abreviaturas en tipo frase (nada en mayúsculas: ver DISENO.md). */
export const ABILITY_SHORT: Record<Ability, string> = {
  fue: 'Fue',
  des: 'Des',
  con: 'Con',
  int: 'Int',
  sab: 'Sab',
  car: 'Car',
}

export const SKILLS: { id: SkillId; name: string; ability: Ability }[] = [
  { id: 'acrobacias', name: 'Acrobacias', ability: 'des' },
  { id: 'arcanos', name: 'Conocimiento arcano', ability: 'int' },
  { id: 'atletismo', name: 'Atletismo', ability: 'fue' },
  { id: 'engano', name: 'Engaño', ability: 'car' },
  { id: 'historia', name: 'Historia', ability: 'int' },
  { id: 'interpretacion', name: 'Interpretación', ability: 'car' },
  { id: 'intimidacion', name: 'Intimidación', ability: 'car' },
  { id: 'investigacion', name: 'Investigación', ability: 'int' },
  { id: 'juego-de-manos', name: 'Juego de manos', ability: 'des' },
  { id: 'medicina', name: 'Medicina', ability: 'sab' },
  { id: 'naturaleza', name: 'Naturaleza', ability: 'int' },
  { id: 'percepcion', name: 'Percepción', ability: 'sab' },
  { id: 'perspicacia', name: 'Perspicacia', ability: 'sab' },
  { id: 'persuasion', name: 'Persuasión', ability: 'car' },
  { id: 'religion', name: 'Religión', ability: 'int' },
  { id: 'sigilo', name: 'Sigilo', ability: 'des' },
  { id: 'supervivencia', name: 'Supervivencia', ability: 'sab' },
  { id: 'trato-con-animales', name: 'Trato con animales', ability: 'sab' },
]

export const SKILL_NAME = Object.fromEntries(SKILLS.map((s) => [s.id, s.name])) as Record<SkillId, string>

export const CLASS_IDS = [
  'barbaro',
  'bardo',
  'brujo',
  'clerigo',
  'druida',
  'explorador',
  'guerrero',
  'hechicero',
  'mago',
  'monje',
  'paladin',
  'picaro',
] as const

/**
 * Ids de dotes y rasgos con efecto en los números. Se comprueban contra los
 * datos en los tests (rules.data.test.ts) para que no se desincronicen.
 */
export const FEAT = {
  alerta: 'alerta',
  tiroConArco: 'tiro-con-arco',
  defensa: 'defensa',
  duelo: 'duelo', // no está en el SRD: solo si la mesa la añade
  mejoraCaracteristica: 'mejora-de-caracteristica',
} as const

export const SUBCLASS = {
  hechiceriaDraconica: 'hechiceria-draconica',
} as const

export const SPECIES = {
  enano: 'enano',
} as const

/** 1 casilla = 1,5 m. */
export function squares(metres: number) {
  return Math.round(metres / 1.5)
}

export function signed(n: number) {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`
}

export function metres(m: number) {
  return `${String(m).replace('.', ',')} m`
}
