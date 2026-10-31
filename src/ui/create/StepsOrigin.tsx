// Pasos 1 a 3: clase, trasfondo y especie.

import type { Ability, ClassData } from '../../data/types'
import { ABILITY_NAMES, metres } from '../../rules/constants'
import {
  CLASS_FOR_WHOM,
  FEAT_INITIATE,
  RECOMMENDED_CLASS,
  choiceName,
  draftSkills,
  fillUpTo,
  lineageChoice,
  originFeats,
  recommendedBackground,
  recommendedCastingAbility,
  recommendedSpecies,
  setBackground,
  setClass,
  setSpecies,
  speciesSkillOptions,
  toolRule,
} from '../../rules/create'
import { Option, RichText } from '../common'
import { andList, CASTING, Chips, FeatChoices, Section, skillName, skillOptions, type StepProps } from './shared'

const ARMOR_NAMES = { ligera: 'ligeras', media: 'medias', pesada: 'pesadas' } as const

function primaryText(cls: ClassData) {
  const names = cls.primaryAbilities.map((a) => ABILITY_NAMES[a])
  if (cls.id === 'guerrero') return names.join(' o ')
  return andList(names)
}

function armorText(cls: ClassData) {
  const kinds = (['ligera', 'media', 'pesada'] as const).filter((k) => cls.armor[k]).map((k) => ARMOR_NAMES[k])
  if (!kinds.length && !cls.armor.escudo) return 'Ninguna: lucha sin armadura.'
  const a = kinds.length ? `Armaduras ${andList(kinds)}` : 'Sin armadura'
  return `${a}${cls.armor.escudo ? ' y escudo' : ''}.`
}

/* ---------- Clase ---------- */

export function StepClass({ d, set, rules }: StepProps) {
  return (
    <div class="cr-opts">
      {rules.book.classes.map((cls) => {
        const on = d.classId === cls.id
        const sc = cls.spellcasting
        return (
          <Option key={cls.id} radio on={on} onClick={() => set((x) => setClass(x, cls.id))}>
            <span class="cr-opt-head">
              <strong class="cr-opt-name">{cls.name}</strong>
              {cls.id === RECOMMENDED_CLASS && <span class="tag">Recomendada para empezar</span>}
            </span>
            <span class="cr-sub">{CLASS_FOR_WHOM[cls.id] ?? cls.summary}</span>
            {on && (
              <span class="cr-more">
                {cls.summary && <span class="cr-line">{cls.summary}</span>}
                <span class="cr-facts">
                  <span>
                    <b>Lo que más usa:</b> {primaryText(cls)}.
                  </span>
                  <span>
                    <b>Puntos de golpe al empezar:</b> {cls.hitDie} + tu Constitución (dado de golpe d{cls.hitDie}).
                  </span>
                  <span>
                    <b>Protección:</b> {armorText(cls)}
                  </span>
                  <span>
                    <b>Magia:</b> {sc ? `sí, con ${ABILITY_NAMES[sc.ability]}${(sc.cantrips[0] ?? 0) + (sc.prepared[0] ?? 0) === 0 ? ' (a partir de nivel 2)' : ''}.` : 'no lanza conjuros.'}
                  </span>
                </span>
              </span>
            )}
          </Option>
        )
      })}
    </div>
  )
}

/* ---------- Trasfondo ---------- */

export function StepBackground({ d, set, rules }: StepProps) {
  const rec = recommendedBackground(rules, d.classId)
  const bg = rules.background(d.backgroundId ?? '')
  const cls = rules.cls(d.classId ?? '')
  const feat = bg ? rules.feat(bg.feat.id) : undefined
  const tr = toolRule(bg?.tool)
  const taken = draftSkills({ ...d, bgFeat: undefined }, rules)
  return (
    <>
      <div class="cr-opts">
        {rules.book.backgrounds.map((b) => {
          const f = rules.feat(b.feat.id)
          return (
            <Option key={b.id} radio on={d.backgroundId === b.id} onClick={() => set((x) => fillUpTo(setBackground(x, b.id), rules, 'trasfondo'))}>
              <span class="cr-opt-head">
                <strong class="cr-opt-name">{b.name}</strong>
                {b.id === rec && <span class="tag">Encaja con tu clase</span>}
                {b.source === 'mesa' && <span class="tag">De tu mesa</span>}
              </span>
              <span class="cr-sub">
                {andList(b.skills.map(skillName))}. Dote: {f?.name ?? b.feat.id}
                {b.feat.note && f?.id === FEAT_INITIATE ? ` (${b.feat.note})` : ''}.
              </span>
            </Option>
          )
        })}
      </div>

      {bg && (
        <>
          <Section title="Lo que te da">
            <div class="list cr-facts-list">
              <div class="li">
                <span class="grow">
                  <span class="label">Habilidades</span>
                  <span class="cr-val">{andList(bg.skills.map(skillName))}</span>
                </span>
              </div>
              <div class="li">
                <span class="grow">
                  <span class="label">Herramienta</span>
                  <span class="cr-val">{tr?.fixed ?? (d.bgTool ? `${d.bgTool} (lo eliges abajo)` : (tr?.text ?? bg.tool))}</span>
                </span>
              </div>
              <div class="li">
                <span class="grow">
                  <span class="label">Características que puedes subir</span>
                  <span class="cr-val">{andList(bg.abilities.map((a) => ABILITY_NAMES[a]))}. Las repartes en el paso de características.</span>
                </span>
              </div>
              {feat && (
                <div class="li">
                  <span class="grow">
                    <span class="label">Dote de origen</span>
                    <span class="cr-val">
                      <strong>{feat.name}</strong>
                      {feat.summary ? `. ${feat.summary}` : ''}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </Section>

          {tr && !tr.fixed && (
            <Section title="Tu herramienta" hint={tr.text}>
              <Chips label="Herramienta del trasfondo" max={1} selected={d.bgTool ? [d.bgTool] : []} options={tr.options.map((t) => ({ id: t, name: t }))} onChange={(ids) => set((x) => ({ ...x, bgTool: ids[0] }))} />
            </Section>
          )}

          {d.bgFeat && feat && (feat.id === FEAT_INITIATE || feat.choice) && (
            <Section title={feat.name} hint={feat.summary}>
              <FeatChoices
                pick={d.bgFeat}
                fixedList={d.bgFeat.choices.lista?.[0]}
                taken={taken}
                recommendedAbility={recommendedCastingAbility(cls)}
                onChange={(p) => set((x) => ({ ...x, bgFeat: p }))}
              />
            </Section>
          )}
        </>
      )}
    </>
  )
}

/* ---------- Especie ---------- */

export function StepSpecies({ d, set, rules }: StepProps) {
  const rec = recommendedSpecies(rules, d.classId)
  const sp = rules.speciesOf(d.speciesId ?? '')
  const cls = rules.cls(d.classId ?? '')
  const lineage = lineageChoice(sp)
  // El linaje puede alargar la visión en la oscuridad (drow: 36 m).
  const darkvision = Math.max(sp?.darkvision ?? 0, ...(sp?.choices ?? []).map((ch) => ch.options?.find((o) => o.id === d.speciesChoices[ch.id])?.darkvision ?? 0))
  const setChoice = (id: string, v: string | undefined) =>
    set((x) => {
      const next = { ...x.speciesChoices }
      if (v) next[id] = v
      else delete next[id]
      return { ...x, speciesChoices: next }
    })
  return (
    <>
      <div class="cr-opts">
        {rules.book.species.map((s) => (
          <Option key={s.id} radio on={d.speciesId === s.id} onClick={() => set((x) => fillUpTo(setSpecies(x, s.id), rules, 'especie'))}>
            <span class="cr-opt-head">
              <strong class="cr-opt-name">{s.name}</strong>
              {s.id === rec && <span class="tag">Encaja con tu clase</span>}
            </span>
            {s.summary && <span class="cr-sub">{s.summary}</span>}
          </Option>
        ))}
      </div>

      {sp && (
        <>
          <Section title={`Rasgos de ${sp.name.toLowerCase()}`}>
            <p class="cr-hint">
              Tamaño {sp.sizes.map((z) => z.toLowerCase()).join(' o ')}. Velocidad {metres(sp.speed)}
              {darkvision ? `. Visión en la oscuridad ${metres(darkvision)}` : ''}.
            </p>
            <div class="list">
              {sp.traits
                .filter((t) => t.level <= 1)
                .map((t) => (
                  <div class="li cr-trait" key={t.id}>
                    <span class="grow">
                      <strong>{t.name}</strong>
                      <span class="cr-sub">{t.summary ?? t.text.split('\n')[0]}</span>
                    </span>
                  </div>
                ))}
            </div>
            {sp.traits.some((t) => t.level > 1) && <p class="cr-note">Más adelante: {andList(sp.traits.filter((t) => t.level > 1).map((t) => `${t.name} (nivel ${t.level})`))}.</p>}
          </Section>

          {(sp.choices ?? []).map((ch) => {
            if (ch.kind === 'dote-origen') return <HumanFeat key={ch.id} {...{ d, set, rules }} />
            const name = choiceName(sp, ch)
            const picked = d.speciesChoices[ch.id]
            if (ch.kind === 'habilidad') {
              const taken = draftSkills({ ...d, speciesChoices: { ...d.speciesChoices, [ch.id]: '' }, classSkills: [] }, rules)
              const opts = speciesSkillOptions(ch).filter((s) => !taken.includes(s) || s === picked)
              return (
                <Section key={ch.id} title={name} hint={ch.options?.length ? 'Ganas competencia en una de estas habilidades.' : 'Ganas competencia en una habilidad que elijas.'}>
                  <Chips label={name} max={1} selected={picked ? [picked] : []} options={skillOptions(opts)} onChange={(ids) => setChoice(ch.id, ids[0])} />
                </Section>
              )
            }
            const isSize = /tamano$/.test(ch.id)
            if (isSize || (ch.options ?? []).every((o) => !o.text))
              return (
                <Section key={ch.id} title={name} hint={isSize ? 'Solo cambia cómo te describes y por dónde cabes; no afecta a los números.' : undefined}>
                  <Chips label={name} max={1} selected={picked ? [picked] : []} options={(ch.options ?? []).map((o) => ({ id: o.id, name: o.name }))} onChange={(ids) => setChoice(ch.id, ids[0])} />
                </Section>
              )
            return (
              <Section key={ch.id} title={name}>
                <div class="cr-opts">
                  {(ch.options ?? []).map((o) => (
                    <Option key={o.id} radio on={picked === o.id} onClick={() => setChoice(ch.id, o.id)}>
                      <strong>{o.name}</strong>
                      {o.text && <RichText text={o.text} class="small cr-rich" />}
                    </Option>
                  ))}
                </div>
                {ch === lineage && (
                  <>
                    <p class="label cr-label-gap">Característica para lanzar los conjuros del linaje</p>
                    <Chips
                      label="Aptitud mágica del linaje"
                      max={1}
                      selected={d.speciesAbility ? [d.speciesAbility] : []}
                      options={CASTING.map((a) => ({ id: a, name: ABILITY_NAMES[a] }))}
                      onChange={(ids) => set((x) => ({ ...x, speciesAbility: ids[0] as Ability | undefined }))}
                    />
                    <p class="cr-note">Te recomiendo {ABILITY_NAMES[recommendedCastingAbility(cls)]}: {cls?.spellcasting ? 'la misma con la que lanza tu clase' : 'la más alta de las tres para tu clase'}.</p>
                  </>
                )}
              </Section>
            )
          })}
        </>
      )}
    </>
  )
}

/** Versátil (humano): una dote de origen más. */
function HumanFeat({ d, set, rules }: Pick<StepProps, 'd' | 'set' | 'rules'>) {
  const bg = rules.background(d.backgroundId ?? '')
  const cls = rules.cls(d.classId ?? '')
  const feats = originFeats(rules).filter((f) => f.id !== bg?.feat.id)
  const pick = d.speciesFeat
  const taken = draftSkills({ ...d, speciesFeat: undefined, classSkills: [] }, rules)
  const avoid = d.bgFeat?.id === FEAT_INITIATE ? d.bgFeat.choices.lista?.[0] : undefined
  return (
    <Section title="Versátil: una dote más" hint={`Los humanos empiezan con otra dote de origen. Se recomienda Habilidoso: tres habilidades más.${bg ? ` La de tu trasfondo (${rules.feat(bg.feat.id)?.name}) no se repite.` : ''}`}>
      <div class="cr-opts">
        {feats.map((f) => (
          <Option key={f.id} radio on={pick?.id === f.id} onClick={() => set((x) => fillUpTo({ ...x, speciesFeat: { id: f.id, choices: {} } }, rules, 'especie'))}>
            <span class="cr-opt-head">
              <strong>{f.name}</strong>
              {f.id === 'habilidoso' && <span class="tag">Recomendada</span>}
              {f.source === 'mesa' && <span class="tag">De tu mesa</span>}
            </span>
            {f.summary && <span class="cr-sub">{f.summary}</span>}
          </Option>
        ))}
      </div>
      {pick && (pick.id === FEAT_INITIATE || pick.id === 'habilidoso') && (
        <div class="cr-sub-block">
          <FeatChoices
            pick={pick}
            avoidList={avoid}
            taken={taken}
            recommendedAbility={recommendedCastingAbility(cls)}
            onChange={(p) => set((x) => ({ ...x, speciesFeat: p }))}
          />
        </div>
      )}
    </Section>
  )
}
