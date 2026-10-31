// Pasos finales: equipo, idiomas, quién es y repaso.

import { useMemo, useRef } from 'preact/hooks'
import type { Coins } from '../../model/character'
import { ABILITY_SHORT, metres, signed, squares } from '../../rules/constants'
import {
  COLORS,
  NAME_IDEAS,
  RARE_LANGUAGES,
  STANDARD_LANGUAGES,
  draftGear,
  fixedLanguages,
  gearText,
  languageCount,
  stepIssues,
  type StepId,
} from '../../rules/create'
import { ABILITIES } from '../../data/types'
import { Option, Portrait, toast } from '../common'
import { PHOTO_ERROR, resizePhoto } from '../photo'
import { andList, Chips, Section, skillName, type StepProps } from './shared'

const COIN_NAMES: Record<keyof Coins, string> = { ppt: 'ppt', po: 'po', pe: 'pe', pp: 'pp', pc: 'pc' }
export function coinsText(c: Coins): string {
  const parts = (['ppt', 'po', 'pe', 'pp', 'pc'] as (keyof Coins)[]).filter((k) => c[k]).map((k) => `${c[k]} ${COIN_NAMES[k]}`)
  return parts.length ? andList(parts) : 'nada'
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/* ---------- Equipo ---------- */

export function StepGear({ d, set, rules, c }: StepProps) {
  const cls = rules.cls(d.classId ?? '')
  const bg = rules.background(d.backgroundId ?? '')
  const gear = useMemo(() => draftGear(d, rules), [d, rules])
  const goldOnly = (t: string) => /^\d+\s*po$/i.test(t.trim())
  return (
    <>
      {cls && (
        <Section title="De tu clase" hint="Elige un lote. La opción de solo oro es para comprarlo todo tú (pregúntale antes a la DM).">
          <div class="cr-opts">
            {cls.startingEquipment.map((e) => (
              <Option key={e.option} radio on={d.equipClass === e.option} onClick={() => set((x) => ({ ...x, equipClass: e.option }))}>
                <span class="cr-opt-head">
                  <strong>Opción {e.option}</strong>
                  {e.option === cls.startingEquipment[0]?.option && <span class="tag">Recomendada</span>}
                </span>
                <span class="cr-sub">{goldOnly(e.text) ? `Solo oro: ${e.text}.` : `${capital(gearText(e.text, d))}.`}</span>
              </Option>
            ))}
          </div>
        </Section>
      )}
      {bg && (
        <Section title="De tu trasfondo">
          <div class="cr-opts">
            {bg.equipment.map((e) => (
              <Option key={e.option} radio on={d.equipBg === e.option} onClick={() => set((x) => ({ ...x, equipBg: e.option }))}>
                <span class="cr-opt-head">
                  <strong>Opción {e.option}</strong>
                </span>
                <span class="cr-sub">{goldOnly(e.text) ? `Solo oro: ${e.text}.` : `${capital(gearText(e.text, d))}.`}</span>
              </Option>
            ))}
          </div>
        </Section>
      )}
      {gear.pending.length > 0 && (
        <Section title="A tu elección" hint="Escribe qué escoges. Si no lo sabes, déjalo así y decídelo con la DM: en la ficha podrás cambiarle el nombre.">
          <div class="stack">
            {gear.pending.map((p) => (
              <label class="field" key={p.text}>
                <span class="label">
                  {capital(gearText(p.text, d))} <span class="cr-from">· de tu {p.from}</span>
                </span>
                <input
                  class="input"
                  value={d.pendingNotes[p.text] ?? ''}
                  placeholder={p.name}
                  onInput={(e) => {
                    const v = (e.currentTarget as HTMLInputElement).value
                    set((x) => ({ ...x, pendingNotes: { ...x.pendingNotes, [p.text]: v } }))
                  }}
                />
              </label>
            ))}
          </div>
        </Section>
      )}
      <Section title="Lo que llevarás" hint="La armadura y el escudo ya van puestos si tu clase sabe usarlos.">
        <div class="list">
          {c.equipment.map((it) => (
            <div class="li cr-item" key={it.id}>
              <span class="grow">{it.name}</span>
              {it.equipped && <span class="tag accent">Puesto</span>}
              {it.qty > 1 && <span class="cr-qty num">×{it.qty}</span>}
            </div>
          ))}
          <div class="li cr-item">
            <span class="grow">Monedas</span>
            <span class="cr-qty num">{coinsText(c.coins)}</span>
          </div>
        </div>
      </Section>
    </>
  )
}

/* ---------- Idiomas ---------- */

export function StepLanguages({ d, set, rules }: StepProps) {
  const n = languageCount(d, rules)
  const fixed = fixedLanguages(d, rules)
  const sel = d.languages ?? []
  const extra = n - 2
  const onChange = (ids: string[]) => set((x) => ({ ...x, languages: ids }))
  const rare = RARE_LANGUAGES.filter((l) => !fixed.includes(l))
  return (
    <>
      <Section title="Ya sabes">
        <p class="cr-val-big">{andList(fixed)}.</p>
        {fixed.length > 1 && <p class="cr-note">{andList(fixed.slice(1))} te {fixed.length > 2 ? 'los' : 'lo'} da tu clase.</p>}
      </Section>
      <Section title={`Elige ${n}`} count={`${sel.length}/${n}`} hint={extra > 0 ? `Dos por crear el personaje y ${extra} más por tu clase.` : 'Lo normal es el de tu especie y alguno que hable gente con la que vayáis a tratar.'}>
        <Chips label="Idiomas estándar" max={n} selected={sel} options={STANDARD_LANGUAGES.map((l) => ({ id: l, name: l }))} onChange={onChange} />
        <details class="cr-more-tools" open={sel.some((l) => rare.includes(l))}>
          <summary>Idiomas inusuales (solo si la DM lo permite)</summary>
          <Chips label="Idiomas inusuales" max={n} selected={sel} options={rare.map((l) => ({ id: l, name: l }))} fullNote={false} onChange={onChange} />
        </details>
      </Section>
    </>
  )
}

/* ---------- Quién es ---------- */

export function StepWho({ d, set, c }: StepProps) {
  const file = useRef<HTMLInputElement>(null)
  const ideas = NAME_IDEAS[d.speciesId ?? ''] ?? NAME_IDEAS.humano
  const field = (k: 'name' | 'player' | 'tagline' | 'appearance' | 'personality') => ({
    value: d[k],
    onInput: (e: Event) => {
      const v = (e.currentTarget as HTMLInputElement).value
      set((x) => ({ ...x, [k]: v }))
    },
  })
  return (
    <>
      <div class="stack cr-form">
        <label class="field">
          <span class="label">Nombre</span>
          <input class="input cr-name" autoComplete="off" placeholder="Cómo se llama tu personaje" {...field('name')} />
        </label>
        <div class="cr-ideas">
          <span class="cr-note">¿Sin ideas? Toca uno:</span>
          <div class="chips">
            {ideas.map((n) => (
              <button type="button" key={n} class={`chip ${d.name === n ? 'on' : ''}`} onClick={() => set((x) => ({ ...x, name: n }))}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <label class="field">
          <span class="label">Quién lo juega (opcional)</span>
          <input class="input" autoComplete="off" placeholder="Tu nombre" {...field('player')} />
        </label>
        <label class="field">
          <span class="label">Una frase que lo defina (opcional)</span>
          <input class="input" placeholder="«Nadie se queda atrás.»" {...field('tagline')} />
        </label>
        <label class="field">
          <span class="label">Apariencia (opcional)</span>
          <textarea class="input cr-area" placeholder="Alto, con una cicatriz en la ceja y la capa remendada…" {...field('appearance')} />
        </label>
        <label class="field">
          <span class="label">Personalidad (opcional)</span>
          <textarea class="input cr-area" placeholder="Cauto con desconocidos, leal con los amigos…" {...field('personality')} />
        </label>
      </div>

      <Section title="Tu color" hint="Se usa en tus rombos, en lo que marcas y en el brillo del retrato.">
        <div class="cr-swatches" role="radiogroup" aria-label="Color del personaje">
          {COLORS.map((col) => (
            <button
              type="button"
              key={col.id}
              role="radio"
              aria-checked={d.color === col.id}
              class={`cr-swatch ${d.color === col.id ? 'on' : ''}`}
              style={`--sw: ${col.dark[0]}; --sw-soft: ${col.dark[1]}`}
              onClick={() => set((x) => ({ ...x, color: col.id }))}
            >
              <span class="cr-swatch-dot" aria-hidden="true" />
              <span class="cr-swatch-name">{col.name}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Retrato" hint="Opcional. Una foto o un dibujo; se recorta en círculo.">
        <div class="cr-portrait">
          <Portrait c={c} size={88} />
          <div class="cr-portrait-btns">
            <button type="button" class="btn brass" onClick={() => file.current?.click()}>
              {d.portrait ? 'Cambiar foto' : 'Subir una foto'}
            </button>
            {d.portrait && (
              <button type="button" class="btn ghost" onClick={() => set((x) => ({ ...x, portrait: undefined }))}>
                Quitar
              </button>
            )}
          </div>
          <input
            ref={file}
            type="file"
            accept="image/*"
            class="hidden"
            onChange={async (e) => {
              const input = e.currentTarget as HTMLInputElement
              const f = input.files?.[0]
              // Se vacía ya: así volver a elegir la misma foto también avisa
              input.value = ''
              if (!f) return
              try {
                const portrait = await resizePhoto(f)
                set((x) => ({ ...x, portrait }))
              } catch {
                toast(PHOTO_ERROR)
              }
            }}
          />
        </div>
      </Section>
    </>
  )
}

/* ---------- Repaso ---------- */

export function StepReview({ d, rules, c, x, goTo }: StepProps) {
  const cls = x.cls
  const sp = x.species
  const bg = x.background
  const issues = stepIssues(d, rules, 'repaso')
  const pending = x.warnings.filter((w) => w.kind !== 'aviso')
  const spell = (id: string) => rules.spell(id)?.name ?? id
  const lineage = (sp?.choices ?? []).filter((ch) => ch.kind === 'opcion' && !/tamano$/.test(ch.id)).map((ch) => ch.options?.find((o) => o.id === c.speciesChoices[ch.id])?.name).filter(Boolean) as string[]
  const speciesText = () => {
    if (!sp) return '—'
    const l = lineage[0]
    if (!l) return sp.name
    if (l.toLowerCase().includes(sp.name.toLowerCase())) return l
    return `${sp.name}, ${l.charAt(0).toLowerCase()}${l.slice(1)}`
  }
  const featNames = x.feats.map((f) => f.data?.name ?? f.entry.id)
  for (const id of x.featIds) if (!c.feats.some((f) => f.id === id)) featNames.push(rules.feat(id)?.name ?? id)
  const otherSpells = c.spells.extra.map((s) => spell(s.id))

  const rows: { step: StepId; label: string; value: string }[] = [
    { step: 'clase', label: 'Clase', value: cls?.name ?? '—' },
    { step: 'trasfondo', label: 'Trasfondo', value: bg?.name ?? '—' },
    { step: 'especie', label: 'Especie', value: speciesText() },
    // Espacio duro: cada característica va con su número, sin partirse entre líneas.
    { step: 'caracteristicas', label: 'Características', value: ABILITIES.map((a) => `${ABILITY_SHORT[a]} ${x.scores[a]}`).join(', ') },
    { step: 'habilidades', label: 'Habilidades', value: andList(c.skills.map(skillName)) + (c.expertise.length ? `. Pericia en ${andList(c.expertise.map(skillName))}` : '') },
    { step: 'trasfondo', label: 'Dotes', value: andList(featNames) || 'Ninguna' },
  ]
  if (c.weaponMasteries.length) rows.push({ step: 'habilidades', label: 'Maestría con armas', value: andList(c.weaponMasteries.map((id) => rules.weapon(id)?.name ?? id)) })
  if (c.spells.cantrips.length || c.spells.prepared.length || otherSpells.length)
    rows.push({
      step: 'conjuros',
      label: 'Conjuros',
      value: [
        c.spells.cantrips.length ? `Trucos: ${andList(c.spells.cantrips.map(spell))}` : '',
        c.spells.prepared.length ? `Preparados: ${andList(c.spells.prepared.map(spell))}` : '',
        otherSpells.length ? `Otros: ${andList(otherSpells)}` : '',
      ]
        .filter(Boolean)
        .join('. '),
    })
  rows.push({ step: 'equipo', label: 'Equipo', value: `${c.equipment.length} ${c.equipment.length === 1 ? 'cosa' : 'cosas'} y ${coinsText(c.coins)}` })
  rows.push({ step: 'idiomas', label: 'Idiomas', value: andList(c.languages) })

  return (
    <>
      <div class="cr-hero">
        <Portrait c={c} size={76} />
        <div class="grow">
          <p class="display cr-hero-name">{c.name}</p>
          <p class="cr-hero-meta">
            {cls?.name} de nivel 1{sp ? `, ${sp.name.toLowerCase()}` : ''}
          </p>
          {c.tagline && <p class="cr-hero-tag tagline">{c.tagline}</p>}
        </div>
      </div>

      {/* Las mismas cifras y etiquetas que verá en Estado */}
      <div class="band cr-band">
        <div>
          <div class="label">PG máximos</div>
          <div class="v">{x.maxHp}</div>
          <div class="s">Tu vida</div>
        </div>
        <div>
          <div class="label">Armadura</div>
          <div class="v">{x.ac.value}</div>
          <div class="s">Te dan con {x.ac.value}+</div>
        </div>
        <div>
          <div class="label">Iniciativa</div>
          <div class="v">{signed(x.initiative)}</div>
          <div class="s">Tiras d20 {signed(x.initiative)}</div>
        </div>
        <div>
          <div class="label">Velocidad</div>
          <div class="v">{metres(x.speed)}</div>
          <div class="s">{squares(x.speed)} casillas</div>
        </div>
      </div>
      <div class="band cr-band">
        <div>
          <div class="label">Percepción pasiva</div>
          <div class="v">{x.passivePerception}</div>
          <div class="s">Lo que notas sin buscar</div>
        </div>
        {x.spell ? (
          <>
            <div>
              <div class="label">CD de conjuros</div>
              <div class="v">{x.spell.dc}</div>
              <div class="s">Para resistirlos</div>
            </div>
            <div>
              <div class="label">Ataque mágico</div>
              <div class="v">{signed(x.spell.attack)}</div>
              <div class="s">Tiras d20 {signed(x.spell.attack)}</div>
            </div>
          </>
        ) : (
          <div>
            <div class="label">Competencia</div>
            <div class="v">{signed(x.pb)}</div>
            <div class="s">Bonificador</div>
          </div>
        )}
      </div>
      <p class="cr-note cr-band-note">
        Armadura {x.ac.value}: {x.ac.parts.join(' + ')}.
      </p>

      <Section title="Lo que has elegido" hint="Toca una fila para volver a ese paso.">
        <div class="list">
          {rows.map((r) => (
            <button type="button" key={r.label} class="li cr-row" onClick={() => goTo(r.step)}>
              <span class="grow">
                <span class="label">{r.label}</span>
                <span class="cr-val">{r.value}</span>
              </span>
              <span class="cr-edit">Cambiar</span>
            </button>
          ))}
        </div>
      </Section>

      {(issues.length > 0 || pending.length > 0) && (
        // En rojo solo si algo impide crearlo; lo demás se completa luego en la ficha.
        <div class={`notice ${issues.length > 0 ? 'error' : ''} cr-gap`}>
          <strong>Queda pendiente</strong>
          <ul>
            {[...issues, ...pending.map((w) => w.text)].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      {issues.length === 0 && pending.length === 0 && <p class="notice cr-gap">Todo listo. Al crearlo se abre su ficha; desde allí puedes cambiar cualquier cosa más adelante.</p>}
    </>
  )
}
