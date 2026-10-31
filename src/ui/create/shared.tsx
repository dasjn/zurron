// Piezas comunes del asistente de crear personaje (prefijo de clases .cr-).

import type { ComponentChildren } from 'preact'
import type { Ability, SkillId } from '../../data/types'
import type { Character } from '../../model/character'
import type { Rules } from '../../rules/book'
import { ABILITY_NAMES, SKILLS } from '../../rules/constants'
import type { Draft, FeatPick, StepId } from '../../rules/create'
import { ALL_TOOLS, FEAT_INITIATE, FEAT_SKILLED, INITIATE_LISTS, slug, toolName } from '../../rules/create'
import type { Derived } from '../../rules/derive'

export interface StepProps {
  d: Draft
  /** Cambia el borrador (se normaliza y se guarda solo). */
  set: (fn: (d: Draft) => Draft) => void
  rules: Rules
  /** Ficha tal y como quedaría ahora. */
  c: Character
  x: Derived
  goTo: (s: StepId) => void
}

export function Section({ title, count, hint, children }: { title: string; count?: string; hint?: ComponentChildren; children?: ComponentChildren }) {
  return (
    <section class="cr-sec">
      <h2>
        {title}
        {count && <span class="cr-n">{count}</span>}
      </h2>
      {hint && <p class="cr-hint">{hint}</p>}
      {children}
    </section>
  )
}

export interface ChipOption {
  id: string
  name: string
  disabled?: boolean
}

/**
 * Fichas para marcar. Con max 1 funcionan como radio; al llegar al máximo, las demás se apagan
 * y una línea dice por qué. `fullNote={false}` en la segunda lista de una misma elección
 * (idiomas inusuales, herramientas) para no repetir la línea.
 */
export function Chips({
  options,
  selected,
  max,
  onChange,
  label,
  fullNote = true,
}: {
  options: ChipOption[]
  selected: string[]
  max: number
  onChange: (ids: string[]) => void
  label: string
  fullNote?: boolean
}) {
  const full = selected.length >= max
  return (
    <>
      <div class="chips cr-chips" role="group" aria-label={label}>
        {options.map((o) => {
          const on = selected.includes(o.id)
          const off = !on && (o.disabled || (full && max > 1))
          return (
            <button
              key={o.id}
              type="button"
              class={`chip ${on ? 'on' : ''}`}
              aria-pressed={on}
              disabled={off}
              onClick={() => {
                if (on) onChange(selected.filter((x) => x !== o.id))
                else if (max === 1) onChange([o.id])
                else if (!full) onChange([...selected, o.id])
              }}
            >
              {o.name}
            </button>
          )
        })}
      </div>
      {fullNote && <FullNote full={full && max > 1 && options.some((o) => !selected.includes(o.id))} max={max} />}
    </>
  )
}

/** «Ya tienes 2…»: por qué las demás opciones están apagadas. */
export function FullNote({ full, max, fem }: { full: boolean; max: number; fem?: boolean }) {
  return (
    <p class="cr-full" role="status">
      {full ? (fem ? `Ya tienes ${max}. Quita una de las marcadas para elegir otra.` : `Ya tienes ${max}. Quita uno de los marcados para elegir otro.`) : ''}
    </p>
  )
}

export const skillOptions = (ids: SkillId[]): ChipOption[] => SKILLS.filter((s) => ids.includes(s.id)).map((s) => ({ id: s.id, name: s.name }))
export const skillName = (id: string) => SKILLS.find((s) => s.id === id)?.name ?? toolName(id)

export const CASTING: Ability[] = ['int', 'sab', 'car']
const LIST_NAMES: Record<string, string> = { clerigo: 'Clérigo', druida: 'Druida', mago: 'Mago' }

/** Lista en castellano: «a, b y c». */
export function andList(xs: string[]): string {
  if (xs.length < 2) return xs.join('')
  return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`
}

/** Elecciones de una dote de origen (Iniciado en la magia, Habilidoso) en los pasos de trasfondo y especie. */
export function FeatChoices({
  pick,
  onChange,
  fixedList,
  avoidList,
  taken,
  recommendedAbility,
}: {
  pick: FeatPick
  onChange: (p: FeatPick) => void
  /** Lista que fija el trasfondo («Iniciado en la magia (clérigo)»). */
  fixedList?: string
  /** Lista que ya usa otra copia de la dote. */
  avoidList?: string
  /** Habilidades que ya da otra cosa. */
  taken: string[]
  recommendedAbility: Ability
}) {
  const setChoice = (k: string, v: string[]) => onChange({ ...pick, choices: { ...pick.choices, [k]: v } })
  if (pick.id === FEAT_INITIATE) {
    const list = pick.choices.lista?.[0]
    return (
      <div class="cr-feat">
        {!fixedList && (
          <>
            <p class="label">Lista de conjuros</p>
            <Chips
              label="Lista de conjuros"
              max={1}
              selected={list ? [list] : []}
              options={INITIATE_LISTS.map((l) => ({ id: l, name: LIST_NAMES[l], disabled: l === avoidList }))}
              onChange={(ids) => onChange({ ...pick, choices: { ...pick.choices, lista: ids, trucos: [], conjuro: [] } })}
            />
          </>
        )}
        <p class="label">Característica para lanzar estos conjuros</p>
        <Chips
          label="Aptitud mágica"
          max={1}
          selected={pick.choices.aptitud ?? []}
          options={CASTING.map((a) => ({ id: a, name: ABILITY_NAMES[a] }))}
          onChange={(ids) => setChoice('aptitud', ids)}
        />
        <p class="cr-note">
          Lo normal es la de tu clase si lanza conjuros; si no, la más alta de las tres. Te recomiendo {ABILITY_NAMES[recommendedAbility]}. Los trucos y el conjuro los eliges en el paso de Conjuros.
        </p>
      </div>
    )
  }
  if (pick.id === FEAT_SKILLED) {
    const sel = pick.choices.competencias ?? []
    const skills = SKILLS.filter((s) => !taken.includes(s.id) || sel.includes(s.id)).map((s) => ({ id: s.id, name: s.name }))
    const tools = ALL_TOOLS.map((t) => ({ id: slug(t), name: t }))
    const toolSel = sel.filter((id) => !SKILLS.some((s) => s.id === id))
    return (
      <div class="cr-feat">
        <p class="label">Tres habilidades o herramientas ({sel.length}/3)</p>
        <Chips label="Habilidoso" max={3} selected={sel} options={skills} onChange={(ids) => setChoice('competencias', [...ids])} />
        <details class="cr-more-tools" open={toolSel.length > 0}>
          <summary>Prefiero alguna herramienta</summary>
          <Chips label="Herramientas" max={3} selected={sel} options={tools} fullNote={false} onChange={(ids) => setChoice('competencias', [...ids])} />
        </details>
      </div>
    )
  }
  return null
}
