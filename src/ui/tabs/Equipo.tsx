import { useMemo, useState } from 'preact/hooks'
import type { ArmorData, WeaponData } from '../../data/types'
import type { Coins, Item } from '../../model/character'
import { ABILITY_NAMES } from '../../rules/constants'
import { getCharacter } from '../../store'
import { Modal, toast, useRules } from '../common'
import type { TabProps } from '../Sheet'

const COINS: { k: keyof Coins; name: string; hint: string }[] = [
  { k: 'ppt', name: 'Platino', hint: '10 po' },
  { k: 'po', name: 'Oro', hint: '1 po' },
  { k: 'pe', name: 'Electro', hint: '½ po' },
  { k: 'pp', name: 'Plata', hint: '1/10 po' },
  { k: 'pc', name: 'Cobre', hint: '1/100 po' },
]

const uid = () => Math.random().toString(36).slice(2, 9)
const fmtPo = (n: number) => (Math.floor(n * 100) / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 })

/** Espacio duro entre cifra y unidad, para que «24 m» no se parta. */
const NB = String.fromCharCode(160)
const RANGE_RE = /^(Arrojadiza|Munición)\s*\(alcance\s*([\d,.]+)\/([\d,.]+)(?:;\s*([^)]+))?\)/i
const AMMO: Record<string, string> = { flecha: 'flechas', virote: 'virotes', bala: 'balas', dardo: 'dardos', proyectil: 'proyectiles' }

/**
 * Propiedades del arma en castellano llano, en minúscula («a dos manos, pesada»),
 * y el alcance aparte en una frase («Dispara virotes a 24 m, o hasta 96 m con desventaja.»).
 * La pestaña Turno lo cuenta igual, con más detalle.
 */
function weaponText(w: WeaponData) {
  const props: string[] = []
  let reach: string | undefined
  for (const p of w.properties) {
    const m = p.match(RANGE_RE)
    if (m) {
      const [, kind, near, far, ammo] = m
      const where = `a ${near}${NB}m, o hasta ${far}${NB}m con desventaja.`
      reach = /^arroj/i.test(kind) ? `Se lanza ${where}` : `Dispara ${AMMO[ammo?.trim() ?? ''] ?? ammo ?? 'munición'} ${where}`
      continue
    }
    const versatile = p.match(/^Versátil\s*\(([^)]+)\)/i)
    if (versatile) props.push(`a una o dos manos (${versatile[1]} con dos)`)
    else if (/^A dos manos \(salvo montado\)/i.test(p)) props.push('a dos manos (salvo a caballo)')
    else if (/^Ligera$/i.test(p)) props.push('ligera (para luchar con dos armas)')
    else if (/^Sutil$/i.test(p)) props.push(`sutil (puedes usar ${ABILITY_NAMES.des})`)
    else if (/^Gran alcance$/i.test(p)) props.push(`gran alcance (llegas a 3${NB}m)`)
    else if (/^Recarga$/i.test(p)) props.push('recarga (un disparo por acción)')
    else props.push(p.toLowerCase())
  }
  return { damage: `${w.damage} ${w.damageType}`, props, reach }
}

function WeaponLines({ w }: { w: WeaponData }) {
  const { damage, props, reach } = weaponText(w)
  return (
    <>
      <span class="fx-sub num">
        {damage}
        {props.length > 0 && ' · '}
        {/* cada propiedad entera en una línea: así no se parte «(un disparo / por acción)» */}
        {props.flatMap((p, i) => [
          i > 0 ? ', ' : null,
          <span class="fx-nowrap" key={p}>
            {p}
          </span>,
        ])}
      </span>
      {reach && <span class="fx-sub num">{reach}</span>}
    </>
  )
}

/** «Armadura 14 + tu Destreza (máx. +2)», «Armadura +2» para el escudo. */
function armorText(a: ArmorData) {
  if (a.category === 'escudo') return `Armadura +${a.baseAC}`
  const dex = a.dexCap === null ? ` + tu ${ABILITY_NAMES.des}` : a.dexCap ? ` + tu ${ABILITY_NAMES.des} (máx. +${a.dexCap})` : ''
  return `Armadura ${a.baseAC}${dex}`
}

export function Equipo({ c, d, update }: TabProps) {
  const rules = useRules()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const total = c.coins.ppt * 10 + c.coins.po + c.coins.pe / 2 + c.coins.pp / 10 + c.coins.pc / 100

  const setItem = (it: Item) => update({ ...c, equipment: c.equipment.map((x) => (x.id === it.id ? it : x)) })
  const equipable = (it: Item) => !!it.ref
  // El objeto tal y como está guardado: con cambios sin guardar, cerrar pregunta antes
  const saved = editing ? c.equipment.find((x) => x.id === editing.id) : undefined
  const dirty = !!editing && !!saved && (editing.name !== saved.name || editing.qty !== saved.qty || (editing.notes ?? '') !== (saved.notes ?? ''))
  const remove = (it: Item) => {
    const at = c.equipment.findIndex((x) => x.id === it.id)
    update({ ...c, equipment: c.equipment.filter((x) => x.id !== it.id) })
    toast('Objeto quitado', {
      label: 'Deshacer',
      run: () => {
        const cur = getCharacter(c.id)
        if (cur && !cur.equipment.some((x) => x.id === it.id)) update({ ...cur, equipment: [...cur.equipment.slice(0, at), it, ...cur.equipment.slice(at)] })
      },
    })
  }

  return (
    <div class="fx-tab">
      <h2>Dinero</h2>
      <div class="card fx-purse">
        <div class="fx-coins">
          {COINS.map(({ k, name, hint }) => (
            <label key={k} class="fx-coin">
              <span class="label">{name}</span>
              <input
                class="input num"
                inputMode="numeric"
                value={String(c.coins[k])}
                onChange={(e) => update({ ...c, coins: { ...c.coins, [k]: Math.max(0, Number((e.currentTarget as HTMLInputElement).value.replace(/\D/g, '')) || 0) } })}
                aria-label={`Monedas de ${name.toLowerCase()}`}
              />
              <span class="fx-coin-hint" aria-hidden="true">
                {hint}
              </span>
            </label>
          ))}
        </div>
        <div class="fx-total">
          <span>En total</span>
          <span class="v">{fmtPo(total)} po</span>
        </div>
        <p class="fx-total-note">Todas tus monedas juntas, contadas en piezas de oro (po): la moneda en la que van los precios. Bajo cada moneda ves cuánto vale.</p>
      </div>

      <h2>Equipo</h2>
      <p class="lede">Marca como «puesto» la armadura y el escudo que llevas, y tu Armadura se calcula sola. Las armas aparecen en la pestaña Turno.</p>
      <div class="fx-ac">
        <span>Armadura</span>
        <span class="v">{d.ac.value}</span>
        <span class="small muted">Te dan con {d.ac.value}+</span>
        <span class="fx-ac-parts num">{d.ac.parts.join(' + ')}</span>
      </div>
      <div class="list">
        {c.equipment.map((it) => {
          const w = it.ref?.kind === 'arma' ? rules.weapon(it.ref.id) : undefined
          const a = it.ref?.kind === 'armadura' ? rules.armor(it.ref.id) : undefined
          return (
            <div class="li fx-item" key={it.id}>
              <button class="fx-item-main" onClick={() => setEditing(it)}>
                <strong>{it.name}</strong>
                {it.qty > 1 && <span class="fx-qty num">×{it.qty}</span>}
                {w && <WeaponLines w={w} />}
                {a && <span class="fx-sub num">{armorText(a)}</span>}
                {it.notes && <span class="fx-sub fx-clamp">{it.notes}</span>}
              </button>
              {equipable(it) && a && (
                <button class={`chip ${it.equipped ? 'on' : ''}`} aria-pressed={!!it.equipped} onClick={() => setItem({ ...it, equipped: !it.equipped })}>
                  {it.equipped ? 'Puesto' : 'Guardado'}
                </button>
              )}
            </div>
          )
        })}
        {c.equipment.length === 0 && <p class="li fx-empty-row">Aún no llevas nada. Añade tus cosas con el botón de abajo.</p>}
      </div>
      <button class="btn block brass fx-after" onClick={() => setAdding(true)}>
        Añadir objeto
      </button>

      <AddItem open={adding} onClose={() => setAdding(false)} onAdd={(it) => update({ ...c, equipment: [...c.equipment, it] })} />

      <Modal open={!!editing} onClose={() => setEditing(null)} title={saved?.name ?? editing?.name} dirty={dirty}>
        {editing && (
          <>
            <div class="fx-form">
              <label class="field">
                <span class="label">Nombre</span>
                <input class="input" value={editing.name} onInput={(e) => setEditing({ ...editing, name: (e.currentTarget as HTMLInputElement).value })} />
              </label>
              <label class="field">
                <span class="label">Cantidad</span>
                <input class="input num fx-qty-input" inputMode="numeric" value={String(editing.qty)} onInput={(e) => setEditing({ ...editing, qty: Math.max(0, Number((e.currentTarget as HTMLInputElement).value.replace(/\D/g, '')) || 0) })} />
              </label>
              <label class="field">
                <span class="label">Notas</span>
                <textarea class="input" value={editing.notes ?? ''} onInput={(e) => setEditing({ ...editing, notes: (e.currentTarget as HTMLTextAreaElement).value })} />
              </label>
            </div>
            <div class="footerbar fx-sheetbar fx-foot-actions">
              <button
                class="btn danger"
                onClick={() => {
                  if (saved) remove(saved)
                  setEditing(null)
                }}
              >
                Quitar
              </button>
              <button
                class="btn primary block"
                onClick={() => {
                  setItem({ ...editing, name: editing.name.trim() || saved?.name || editing.name })
                  setEditing(null)
                }}
              >
                Guardar
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

function AddItem({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (it: Item) => void }) {
  const rules = useRules()
  const [q, setQ] = useState('')
  const [custom, setCustom] = useState('')
  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const results = useMemo(() => {
    if (q.length < 2) return []
    const n = norm(q)
    const w = rules.book.weapons.filter((x) => norm(x.name).includes(n)).map((x) => ({ key: `a:${x.id}`, name: x.name, hint: `Arma · ${x.damage} ${x.damageType}`, item: { name: x.name, ref: { kind: 'arma' as const, id: x.id } } }))
    const a = rules.book.armor.filter((x) => norm(x.name).includes(n)).map((x) => ({ key: `r:${x.id}`, name: x.name, hint: x.category === 'escudo' ? 'Escudo' : `Armadura ${x.category}`, item: { name: x.name, ref: { kind: 'armadura' as const, id: x.id } } }))
    const g = rules.book.gear.filter((x) => norm(x.name).includes(n)).map((x) => ({ key: `g:${x.id}`, name: x.name, hint: `${x.cost}${x.weight ? ' · ' + x.weight : ''}`, item: { name: x.name } }))
    return [...w, ...a, ...g].slice(0, 30)
  }, [q])
  const add = (base: Partial<Item> & { name: string }) => {
    onAdd({ id: uid(), qty: 1, ...base })
    toast(`Añadido: ${base.name}`)
    setQ('')
    setCustom('')
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Añadir objeto">
      <input class="input" type="search" placeholder="Busca un objeto: cuerda, antorcha…" value={q} onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)} aria-label="Buscar objeto" />
      {results.length > 0 && (
        <div class="list fx-results">
          {results.map((r) => (
            <button key={r.key} class="li fx-press" onClick={() => add(r.item)}>
              <span class="grow">
                <strong>{r.name}</strong>
                <span class="fx-sub num">{r.hint}</span>
              </span>
              <span class="fx-add-label">Añadir</span>
            </button>
          ))}
        </div>
      )}
      {q.length >= 2 && results.length === 0 && <p class="small muted fx-after">No hay ningún objeto «{q}» en la lista. Escríbelo abajo.</p>}
      <div class="fx-custom">
        <h3>U otro objeto</h3>
        <p class="small muted fx-after">Si no está en la lista, ponle nombre y se añade tal cual.</p>
        <div class="row">
          <input class="input" placeholder="Nombre (anillo de boda, mapa…)" value={custom} onInput={(e) => setCustom((e.currentTarget as HTMLInputElement).value)} aria-label="Nombre del objeto" />
          <button class="btn primary" disabled={!custom.trim()} onClick={() => add({ name: custom.trim() })}>
            Añadir
          </button>
        </div>
      </div>
    </Modal>
  )
}
