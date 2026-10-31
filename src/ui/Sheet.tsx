import { useEffect, useMemo, useState } from 'preact/hooks'
import type { Character } from '../model/character'
import { lastExport } from '../backup'
import { derive, type Derived } from '../rules/derive'
import { href } from '../router'
import { getCharacter, markCrash, crashedSheet, saveCharacter, useStore } from '../store'
import { Icon, Modal, Portrait, exportAndTell, identityNames, isIOS, isStandalone, markSeen, paletteStyle, seenAt, useRules, type IconName } from './common'
import { Estado } from './tabs/Estado'
import { Turno } from './tabs/Turno'
import { Conjuros } from './tabs/Conjuros'
import { Habilidades } from './tabs/Habilidades'
import { Rasgos } from './tabs/Rasgos'
import { Equipo } from './tabs/Equipo'
import { Personaje } from './tabs/Personaje'
import { Notas } from './tabs/Notas'
import './css/ficha.css'

export interface TabProps {
  c: Character
  d: Derived
  update: (c: Character) => void
}

interface TabDef {
  id: string
  label: string
  icon: IconName
  /** Qué hay dentro (se ve en la hoja «Más»). */
  hint: string
  show?: (c: Character, d: Derived) => boolean
}

const TABS: TabDef[] = [
  { id: 'estado', label: 'Estado', icon: 'estado', hint: 'Puntos de golpe, usos, estados y descansos' },
  { id: 'turno', label: 'Turno', icon: 'turno', hint: 'Qué puedes hacer en tu turno: moverte, atacar…' },
  { id: 'conjuros', label: 'Conjuros', icon: 'conjuros', hint: 'Trucos, conjuros preparados y espacios', show: (c, d) => !!d.spell || c.spells.extra.length > 0 },
  { id: 'habilidades', label: 'Habilidades', icon: 'habilidades', hint: 'Características, salvaciones, habilidades e idiomas' },
  { id: 'rasgos', label: 'Rasgos', icon: 'rasgos', hint: 'Lo que te dan tu clase, tu especie y tus dotes' },
  { id: 'equipo', label: 'Equipo', icon: 'equipo', hint: 'Armas, armadura, objetos y dinero' },
  { id: 'personaje', label: 'Personaje', icon: 'personaje', hint: 'Quién es, su historia y ajustes de la ficha' },
  { id: 'notas', label: 'Notas', icon: 'notas', hint: 'Lo que apuntas en cada sesión' },
]

/** Huecos de pestaña en la barra inferior; el quinto es «Más». */
const NAV_SLOTS = 4

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** Para ids sin datos: «senda-del-berserker» → «Senda del berserker». */
const pretty = (s: string) => upperFirst(s.replace(/-/g, ' '))

/** Baja hasta el elemento donde se arregla un aviso y, si se puede tocar, le pone el foco. */
function revealTarget(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' })
  if (el.matches('a[href], button, input, select, textarea, summary, [tabindex]')) el.focus({ preventScroll: true })
}

/**
 * Recordatorio suave en la ficha, uno cada vez:
 * - instalar la app, si se usa desde el navegador (una sola vez);
 * - hacer copia, si nunca se ha hecho de esta ficha o se ha subido de nivel desde la última.
 * La pestaña Inicio, con lo mismo, no la ve quien tiene una sola ficha (se abre directa).
 */
function Nudge({ c }: { c: Character }) {
  const rules = useRules()
  const [, setTick] = useState(0)
  const close = (key: string) => {
    markSeen(key)
    setTick((t) => t + 1)
  }

  if (!isStandalone() && !seenAt('instalar'))
    return (
      <div class="notice dt-nudge" role="note">
        <strong>Instala Zurrón en el móvil</strong>
        {isIOS ? (
          <p>
            Así se abre como una app, funciona sin conexión y el navegador no borra tus datos. Ojo: la app instalada guarda sus datos aparte. Primero exporta una copia; luego, en Safari, toca <strong>Compartir</strong> › <strong>Añadir a pantalla de inicio</strong> (en Chrome, el mismo botón está
            arriba a la derecha). Abre la app desde la pantalla de inicio e importa la copia en Inicio.
          </p>
        ) : (
          <p>
            Así funciona sin conexión. En Chrome, abre el menú <strong>⋮</strong> y toca <strong>Instalar aplicación</strong> (o <strong>Añadir a pantalla de inicio</strong>).
          </p>
        )}
        <div class="dt-actions">
          {isIOS && (
            <button class="btn sm brass" onClick={() => exportAndTell([c], rules.book)}>
              Exportar copia
            </button>
          )}
          <button class="btn sm ghost" onClick={() => close('instalar')}>
            Entendido
          </button>
        </div>
      </div>
    )

  const copied = lastExport(c.id)
  const levelUp = c.history[c.history.length - 1]?.date
  const since = levelUp && (!copied || levelUp > copied) ? levelUp : copied ? undefined : c.createdAt
  const seen = seenAt(`copia:${c.id}`)
  if (!since || (seen && seen > since)) return null
  return (
    <div class="notice dt-nudge" role="note">
      <strong>{copied ? 'Has subido de nivel desde tu última copia' : `Aún no hay ninguna copia de ${c.name}`}</strong>
      <p>La ficha solo está en este móvil. Si se borran los datos del navegador o cambias de móvil, sin copia se pierde.</p>
      <div class="dt-actions">
        <button
          class="btn sm brass"
          onClick={async () => {
            if (await exportAndTell([c], rules.book)) setTick((t) => t + 1)
          }}
        >
          Exportar copia
        </button>
        <button class="btn sm ghost" onClick={() => close(`copia:${c.id}`)}>
          Ahora no
        </button>
      </div>
    </div>
  )
}

export function Sheet({ id, tab }: { id: string; tab: string }) {
  useStore()
  const rules = useRules()
  const c = getCharacter(id)
  const d = useMemo(() => (c ? derive(c, rules) : undefined), [c, rules])
  const [moreOpen, setMoreOpen] = useState(false)
  // Pintada sin fallos un momento: si la última vez rompió la pantalla, ya puede volver a abrirse sola
  useEffect(() => {
    if (crashedSheet() !== id) return
    const t = setTimeout(() => markCrash(null), 1500)
    return () => clearTimeout(t)
  }, [id])
  // Aviso tocado: a qué pestaña lleva y hasta qué elemento hay que bajar cuando esté pintada
  const [reveal, setReveal] = useState<{ tab: string; target: string } | null>(null)
  useEffect(() => {
    if (!reveal || reveal.tab !== tab) return
    revealTarget(reveal.target)
    setReveal(null)
  }, [reveal, tab])

  if (!c || !d)
    return (
      <div class="wrap">
        <p class="notice">No encuentro esta ficha en el móvil.</p>
        <a class="btn" href="#/">
          Volver al inicio
        </a>
      </div>
    )

  const update = (next: Character) => saveCharacter({ ...next, updatedAt: new Date().toISOString() })
  const tabs = TABS.filter((t) => !t.show || t.show(c, d))
  const current = tabs.find((t) => t.id === tab) ?? tabs[0]
  const inBar = tabs.slice(0, NAV_SLOTS)
  const inMore = tabs.slice(NAV_SLOTS)
  const currentInMore = inMore.includes(current)
  const props: TabProps = { c, d, update }
  const pending = d.warnings.filter((w) => w.kind !== 'aviso')
  const tabHref = (t: string) => href({ name: 'sheet', id: c.id, tab: t })

  // Clase, especie y trasfondo en femenino si usa «ella», como en el inicio
  const { cls: className, species, background } = identityNames(rules, c)
  const subclass = d.sub?.name ?? (c.subclassId ? pretty(c.subclassId) : undefined)
  const origin = upperFirst([species, background].filter(Boolean).join(', '))

  return (
    <div class="sheet" style={paletteStyle(c)}>
      <div class="wrap with-nav">
        <div class="fi-top">
          <a class="btn sm ghost" href="#/">
            <Icon name="atras" size={18} />
            Inicio
          </a>
          {c.level < 20 && (
            <a class="btn sm brass" href={href({ name: 'levelup', id: c.id })}>
              <Icon name="subir" size={18} />
              Subir a nivel {c.level + 1}
            </a>
          )}
        </div>

        <header class="fi-hero">
          <Portrait c={c} />
          <div class="fi-id">
            <h1 class="display fi-name">{c.name}</h1>
            <p class="fi-meta">
              <span class="fi-class">
                {className} de nivel {c.level}
                {subclass ? `, ${subclass}` : ''}
              </span>
              {origin && <span class="fi-origin">{origin}</span>}
            </p>
            {c.tagline && <p class="fi-tagline">{c.tagline}</p>}
          </div>
        </header>

        {current.id === 'estado' && <Nudge c={c} />}

        {pending.length > 0 && current.id !== 'rasgos' && (
          <a
            class="notice error fi-warn"
            href={tabHref(pending[0].tab ?? 'rasgos')}
            onClick={() => {
              const w = pending[0]
              if (w.target) setReveal({ tab: w.tab ?? 'rasgos', target: w.target })
            }}
          >
            <span class="grow">
              <strong>{pending.length === 1 ? 'Hay 1 cosa por revisar' : `Hay ${pending.length} cosas por revisar`}</strong>
              <span class="small">
                {pending[0].text}
                {pending.length > 1 ? ' …' : ''}
              </span>
            </span>
            <Icon name="adelante" size={18} />
          </a>
        )}

        <main class="fi-main">
          {current.id === 'estado' && <Estado {...props} />}
          {current.id === 'turno' && <Turno {...props} />}
          {current.id === 'conjuros' && <Conjuros {...props} />}
          {current.id === 'habilidades' && <Habilidades {...props} />}
          {current.id === 'rasgos' && <Rasgos {...props} />}
          {current.id === 'equipo' && <Equipo {...props} />}
          {current.id === 'personaje' && <Personaje {...props} />}
          {current.id === 'notas' && <Notas {...props} />}
        </main>
      </div>

      <nav class="bnav" aria-label="Secciones de la ficha">
        <div>
          {inBar.map((t) => (
            <a key={t.id} href={tabHref(t.id)} aria-current={t === current ? 'page' : undefined}>
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </a>
          ))}
          {/* Siempre «Más»: si la sección está dentro, se marca como actual pero no cambia de nombre */}
          {inMore.length > 0 && (
            <button type="button" aria-current={currentInMore ? 'page' : undefined} aria-haspopup="dialog" aria-expanded={moreOpen} aria-label={currentInMore ? `Más secciones (estás en ${current.label})` : 'Más secciones'} onClick={() => setMoreOpen(true)}>
              <Icon name="mas" />
              <span>Más</span>
            </button>
          )}
        </div>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Más secciones">
        <nav class="list fi-more" aria-label="Más secciones de la ficha">
          {inMore.map((t) => (
            <a key={t.id} class="li" href={tabHref(t.id)} aria-current={t === current ? 'page' : undefined} onClick={() => setMoreOpen(false)}>
              <span class="fi-more-ic">
                <Icon name={t.icon} />
              </span>
              <span class="grow">
                <strong>{t.label}</strong>
                <span class="fi-more-hint">{t.hint}</span>
              </span>
              <Icon name="adelante" size={18} />
            </a>
          ))}
        </nav>
      </Modal>
    </div>
  )
}
