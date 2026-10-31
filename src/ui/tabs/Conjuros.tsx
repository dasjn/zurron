import { useEffect, useState } from 'preact/hooks'
import type { SpellData } from '../../data/types'
import type { Character } from '../../model/character'
import { ABILITY_NAMES, signed } from '../../rules/constants'
import { spellNumbers } from '../../rules/derive'
import { castFree, freeCast, patchState, spendSlot } from '../../rules/rests'
import { Modal, RichText, sourceLabel, toast, useRules } from '../common'
import { NB, SpellBody, SpellPicker, spellLine, useClassPool } from '../SpellEditor'
import type { TabProps } from '../Sheet'

/** Rombos de solo lectura: llenos los que quedan, huecos los gastados. */
function Gems({ max, used }: { max: number; used: number }) {
  return (
    <span class="cb-gems" aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} class={`cb-gem ${i < max - used ? '' : 'used'}`} />
      ))}
    </span>
  )
}

type ExtraSpell = Character['spells']['extra'][number]

/** Conjuro pedido en el enlace: «#/p/<id>/conjuros?conjuro=bola-de-fuego». El router no mira la consulta en la ficha. */
function linkedSpell(): string | undefined {
  const q = location.hash.split('?')[1]
  return (q && new URLSearchParams(q).get('conjuro')) || undefined
}

export function Conjuros({ c, d, update }: TabProps) {
  const rules = useRules()
  const sp = d.spell
  const [editing, setEditing] = useState(false)
  const [casting, setCasting] = useState<SpellData | null>(null)

  const get = (ids: string[]) => ids.map((id) => rules.spell(id)).filter((s): s is SpellData => !!s)
  const cantrips = get(c.spells.cantrips)
  const prepared = get(c.spells.prepared.filter((id) => !sp?.alwaysPrepared.includes(id)))
  const always = get(sp?.alwaysPrepared ?? [])
  const extra = c.spells.extra.map((x) => ({ x, s: rules.spell(x.id) })).filter((e): e is { x: ExtraSpell; s: SpellData } => !!e.s)
  const byLevel = new Map<number, SpellData[]>()
  for (const s of prepared) byLevel.set(s.level, [...(byLevel.get(s.level) ?? []), s])

  const all = [...cantrips, ...prepared, ...always, ...extra.map((e) => e.s)]
  const anyC = all.some((s) => s.concentration)
  const anyR = all.some((s) => s.ritual)

  /** ¿Tiene espacios (normales o de pacto) de ese nivel o superior? Gastados o no. */
  const hasSlotsFor = (s: SpellData) => (sp?.slots ?? []).some((max, i) => max > 0 && i + 1 >= s.level) || (!!sp?.pact && sp.pact.level >= s.level)

  // El enlace de Turno abre la hoja de lanzar ese conjuro; si no se lanza con espacio, despliega su ficha
  useEffect(() => {
    const id = linkedSpell()
    if (!id) return
    // Fuera la consulta: volver atrás o recargar no vuelve a abrir la hoja
    history.replaceState(history.state, '', location.hash.split('?')[0])
    const s = all.find((x) => x.id === id)
    if (!s) return
    if (s.level > 0 && (hasSlotsFor(s) || freeCast(d, s.id))) {
      setCasting(s)
      return
    }
    const el = document.getElementById(`conjuro-${s.id}`) as HTMLDetailsElement | null
    if (!el) return
    el.open = true
    el.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [])

  /** Lo que pasa al lanzar cualquier conjuro: concentración y Armadura de mago. Devuelve también qué se deja. */
  const castEffects = (next: Character, s: SpellData) => {
    let note = ''
    if (s.concentration) {
      const prev = c.state.concentration
      if (prev && prev !== s.id) note = `. Dejas de concentrarte en ${rules.spell(prev)?.name ?? prev}`
      next = patchState(next, { concentration: s.id })
    }
    if (s.id === 'armadura-de-mago') next = patchState(next, { toggles: { ...next.state.toggles, 'armadura-de-mago': true } })
    return { next, note }
  }

  const done = (msg: string, next: Character) => {
    const before = c
    update(next)
    setCasting(null)
    toast(msg, { label: 'Deshacer', run: () => update(before) })
  }

  const cast = (s: SpellData, slotLevel?: number) => {
    let next = c
    let msg = `${s.name} lanzado`
    if (s.level > 0) {
      const r = spendSlot(c, d, slotLevel ?? s.level)
      if (!r) {
        toast('No te quedan espacios de ese nivel o superior')
        return
      }
      next = r.next
      msg = `Gastado un espacio de nivel ${r.level}`
    }
    const e = castEffects(next, s)
    done(msg + e.note, e.next)
  }

  const castFreely = (s: SpellData) => {
    const next = castFree(c, d, s.id)
    if (!next) {
      toast('No te quedan usos gratis: vuelven con el descanso')
      return
    }
    const e = castEffects(next, s)
    done(`${s.name} lanzado gratis${e.note}`, e.next)
  }

  /** «Lanzar gratis (1 por descanso largo)»; con varios usos, cuántos quedan. */
  const freeLabel = (s: SpellData) => {
    const r = freeCast(d, s.id)
    if (!r) return ''
    const left = r.max - r.used
    if (!left) return `Gratis: ya lo has usado (vuelve con descanso ${r.recharge})`
    return r.max === 1 ? `Lanzar gratis (1 por descanso ${r.recharge})` : `Lanzar gratis (quedan ${left} de ${r.max})`
  }

  const item = (s: SpellData, x?: ExtraSpell) => {
    const free = s.level > 0 ? freeCast(d, s.id) : undefined
    const nums = x?.ability ? spellNumbers(d, x.ability) : undefined
    const withSlot = s.level > 0 && hasSlotsFor(s)
    return (
      <details class="item cb-spell" key={s.id} id={`conjuro-${s.id}`}>
        <summary>
          <span class="grow">
            <span class="cb-spell-name">
              <span>{s.name}</span>
              {s.concentration && <span class="tag">C</span>}
              {s.ritual && <span class="tag">R</span>}
            </span>
            <span class="cb-spell-meta">{spellLine(s)}</span>
            {x && (
              <span class="cb-spell-src">
                {sourceLabel(rules, x.source)}.
                {x.ability && nums && ` Lo lanzas con ${ABILITY_NAMES[x.ability]}: CD de conjuros ${nums.dc}, ataque mágico ${signed(nums.attack)}.`}
                {x.freeCast && <span class="cb-free"> {`${(free?.max ?? 1) === 1 ? '1 vez' : `${free!.max} veces`} gratis por descanso ${x.freeCast}`}.</span>}
              </span>
            )}
          </span>
        </summary>
        <div class="body">
          {free && (
            <button class="btn soft block cb-cast" disabled={free.used >= free.max} onClick={() => castFreely(s)}>
              {freeLabel(s)}
            </button>
          )}
          {withSlot && (
            <button class={`btn block cb-cast ${free ? '' : 'soft'}`} aria-haspopup="dialog" onClick={() => setCasting(s)}>
              Lanzar (gasta un espacio)
            </button>
          )}
          {s.level === 0 && s.concentration && (
            <button class="btn soft block cb-cast" onClick={() => cast(s)}>
              Lanzar (concentración)
            </button>
          )}
          <SpellBody s={s} />
        </div>
      </details>
    )
  }

  const slotLine = (lvl: number) => {
    const max = sp?.slots[lvl - 1] ?? 0
    if (!max) return null
    const used = c.state.slotsUsed[lvl - 1] ?? 0
    return (
      <p class="lede cb-slots">
        <span>Espacios de nivel {lvl}:</span>
        <Gems max={max} used={used} />
        <span>
          quedan {Math.max(0, max - used)} de {max}
        </span>
      </p>
    )
  }

  const changeRule = d.features.find((f) => f.origin === 'clase' && /Lanzamiento de conjuros|Magia de pacto/i.test(f.name))?.text.split('\n').find((p) => /^\*{0,2}Cambiar/i.test(p))
  const showCantripCount = !!sp && (sp.cantripsMax > 0 || c.spells.cantrips.length > 0)
  const castingFree = casting ? freeCast(d, casting.id) : undefined

  return (
    <div>
      {sp && (
        <div class="band">
          <div>
            <div class="label">Aptitud mágica</div>
            <div class="v cb-word">{ABILITY_NAMES[sp.ability]}</div>
            <div class="s">Modificador {signed(d.mods[sp.ability])}</div>
          </div>
          <div>
            <div class="label">CD de conjuros</div>
            <div class="v">{sp.dc}</div>
            <div class="s">Para resistirlos</div>
          </div>
          <div>
            <div class="label">Ataque mágico</div>
            <div class="v">{signed(sp.attack)}</div>
            {/* El cansancio ya está restado en la cifra */}
            <div class="s">{d.exhaustion.level > 0 ? `Cansancio${NB}−${d.exhaustion.d20}` : `Tiras d20${NB}${signed(sp.attack)}`}</div>
          </div>
        </div>
      )}

      {(anyC || anyR) && (
        <ul class="cb-legend">
          {anyC && (
            <li>
              <span class="tag">C</span>
              <span>
                <b>Concentración.</b> Solo puedes mantener uno a la vez; si te dañan, haz una tirada de salvación de Constitución para no perderlo.
              </span>
            </li>
          )}
          {anyR && (
            <li>
              <span class="tag">R</span>
              <span>
                <b>Ritual.</b> Si tu clase puede, lo lanzas tardando 10 minutos más y sin gastar espacio.
              </span>
            </li>
          )}
        </ul>
      )}

      {sp && (
        <button id="revisar-conjuros" class="btn block brass cb-change" onClick={() => setEditing(true)}>
          <span>Cambiar conjuros</span>
          <span class="cb-n">
            {showCantripCount && (
              <>
                Trucos {c.spells.cantrips.length}/{sp.cantripsMax}
                <br />
              </>
            )}
            Preparados {prepared.length}/{sp.preparedMax}
          </span>
        </button>
      )}

      {cantrips.length > 0 && (
        <>
          <h2>Trucos</h2>
          <p class="lede">Gratis: los lanzas tantas veces como quieras.</p>
          <div>{cantrips.map((s) => item(s))}</div>
        </>
      )}

      {[...byLevel.keys()]
        .sort((a, b) => a - b)
        .map((l) => (
          <div key={l}>
            <h2>Nivel {l}</h2>
            {slotLine(l)}
            <div>{byLevel.get(l)!.map((s) => item(s))}</div>
          </div>
        ))}

      {always.length > 0 && (
        <>
          <h2>Siempre preparados</h2>
          <p class="lede">Te los da tu subclase: no cuentan para tu límite.</p>
          <div>{always.map((s) => item(s))}</div>
        </>
      )}

      {extra.length > 0 && (
        <>
          <h2>De otras fuentes</h2>
          <p class="lede">No vienen de tu clase: te los da otra cosa, como tu especie o una dote.</p>
          <div>{extra.map(({ x, s }) => item(s, x))}</div>
        </>
      )}

      <Modal open={!!casting} onClose={() => setCasting(null)} title={casting ? `Lanzar ${casting.name}` : ''}>
        {casting && (
          <>
            <p class="lede">{hasSlotsFor(casting) ? '¿Con qué espacio? Uno de nivel superior suele potenciar el conjuro.' : 'Este lo lanzas sin gastar espacio de conjuro.'}</p>
            {casting.higherLevels && hasSlotsFor(casting) && <RichText text={casting.higherLevels} class="small cb-higher" />}
            <div class="list cb-slotlist">
              {castingFree && (
                <button class="li" disabled={castingFree.used >= castingFree.max} onClick={() => castFreely(casting)}>
                  <strong class="grow">Gratis, sin espacio</strong>
                  <Gems max={castingFree.max} used={castingFree.used} />
                  <span class="v">{castingFree.used < castingFree.max ? `queda${castingFree.max - castingFree.used === 1 ? '' : 'n'} ${castingFree.max - castingFree.used}` : 'gastado'}</span>
                </button>
              )}
              {(sp?.slots ?? []).map((max, i) => {
                const lvl = i + 1
                if (lvl < casting.level || max === 0) return null
                const used = c.state.slotsUsed[i] ?? 0
                const left = max - used
                return (
                  <button key={lvl} class="li" disabled={left <= 0} onClick={() => cast(casting, lvl)}>
                    <strong class="grow">Nivel {lvl}</strong>
                    <Gems max={max} used={used} />
                    <span class="v">{left > 0 ? `quedan ${left}` : 'gastados'}</span>
                  </button>
                )
              })}
              {sp?.pact && sp.pact.level >= casting.level && (
                <button class="li" disabled={c.state.pactSlotsUsed >= sp.pact.slots} onClick={() => cast(casting, sp.pact!.level)}>
                  <strong class="grow">Pacto (nivel {sp.pact.level})</strong>
                  <Gems max={sp.pact.slots} used={c.state.pactSlotsUsed} />
                  <span class="v">quedan {sp.pact.slots - c.state.pactSlotsUsed}</span>
                </button>
              )}
            </div>
          </>
        )}
      </Modal>

      {sp && editing && <SpellEditorModal {...{ c, d, update }} changeRule={changeRule} onClose={() => setEditing(false)} />}
    </div>
  )
}

function SpellEditorModal({ c, d, update, onClose, changeRule }: TabProps & { onClose: () => void; changeRule?: string }) {
  const sp = d.spell!
  const extraLists = c.classId === 'bardo' && c.level >= 10 ? ['bardo', 'clerigo', 'druida', 'mago'] : []
  const pool = useClassPool(c.classId, sp.maxSpellLevel, extraLists)
  const [cantrips, setCantrips] = useState(c.spells.cantrips)
  const [prepared, setPrepared] = useState(c.spells.prepared.filter((id) => !sp.alwaysPrepared.includes(id)))
  const [tab, setTab] = useState<'trucos' | 'preparados'>(sp.cantripsMax ? 'trucos' : 'preparados')
  const toggle = (list: string[], set: (x: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))
  const dirty = !same(cantrips, c.spells.cantrips) || !same(prepared, c.spells.prepared.filter((id) => !sp.alwaysPrepared.includes(id)))
  return (
    <Modal open onClose={onClose} title="Cambiar conjuros" dirty={dirty}>
      {changeRule && <RichText text={changeRule} class="small notice" />}
      <div class="chips cb-tabs" role="tablist" aria-label="Qué conjuros cambiar">
        {sp.cantripsMax > 0 && (
          <button role="tab" aria-selected={tab === 'trucos'} class={`chip ${tab === 'trucos' ? 'on' : ''}`} onClick={() => setTab('trucos')}>
            Trucos {cantrips.length}/{sp.cantripsMax}
          </button>
        )}
        <button role="tab" aria-selected={tab === 'preparados'} class={`chip ${tab === 'preparados' ? 'on' : ''}`} onClick={() => setTab('preparados')}>
          Preparados {prepared.length}/{sp.preparedMax}
        </button>
      </div>
      {tab === 'trucos' ? (
        <SpellPicker pool={pool.cantrips} selected={cantrips} max={sp.cantripsMax} onToggle={(id) => toggle(cantrips, setCantrips, id)} />
      ) : (
        <SpellPicker pool={pool.leveled} selected={prepared} max={sp.preparedMax} locked={sp.alwaysPrepared} onToggle={(id) => toggle(prepared, setPrepared, id)} />
      )}
      <div class="footerbar cb-foot">
        <button class="btn" onClick={onClose}>
          Cancelar
        </button>
        <button
          class="btn primary grow"
          onClick={() => {
            update({ ...c, spells: { ...c.spells, cantrips, prepared } })
            onClose()
            toast('Conjuros guardados')
          }}
        >
          Guardar
        </button>
      </div>
    </Modal>
  )
}
