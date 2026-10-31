import { useRef, useState } from 'preact/hooks'
import { ABILITIES, type Ability } from '../../data/types'
import type { GuideSection, Overrides, Persona } from '../../model/character'
import { ABILITY_NAMES } from '../../rules/constants'
import { undoLevelUp } from '../../rules/levelup'
import { go } from '../../router'
import { deleteCharacter, getCharacter } from '../../store'
import { Disclosure, Modal, RichText, exportAndTell, toast, useRules } from '../common'
import { PHOTO_ERROR, resizePhoto } from '../photo'
import type { TabProps } from '../Sheet'

type PersonaField = { k: keyof Persona; label: string; long?: boolean; hint?: string }

const PERSONA: PersonaField[] = [
  { k: 'appearance', label: 'Apariencia', long: true },
  { k: 'personality', label: 'Personalidad', long: true, hint: 'Cómo se comporta y cómo habla.' },
  { k: 'ideals', label: 'Ideales', hint: 'Lo que más le importa.' },
  { k: 'bonds', label: 'Vínculos', hint: 'Personas, lugares o cosas a las que está unido.' },
  { k: 'flaws', label: 'Defectos', hint: 'Una debilidad o un vicio.' },
  { k: 'backstory', label: 'Historia', long: true, hint: 'De dónde viene y qué le trajo hasta aquí.' },
  { k: 'age', label: 'Edad' },
  { k: 'height', label: 'Altura' },
  { k: 'alignment', label: 'Alineamiento' },
  { k: 'pronouns', label: 'Pronombres' },
]

/** Datos cortos: van juntos en una rejilla, arriba. */
const FACT_KEYS: (keyof Persona)[] = ['pronouns', 'age', 'height', 'alignment']
const FACTS = FACT_KEYS.map((k) => PERSONA.find((p) => p.k === k)!)
const TEXTS = PERSONA.filter((p) => !FACT_KEYS.includes(p.k))

/** ¿Ha cambiado algún texto? (vacío y sin rellenar cuentan igual) */
const sameText = (a: Record<string, string | undefined>, b: Record<string, string | undefined>) => [...new Set([...Object.keys(a), ...Object.keys(b)])].every((k) => (a[k] ?? '') === (b[k] ?? ''))

export function Personaje({ c, d, update }: TabProps) {
  const rules = useRules()
  const [editPersona, setEditPersona] = useState(false)
  const [persona, setPersona] = useState<Persona>(c.persona)
  const [tagline, setTagline] = useState(c.tagline ?? '')
  const [guide, setGuide] = useState<GuideSection | null>(null)
  const [advanced, setAdvanced] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const last = c.history[c.history.length - 1]

  const facts = FACTS.filter((p) => c.persona[p.k])
  const texts = TEXTS.filter((p) => c.persona[p.k])
  const personaDirty = !sameText({ ...persona, tagline }, { ...c.persona, tagline: c.tagline })
  // El apartado de la guía tal y como está guardado (o nada si es nuevo)
  const guideSaved = guide ? c.guide.find((g) => g.id === guide.id) : undefined
  const guideDirty = !!guide && !sameText({ title: guide.title, body: guide.body }, { title: guideSaved?.title, body: guideSaved?.body })

  const onPhoto = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    const f = input.files?.[0]
    // Vaciarlo deja volver a elegir la misma foto
    input.value = ''
    if (!f) return
    let portrait: string
    try {
      portrait = await resizePhoto(f)
    } catch {
      toast(PHOTO_ERROR)
      return
    }
    const cur = getCharacter(c.id) ?? c
    update({ ...cur, look: { ...cur.look, portrait, portraitPosition: undefined } })
    toast('Retrato cambiado')
  }

  const personaInput = (p: PersonaField) => (
    <label class="field" key={p.k}>
      <span class="label">{p.label}</span>
      {p.hint && <span class="fx-hint">{p.hint}</span>}
      {p.long ? (
        <textarea class="input" value={persona[p.k] ?? ''} onInput={(e) => setPersona({ ...persona, [p.k]: (e.currentTarget as HTMLTextAreaElement).value })} />
      ) : (
        <input class="input" value={persona[p.k] ?? ''} onInput={(e) => setPersona({ ...persona, [p.k]: (e.currentTarget as HTMLInputElement).value })} />
      )}
    </label>
  )

  return (
    <div class="fx-tab">
      <h2>Quién es</h2>
      {/* El retrato y el nombre ya están en la cabecera: aquí solo los datos, todos con la misma etiqueta */}
      <div class="list fx-persona">
        {(c.player || facts.length > 0) && (
          <div class="fx-facts">
            {c.player && (
              <div>
                <span class="label">Lo lleva</span>
                {c.player}
              </div>
            )}
            {facts.map((p) => (
              <div key={p.k}>
                <span class="label">{p.label}</span>
                {c.persona[p.k]}
              </div>
            ))}
          </div>
        )}
        {texts.map((p) => (
          <div class="fx-prow" key={p.k}>
            <span class="label">{p.label}</span>
            <RichText text={c.persona[p.k]} />
          </div>
        ))}
        {facts.length + texts.length === 0 && (
          <div class="fx-prow">
            <p class="fx-empty-text">Aún no has contado cómo es. Escribe su aspecto, su carácter y su historia: ayuda mucho a interpretarle en la mesa.</p>
          </div>
        )}
      </div>
      <div class="fx-actions">
        <button
          class="btn block"
          onClick={() => {
            setPersona(c.persona)
            setTagline(c.tagline ?? '')
            setEditPersona(true)
          }}
        >
          Editar apariencia, personalidad e historia
        </button>
        <button class="btn block" onClick={() => fileRef.current?.click()}>
          {c.look?.portrait ? 'Cambiar retrato' : 'Poner retrato'}
        </button>
        {c.look?.portrait && (
          <button
            class="btn block ghost"
            onClick={() => {
              const before = c.look
              update({ ...c, look: { ...c.look, portrait: undefined, portraitPosition: undefined } })
              toast('Retrato quitado', {
                label: 'Deshacer',
                run: () => {
                  const cur = getCharacter(c.id)
                  if (cur) update({ ...cur, look: before })
                },
              })
            }}
          >
            Quitar retrato
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" class="hidden" onChange={onPhoto} />

      <h2>Guía de {c.name}</h2>
      {c.guide.length > 0 ? (
        <div class="fx-guide">
          {c.guide.map((g) => (
            <Disclosure key={g.id} title={g.title}>
              <RichText text={g.body} />
              <button class="btn sm fx-after" onClick={() => setGuide(g)}>
                Editar
              </button>
            </Disclosure>
          ))}
        </div>
      ) : (
        <p class="lede">Apuntes para jugar: qué hacer en combate, cuándo usar cada cosa, lo que queda por decidir…</p>
      )}
      <button class="btn block fx-after" onClick={() => setGuide({ id: Math.random().toString(36).slice(2, 9), title: '', body: '' })}>
        Añadir apartado a la guía
      </button>

      <h2>Ficha</h2>
      <div class="list">
        <button
          class="li fx-row fx-press"
          onClick={() => exportAndTell([c], rules.book)}
        >
          <strong>Exportar copia de {c.name}</strong>
          <span class="fx-sub">Un archivo con la ficha, para guardarlo o pasarlo a otro móvil.</span>
        </button>
        {last && (
          <button
            class="li fx-row fx-press"
            onClick={() => {
              const prev = undoLevelUp(c, rules)
              if (prev) {
                update(prev)
                toast(`Vuelves a nivel ${prev.level}`)
              }
            }}
          >
            <strong>Deshacer subida a nivel {last.toLevel}</strong>
            <span class="fx-sub">Vuelve a nivel {last.fromLevel} como estaba. Notas, equipo y dinero se quedan.</span>
          </button>
        )}
        <button class="li fx-row fx-press" onClick={() => setAdvanced(true)}>
          <strong>Ajustes avanzados</strong>
          <span class="fx-sub">Puntuaciones base y ajustes de la DM.</span>
        </button>
      </div>
      <button class="btn block danger fx-delete" onClick={() => setConfirmDelete(true)}>
        Borrar del móvil
      </button>

      <Modal open={editPersona} onClose={() => setEditPersona(false)} title="Apariencia e historia" dirty={personaDirty}>
        <div class="fx-form">
          <label class="field">
            <span class="label">Frase</span>
            <span class="fx-hint">Algo que diría. Sale bajo su nombre.</span>
            <input class="input" value={tagline} onInput={(e) => setTagline((e.currentTarget as HTMLInputElement).value)} />
          </label>
          <div class="fx-pair">{FACTS.map(personaInput)}</div>
          {TEXTS.map(personaInput)}
        </div>
        <div class="footerbar fx-sheetbar">
          <button
            class="btn primary block"
            onClick={() => {
              update({ ...c, persona, tagline: tagline.trim() || undefined })
              setEditPersona(false)
              toast('Guardado')
            }}
          >
            Guardar
          </button>
        </div>
      </Modal>

      <Modal open={!!guide} onClose={() => setGuide(null)} title="Apartado de la guía" dirty={guideDirty}>
        {guide && (
          <>
            <div class="fx-form">
              <label class="field">
                <span class="label">Título</span>
                <input class="input" value={guide.title} onInput={(e) => setGuide({ ...guide, title: (e.currentTarget as HTMLInputElement).value })} />
              </label>
              <label class="field">
                <span class="label">Texto</span>
                <span class="fx-hint">Deja una línea en blanco entre párrafos. Empieza una línea con «• » para hacer una lista y usa **así** para negrita.</span>
                <textarea class="input fx-tall" value={guide.body} onInput={(e) => setGuide({ ...guide, body: (e.currentTarget as HTMLTextAreaElement).value })} />
              </label>
            </div>
            <div class="footerbar fx-sheetbar fx-foot-actions">
              <button
                class="btn danger"
                onClick={() => {
                  if (guideSaved) {
                    const gone = guideSaved
                    const at = c.guide.indexOf(gone)
                    update({ ...c, guide: c.guide.filter((g) => g.id !== gone.id) })
                    toast('Apartado borrado', {
                      label: 'Deshacer',
                      run: () => {
                        const cur = getCharacter(c.id)
                        if (cur && !cur.guide.some((g) => g.id === gone.id)) update({ ...cur, guide: [...cur.guide.slice(0, at), gone, ...cur.guide.slice(at)] })
                      },
                    })
                  }
                  setGuide(null)
                }}
              >
                {guideSaved ? 'Borrar' : 'Descartar'}
              </button>
              <button
                class="btn primary block"
                disabled={!guide.title.trim()}
                onClick={() => {
                  const exists = c.guide.some((g) => g.id === guide.id)
                  update({ ...c, guide: exists ? c.guide.map((g) => (g.id === guide.id ? guide : g)) : [...c.guide, guide] })
                  setGuide(null)
                }}
              >
                Guardar
              </button>
            </div>
          </>
        )}
      </Modal>

      {advanced && <Advanced {...{ c, d, update }} onClose={() => setAdvanced(false)} />}

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`¿Borrar a ${c.name}?`}>
        <p class="fx-confirm">Se borra de este móvil, con sus notas y su estado. Si no tienes una copia exportada, no se puede recuperar.</p>
        <div class="footerbar fx-sheetbar">
          <button class="btn grow" onClick={() => setConfirmDelete(false)}>
            Cancelar
          </button>
          <button
            class="btn danger fx-confirm-del grow"
            onClick={() => {
              setConfirmDelete(false)
              deleteCharacter(c.id)
              go({ name: 'home' })
            }}
          >
            Sí, borrar
          </button>
        </div>
      </Modal>
    </div>
  )
}

type OvKey = 'ac' | 'maxHp' | 'speed' | 'initiative'

/** 10.5 → «10,5», como se escribe aquí. */
const show = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','))
/** Número escrito a mano: vacío → undefined; algo que no es un número → NaN. Con `decimals`, admite coma o punto. */
function readNum(v: string, decimals = false): number | undefined {
  const t = v.replace(/\s/g, '').replace(',', '.').replace('−', '-')
  if (!t) return undefined
  return (decimals ? /^\d+(\.\d+)?$/ : /^[+-]?\d+$/).test(t) ? Number(t) : NaN
}

function Advanced({ c, d, update, onClose }: TabProps & { onClose: () => void }) {
  // Lo escrito se guarda tal cual mientras se teclea («10,» o «-» no se convierten en nada raro)
  const [base, setBase] = useState<Record<Ability, string>>(() => Object.fromEntries(ABILITIES.map((a) => [a, String(c.baseScores[a])])) as Record<Ability, string>)
  const [raw, setRaw] = useState<Record<OvKey, string>>({ ac: show(c.overrides.ac), maxHp: show(c.overrides.maxHp), speed: show(c.overrides.speed), initiative: show(c.overrides.initiative) })
  const [note, setNote] = useState(c.overrides.note ?? '')
  const scores = Object.fromEntries(ABILITIES.map((a) => [a, readNum(base[a])])) as Record<Ability, number | undefined>
  const badScores = ABILITIES.filter((a) => {
    const v = scores[a]
    return v === undefined || Number.isNaN(v) || v < 1 || v > 30
  })
  const ov: Record<OvKey, number | undefined> = { ac: readNum(raw.ac), maxHp: readNum(raw.maxHp), speed: readNum(raw.speed, true), initiative: readNum(raw.initiative) }
  const keys = Object.keys(ov) as OvKey[]
  const badOv = keys.filter((k) => Number.isNaN(ov[k]) || (k !== 'initiative' && (ov[k] ?? 0) < 0))
  const dirty = ABILITIES.some((a) => base[a] !== String(c.baseScores[a])) || keys.some((k) => raw[k] !== show(c.overrides[k])) || note !== (c.overrides.note ?? '')
  const field = (k: OvKey, label: string, decimals = false) => (
    <label class="field">
      <span class="label">{label}</span>
      <input class="input num" inputMode={decimals ? 'decimal' : 'numeric'} value={raw[k]} aria-invalid={badOv.includes(k)} onInput={(e) => setRaw({ ...raw, [k]: (e.currentTarget as HTMLInputElement).value })} />
      {badOv.includes(k) && <span class="fx-hint">{decimals ? 'Escribe un número, como 9 o 10,5.' : 'Escribe un número entero, como 14.'}</span>}
    </label>
  )
  return (
    <Modal open onClose={onClose} title="Ajustes avanzados" dirty={dirty}>
      <div class="fx-form">
        <p class="lede">Solo si la DM os lo pide o hay que corregir algo. El resto de números se calculan solos.</p>

        <h3>Puntuaciones base</h3>
        <p class="small muted">Las de antes de sumar el trasfondo y las dotes. Debajo ves cómo quedan.</p>
        <div class="fx-scores">
          {ABILITIES.map((a) => (
            <label class="field fx-score" key={a}>
              <span class="label">{ABILITY_NAMES[a]}</span>
              <input class="input num" inputMode="numeric" value={base[a]} aria-invalid={badScores.includes(a)} onInput={(e) => setBase({ ...base, [a]: (e.currentTarget as HTMLInputElement).value })} />
              <span class="fx-score-final num">{badScores.includes(a) ? 'Entre 1 y 30' : `Final: ${scores[a]! + (c.backgroundBonus[a] ?? 0) + c.feats.reduce((n, f) => n + (f.abilityIncrease?.[a] ?? 0), 0)}`}</span>
            </label>
          ))}
        </div>

        <h3>Ajustes de la DM</h3>
        <p class="small muted">Si rellenas uno, sustituye al cálculo. Déjalo vacío para usar las reglas.</p>
        <div class="fx-pair">
          {field('ac', `Armadura (calculada ${d.ac.overridden ? '—' : d.ac.value})`)}
          {field('maxHp', 'PG máximos')}
          {field('speed', 'Velocidad (m)', true)}
          {field('initiative', 'Iniciativa')}
        </div>
        <label class="field">
          <span class="label">Motivo</span>
          <input class="input" placeholder="Bendición del templo, regla de la casa…" value={note} onInput={(e) => setNote((e.currentTarget as HTMLInputElement).value)} />
        </label>
      </div>
      <div class="footerbar fx-sheetbar">
        <button
          class="btn primary block"
          disabled={badScores.length > 0 || badOv.length > 0}
          onClick={() => {
            const clean: Overrides = {}
            for (const k of keys) if (ov[k] !== undefined) clean[k] = ov[k]
            if (note.trim()) clean.note = note.trim()
            update({ ...c, baseScores: { ...c.baseScores, ...(scores as Record<Ability, number>) }, overrides: clean })
            onClose()
            toast('Guardado')
          }}
        >
          Guardar
        </button>
      </div>
    </Modal>
  )
}
