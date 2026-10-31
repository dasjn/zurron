// Tests de la partida con personajes de prueba hechos solo con el SRD: daño y PG
// temporales, 0 PG (salvaciones contra muerte, críticos, muerte instantánea),
// curación, descansos, Ingenioso, rasgos que curan, conjuros gratis de dotes y
// especie, avisos de conjuros y claves de la lista de rasgos.

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Ability } from '../data/types'
import type { Character, CharacterFeat, PlayState } from '../model/character'
import { Rules, type RuleBook } from './book'
import { derive, spellNumbers } from './derive'
import {
  LAY_ON_HANDS,
  SECOND_WIND,
  applyDamage,
  canRest,
  castFree,
  concentrationDc,
  deathSave,
  freeCast,
  heal,
  isDead,
  isStable,
  layOnHands,
  longRest,
  secondWind,
  setHp,
  setTempHp,
  shortRest,
  spendHitDie,
  takeDamage,
} from './rests'

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

const rules = new Rules(srdBook())

/** Personaje mínimo: soldado sin dotes, con 10 en todo salvo lo que se pida y los PG al máximo. */
function char(classId: string, level: number, p: Partial<Character> & { scores?: Partial<Record<Ability, number>>; play?: Partial<PlayState> } = {}): Character {
  const { scores, play, ...rest } = p
  const c: Character = {
    schema: 1,
    id: 'prueba',
    name: 'Prueba',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    speciesId: 'enano',
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
    equipment: [],
    coins: { pc: 0, pp: 0, pe: 0, po: 0, ppt: 0 },
    customFeatures: [],
    overrides: {},
    persona: {},
    guide: [],
    notes: [],
    state: { hp: 0, tempHp: 0, hitDiceUsed: 0, slotsUsed: [], pactSlotsUsed: 0, resourcesUsed: {}, conditions: [], exhaustion: 0, deathSaves: { success: 0, fail: 0 }, heroicInspiration: false, toggles: {} },
    history: [],
    ...rest,
  }
  const d = derive(c, rules)
  return { ...c, state: { ...c.state, hp: d.maxHp, ...play } }
}

/** Guerrero de nivel 1 con Con 10: 10 PG máximos (un enano suma 1 por nivel: 11). */
const fighter = (play: Partial<PlayState> = {}) => char('guerrero', 1, { speciesId: 'humano', play })

describe('daño y PG temporales', () => {
  it('los PG temporales no se suman: te quedas con el valor más alto', () => {
    let c = fighter({ tempHp: 10 })
    c = setTempHp(c, 12)
    expect(c.state.tempHp).toBe(12)
    c = setTempHp(c, 5)
    expect(c.state.tempHp).toBe(12)
  })

  it('el daño se come primero los temporales', () => {
    const c = fighter({ tempHp: 5 })
    const d = derive(c, rules)
    const r = applyDamage(c, d, 7)
    expect(r.fromTemp).toBe(5)
    expect(r.lost).toBe(2)
    expect(r.next.state).toMatchObject({ tempHp: 0, hp: d.maxHp - 2 })
  })

  it('caer a 0 PG no suma fallos y rompe la concentración', () => {
    const c = fighter({ hp: 4, concentration: 'escudo-de-fe' })
    const d = derive(c, rules)
    const r = applyDamage(c, d, 6)
    expect(r.next.state.hp).toBe(0)
    expect(r.next.state.deathSaves).toEqual({ success: 0, fail: 0 })
    expect(r.instantDeath).toBe(false)
    expect(r.droppedConcentration).toBe('escudo-de-fe')
    expect(r.next.state.concentration).toBeUndefined()
  })

  it('la CD de concentración es 10 o la mitad del daño, hasta 30', () => {
    expect(concentrationDc(7)).toBe(10)
    expect(concentrationDc(23)).toBe(11)
    expect(concentrationDc(90)).toBe(30)
  })
})

describe('0 PG: salvaciones contra muerte', () => {
  it('cada daño a 0 PG es un fallo; un crítico, dos', () => {
    let c = fighter({ hp: 0 })
    const d = derive(c, rules)
    c = takeDamage(c, d, 3)
    expect(c.state.deathSaves.fail).toBe(1)
    c = takeDamage(c, d, 3, true)
    expect(c.state.deathSaves.fail).toBe(3)
    expect(isDead(c.state)).toBe(true)
  })

  it('muerte instantánea: lo que sobra al caer a 0 iguala o supera los PG máximos', () => {
    const c = fighter({ hp: 6 })
    const d = derive(c, rules)
    expect(applyDamage(c, d, 6 + d.maxHp - 1).instantDeath).toBe(false)
    const r = applyDamage(c, d, 6 + d.maxHp)
    expect(r.instantDeath).toBe(true)
    expect(r.died).toBe(true)
    expect(isDead(r.next.state)).toBe(true)
  })

  it('muerte instantánea a 0 PG: un daño igual o mayor que los PG máximos', () => {
    const c = fighter({ hp: 0 })
    const d = derive(c, rules)
    expect(applyDamage(c, d, d.maxHp - 1).instantDeath).toBe(false)
    expect(applyDamage(c, d, d.maxHp).instantDeath).toBe(true)
  })

  it('estable con tres éxitos; un daño lo saca de ahí y la cuenta vuelve a empezar', () => {
    let c = fighter({ hp: 0, deathSaves: { success: 2, fail: 1 } })
    const d = derive(c, rules)
    c = deathSave(c, 12)
    expect(isStable(c.state)).toBe(true)
    expect(deathSave(c, 3)).toBe(c) // estable: ya no tira
    c = takeDamage(c, d, 1)
    expect(isStable(c.state)).toBe(false)
    expect(c.state.deathSaves).toEqual({ success: 0, fail: 1 })
  })

  it('un 1 son dos fallos y un 20 te devuelve a 1 PG', () => {
    const c = fighter({ hp: 0, deathSaves: { success: 1, fail: 0 } })
    expect(deathSave(c, 1).state.deathSaves).toEqual({ success: 1, fail: 2 })
    expect(deathSave(c, 9).state.deathSaves).toEqual({ success: 1, fail: 1 })
    const up = deathSave(c, 20)
    expect(up.state.hp).toBe(1)
    expect(up.state.deathSaves).toEqual({ success: 0, fail: 0 })
  })

  it('el cansancio resta a la salvación, pero el 1 y el 20 cuentan por el dado', () => {
    const c = fighter({ hp: 0 })
    expect(deathSave(c, 11, 2).state.deathSaves).toEqual({ success: 0, fail: 1 })
    expect(deathSave(c, 12, 2).state.deathSaves).toEqual({ success: 1, fail: 0 })
    expect(deathSave(c, 20, 6).state.hp).toBe(1)
  })

  it('a quien ha muerto el daño ya no le cambia nada', () => {
    const c = fighter({ hp: 0, deathSaves: { success: 0, fail: 3 } })
    expect(takeDamage(c, derive(c, rules), 5)).toBe(c)
  })
})

describe('curación y PG a mano', () => {
  it('curar cuenta desde 0, nunca desde PG negativos', () => {
    const c = fighter({ hp: -5, deathSaves: { success: 1, fail: 2 } })
    const d = derive(c, rules)
    const healed = heal(c, d, 1)
    expect(healed.state.hp).toBe(1)
    expect(healed.state.deathSaves).toEqual({ success: 0, fail: 0 })
    expect(heal(c, d, 100).state.hp).toBe(d.maxHp)
  })

  it('escribir los PG ignora lo que no es un número y borra la cuenta al levantarte', () => {
    const c = fighter({ hp: 0, deathSaves: { success: 1, fail: 1 } })
    const d = derive(c, rules)
    expect(setHp(c, d, Number.NaN)).toBe(c)
    expect(setHp(c, d, 3).state).toMatchObject({ hp: 3, deathSaves: { success: 0, fail: 0 } })
    expect(setHp(c, d, 999).state.hp).toBe(d.maxHp)
  })
})

describe('descansos', () => {
  it('sin al menos 1 PG no se puede descansar', () => {
    const c = fighter({ hp: 0, hitDiceUsed: 1, resourcesUsed: { [SECOND_WIND]: 2 } })
    const d = derive(c, rules)
    expect(canRest(c)).toBe(false)
    expect(longRest(c, d)).toBe(c)
    expect(shortRest(c, d)).toBe(c)
    expect(spendHitDie(c, d, 6)).toBe(c)
  })

  it('el descanso largo lo deja todo a tope', () => {
    const c = fighter({ hp: 1, tempHp: 4, hitDiceUsed: 1, exhaustion: 2, resourcesUsed: { [SECOND_WIND]: 2 }, concentration: 'escudo-de-fe' })
    const d = derive(c, rules)
    const s = longRest(c, d).state
    expect(s).toMatchObject({ hp: d.maxHp, tempHp: 0, hitDiceUsed: 0, exhaustion: 1, resourcesUsed: {} })
    expect(s.concentration).toBeUndefined()
  })

  it('Ingenioso (humano): Inspiración heroica al terminar el descanso largo', () => {
    const human = fighter({ hp: 3 })
    expect(longRest(human, derive(human, rules)).state.heroicInspiration).toBe(true)
    const dwarf = char('guerrero', 1, { play: { hp: 3 } })
    expect(longRest(dwarf, derive(dwarf, rules)).state.heroicInspiration).toBe(false)
  })
})

describe('rasgos que curan', () => {
  it('Tomar aliento gasta un uso y cura 1d10 + nivel de guerrero', () => {
    const c = char('guerrero', 3, { speciesId: 'humano', play: { hp: 5 } })
    const d = derive(c, rules)
    const next = secondWind(c, d, 6)!
    expect(next.state.hp).toBe(5 + 6 + 3)
    expect(next.state.resourcesUsed[SECOND_WIND]).toBe(1)
    const spent = { ...c, state: { ...c.state, resourcesUsed: { [SECOND_WIND]: 2 } } }
    expect(secondWind(spent, derive(spent, rules), 6)).toBeUndefined()
  })

  it('Imponer las manos: reserva de 5 × nivel; a ti te cura, a otro solo gasta', () => {
    const c = char('paladin', 2, { play: { hp: 4 } })
    const d = derive(c, rules)
    expect(d.resources.find((r) => r.key === LAY_ON_HANDS)?.max).toBe(10)
    const self = layOnHands(c, d, 3, true)!
    expect(self.state.hp).toBe(7)
    expect(self.state.resourcesUsed[LAY_ON_HANDS]).toBe(3)
    const other = layOnHands(c, d, 15, false)!
    expect(other.state.hp).toBe(4)
    expect(other.state.resourcesUsed[LAY_ON_HANDS]).toBe(10)
    expect(layOnHands(other, derive(other, rules), 1, true)).toBeUndefined()
  })
})

describe('conjuros de dotes y especie', () => {
  const initiate: CharacterFeat = { id: 'iniciado-en-la-magia', source: 'trasfondo', choices: { lista: ['clerigo'] } }
  const withInitiate = () =>
    char('guerrero', 1, {
      speciesId: 'humano',
      scores: { sab: 14 },
      feats: [initiate],
      spells: { cantrips: [], prepared: [], extra: [{ id: 'santuario', source: 'dote:iniciado-en-la-magia', ability: 'sab', freeCast: 'largo' }] },
    })

  it('el uso gratis lleva el nombre del conjuro y se gasta al lanzarlo', () => {
    const c = withInitiate()
    const d = derive(c, rules)
    const r = freeCast(d, 'santuario')
    expect(r).toMatchObject({ name: 'Santuario gratis', max: 1, recharge: 'largo', origin: 'dote' })
    // El recurso genérico de la dote ya no sale
    expect(d.resources.some((x) => x.name === 'Conjuro de nivel 1 sin espacio')).toBe(false)
    const cast = castFree(c, d, 'santuario')!
    expect(cast.state.resourcesUsed[r!.key]).toBe(1)
    expect(castFree(cast, derive(cast, rules), 'santuario')).toBeUndefined()
    expect(longRest(cast, derive(cast, rules)).state.resourcesUsed[r!.key] ?? 0).toBe(0)
  })

  it('gnomo de los bosques: Hablar con los animales gratis tantas veces como su bonificador; el de las rocas no lo tiene', () => {
    const forest = char('mago', 1, {
      speciesId: 'gnomo',
      speciesChoices: { 'gnomo-linaje-gnomo': 'gnomo-de-los-bosques' },
      spells: { cantrips: [], prepared: [], extra: [{ id: 'hablar-con-los-animales', source: 'especie:gnomo-de-los-bosques', ability: 'int', freeCast: 'largo' }] },
    })
    const fd = derive(forest, rules)
    expect(fd.resources.filter((r) => /hablar con los animales/i.test(r.name))).toEqual([expect.objectContaining({ name: 'Hablar con los animales gratis', max: 2, origin: 'especie' })])
    const rock = char('mago', 1, { speciesId: 'gnomo', speciesChoices: { 'gnomo-linaje-gnomo': 'gnomo-de-las-rocas' } })
    expect(derive(rock, rules).resources.some((r) => /hablar con los animales/i.test(r.name))).toBe(false)
  })

  it('CD y ataque de un conjuro de dote con su propia aptitud', () => {
    const c = withInitiate()
    const d = derive(c, rules)
    // Sab 14 (+2) y bonificador +2
    expect(spellNumbers(d, 'sab')).toEqual({ dc: 12, attack: 4 })
    // El cansancio baja el ataque mágico, no la CD
    const tired = { ...c, state: { ...c.state, exhaustion: 1 } }
    expect(spellNumbers(derive(tired, rules), 'sab')).toEqual({ dc: 12, attack: 2 })
  })
})

describe('avisos y listas', () => {
  const warningsOf = (c: Character) => derive(c, rules).warnings.map((w) => w.text)

  it('singular y plural en los avisos de conjuros', () => {
    const wizard = char('mago', 1)
    const d = derive(wizard, rules)
    const cantrips = d.spell!.cantripsMax
    const prepared = d.spell!.preparedMax
    const pool = rules.book.spells.filter((s) => s.classes.includes('mago'))
    const someCantrips = pool.filter((s) => s.level === 0).map((s) => s.id)
    const someSpells = pool.filter((s) => s.level === 1).map((s) => s.id)
    const one = { ...wizard, spells: { cantrips: someCantrips.slice(0, cantrips - 1), prepared: someSpells.slice(0, prepared - 1), extra: [] } }
    expect(warningsOf(one)).toEqual(expect.arrayContaining(['Te falta 1 truco por elegir.', 'Puedes preparar 1 conjuro más.']))
    const two = { ...wizard, spells: { cantrips: someCantrips.slice(0, cantrips - 2), prepared: someSpells.slice(0, prepared - 2), extra: [] } }
    expect(warningsOf(two)).toEqual(expect.arrayContaining(['Te faltan 2 trucos por elegir.', 'Puedes preparar 2 conjuros más.']))
  })

  it('las claves de los rasgos no se repiten aunque una dote salga dos veces', () => {
    const c = char('guerrero', 8, {
      feats: [
        { id: 'mejora-de-caracteristica', source: 'nivel-4', abilityIncrease: { fue: 2 } },
        { id: 'mejora-de-caracteristica', source: 'nivel-6', abilityIncrease: { con: 2 } },
      ],
    })
    const keys = derive(c, rules).features.map((f) => f.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
