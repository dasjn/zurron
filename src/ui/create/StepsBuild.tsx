// Pasos 4 a 6: características, habilidades y rasgos de clase, conjuros.

import { useMemo, useState } from 'preact/hooks'
import type { Ability, SpellData, WeaponData } from '../../data/types'
import { ABILITIES } from '../../data/types'
import { ABILITY_NAMES, signed } from '../../rules/constants'
import {
  POINT_BUDGET,
  POINT_COST,
  assignByPriority,
  classAlwaysPrepared,
  classFeatureChoices,
  classSkillPool,
  draftSkills,
  fillUpTo,
  finalScores,
  listSpells,
  masteryCount,
  masteryWeapons,
  pointCost,
  recommendedBonus,
  recommendedMasteries,
  roll4d6,
  rollTotal,
  setMethod,
  speciesSpells,
  spellNeeds,
  toolRule,
  weaponsInText,
  type Draft,
  type Method,
} from '../../rules/create'
import { buildCharacter } from '../../rules/create'
import { derive } from '../../rules/derive'
import { ChoiceEditor } from '../ChoiceEditor'
import { Option, Stepper, rollDie } from '../common'
import { SpellPicker, useClassPool } from '../SpellEditor'
import { andList, Chips, FullNote, Section, skillName, skillOptions, type StepProps } from './shared'

/* ---------- Características ---------- */

const ABILITY_HINT: Record<Ability, string> = {
  fue: 'Golpear cuerpo a cuerpo, cargar peso, trepar',
  des: 'Puntería, reflejos, sigilo y esquivar',
  con: 'Aguante y puntos de golpe',
  int: 'Memoria, conocimientos y magia de mago',
  sab: 'Darse cuenta de las cosas e intuición',
  car: 'Convencer, mentir e imponerse',
}

/** Nombres cortos para que el segmentado quepa en una línea a 360 px; la pista de debajo explica cada uno. */
const METHODS: { id: Method; name: string }[] = [
  { id: 'estandar', name: 'Estándar' },
  { id: 'puntos', name: 'Por puntos' },
  { id: 'tirada', name: 'Con dados' },
]

export function StepAbilities({ d, set, rules }: StepProps) {
  const cls = rules.cls(d.classId ?? '')
  const bg = rules.background(d.backgroundId ?? '')
  const [sel, setSel] = useState<Ability | null>(null)
  const [typed, setTyped] = useState<string[]>(() => (d.rolls && d.rolls.every((r) => !r.dice) ? d.rolls.map((r) => String(r.total)) : ['', '', '', '', '', '']))
  const base = d.base
  const fin = finalScores(d)
  const primary = new Set(cls?.primaryAbilities ?? [])

  const changeMethod = (m: Method) => {
    setSel(null)
    set((x) => fillUpTo(setMethod(x, m), rules, 'caracteristicas'))
  }
  const swap = (a: Ability) => {
    if (!base) return
    if (!sel) return setSel(a)
    if (sel === a) return setSel(null)
    const other = sel
    set((x) => (x.base ? { ...x, base: { ...x.base, [a]: x.base[other], [other]: x.base[a] } } : x))
    setSel(null)
  }
  const roll = () => {
    setSel(null)
    setTyped(['', '', '', '', '', ''])
    const rolls = Array.from({ length: 6 }, () => roll4d6(rollDie))
    set((x) => ({ ...x, rolls, base: assignByPriority(rolls.map(rollTotal), cls) }))
  }
  const type = (i: number, v: string) => {
    const next = [...typed]
    next[i] = v.replace(/\D/g, '').slice(0, 2)
    setTyped(next)
    const nums = next.map(Number)
    if (next.every((t) => t) && nums.every((n) => n >= 3 && n <= 18))
      set((x) => ({ ...x, rolls: nums.map((total) => ({ total })), base: assignByPriority(nums, cls) }))
  }
  const cost = base ? pointCost(base) : 0
  const cap = (a: Ability) => {
    if (!base) return 15
    let v = base[a]
    while (v < 15 && cost - POINT_COST[base[a]] + POINT_COST[v + 1] <= POINT_BUDGET) v++
    return v
  }

  return (
    <>
      <div class="cr-seg" role="group" aria-label="Método">
        {METHODS.map((m) => (
          <button key={m.id} type="button" aria-pressed={d.method === m.id} onClick={() => changeMethod(m.id)}>
            {m.name}
          </button>
        ))}
      </div>
      <p class="cr-hint cr-after-seg">
        {d.method === 'estandar' && (
          <>
            Los números 15, 14, 13, 12, 10 y 8, ya colocados para tu clase: es lo recomendado.
          </>
        )}
        {d.method === 'puntos' && (
          <>
            Tienes {POINT_BUDGET} puntos. Todas empiezan en 8 y pueden llegar a 15; las altas cuestan más (14 cuesta 7 y 15 cuesta 9).
          </>
        )}
        {d.method === 'tirada' && <>Tiras 4 dados de seis caras, quitas el más bajo y sumas los otros tres; así seis veces. Pregunta antes a la DM si en tu mesa se tira.</>}
      </p>

      {d.method === 'tirada' && (
        <div class="cr-roll">
          <button type="button" class="btn brass block" onClick={roll}>
            {d.rolls?.some((r) => r.dice) ? 'Volver a tirar' : 'Tirar los dados'}
          </button>
          {d.rolls?.some((r) => r.dice) && (
            <div class="cr-dice-rows" aria-label="Tiradas">
              {d.rolls.map((r, i) => {
                const low = r.dice ? r.dice.indexOf(Math.min(...r.dice)) : -1
                return (
                  <div class="cr-dice-row" key={i}>
                    {r.dice?.map((n, j) => (
                      <span key={j} class={`cr-die ${j === low ? 'cr-drop' : ''}`}>
                        {n}
                      </span>
                    ))}
                    <span class="cr-total">{rollTotal(r)}</span>
                  </div>
                )
              })}
            </div>
          )}
          <p class="label cr-label-gap">¿Has tirado dados de verdad? Escribe los seis resultados</p>
          <div class="cr-typed">
            {typed.map((t, i) => (
              <input key={i} class="input num" inputMode="numeric" aria-label={`Tirada ${i + 1}`} placeholder="—" value={t} onInput={(e) => type(i, (e.currentTarget as HTMLInputElement).value)} />
            ))}
          </div>
        </div>
      )}

      {base && (
        <Section
          title="Tus puntuaciones"
          count={d.method === 'puntos' ? `Quedan ${POINT_BUDGET - cost} de ${POINT_BUDGET}` : undefined}
          hint={d.method === 'puntos' ? (cost < POINT_BUDGET ? 'Te sobran puntos: súbele algo a lo que más uses.' : undefined) : sel ? `Ahora toca la característica con la que quieres cambiar ${ABILITY_NAMES[sel]}.` : 'Toca dos para intercambiarlas.'}
        >
          <div class="list">
            {ABILITIES.map((a) =>
              d.method === 'puntos' ? (
                <div class="li cr-ab" key={a}>
                  <span class="grow">
                    <strong>{ABILITY_NAMES[a]}</strong>
                    {primary.has(a) && <span class="tag">Principal</span>}
                    <span class="cr-sub">{ABILITY_HINT[a]}</span>
                  </span>
                  <Stepper compact value={base[a]} min={8} max={cap(a)} label={ABILITY_NAMES[a]} onChange={(v) => set((x) => (x.base ? { ...x, base: { ...x.base, [a]: v } } : x))} />
                </div>
              ) : (
                <button type="button" class={`li cr-ab ${sel === a ? 'cr-sel' : ''}`} key={a} aria-pressed={sel === a} onClick={() => swap(a)}>
                  <span class="grow">
                    <strong>{ABILITY_NAMES[a]}</strong>
                    {primary.has(a) && <span class="tag">Principal</span>}
                    <span class="cr-sub">{ABILITY_HINT[a]}</span>
                  </span>
                  <span class="cr-score">{base[a]}</span>
                </button>
              ),
            )}
          </div>
        </Section>
      )}

      {bg && <BonusEditor d={d} set={set} rules={rules} />}

      {fin && (
        // Como en la ficha (Habilidades): el modificador grande y la puntuación pequeña debajo.
        <Section title="Resultado" hint="Así quedan, con lo que suma tu trasfondo. El número grande es lo que sumas al d20; el pequeño, la puntuación.">
          <div class="grid3">
            {ABILITIES.map((a) => (
              <div class="vital cr-res" key={a}>
                <div class="label">{ABILITY_NAMES[a]}</div>
                <div class="v">{signed(fin[a].mod)}</div>
                <div class="cr-res-score" title="Puntuación">
                  {fin[a].score}
                </div>
                {fin[a].bonus ? (
                  <div class="s">
                    {fin[a].base} + {fin[a].bonus}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

function BonusEditor({ d, set, rules }: Pick<StepProps, 'd' | 'set' | 'rules'>) {
  const bg = rules.background(d.backgroundId ?? '')!
  const cls = rules.cls(d.classId ?? '')
  const bonus = d.bonus ?? {}
  const entries = Object.entries(bonus).filter(([, v]) => v) as [Ability, number][]
  const triple = entries.length === 3
  const two = entries.find(([, v]) => v === 2)?.[0]
  const one = entries.find(([, v]) => v === 1)?.[0]
  const opts = bg.abilities.map((a) => ({ id: a, name: ABILITY_NAMES[a] }))
  const put = (b: Partial<Record<Ability, number>>) => set((x) => ({ ...x, bonus: b }))
  return (
    <Section title="Lo que suma tu trasfondo" hint={`${bg.name} deja subir ${andList(bg.abilities.map((a) => ABILITY_NAMES[a]))}: +2 a una y +1 a otra, o +1 a las tres. Ya va repartido para tu clase.`}>
      <div class="cr-seg" role="group" aria-label="Reparto">
        <button type="button" aria-pressed={!triple} onClick={() => !triple || put(recommendedBonus(bg, cls, d.base))}>
          +2 y +1
        </button>
        <button type="button" aria-pressed={triple} onClick={() => put(Object.fromEntries(bg.abilities.map((a) => [a, 1])))}>
          +1 a las tres
        </button>
      </div>
      {!triple && (
        <div class="cr-bonus">
          <p class="label">+2 a</p>
          <Chips label="+2 a" max={1} selected={two ? [two] : []} options={opts} onChange={(ids) => {
            const a = ids[0] as Ability | undefined
            if (!a) return put(one ? { [one]: 1 } : {})
            put({ [a]: 2, ...(one && one !== a ? { [one]: 1 } : two && two !== a ? { [two]: 1 } : {}) })
          }} />
          <p class="label">+1 a</p>
          <Chips label="+1 a" max={1} selected={one ? [one] : []} options={opts.map((o) => ({ ...o, disabled: o.id === two }))} onChange={(ids) => {
            const a = ids[0] as Ability | undefined
            put({ ...(two ? { [two]: 2 } : {}), ...(a ? { [a]: 1 } : {}) })
          }} />
        </div>
      )}
    </Section>
  )
}

/* ---------- Habilidades y rasgos ---------- */

const MASTERY_SHORT: Record<string, string> = {
  debilitar: 'su próximo ataque, con desventaja',
  derribar: 'puede caer derribado',
  empujar: 'lo apartas 3 m',
  hender: 'golpeas también a otro que esté al lado',
  mellar: 'el ataque con la segunda arma ligera no gasta tu acción adicional',
  molestar: 'tu siguiente ataque contra él, con ventaja',
  ralentizar: 'pierde 3 m de velocidad',
  rozar: 'aunque falles, le haces algo de daño',
}

export function StepSkills({ d, set, rules }: StepProps) {
  const cls = rules.cls(d.classId ?? '')
  // Vista previa sin las elecciones de clase: así ChoiceEditor ve todas las opciones.
  const base = useMemo(() => buildCharacter({ ...d, classChoices: {} }, rules), [d, rules])
  const bx = useMemo(() => derive(base, rules), [base, rules])
  if (!cls) return null
  const n = cls.skillChoices.count
  const taken = draftSkills({ ...d, classSkills: [] }, rules)
  const pool = classSkillPool(cls).filter((s) => !taken.includes(s))
  const tr = toolRule(cls.toolText)
  const nm = masteryCount(cls)
  return (
    <>
      <Section
        title="Habilidades de clase"
        count={`${(d.classSkills ?? []).length}/${n}`}
        hint={
          <>
            Elige {n} de la lista de {cls.name.toLowerCase()}.{taken.length > 0 && <> Ya eres competente en {andList(taken.map(skillName))} por tu trasfondo y especie, así que no salen aquí.</>}
          </>
        }
      >
        <Chips label="Habilidades de clase" max={n} selected={d.classSkills ?? []} options={skillOptions(pool)} onChange={(ids) => set((x) => ({ ...x, classSkills: ids as Draft['classSkills'] }))} />
      </Section>

      {tr && (
        <Section title="Herramientas" count={tr.fixed ? undefined : `${(d.classTools ?? []).length}/${tr.count}`} hint={tr.fixed ? `Tu clase te enseña a usar: ${tr.fixed}.` : `${tr.text}.`}>
          {!tr.fixed && <Chips label="Herramientas de clase" max={tr.count} selected={d.classTools ?? []} options={tr.options.map((t) => ({ id: t, name: t }))} onChange={(ids) => set((x) => ({ ...x, classTools: ids }))} />}
        </Section>
      )}

      {classFeatureChoices(cls).map(({ feature, choice }) => (
        <Section key={choice.id} title={feature.name} count={choice.count > 1 ? `${(d.classChoices[choice.id] ?? []).length}/${choice.count}` : undefined} hint={feature.summary}>
          <div class="cr-choice">
            <ChoiceEditor
              c={base}
              d={bx}
              feature={feature}
              choice={choice}
              level={1}
              value={{ ids: d.classChoices[choice.id] ?? [] }}
              onChange={(v) => set((x) => ({ ...x, classChoices: { ...x.classChoices, [choice.id]: v.ids } }))}
            />
          </div>
          {choice.kind === 'invocacion' && <p class="cr-note">Solo salen las que se pueden coger a nivel 1. Si eliges un pacto, lo que trae (familiar, arma, libro) lo apuntas luego en la ficha.</p>}
        </Section>
      ))}

      {nm > 0 && <MasteryPick d={d} set={set} rules={rules} />}
    </>
  )
}

function MasteryPick({ d, set, rules }: Pick<StepProps, 'd' | 'set' | 'rules'>) {
  const cls = rules.cls(d.classId ?? '')!
  const nm = masteryCount(cls)
  const all = masteryWeapons(cls, rules)
  const kitIds = new Set(cls.startingEquipment.flatMap((e) => weaponsInText(e.text, rules).map((w) => w.id)))
  const rec = new Set(recommendedMasteries(cls, rules, d.equipClass))
  const chosen = d.masteries ?? []
  const order = [...rec, ...chosen]
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : 99)
  const kit = all.filter((w) => kitIds.has(w.id) || chosen.includes(w.id)).sort((a, b) => rank(a.id) - rank(b.id))
  const rest = all.filter((w) => !kit.includes(w))
  const toggle = (id: string) =>
    set((x) => {
      const cur = x.masteries ?? []
      return { ...x, masteries: cur.includes(id) ? cur.filter((y) => y !== id) : cur.length < nm ? [...cur, id] : cur }
    })
  const row = (w: WeaponData) => {
    const on = chosen.includes(w.id)
    return (
      <Option key={w.id} on={on} disabled={!on && chosen.length >= nm} onClick={() => toggle(w.id)}>
        <span class="cr-opt-head">
          <strong>{w.name}</strong>
          {rec.has(w.id) && <span class="tag">Recomendada</span>}
        </span>
        <span class="cr-sub">
          {w.damage} {w.damageType}. {rules.mastery(w.mastery)?.name ?? w.mastery}: {MASTERY_SHORT[w.mastery] ?? ''}.
        </span>
      </Option>
    )
  }
  return (
    <Section
      title="Maestría con armas"
      count={`${chosen.length}/${nm}`}
      hint={`Con ${nm} tipos de arma usas su efecto especial (maestría) cada vez que aciertas. Lo recomendado son las de tu equipo inicial; puedes cambiar una tras cada descanso largo.`}
    >
      <div class="cr-opts">{kit.map(row)}</div>
      <FullNote full={nm > 1 && chosen.length >= nm} max={nm} fem />
      {rest.length > 0 && (
        <details class="cr-more-tools">
          <summary>Otras armas</summary>
          <div class="cr-opts">{rest.map(row)}</div>
        </details>
      )}
    </Section>
  )
}

/* ---------- Conjuros ---------- */

type Group = { id: string; label: string; max: number; selected: string[]; pool: SpellData[]; locked?: string[]; toggle: (id: string) => void; note?: string }

const toggleIn = (xs: string[], id: string, max: number) => (xs.includes(id) ? xs.filter((x) => x !== id) : max === 1 ? [id] : xs.length < max ? [...xs, id] : xs)

export function StepSpells({ d, set, rules }: StepProps) {
  const cls = rules.cls(d.classId ?? '')
  const needs = spellNeeds(d, rules)
  const classPool = useClassPool(d.classId ?? '', 1)
  const spell = (id: string) => rules.spell(id)
  const specKnown = speciesSpells(d, rules).map((s) => s.id)
  const featKnown = [d.bgFeat, d.speciesFeat].flatMap((p) => p?.choices.trucos ?? [])
  const always = classAlwaysPrepared(d.classId)
  const ofList = (list: string, lvl: 0 | 1) => listSpells(rules, list, lvl).map(spell).filter((s): s is SpellData => !!s)

  const groups: Group[] = []
  if (needs.cantrips) {
    const avoid = new Set([...specKnown, ...featKnown, ...(d.orderCantrip ?? [])])
    groups.push({
      id: 'trucos',
      label: 'Trucos',
      max: needs.cantrips,
      selected: d.cantrips ?? [],
      pool: classPool.cantrips.filter((s) => !avoid.has(s.id)),
      toggle: (id) => set((x) => ({ ...x, cantrips: toggleIn(x.cantrips ?? [], id, needs.cantrips) })),
      note: 'Los trucos se lanzan siempre que quieras, sin gastar nada.',
    })
  }
  if (needs.prepared) {
    groups.push({
      id: 'preparados',
      label: 'Conjuros',
      max: needs.prepared,
      selected: d.prepared ?? [],
      pool: classPool.leveled,
      locked: always,
      toggle: (id) => set((x) => ({ ...x, prepared: toggleIn(x.prepared ?? [], id, needs.prepared) })),
      note: `Cada uno gasta un espacio de conjuro. Preparas ${needs.prepared}; tras un descanso largo puedes cambiarlos.${always.length ? ` ${andList(always.map((id) => spell(id)?.name ?? id))} lo tienes siempre preparado y no cuenta.` : ''}`,
    })
  }
  if (needs.order) {
    const avoid = new Set([...specKnown, ...(d.cantrips ?? []), ...featKnown])
    groups.push({
      id: 'orden',
      label: `Truco de ${needs.order.label}`,
      max: 1,
      selected: d.orderCantrip ?? [],
      pool: ofList(needs.order.list, 0).filter((s) => !avoid.has(s.id)),
      toggle: (id) => set((x) => ({ ...x, orderCantrip: toggleIn(x.orderCantrip ?? [], id, 1) })),
      note: `${needs.order.label} te da un truco más de tu lista.`,
    })
  }
  for (const need of needs.feats) {
    const p = d[need.key]!
    const owner = need.key === 'bgFeat' ? 'del trasfondo' : 'de especie'
    const otherKnown = new Set([...specKnown, ...(d.cantrips ?? []), ...(d.orderCantrip ?? []), ...[d.bgFeat, d.speciesFeat].filter((q) => q !== p).flatMap((q) => q?.choices.trucos ?? [])])
    const upd = (k: 'trucos' | 'conjuro', id: string, max: number) =>
      set((x) => {
        const q = x[need.key]
        if (!q) return x
        return { ...x, [need.key]: { ...q, choices: { ...q.choices, [k]: toggleIn(q.choices[k] ?? [], id, max) } } }
      })
    const listName = rules.cls(need.list)?.name.toLowerCase() ?? need.list
    groups.push({
      id: `${need.key}-trucos`,
      label: needs.feats.length > 1 ? `Trucos de la dote ${owner}` : 'Trucos de la dote',
      max: 2,
      selected: p.choices.trucos ?? [],
      pool: ofList(need.list, 0).filter((s) => !otherKnown.has(s.id)),
      toggle: (id) => upd('trucos', id, 2),
      note: `Iniciado en la magia: 2 trucos de la lista de ${listName}.`,
    })
    groups.push({
      id: `${need.key}-conjuro`,
      label: needs.feats.length > 1 ? `Conjuro de la dote ${owner}` : 'Conjuro de la dote',
      max: 1,
      selected: p.choices.conjuro ?? [],
      pool: ofList(need.list, 1),
      toggle: (id) => upd('conjuro', id, 1),
      note: `Iniciado en la magia: 1 conjuro de nivel 1 de la lista de ${listName}. Siempre lo tienes preparado y puedes lanzarlo gratis una vez por descanso largo.`,
    })
  }

  const [tab, setTab] = useState(groups[0]?.id)
  const cur = groups.find((g) => g.id === tab) ?? groups[0]
  if (!cur) return null
  return (
    <>
      <Section title="Lo que llevas" hint="Para cambiar algo, toca su grupo y marca o desmarca en la lista de abajo.">
        <div class="list">
          {groups.map((g) => (
            <button type="button" key={g.id} class={`li cr-row ${g.id === cur.id ? 'cr-row-on' : ''}`} onClick={() => setTab(g.id)} aria-pressed={g.id === cur.id}>
              <span class="grow">
                <span class="label">
                  {g.label} ({g.selected.length}/{g.max})
                </span>
                <span class="cr-val">{g.selected.length ? andList(g.selected.map((id) => spell(id)?.name ?? id)) : 'Sin elegir'}</span>
              </span>
              <span class="cr-edit">{g.id === cur.id ? 'Abierto' : 'Cambiar'}</span>
            </button>
          ))}
        </div>
        {specKnown.length > 0 && (
          <p class="cr-note">
            Por tu especie ya conoces {andList(specKnown.map((id) => spell(id)?.name ?? id))}; no hace falta {specKnown.length > 1 ? 'elegirlos' : 'elegirlo'}.
          </p>
        )}
        {cls?.spellcasting && <p class="cr-note">Lanzas los conjuros de {cls.name.toLowerCase()} con {ABILITY_NAMES[cls.spellcasting.ability]}.</p>}
      </Section>
      <Section title={cur.label} count={`${cur.selected.length}/${cur.max}`} hint={cur.note}>
        <SpellPicker key={cur.id} pool={cur.pool} selected={cur.selected} max={cur.max} locked={cur.locked} onToggle={cur.toggle} />
      </Section>
    </>
  )
}
