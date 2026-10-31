import { useState } from 'preact/hooks'
import type { ChoiceDef, Feature } from '../../data/types'
import { classFeatures, subclassFeatures, type FeatureView, type Origin } from '../../rules/derive'
import { href } from '../../router'
import { ChoiceEditor, applyChoice, choiceReady, type ChoiceValue } from '../ChoiceEditor'
import { Disclosure, Modal, RichText, labelFor, toast, useRules } from '../common'
import type { TabProps } from '../Sheet'
import '../css/fichero.css'

const GROUPS: { origin: Origin; title: string; lede?: string }[] = [
  { origin: 'clase', title: 'De tu clase' },
  { origin: 'subclase', title: 'De tu subclase' },
  { origin: 'especie', title: 'De tu especie' },
  { origin: 'dote', title: 'Dotes' },
  { origin: 'mesa', title: 'De tu mesa', lede: 'Reglas de la casa y contenido de otros libros.' },
]

/** Nombre de cada pestaña para los enlaces de «Por revisar». */
const TAB_NAME: Record<string, string> = {
  estado: 'Estado',
  turno: 'Turno',
  conjuros: 'Conjuros',
  habilidades: 'Habilidades',
  rasgos: 'Rasgos',
  equipo: 'Equipo',
  personaje: 'Personaje',
  notas: 'Notas',
}

/** Rasgos repetidos que no aportan nada nuevo en la lista (se ven en la tabla de la clase). */
const isPlaceholder = (f: FeatureView) => /^(Rasgo de subclase|Mejora de característica|Don épico)$/i.test(f.name) && !f.choice

/** Elecciones que se hacen en otra pestaña (Conjuros o Turno), no aquí. */
const elsewhere = (kind: string) => kind === 'truco' || kind === 'maestria-armas'

export function Rasgos({ c, d, update }: TabProps) {
  const rules = useRules()
  const [editing, setEditing] = useState<{ feature: Feature; choice: ChoiceDef; origin: Origin } | null>(null)
  const [value, setValue] = useState<ChoiceValue | undefined>()

  const choosable = [...classFeatures(d.cls, c.level), ...subclassFeatures(d.sub, c.level)].filter((f) => f.choice && f.choice.kind !== 'subclase')
  const featureById = new Map(choosable.map((f) => [f.choice!.id, f]))

  const chosenLabel = (f: FeatureView) => {
    if (!f.chosen?.length) return undefined
    return f.chosen.map((id) => f.choice?.options?.find((o) => o.id === id)?.name ?? labelFor(rules, id)).join(', ')
  }

  const warnings = d.warnings.filter((w) => w.kind !== 'aviso')
  const notices = d.warnings.filter((w) => w.kind === 'aviso')

  return (
    <div class="fx-tab">
      {warnings.length > 0 && (
        <div class="notice error fx-review" role="status">
          <strong>Por revisar</strong>
          <ul>
            {/* El mismo aviso puede salir dos veces (una dote repetida): el índice evita claves iguales */}
            {warnings.map((w, i) => (
              <li key={`${i}:${w.text}`}>
                {w.text}
                {w.tab && w.tab !== 'rasgos' && (
                  <a href={href({ name: 'sheet', id: c.id, tab: w.tab })} class="btn sm brass fx-go">
                    Ir a {TAB_NAME[w.tab] ?? w.tab}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {GROUPS.map((g) => {
        const list = d.features.filter((f) => f.origin === g.origin && !isPlaceholder(f))
        if (!list.length) return null
        return (
          <section key={g.origin}>
            <h2>{g.title}</h2>
            {g.lede && <p class="lede">{g.lede}</p>}
            <div class="fx-feats">
              {list.map((f) => {
                const def = f.choice ? featureById.get(f.choice.id) : undefined
                const chosen = chosenLabel(f)
                const canChoose = !!(def && f.choice && !elsewhere(f.choice.kind))
                const missing = canChoose && !f.chosen?.length
                return (
                  <Disclosure
                    key={f.key}
                    id={missing ? `revisar-${f.choice!.id}` : undefined}
                    title={
                      <>
                        {/* El nombre va en su propio span: si no, la etiqueta sería :first-child y perdería su margen */}
                        <span>{f.name}</span>
                        {f.level && g.origin !== 'dote' ? <span class="tag">Nv {f.level}</span> : null}
                        {missing && <span class="tag accent">Elegir</span>}
                      </>
                    }
                    summary={chosen ? `Elegido: ${chosen}` : f.summary}
                  >
                    {f.summary && chosen && <p class="summary">{f.summary}</p>}
                    <RichText text={f.text} />
                    {canChoose && (
                      <button
                        class="btn soft block fx-choose"
                        onClick={() => {
                          setValue({ ids: c.choices[f.choice!.id] ?? [] })
                          setEditing({ feature: def!, choice: f.choice!, origin: f.origin })
                        }}
                      >
                        {f.chosen?.length ? 'Cambiar elección' : 'Elegir'}
                      </button>
                    )}
                  </Disclosure>
                )
              })}
            </div>
          </section>
        )
      })}

      {notices.length > 0 && <p class="small muted fx-asides">{notices.map((w) => w.text).join(' ')}</p>}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.feature.name} dirty={!!editing && JSON.stringify(value?.ids ?? []) !== JSON.stringify(c.choices[editing.choice.id] ?? [])}>
        {editing && (
          <>
            {editing.feature.summary && <p class="summary">{editing.feature.summary}</p>}
            <ChoiceEditor c={c} d={d} feature={editing.feature} choice={editing.choice} level={editing.feature.level} origin={editing.origin} value={value} onChange={setValue} />
            <div class="footerbar fx-sheetbar">
              <button
                class="btn primary block"
                disabled={!choiceReady(editing.choice, value, rules)}
                onClick={() => {
                  update(applyChoice(c, editing.feature, editing.choice, value!))
                  setEditing(null)
                  toast('Guardado')
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
