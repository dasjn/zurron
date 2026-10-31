import { useMemo, useState } from 'preact/hooks'
import type { SpellData } from '../data/types'
import { Icon, Option, RichText, useRules } from './common'
import './css/combate.css'

/** Espacio duro (U+00A0): no deja partir la línea en ese punto. */
export const NB = '\u00A0'
const UNIT_RE = /(\d) (m|km|cm|kg|metros?|kilómetros?|minutos?|horas?|días?|semanas?|asaltos?|rondas?|turnos?|casillas?)(?![\wáéíóúñ])/g
/** «36 m», «10 minutos»: que la cifra y la unidad no se separen al partir la línea. */
export const keepUnits = (t: string) => t.replace(UNIT_RE, `$1${NB}$2`)

export function spellMeta(s: SpellData) {
  const lvl = s.level === 0 ? `Truco de ${s.school.toLowerCase()}` : `${s.school} de nivel ${s.level}`
  return lvl
}

/** «Evocación de nivel 1 · Acción · 36 m». El alcance va pegado al tiempo para que no quede solo en una línea. */
export function spellLine(s: SpellData) {
  return `${spellMeta(s)} · ${s.castingTime.split(',')[0]}${NB}·${NB}${keepUnits(s.range)}`
}

/** Ficha de un conjuro: tiempo, alcance, componentes y duración en rejilla, y luego el texto. */
export function SpellBody({ s }: { s: SpellData }) {
  const facts: [string, string][] = [
    ['Tiempo', s.castingTime],
    ['Alcance', keepUnits(s.range)],
    ['Duración', keepUnits(s.duration)],
    ['Componentes', s.components],
  ]
  // Lo largo ocupa la fila entera; si queda uno suelto al final, también
  const wide = facts.map(([, v]) => v.length > 22)
  const narrow = wide.map((w, i) => (w ? -1 : i)).filter((i) => i >= 0)
  if (narrow.length % 2) wide[narrow[narrow.length - 1]] = true
  return (
    <>
      <dl class="cb-sb-grid">
        {facts.map(([k, v], i) => (
          <div key={k} class={wide[i] ? 'wide' : undefined}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <RichText text={keepUnits(s.text)} />
      {s.higherLevels && <RichText text={keepUnits(s.higherLevels)} class="cb-sb-higher" />}
    </>
  )
}

/** Lista de conjuros que se puede marcar, con buscador fijo arriba y filtro por nivel. */
export function SpellPicker({
  pool,
  selected,
  max,
  onToggle,
  locked = [],
}: {
  pool: SpellData[]
  selected: string[]
  max: number
  onToggle: (id: string) => void
  locked?: string[]
}) {
  const [q, setQ] = useState('')
  const [level, setLevel] = useState<number | 'todos'>('todos')
  const [open, setOpen] = useState<string | null>(null)
  const levels = [...new Set(pool.map((s) => s.level))].sort((a, b) => a - b)
  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const over = selected.length - max
  const shown = useMemo(
    () => pool.filter((s) => (level === 'todos' || s.level === level) && (!q || norm(s.name).includes(norm(q)))).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'es')),
    [pool, q, level],
  )
  return (
    <div class="cb-picker">
      <div class="cb-search">
        <div class="cb-search-row">
          <input class="input" type="search" placeholder="Buscar conjuro" value={q} onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)} aria-label="Buscar conjuro" />
          <span class="cb-search-n" aria-live="polite">
            <b>{selected.length}</b> de {max}
          </span>
        </div>
        {max > 0 && over >= 0 && (
          <p class="cb-limit" role="status">
            {over === 0 ? `Ya tienes ${max}. Quita uno para elegir otro.` : `Tienes ${selected.length} y el máximo es ${max}: quita ${over}.`}
          </p>
        )}
        {levels.length > 1 && (
          <div class="chips">
            <button class={`chip ${level === 'todos' ? 'on' : ''}`} onClick={() => setLevel('todos')}>
              Todos
            </button>
            {levels.map((l) => (
              <button key={l} class={`chip ${level === l ? 'on' : ''}`} onClick={() => setLevel(l)}>
                {l === 0 ? 'Trucos' : `Nivel ${l}`}
              </button>
            ))}
          </div>
        )}
      </div>
      <div class="cb-picklist">
        {shown.map((s) => {
          const on = selected.includes(s.id)
          const isLocked = locked.includes(s.id)
          const isOpen = open === s.id
          return (
            <div class="cb-pick" key={s.id}>
              <div class="cb-pick-row">
                <Option on={on || isLocked} disabled={isLocked || (!on && selected.length >= max)} onClick={() => onToggle(s.id)}>
                  <strong>{s.name}</strong>
                  {s.concentration && <span class="tag">C</span>}
                  {s.ritual && <span class="tag">R</span>}
                  <span class="cb-pick-meta">
                    {spellLine(s)}
                    {isLocked && ' · Siempre preparado'}
                  </span>
                </Option>
                <button class="cb-pick-info" aria-expanded={isOpen} aria-label={`Qué hace ${s.name}`} onClick={() => setOpen(isOpen ? null : s.id)}>
                  <Icon name="glosario" size={20} />
                  {isOpen ? 'Cerrar' : 'Leer'}
                </button>
              </div>
              {isOpen && (
                <div class="card cb-pick-body">
                  <SpellBody s={s} />
                </div>
              )}
            </div>
          )
        })}
      </div>
      {shown.length === 0 && <p class="cb-pick-empty">No hay conjuros con ese nombre o nivel. Prueba con otra búsqueda.</p>}
    </div>
  )
}

/** Conjuros que la clase puede elegir hasta cierto nivel. */
export function useClassPool(classId: string, maxLevel: number, extraLists: string[] = []) {
  const rules = useRules()
  const cls = rules.cls(classId)
  return useMemo(() => {
    const ids = new Set(cls?.spellList ?? [])
    const fromLists = extraLists.length ? rules.book.spells.filter((s) => s.classes.some((k) => extraLists.includes(k))) : []
    const pool = rules.book.spells.filter((s) => ids.has(s.id) || fromLists.includes(s))
    return {
      cantrips: pool.filter((s) => s.level === 0),
      leveled: pool.filter((s) => s.level > 0 && s.level <= maxLevel),
    }
  }, [cls, maxLevel, extraLists.join(',')])
}
