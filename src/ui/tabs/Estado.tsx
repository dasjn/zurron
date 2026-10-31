import type { ComponentChildren } from 'preact'
import { useRef, useState } from 'preact/hooks'
import type { Character } from '../../model/character'
import { ABILITY_NAMES, ABILITY_SHORT, metres, signed, squares } from '../../rules/constants'
import type { ResourceView } from '../../rules/derive'
import {
  LAY_ON_HANDS,
  SECOND_WIND,
  applyDamage,
  canRest,
  concentrationDc,
  deathSave,
  heal,
  isDead,
  isStable,
  layOnHands,
  longRest,
  longRestInspiration,
  patchState,
  secondWind,
  secondWindHealing,
  setHp,
  setPactSlotsUsed,
  setResourceUsed,
  setSlotsUsed,
  setTempHp,
  shortRest,
  spendHitDie,
} from '../../rules/rests'
import { Modal, Option, Pips, RichText, Stepper, rollDie, toast, useRules, usesElla } from '../common'
import type { TabProps } from '../Sheet'

/** Pista de recarga, como frase. */
const RECHARGE: Record<string, string> = {
  corto: 'Vuelve con descanso corto o largo',
  largo: 'Vuelve con descanso largo',
  'corto-uno': 'Recuperas 1 con descanso corto y todos con largo',
  amanecer: 'Vuelve al amanecer',
}

/** «Des» → «Destreza»: en el desglose hay sitio para el nombre entero. */
const ABILITY_BY_SHORT = Object.fromEntries(Object.entries(ABILITY_SHORT).map(([a, short]) => [short, ABILITY_NAMES[a as keyof typeof ABILITY_NAMES]]))

/** «Armadura de cuero 11» → ['Armadura de cuero', '11']; «Des +3» → ['Destreza', '+3']. Sin cifra al final, todo es nombre. */
function acPart(p: string): [string, string] {
  const m = /^(.*\S)\s+([+−-]?\d+)$/.exec(p)
  return m ? [ABILITY_BY_SHORT[m[1]] ?? m[1], m[2]] : [p, '']
}

/** «Estás muerta», «Estás muerto» o, sin pronombres en la ficha, «Has muerto». */
function deadText(c: Character): string {
  if (usesElla(c)) return 'Estás muerta'
  if (/^[ée]l\b/i.test(c.persona?.pronouns ?? '')) return 'Estás muerto'
  return 'Has muerto'
}

/** Rombos de salvaciones: cada toque marca el siguiente; tocar uno marcado quita el último. */
const nextPip = (current: number, tapped: number) => (tapped > current ? current + 1 : Math.max(0, current - 1))

/** Solo cifras: lo vacío o con letras no cuenta. */
const parseCount = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : undefined)

export function Estado({ c, d, update }: TabProps) {
  const rules = useRules()
  const [amount, setAmount] = useState('')
  const [modal, setModal] = useState<null | 'ca' | 'corto' | 'largo' | 'estados' | 'hp' | 'dano0' | 'aliento' | 'manos'>(null)
  const [condition, setCondition] = useState<string | null>(null)
  // Última tirada de dado de puntos de golpe en el descanso corto, con el personaje de antes para deshacerla
  const [lastRoll, setLastRoll] = useState<{ roll: number; healed: number; before: Character } | null>(null)
  const [manualRoll, setManualRoll] = useState('')
  const [deathRoll, setDeathRoll] = useState('')
  const [crit, setCrit] = useState(false)
  // Tirada de concentración pendiente tras recibir daño (con el daño apuntado, para deshacerlo desde la hoja)
  const [conc, setConc] = useState<{ dc: number; spell: string; msg: string; before: Character } | null>(null)
  const [layPoints, setLayPoints] = useState(1)
  const [laySelf, setLaySelf] = useState(true)
  const hpInput = useRef<HTMLInputElement>(null)
  const s = c.state
  const n = Number(amount)
  const hpPct = d.maxHp ? Math.min(100, (s.hp / d.maxHp) * 100) : 0
  const tempPct = d.maxHp ? Math.min(100 - hpPct, (s.tempHp / d.maxHp) * 100) : 0
  const low = s.hp > 0 && hpPct <= 25
  const down = s.hp <= 0
  const dead = isDead(s)
  const stable = isStable(s)
  // El cansancio va por niveles (fila «Cansancio»): en la lista de estados sale solo al final, sin interruptor
  const conditions = rules.conditions().filter((g) => g.id !== 'cansancio')
  const exhaustion = rules.book.glossary.find((g) => g.id === 'cansancio')
  const hitDiceLeft = d.level - s.hitDiceUsed
  const restOk = canRest(c)
  // Por qué no se puede gastar un dado de puntos de golpe ahora (si no se puede)
  const noHitDie = !restOk
    ? 'Para descansar necesitas al menos 1 PG.'
    : hitDiceLeft <= 0
      ? 'No te quedan dados de puntos de golpe.'
      : s.hp >= d.maxHp
        ? 'Ya tienes los PG al máximo.'
        : null
  const spellName = (id: string) => rules.spell(id)?.name ?? id

  /** Aplica un cambio y ofrece deshacerlo en el aviso. */
  const undoable = (msg: string, next: Character) => {
    const before = c
    update(next)
    toast(msg, { label: 'Deshacer', run: () => update(before) })
  }

  const doDamage = (dmg: number, isCrit = false) => {
    const r = applyDamage(c, d, dmg, isCrit)
    if (r.next === c) return
    const lost = [r.fromTemp && `−${r.fromTemp} PG temporales`, r.lost && `−${r.lost} PG`].filter(Boolean).join(' y ') || `${dmg} de daño`
    let msg = lost
    if (r.instantDeath) msg = `${dmg} de daño: muerte instantánea`
    else if (r.died) msg += ': tercer fallo, mueres'
    else if (r.failures) msg += `: ${r.failures === 1 ? 'un fallo' : 'dos fallos'} de salvación contra muerte`
    else if (r.next.state.hp === 0) msg += ': caes inconsciente'
    if (r.droppedConcentration) msg += ` y pierdes la concentración en ${spellName(r.droppedConcentration)}`
    // Si sigue concentrándose, toca tirada de salvación de Constitución. El daño y su «Deshacer» van
    // en esa hoja: el aviso de abajo la taparía.
    if (r.next.state.concentration) {
      update(r.next)
      setConc({ dc: concentrationDc(dmg), spell: r.next.state.concentration, msg, before: c })
    } else undoable(msg, r.next)
  }

  const doHeal = (amt: number) => {
    const next = heal(c, d, amt)
    const got = next.state.hp - Math.max(0, s.hp)
    if (!got) {
      toast('Ya tienes los PG al máximo')
      return
    }
    undoable(`+${got} PG${down ? (dead ? ': vuelves a la vida' : ': vuelves en ti') : ''}`, next)
  }

  const doTemp = (amt: number) => {
    const next = setTempHp(c, amt)
    if (next === c) toast(`Ya tenías ${s.tempHp} PG temporales: te quedas con esos (no se suman)`)
    else if (s.tempHp > 0) undoable(`Ahora tienes ${next.state.tempHp} PG temporales (no se suman: te quedas con el valor más alto)`, next)
    else undoable(`+${amt} PG temporales: se gastan antes que tus PG`, next)
  }

  const applyAmount = (kind: 'dano' | 'cura' | 'temp') => {
    if (!n || n < 0) return
    if (kind === 'dano') {
      // A 0 PG el daño cuenta como fallos: antes hay que saber si ha sido un crítico
      if (down) {
        setCrit(false)
        setModal('dano0')
        return
      }
      doDamage(n)
    }
    if (kind === 'cura') doHeal(n)
    if (kind === 'temp') doTemp(n)
    setAmount('')
  }

  const saveHp = () => {
    const v = parseCount(hpInput.current?.value ?? '')
    if (v === undefined) return
    const next = setHp(c, d, v)
    if (next !== c) update(next)
  }

  const rollDeathSave = (r: number) => {
    const penalty = d.exhaustion.d20
    const next = deathSave(c, r, penalty)
    if (next === c) return
    // Con cansancio, el total es el dado menos la penalización (el 1 y el 20 cuentan por el dado)
    const total = r > 1 && r < 20 && penalty ? ` (${r} − ${penalty} = ${r - penalty})` : ''
    let msg = r >= 20 ? 'recuperas 1 PG y vuelves en ti' : r <= 1 ? 'dos fallos' : r - penalty >= 10 ? 'éxito' : 'fallo'
    if (isDead(next.state)) msg += `. ${deadText(c)}`
    else if (isStable(next.state)) msg += '. Ya estás estable'
    undoable(`Sacas un ${r}${total}: ${msg}`, next)
  }

  const spendDie = (r: number) => {
    const next = spendHitDie(c, d, r)
    if (next === c) return
    setLastRoll({ roll: r, healed: next.state.hp - s.hp, before: c })
    update(next)
  }

  const usoRow = (key: string, name: string, hint: string, control: ComponentChildren, extra?: ComponentChildren) => (
    <div class="li fi-use" key={key}>
      <div class="grow fi-use-text">
        <div class="fi-use-name">{name}</div>
        <div class="fi-hint">{hint}</div>
        {extra}
      </div>
      <div class="fi-use-ctl">{control}</div>
    </div>
  )

  // Rasgos que curan: «Usar» gasta el uso y aplica la curación de una vez
  const secondWindRes = d.resources.find((r) => r.key === SECOND_WIND)
  const layRes = d.resources.find((r) => r.key === LAY_ON_HANDS)
  const layLeft = layRes ? layRes.max - layRes.used : 0
  const missing = Math.max(0, d.maxHp - Math.max(0, s.hp))
  const layMax = laySelf ? Math.min(layLeft, missing) : layLeft
  const openLay = () => {
    const self = missing > 0
    setLaySelf(self)
    setLayPoints(Math.max(1, self ? Math.min(layLeft, missing) : Math.min(layLeft, 5)))
    setModal('manos')
  }
  const healButton = (r: ResourceView) => {
    if (r.key !== SECOND_WIND && r.key !== LAY_ON_HANDS) return undefined
    return (
      <button
        class="btn sm soft fi-use-btn"
        aria-haspopup="dialog"
        disabled={r.used >= r.max || s.hp <= 0}
        onClick={() => {
          if (r.key === LAY_ON_HANDS) openLay()
          else {
            setManualRoll('')
            setModal('aliento')
          }
        }}
      >
        Usar
      </button>
    )
  }

  const resourceRow = (r: ResourceView) =>
    usoRow(
      r.key,
      r.name,
      `${r.die ? `Dado ${r.die}. ` : ''}${RECHARGE[r.recharge] ?? ''}`,
      r.pool || r.max > 8 ? (
        <Stepper compact value={r.max - r.used} max={r.max} label={r.name} suffix={` / ${r.max}`} onChange={(left) => update(setResourceUsed(c, r.key, r.max - left, r.max))} />
      ) : (
        <Pips max={r.max} used={r.used} label={r.name} onChange={(u) => update(setResourceUsed(c, r.key, u, r.max))} />
      ),
      healButton(r),
    )

  const hasUses = d.spell?.slots.some((x) => x > 0) || !!d.spell?.pact || d.resources.length > 0
  const isConcentrating = !!s.concentration
  const getsInspiration = longRestInspiration(d)
  // El cansancio ya está restado en las cifras: la pista lo dice
  const tired = d.exhaustion.level > 0

  return (
    <div class="fi-estado">
      {/* Cifras de un vistazo */}
      <div class="band">
        <button type="button" aria-haspopup="dialog" onClick={() => setModal('ca')}>
          <div class="label">Armadura</div>
          <div class="v">{d.ac.value}</div>
          <div class="s">Te dan con {d.ac.value}+</div>
        </button>
        <div>
          <div class="label">Iniciativa</div>
          <div class="v">{signed(d.initiative)}</div>
          <div class="s">{tired ? `Cansancio −${d.exhaustion.d20}` : `Tiras d20 ${signed(d.initiative)}`}</div>
        </div>
        <div>
          <div class="label">Velocidad</div>
          <div class="v">{metres(d.speed)}</div>
          <div class="s">{tired ? `Cansancio −${metres(d.exhaustion.speed)}` : `${squares(d.speed)} casillas`}</div>
        </div>
      </div>

      {/* Puntos de golpe: la pieza principal */}
      <section class={`card frame fi-hp ${low ? 'fi-hp-low' : ''} ${down ? 'fi-hp-down' : ''}`} aria-label="Puntos de golpe">
        <div class="fi-hp-head">
          <span class="label">Puntos de golpe</span>
          {s.tempHp > 0 && <span class="tag fi-temp">+{s.tempHp} temporales</span>}
          {low && <span class="fi-low">Vida baja</span>}
        </div>
        <div class="fi-hp-main">
          <button class="iconbtn" aria-label="Quitar 1 PG" disabled={down} onClick={() => doDamage(1)}>
            −
          </button>
          <button class="fi-hp-num" aria-haspopup="dialog" aria-label={`PG actuales: ${Math.max(0, s.hp)} de ${d.maxHp}. Tocar para escribirlos`} onClick={() => setModal('hp')}>
            <span class="fi-hp-cur">{Math.max(0, s.hp)}</span>
            <span class="fi-hp-max"> / {d.maxHp}</span>
          </button>
          <button class="iconbtn" aria-label="Sumar 1 PG" onClick={() => doHeal(1)}>
            +
          </button>
        </div>
        <div class="fi-bar" aria-hidden="true">
          <i class="fi-bar-hp" style={{ width: `${Math.max(0, hpPct)}%` }} />
          {tempPct > 0 && <i class="fi-bar-temp" style={{ width: `${tempPct}%` }} />}
        </div>
        <div class="fi-amount">
          <input class="input num" inputMode="numeric" pattern="[0-9]*" placeholder="Cantidad" value={amount} onInput={(e) => setAmount((e.currentTarget as HTMLInputElement).value.replace(/\D/g, ''))} aria-label="Cantidad de PG" />
          <button class="btn fi-dmg" disabled={dead} onClick={() => applyAmount('dano')}>
            Daño
          </button>
          <button class="btn fi-heal" onClick={() => applyAmount('cura')}>
            Curar
          </button>
          <button class="btn fi-tmp" aria-label="PG temporales" onClick={() => applyAmount('temp')}>
            PG temp.
          </button>
        </div>
        {down && (
          <div class="fi-death">
            {dead ? (
              <>
                <p class="fi-death-title">{deadText(c)}</p>
                <p class="fi-hint">Solo la magia puede devolverte a la vida, por ejemplo el conjuro Revivir. Si te reviven, vuelves con 1 PG.</p>
                <button class="btn block fi-modal-gap" onClick={() => undoable('Vuelves a la vida con 1 PG', heal(c, d, 1))}>
                  Me han devuelto a la vida
                </button>
              </>
            ) : stable ? (
              <>
                <p class="fi-death-title">Estable a 0 PG</p>
                <p class="fi-hint">
                  Sigues inconsciente, pero ya no haces tiradas de salvación contra muerte. Si nadie te cura, recuperas 1 PG dentro de 1d4 horas. Si te hacen daño, dejas de estar estable.
                </p>
              </>
            ) : (
              <>
                <p class="fi-death-title">A 0 PG: tiradas de salvación contra muerte</p>
                <p class="fi-hint">
                  Al empezar cada turno tira 1d20: con 10 o más es un éxito y con menos, un fallo. Un 20 te devuelve a 1 PG y un 1 cuenta como dos fallos. Tres éxitos: quedas estable. Tres fallos: mueres.
                </p>
                <p class="fi-hint">
                  Si te hacen daño, es un fallo (dos si es un crítico) y, si el daño iguala o supera tus PG máximos ({d.maxHp}), mueres. Si alguien te cura, vuelves en ti.
                </p>
                {tired && <p class="fi-hint">Por el cansancio restas {d.exhaustion.d20} a cada tirada (aquí ya se resta); el 1 y el 20 cuentan por lo que sale en el dado.</p>}
                {/* En dos líneas: dentro de la tarjeta no cabe la fila del descanso corto */}
                <button class="btn soft block fi-modal-gap" onClick={() => rollDeathSave(rollDie(20))}>
                  Tirar 1d20 por mí
                </button>
                <div class="row fi-death-manual">
                  <input class="input num grow" inputMode="numeric" pattern="[0-9]*" placeholder="Ya he tirado" value={deathRoll} onInput={(e) => setDeathRoll((e.currentTarget as HTMLInputElement).value.replace(/\D/g, ''))} aria-label="Resultado del d20 que has tirado" />
                  <button
                    class="btn"
                    disabled={!deathRoll}
                    onClick={() => {
                      rollDeathSave(Math.max(1, Math.min(20, Number(deathRoll))))
                      setDeathRoll('')
                    }}
                  >
                    Apuntar
                  </button>
                </div>
              </>
            )}
            <div class="fi-death-grid">
              <div>
                <div class="label">Éxitos</div>
                <Pips count tone="good" centered max={3} used={s.deathSaves.success} label="Éxitos" onChange={(v) => update(patchState(c, { deathSaves: { ...s.deathSaves, success: nextPip(s.deathSaves.success, v) } }))} />
              </div>
              <div>
                <div class="label">Fallos</div>
                <Pips count tone="bad" centered max={3} used={s.deathSaves.fail} label="Fallos" onChange={(v) => update(patchState(c, { deathSaves: { ...s.deathSaves, fail: nextPip(s.deathSaves.fail, v) } }))} />
              </div>
            </div>
          </div>
        )}
      </section>

      {hasUses && (
        <>
          <h2>Usos</h2>
          <div class="list">
            {d.spell?.slots.map((max, i) =>
              max > 0
                ? usoRow(
                    `slot${i}`,
                    `Espacios de nivel ${i + 1}`,
                    'Gastas uno por conjuro. Vuelven con descanso largo',
                    <Pips max={max} used={Math.min(max, s.slotsUsed[i] ?? 0)} label={`Espacios de nivel ${i + 1}`} onChange={(u) => update(setSlotsUsed(c, d, i + 1, u))} />,
                  )
                : null,
            )}
            {d.spell?.pact &&
              usoRow(
                'pact',
                `Espacios de pacto de nivel ${d.spell.pact.level}`,
                'Gastas uno por conjuro. Vuelven con descanso corto o largo',
                <Pips max={d.spell.pact.slots} used={s.pactSlotsUsed} label="Espacios de pacto" onChange={(u) => update(setPactSlotsUsed(c, d, u))} />,
              )}
            {d.resources.map(resourceRow)}
          </div>
          <p class="fi-note">Toca un rombo para gastarlo; tócalo otra vez para recuperarlo.</p>
        </>
      )}

      {/* Cifras que te pide la DM */}
      <div class="band fi-band2">
        <div>
          <div class="label">Percepción pasiva</div>
          <div class="v">{d.passivePerception}</div>
          <div class="s">Lo que notas sin buscar</div>
        </div>
        {d.spell ? (
          <>
            <div>
              <div class="label">CD de conjuros</div>
              <div class="v">{d.spell.dc}</div>
              <div class="s">Para resistirlos</div>
            </div>
            <div>
              <div class="label">Ataque mágico</div>
              <div class="v">{signed(d.spell.attack)}</div>
              <div class="s">{tired ? `Cansancio −${d.exhaustion.d20}` : `Tiras d20 ${signed(d.spell.attack)}`}</div>
            </div>
          </>
        ) : (
          <div>
            <div class="label">Competencia</div>
            <div class="v">{signed(d.pb)}</div>
            <div class="s">Bonificador</div>
          </div>
        )}
      </div>

      <h2>En partida</h2>
      <div class="list">
        <div class={`li fi-row fi-insp ${s.heroicInspiration ? 'on' : ''}`}>
          <div class="grow">
            <div class="fi-row-title">
              <i class="fi-insp-mark" aria-hidden="true" />
              Inspiración heroica
            </div>
            <div class="fi-hint">{s.heroicInspiration ? 'La tienes. Gástala para repetir una tirada de d20.' : 'No la tienes. Te la da la DM y sirve para repetir una tirada de d20.'}</div>
          </div>
          {/* El botón dice lo que hace; el estado está en el rombo y en la pista */}
          <button
            class={`btn sm ${s.heroicInspiration ? 'soft' : ''}`}
            aria-label={s.heroicInspiration ? 'Gastar inspiración heroica' : 'Ganar inspiración heroica'}
            onClick={() => update(patchState(c, { heroicInspiration: !s.heroicInspiration }))}
          >
            {s.heroicInspiration ? 'Gastar' : 'Ganar'}
          </button>
        </div>
        <div class="li fi-row">
          <div class="grow">
            <div class="fi-row-title">Estados</div>
            {s.conditions.length === 0 ? (
              <div class="fi-hint">Ninguno. Si te derriban, te agarran, te asustan… añádelo aquí para recordar qué implica.</div>
            ) : (
              <div class="chips fi-conds">
                {s.conditions.map((id) => (
                  <button class="chip on" key={id} aria-haspopup="dialog" onClick={() => setCondition(id)}>
                    {rules.glossary(id)?.name ?? id}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button class="btn sm" aria-haspopup="dialog" onClick={() => setModal('estados')}>
            Añadir
          </button>
        </div>
        <div class="li fi-row">
          <div class="grow">
            <div class="fi-row-title">Cansancio</div>
            <div class="fi-hint">{s.exhaustion ? `Nivel ${s.exhaustion}: −${s.exhaustion * 2} a tus d20 y −${metres(s.exhaustion * 1.5)} de velocidad.` : 'Ninguno. Cada nivel te resta 2 a los d20 y 1,5 m de velocidad.'}</div>
          </div>
          <Stepper compact value={s.exhaustion} min={0} max={6} label="Cansancio" onChange={(v) => update(patchState(c, { exhaustion: v }))} />
        </div>
        {(d.spell || isConcentrating) && (
          <div class="li fi-row">
            <div class="grow">
              <div class="fi-row-title">Concentración</div>
              <div class="fi-hint">{isConcentrating ? spellName(s.concentration!) : 'No te estás concentrando en ningún conjuro.'}</div>
            </div>
            {isConcentrating && (
              <button class="btn sm" onClick={() => update(patchState(c, { concentration: undefined }))}>
                Terminar
              </button>
            )}
          </div>
        )}
      </div>

      <h2>Descansos</h2>
      <div class="card fi-rest">
        <div class="fi-rest-head">
          <div class="grow">
            <div class="fi-row-title">Dados de puntos de golpe</div>
            <div class="fi-hint">Se gastan en descansos cortos para curarte.</div>
          </div>
          <div class="fi-hd">
            <span class="fi-hd-v num">
              {hitDiceLeft}
              <span class="fi-hd-of"> / {d.level}</span>
            </span>
            <span class="fi-hint">d{d.hitDie}</span>
          </div>
        </div>
        <div class="grid2 fi-rest-btns">
          <button class="btn" aria-haspopup="dialog" onClick={() => setModal('corto')}>
            Descanso corto
          </button>
          <button class="btn primary" aria-haspopup="dialog" onClick={() => setModal('largo')}>
            Descanso largo
          </button>
        </div>
      </div>

      {/* ---------- Hojas ---------- */}

      <Modal open={modal === 'ca'} onClose={() => setModal(null)} title={`Clase de Armadura ${d.ac.value}`}>
        <p class="lede">Un enemigo te acierta si su tirada de ataque iguala o supera tu CA.</p>
        <div class="list fi-ac">
          {d.ac.parts.map((p) => {
            const [name, value] = acPart(p)
            return (
              <div class="li" key={p}>
                <span class="grow">{name}</span>
                {value && <span class="v">{value}</span>}
              </div>
            )
          })}
          <div class="li fi-total">
            <strong>Total</strong>
            <span class="v">{d.ac.value}</span>
          </div>
        </div>
        {d.spell && c.spells.extra.concat(c.spells.prepared.map((id) => ({ id, source: 'clase' }))).some((x) => x.id === 'armadura-de-mago') && (
          <button class={`chip fi-modal-gap ${s.toggles['armadura-de-mago'] ? 'on' : ''}`} aria-pressed={!!s.toggles['armadura-de-mago']} onClick={() => update(patchState(c, { toggles: { ...s.toggles, 'armadura-de-mago': !s.toggles['armadura-de-mago'] } }))}>
            {s.toggles['armadura-de-mago'] ? 'Armadura de mago activa' : 'Activar Armadura de mago'}
          </button>
        )}
      </Modal>

      <Modal open={modal === 'hp'} onClose={() => setModal(null)} title="Puntos de golpe actuales">
        <div class="fi-hp-edit">
          <input
            ref={hpInput}
            class="input num"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={String(Math.max(0, s.hp))}
            aria-label="PG actuales"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                saveHp()
                setModal(null)
              }
            }}
            onBlur={saveHp}
          />
          <span class="fi-hp-edit-max num">/ {d.maxHp}</span>
        </div>
        <p class="fi-note">Máximo {d.maxHp}. Se guarda al cerrar; si lo dejas vacío, no cambia.</p>
        <button
          class="btn primary block fi-modal-gap"
          onClick={() => {
            saveHp()
            setModal(null)
          }}
        >
          Guardar
        </button>
      </Modal>

      <Modal open={modal === 'dano0'} onClose={() => setModal(null)} title={`${n} de daño a 0 PG`}>
        <p class="lede">
          Cada vez que te hacen daño a 0 PG cuenta como un fallo en las tiradas de salvación contra muerte; si es un crítico, como dos. Si el daño iguala o supera tus PG máximos ({d.maxHp}), mueres.
          {stable && ' Además, dejas de estar estable.'}
        </p>
        <Option on={crit} onClick={() => setCrit(!crit)}>
          Ha sido un crítico (cuenta como dos fallos)
        </Option>
        <button
          class="btn primary block fi-modal-gap"
          onClick={() => {
            doDamage(n, crit)
            setAmount('')
            setModal(null)
          }}
        >
          Apuntar el daño
        </button>
      </Modal>

      <Modal open={!!conc} onClose={() => setConc(null)} title="Concentración">
        {conc && (
          <>
            <p class="lede">
              Tirada de salvación de Constitución CD {conc.dc} para mantener {spellName(conc.spell)}.
            </p>
            <p class="fi-note">
              Tiras d20 {signed(d.saves.con.bonus)}: si sacas {conc.dc} o más en total, la mantienes. La CD es 10 o la mitad del daño, lo que sea mayor.
            </p>
            <div class="grid2 fi-modal-gap">
              <button
                class="btn"
                onClick={() => {
                  update(patchState(c, { concentration: undefined }))
                  toast(`Pierdes la concentración: ${spellName(conc.spell)} termina`)
                  setConc(null)
                }}
              >
                La pierdo
              </button>
              <button class="btn primary" onClick={() => setConc(null)}>
                La mantengo
              </button>
            </div>
            <p class="fi-note fi-modal-gap">
              Apuntado: {conc.msg}.{' '}
              <button
                class="link"
                onClick={() => {
                  update(conc.before)
                  setConc(null)
                }}
              >
                Deshacer el daño
              </button>
            </p>
          </>
        )}
      </Modal>

      <Modal open={modal === 'aliento'} onClose={() => setModal(null)} title="Tomar aliento">
        {secondWindRes && (
          <>
            <p class="lede">
              Como acción adicional recuperas 1d10 + {d.level} PG (tu nivel de guerrero). Te {secondWindRes.max - secondWindRes.used === 1 ? 'queda 1 uso' : `quedan ${secondWindRes.max - secondWindRes.used} usos`}.
            </p>
            {(() => {
              const use = (r: number) => {
                const next = secondWind(c, d, r)
                if (!next) return
                setModal(null)
                undoable(`Tomar aliento: +${next.state.hp - Math.max(0, s.hp)} PG (${r} + ${d.level})`, next)
              }
              const full = s.hp >= d.maxHp
              return (
                <>
                  <div class="fi-roll-row">
                    <button class="btn soft" disabled={full} onClick={() => use(rollDie(10))}>
                      Tirar 1d10
                    </button>
                    <span class="fi-or">o</span>
                    <input class="input num" inputMode="numeric" pattern="[0-9]*" placeholder="Ya he tirado" disabled={full} value={manualRoll} onInput={(e) => setManualRoll((e.currentTarget as HTMLInputElement).value.replace(/\D/g, ''))} aria-label="Resultado del d10 que has tirado" />
                    <button
                      class="btn"
                      disabled={!manualRoll || full}
                      onClick={() => {
                        use(Math.max(1, Math.min(10, Number(manualRoll))))
                        setManualRoll('')
                      }}
                    >
                      Curar
                    </button>
                  </div>
                  <p class="fi-note">{full ? 'Ya tienes los PG al máximo.' : `Con un 5 en el dado, por ejemplo, recuperas ${secondWindHealing(d, 5)} PG.`}</p>
                </>
              )
            })()}
          </>
        )}
      </Modal>

      <Modal open={modal === 'manos'} onClose={() => setModal(null)} title="Imponer las manos">
        {layRes && (
          <>
            <p class="lede">
              Como acción adicional tocas a una criatura (puedes ser tú) y le devuelves los PG que elijas de tu reserva. Te quedan {layLeft} de {layRes.max}.
            </p>
            <div class="stack" role="radiogroup" aria-label="A quién curas">
              <Option
                radio
                on={laySelf}
                disabled={missing === 0}
                onClick={() => {
                  setLaySelf(true)
                  setLayPoints((p) => Math.max(1, Math.min(p, layLeft, missing)))
                }}
              >
                A mí{missing === 0 ? ' (ya tienes los PG al máximo)' : ''}
              </Option>
              <Option radio on={!laySelf} onClick={() => setLaySelf(false)}>
                A otra criatura
              </Option>
            </div>
            <div class="fi-modal-gap">
              <Stepper value={Math.min(layPoints, layMax)} min={1} max={Math.max(1, layMax)} label="Puntos que gastas" onChange={setLayPoints} />
            </div>
            <button
              class="btn primary block fi-modal-gap"
              disabled={layMax < 1}
              onClick={() => {
                const pts = Math.max(1, Math.min(layPoints, layMax))
                const next = layOnHands(c, d, pts, laySelf)
                if (!next) return
                setModal(null)
                undoable(laySelf ? `Imponer las manos: +${pts} PG` : `Imponer las manos: gastas ${pts} puntos de la reserva`, next)
              }}
            >
              {laySelf ? `Curarme ${Math.min(layPoints, layMax)} PG` : `Gastar ${Math.min(layPoints, layMax)} puntos`}
            </button>
            <p class="fi-note">Gastando 5 puntos también puedes quitarle el estado envenenado a la criatura (esos puntos no curan). Réstalos con el contador de Usos.</p>
          </>
        )}
      </Modal>

      <Modal open={modal === 'estados'} onClose={() => setModal(null)} title="Estados">
        <p class="lede">Toca «Activar» para apuntarlo o quitarlo. Despliega cada uno para ver lo que implica.</p>
        {conditions.map((g) => {
          const on = s.conditions.includes(g.id)
          return (
            <details class="item fi-cond" key={g.id}>
              <summary>
                <strong class="grow">{g.name}</strong>
                <button
                  class={`chip ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  onClick={(e) => {
                    e.preventDefault()
                    update(patchState(c, { conditions: on ? s.conditions.filter((x) => x !== g.id) : [...s.conditions, g.id] }))
                  }}
                >
                  {on ? 'Activo' : 'Activar'}
                </button>
              </summary>
              <div class="body">
                <RichText text={g.text} />
              </div>
            </details>
          )
        })}
        {exhaustion && (
          <details class="item fi-cond">
            <summary>
              <strong class="grow">{exhaustion.name}</strong>
              <span class="fi-hint">Se marca por niveles</span>
            </summary>
            <div class="body">
              <RichText text={exhaustion.text} />
            </div>
          </details>
        )}
      </Modal>

      <Modal open={!!condition} onClose={() => setCondition(null)} title={condition ? (rules.glossary(condition)?.name ?? condition) : ''}>
        <RichText text={condition ? rules.glossary(condition)?.text : ''} />
        <button
          class="btn block fi-modal-gap"
          onClick={() => {
            update(patchState(c, { conditions: s.conditions.filter((x) => x !== condition) }))
            setCondition(null)
          }}
        >
          Ya no lo tengo
        </button>
      </Modal>

      <Modal
        open={modal === 'corto'}
        onClose={() => {
          setModal(null)
          setLastRoll(null)
        }}
        title="Descanso corto (1 hora)"
      >
        {!restOk && <p class="notice error">Para empezar un descanso necesitas al menos 1 PG. A 0 PG, primero alguien tiene que curarte.</p>}
        <p class="lede">
          Puedes gastar dados de puntos de golpe para curarte: tiras el dado y sumas tu modificador por Constitución ({signed(d.mods.con)}).
        </p>
        <div class="list fi-rest-stats">
          <div class="li">
            Puntos de golpe
            <span class="v">
              {Math.max(0, s.hp)} / {d.maxHp}
            </span>
          </div>
          <div class="li">
            Dados de puntos de golpe
            <span class="v">
              {hitDiceLeft} / {d.level}
            </span>
          </div>
        </div>

        <h3 class="fi-modal-h3">Gastar un dado de puntos de golpe</h3>
        <div class="fi-roll-row">
          <button class="btn soft" disabled={!!noHitDie} aria-describedby={noHitDie ? 'fi-no-hd' : undefined} onClick={() => spendDie(rollDie(d.hitDie))}>
            Tirar 1d{d.hitDie}
          </button>
          <span class="fi-or">o</span>
          <input class="input num" inputMode="numeric" pattern="[0-9]*" placeholder="Ya he tirado" disabled={!!noHitDie} value={manualRoll} onInput={(e) => setManualRoll((e.currentTarget as HTMLInputElement).value.replace(/\D/g, ''))} aria-label="Resultado del dado que has tirado" aria-describedby={noHitDie ? 'fi-no-hd' : undefined} />
          <button
            class="btn"
            disabled={!manualRoll || !!noHitDie}
            onClick={() => {
              spendDie(Math.max(1, Math.min(d.hitDie, Number(manualRoll))))
              setManualRoll('')
            }}
          >
            Curar
          </button>
        </div>
        {noHitDie && (
          <p class="fi-note" id="fi-no-hd">
            {noHitDie}
          </p>
        )}
        {lastRoll && (
          <div class="fi-roll" aria-live="polite">
            <span class="label">Te curas</span>
            <p class="roll">
              {lastRoll.roll} {signed(d.mods.con)} = {lastRoll.healed} PG
            </p>
            <button
              class="btn sm ghost"
              onClick={() => {
                update(lastRoll.before)
                setLastRoll(null)
              }}
            >
              Deshacer
            </button>
          </div>
        )}

        {(() => {
          const back = d.resources.filter((r) => r.recharge === 'corto' || r.recharge === 'corto-uno')
          return (
            <>
              <h3 class="fi-modal-h3">Al terminar recuperas</h3>
              <ul class="fi-ul">
                {back.map((r) => (
                  <li key={r.key}>
                    {r.name}
                    {r.recharge === 'corto-uno' ? ' (1 uso)' : ''}
                  </li>
                ))}
                {d.spell?.pact && <li>Espacios de magia de pacto</li>}
                {!back.length && !d.spell?.pact && <li class="muted">Nada más: solo lo que cures con dados de puntos de golpe.</li>}
              </ul>
            </>
          )
        })()}
        <button
          class="btn primary block fi-modal-gap"
          disabled={!restOk}
          onClick={() => {
            const before = c
            update(shortRest(c, d))
            setModal(null)
            setLastRoll(null)
            toast('Descanso corto terminado', { label: 'Deshacer', run: () => update(before) })
          }}
        >
          Terminar descanso corto
        </button>
      </Modal>

      <Modal open={modal === 'largo'} onClose={() => setModal(null)} title="Descanso largo (8 horas)">
        {!restOk && (
          <p class="notice error">
            Para empezar un descanso largo necesitas al menos 1 PG. A 0 PG, primero alguien tiene que curarte (o, si estás estable, esperar a recuperar 1 PG).
          </p>
        )}
        <p class="lede">Al terminar:</p>
        <ul class="fi-ul">
          <li>PG al máximo ({d.maxHp}) y recuperas todos los dados de puntos de golpe.</li>
          {d.spell && <li>Recuperas todos los espacios de conjuro.</li>}
          {d.resources.length > 0 && <li>Recuperas: {d.resources.map((r) => r.name).join(', ')}.</li>}
          {s.exhaustion > 0 && <li>Tu cansancio baja 1 nivel.</li>}
          {getsInspiration && !s.heroicInspiration && <li>Obtienes Inspiración heroica (por tu rasgo Ingenioso).</li>}
          <li>Los PG temporales desaparecen.</li>
        </ul>
        <p class="fi-note">Si te interrumpen (combate, lanzar un conjuro que no sea truco, recibir daño), no cuenta.</p>
        <button
          class="btn primary block fi-modal-gap"
          disabled={!restOk}
          onClick={() => {
            const before = c
            update(longRest(c, d))
            setModal(null)
            toast(getsInspiration && !s.heroicInspiration ? 'Descanso largo: todo a tope y con Inspiración heroica' : 'Descanso largo: todo a tope', { label: 'Deshacer', run: () => update(before) })
          }}
        >
          Terminar descanso largo
        </button>
      </Modal>
    </div>
  )
}
