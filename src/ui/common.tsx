import { createContext, type ComponentChildren, type CSSProperties, type JSX } from 'preact'
import { useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks'
import type { Rules } from '../rules/book'
import type { Character } from '../model/character'
import type { Ability, SkillId } from '../data/types'
import { ABILITY_NAMES, SKILL_NAME } from '../rules/constants'
import { toolName } from '../rules/create'
import { safeColor, safePortrait, safePosition } from '../migrate'
import { navigate, openLayer, type LayerHandle } from '../router'
import { exportCharacters, exportMessage } from '../backup'
import './css/datos.css'

export const RulesContext = createContext<Rules | null>(null)

export function useRules(): Rules {
  const r = useContext(RulesContext)
  if (!r) throw new Error('Reglas no cargadas')
  return r
}

/* ---------- Nombres legibles ---------- */

const humanize = (id: string) => {
  const s = id.replace(/-/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Herramienta o instrumento por id («herramientas-de-ladron» → «Herramientas de ladrón»). */
const toolLabel = (id: string) => {
  const name = toolName(id)
  return name === id ? undefined : name
}

/** Nombre para mostrar de un id cualquiera (dote, conjuro, clase, habilidad, herramienta, arma, opción de especie…). */
export function labelFor(rules: Rules, id: string): string {
  return (
    rules.feat(id)?.name ??
    rules.spell(id)?.name ??
    rules.cls(id)?.name ??
    ABILITY_NAMES[id as Ability] ??
    SKILL_NAME[id as SkillId] ??
    toolLabel(id) ??
    rules.weapon(id)?.name ??
    rules.book.species.flatMap((s) => s.choices ?? []).flatMap((ch) => ch.options ?? []).find((o) => o.id === id)?.name ??
    humanize(id)
  )
}

/** "dote:iniciado-en-la-magia" -> "Dote Iniciado en la magia"; "especie:alto-elfo" -> "Alto elfo". */
export function sourceLabel(rules: Rules, src: string): string {
  const [kind, id] = src.includes(':') ? src.split(':') : ['', src]
  if (kind === 'dote') return `Dote ${labelFor(rules, id)}`
  return labelFor(rules, id)
}

/* ---------- Clase, especie y trasfondo según sus pronombres ---------- */

/** Formas en femenino para quien usa «ella»: «Hechicera de nivel 2, elfa». */
export const CLASS_F: Record<string, string> = {
  barbaro: 'Bárbara',
  bardo: 'Barda',
  brujo: 'Bruja',
  clerigo: 'Clériga',
  explorador: 'Exploradora',
  guerrero: 'Guerrera',
  hechicero: 'Hechicera',
  mago: 'Maga',
  monje: 'Monja',
  paladin: 'Paladina',
  picaro: 'Pícara',
}
/** En minúscula, como van tras la coma. */
export const SPECIES_F: Record<string, string> = {
  draconido: 'dracónida',
  elfo: 'elfa',
  enano: 'enana',
  gnomo: 'gnoma',
  humano: 'humana',
  mediano: 'mediana',
  orco: 'orca',
}
/**
 * Solo los del SRD, en minúscula. Los que no cambian (criminal, soldado) no están.
 * Un trasfondo de la mesa puede traer su forma en femenino en el campo opcional `nameF`.
 */
const BACKGROUND_F: Record<string, string> = {
  acolito: 'acólita',
  erudito: 'erudita',
}

/** ¿Usa «ella»? Entonces clase, especie y trasfondo van en femenino. */
export const usesElla = (c: Character) => /^ella/i.test(c.persona?.pronouns ?? '')

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
/** Valor propio del mapa (un id como «constructor» no puede sacar lo heredado de Object). */
const own = (map: Record<string, string>, k: string) => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : undefined)

/**
 * Cómo se presenta: clase con mayúscula («Hechicera»), especie y trasfondo en minúscula
 * («elfa», «erudita») para ir tras una coma. Con pronombres «ella», en femenino.
 * Los ids sin datos salen legibles: «senda-del-berserker» → «Senda del berserker».
 */
export function identityNames(rules: Rules, c: Character): { cls: string; species?: string; background?: string } {
  const she = usesElla(c)
  const cls = (she && own(CLASS_F, c.classId)) || (rules.cls(c.classId)?.name ?? humanize(c.classId))
  const species = c.speciesId ? (she && own(SPECIES_F, c.speciesId)) || lowerFirst(rules.speciesOf(c.speciesId)?.name ?? humanize(c.speciesId)) : undefined
  const bg = c.backgroundId ? rules.background(c.backgroundId) : undefined
  const bgF = bg?.nameF
  const background = c.backgroundId
    ? (she && (own(BACKGROUND_F, c.backgroundId) ?? (typeof bgF === 'string' ? lowerFirst(bgF) : undefined))) || lowerFirst(bg?.name ?? humanize(c.backgroundId))
    : undefined
  return { cls, species, background }
}

/* ---------- Color del personaje ---------- */

/** El tema es siempre oscuro; del personaje solo se toma su color (rombos, elecciones, brillo del retrato). */
export function paletteStyle(c: Character | undefined): CSSProperties {
  const p = c?.look?.palette?.dark
  if (!p) return {}
  const out: Record<string, string> = {}
  // Solo colores en hexadecimal: un «url(…)» de una copia ajena haría que el móvil lo pidiera
  const accent = safeColor(p.accent)
  const soft = safeColor(p['accent-soft'])
  if (accent) out['--accent'] = accent
  if (soft) out['--accent-soft'] = soft
  return out as CSSProperties
}

/* ---------- Iconos (trazo de 24 px, color del texto) ---------- */

const ICONS = {
  estado: 'M12 20.5s-7.5-4.6-7.5-10.4A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.8c0 5.8-7.5 10.4-7.5 10.4z',
  turno: 'M4 4l11 11M13 17l4-4M16 16l4 4M20 4 9 15M7 13l4 4M8 16l-4 4',
  conjuros: 'M12 3l1.8 5.6L19.5 10l-5.7 1.6L12 17.5l-1.8-5.9L4.5 10l5.7-1.4zM18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  habilidades: 'M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5zM12 7.2l4.3 7.5H7.7zM12 7.2V2.5M16.3 14.7l3.9 2.05M7.7 14.7l-3.9 2.05',
  rasgos: 'M4.5 5.5a2 2 0 0 1 2-2H19v14H6.5a2 2 0 0 0-2 2zM4.5 19.5a2 2 0 0 0 2 2H19v-4M8.5 7.5h6',
  equipo: 'M6 9a6 6 0 0 1 12 0v11.5H6zM9 9V5.5a3 3 0 0 1 6 0V9M9 14h6v3.5H9z',
  personaje: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
  notas: 'M19.5 4.5C12 5 8 10 7 17l-2 3.5M19.5 4.5c-.5 7-5 11.5-12 12.5M9.5 12h4.5',
  mas: 'M5 10.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM12 10.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM19 10.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z',
  glosario: 'M7 4h11a2 2 0 0 1 0 4h-1v10a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h1zM7 16V4M10 8h4M10 12h4',
  subir: 'M6 15l6-6 6 6',
  atras: 'M15 6l-6 6 6 6',
  adelante: 'M9 6l6 6-6 6',
} as const

export type IconName = keyof typeof ICONS

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

/* ---------- Dados ---------- */

export function rollDie(sides: number): number {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return (a[0] % sides) + 1
}

/* ---------- Texto de reglas ---------- */

function inline(s: string): ComponentChildren {
  const parts = s.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p))
}

/** Pinta el RichText de types.ts: párrafos, "• " listas, **negrita** y tablas "| a | b |". */
export function RichText({ text, class: cls }: { text?: string; class?: string }) {
  if (!text) return null
  const blocks: JSX.Element[] = []
  const lines = text.split('\n')
  let i = 0
  let key = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) {
      i++
      continue
    }
    if (line.startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const r = lines[i].trim()
        if (!/^\|[\s:|-]+\|$/.test(r)) rows.push(r.replace(/^\||\|$/g, '').split('|').map((x) => x.trim()))
        i++
      }
      const [head, ...body] = rows
      blocks.push(
        <table key={key++}>
          <thead>
            <tr>{head?.map((h, j) => <th key={j}>{inline(h)}</th>)}</tr>
          </thead>
          <tbody>
            {body.map((r, j) => (
              <tr key={j}>{r.map((c, k) => <td key={k}>{inline(c)}</td>)}</tr>
            ))}
          </tbody>
        </table>,
      )
      continue
    }
    if (line.startsWith('• ')) {
      const items: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('• ')) {
        items.push(lines[i].trim().slice(2))
        i++
      }
      blocks.push(
        <ul key={key++}>
          {items.map((t, j) => (
            <li key={j}>{inline(t)}</li>
          ))}
        </ul>,
      )
      continue
    }
    blocks.push(<p key={key++}>{inline(line)}</p>)
    i++
  }
  return <div class={`text ${cls ?? ''}`}>{blocks}</div>
}

/* ---------- Ventana inferior ---------- */

/** Deja inerte todo lo de alrededor de `el` (salvo los avisos), para que el foco y los lectores de pantalla no salgan de la ventana. */
function inertAround(el: Element): () => void {
  const changed: Element[] = []
  for (let n: Element | null = el; n && n.parentElement && n !== document.body; n = n.parentElement) {
    for (const s of Array.from(n.parentElement.children)) {
      if (s === n || s.hasAttribute('inert') || s.matches('script, style, .toast-host')) continue
      s.setAttribute('inert', '')
      changed.push(s)
    }
  }
  return () => changed.forEach((s) => s.removeAttribute('inert'))
}

/**
 * Hoja inferior. Atrás (el del móvil), Escape y «Cerrar» la cierran; tocar
 * fuera también, salvo con `dirty` (cambios sin guardar): entonces tocar fuera
 * no hace nada (en el móvil es donde se toca para bajar el teclado) y lo demás
 * pregunta «¿Descartar los cambios?».
 */
export function Modal({ open, onClose, title, dirty, children }: { open: boolean; onClose: () => void; title?: string; dirty?: boolean; children: ComponentChildren }) {
  const [asking, setAsking] = useState(false)
  const backdrop = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const keep = useRef<HTMLButtonElement>(null)
  const layer = useRef<LayerHandle | null>(null)
  const titleId = useId()
  // Lo último de las props, para los manejadores que se registran una sola vez
  const live = useRef({ onClose, dirty: !!dirty, asking })
  live.current = { onClose, dirty: !!dirty, asking }

  /** Cierra ya: quita su entrada del historial y avisa al padre. */
  const close = () => {
    layer.current?.release()
    setAsking(false)
    live.current.onClose()
  }
  /** «Cerrar», Escape o Atrás: con cambios sin guardar, primero pregunta. true si se ha cerrado. */
  const dismiss = (): boolean => {
    const l = live.current
    if (l.asking) {
      setAsking(false)
      return false
    }
    if (l.dirty) {
      setAsking(true)
      return false
    }
    close()
    return true
  }

  useLayoutEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    layer.current = openLayer(dismiss)
    const restoreInert = backdrop.current ? inertAround(backdrop.current) : () => {}
    // El foco entra en la ventana por el título (sin abrir el teclado del móvil)
    const head = dialog.current?.querySelector<HTMLElement>('.modal-head h2') ?? dialog.current
    head?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !layer.current?.isTop()) return
      e.preventDefault()
      dismiss()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      layer.current?.release()
      layer.current = null
      setAsking(false)
      restoreInert()
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      if (before?.isConnected) before.focus({ preventScroll: true })
    }
  }, [open])

  useEffect(() => {
    if (asking) keep.current?.focus()
  }, [asking])

  if (!open) return null
  return (
    <div
      ref={backdrop}
      class="backdrop"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return
        if (!live.current.dirty) close()
      }}
    >
      <div
        ref={dialog}
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Ventana'}
        tabIndex={-1}
        inert={asking}
        onClickCapture={(e) => {
          // Un enlace de la app dentro de la ventana: primero se cierra (y se quita su entrada), luego se va
          const a = (e.target as Element).closest?.('a[href^="#"]') as HTMLAnchorElement | null
          if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return
          e.preventDefault()
          const to = a.getAttribute('href')!
          close()
          navigate(to)
        }}
      >
        {/* Título y «Cerrar» quedan fijos arriba; solo se desplaza el cuerpo */}
        <div class="modal-head">
          {title ? (
            <h2 id={titleId} tabIndex={-1}>
              {title}
            </h2>
          ) : (
            <span class="grow" />
          )}
          <button class="btn sm ghost" onClick={() => dismiss()}>
            Cerrar
          </button>
        </div>
        <div class="modal-body">{children}</div>
      </div>
      {asking && (
        <div class="backdrop dt-ask" onClick={(e) => e.target === e.currentTarget && setAsking(false)}>
          <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby={`${titleId}-ask`} aria-describedby={`${titleId}-ask-text`}>
            <div class="modal-head">
              <h2 id={`${titleId}-ask`}>¿Descartar los cambios?</h2>
            </div>
            <div class="modal-body">
              <p id={`${titleId}-ask-text`}>Lo que has cambiado aquí no se ha guardado.</p>
              <div class="grid2 dt-ask-actions">
                <button ref={keep} class="btn" onClick={() => setAsking(false)}>
                  Seguir editando
                </button>
                <button class="btn danger" onClick={close}>
                  Descartar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Círculos de usos ---------- */

/**
 * `max` rombos; los `used` primeros cuentan como gastados. Tocar el n-ésimo marca hasta él.
 * Por defecto se ven llenos los disponibles; con `count` se ven llenos los marcados (p. ej. salvaciones de muerte).
 */
export function Pips({ max, used, onChange, label, count, tone, centered }: { max: number; used: number; onChange: (used: number) => void; label: string; count?: boolean; tone?: 'good' | 'bad'; centered?: boolean }) {
  const cls = ['pips', count && 'count', tone, centered && 'centered'].filter(Boolean).join(' ')
  return (
    <div class={cls} role="group" aria-label={label}>
      {Array.from({ length: max }, (_, i) => {
        const isUsed = i < used
        return (
          <button
            key={i}
            class={`pip ${isUsed ? 'used' : ''}`}
            aria-label={`${label}: ${isUsed ? (count ? 'marcado' : 'gastado') : count ? 'sin marcar' : 'disponible'} ${i + 1} de ${max}`}
            aria-pressed={isUsed}
            onClick={() => onChange(i + 1 === used ? i : i + 1)}
          />
        )
      })}
    </div>
  )
}

export function Stepper({ value, min = 0, max, onChange, label, suffix, compact }: { value: number; min?: number; max?: number; onChange: (v: number) => void; label: string; suffix?: string; compact?: boolean }) {
  return (
    <div class={compact ? 'stepper compact' : 'stepper'}>
      <button class="iconbtn" aria-label={`${label}: menos`} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
        −
      </button>
      <span class="v num" aria-live="polite">
        {value}
        {suffix}
      </span>
      <button class="iconbtn" aria-label={`${label}: más`} onClick={() => onChange(max === undefined ? value + 1 : Math.min(max, value + 1))} disabled={max !== undefined && value >= max}>
        +
      </button>
    </div>
  )
}

/* ---------- Opción marcable ---------- */

export function Option({ on, onClick, radio, disabled, children }: { on: boolean; onClick: () => void; radio?: boolean; disabled?: boolean; children: ComponentChildren }) {
  return (
    <button class={`option ${on ? 'on' : ''} ${radio ? 'radio' : ''}`} onClick={onClick} disabled={disabled} role={radio ? 'radio' : 'checkbox'} aria-checked={on}>
      <span class="box">{on && !radio ? '✓' : ''}</span>
      <span class="grow">{children}</span>
    </button>
  )
}

/* ---------- Aviso efímero ---------- */

/** Botón opcional del aviso: «Deshacer» tras un cambio que no pide confirmación. */
export interface ToastAction {
  label: string
  run: () => void
}

let showToast: (msg: string, action?: ToastAction) => void = () => {}
export function toast(msg: string, action?: ToastAction) {
  showToast(msg, action)
}
export function ToastHost() {
  const [shown, setShown] = useState<{ msg: string; action?: ToastAction } | null>(null)
  useEffect(() => {
    let t: number | undefined
    showToast = (msg, action) => {
      setShown({ msg, action })
      clearTimeout(t)
      // Con botón damos más tiempo para alcanzarlo
      t = window.setTimeout(() => setShown(null), action ? 6000 : 2600)
    }
  }, [])
  // El contenedor está siempre pintado: los lectores de pantalla solo anuncian
  // los cambios dentro de una región viva que ya existía.
  return (
    <div class="toast-host" role="status" aria-live="polite">
      {shown && (
        <div class="toast">
          <span>{shown.msg}</span>
          {shown.action && (
            <button
              type="button"
              class="toast-action"
              onClick={() => {
                shown.action!.run()
                setShown(null)
              }}
            >
              {shown.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function Portrait({ c, size }: { c: Character; size?: number }) {
  // Preact 11 no añade «px» a los números de style
  const style = size ? { width: `${size}px`, height: `${size}px` } : undefined
  // Solo imágenes incrustadas (las de la app): nunca una dirección de fuera
  const src = safePortrait(c.look?.portrait)
  if (src) return <img class="portrait" style={{ ...style, objectPosition: safePosition(c.look?.portraitPosition) }} src={src} alt={`Retrato de ${c.name}`} />
  return (
    <div class="portrait" style={style} aria-hidden="true">
      {c.name.slice(0, 1)}
    </div>
  )
}

export function Disclosure({ id, title, extra, summary, children, open }: { id?: string; title: ComponentChildren; extra?: ComponentChildren; summary?: ComponentChildren; children?: ComponentChildren; open?: boolean }) {
  return (
    <details id={id} class="item" open={open}>
      <summary>
        <span class="grow">
          <strong>{title}</strong>
          {summary && <span class="muted small" style={{ display: 'block' }}>{summary}</span>}
        </span>
        {extra}
      </summary>
      {children && <div class="body">{children}</div>}
    </details>
  )
}

/* ---------- Copias e instalación ---------- */

/** ¿Abierta como app instalada (desde la pantalla de inicio)? */
export function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}
export const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Exporta y dice dónde ha ido la copia (en Descargas o donde se haya compartido). */
export async function exportAndTell(chars: Character[], book?: Rules['book']): Promise<boolean> {
  const r = await exportCharacters(chars, book)
  const msg = exportMessage(r)
  if (msg) toast(msg)
  return r.via !== 'cancelado'
}

/** «hoy», «ayer», «hace 3 días», «hace 2 meses». */
export function sinceText(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (!Number.isFinite(days) || days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 60) return `hace ${days} días`
  return `hace ${Math.round(days / 30)} meses`
}

/* ---------- Avisos que se pueden cerrar («Ahora no», «Entendido») ---------- */

const SEEN_KEY = 'fichaviva:avisos'

function readSeen(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}')
    const out: Record<string, string> = {}
    if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw)) if (k !== '__proto__' && typeof v === 'string') out[k] = v
    return out
  } catch {
    return {}
  }
}

/** Cuándo se cerró el aviso `key` (ISO), si se cerró. */
export function seenAt(key: string): string | undefined {
  const all = readSeen()
  return Object.prototype.hasOwnProperty.call(all, key) ? all[key] : undefined
}

export function markSeen(key: string) {
  const all = readSeen()
  all[key] = new Date().toISOString()
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(all))
  } catch {
    // sin espacio: el aviso volverá a salir
  }
}
