// Asistente para crear un personaje de nivel 1 desde cero (reglas de 2024).
// La lógica está en rules/create.ts; aquí solo la pantalla. El borrador se
// guarda en el móvil a cada cambio para no perderlo si se cambia de app.

import { useEffect, useMemo, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import {
  STEP_ORDER,
  STEP_TITLES,
  buildCharacter,
  draftHasProgress,
  emptyDraft,
  fillUpTo,
  normalize,
  recommendStep,
  stepIssues,
  stepsFor,
  type Draft,
  type StepId,
} from '../rules/create'
import type { Rules } from '../rules/book'
import { derive } from '../rules/derive'
import { go, href } from '../router'
import { getCharacter, saveCharacter, useStore } from '../store'
import { paletteStyle, toast, useRules } from './common'
import { StepAbilities, StepSkills, StepSpells } from './create/StepsBuild'
import { StepGear, StepLanguages, StepReview, StepWho } from './create/StepsFinish'
import { StepBackground, StepClass, StepSpecies } from './create/StepsOrigin'
import type { StepProps } from './create/shared'
import './css/crear.css'

const DRAFT_KEY = 'fichaviva:borrador'

function readDraft(): Draft | undefined {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return undefined
    const d = JSON.parse(raw) as Draft
    if (!d || d.v !== 1 || !STEP_ORDER.includes(d.at)) return undefined
    return { ...emptyDraft(), ...d }
  } catch {
    return undefined
  }
}

function writeDraft(d: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
  } catch {
    // sin espacio o almacenamiento bloqueado: el borrador sigue en memoria
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // nada que hacer
  }
}

/** Qué se elige en cada paso y por qué importa (una o dos frases). */
const INTRO: Record<StepId, string> = {
  clase: 'Tu clase es lo que sabes hacer en una aventura: luchar, lanzar conjuros, curar o colarte sin que te vean. Es la decisión que más cambia cómo juegas.',
  trasfondo: 'A qué te dedicabas antes de ser aventurero. Te da dos habilidades, una herramienta, una dote y te deja subir tres características.',
  especie: 'Tu pueblo de origen. Te da rasgos especiales, como ver en la oscuridad o resistir un tipo de daño.',
  caracteristicas: 'Seis números que dicen lo fuerte, ágil, resistente, listo, sabio y carismático que eres. Los más altos van a lo que más usa tu clase.',
  habilidades: 'Las habilidades son lo que se te da bien (Sigilo, Persuasión…): al tirarlas sumas tu bonificador por competencia, +2. Aquí también eliges lo propio de tu clase.',
  conjuros: 'Los trucos se lanzan siempre que quieras; los conjuros gastan un espacio de conjuro. Ya va elegida una selección sencilla para empezar.',
  equipo: 'Lo que llevas encima al empezar. Coge el lote de objetos o el oro para comprarlo tú.',
  idiomas: 'Todo el mundo habla común. Además, sabes otros idiomas que te ayudan a entenderte con otros pueblos.',
  quien: 'Ponle nombre y cara. Lo demás es opcional y lo puedes rellenar luego en la ficha.',
  repaso: 'Así queda tu personaje. Si algo no te convence, toca la fila y cámbialo.',
}

/** En estos pasos lo recomendado ya va puesto: el botón solo deshace los cambios. */
const PREFILLED = new Set<StepId>(['caracteristicas', 'habilidades', 'conjuros', 'equipo', 'idiomas'])

export function Create() {
  const rules = useRules()
  useStore()
  const [stored] = useState(readDraft)
  const [asking, setAsking] = useState(() => draftHasProgress(stored))
  const [d, setD] = useState<Draft>(() => (stored ? normalize(stored, rules) : emptyDraft()))
  // Lo que acaba de hacer «Elegir por mí» en este paso; se borra en cuanto la persona toca otra cosa.
  const [picked, setPicked] = useState<{ at: StepId; text: string } | null>(null)

  useEffect(() => {
    if (!asking) writeDraft(d)
  }, [d, asking])

  const set = (fn: (x: Draft) => Draft) => {
    setPicked(null)
    setD((x) => normalize(fn(x), rules))
  }
  const steps = stepsFor(d, rules)
  const at = steps.includes(d.at) ? d.at : (steps.filter((s) => STEP_ORDER.indexOf(s) < STEP_ORDER.indexOf(d.at)).pop() ?? 'clase')
  const i = steps.indexOf(at)
  const exists = (id: string) => !!getCharacter(id)
  const c = useMemo(() => buildCharacter(d, rules, { exists }), [d, rules])
  const x = useMemo(() => derive(c, rules), [c, rules])
  const issues = stepIssues(d, rules, at)

  const goTo = (s: StepId) => {
    setPicked(null)
    setD((cur) => normalize(fillUpTo({ ...cur, at: s }, rules, s), rules))
    window.scrollTo(0, 0)
  }

  if (asking && stored)
    return (
      <Resume
        draft={stored}
        onContinue={() => {
          setAsking(false)
          goTo(stored.at)
        }}
        onRestart={() => {
          clearDraft()
          setD(emptyDraft())
          setAsking(false)
        }}
      />
    )

  const finish = () => {
    const made = buildCharacter(d, rules, { exists })
    // Si no cabe en el móvil, el borrador se queda: la ficha sigue en memoria y el aviso de arriba ofrece exportarla.
    const ok = saveCharacter(made)
    if (ok) clearDraft()
    toast(ok ? `${made.name} ya tiene ficha` : `${made.name} tiene ficha, pero no se ha podido guardar en el móvil: exporta una copia (mira el aviso de arriba)`)
    // Sustituye la entrada del creador: «Atrás» no vuelve a un asistente vacío.
    go({ name: 'sheet', id: made.id, tab: 'estado' }, true)
  }

  // «Elegir por mí»: además de elegir, dice qué ha elegido y lo trae a la vista (puede quedar más abajo).
  // Sin aviso flotante: taparía «Siguiente» en la barra de abajo justo cuando toca pulsarlo.
  const pickForMe = () => {
    const next = normalize(recommendStep({ ...d, at }, rules, at), rules)
    setD(next)
    setPicked({ at, text: pickedText(at, d, next, rules) })
    requestAnimationFrame(() => requestAnimationFrame(showChosen))
  }

  const props: StepProps = { d, set, rules, c, x, goTo }
  const body: Record<StepId, () => ComponentChildren> = {
    clase: () => <StepClass {...props} />,
    trasfondo: () => <StepBackground {...props} />,
    especie: () => <StepSpecies {...props} />,
    caracteristicas: () => <StepAbilities {...props} />,
    habilidades: () => <StepSkills {...props} />,
    conjuros: () => <StepSpells {...props} />,
    equipo: () => <StepGear {...props} />,
    idiomas: () => <StepLanguages {...props} />,
    quien: () => <StepWho {...props} />,
    repaso: () => <StepReview {...props} />,
  }
  const last = at === 'repaso'
  const name = d.name.trim()

  return (
    <div class="cr" style={d.color ? paletteStyle(c) : undefined}>
      <div class="wrap cr-wrap">
        <div class="cr-top">
          <a class="btn sm ghost" href={href({ name: 'home' })}>
            Cancelar
          </a>
          <span class="cr-count">
            Paso {i + 1} de {steps.length}
          </span>
        </div>

        <ol class="cr-steps" aria-label="Pasos">
          {steps.map((s, n) => {
            const state = n < i ? 'done' : n === i ? 'now' : 'todo'
            const label = `Paso ${n + 1}: ${STEP_TITLES[s]}`
            return (
              <li key={s} class={`cr-step ${state}`}>
                {n < i ? (
                  <button type="button" aria-label={`${label}. Volver a este paso`} onClick={() => goTo(s)}>
                    <span>{n + 1}</span>
                  </button>
                ) : (
                  <span class="cr-step-mark" aria-current={n === i ? 'step' : undefined} aria-label={label} role="img">
                    <span>{n + 1}</span>
                  </span>
                )}
              </li>
            )
          })}
        </ol>

        <header class="cr-head">
          <p class="label">Crear personaje</p>
          <h1 class="display cr-title">{STEP_TITLES[at]}</h1>
          <p class="lede cr-lede">{INTRO[at]}</p>
          {at !== 'repaso' && (
            <div class="cr-pickrow">
              <button type="button" class="btn brass sm cr-pick" onClick={pickForMe}>
                {PREFILLED.has(at) ? 'Volver a lo recomendado' : 'Elegir por mí'}
              </button>
              <p class="cr-picked" role="status">
                {picked?.at === at ? picked.text : ''}
              </p>
            </div>
          )}
        </header>

        <main class="cr-body">{body[at]()}</main>

        <div class="footerbar cr-foot">
          {issues.length > 0 && !last && (
            <p class="cr-missing" role="status">
              {issues[0]}
            </p>
          )}
          <button type="button" class="btn" disabled={i === 0} onClick={() => goTo(steps[i - 1])}>
            Atrás
          </button>
          {last ? (
            <button type="button" class="btn primary grow" disabled={issues.length > 0} onClick={finish}>
              {name ? `Crear a ${name}` : 'Crear personaje'}
            </button>
          ) : (
            <button type="button" class="btn primary grow" disabled={issues.length > 0} onClick={() => goTo(steps[i + 1])}>
              Siguiente
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Lo que dice el aviso tras «Elegir por mí» o «Volver a lo recomendado». */
function pickedText(at: StepId, before: Draft, after: Draft, rules: Rules): string {
  const name =
    at === 'clase' ? rules.cls(after.classId ?? '')?.name : at === 'trasfondo' ? rules.background(after.backgroundId ?? '')?.name : at === 'especie' ? rules.speciesOf(after.speciesId ?? '')?.name : undefined
  if (name) return `He elegido ${name}.`
  if (at === 'quien') return before.name.trim() ? 'He vuelto al color de tu clase.' : `Te he puesto de nombre ${after.name}.`
  return 'He vuelto a lo recomendado.'
}

/** Si la opción marcada queda fuera de la pantalla (o tapada por la barra de abajo), la centra. */
function showChosen() {
  const el = document.querySelector('.cr-body .option.on')
  if (!el) return
  const r = el.getBoundingClientRect()
  const foot = document.querySelector('.cr-foot')?.getBoundingClientRect().top ?? innerHeight
  if (r.top >= 0 && r.bottom <= foot) return
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' })
}

function Resume({ draft, onContinue, onRestart }: { draft: Draft; onContinue: () => void; onRestart: () => void }) {
  const rules = useRules()
  const cls = rules.cls(draft.classId ?? '')
  const sp = rules.speciesOf(draft.speciesId ?? '')
  const who = draft.name.trim() || 'Sin nombre todavía'
  const what = [cls?.name, sp?.name.toLowerCase()].filter(Boolean).join(', ')
  return (
    <div class="wrap cr-wrap">
      <div class="cr-top">
        <a class="btn sm ghost" href={href({ name: 'home' })}>
          Inicio
        </a>
      </div>
      <header class="cr-head">
        <p class="label">Crear personaje</p>
        <h1 class="display cr-title">Tienes uno a medio hacer</h1>
        <p class="lede cr-lede">Lo guardé al salir. Puedes seguir donde lo dejaste o empezar otro desde cero.</p>
      </header>
      <div class="card frame cr-resume">
        <p class="cr-resume-name">{who}</p>
        {what && <p class="cr-sub">{what}</p>}
        <p class="cr-sub">Ibas por: {STEP_TITLES[draft.at]}.</p>
      </div>
      <div class="cr-resume-btns">
        <button type="button" class="btn primary block" onClick={onContinue}>
          Seguir con él
        </button>
        <button type="button" class="btn block" onClick={onRestart}>
          Empezar de nuevo
        </button>
      </div>
    </div>
  )
}
