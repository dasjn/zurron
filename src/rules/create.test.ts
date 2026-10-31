// Tests del creador de personajes: borradores con lo recomendado, personajes
// hechos a mano (cifras comprobadas a mano) y reglas sueltas de la creación.

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Rules, type RuleBook } from './book'
import { CLASS_IDS } from './constants'
import {
  assignByPriority,
  bonusIssue,
  buildCharacter,
  classArray,
  classFeatureChoices,
  draftGear,
  emptyDraft,
  fillAll,
  fillUpTo,
  gearText,
  normalize,
  pointCost,
  recommendStep,
  recommendedBackground,
  recommendedBonus,
  recommendedSpecies,
  rollTotal,
  setBackground,
  setClass,
  setSpecies,
  STANDARD_ARRAY,
  stepIssues,
  stepsFor,
  uniqueId,
  weaponsInText,
  type Draft,
  type PartsParser,
} from './create'
import { derive } from './derive'

const DATA = resolve(__dirname, '../data')
const json = (p: string) => JSON.parse(readFileSync(resolve(DATA, p), 'utf8'))
// Solo el SRD: el contenido de la mesa tiene sus tests en src/data/mesa (fuera de git).
const list = (name: string) => (existsSync(resolve(DATA, 'srd', name)) ? json(`srd/${name}`) : [])

function loadBook(): Rules {
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

const rules = loadBook()

const NOW = '2026-10-31T00:00:00.000Z'
function draft(p: Partial<Draft>): Draft {
  return fillAll({ ...emptyDraft(), ...p }, rules)
}
function make(p: Partial<Draft>) {
  const d = draft(p)
  const c = buildCharacter(d, rules, { now: NOW })
  return { d, c, x: derive(c, rules) }
}
/** Avisos de cosas pendientes o errores (los 'aviso' son informativos). */
const problems = (x: ReturnType<typeof derive>) => x.warnings.filter((w) => w.kind !== 'aviso').map((w) => w.text)

describe('creador: personajes hechos a mano', () => {
  it('guerrero humano soldado con matriz estándar', () => {
    const { d, c, x } = make({ classId: 'guerrero', backgroundId: 'soldado', speciesId: 'humano', name: 'Rodrigo' })
    expect(stepIssues(d, rules, 'repaso')).toEqual([])
    expect(problems(x)).toEqual([])
    // Matriz del guerrero: Fue 15, Des 14, Con 13, Int 8, Sab 10, Car 12. Soldado: +2 Fue, +1 Des.
    expect(c.baseScores).toEqual({ fue: 15, des: 14, con: 13, int: 8, sab: 10, car: 12 })
    expect(c.backgroundBonus).toEqual({ fue: 2, des: 1 })
    expect(x.scores.fue).toBe(17)
    expect(x.scores.des).toBe(15)
    // PG: d10 + Con (+1) = 11
    expect(x.maxHp).toBe(11)
    expect(c.state.hp).toBe(11)
    // CA: cota de malla 16 (sin Destreza) + Defensa 1 = 17
    expect(c.choices['guerrero-estilo-de-combate']).toEqual(['defensa'])
    expect(c.equipment.find((i) => i.ref?.id === 'cota-de-malla')?.equipped).toBe(true)
    expect(x.ac.value).toBe(17)
    // Atletismo (del soldado): Fue +3 + competencia 2 = +5
    expect(x.skills.atletismo).toMatchObject({ proficient: true, bonus: 5 })
    expect(x.initiative).toBe(2)
    expect(c.weaponMasteries).toEqual(['espadon', 'mangual', 'jabalina'])
    // Humano: habilidad extra (Diestro) y dote de origen extra (Habilidoso, la recomendada)
    expect(c.speciesChoices['humano-diestro']).toBe('sigilo') // una que el guerrero no puede coger
    expect(c.skills).toContain('percepcion')
    expect(c.speciesChoices['humano-versatil']).toBe('habilidoso')
    expect(c.feats.map((f) => [f.id, f.source])).toEqual([
      ['atacante-salvaje', 'trasfondo'],
      ['habilidoso', 'humano'],
    ])
    expect(c.feats[1].choices?.competencias).toHaveLength(3)
    for (const s of c.feats[1].choices!.competencias) expect(c.skills).toContain(s)
    // Sin repetir habilidades: 2 del trasfondo + 1 Diestro + 3 Habilidoso + 2 de clase
    expect(c.skills).toHaveLength(8)
    expect(new Set(c.skills).size).toBe(8)
    expect(x.passivePerception).toBe(12)
    expect(c.coins.po).toBe(4 + 14)
    expect(c.state.heroicInspiration).toBe(true)
    expect(c.languages).toEqual(['Común', 'Elfo', 'Enano'])
    expect(c.tools).toEqual(['Dados'])
  })

  it('maga elfa erudita (alto elfo, Iniciado en la magia de mago)', () => {
    const { d, c, x } = make({ classId: 'mago', backgroundId: 'erudito', speciesId: 'elfo', name: 'Iriel' })
    expect(stepIssues(d, rules, 'repaso')).toEqual([])
    expect(problems(x)).toEqual([])
    // Mago: Fue 8, Des 12, Con 13, Int 15, Sab 14, Car 10. Erudito: +2 Int, +1 Sab.
    expect(x.scores.int).toBe(17)
    expect(x.scores.sab).toBe(15)
    expect(x.maxHp).toBe(7) // d6 + 1
    expect(x.ac.value).toBe(11) // sin armadura: 10 + Des 1
    expect(x.spell?.dc).toBe(13) // 8 + 2 + Int 3
    expect(x.spell?.attack).toBe(5)
    expect(x.skills.arcanos.bonus).toBe(5)
    expect(c.speciesChoices).toEqual({ 'elfo-linaje-elfico': 'alto-elfo', 'elfo-sentidos-agudos': 'percepcion' })
    expect(x.passivePerception).toBe(14) // 10 + Sab 2 + 2
    expect(c.spells.cantrips).toHaveLength(3)
    expect(c.spells.prepared).toHaveLength(4)
    // Iniciado en la magia: 2 trucos y 1 conjuro que no repiten los de la clase ni el del linaje
    const feat = c.feats.find((f) => f.id === 'iniciado-en-la-magia')!
    expect(feat.choices).toMatchObject({ lista: ['mago'], aptitud: ['int'] })
    expect(feat.choices!.trucos).toHaveLength(2)
    const known = [...c.spells.cantrips, 'prestidigitacion']
    for (const t of feat.choices!.trucos) expect(known).not.toContain(t)
    expect(c.spells.prepared).not.toContain(feat.choices!.conjuro[0])
    expect(c.spells.extra).toContainEqual({ id: 'prestidigitacion', source: 'especie:alto-elfo', ability: 'int' })
    expect(c.spells.extra).toContainEqual({ id: feat.choices!.conjuro[0], source: 'dote:iniciado-en-la-magia', ability: 'int', freeCast: 'largo' })
    // Las habilidades de clase no repiten las del trasfondo (Arcanos, Historia)
    expect(c.skills.filter((s) => s === 'arcanos')).toHaveLength(1)
    expect(c.skills).toHaveLength(5)
  })

  it('clérigo enano acólito', () => {
    const { d, c, x } = make({ classId: 'clerigo', backgroundId: 'acolito', speciesId: 'enano', name: 'Borin Pizarra' })
    expect(stepIssues(d, rules, 'repaso')).toEqual([])
    expect(problems(x)).toEqual([])
    // Clérigo: Fue 14, Des 8, Con 13, Int 10, Sab 15, Car 12. Acólito: +2 Sab, +1 Car.
    expect(x.scores.sab).toBe(17)
    expect(x.scores.car).toBe(13)
    // PG: d8 + Con 1 + Aguante enano 1 = 10
    expect(x.maxHp).toBe(10)
    // CA: camisa de malla 13 + Des −1 + escudo 2 = 14
    expect(x.ac.value).toBe(14)
    expect(x.spell?.dc).toBe(13)
    expect(c.choices['clerigo-orden-divina']).toEqual(['protector'])
    expect(c.extraProficiencies).toEqual(['Armas marciales', 'Armadura pesada'])
    // Medicina (de clase): Sab +3 + 2 = +5; Religión (del trasfondo): Int 0 + 2
    expect(x.skills.medicina).toMatchObject({ proficient: true, bonus: 5 })
    expect(x.skills.religion.bonus).toBe(2)
    expect(c.spells.cantrips).toHaveLength(3)
    expect(c.spells.prepared).toHaveLength(4)
    const feat = c.feats.find((f) => f.id === 'iniciado-en-la-magia')!
    expect(feat.choices).toMatchObject({ lista: ['clerigo'], aptitud: ['sab'] })
    expect(c.languages).toEqual(['Común', 'Enano', 'Elfo'])
  })

  it('pícaro mediano criminal', () => {
    const { d, c, x } = make({ classId: 'picaro', backgroundId: 'criminal', speciesId: 'mediano', name: 'Pim Bellota' })
    expect(stepIssues(d, rules, 'repaso')).toEqual([])
    expect(problems(x)).toEqual([])
    // Pícaro: Fue 12, Des 15, Con 13, Int 14, Sab 10, Car 8. Criminal: +2 Des, +1 Int.
    expect(x.scores.des).toBe(17)
    expect(x.maxHp).toBe(9) // d8 + 1
    expect(x.ac.value).toBe(14) // cuero 11 + Des 3
    expect(x.initiative).toBe(5) // Des 3 + Alerta 2
    // Pericia en Sigilo: Des 3 + 2×2 = +7
    expect(c.expertise).toEqual(['sigilo', 'percepcion'])
    expect(x.skills.sigilo).toMatchObject({ expertise: true, bonus: 7 })
    expect(x.passivePerception).toBe(14)
    expect(c.skills).toHaveLength(6)
    // Jerga de ladrones + un idioma más del rasgo
    expect(c.languages).toContain('Jerga de ladrones')
    expect(c.languages).toHaveLength(5)
    expect(c.choices['picaro-jerga-de-ladrones']).toHaveLength(1)
    expect(c.weaponMasteries).toEqual(['espada-corta', 'arco-corto'])
    const daga = x.attacks.find((a) => a.name === 'Daga')!
    expect(daga.attack).toBe(5)
    expect(daga.damage.replace(/\s/g, '')).toBe('1d4+3')
    // Dos dagas del pícaro y dos del criminal: se juntan
    expect(c.equipment.find((i) => i.id === 'daga')?.qty).toBe(4)
    expect(c.coins.po).toBe(8 + 16)
  })

  it('bardo humano criminal con compra por puntos', () => {
    const base = { fue: 8, des: 14, con: 14, int: 8, sab: 10, car: 15 }
    expect(pointCost(base)).toBe(25)
    const { d, c, x } = make({ classId: 'bardo', backgroundId: 'criminal', speciesId: 'humano', name: 'Nora', method: 'puntos', base, bonus: { des: 2, con: 1 } })
    expect(stepIssues(d, rules, 'caracteristicas')).toEqual([])
    expect(problems(x)).toEqual([])
    expect(x.scores.des).toBe(16)
    expect(x.scores.car).toBe(15)
    // Criminal da Alerta; la dote extra del humano es la recomendada (Habilidoso)
    expect(c.feats.map((f) => f.id)).toEqual(['alerta', 'habilidoso'])
    expect(x.initiative).toBe(3 + 2) // Des 16 (+3) + Alerta (+2)
    expect(new Set(c.skills).size).toBe(c.skills.length)
    // Bardo: 3 de cualquier habilidad + Habilidoso 3 + trasfondo 2 + Diestro 1
    expect(c.skills).toHaveLength(9)
    expect(c.tools).toEqual(['Herramientas de ladrón', 'Laúd', 'Flauta', 'Tambor'])
  })

  it('la dote extra del humano no repite la del trasfondo', () => {
    // Trasfondo de prueba (no existe en el SRD) que da Habilidoso, la dote que recomienda el humano.
    const bg = { ...rules.background('criminal')!, id: 'prueba-habilidoso', name: 'Trasfondo de prueba', feat: { id: 'habilidoso' } }
    const own = new Rules({ ...rules.book, backgrounds: [...rules.book.backgrounds, bg] })
    const d = fillAll({ ...emptyDraft(), classId: 'bardo', backgroundId: bg.id, speciesId: 'humano', name: 'X' }, own)
    expect(stepIssues(d, own, 'repaso')).toEqual([])
    const c = buildCharacter(d, own, { now: NOW })
    expect(c.feats.map((f) => [f.id, f.source])).toEqual([
      ['habilidoso', 'trasfondo'],
      ['alerta', 'humano'],
    ])
    expect(problems(derive(c, own))).toEqual([])
    expect(new Set(c.skills).size).toBe(c.skills.length)
  })

  it('un trasfondo con Habilidoso se completa solo con cualquier clase, especie y características', () => {
    // Habilidoso elige 3 habilidades: no puede dejar sin opciones a la especie (Sentidos agudos del elfo).
    // Trasfondos de prueba con cada trío de características posible.
    const abilities = ['fue', 'des', 'con', 'int', 'sab', 'car'] as const
    const trios = abilities.flatMap((a, i) => abilities.slice(i + 1).flatMap((b, j) => abilities.slice(i + j + 2).map((c) => [a, b, c])))
    expect(trios).toHaveLength(20)
    const bgs = trios.map((t) => ({ ...rules.background('criminal')!, id: `prueba-${t.join('-')}`, name: 'Trasfondo de prueba', abilities: t, feat: { id: 'habilidoso' } }))
    const own = new Rules({ ...rules.book, backgrounds: [...rules.book.backgrounds, ...bgs] })
    for (const bg of bgs)
      for (const classId of CLASS_IDS)
        for (const sp of own.book.species) {
          const d = fillAll({ ...emptyDraft(), classId, backgroundId: bg.id, speciesId: sp.id, name: 'X' }, own)
          const where = `${classId}/${bg.abilities.join('-')}/${sp.id}`
          expect(stepIssues(d, own, 'repaso'), where).toEqual([])
          expect(problems(derive(buildCharacter(d, own, {}), own)), where).toEqual([])
        }
  })

  it('paladín dracónido soldado con tiradas de 4d6', () => {
    const rolls = [
      { dice: [6, 6, 5, 1], total: 0 },
      { dice: [4, 4, 3, 1], total: 0 },
      { dice: [5, 4, 4, 2], total: 0 },
      { total: 12 },
      { dice: [2, 2, 1, 1], total: 0 },
      { dice: [6, 5, 1, 1], total: 0 },
    ]
    expect(rolls.map(rollTotal)).toEqual([17, 11, 13, 12, 5, 12])
    const { d, c, x } = make({ classId: 'paladin', backgroundId: 'soldado', speciesId: 'draconido', name: 'Brasmor', method: 'tirada', rolls })
    expect(stepIssues(d, rules, 'caracteristicas')).toEqual([])
    expect(problems(x)).toEqual([])
    // Paladín: Fue > Car > Con > Sab > Des > Int
    expect(c.baseScores).toEqual({ fue: 17, car: 13, con: 12, sab: 12, des: 11, int: 5 })
    expect(x.scores.fue).toBe(19)
    expect(x.ac.value).toBe(18) // cota de malla 16 + escudo 2
    expect(c.speciesChoices['draconido-linaje-draconico']).toBe('rojo')
    expect(c.spells.prepared).toEqual(['bendicion', 'castigo-divino'])
    expect(c.languages).toEqual(['Común', 'Dracónico', 'Elfo'])
  })

  it('las 12 clases con lo recomendado no dejan nada pendiente', () => {
    for (const classId of CLASS_IDS) {
      const d = draft({ classId, backgroundId: recommendedBackground(rules, classId), speciesId: recommendedSpecies(rules, classId), name: `Prueba ${classId}` })
      expect(stepIssues(d, rules, 'repaso'), classId).toEqual([])
      const c = buildCharacter(d, rules, { now: NOW })
      const x = derive(c, rules)
      expect(problems(x), classId).toEqual([])
      expect(c.state.hp, classId).toBe(x.maxHp)
      expect(new Set(c.skills).size, classId).toBe(c.skills.length)
      expect(new Set(c.equipment.map((i) => i.id)).size, classId).toBe(c.equipment.length)
    }
  })

  it('cualquier combinación de clase, trasfondo y especie se completa sola', () => {
    for (const classId of CLASS_IDS)
      for (const bg of rules.book.backgrounds)
        for (const sp of rules.book.species) {
          const d = draft({ classId, backgroundId: bg.id, speciesId: sp.id, name: 'X' })
          const where = `${classId}/${bg.id}/${sp.id}`
          expect(stepIssues(d, rules, 'repaso'), where).toEqual([])
          expect(problems(derive(buildCharacter(d, rules, {}), rules)), where).toEqual([])
        }
  })
})

describe('creador: reglas', () => {
  it('la matriz por clase es la estándar y cuesta 27 puntos', () => {
    for (const id of CLASS_IDS) {
      const s = classArray(rules.cls(id))
      expect(Object.values(s).sort((a, b) => b - a), id).toEqual(STANDARD_ARRAY)
      expect(pointCost(s), id).toBe(27)
    }
    expect(classArray(rules.cls('guerrero'))).toMatchObject({ fue: 15, des: 14 })
  })

  it('coste de la compra por puntos', () => {
    expect(pointCost({ fue: 8, des: 8, con: 8, int: 8, sab: 8, car: 8 })).toBe(0)
    expect(pointCost({ fue: 15, des: 15, con: 15, int: 8, sab: 8, car: 8 })).toBe(27)
    expect(pointCost({ fue: 13, des: 13, con: 13, int: 12, sab: 12, car: 12 })).toBe(27)
    const d = draft({ classId: 'guerrero', backgroundId: 'soldado', speciesId: 'orco', method: 'puntos', base: { fue: 15, des: 15, con: 15, int: 15, sab: 8, car: 8 } })
    expect(stepIssues(d, rules, 'caracteristicas')[0]).toMatch(/Te has pasado 9 puntos/)
  })

  it('las tiradas se reparten por la prioridad de la clase', () => {
    expect(assignByPriority([10, 18, 8, 12, 14, 9], rules.cls('mago'))).toEqual({ int: 18, sab: 14, con: 12, des: 10, car: 9, fue: 8 })
  })

  it('bonus del trasfondo: +2/+1 o +1/+1/+1, solo a las suyas y sin pasar de 20', () => {
    const soldado = rules.background('soldado')!
    expect(recommendedBonus(soldado, rules.cls('picaro'))).toEqual({ des: 2, con: 1 })
    expect(bonusIssue(soldado, { fue: 2, con: 1 })).toBeUndefined()
    expect(bonusIssue(soldado, { fue: 1, des: 1, con: 1 })).toBeUndefined()
    expect(bonusIssue(soldado, { fue: 2, des: 2 })).toMatch(/\+2 a una/)
    expect(bonusIssue(soldado, { car: 2, con: 1 })).toMatch(/solo deja/)
    expect(bonusIssue(soldado, { fue: 2, con: 1 }, { fue: 19, des: 10, con: 10, int: 10, sab: 10, car: 10 })).toMatch(/20/)
    expect(recommendedBonus(soldado, rules.cls('guerrero'), { fue: 19, des: 14, con: 13, int: 8, sab: 10, car: 12 })).toEqual({ des: 2, fue: 1 })
  })

  it('si el trasfondo da una habilidad ya elegida en la clase, hay que elegir otra', () => {
    let d = draft({ classId: 'clerigo', backgroundId: 'criminal', speciesId: 'enano', name: 'X' })
    d = { ...d, classSkills: ['perspicacia', 'religion'] }
    d = normalize(setBackground(d, 'acolito'), rules) // el acólito da Perspicacia y Religión
    expect(d.classSkills).toEqual([])
    expect(stepIssues(d, rules, 'habilidades')).toContain('Te faltan 2 habilidades de clase.')
    d = fillUpTo(d, rules, 'habilidades')
    expect(d.classSkills).toHaveLength(2)
    expect(d.classSkills).not.toContain('perspicacia')
    expect(stepIssues(d, rules, 'habilidades')).toEqual([])
  })

  it('cambiar de clase deshace sus elecciones', () => {
    let d = draft({ classId: 'guerrero', backgroundId: 'soldado', speciesId: 'humano', name: 'X' })
    expect(d.masteries).toHaveLength(3)
    d = fillUpTo(setClass(d, 'mago'), rules, 'repaso')
    expect(d.masteries ?? []).toEqual([])
    expect(d.classChoices).toEqual({})
    expect(d.cantrips).toHaveLength(3)
    expect(stepIssues(d, rules, 'repaso')).toEqual([])
    d = fillUpTo(setSpecies(d, 'tiefling'), rules, 'repaso')
    expect(d.speciesChoices['tiefling-legado-infernal']).toBe('infernal')
  })

  it('el paso de conjuros solo sale si hace falta', () => {
    const guerrero = draft({ classId: 'guerrero', backgroundId: 'soldado', speciesId: 'orco' })
    expect(stepsFor(guerrero, rules)).not.toContain('conjuros')
    const acolito = draft({ classId: 'guerrero', backgroundId: 'acolito', speciesId: 'orco' })
    expect(stepsFor(acolito, rules)).toContain('conjuros') // Iniciado en la magia
    const taumaturgo = draft({ classId: 'clerigo', backgroundId: 'soldado', speciesId: 'orco', classChoices: { 'clerigo-orden-divina': ['taumaturgo'] } })
    expect(taumaturgo.orderCantrip).toHaveLength(1)
    const c = buildCharacter({ ...taumaturgo, name: 'T' }, rules, {})
    expect(c.spells.extra.map((s) => s.source)).toContain('clase:Taumaturgo')
    expect(problems(derive(c, rules))).toEqual([])
  })

  it('las invocaciones de nivel 1 no incluyen las que piden más nivel', () => {
    const inv = classFeatureChoices(rules.cls('brujo')).find((x) => x.choice.kind === 'invocacion')!
    expect(inv.choice.options!.map((o) => o.id).sort()).toEqual(['armadura-de-sombras', 'mente-sobrenatural', 'pacto-de-la-cadena', 'pacto-del-filo', 'pacto-del-grimorio'])
  })

  it('«Elegir por mí» en cada paso deja el paso completo', () => {
    let d = { ...emptyDraft() }
    for (const step of ['clase', 'trasfondo', 'especie', 'caracteristicas', 'habilidades', 'equipo', 'idiomas', 'quien'] as const) {
      d = recommendStep(d, rules, step)
      expect(stepIssues(d, rules, step), step).toEqual([])
    }
    expect(d.classId).toBe('guerrero')
    expect(d.name).not.toBe('')
  })

  it('reconoce las armas de un texto de equipo', () => {
    const ws = weaponsInText('Hacha a dos manos, 4 hachas de mano, paquete de explorador y 15 po', rules).map((w) => w.id)
    expect(ws).toEqual(['hacha-a-dos-manos', 'hacha-de-mano'])
  })

  it('id único a partir del nombre', () => {
    const taken = new Set(['ana', 'sra-pimienta', 'sra-pimienta-2'])
    expect(uniqueId('Tomás el Rojo', (id) => taken.has(id))).toBe('tomas-el-rojo')
    expect(uniqueId('Ana', (id) => taken.has(id))).toBe('ana-2')
    expect(uniqueId('Sra. Pimienta', (id) => taken.has(id))).toBe('sra-pimienta-3')
    expect(uniqueId('¡!', () => false)).toBe('personaje')
  })

  it('las partes «a tu elección» del equipo se renombran con lo elegido', () => {
    const fake: PartsParser = (text) =>
      text.includes('instrumento')
        ? [
            { text: 'instrumento musical de tu elección', item: { id: 'instrumento-musical', name: 'Instrumento musical', qty: 1, notes: 'A tu elección.' }, pending: true },
            { text: '19 po', coins: { po: 19 } },
          ]
        : [{ text: '1 po', coins: { po: 1 } }]
    const d = { ...draft({ classId: 'bardo', backgroundId: 'criminal', speciesId: 'mediano' }), pendingNotes: {} }
    const blank = draftGear(d, rules, fake)
    expect(blank.coins.po).toBe(20)
    expect(blank.items.map((i) => i.name)).toEqual(['Instrumento musical'])
    expect(blank.pending).toEqual([{ text: 'instrumento musical de tu elección', from: 'clase', name: 'Instrumento musical' }])
    const chosen = draftGear({ ...d, pendingNotes: { 'instrumento musical de tu elección': 'laúd' } }, rules, fake)
    expect(chosen.items).toEqual([{ id: 'laud', name: 'Laúd', qty: 1, notes: 'Elegido en «instrumento musical de tu elección».' }])
  })
})

describe('creador: equipo con el analizador de equipment.ts', () => {
  it('el bardo escribe su instrumento y el soldado su juego (sin duplicar objetos)', () => {
    const bardo = make({ classId: 'bardo', backgroundId: 'soldado', speciesId: 'humano', name: 'B' })
    expect(bardo.d.pendingNotes).toMatchObject({ 'instrumento musical de tu elección': 'Laúd' })
    // El juego del soldado no se pregunta: es el de su competencia (Dados).
    expect(bardo.d.bgTool).toBe('Dados')
    expect(draftGear(bardo.d, rules).pending.map((p) => p.text)).toEqual(['instrumento musical de tu elección'])
    const names = bardo.c.equipment.map((i) => i.name)
    expect(names).toContain('Laúd')
    expect(names).toContain('Dados')
    expect(bardo.c.equipment.find((i) => i.name === 'Dados')?.notes).toBe('El mismo con el que tienes competencia.')
    expect(names.some((n) => /instrumento musical/i.test(n))).toBe(false)
    expect(names.some((n) => /^juego/i.test(n))).toBe(false)
  })

  it('el juego del soldado se cuenta con palabras llanas y sigue a la competencia', () => {
    const text = 'Lanza, arco corto, 20 flechas, aljaba, juego (el mismo que arriba), útiles de sanador, ropas de viaje y 14 po'
    const d = draft({ classId: 'guerrero', backgroundId: 'soldado', speciesId: 'humano' })
    expect(gearText(text, { ...d, bgTool: undefined })).toContain('aljaba, un juego (el mismo con el que tienes competencia), útiles')
    expect(gearText(text, { ...d, bgTool: 'Naipes' })).toContain('aljaba, naipes (el juego con el que tienes competencia), útiles')
    const names = draftGear({ ...d, bgTool: 'Naipes' }, rules).items.map((i) => i.name)
    expect(names).toContain('Naipes')
    expect(names).not.toContain('Dados')
  })

  it('el monje anota la herramienta que eligió en competencias', () => {
    // El acólito ya da unos suministros de artesano: la del monje tiene que ser otra.
    const { d, c } = make({ classId: 'monje', backgroundId: 'acolito', speciesId: 'humano', name: 'M' })
    expect(d.classTools).toHaveLength(1)
    expect(d.classTools![0]).not.toBe(rules.background('acolito')!.tool)
    expect(c.equipment.map((i) => i.name)).toContain(d.classTools![0])
    expect(c.tools).toContain(d.classTools![0])
  })

  it('solo hay una armadura puesta y el escudo si hay entrenamiento', () => {
    for (const classId of CLASS_IDS) {
      const { c } = make({ classId, backgroundId: recommendedBackground(rules, classId), speciesId: recommendedSpecies(rules, classId), name: 'E' })
      const worn = c.equipment.filter((i) => i.equipped && i.ref?.kind === 'armadura' && rules.armor(i.ref.id)?.category !== 'escudo')
      expect(worn.length, classId).toBeLessThanOrEqual(1)
    }
    const { c } = make({ classId: 'mago', backgroundId: 'erudito', speciesId: 'elfo', name: 'W' })
    expect(c.equipment.some((i) => i.equipped)).toBe(false)
  })

  it('opciones solo de oro', () => {
    const { c } = make({ classId: 'guerrero', backgroundId: 'criminal', speciesId: 'orco', name: 'G', equipClass: 'C', equipBg: 'B' })
    expect(c.coins.po).toBe(155 + 50)
    expect(c.equipment).toEqual([])
  })
})
