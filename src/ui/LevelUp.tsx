import { useMemo, useState } from 'preact/hooks'
import type { Character, CustomFeature } from '../model/character'
import { metres, signed } from '../rules/constants'
import { masteryWeapons, slug } from '../rules/create'
import { derive } from '../rules/derive'
import {
  applyLevelUp,
  choiceMissing,
  choiceOptions,
  emptyInput,
  languagesKey,
  planLevelUp,
  previewLevelUp,
  recommendChoice,
  recommendMasteries,
  recommendSpells,
  type ChoiceValue,
  type LevelUpInput,
  type LevelUpPlan,
  type PlannedChoice,
} from '../rules/levelup'
import { go, href } from '../router'
import { getCharacter, saveCharacter, useStore } from '../store'
import { ChoiceEditor } from './ChoiceEditor'
import { Icon, Option, Portrait, RichText, labelFor, paletteStyle, rollDie, toast, useRules } from './common'
import { SpellPicker, useClassPool } from './SpellEditor'
import { MasteryPicker } from './tabs/Turno'
import './css/portada.css'
// «Elegir por mí» y la línea de lo que falta son las mismas piezas que en el creador.
import './css/crear.css'

const andList = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`)
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
/** Elecciones de una lista: las que se pueden quedar marcadas solas si no hay más. */
const LISTS = new Set(['opcion', 'metamagia', 'invocacion'])

export function LevelUp({ id }: { id: string }) {
  useStore()
  const c = getCharacter(id)
  if (!c)
    return (
      <div class="wrap pt-missing">
        <p class="notice">No encuentro esta ficha. Puede que se haya borrado de este móvil.</p>
        <a class="btn brass" href="#/">
          Volver al inicio
        </a>
      </div>
    )
  return (
    <div class="sheet" style={paletteStyle(c)}>
      <Wizard c={c} />
    </div>
  )
}

/** Clase, nivel máximo de espacio y trucos/conjuros que hay para elegir (para saber cuántos se pueden pedir). */
function spellPoolSizes(c: Character, plan: LevelUpPlan, rules: ReturnType<typeof useRules>, always: string[]) {
  const sp = plan.spells!
  const extraLists = c.classId === 'bardo' && plan.to >= 10 ? ['bardo', 'clerigo', 'druida', 'mago'] : []
  const ids = new Set(plan.cls.spellList ?? [])
  const pool = rules.book.spells.filter((s) => ids.has(s.id) || s.classes.some((k) => extraLists.includes(k)))
  return {
    cantrips: pool.filter((s) => s.level === 0).length,
    leveled: pool.filter((s) => s.level > 0 && s.level <= sp.maxLevelAfter && !always.includes(s.id)).length,
  }
}

function Wizard({ c }: { c: Character }) {
  const rules = useRules()
  // La única subclase del SRD ya va marcada (se puede cambiar por una de otro libro).
  const [subclassId, setSubclassId] = useState<string | undefined>(() => {
    const p = planLevelUp(c, rules)
    return p?.needsSubclass && p.subclassOptions.length === 1 ? p.subclassOptions[0].id : undefined
  })
  const [mesaSub, setMesaSub] = useState({ name: '', text: '' })
  const [mesaText, setMesaText] = useState('')
  const plan = useMemo(() => planLevelUp(c, rules, subclassId), [c, rules, subclassId])
  const [input, setInput] = useState<LevelUpInput>(() => emptyInput(c))
  const [values, setValues] = useState<Record<string, ChoiceValue>>({})
  const [rolled, setRolled] = useState<number | null>(null)
  /** Lo que escribe a mano en «¿Has tirado un dado de verdad?» (vacío = aún nada). */
  const [typed, setTyped] = useState('')
  const [step, setStep] = useState(0)
  const [masteryOpen, setMasteryOpen] = useState(false)
  // Lo que acaba de hacer «Elegir por mí» en este paso; se borra al cambiar de paso.
  const [picked, setPicked] = useState<{ step: string; text: string } | null>(null)
  const before = useMemo(() => derive(c, rules), [c, rules])

  if (!plan)
    return (
      <div class="wrap pt-missing">
        <p class="notice">{c.level >= 20 ? 'Ya estás a nivel 20.' : 'No encuentro los datos de tu clase.'}</p>
        <a class="btn brass" href={href({ name: 'sheet', id: c.id, tab: 'estado' })}>
          Volver a la ficha
        </a>
      </div>
    )

  const isMesaSub = subclassId === 'mesa'
  const subNeedsText = !plan.needsSubclass && c.subclassId && !rules.subclass(c.subclassId) && plan.classFeatures.some((f) => /subclase/i.test(f.name))

  /** Valor de una elección: lo elegido o, si solo hay tantas opciones como hay que elegir, esas. */
  const valueOf = (pc: PlannedChoice): ChoiceValue | undefined => {
    const v = values[pc.choice.id]
    if (v || !LISTS.has(pc.choice.kind)) return v
    const opts = choiceOptions(c, rules, pc.choice, plan.to, [], subclassId)
    return opts.length > 0 && opts.length === pc.choice.count ? { ids: opts.map((o) => o.id) } : undefined
  }

  // Junta las elecciones en la entrada final
  const finalInput = (): LevelUpInput => {
    const out: LevelUpInput = { ...input, choices: { ...input.choices }, feats: [], addExpertise: [], addSkills: [], extraSpells: [], dropExtra: [], languages: [], customFeatures: mesaFeatures() }
    out.subclassId = isMesaSub ? slug(mesaSub.name) || undefined : (subclassId ?? undefined)
    for (const pc of plan.choices) {
      const v = valueOf(pc)
      if (!v) continue
      out.choices[pc.choice.id] = v.ids
      if (v.feat) out.feats.push(v.feat)
      if (v.expertise) out.addExpertise.push(...v.expertise)
      if (v.skills) out.addSkills.push(...v.skills)
      if (v.extra) out.extraSpells!.push(...v.extra)
      if (v.extraSources) out.dropExtra!.push(...v.extraSources)
      if (v.languages) {
        out.languages!.push(...v.languages)
        out.choices[languagesKey(pc.choice.id)] = v.languages
      }
    }
    return out
  }
  const mesaFeatures = (): CustomFeature[] => {
    const out: CustomFeature[] = []
    if (isMesaSub && mesaSub.text.trim())
      out.push({ id: `${slug(mesaSub.name)}-n${plan.to}`, name: `${mesaSub.name} (nivel ${plan.to})`, text: mesaSub.text.trim(), source: 'mesa', level: plan.to })
    if (subNeedsText && mesaText.trim())
      out.push({ id: `${c.subclassId}-n${plan.to}`, name: `Subclase: nivel ${plan.to}`, text: mesaText.trim(), source: 'mesa', level: plan.to })
    return out
  }
  const preview = previewLevelUp(c, rules, finalInput())
  const after = derive(preview, rules)
  const alwaysPrepared = after.spell?.alwaysPrepared ?? []

  // Pasos. `missing`: lo que falta para seguir (vacío = listo); `pick`: «Elegir por mí».
  type Step = { id: string; title: string; missing?: string; pick?: () => string; body: () => preact.JSX.Element }
  const steps: Step[] = []
  steps.push({
    id: 'resumen',
    title: `Nivel ${plan.to}`,
    body: () => (
      <div class="stack">
        <p>
          ¡Enhorabuena! {c.name} pasa de nivel {plan.from} a <strong>nivel {plan.to}</strong>. Esto es lo que ganas; en los pasos siguientes te pregunto lo que hay que elegir.
        </p>
        {plan.pbAfter > plan.pbBefore && (
          <p class="notice">
            Tu <strong>bonificador por competencia</strong> sube a {signed(plan.pbAfter)}: mejoran tus ataques, habilidades competentes, salvaciones y CD.
          </p>
        )}
        {[...plan.classFeatures, ...plan.subclassFeatures, ...plan.speciesTraits].length > 0 && (
          <div class="list pt-gains">
            {[...plan.classFeatures, ...plan.subclassFeatures, ...plan.speciesTraits].map((f) => (
              <div class="pt-gain" key={f.id}>
                <h3>{f.name}</h3>
                {f.summary ? <p>{f.summary}</p> : <RichText text={f.text.split('\n')[0]} />}
              </div>
            ))}
          </div>
        )}
        {plan.speciesSpells.length > 0 && (
          <p class="notice">
            <strong>Por tu especie</strong> aprendes {andList(plan.speciesSpells.map((s) => rules.spell(s.id)?.name.toLowerCase() ?? s.id))}: puedes lanzar{' '}
            {plan.speciesSpells.length > 1 ? 'cada uno' : 'lo'} una vez sin gastar espacios de conjuro y recuperarlo con un descanso largo.
          </p>
        )}
        {plan.spells && plan.spells.slotsAfter.join() !== plan.spells.slotsBefore.join() && (
          <p class="notice">
            <strong>Espacios de conjuro:</strong> {plan.spells.slotsAfter.map((n, i) => `${n} de nivel ${i + 1}`).join(', ')}.
            {plan.spells.maxLevelAfter > plan.spells.maxLevelBefore && <> ¡Ya puedes preparar conjuros de nivel {plan.spells.maxLevelAfter}!</>}
          </p>
        )}
      </div>
    ),
  })

  const typedN = typed.trim() ? Number(typed) : null
  const typedBad = typedN !== null && !(Number.isInteger(typedN) && typedN >= 1 && typedN <= plan.hitDie)
  steps.push({
    id: 'pg',
    title: 'Puntos de golpe',
    missing: typedBad ? `Escribe un número del 1 al ${plan.hitDie}, lo que ha salido en el dado.` : undefined,
    pick: () => {
      setRolled(null)
      setTyped('')
      setInput({ ...input, hpRoll: null })
      return `He puesto la media fija: ${plan.hpAverage}.`
    },
    body: () => {
      const gain = after.maxHp - before.maxHp
      const extra = gain - Math.max(1, (input.hpRoll ?? plan.hpAverage) + before.mods.con)
      return (
        <div class="stack">
          <p>
            Ganas 1d{plan.hitDie} + tu Constitución ({signed(before.mods.con)}). Puedes tirar el dado o coger la media fija ({plan.hpAverage}), que es lo más seguro. Pregunta a la DM qué prefiere la mesa.
          </p>
          <Option
            radio
            on={input.hpRoll === null}
            onClick={() => {
              setRolled(null)
              setTyped('')
              setInput({ ...input, hpRoll: null })
            }}
          >
            <strong>Media fija: {plan.hpAverage}</strong>
          </Option>
          <Option
            radio
            on={input.hpRoll !== null}
            onClick={() => {
              const r = rollDie(plan.hitDie)
              setRolled(r)
              setTyped('')
              setInput({ ...input, hpRoll: r })
            }}
          >
            <strong>Tirar 1d{plan.hitDie}</strong>
            {rolled !== null && <span class="pt-rolled"> Ha salido {rolled}.</span>}
          </Option>
          {/* Con la media fija no hay dado que escribir */}
          {input.hpRoll !== null && (
            <label class="field pt-real">
              <span class="label">¿Has tirado un dado de verdad? Escribe el resultado (del 1 al {plan.hitDie}):</span>
              <input
                class="input num"
                inputMode="numeric"
                aria-label="Resultado del dado de puntos de golpe"
                value={typed}
                onInput={(e) => {
                  const t = (e.currentTarget as HTMLInputElement).value.replace(/\D/g, '').slice(0, 2)
                  setTyped(t)
                  const n = Number(t)
                  // Vacío: aún no ha escrito nada, vale la tirada de la app. Fuera de 1..dado: no vale.
                  if (!t) setInput({ ...input, hpRoll: rolled ?? input.hpRoll })
                  else if (n >= 1 && n <= plan.hitDie) setInput({ ...input, hpRoll: n })
                }}
              />
            </label>
          )}
          <div class="pt-hp" aria-live="polite">
            <span class="roll">+{gain} PG</span>
            <span class="pt-hp-s num">
              PG máximos: <strong>{after.maxHp}</strong> (antes {before.maxHp})
            </span>
            {extra > 0 && <span class="pt-hp-s small">Incluye +{extra} de otros rasgos o dotes.</span>}
          </div>
        </div>
      )
    },
  })

  if (plan.needsSubclass) {
    const srdSubs = plan.subclassOptions
    steps.push({
      id: 'subclase',
      title: 'Subclase',
      missing: !subclassId ? 'Elige una subclase.' : isMesaSub && !mesaSub.name.trim() ? 'Escribe el nombre de tu subclase.' : undefined,
      pick: srdSubs.length
        ? () => {
            setSubclassId(srdSubs[0].id)
            return `He elegido ${srdSubs[0].name}.`
          }
        : undefined,
      body: () => (
        <div class="stack">
          <p>
            A nivel {plan.to} eliges tu subclase: una especialidad de {plan.cls.name.toLowerCase()} que te da rasgos ahora y en niveles más altos.
            {srdSubs.length === 1 && <> Aquí solo viene una; si la tuya es de otro libro, elige «Otra de tu libro».</>}
          </p>
          {srdSubs.map((s) => (
            <Option key={s.id} radio on={subclassId === s.id} onClick={() => setSubclassId(s.id)}>
              <strong>{s.name}</strong>
              {s.summary && <span class="small pt-optnote">{s.summary}</span>}
            </Option>
          ))}
          <div class={`pt-mesa ${isMesaSub ? 'open' : ''}`}>
            <Option radio on={isMesaSub} onClick={() => setSubclassId('mesa')}>
              <strong>Otra de tu libro</strong>
              <span class="small pt-optnote">Si tu subclase viene en otro libro y no aparece aquí, escribe su nombre y copia sus rasgos.</span>
            </Option>
            {isMesaSub && (
              <div class="pt-mesa-fields">
                <label class="field">
                  <span class="label">Nombre de la subclase</span>
                  <input class="input" value={mesaSub.name} onInput={(e) => setMesaSub({ ...mesaSub, name: (e.currentTarget as HTMLInputElement).value })} />
                </label>
                <label class="field">
                  <span class="label">Rasgos de nivel {plan.to} (cópialos del libro)</span>
                  <textarea class="input pt-tall" value={mesaSub.text} onInput={(e) => setMesaSub({ ...mesaSub, text: (e.currentTarget as HTMLTextAreaElement).value })} />
                </label>
                {!mesaSub.name.trim() && <p class="small faint">Escribe el nombre para poder seguir. Los rasgos puedes dejarlos para luego.</p>}
              </div>
            )}
          </div>
          {plan.subclass && plan.subclassFeatures.length > 0 && (
            <>
              <h2 class="pt-h2">Qué te da {plan.subclass.name}</h2>
              <div class="list pt-gains">
                {plan.subclassFeatures.map((f) => (
                  <div class="pt-gain" key={f.id}>
                    <h3>{f.name}</h3>
                    {f.summary && <p class="summary">{f.summary}</p>}
                    <RichText text={f.text} class="small" />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ),
    })
  }

  if (subNeedsText) {
    steps.push({
      id: 'mesa',
      title: 'Tu subclase',
      body: () => (
        <div class="stack">
          <p>Tu subclase viene de otro libro. Si a este nivel te da un rasgo, cópialo aquí para tenerlo en la ficha (puedes dejarlo vacío).</p>
          <label class="field">
            <span class="label">Rasgo de subclase de nivel {plan.to}</span>
            <textarea class="input pt-tall" value={mesaText} onInput={(e) => setMesaText((e.currentTarget as HTMLTextAreaElement).value)} />
          </label>
        </div>
      ),
    })
  }

  for (const pc of plan.choices) {
    const v = valueOf(pc)
    steps.push({
      id: `c:${pc.choice.id}`,
      title: pc.feature.name,
      missing: choiceMissing(pc.choice, v, rules),
      pick: () => {
        const r = recommendChoice(c, rules, pc, plan.to, subclassId)
        setValues({ ...values, [pc.choice.id]: r })
        return pickedChoiceText(r, pc, rules)
      },
      body: () => (
        <div class="stack">
          {pc.feature.summary && <p class="summary">{pc.feature.summary}</p>}
          <ChoiceEditor
            c={c}
            d={before}
            feature={pc.feature}
            choice={pc.choice}
            level={plan.to}
            value={v}
            onChange={(nv) => setValues({ ...values, [pc.choice.id]: nv })}
            origin={pc.origin}
            subclassId={subclassId}
            maxSlot={after.spell?.maxSpellLevel}
          />
        </div>
      ),
    })
  }

  const sp = plan.spells
  if (sp && (sp.cantripsAfter > sp.cantripsBefore || sp.preparedAfter > sp.preparedBefore || sp.maxLevelAfter > sp.maxLevelBefore || plan.cls.spellcasting)) {
    const sizes = spellPoolSizes(c, plan, rules, alwaysPrepared)
    const prepared = input.prepared.filter((x) => !alwaysPrepared.includes(x))
    const wantC = Math.min(sp.cantripsAfter, sizes.cantrips)
    const wantP = Math.min(sp.preparedAfter, sizes.leveled)
    const leftC = wantC - input.cantrips.length
    const leftP = wantP - prepared.length
    steps.push({
      id: 'conjuros',
      title: 'Conjuros',
      missing:
        input.cantrips.length > sp.cantripsAfter
          ? `Tienes ${input.cantrips.length} trucos y a nivel ${plan.to} son ${sp.cantripsAfter}: quita ${input.cantrips.length - sp.cantripsAfter}.`
          : prepared.length > sp.preparedAfter
            ? `Tienes ${prepared.length} conjuros preparados y a nivel ${plan.to} son ${sp.preparedAfter}: quita ${prepared.length - sp.preparedAfter}.`
            : leftC > 0
              ? `Te ${plural(leftC, 'falta', 'faltan')} ${leftC} ${plural(leftC, 'truco', 'trucos')}.`
              : leftP > 0
                ? `Te ${plural(leftP, 'falta', 'faltan')} ${leftP} ${plural(leftP, 'conjuro', 'conjuros')} por preparar.`
                : undefined,
      pick: () => {
        const r = recommendSpells(c, rules, plan, input, alwaysPrepared)
        const added = [...r.cantrips.filter((x) => !input.cantrips.includes(x)), ...r.prepared.filter((x) => !input.prepared.includes(x))]
        setInput({ ...input, ...r })
        return added.length ? `He añadido ${andList(added.map((x) => rules.spell(x)?.name ?? x))}.` : 'Ya tienes todos los que te tocan.'
      },
      body: () => <SpellsStep c={c} plan={plan} input={input} setInput={setInput} alwaysPrepared={alwaysPrepared} />,
    })
  }

  if (plan.masteriesAfter > plan.masteriesBefore) {
    const allowed = masteryWeapons(plan.cls, rules).length
    const left = Math.min(plan.masteriesAfter, allowed) - input.masteries.length
    steps.push({
      id: 'maestrias',
      title: 'Maestría con armas',
      missing: left > 0 ? `Elige ${left} ${plural(left, 'arma', 'armas')} más para Maestría con armas.` : undefined,
      pick: () => {
        const ids = recommendMasteries(c, rules, plan.masteriesAfter)
        setInput({ ...input, masteries: ids })
        return `He elegido ${andList(ids.map((x) => rules.weapon(x)?.name.toLowerCase() ?? x))}.`
      },
      body: () => (
        <div class="stack">
          <p>
            Ahora puedes tener maestría con {plan.masteriesAfter} armas (antes {plan.masteriesBefore}).
            {input.masteries.length > 0 && <> Elegidas: {andList(input.masteries.map((x) => rules.weapon(x)?.name.toLowerCase() ?? x))}.</>}
          </p>
          <button class="btn block soft" onClick={() => setMasteryOpen(true)}>
            Elegir armas ({input.masteries.length}/{plan.masteriesAfter})
          </button>
          <MasteryPicker open={masteryOpen} onClose={() => setMasteryOpen(false)} max={plan.masteriesAfter} chosen={input.masteries} onSave={(ids) => setInput({ ...input, masteries: ids })} cls={plan.cls} />
        </div>
      ),
    })
  }

  steps.push({
    id: 'fin',
    title: 'Repaso',
    body: () => (
      <div class="stack">
        <p>Así queda {c.name} a nivel {plan.to}. Si todo está bien, toca «Subir a nivel {plan.to}».</p>
        <div class="band pt-band">
          <div>
            <div class="label">PG máximos</div>
            <div class="v">{after.maxHp}</div>
            <Before now={after.maxHp} was={before.maxHp} />
          </div>
          <div>
            <div class="label">Armadura</div>
            <div class="v">{after.ac.value}</div>
            <Before now={after.ac.value} was={before.ac.value} />
          </div>
          <div>
            <div class="label">Competencia</div>
            <div class="v">{signed(after.pb)}</div>
            <Before now={signed(after.pb)} was={signed(before.pb)} />
          </div>
        </div>
        {(after.spell || after.speed !== before.speed) && (
          <div class="list pt-facts">
            {after.spell && (
              <>
                <div class="li">
                  <span>CD de conjuros</span>
                  <span class="v">{after.spell.dc}</span>
                </div>
                <div class="li">
                  <span>Ataque mágico</span>
                  <span class="v">{signed(after.spell.attack)}</span>
                </div>
                {after.spell.slots.length > 0 && (
                  <div class="li">
                    <span>Espacios de conjuro</span>
                    <span class="v pt-slots">{after.spell.slots.map((n, i) => `${n} de nivel ${i + 1}`).join(', ')}</span>
                  </div>
                )}
              </>
            )}
            {after.speed !== before.speed && (
              <div class="li">
                <span>Velocidad</span>
                <span class="v">{metres(after.speed)}</span>
              </div>
            )}
          </div>
        )}
        {after.warnings.filter((w) => w.kind !== 'aviso').length > 0 && (
          <div class="notice">
            <strong>Quedará pendiente</strong>
            <ul>
              {after.warnings
                .filter((w) => w.kind !== 'aviso')
                .map((w) => (
                  <li key={w.text}>{w.text}</li>
                ))}
            </ul>
            <p class="small pt-pend">Puedes subir igualmente y completarlo luego desde la ficha.</p>
          </div>
        )}
        <p class="small muted pt-hint">Si te equivocas, en Personaje puedes deshacer la subida de nivel.</p>
      </div>
    ),
  })

  const at = Math.min(step, steps.length - 1)
  const cur = steps[at]
  const last = at >= steps.length - 1

  const finish = () => {
    const fi = finalInput()
    const summary = [
      `Nivel ${plan.to}`,
      `PG máximos: ${after.maxHp} (antes ${before.maxHp}), ${fi.hpRoll === null ? 'con la media' : `con un ${fi.hpRoll} en el dado`}`,
      ...plan.classFeatures.map((f) => f.name),
      ...(fi.subclassId ? [`Subclase: ${rules.subclass(fi.subclassId)?.name ?? mesaSub.name}`] : []),
    ]
    const ok = saveCharacter(applyLevelUp(c, rules, fi, summary))
    toast(ok ? `¡${c.name} ya es nivel ${plan.to}!` : `${c.name} ya es nivel ${plan.to}, pero no se ha podido guardar en el móvil: exporta una copia (mira el aviso de arriba)`)
    // Sustituye la entrada del asistente: «Atrás» vuelve a la ficha, no a otra subida.
    go({ name: 'sheet', id: c.id, tab: 'estado' }, true)
  }

  // Cada paso empieza arriba, aunque el anterior fuera largo
  const goStep = (n: number) => {
    setStep(n)
    setPicked(null)
    window.scrollTo(0, 0)
  }

  return (
    <div class="wrap pt-wizard">
      <div class="pt-bar">
        <a class="btn sm ghost" href={href({ name: 'sheet', id: c.id, tab: 'estado' })}>
          Cancelar
        </a>
        <span />
        <span class="pt-stepof num">
          Paso {at + 1} de {steps.length}
        </span>
      </div>
      <header class="pt-whead">
        <Portrait c={c} size={64} />
        <div class="grow">
          <p class="label">Subir de nivel</p>
          <h1 class="pt-wtitle">{cur.title}</h1>
        </div>
      </header>
      <ol class="pt-steps" aria-hidden="true">
        {steps.map((s, i) => (
          <li key={s.id} class={i < at ? 'done' : i === at ? 'cur' : ''}>
            <span>
              <b>{i + 1}</b>
            </span>
          </li>
        ))}
      </ol>
      {cur.pick && (
        <div class="cr-pickrow">
          <button type="button" class="btn brass sm cr-pick" onClick={() => setPicked({ step: cur.id, text: cur.pick!() })}>
            Elegir por mí
          </button>
          <p class="cr-picked" role="status">
            {picked?.step === cur.id ? picked.text : ''}
          </p>
        </div>
      )}
      <div class="cr-body">{cur.body()}</div>
      <div class="footerbar cr-foot">
        {cur.missing && !last && (
          <p class="cr-missing" role="status">
            {cur.missing}
          </p>
        )}
        <button class="btn pt-back" disabled={at === 0} onClick={() => goStep(at - 1)}>
          <Icon name="atras" size={20} />
          Atrás
        </button>
        {last ? (
          <button class="btn primary grow" onClick={finish}>
            Subir a nivel {plan.to}
          </button>
        ) : (
          <button class="btn primary grow" disabled={!!cur.missing} onClick={() => goStep(at + 1)}>
            Siguiente
          </button>
        )}
      </div>
    </div>
  )
}

/** Lo que dice la línea de «Elegir por mí» tras elegir en un rasgo. */
function pickedChoiceText(v: ChoiceValue, pc: PlannedChoice, rules: ReturnType<typeof useRules>): string {
  if (v.feat) {
    const inc = Object.entries(v.feat.abilityIncrease ?? {}).filter(([, n]) => n)
    const name = rules.feat(v.feat.id)?.name ?? v.feat.id
    return inc.length ? `He elegido ${name}: ${andList(inc.map(([a, n]) => `+${n} a ${labelFor(rules, a)}`))}.` : `He elegido ${name}.`
  }
  const names = v.ids.map((id) => pc.choice.options?.find((o) => o.id === id)?.name ?? labelFor(rules, id))
  const langs = v.languages?.length ? ` Idiomas: ${andList(v.languages)}.` : ''
  return names.length ? `He elegido ${andList(names)}.${langs}` : 'No queda nada que elegir aquí.'
}

/** «antes 14» bajo una cifra del repaso, solo si ha cambiado. */
function Before({ now, was }: { now: number | string; was: number | string }) {
  return now === was ? null : <div class="s pt-up">antes {was}</div>
}

function SpellsStep({
  c,
  plan,
  input,
  setInput,
  alwaysPrepared,
}: {
  c: Character
  plan: LevelUpPlan
  input: LevelUpInput
  setInput: (i: LevelUpInput) => void
  alwaysPrepared: string[]
}) {
  const sp = plan.spells!
  const extraLists = c.classId === 'bardo' && plan.to >= 10 ? ['bardo', 'clerigo', 'druida', 'mago'] : []
  const pool = useClassPool(c.classId, sp.maxLevelAfter, extraLists)
  const [tab, setTab] = useState<'trucos' | 'preparados'>(sp.cantripsAfter > input.cantrips.length ? 'trucos' : 'preparados')
  const prepared = input.prepared.filter((x) => !alwaysPrepared.includes(x))
  const toggle = (key: 'cantrips' | 'prepared', id: string) => {
    const list = input[key]
    setInput({ ...input, [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] })
  }
  // Las frases salen de los mismos números que los contadores de abajo.
  const newC = sp.cantripsAfter - sp.cantripsBefore
  const newP = sp.preparedAfter - sp.preparedBefore
  const leftC = sp.cantripsAfter - input.cantrips.length
  const leftP = sp.preparedAfter - prepared.length
  return (
    <div class="stack">
      <p>
        {sp.cantripsAfter > 0 && (
          <>
            Puedes conocer {sp.cantripsAfter} {plural(sp.cantripsAfter, 'truco', 'trucos')}
            {newC > 0 && <> ({newC} más que antes)</>}
            {leftC > 0 && <>: te {plural(leftC, 'falta', 'faltan')} {leftC} por elegir</>}.{' '}
          </>
        )}
        Puedes tener {sp.preparedAfter} {plural(sp.preparedAfter, 'conjuro preparado', 'conjuros preparados')}
        {newP > 0 && <> ({newP} más que antes)</>}
        {leftP > 0 && <>: te {plural(leftP, 'falta', 'faltan')} {leftP} por elegir</>}. Al subir de nivel también puedes cambiar uno de los que ya tenías por otro de tu lista.
      </p>
      <div class="pt-seg" role="group" aria-label="Qué conjuros elegir">
        {sp.cantripsAfter > 0 && (
          <button aria-pressed={tab === 'trucos'} onClick={() => setTab('trucos')}>
            Trucos <span class="num pt-of">{input.cantrips.length}/{sp.cantripsAfter}</span>
          </button>
        )}
        <button aria-pressed={tab === 'preparados'} onClick={() => setTab('preparados')}>
          Preparados <span class="num pt-of">{prepared.length}/{sp.preparedAfter}</span>
        </button>
      </div>
      {tab === 'trucos' ? (
        <SpellPicker pool={pool.cantrips} selected={input.cantrips} max={sp.cantripsAfter} onToggle={(id) => toggle('cantrips', id)} />
      ) : (
        <SpellPicker pool={pool.leveled} selected={prepared} max={sp.preparedAfter} locked={alwaysPrepared} onToggle={(id) => toggle('prepared', id)} />
      )}
    </div>
  )
}
