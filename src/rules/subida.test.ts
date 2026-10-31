// Subida de nivel con personajes de prueba del SRD: que todas las elecciones se
// puedan completar, los conjuros que llegan con el nivel (linaje, Arcanum
// místico, Guerrero druídico), los requisitos de las invocaciones, deshacer y
// los límites de los datos que se escriben a mano.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Character } from '../model/character'
import { Rules, type RuleBook } from './book'
import { CLASS_IDS, FEAT, SKILLS } from './constants'
import { buildCharacter, emptyDraft, fillAll, masteryWeapons, recommendedBackground, recommendedSpecies, speciesSpellsAt, type Draft } from './create'
import { derive } from './derive'
import {
  applyLevelUp,
  choiceMissing,
  choiceOptions,
  emptyInput,
  languagesKey,
  planLevelUp,
  previewLevelUp,
  recommendChoice,
  recommendMasteries,
  recommendSpells,
  spellChoicePool,
  styleChoiceValue,
  recommendAltCantrips,
  undoLevelUp,
  type ChoiceValue,
  type LevelUpInput,
  type LevelUpPlan,
} from './levelup'

const DATA = resolve(__dirname, '../data/srd')
const json = (name: string) => JSON.parse(readFileSync(resolve(DATA, name), 'utf8'))
const book: RuleBook = {
  classes: json('classes.json'),
  subclasses: json('subclasses.json'),
  species: json('species.json'),
  backgrounds: json('backgrounds.json'),
  feats: json('feats.json'),
  spells: json('spells.json'),
  weapons: json('weapons.json'),
  armor: json('armor.json'),
  masteries: json('masteries.json'),
  weaponProperties: json('weapon-properties.json'),
  glossary: json('glossary.json'),
  gear: json('gear.json'),
  slots: json('spell-slots.json'),
}
// Solo el SRD: da lo mismo en CI que con la mesa en local.
const rules = new Rules(book)
const NOW = '2026-10-31T00:00:00.000Z'

/** Personaje de nivel 1 hecho con el creador y lo recomendado en lo que no se diga. */
function make(p: Partial<Draft>): Character {
  const classId = p.classId ?? 'guerrero'
  return buildCharacter(
    fillAll({ ...emptyDraft(), name: 'Prueba', backgroundId: recommendedBackground(rules, classId), speciesId: recommendedSpecies(rules, classId), ...p, classId }, rules),
    rules,
    { now: NOW },
  )
}

/** Entrada de la subida con «Elegir por mí» en todo (lo que hace el asistente al pulsarlo en cada paso). */
function recommendedInput(c: Character, plan: LevelUpPlan, subclassId?: string): { input: LevelUpInput; values: Record<string, ChoiceValue> } {
  const input: LevelUpInput = { ...emptyInput(c), subclassId }
  const values: Record<string, ChoiceValue> = {}
  for (const pc of plan.choices) {
    const v = recommendChoice(c, rules, pc, plan.to, subclassId)
    values[pc.choice.id] = v
    input.choices[pc.choice.id] = v.ids
    if (v.feat) input.feats.push(v.feat)
    if (v.expertise) input.addExpertise.push(...v.expertise)
    if (v.skills) input.addSkills.push(...v.skills)
    if (v.extra) input.extraSpells!.push(...v.extra)
    if (v.extraSources) input.dropExtra!.push(...v.extraSources)
    if (v.languages) {
      input.languages!.push(...v.languages)
      input.choices[languagesKey(pc.choice.id)] = v.languages
    }
  }
  const always = derive(previewLevelUp(c, rules, input), rules).spell?.alwaysPrepared ?? []
  Object.assign(input, recommendSpells(c, rules, plan, input, always))
  input.masteries = recommendMasteries(c, rules, plan.masteriesAfter)
  return { input, values }
}

/** Sube un nivel con todo lo recomendado (y la primera subclase si toca). */
function levelUp(c: Character): Character {
  const plan0 = planLevelUp(c, rules)!
  const sub = plan0.needsSubclass ? plan0.subclassOptions[0].id : undefined
  const plan = planLevelUp(c, rules, sub)!
  return applyLevelUp(c, rules, recommendedInput(c, plan, sub).input, [])
}
const levelTo = (c: Character, n: number) => {
  while (c.level < n) c = levelUp(c)
  return c
}

const LIST_KINDS = new Set(['opcion', 'metamagia', 'invocacion'])

describe('subida de nivel: elecciones', () => {
  it('todas las elecciones de todas las clases y subclases, de 1 a 20, se pueden completar', () => {
    for (const classId of CLASS_IDS) {
      let c = make({ classId })
      while (c.level < 20) {
        const plan0 = planLevelUp(c, rules)!
        const sub = plan0.needsSubclass ? plan0.subclassOptions[0].id : undefined
        const plan = planLevelUp(c, rules, sub)!
        const where = `${classId} ${plan.from}→${plan.to}`
        const { input, values } = recommendedInput(c, plan, sub)
        for (const pc of plan.choices) {
          const id = `${where} ${pc.choice.id}`
          // Hay opciones de sobra (o se escribe) y «Elegir por mí» la deja completa.
          if (LIST_KINDS.has(pc.choice.kind)) expect(choiceOptions(c, rules, pc.choice, plan.to, [], sub).length, id).toBeGreaterThanOrEqual(pc.choice.count)
          if (pc.choice.kind === 'conjuro') expect(spellChoicePool(rules, pc.choice, 9).length, id).toBeGreaterThanOrEqual(pc.choice.count)
          expect(choiceMissing(pc.choice, values[pc.choice.id], rules), id).toBeUndefined()
        }
        c = applyLevelUp(c, rules, input, [])
        expect(c.level, where).toBe(plan.to)
      }
      // A nivel 20, con todo lo recomendado, no queda nada por elegir.
      const pending = derive(c, rules).warnings.filter((w) => w.kind !== 'aviso')
      expect(pending.map((w) => w.text), classId).toEqual([])
    }
  })

  it('druida de nivel 1 a 2: las formas de bestia salen del SRD (no de la Orden primigenia)', () => {
    const c = make({ classId: 'druida' })
    const plan = planLevelUp(c, rules)!
    const pc = plan.choices.find((x) => x.choice.id === 'druida-forma-salvaje-n2')!
    expect(pc.choice.count).toBe(4)
    const opts = choiceOptions(c, rules, pc.choice, 2)
    expect(opts.length).toBeGreaterThan(20)
    expect(opts.map((o) => o.id)).not.toContain('guardian')
    expect(opts.map((o) => o.id)).toContain('lobo')
    // Ninguna vuela ni pasa de VD 1/4.
    expect(opts.some((o) => /volar/.test(o.text ?? ''))).toBe(false)
    const v = recommendChoice(c, rules, pc, 2)
    expect(v.ids).toEqual(['arana', 'caballo-de-monta', 'lobo', 'rata'])
    expect(choiceMissing(pc.choice, v)).toBeUndefined()
    expect(choiceMissing(pc.choice, { ids: ['lobo'] })).toMatch(/faltan 3/)
  })

  it('druida de nivel 3 a 4: dos formas más, sin repetir las que ya conoce', () => {
    const c = levelTo(make({ classId: 'druida' }), 3)
    expect(c.choices['druida-forma-salvaje-n2']).toHaveLength(4)
    const plan = planLevelUp(c, rules)!
    const pc = plan.choices.find((x) => x.choice.id === 'druida-forma-salvaje-n4')!
    const ids = choiceOptions(c, rules, pc.choice, 4).map((o) => o.id)
    expect(ids).toContain('oso-negro')
    for (const known of c.choices['druida-forma-salvaje-n2']) expect(ids).not.toContain(known)
  })

  it('las invocaciones respetan el nivel y los requisitos', () => {
    const c = make({ classId: 'brujo' })
    expect(c.spells.cantrips).toContain('descarga-sobrenatural')
    const plan = planLevelUp(c, rules)!
    const pc = plan.choices.find((x) => x.choice.kind === 'invocacion')!
    const ids = choiceOptions(c, rules, pc.choice, 2).map((o) => o.id)
    // Nivel 2: sí las de nivel 2; no las de nivel 5 o más.
    expect(ids).toContain('descarga-agonica')
    expect(ids).toContain('vista-del-diablo')
    for (const no of ['filo-sediento', 'castigo-arcano', 'don-de-las-profundidades', 'devorador-de-vida', 'vision-bruja']) expect(ids, no).not.toContain(no)
    // La que ya tiene (de nivel 1) no vuelve a salir.
    for (const had of c.choices['brujo-invocaciones-sobrenaturales-n1']) expect(ids).not.toContain(had)
    // Sin un truco de brujo que haga daño no hay Descarga agónica.
    const sinTruco = { ...c, spells: { ...c.spells, cantrips: ['mano-de-mago', 'prestidigitacion'] } }
    expect(choiceOptions(sinTruco, rules, pc.choice, 2).map((o) => o.id)).not.toContain('descarga-agonica')
    // A nivel 5, Filo sediento pide Pacto del filo (ya elegido, o marcado en esta misma elección).
    const n5 = { ...c, level: 4, choices: { ...c.choices, 'brujo-invocaciones-sobrenaturales-n1': ['pacto-del-filo'] } }
    expect(choiceOptions(n5, rules, pc.choice, 5).map((o) => o.id)).toContain('filo-sediento')
    const sinPacto = { ...c, level: 4, choices: { ...c.choices, 'brujo-invocaciones-sobrenaturales-n1': ['mente-sobrenatural'] } }
    expect(choiceOptions(sinPacto, rules, pc.choice, 5).map((o) => o.id)).not.toContain('filo-sediento')
    expect(choiceOptions(sinPacto, rules, pc.choice, 5, ['pacto-del-filo']).map((o) => o.id)).toContain('filo-sediento')
    // Las de la lista larga traen una línea corta para leer de un vistazo.
    expect(choiceOptions(c, rules, pc.choice, 2).every((o) => o.summary && o.summary.length < 140)).toBe(true)
  })

  it('el creador solo ofrece invocaciones de nivel 1', () => {
    const c = make({ classId: 'brujo' })
    const n1 = rules.cls('brujo')!.features.find((f) => f.id === 'brujo-invocaciones-sobrenaturales-n1')!
    const ids = choiceOptions(c, rules, n1.choice!, 1).map((o) => o.id)
    expect(ids).toContain('pacto-del-filo')
    expect(ids).not.toContain('descarga-agonica')
  })

  it('Arcanum místico: el brujo de nivel 10 a 11 elige un conjuro de nivel 6 y llega a la ficha', () => {
    const c = levelTo(make({ classId: 'brujo' }), 10)
    const plan = planLevelUp(c, rules)!
    const pc = plan.choices.find((x) => x.choice.id === 'brujo-arcanum-mistico-n11')
    expect(pc, 'paso de Arcanum místico').toBeDefined()
    const pool = spellChoicePool(rules, pc!.choice, 5)
    expect(pool.length).toBeGreaterThan(0)
    expect(pool.every((s) => s.level === 6 && rules.cls('brujo')!.spellList!.includes(s.id))).toBe(true)
    // Sin elegir, la ficha lo avisa.
    const blank = applyLevelUp(c, rules, emptyInput(c), [])
    expect(derive(blank, rules).warnings.some((w) => w.kind === 'falta' && /Arcanum místico/.test(w.text))).toBe(true)
    // Con «Elegir por mí», el conjuro va a la ficha y el aviso se va.
    const next = levelUp(c)
    const spell = next.choices['brujo-arcanum-mistico-n11'][0]
    expect(rules.spell(spell)?.level).toBe(6)
    expect(next.spells.extra).toContainEqual({ id: spell, source: 'clase:Arcanum místico (nivel 6)', ability: 'car' })
    expect(derive(next, rules).warnings.some((w) => /Arcanum místico/.test(w.text))).toBe(false)
  })

  it('Maestría sobre conjuros pide un conjuro de nivel 1 y otro de nivel 2, de una acción', () => {
    const c = levelTo(make({ classId: 'mago' }), 17)
    const pc = planLevelUp(c, rules)!.choices.find((x) => x.choice.id === 'mago-maestria-sobre-conjuros')!
    const v = recommendChoice(c, rules, pc, 18)
    expect(v.ids.map((id) => rules.spell(id)!.level).sort()).toEqual([1, 2])
    expect(v.ids.every((id) => rules.spell(id)!.castingTime === 'Acción')).toBe(true)
    expect(choiceMissing(pc.choice, { ids: [v.ids[0], v.ids[0]] }, rules)).toBeDefined()
  })

  it('Guerrero druídico (explorador) y Guerrero bendito (paladín): dos trucos en lugar de una dote', () => {
    for (const [classId, alt, list, ability] of [
      ['explorador', 'guerrero-druidico', 'druida', 'sab'],
      ['paladin', 'guerrero-bendito', 'clerigo', 'car'],
    ] as const) {
      const c = make({ classId })
      const plan = planLevelUp(c, rules)!
      const pc = plan.choices.find((x) => x.choice.kind === 'estilo-combate')!
      const opt = pc.choice.options?.find((o) => o.id === alt)
      expect(opt?.cantrips, classId).toMatchObject({ list, count: 2, ability })
      const cantrips = recommendAltCantrips(c, rules, opt!)
      expect(cantrips, classId).toHaveLength(2)
      expect(cantrips.every((id) => rules.cls(list)!.spellList!.includes(id) && rules.spell(id)!.level === 0)).toBe(true)
      const v = styleChoiceValue('clase', pc.feature, pc.choice, alt, cantrips)
      expect(choiceMissing(pc.choice, v)).toBeUndefined()
      expect(choiceMissing(pc.choice, styleChoiceValue('clase', pc.feature, pc.choice, alt, []))).toMatch(/faltan 2 trucos/)
      const { input } = recommendedInput(c, plan)
      input.choices[pc.choice.id] = v.ids
      input.extraSpells = v.extra
      input.dropExtra = v.extraSources
      const next = applyLevelUp(c, rules, input, [])
      const own = next.spells.extra.filter((e) => e.source === `clase:${opt!.name}`)
      expect(own.map((e) => e.id).sort(), classId).toEqual([...cantrips].sort())
      expect(own.every((e) => e.ability === ability)).toBe(true)
      expect(derive(next, rules).warnings.filter((w) => /trucos de/.test(w.text))).toEqual([])
      // Elegirlo sin trucos se avisa.
      const sin = { ...next, spells: { ...next.spells, extra: next.spells.extra.filter((e) => e.source !== `clase:${opt!.name}`) } }
      expect(derive(sin, rules).warnings.some((w) => w.kind === 'falta' && w.text.includes(opt!.name))).toBe(true)
    }
  })

  it('Explorador hábil pide también dos idiomas', () => {
    const c = make({ classId: 'explorador' })
    const pc = planLevelUp(c, rules)!.choices.find((x) => x.choice.id === 'explorador-explorador-habil')!
    expect(pc.choice.languages).toBe(2)
    expect(choiceMissing(pc.choice, { ids: [c.skills[0]], expertise: [c.skills[0]] })).toMatch(/2 idiomas/)
    const v = recommendChoice(c, rules, pc, 2)
    expect(v.languages).toHaveLength(2)
    expect(v.languages!.some((l) => c.languages.includes(l))).toBe(false)
    expect(choiceMissing(pc.choice, v)).toBeUndefined()
    const next = levelUp(c)
    for (const l of v.languages!) expect(next.languages).toContain(l)
    expect(derive(next, rules).warnings.some((w) => /idiomas/.test(w.text))).toBe(false)
  })

  it('una dote con +1 no se queda sin repartir', () => {
    const c = levelTo(make({ classId: 'guerrero' }), 3)
    const pc = planLevelUp(c, rules)!.choices.find((x) => x.choice.kind === 'dote')!
    expect(choiceMissing(pc.choice, { ids: ['apresador'], feat: { id: 'apresador', source: 'nivel-4', abilityIncrease: {} } }, rules)).toMatch(/\+1 de Apresador/)
    expect(choiceMissing(pc.choice, { ids: ['apresador'], feat: { id: 'apresador', source: 'nivel-4', abilityIncrease: { fue: 1 } } }, rules)).toBeUndefined()
    // «Elegir por mí»: +2 a la característica principal.
    const v = recommendChoice(c, rules, pc, 4)
    expect(v.feat).toEqual({ id: FEAT.mejoraCaracteristica, source: 'nivel-4', abilityIncrease: { fue: 2 } })
  })
})

describe('subida de nivel: datos de clase', () => {
  it('monje: marciales con Ligera; pícaro: con Sutil o Ligera', () => {
    expect(rules.cls('monje')!.weapons.martial).toBe('ligeras')
    expect(rules.cls('picaro')!.weapons.martial).toBe('sutiles-o-ligeras')
    const monje = masteryWeapons(rules.cls('monje'), rules).map((w) => w.id)
    expect(monje).toContain('espada-corta')
    expect(monje).toContain('cimitarra')
    expect(monje).not.toContain('estoque')
    expect(monje).not.toContain('latigo')
    const picaro = masteryWeapons(rules.cls('picaro'), rules).map((w) => w.id)
    for (const id of ['estoque', 'latigo', 'cimitarra', 'ballesta-de-mano']) expect(picaro).toContain(id)
    expect(picaro).not.toContain('espada-larga')
  })

  it('los rasgos repetidos remiten al original en vez de copiarlo', () => {
    const f = rules.cls('barbaro')!.features.find((x) => x.id === 'barbaro-maestria-con-armas-n10')!
    expect(f.text).toMatch(/cuatro en total/)
    expect(f.text).not.toMatch(/dos tipos de armas/)
    expect(f.text.length).toBeLessThan(200)
  })
})

describe('subida de nivel: conjuros del linaje', () => {
  it('el elfo y el tiefling ganan sus conjuros a los niveles 3 y 5', () => {
    for (const [speciesId, lineage, n3, n5] of [
      ['elfo', { 'elfo-linaje-elfico': 'alto-elfo' }, 'detectar-magia', 'paso-brumoso'],
      ['elfo', { 'elfo-linaje-elfico': 'drow' }, 'fuego-feerico', 'oscuridad'],
      ['tiefling', { 'tiefling-legado-infernal': 'infernal' }, 'reprension-infernal', 'oscuridad'],
    ] as const) {
      const c = make({ classId: 'guerrero', speciesId, speciesChoices: lineage })
      const src = `especie:${Object.values(lineage)[0]}`
      expect(c.spells.extra.map((e) => e.id)).not.toContain(n3)
      const l2 = levelTo(c, 2)
      expect(l2.spells.extra.map((e) => e.id)).not.toContain(n3)
      const l3 = levelUp(l2)
      const ability = c.spells.extra.find((e) => e.source === src)!.ability
      expect(l3.spells.extra).toContainEqual({ id: n3, source: src, ability, freeCast: 'largo' })
      expect(l3.spells.extra.map((e) => e.id)).not.toContain(n5)
      const l5 = levelTo(l3, 5)
      expect(l5.spells.extra).toContainEqual({ id: n5, source: src, ability, freeCast: 'largo' })
      // Sin repetir nada al seguir subiendo.
      const l6 = levelUp(l5)
      expect(l6.spells.extra.filter((e) => e.id === n3 && e.source === src)).toHaveLength(1)
    }
  })

  it('una ficha de nivel 4 sin el conjuro de nivel 3 lo recibe en la siguiente subida', () => {
    const c = levelTo(make({ classId: 'guerrero', speciesId: 'elfo', speciesChoices: { 'elfo-linaje-elfico': 'alto-elfo' } }), 4)
    const old = { ...c, spells: { ...c.spells, extra: c.spells.extra.filter((e) => e.id !== 'detectar-magia') } }
    expect(planLevelUp(old, rules)!.speciesSpells.map((s) => s.id).sort()).toEqual(['detectar-magia', 'paso-brumoso'])
    expect(levelUp(old).spells.extra.map((e) => e.id)).toEqual(expect.arrayContaining(['detectar-magia', 'paso-brumoso']))
  })

  it('el alto elfo que cambió su truco no lo recupera al subir', () => {
    const c = make({ classId: 'guerrero', speciesId: 'elfo', speciesChoices: { 'elfo-linaje-elfico': 'alto-elfo' } })
    const swapped = { ...c, spells: { ...c.spells, extra: c.spells.extra.map((e) => (e.id === 'prestidigitacion' ? { ...e, id: 'luz' } : e)) } }
    expect(levelTo(swapped, 3).spells.extra.map((e) => e.id)).not.toContain('prestidigitacion')
  })

  it('a nivel 1 solo da el truco', () => {
    expect(speciesSpellsAt(rules, 'elfo', { 'elfo-linaje-elfico': 'drow' }, 1, 'sab').map((s) => s.id)).toEqual(['luces-danzantes'])
  })
})

describe('subida de nivel: deshacer y límites', () => {
  const PORTRAIT = `data:image/jpeg;base64,${'A'.repeat(30000)}`

  it('el historial no guarda el retrato (ni el de subidas antiguas)', () => {
    const c = make({ classId: 'guerrero', portrait: PORTRAIT })
    const next = levelTo(c, 3)
    expect(next.look?.portrait).toBe(PORTRAIT)
    for (const h of next.history) expect(h.snapshot.look).toBeUndefined()
    // Una ficha antigua con el retrato en el historial lo pierde al subir otra vez.
    const old = { ...next, history: next.history.map((h) => ({ ...h, snapshot: { ...h.snapshot, look: c.look } })) }
    for (const h of levelUp(old).history) expect(h.snapshot.look).toBeUndefined()
    for (const h of undoLevelUp(old, rules)!.history) expect(h.snapshot.look).toBeUndefined()
    expect(JSON.stringify(levelTo(c, 10)).length).toBeLessThan(JSON.stringify(c).length + 60000)
  })

  it('deshacer conserva lo hecho después de subir', () => {
    const c = make({ classId: 'guerrero', portrait: PORTRAIT })
    const next = levelTo(c, 2)
    const dNext = derive(next, rules)
    const edited: Character = {
      ...next,
      tagline: 'Lema nuevo',
      look: { ...next.look, portrait: 'data:image/jpeg;base64,BBBB' },
      guide: [...next.guide, { id: 'estrategia', title: 'Estrategia', body: 'Ir delante.' }],
      customFeatures: [{ id: 'regla-casa', name: 'Regla de la casa', text: 'Algo.', source: 'dm' }],
      overrides: { speed: 12, note: 'Botas' },
      notes: [{ id: 'n1', date: '2026-10-31', title: 'Sesión 2', body: 'Cruzamos el puente.' }],
      state: { ...next.state, hp: dNext.maxHp - 2, conditions: ['envenenado'] },
    }
    const back = undoLevelUp(edited, rules)!
    expect(back.level).toBe(1)
    expect(back.history).toHaveLength(0)
    expect(back.tagline).toBe('Lema nuevo')
    expect(back.look?.portrait).toBe('data:image/jpeg;base64,BBBB')
    expect(back.guide).toEqual(edited.guide)
    expect(back.customFeatures).toEqual(edited.customFeatures)
    expect(back.overrides).toEqual(edited.overrides)
    expect(back.notes).toEqual(edited.notes)
    expect(back.state.conditions).toEqual(['envenenado'])
    // PG: los de ahora, sin pasar del máximo de nivel 1.
    const max1 = derive(back, rules).maxHp
    expect(max1).toBe(derive(c, rules).maxHp)
    expect(back.state.hp).toBe(Math.min(dNext.maxHp - 2, max1))
    // Herido por debajo del máximo de antes: se queda como está.
    const hurt = undoLevelUp({ ...edited, state: { ...edited.state, hp: 3 } }, rules)!
    expect(hurt.state.hp).toBe(3)
  })

  it('deshacer quita los rasgos de la mesa que añadió esa subida', () => {
    const c = make({ classId: 'guerrero' })
    const mesa = { id: 'mesa-n2', name: 'Rasgo de nivel 2', text: 'Algo.', source: 'mesa', level: 2 }
    const casa = { id: 'casa', name: 'De la casa', text: 'Algo.', source: 'dm' }
    const next = applyLevelUp(c, rules, { ...emptyInput(c), customFeatures: [mesa] }, [])
    expect(next.customFeatures).toEqual([mesa])
    expect(undoLevelUp({ ...next, customFeatures: [...next.customFeatures, casa] }, rules)!.customFeatures).toEqual([casa])
    // Fichas de antes, que guardaban el rasgo nuevo también en la copia para deshacer.
    const old = applyLevelUp({ ...c, customFeatures: [mesa] }, rules, emptyInput(c), [])
    expect(undoLevelUp({ ...old, customFeatures: [...old.customFeatures, casa] }, rules)!.customFeatures).toEqual([casa])
  })

  it('el dado de golpe va de 1 al dado de la clase y no se pasa de nivel 20', () => {
    const c = make({ classId: 'guerrero' })
    expect(applyLevelUp(c, rules, { ...emptyInput(c), hpRoll: 99 }, []).hpRolls).toEqual([10])
    expect(applyLevelUp(c, rules, { ...emptyInput(c), hpRoll: 0 }, []).hpRolls).toEqual([1])
    expect(applyLevelUp(c, rules, { ...emptyInput(c), hpRoll: 7 }, []).hpRolls).toEqual([7])
    expect(applyLevelUp(c, rules, { ...emptyInput(c), hpRoll: null }, []).hpRolls).toEqual([null])
    const top = levelTo(c, 20)
    expect(top.level).toBe(20)
    expect(planLevelUp(top, rules)).toBeUndefined()
    expect(applyLevelUp(top, rules, emptyInput(top), [])).toBe(top)
  })
})

describe('creador: lo recomendado', () => {
  it('Habilidoso del humano guerrero coge habilidades de sus características buenas', () => {
    const c = make({ classId: 'guerrero', speciesId: 'humano', backgroundId: 'soldado' })
    const x = derive(c, rules)
    const picks = c.feats.find((f) => f.id === 'habilidoso')!.choices!.competencias
    expect(picks).toHaveLength(3)
    // Int 8: nada de Investigación, Conocimiento arcano, Historia ni Naturaleza.
    for (const s of ['investigacion', 'arcanos', 'historia', 'naturaleza']) expect(picks).not.toContain(s)
    for (const s of picks) expect(x.mods[SKILLS.find((k) => k.id === s)!.ability], s).toBeGreaterThanOrEqual(0)
  })

  it('dos símbolos sagrados (clase y trasfondo) dicen de dónde sale cada uno; el pergamino va por hojas', () => {
    const c = make({ classId: 'clerigo', backgroundId: 'acolito', speciesId: 'enano' })
    const sym = c.equipment.find((i) => i.name === 'Símbolo sagrado')!
    expect(sym.qty).toBe(2)
    expect(sym.notes).toMatch(/Te dan uno tu clase y otro tu trasfondo\./)
    expect(c.equipment.find((i) => i.id === 'pergamino')).toMatchObject({ name: 'Pergamino', qty: 10 })
  })
})
