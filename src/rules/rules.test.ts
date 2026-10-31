// Tests del motor con los datos del SRD y personajes de prueba hechos con el
// creador (cifras comprobadas a mano). Los que dependen de las fichas del grupo
// o del contenido de la mesa están en esas carpetas, fuera de git.

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Character } from '../model/character'
import { Rules, type RuleBook } from './book'
import { CLASS_IDS, FEAT, SKILLS } from './constants'
import { buildCharacter, emptyDraft, fillAll, recommendedBackground, recommendedSpecies, type Draft } from './create'
import { derive, hpBonusPerLevel } from './derive'
import { applyLevelUp, emptyInput, planLevelUp, undoLevelUp } from './levelup'
import { longRest, shortRest, spendHitDie, takeDamage, heal, setResourceUsed, setTempHp, spendSlot } from './rests'

const DATA = resolve(__dirname, '../data')
const json = (p: string) => JSON.parse(readFileSync(resolve(DATA, p), 'utf8'))

/** Libro de reglas: el SRD y, si `mesa`, lo que haya en src/data/mesa. */
function loadBook(mesa: boolean): Rules {
  const list = (name: string) => [
    ...(existsSync(resolve(DATA, 'srd', name)) ? json(`srd/${name}`) : []),
    ...(mesa && existsSync(resolve(DATA, 'mesa', name)) ? json(`mesa/${name}`) : []),
  ]
  const book: RuleBook = {
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
    slots: json('srd/spell-slots.json'),
  }
  return new Rules(book)
}

// Solo el SRD: estos tests dan lo mismo en CI que con la mesa en local.
const rules = loadBook(false)

const NOW = '2026-10-31T00:00:00.000Z'
/** Personaje de nivel 1 hecho con el creador y lo recomendado en lo que no se diga. */
function make(p: Partial<Draft>): Character {
  return buildCharacter(fillAll({ ...emptyDraft(), name: 'Prueba', ...p }, rules), rules, { now: NOW })
}
/** Sube de nivel con lo mínimo (media de PG, primera subclase si toca). */
function levelTo(c: Character, level: number): Character {
  while (c.level < level) {
    const plan = planLevelUp(c, rules)!
    c = applyLevelUp(c, rules, { ...emptyInput(c), subclassId: plan.needsSubclass ? plan.subclassOptions[0].id : undefined }, [])
  }
  return c
}
const at = (c: Character, patch: Partial<Character['state']>): Character => ({ ...c, state: { ...c.state, ...patch } })

describe('datos', () => {
  it('tiene las 12 clases con tablas de 20 niveles', () => {
    expect(rules.book.classes.map((c) => c.id).sort()).toEqual([...CLASS_IDS].sort())
    for (const c of rules.book.classes) {
      for (const col of c.columns) expect(col.values, `${c.id}/${col.key}`).toHaveLength(20)
      if (c.spellcasting) {
        expect(c.spellcasting.cantrips).toHaveLength(20)
        expect(c.spellcasting.prepared).toHaveLength(20)
      }
    }
  })

  it('las ids de dotes que usa el motor existen', () => {
    // Duelo no está en el SRD: el motor la sabe usar si la mesa (o una copia) la trae.
    const missing = Object.values(FEAT).filter((id) => !rules.feat(id))
    expect(missing).toEqual([FEAT.duelo])
  })

  it('las listas de conjuros de clase apuntan a conjuros que existen', () => {
    const missing = rules.book.classes.flatMap((c) => (c.spellList ?? []).filter((id) => !rules.spell(id)).map((id) => `${c.id}:${id}`))
    expect(missing).toEqual([])
  })

  it('tabla de espacios de lanzador completo (2024)', () => {
    const t = rules.book.slots.completo
    const row = (l: number) => t[l - 1].filter((n) => n > 0)
    expect(row(1)).toEqual([2])
    expect(row(3)).toEqual([4, 2])
    expect(row(5)).toEqual([4, 3, 2])
    expect(row(9)).toEqual([4, 3, 3, 3, 1])
    expect(row(17)).toEqual([4, 3, 3, 3, 2, 1, 1, 1, 1])
    expect(row(20)).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1])
  })

  it('medio lanzador = lanzador completo a la mitad del nivel (redondeando hacia arriba)', () => {
    for (let l = 1; l <= 20; l++) expect(rules.book.slots.medio[l - 1], `nivel ${l}`).toEqual(rules.book.slots.completo[Math.ceil(l / 2) - 1])
  })

  it('magia de pacto', () => {
    const p = rules.book.slots.pacto
    expect(p.slots.slice(0, 3)).toEqual([1, 2, 2])
    expect(p.slots[10]).toBe(3)
    expect(p.slots[16]).toBe(4)
    expect(p.slotLevel.slice(0, 9)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5])
  })
})

describe('reglas concretas', () => {
  // Guerrero humano soldado: Fue 17, Des 15, Con 14; cota de malla y Defensa (CA 17); 11 PG.
  const guerrero = make({ classId: 'guerrero', backgroundId: 'soldado', speciesId: 'humano' })

  it('bardo nivel 2: Aprendiz de mucho suma la mitad de competencia a lo no competente', () => {
    const bardo = make({ classId: 'bardo', backgroundId: 'criminal', speciesId: 'enano' })
    const d1 = derive(bardo, rules)
    const d2 = derive({ ...bardo, level: 2, hpRolls: [null] }, rules)
    const unskilled = SKILLS.filter((s) => !bardo.skills.includes(s.id))
    expect(unskilled.length).toBeGreaterThan(0)
    for (const s of unskilled) {
      expect(d1.skills[s.id].half, s.id).toBe(false)
      expect(d2.skills[s.id], s.id).toMatchObject({ half: true, bonus: d1.skills[s.id].bonus + 1 })
    }
    // A lo que ya es competente no le suma nada más.
    const skilled = bardo.skills.find((s) => !bardo.expertise.includes(s))!
    expect(d2.skills[skilled].bonus).toBe(d1.skills[skilled].bonus)
    // Otras clases no lo tienen.
    expect(derive({ ...guerrero, level: 2, hpRolls: [null] }, rules).skills.historia.half).toBe(false)
  })

  it('la armadura pesada no resta la Destreza negativa', () => {
    const base = derive(guerrero, rules)
    expect(base.ac.value).toBe(17) // cota de malla 16 + Defensa 1
    const clumsy = { ...guerrero, baseScores: { ...guerrero.baseScores, des: 6 }, backgroundBonus: { ...guerrero.backgroundBonus, des: 0 } }
    const d = derive(clumsy, rules)
    expect(d.mods.des).toBe(-2)
    expect(d.ac.value).toBe(17)
    // Sin armadura, la Destreza negativa sí resta: 10 − 2.
    const naked = { ...clumsy, equipment: clumsy.equipment.map((i) => ({ ...i, equipped: false })) }
    expect(derive(naked, rules).ac.value).toBe(8)
  })

  it('elfo de los bosques: velocidad 10,5 m', () => {
    const elf = make({ classId: 'explorador', backgroundId: 'soldado', speciesId: 'elfo' })
    const lineage = (id: string) => ({ ...elf, speciesChoices: { ...elf.speciesChoices, 'elfo-linaje-elfico': id } })
    expect(derive(lineage('elfo-de-los-bosques'), rules).speed).toBe(10.5)
    expect(derive(lineage('drow'), rules).speed).toBe(9)
    expect(derive(lineage('alto-elfo'), rules).speed).toBe(9)
  })

  it('clérigo Taumaturgo: + Sabiduría (mínimo +1) a Arcanos y Religión', () => {
    const cleric = make({ classId: 'clerigo', backgroundId: 'soldado', speciesId: 'humano', classChoices: { 'clerigo-orden-divina': ['taumaturgo'] } })
    expect(cleric.choices['clerigo-orden-divina']).toEqual(['taumaturgo'])
    const d = derive(cleric, rules)
    const plain = derive({ ...cleric, choices: { ...cleric.choices, 'clerigo-orden-divina': ['protector'] } }, rules)
    const wis = Math.max(1, d.mods.sab)
    expect(wis).toBeGreaterThan(1) // Sab 15+: se nota que no es el mínimo
    expect(d.skills.religion.bonus).toBe(plain.skills.religion.bonus + wis)
    expect(d.skills.arcanos.bonus).toBe(plain.skills.arcanos.bonus + wis)
    expect(d.skills.historia.bonus).toBe(plain.skills.historia.bonus)
    // Con Sabiduría baja, el mínimo es +1.
    const low = { ...cleric, baseScores: { ...cleric.baseScores, sab: 8 } }
    const lowPlain = { ...low, choices: { ...low.choices, 'clerigo-orden-divina': ['protector'] } }
    expect(derive(low, rules).mods.sab).toBeLessThan(1)
    expect(derive(low, rules).skills.religion.bonus).toBe(derive(lowPlain, rules).skills.religion.bonus + 1)
  })

  it('guerrero nivel 2 → 3 pide subclase', () => {
    expect(planLevelUp(guerrero, rules)!.needsSubclass).toBe(false)
    const lvl2 = levelTo(guerrero, 2)
    const plan = planLevelUp(lvl2, rules)!
    expect(plan.to).toBe(3)
    expect(plan.needsSubclass).toBe(true)
    expect(plan.subclassOptions.map((s) => s.id)).toContain('campeon')
  })

  it('nivel 4 pide dote o mejora de característica', () => {
    const lvl3 = levelTo(guerrero, 3)
    expect(lvl3.subclassId).toBe('campeon')
    expect(planLevelUp(lvl3, rules)!.choices.some((x) => x.choice.kind === 'dote')).toBe(true)
    expect(planLevelUp(levelTo(guerrero, 2), rules)!.choices.some((x) => x.choice.kind === 'dote')).toBe(false)
  })

  it('la mejora de característica suma a la puntuación, sin pasar de 20', () => {
    const lvl3 = levelTo(guerrero, 3)
    const asi = (abilityIncrease: Record<string, number>, source = 'nivel-4') => ({ id: FEAT.mejoraCaracteristica, source, abilityIncrease })
    const next = applyLevelUp(lvl3, rules, { ...emptyInput(lvl3), feats: [asi({ fue: 2 })] }, [])
    const d = derive(next, rules)
    expect(d.scores.fue).toBe(derive(lvl3, rules).scores.fue + 2) // 17 → 19
    expect(d.warnings.filter((w) => w.kind === 'error')).toEqual([])
    // Otra +2 a Fuerza la pasaría de 20: es un error de la ficha.
    const over = { ...next, feats: [...next.feats, asi({ fue: 2 }, 'nivel-6')] }
    expect(derive(over, rules).warnings.some((w) => w.kind === 'error' && /máximo de 20/.test(w.text))).toBe(true)
  })

  it('cada clase sube a nivel 2 y se puede deshacer', () => {
    for (const classId of CLASS_IDS) {
      const c = make({ classId, backgroundId: recommendedBackground(rules, classId), speciesId: recommendedSpecies(rules, classId) })
      const d = derive(c, rules)
      const plan = planLevelUp(c, rules)
      expect(plan?.to, classId).toBe(2)
      const next = applyLevelUp(c, rules, emptyInput(c), ['test'])
      expect(next.level, classId).toBe(2)
      const after = derive(next, rules)
      // PG: media del dado de golpe + Con (+ lo que den especie o dotes por nivel, como la Dureza enana).
      expect(after.maxHp - d.maxHp, classId).toBe(Math.max(1, plan!.hpAverage + d.mods.con) + hpBonusPerLevel(c, d.featIds, rules))
      expect(next.state.hp - c.state.hp, classId).toBe(after.maxHp - d.maxHp)
      expect(next.history, classId).toHaveLength(1)
      const back = undoLevelUp(next)!
      expect(back.level, classId).toBe(1)
      expect(back.history, classId).toHaveLength(0)
      expect(derive(back, rules).maxHp, classId).toBe(d.maxHp)
    }
  })

  it('deshacer la subida conserva lo que cambiaste después', () => {
    const next = levelTo(guerrero, 2)
    const dNext = derive(next, rules)
    // Después de subir: partida, notas, equipo y nombre.
    let edited = takeDamage(next, dNext, 3)
    edited = {
      ...edited,
      name: 'Otro nombre',
      notes: [{ id: 'n1', date: '2026-10-31', title: 'Sesión 2', body: 'Cruzamos el puente.' }],
      coins: { ...edited.coins, po: edited.coins.po + 50 },
      equipment: [...edited.equipment, { id: 'cuerda', name: 'Cuerda', qty: 1 }],
      persona: { ...edited.persona, appearance: 'Una cicatriz nueva' },
      state: { ...edited.state, conditions: ['envenenado'], heroicInspiration: false },
    }
    expect(edited.state.hp).toBe(dNext.maxHp - 3)
    const back = undoLevelUp(edited)!
    // Vuelve lo de la subida...
    expect(back.level).toBe(1)
    expect(back.history).toHaveLength(0)
    const dBack = derive(back, rules)
    expect(dBack.maxHp).toBe(derive(guerrero, rules).maxHp)
    // ...pero lo de después se queda.
    expect(back.name).toBe('Otro nombre')
    expect(back.notes).toEqual(edited.notes)
    expect(back.coins).toEqual(edited.coins)
    expect(back.equipment).toEqual(edited.equipment)
    expect(back.persona).toEqual(edited.persona)
    expect(back.state.conditions).toEqual(['envenenado'])
    expect(back.state.heroicInspiration).toBe(false)
    // Los PG no pasan del máximo de nivel 1 ni se curan solos.
    expect(back.state.hp).toBeGreaterThanOrEqual(0)
    expect(back.state.hp).toBeLessThanOrEqual(dBack.maxHp)
    expect(back.state.hp).toBeLessThanOrEqual(edited.state.hp)
  })
})

describe('daño, curación y descansos (reglas de 2024)', () => {
  // Guerrero humano soldado de nivel 3: 25 PG, 3d10 de golpe, Con +1.
  // Tomar aliento: 2 usos, recupera 1 con descanso corto. Acción súbita: 1 uso, descanso corto.
  const g = levelTo(make({ classId: 'guerrero', backgroundId: 'soldado', speciesId: 'humano' }), 3)
  const d = derive(g, rules)
  const res = (name: string) => {
    const r = d.resources.find((x) => x.name === name)
    expect(r, name).toBeDefined()
    return r!
  }

  it('el personaje de prueba es el que esperamos', () => {
    expect(d.maxHp).toBe(25) // 10 + 1 (nivel 1) + 2 × (6 + 1)
    expect(d.hitDie).toBe(10)
    expect(d.mods.con).toBe(1)
    expect(res('Tomar aliento')).toMatchObject({ max: 2, recharge: 'corto-uno' })
    expect(res('Acción súbita')).toMatchObject({ max: 1, recharge: 'corto' })
  })

  it('el daño gasta primero los PG temporales', () => {
    let c = at(g, { hp: 25, tempHp: 3 })
    c = takeDamage(c, d, 5)
    expect(c.state).toMatchObject({ tempHp: 0, hp: 23 })
    c = takeDamage(at(c, { tempHp: 10 }), d, 4)
    expect(c.state).toMatchObject({ tempHp: 6, hp: 23 })
    // Nunca baja de 0 ni cuenta daño negativo.
    expect(takeDamage(at(g, { hp: 5, tempHp: 0 }), d, 12).state.hp).toBe(0)
    expect(takeDamage(at(g, { hp: 5, tempHp: 0 }), d, -3).state.hp).toBe(5)
  })

  it('los PG temporales no se suman: te quedas con los más altos', () => {
    const c = at(g, { tempHp: 8 })
    expect(setTempHp(c, 5).state.tempHp).toBe(8)
    expect(setTempHp(c, 12).state.tempHp).toBe(12)
    expect(setTempHp(at(g, { tempHp: 0 }), 4).state.tempHp).toBe(4)
  })

  it('la curación no pasa del máximo y a 0 PG te levanta y borra las salvaciones', () => {
    expect(heal(at(g, { hp: 20 }), d, 100).state.hp).toBe(25)
    const down = at(g, { hp: 0, deathSaves: { success: 2, fail: 1 } })
    const up = heal(down, d, 4)
    expect(up.state.hp).toBe(4)
    expect(up.state.deathSaves).toEqual({ success: 0, fail: 0 })
  })

  it('daño con 0 PG: cada golpe es un fallo de salvación contra muerte; un crítico, dos', () => {
    const down = at(g, { hp: 0, tempHp: 0, deathSaves: { success: 1, fail: 0 } })
    const hit = takeDamage(down, d, 3)
    expect(hit.state.hp).toBe(0)
    expect(hit.state.deathSaves).toEqual({ success: 1, fail: 1 })
    const crit = takeDamage(down, d, 3, true)
    expect(crit.state.deathSaves).toEqual({ success: 1, fail: 2 })
    // No pasa de tres fallos.
    expect(takeDamage(takeDamage(crit, d, 2, true), d, 2).state.deathSaves.fail).toBe(3)
    // Con PG, el daño no toca las salvaciones.
    expect(takeDamage(at(g, { hp: 10, deathSaves: { success: 0, fail: 0 } }), d, 3).state.deathSaves).toEqual({ success: 0, fail: 0 })
  })

  it('muerte instantánea: el daño que sobra al caer a 0 iguala o supera los PG máximos', () => {
    // 5 PG y 30 de daño: sobran 25, que son sus PG máximos.
    expect(takeDamage(at(g, { hp: 5, tempHp: 0 }), d, 30).state.deathSaves.fail).toBe(3)
    // Si sobra uno menos, solo cae inconsciente.
    expect(takeDamage(at(g, { hp: 5, tempHp: 0 }), d, 29).state).toMatchObject({ hp: 0, deathSaves: { success: 0, fail: 0 } })
    // Ya a 0 PG, un golpe de 25 o más también mata.
    expect(takeDamage(at(g, { hp: 0, deathSaves: { success: 0, fail: 0 } }), d, 25).state.deathSaves.fail).toBe(3)
  })

  it('dados de golpe: tirada + Constitución, mínimo 1, hasta el nivel', () => {
    let c = at(g, { hp: 10, hitDiceUsed: 0 })
    c = spendHitDie(c, d, 6)
    expect(c.state).toMatchObject({ hitDiceUsed: 1, hp: 17 })
    const weak = { ...d, mods: { ...d.mods, con: -3 } }
    expect(spendHitDie(at(g, { hp: 10, hitDiceUsed: 0 }), weak, 1).state.hp).toBe(11)
    // No pasa del máximo ni gasta dados que no tiene.
    expect(spendHitDie(at(g, { hp: 24, hitDiceUsed: 0 }), d, 10).state.hp).toBe(25)
    const spent = at(g, { hp: 10, hitDiceUsed: 3 })
    expect(spendHitDie(spent, d, 10).state).toEqual(spent.state)
  })

  it('descanso corto: recarga lo de descanso corto y uno de Tomar aliento', () => {
    const aliento = res('Tomar aliento')
    const subita = res('Acción súbita')
    let c = setResourceUsed(g, aliento.key, 2, aliento.max)
    c = setResourceUsed(c, subita.key, 1, subita.max)
    c = at(c, { hp: 12, hitDiceUsed: 1 })
    c = shortRest(c, d)
    expect(c.state.resourcesUsed[subita.key]).toBe(0)
    expect(c.state.resourcesUsed[aliento.key]).toBe(1)
    // El descanso corto no cura solo ni devuelve dados de golpe.
    expect(c.state).toMatchObject({ hp: 12, hitDiceUsed: 1 })
  })

  it('descanso largo: todo a tope, cansancio −1 y fuera los PG temporales', () => {
    const aliento = res('Tomar aliento')
    let c = setResourceUsed(g, aliento.key, 2, aliento.max)
    c = at(c, { hp: 7, tempHp: 5, hitDiceUsed: 3, exhaustion: 2, deathSaves: { success: 1, fail: 1 } })
    c = longRest(c, d)
    expect(c.state).toMatchObject({ hp: 25, tempHp: 0, hitDiceUsed: 0, exhaustion: 1, deathSaves: { success: 0, fail: 0 } })
    expect(c.state.resourcesUsed[aliento.key] ?? 0).toBe(0)
  })

  it('descanso largo: espacios de conjuro y magia de pacto', () => {
    const mago = make({ classId: 'mago', backgroundId: 'erudito', speciesId: 'elfo' })
    const dm = derive(mago, rules)
    expect(dm.spell?.slots).toEqual([2])
    let c = spendSlot(mago, dm, 1)!.next
    c = spendSlot(c, dm, 1)!.next
    expect(spendSlot(c, dm, 1)).toBeUndefined()
    expect(longRest(c, dm).state.slotsUsed.every((n) => n === 0)).toBe(true)
    // El brujo recupera los suyos también con descanso corto.
    const brujo = make({ classId: 'brujo', backgroundId: 'criminal', speciesId: 'enano' })
    const db = derive(brujo, rules)
    const used = spendSlot(brujo, db, 1)!
    expect(used.next.state.pactSlotsUsed).toBe(1)
    expect(shortRest(used.next, db).state.pactSlotsUsed).toBe(0)
  })

  it('con 0 PG no se puede empezar un descanso largo', () => {
    const down = at(setResourceUsed(g, res('Acción súbita').key, 1, 1), { hp: 0, hitDiceUsed: 2, deathSaves: { success: 3, fail: 0 } })
    expect(longRest(down, d).state).toEqual(down.state)
  })

  it('humano (Ingenioso): recupera la Inspiración heroica en cada descanso largo', () => {
    expect(longRest(at(g, { heroicInspiration: false }), d).state.heroicInspiration).toBe(true)
    // Otras especies la conservan si la tenían, pero no la ganan.
    const enano = make({ classId: 'guerrero', backgroundId: 'soldado', speciesId: 'enano' })
    const de = derive(enano, rules)
    expect(longRest(at(enano, { heroicInspiration: false }), de).state.heroicInspiration).toBe(false)
    expect(longRest(at(enano, { heroicInspiration: true }), de).state.heroicInspiration).toBe(true)
  })
})
