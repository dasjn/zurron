// Tests de armas, CA y cansancio con personajes de prueba hechos solo con el SRD:
// escudo con y sin entrenamiento, Artes marciales del monje, competencia con armas
// marciales (monje y pícaro), armas sutiles a distancia, el cansancio en las cifras y
// las tarjetas de conjuros de la pestaña Turno.

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Ability, ClassData } from '../data/types'
import type { Character, Item } from '../model/character'
import { Rules, type RuleBook } from './book'
import { SKILLS } from './constants'
import { derive } from './derive'
import { spellCard } from '../ui/tabs/Turno'

const SRD = resolve(__dirname, '../data/srd')
const json = (name: string) => JSON.parse(readFileSync(resolve(SRD, name), 'utf8'))

function srdBook(): RuleBook {
  const list = (name: string) => (existsSync(resolve(SRD, name)) ? json(name) : [])
  return {
    classes: list('classes.json'),
    subclasses: list('subclasses.json'),
    species: list('species.json'),
    backgrounds: list('backgrounds.json'),
    feats: list('feats.json'),
    spells: list('spells.json'),
    weapons: list('weapons.json'),
    armor: list('armor.json'),
    masteries: list('masteries.json'),
    weaponProperties: list('weapon-properties.json'),
    glossary: list('glossary.json'),
    gear: list('gear.json'),
    slots: json('spell-slots.json'),
  }
}

const book = srdBook()
const rules = new Rules(book)
/** Las mismas reglas con una clase cambiada. */
const withClass = (cls: ClassData) => new Rules({ ...book, classes: book.classes.map((x) => (x.id === cls.id ? cls : x)) })

let n = 0
const item = (kind: 'arma' | 'armadura', id: string, equipped = true): Item => ({ id: `i${++n}`, name: id, qty: 1, ref: { kind, id }, equipped })
const weapons = (...ids: string[]) => ids.map((id) => item('arma', id))

/** Personaje mínimo: humano soldado sin dotes, con las puntuaciones que se pidan (10 el resto). */
function char(classId: string, level: number, scores: Partial<Record<Ability, number>>, equipment: Item[] = [], extra: Partial<Character> = {}): Character {
  return {
    schema: 1,
    id: 'prueba',
    name: 'Prueba',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    speciesId: 'humano',
    speciesChoices: {},
    backgroundId: 'soldado',
    baseScores: { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10, ...scores },
    backgroundBonus: {},
    classId,
    level,
    hpRolls: [],
    skills: [],
    expertise: [],
    tools: [],
    languages: [],
    choices: {},
    feats: [],
    weaponMasteries: [],
    spells: { cantrips: [], prepared: [], extra: [] },
    equipment,
    coins: { pc: 0, pp: 0, pe: 0, po: 0, ppt: 0 },
    customFeatures: [],
    overrides: {},
    persona: {},
    guide: [],
    notes: [],
    state: {
      hp: 1,
      tempHp: 0,
      hitDiceUsed: 0,
      slotsUsed: [],
      pactSlotsUsed: 0,
      resourcesUsed: {},
      conditions: [],
      exhaustion: 0,
      deathSaves: { success: 0, fail: 0 },
      heroicInspiration: false,
      toggles: {},
    },
    history: [],
    ...extra,
  }
}

const attackOf = (c: Character, name: string, r = rules) => {
  const a = derive(c, r).attacks.find((x) => x.name === name)
  if (!a) throw new Error(`No hay ataque «${name}»`)
  return a
}

describe('escudo', () => {
  it('sin entrenamiento no suma a la CA (mago con Destreza 14)', () => {
    const d = derive(char('mago', 1, { des: 14 }, [item('armadura', 'escudo')]), rules)
    expect(d.ac.value).toBe(12)
    expect(d.ac.parts).toContain('Escudo sin entrenamiento +0')
    expect(d.warnings.some((w) => /entrenamiento con escudos/.test(w.text))).toBe(true)
  })

  it('con entrenamiento suma +2 (guerrero sin armadura y mago con competencia extra)', () => {
    expect(derive(char('guerrero', 1, { des: 14 }, [item('armadura', 'escudo')]), rules).ac.value).toBe(14)
    const d = derive(char('mago', 1, { des: 14 }, [item('armadura', 'escudo')], { extraProficiencies: ['Escudos'] }), rules)
    expect(d.ac.value).toBe(14)
    expect(d.ac.parts).toContain('Escudo +2')
  })

  it('guardado en la mochila no cuenta', () => {
    expect(derive(char('guerrero', 1, { des: 14 }, [item('armadura', 'escudo', false)]), rules).ac.value).toBe(12)
  })
})

describe('Artes marciales del monje', () => {
  // Fuerza 10, Destreza 16: con armas de monje y sin armas usa la Destreza (+3)
  const monk = (level: number, equipment: Item[] = weapons('lanza', 'daga', 'espada-corta', 'garrote-grande')) => char('monje', level, { fue: 10, des: 16, sab: 14 }, equipment)
  const cases = [
    { level: 1, pb: 2, die: '1d6' },
    { level: 5, pb: 3, die: '1d8' },
    { level: 11, pb: 4, die: '1d10' },
    { level: 17, pb: 6, die: '1d12' },
  ]

  it.each(cases)('nivel $level: dado $die y Destreza con armas de monje y sin armas', ({ level, pb, die }) => {
    const c = monk(level)
    const hit = 3 + pb
    const spear = attackOf(c, 'Lanza')
    expect(spear.attack).toBe(hit)
    expect(spear.damage).toBe(`${die} + 3`)
    // A dos manos la lanza hace 1d8: se queda el mayor de los dos
    expect(spear.versatile).toBe(level === 1 ? '1d8 + 3' : `${die} + 3`)
    expect(attackOf(c, 'Daga').damage).toBe(`${die} + 3`)
    expect(attackOf(c, 'Espada corta').damage).toBe(`${die} + 3`)
    // El garrote grande (1d8) ya es mayor que el dado de nivel 1
    expect(attackOf(c, 'Garrote grande').damage).toBe(level === 1 ? '1d8 + 3' : `${die} + 3`)
    const unarmed = attackOf(c, 'Ataque sin armas')
    expect(unarmed.attack).toBe(hit)
    expect(unarmed.damage).toBe(`${die} + 3`)
  })

  it('nivel 5: lanza +6 y 1d8 + 3, con la explicación', () => {
    const spear = attackOf(monk(5), 'Lanza')
    expect([spear.attack, spear.damage]).toEqual([6, '1d8 + 3'])
    expect(spear.notes.join(' ')).toMatch(/Artes marciales: tiras 1d8 de daño y usas tu Destreza/)
  })

  it('sin modificador no pone «+ 0»', () => {
    expect(attackOf(char('monje', 1, {}), 'Ataque sin armas').damage).toBe('1d6')
  })

  it('las armas que no son de monje no cambian', () => {
    // Estoque: marcial sin Ligera (no es de monje ni tiene competencia); honda: a distancia
    const c = monk(5, weapons('estoque', 'honda'))
    const rapier = attackOf(c, 'Estoque')
    expect(rapier.damage).toBe('1d8 + 3') // Sutil: Destreza, pero su propio dado
    expect(rapier.proficient).toBe(false)
    expect(rapier.notes.join(' ')).not.toMatch(/Artes marciales/)
    expect(attackOf(c, 'Honda').damage).toBe('1d4 + 3')
  })

  it('con escudo o armadura pierde Artes marciales', () => {
    const c = monk(5, [...weapons('lanza'), item('armadura', 'escudo')])
    const spear = attackOf(c, 'Lanza')
    expect([spear.attack, spear.damage]).toEqual([3, '1d6'])
    const unarmed = attackOf(c, 'Ataque sin armas')
    expect([unarmed.attack, unarmed.damage]).toEqual([3, '1'])
    expect(unarmed.notes.join(' ')).toMatch(/pierdes Artes marciales/)
  })

  it('el ataque sin armas de otras clases es 1 + Fuerza', () => {
    const unarmed = attackOf(char('guerrero', 1, { fue: 16, des: 18 }), 'Ataque sin armas')
    expect([unarmed.attack, unarmed.damage]).toEqual([5, '4'])
  })
})

describe('competencia con armas marciales', () => {
  // 'ligeras' = marciales con Ligera (monje); 'sutiles-o-ligeras' = con Sutil o Ligera (pícaro).
  // Hasta que los datos del pícaro digan 'sutiles-o-ligeras', el test se lo pone a mano.
  const picaro = rules.cls('picaro')!
  const rogueRules =
    (picaro.weapons.martial as string | boolean) === 'sutiles-o-ligeras'
      ? rules
      : withClass({ ...picaro, weapons: { ...picaro.weapons, martial: 'sutiles-o-ligeras' as unknown as ClassData['weapons']['martial'] } })
  const prof = (classId: string, weapon: string, r = rules) => attackOf(char(classId, 1, { des: 16 }, weapons(weapon)), r.weapon(weapon)!.name, r).proficient

  it('los datos del monje dicen «ligeras»', () => {
    expect(rules.cls('monje')!.weapons.martial).toBe('ligeras')
  })

  it.each([
    ['estoque', false],
    ['latigo', false],
    ['espada-corta', true],
    ['cimitarra', true],
    ['ballesta-de-mano', true],
    ['espada-larga', false],
  ] as const)('monje con %s: %s', (weapon, expected) => {
    expect(prof('monje', weapon)).toBe(expected)
  })

  it.each([
    ['estoque', true],
    ['latigo', true],
    ['espada-corta', true],
    ['ballesta-de-mano', true],
    ['espada-larga', false],
  ] as const)('pícaro con %s: %s', (weapon, expected) => {
    expect(prof('picaro', weapon, rogueRules)).toBe(expected)
  })

  it('sin competencia no suma el bonificador', () => {
    const rapier = attackOf(char('monje', 1, { des: 16 }, weapons('estoque')), 'Estoque')
    expect(rapier.attack).toBe(3)
    expect(rapier.notes.join(' ')).toMatch(/Sin competencia/)
  })
})

describe('armas sutiles a distancia (dardos)', () => {
  it('usan la mejor de Fuerza y Destreza', () => {
    const strong = attackOf(char('guerrero', 1, { fue: 16, des: 8 }, weapons('dardo')), 'Dardo')
    expect([strong.attack, strong.damage]).toEqual([5, '1d4 + 3'])
    const nimble = attackOf(char('guerrero', 1, { fue: 8, des: 16 }, weapons('dardo')), 'Dardo')
    expect([nimble.attack, nimble.damage]).toEqual([5, '1d4 + 3'])
  })

  it('las de distancia sin Sutil siguen con Destreza', () => {
    const bow = attackOf(char('guerrero', 1, { fue: 16, des: 8 }, weapons('arco-corto')), 'Arco corto')
    expect([bow.attack, bow.damage]).toEqual([1, '1d6 − 1'])
  })
})

describe('cansancio', () => {
  const base = (exhaustion: number, extra: Partial<Character> = {}) => {
    const c = char('guerrero', 1, { fue: 16, des: 14, sab: 12 }, weapons('espada-larga', 'arco-largo'), { skills: ['percepcion', 'atletismo'], ...extra })
    return { ...c, state: { ...c.state, exhaustion } }
  }
  const fresh = derive(base(0), rules)
  const tired = derive(base(2), rules)

  it('dice el nivel y lo que resta', () => {
    expect(fresh.exhaustion).toEqual({ level: 0, d20: 0, speed: 0 })
    expect(tired.exhaustion).toEqual({ level: 2, d20: 4, speed: 3 })
  })

  it('resta 2 por nivel a salvaciones, habilidades, iniciativa y ataques', () => {
    for (const a of ['fue', 'des', 'con', 'int', 'sab', 'car'] as const) expect(tired.saves[a].bonus, a).toBe(fresh.saves[a].bonus - 4)
    for (const s of SKILLS) expect(tired.skills[s.id].bonus, s.id).toBe(fresh.skills[s.id].bonus - 4)
    expect(tired.initiative).toBe(fresh.initiative - 4)
    for (const a of fresh.attacks) {
      const t = tired.attacks.find((x) => x.name === a.name)!
      expect(t.attack, a.name).toBe(a.attack - 4)
      expect(t.damage, a.name).toBe(a.damage)
    }
  })

  it('resta 1,5 m de velocidad por nivel, sin bajar de 0', () => {
    expect(fresh.speed).toBe(9)
    expect(tired.speed).toBe(6)
    expect(derive(base(6), rules).speed).toBe(0)
  })

  it('no cambia la percepción pasiva, la CA ni los modificadores', () => {
    expect(tired.passivePerception).toBe(fresh.passivePerception)
    expect(tired.ac.value).toBe(fresh.ac.value)
    expect(tired.mods).toEqual(fresh.mods)
  })

  it('se resta también sobre los ajustes de la DM', () => {
    const d = derive(base(1, { overrides: { initiative: 5, speed: 12 } }), rules)
    expect(d.initiative).toBe(3)
    expect(d.speed).toBe(10.5)
  })
})

describe('conjuros en Turno', () => {
  const n = { dc: 13, attack: 5, mod: 3 }
  const card = (id: string, level = 1) => spellCard(rules.spell(id)!, level, n)

  it('ataque de conjuro con el daño del truco a cada nivel (5, 11 y 17)', () => {
    expect(card('rayo-de-escarcha', 1)).toMatchObject({ attack: 5, damage: { dice: '1d8', type: 'frío', extra: false } })
    expect(card('rayo-de-escarcha', 4)?.damage?.dice).toBe('1d8')
    expect(card('rayo-de-escarcha', 5)?.damage?.dice).toBe('2d8')
    expect(card('rayo-de-escarcha', 11)?.damage?.dice).toBe('3d8')
    expect(card('rayo-de-escarcha', 17)?.damage?.dice).toBe('4d8')
    // La frase del efecto lleva el dado del nivel, no el de nivel 1
    expect(card('rayo-de-escarcha', 5)?.effect).toMatch(/^Si acierta, el objetivo recibe 2d8 de daño de frío/)
  })

  it('salvación: CD y característica, y la mitad si la superan', () => {
    expect(card('llama-sagrada', 5)).toMatchObject({ save: { dc: 13, ability: 'Destreza' }, damage: { dice: '2d8', type: 'radiante' }, half: false })
    expect(card('bola-de-fuego')).toMatchObject({ save: { dc: 13, ability: 'Destreza' }, damage: { dice: '8d6', type: 'fuego' }, half: true })
    expect(card('ola-atronadora')?.half).toBe(true)
    expect(card('dormir')).toMatchObject({ save: { ability: 'Sabiduría' } })
    expect(card('dormir')?.damage).toBeUndefined()
  })

  it('daño con tu modificador, curación y daño extra', () => {
    expect(card('arma-espiritual')).toMatchObject({ attack: 5, damage: { dice: '1d8 + 3', type: 'fuerza' } })
    expect(card('palabra-de-curacion')?.heal).toBe('2d4 + 3')
    expect(card('castigo-divino')).toMatchObject({ damage: { dice: '2d8', type: 'radiante', extra: true } })
    expect(card('proyectil-magico')).toBeUndefined() // sin tirada ni salvación: chip
  })

  it('Descarga sobrenatural: rayos a los niveles 5, 11 y 17', () => {
    expect(card('descarga-sobrenatural', 1)?.beams).toBeUndefined()
    expect(card('descarga-sobrenatural', 5)?.beams).toBe(2)
    expect(card('descarga-sobrenatural', 17)).toMatchObject({ beams: 4, damage: { dice: '1d10' } })
  })

  it('el daño de algo secundario no sale como daño del conjuro', () => {
    // Telaraña: salvación de Destreza; los 2d4 de fuego son si la telaraña arde
    expect(card('telarana')).toMatchObject({ save: { ability: 'Destreza' } })
    expect(card('telarana')?.damage).toBeUndefined()
  })

  it('«ventaja en las tiradas de salvación» no es una salvación del objetivo', () => {
    expect(card('acelerar')).toBeUndefined()
  })

  it('los conjuros sin cifras quedan como chip', () => {
    for (const id of ['detectar-magia', 'luz', 'armadura-de-mago']) expect(card(id), id).toBeUndefined()
  })
})
