import { useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import type { Ability, ChoiceDef, ChoiceOption, FeatData, Feature, SkillId } from '../data/types'
import { ABILITIES } from '../data/types'
import type { Character } from '../model/character'
import { ABILITY_NAMES, FEAT, SKILLS } from '../rules/constants'
import { RARE_LANGUAGES, STANDARD_LANGUAGES } from '../rules/create'
import type { Derived, Origin } from '../rules/derive'
import {
  applyChoiceValue,
  choiceOptions,
  recommendAltCantrips,
  recommendFeat,
  recommendFeatAbility,
  spellChoicePool,
  spellChoiceValue,
  styleChoiceValue,
  type ChoiceValue,
} from '../rules/levelup'
import { Icon, Option, RichText, useRules } from './common'
import { SpellPicker } from './SpellEditor'
import './css/fichero.css'
import './css/combate.css'

export type { ChoiceValue }
export { choiceMissing, choiceReady } from '../rules/levelup'

/** Aplica una elección ya hecha a la ficha (desde la pestaña Rasgos). */
export function applyChoice(c: Character, feature: Feature, choice: ChoiceDef, v: ChoiceValue): Character {
  void feature
  return applyChoiceValue(c, choice, v)
}

const FREE_TEXT = new Set(['idioma', 'herramienta', 'truco', 'metamagia', 'invocacion'])

const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}`
const andList = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`)

/** Primera frase de un texto largo, sin negritas (para la línea corta de una opción). */
function firstSentence(t: string): string {
  const plain = t.replace(/\*\*[^*]+\*\*\s*/g, '').split('\n')[0]
  const m = plain.match(/^.{20,180}?[.:](?=\s|$)/)
  return m ? m[0] : plain
}

/**
 * Opción con «Leer más»: una línea corta y, a la derecha, un botón que despliega
 * el texto entero. Las de texto corto se leen enteras sin botón.
 */
function OptionRow({ o, on, radio, disabled, onClick }: { o: ChoiceOption; on: boolean; radio: boolean; disabled: boolean; onClick: () => void }) {
  const [open, setOpen] = useState(false)
  const text = o.text ?? ''
  // Con resumen, el texto entero queda tras «Leer más» si es largo; si es corto, se lee entero.
  const long = text.length > 200 || (!!o.summary && text.length > 140)
  const short = o.summary ?? (long ? firstSentence(text) : '')
  return (
    <div class="cb-pick">
      <div class="cb-pick-row">
        <Option on={on} radio={radio} onClick={onClick} disabled={disabled}>
          <span class="fx-opt-name">{o.name}</span>
          {long ? (
            <span class="fx-opt-text">{short}</span>
          ) : (
            text && (
              <span class="fx-opt-text">
                <RichText text={text} />
              </span>
            )
          )}
        </Option>
        {long && (
          <button class="cb-pick-info" aria-expanded={open} aria-label={`Leer más sobre ${o.name}`} onClick={() => setOpen(!open)}>
            <Icon name="glosario" size={20} />
            {open ? 'Cerrar' : 'Leer más'}
          </button>
        )}
      </div>
      {long && open && (
        <div class="card cb-pick-body">
          <RichText text={text} class="small" />
        </div>
      )}
    </div>
  )
}

export function ChoiceEditor({
  c,
  d,
  feature,
  choice,
  level,
  value,
  onChange,
  origin = 'clase',
  subclassId,
  maxSlot,
}: {
  c: Character
  d: Derived
  feature: Feature
  choice: ChoiceDef
  /** Nivel de clase al que se elige (para los requisitos de las opciones). */
  level: number
  value: ChoiceValue | undefined
  onChange: (v: ChoiceValue) => void
  origin?: Origin
  /** Subclase recién elegida en el asistente (aún no está en la ficha). */
  subclassId?: string
  /** Nivel de espacio más alto tras subir (para elegir conjuros). */
  maxSlot?: number
}) {
  const rules = useRules()
  const v = value ?? { ids: [] }
  const toggle = (id: string) => {
    const ids = v.ids.includes(id) ? v.ids.filter((x) => x !== id) : choice.count === 1 ? [id] : v.ids.length < choice.count ? [...v.ids, id] : v.ids
    const next: ChoiceValue = { ...v, ids }
    if (choice.kind === 'pericia') next.expertise = ids as SkillId[]
    if (choice.kind === 'habilidad') next.skills = ids as SkillId[]
    onChange(next)
  }
  const radio = choice.count === 1
  /** Lleno: las opciones sin marcar se apagan, y esta línea dice por qué y qué hacer. */
  const full = !radio && v.ids.length >= choice.count
  const fullHint = (
    <p class="notice fx-ce-full num" role="status">
      Ya tienes {choice.count}. Quita una para elegir otra.
    </p>
  )
  /** «Elige 2. Llevas 1 de 2.» Solo cuando se elige más de una cosa. */
  const counter =
    choice.count > 1 &&
    (full ? (
      fullHint
    ) : (
      <p class="fx-ce-hint">
        Elige {choice.count}.{' '}
        <strong class="num">
          Llevas {v.ids.length} de {choice.count}.
        </strong>
      </p>
    ))

  if (choice.kind === 'estilo-combate') return <StyleChoice c={c} d={d} feature={feature} choice={choice} value={v} onChange={onChange} origin={origin} />

  if (choice.kind === 'conjuro') {
    const pool = spellChoicePool(rules, choice, maxSlot ?? d.spell?.maxSpellLevel ?? 9)
    const onePer = choice.spells?.onePerLevel
    const pick = (id: string) => {
      let ids = v.ids.includes(id) ? v.ids.filter((x) => x !== id) : [...v.ids, id]
      // Maestría sobre conjuros: uno de cada nivel; el nuevo sustituye al del mismo nivel.
      if (onePer && !v.ids.includes(id)) {
        const lvl = rules.spell(id)?.level
        ids = [...v.ids.filter((x) => rules.spell(x)?.level !== lvl), id]
      }
      if (ids.length > choice.count) return
      onChange(spellChoiceValue(c, rules, origin, feature, choice, ids))
    }
    return (
      <div class="fx-ce">
        {choice.note && <p class="fx-ce-hint">{choice.note}</p>}
        {pool.length ? (
          <SpellPicker pool={pool} selected={v.ids} max={choice.count} onToggle={pick} />
        ) : (
          <p class="notice">No hay conjuros que cumplan lo que pide este rasgo en las reglas cargadas. Apúntalo en las notas de la ficha.</p>
        )}
      </div>
    )
  }

  if (choice.kind === 'pericia' || choice.kind === 'habilidad') {
    const limit = choice.options?.length ? new Set(choice.options.map((o) => o.id)) : undefined
    const pool = (choice.kind === 'pericia' ? SKILLS.filter((s) => c.skills.includes(s.id) && !c.expertise.includes(s.id)) : SKILLS.filter((s) => !c.skills.includes(s.id))).filter(
      (s) => !limit || limit.has(s.id),
    )
    return (
      <div class="fx-ce">
        {(choice.kind === 'pericia' || !full) && (
          <p class="fx-ce-hint">
            {choice.kind === 'pericia' ? `Elige ${choice.count === 1 ? 'una habilidad' : `${choice.count} habilidades`} en las que ya seas competente: sumarás el doble de tu bonificador por competencia.` : `Elige ${choice.count}.`}
            {choice.count > 1 && !full && (
              <>
                {' '}
                <strong class="num">
                  Llevas {v.ids.length} de {choice.count}.
                </strong>
              </>
            )}
          </p>
        )}
        {full && fullHint}
        {pool.map((s) => (
          <Option key={s.id} on={v.ids.includes(s.id)} radio={radio} onClick={() => toggle(s.id)} disabled={full && !v.ids.includes(s.id)}>
            <span class="fx-opt-name">{s.name}</span>
            <span class="fx-opt-text num">
              {ABILITY_NAMES[s.ability]} · ahora {signed(d.skills[s.id].bonus)}
            </span>
          </Option>
        ))}
        {!!choice.languages && <LanguagePick c={c} n={choice.languages} selected={v.languages ?? []} onChange={(languages) => onChange({ ...v, languages })} />}
      </div>
    )
  }

  if (choice.kind === 'dote' || choice.kind === 'don-epico' || choice.kind === 'dote-origen') {
    return <FeatChoice c={c} d={d} choice={choice} level={level} value={v} onChange={onChange} />
  }

  // Opciones: las suyas o las del mismo rasgo en otro nivel, sin las ya elegidas y con sus requisitos cumplidos.
  const options = choiceOptions(c, rules, choice, level, v.ids, subclassId)
  if (choice.kind === 'opcion' || options.length > 0) {
    return (
      <div class="fx-ce">
        {choice.note && options.length === 0 && <p class="fx-ce-hint">{choice.note}</p>}
        {counter}
        {options.map((o) => (
          <OptionRow key={o.id} o={o} on={v.ids.includes(o.id)} radio={radio} disabled={full && !v.ids.includes(o.id)} onClick={() => toggle(o.id)} />
        ))}
      </div>
    )
  }

  if (FREE_TEXT.has(choice.kind)) {
    return (
      <div class="fx-ce">
        {choice.note && <p class="fx-ce-hint">{choice.note}</p>}
        <label class="field">
          <span class="label">
            Escribe lo que elijas ({choice.count}), separado por comas. Lo puedes cambiar luego.
          </span>
          <input
            class="input"
            value={v.ids.join(', ')}
            onInput={(e) => onChange({ ...v, ids: (e.currentTarget as HTMLInputElement).value.split(',').map((x) => x.trim()).filter(Boolean) })}
            aria-label={feature.name}
          />
        </label>
      </div>
    )
  }
  return <p class="muted fx-ce-hint">Esta elección se hace en otro paso.</p>
}

/** Idiomas que da un rasgo además de su elección (Explorador hábil). */
function LanguagePick({ c, n, selected, onChange }: { c: Character; n: number; selected: string[]; onChange: (ids: string[]) => void }) {
  const known = new Set(c.languages)
  const full = selected.length >= n
  const row = (l: string) => (
    <Option key={l} on={selected.includes(l)} disabled={full && !selected.includes(l)} onClick={() => onChange(selected.includes(l) ? selected.filter((x) => x !== l) : full ? selected : [...selected, l])}>
      <span class="fx-opt-name">{l}</span>
    </Option>
  )
  const rare = RARE_LANGUAGES.filter((l) => !known.has(l))
  return (
    <>
      <h2>Idiomas</h2>
      <p class="fx-ce-hint">
        Aprendes {n === 1 ? 'un idioma' : `${n} idiomas`}.{' '}
        <strong class="num">
          Llevas {selected.length} de {n}.
        </strong>
      </p>
      {STANDARD_LANGUAGES.filter((l) => !known.has(l)).map(row)}
      {rare.length > 0 && (
        <>
          <p class="fx-ce-note">Idiomas inusuales, solo si la DM lo permite:</p>
          {rare.map(row)}
        </>
      )}
    </>
  )
}

/** Estilo de combate: las dotes de estilo y, en explorador y paladín, la opción de dos trucos. */
function StyleChoice({ c, d, feature, choice, value, onChange, origin }: { c: Character; d: Derived; feature: Feature; choice: ChoiceDef; value: ChoiceValue; onChange: (v: ChoiceValue) => void; origin: Origin }) {
  const rules = useRules()
  const chosen = value.ids[0]
  // el estilo que ya tiene sigue en la lista (si no, no se ve marcado ni se puede volver a él)
  const feats = rules.book.feats.filter((f) => f.category === 'estilo-combate' && (!d.featIds.has(f.id) || (c.choices[choice.id] ?? []).includes(f.id)))
  const alts = (choice.options ?? []).filter((o) => o.cantrips)
  const alt = alts.find((o) => o.id === chosen)
  const altCantrips = (value.extra ?? []).map((e) => e.id)
  const pickAlt = (o: ChoiceOption) => onChange(styleChoiceValue(origin, feature, choice, o.id, recommendAltCantrips(c, rules, o)))
  const list = alt ? new Set(rules.cls(alt.cantrips!.list)?.spellList ?? []) : undefined
  const have = new Set([...c.spells.cantrips, ...c.spells.extra.filter((e) => !(value.extraSources ?? []).includes(e.source)).map((e) => e.id)])
  const pool = list ? rules.book.spells.filter((s) => s.level === 0 && list.has(s.id) && !have.has(s.id)) : []
  return (
    <div class="fx-ce">
      <FeatList feats={feats} selected={value.ids} radio onToggle={(id) => onChange(styleChoiceValue(origin, feature, choice, id))} />
      {alts.map((o) => (
        <OptionRow key={o.id} o={{ ...o, summary: `En lugar de una dote: dos trucos de ${rules.cls(o.cantrips!.list)?.name.toLowerCase() ?? o.cantrips!.list} que lanzas con ${ABILITY_NAMES[o.cantrips!.ability]}.` }} on={chosen === o.id} radio disabled={false} onClick={() => pickAlt(o)} />
      ))}
      {alt && (
        <>
          <h2>Trucos de {alt.name}</h2>
          <p class="fx-ce-hint">Van recomendados {andList((alt.cantrips!.suggested ?? []).map((id) => rules.spell(id)?.name.toLowerCase() ?? id))}; puedes cambiarlos.</p>
          <SpellPicker
            pool={pool}
            selected={altCantrips}
            max={alt.cantrips!.count}
            onToggle={(id) => onChange(styleChoiceValue(origin, feature, choice, alt.id, altCantrips.includes(id) ? altCantrips.filter((x) => x !== id) : [...altCantrips, id]))}
          />
        </>
      )}
    </div>
  )
}

function FeatList({ feats, selected, radio, onToggle }: { feats: FeatData[]; selected: string[]; radio?: boolean; onToggle: (id: string) => void }) {
  return (
    <div class="fx-featlist">
      {feats.map((f) => (
        <Option key={f.id} on={selected.includes(f.id)} radio={radio} onClick={() => onToggle(f.id)}>
          <span class="fx-opt-name">{f.name}</span>
          {/* los estilos de combate piden todos el mismo rasgo, que ya tienes si llegas aquí */}
          {f.prerequisite && f.category !== 'estilo-combate' && <span class="fx-opt-text">Requisito: {f.prerequisite}</span>}
          <span class="fx-opt-text">{f.summary ?? f.text.replace(/\*\*/g, '').split('\n')[0].slice(0, 180)}</span>
        </Option>
      ))}
    </div>
  )
}

function FeatChoice({ c, d, choice, level, value, onChange }: { c: Character; d: Derived; choice: ChoiceDef; level: number; value: ChoiceValue; onChange: (v: ChoiceValue) => void }) {
  const rules = useRules()
  const featId = value.feat?.id
  const feat = featId ? rules.feat(featId) : undefined
  const isAsi = featId === FEAT.mejoraCaracteristica
  const [show, setShow] = useState(!!featId && !isAsi)
  const cats = choice.kind === 'don-epico' ? ['don-epico', 'general', 'origen'] : choice.kind === 'dote-origen' ? ['origen'] : ['general', 'origen']
  const feats = rules.book.feats.filter((f) => cats.includes(f.category) && (f.repeatable || !d.featIds.has(f.id) || value.feat?.id === f.id))
  const source = `nivel-${level}`
  const inc = value.feat?.abilityIncrease ?? {}
  const total = Object.values(inc).reduce((a, b) => a + (b ?? 0), 0)
  const maxScore = choice.kind === 'don-epico' ? 30 : 20

  // Al elegir, la subida ya va puesta en la característica que más le sirve a la clase.
  const pick = (id: string) => {
    const f = rules.feat(id)
    let abilityIncrease: Partial<Record<Ability, number>> = {}
    if (id === FEAT.mejoraCaracteristica) abilityIncrease = recommendFeat(c, rules, { ...choice, kind: 'dote' }, level)?.abilityIncrease ?? {}
    else if (f?.abilityIncrease) {
      const a = recommendFeatAbility(c, rules, f.abilityIncrease.options, f.abilityIncrease.amount, f.abilityIncrease.max)
      if (a) abilityIncrease = { [a]: f.abilityIncrease.amount }
    }
    onChange({ ids: [id], feat: { id, source, abilityIncrease } })
  }
  const setInc = (a: Ability, n: number) => {
    const next = { ...inc, [a]: n }
    if (!n) delete next[a]
    onChange({ ...value, feat: { ...value.feat!, abilityIncrease: next } })
  }

  const options: Ability[] = isAsi ? ABILITIES : (feat?.abilityIncrease?.options ?? [])
  const amount = isAsi ? 2 : (feat?.abilityIncrease?.amount ?? 1)
  const cap = feat?.abilityIncrease?.max ?? maxScore

  /** Repartir la subida: debajo de la dote elegida. */
  const picker = (isAsi || (feat?.abilityIncrease && options.length > 0)) && (
    <div class="list fx-asi">
      <div class="fx-asi-head">
        {total >= amount ? (
          <strong class="num">{isAsi ? 'Ya has repartido los 2 puntos. Quita uno para ponerlo en otra característica.' : `Ya has puesto el +${amount}. Quítalo para ponerlo en otra característica.`}</strong>
        ) : isAsi ? (
          <>
            Reparte +2.{' '}
            <strong class="num">Llevas +{total}.</strong>
          </>
        ) : (
          <strong class="num">Elige a qué característica va el +{amount}.</strong>
        )}
      </div>
      {options.map((a) => {
        const cur = d.scores[a]
        const n = inc[a] ?? 0
        const room = Math.min(isAsi ? 2 - (total - n) : amount, cap - cur)
        return (
          <div class="li" key={a}>
            <span class="grow">
              {ABILITY_NAMES[a]}
              <span class="fx-asi-from num">
                {cur}
                {n ? `, ahora ${cur + n}` : ''}
              </span>
            </span>
            <div class="stepper compact">
              <button class="iconbtn" aria-label={`Quitar a ${ABILITY_NAMES[a]}`} disabled={!n} onClick={() => setInc(a, n - 1)}>
                −
              </button>
              <span class="v num">+{n}</span>
              <button
                class="iconbtn"
                aria-label={`Sumar a ${ABILITY_NAMES[a]}`}
                disabled={n >= room || (!isAsi && total >= amount)}
                onClick={() => (isAsi ? setInc(a, n + 1) : onChange({ ...value, feat: { ...value.feat!, abilityIncrease: { [a]: n + 1 } } }))}
              >
                +
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )

  const owned = [...d.featIds].map((id) => rules.feat(id)?.name).filter((x): x is string => !!x)
  return (
    <div class="fx-ce">
      <p class="fx-ce-hint">
        Lo más sencillo es <strong>Mejora de característica</strong>: +2 a una característica o +1 a dos (máximo {maxScore}). Si prefieres una dote, mira las opciones.
      </p>
      {rules.feat(FEAT.mejoraCaracteristica) && (
        <Option on={isAsi} radio onClick={() => pick(FEAT.mejoraCaracteristica)}>
          <span class="fx-opt-name">Mejora de característica</span>
        </Option>
      )}
      {isAsi && picker}
      <button class="btn block fx-more" aria-expanded={show} onClick={() => setShow(!show)}>
        {show ? 'Ocultar dotes' : 'Ver otras dotes'}
      </button>
      {show && <FeatList feats={feats.filter((f) => f.id !== FEAT.mejoraCaracteristica)} selected={featId ? [featId] : []} radio onToggle={pick} />}
      {feat && !isAsi && (
        <FeatCard>
          <h3>{feat.name}</h3>
          <RichText text={feat.text} class="small" />
          {picker}
        </FeatCard>
      )}
      <p class="fx-ce-note">
        Las dotes con más elecciones (p. ej. elegir conjuros) se completan luego en la pestaña Rasgos o Conjuros.
        {owned.length > 0 && <> Dotes que ya tienes: {andList(owned)}.</>}
      </p>
    </div>
  )
}

function FeatCard({ children }: { children: ComponentChildren }) {
  return <div class="card fx-featcard">{children}</div>
}
