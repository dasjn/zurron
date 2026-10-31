import { useEffect, useRef, useState } from 'preact/hooks'
import type { Character } from '../model/character'
import { lastExport, readBackup } from '../backup'
import { addMesa, describeMesa, mesaCount, removeMesa, storedMesa, type MesaPack } from '../mesa'
import { loadParty } from '../rules/load'
import { derive } from '../rules/derive'
import { href } from '../router'
import { characters, getCharacter, saveCharacter, useStore } from '../store'
import { Icon, Modal, Portrait, exportAndTell, identityNames, isIOS, isStandalone, paletteStyle, sinceText, toast, useRules, type IconName } from './common'
import './css/portada.css'

/** «Bardo de nivel 1, mediano». Si no cabe, se parte por la coma. */
function Subtitle({ c }: { c: Character }) {
  const { cls, species: sp } = identityNames(useRules(), c)
  return (
    <span class="pt-meta">
      <span>
        {cls} de nivel {c.level},
      </span>{' '}
      <span>{sp}</span>
    </span>
  )
}

const RULES: { section: string; icon: IconName; title: string; text: string }[] = [
  { section: 'jugar', icon: 'habilidades', title: 'Cómo se juega', text: 'Lo básico para tu primera partida' },
  { section: 'glosario', icon: 'glosario', title: 'Glosario', text: 'Estados, acciones y términos' },
  { section: 'conjuros', icon: 'conjuros', title: 'Conjuros', text: 'Todos los conjuros con buscador' },
]

/** «3 oct 2026, 18:40» (o «sin fecha»). */
const when = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? 'sin fecha' : d.toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Lo que trae una copia y aún hay que preguntar: fichas que ya están en el móvil. */
interface Pending {
  repeated: Character[]
  mesa: MesaPack
  /** Lo que ya ha entrado de la misma copia, para decirlo ahí (un aviso flotante taparía las fechas). */
  done: string
}

export function Home() {
  useStore()
  const rules = useRules()
  const mine = characters()
  const [party, setParty] = useState<Character[]>([])
  const [pending, setPending] = useState<Pending | null>(null)
  // Lo que ha pasado al importar, si hay algo que contar además del aviso
  const [report, setReport] = useState<{ done: string; warnings: string[] } | null>(null)
  const [askMesa, setAskMesa] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const mesa = storedMesa()

  useEffect(() => {
    loadParty().then(setParty)
  }, [])

  const available = party.filter((p) => !getCharacter(p.id))

  const adopt = (c: Character) => {
    const now = new Date().toISOString()
    const fresh = { ...c, createdAt: now, updatedAt: now }
    fresh.state = { ...fresh.state, hp: derive(fresh, rules).maxHp }
    saveCharacter(fresh)
    location.hash = href({ name: 'sheet', id: c.id, tab: 'estado' })
  }

  /** Guarda las fichas; devuelve las que no se han podido guardar en el móvil. */
  const saveAll = (list: Character[]) => list.filter((c) => !saveCharacter(c))
  const names = (list: Character[]) => list.map((c) => c.name).join(', ')

  const onImport = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement
    const f = input.files?.[0]
    input.value = ''
    if (!f) return
    try {
      const { characters: list, mesa: incoming, warnings } = await readBackup(f, rules)
      const repeated = list.filter((c) => getCharacter(c.id))
      const fresh = list.filter((c) => !getCharacter(c.id))
      const notes = [...warnings]
      // Las nuevas entran ya; solo se pregunta por las que están repetidas
      if (fresh.length) {
        // Lo de la mesa que ya está en el móvil no se cambia hasta saber qué hacer con las repetidas
        const m = addMesa(incoming, { keepExisting: repeated.length > 0 })
        if (!m.saved) notes.push('No queda espacio para guardar en este móvil el contenido de tu mesa que trae la copia: al cerrar la app, esas fichas mostrarán avisos. Haz sitio e impórtala otra vez.')
        const failed = saveAll(fresh)
        if (failed.length) notes.push(`${names(failed)} no se ha podido guardar en el móvil: mira el aviso de arriba.`)
      }
      const done = fresh.length === 0 ? '' : fresh.length === 1 ? `${fresh[0].name} ya está en este móvil.` : `Importadas ${fresh.length} fichas: ${names(fresh)}.`
      if (repeated.length) setPending({ repeated, mesa: incoming, done })
      if (notes.length) setReport({ done, warnings: notes })
      else {
        setReport(null)
        if (done && !repeated.length) toast(done)
      }
    } catch (err) {
      setReport(null)
      toast((err as Error).message)
    }
  }

  const replace = (p: Pending) => {
    const m = addMesa(p.mesa)
    const failed = saveAll(p.repeated)
    setPending(null)
    if (failed.length) toast(`${names(failed)} no se ha podido guardar en el móvil: mira el aviso de arriba`)
    else if (!m.saved) toast('Ficha sustituida, pero el contenido de tu mesa no cabe en el móvil')
    else toast(p.repeated.length === 1 ? `${p.repeated[0].name}: ahora tienes la ficha de la copia` : 'Fichas sustituidas por las de la copia')
  }

  // «Última copia»: la más antigua de las fichas del móvil (si alguna no tiene ninguna, no hay fecha que dar)
  const copies = mine.map((c) => lastExport(c.id))
  const oldestCopy = copies.some((x) => !x) ? undefined : copies.sort()[0]

  return (
    <div class="wrap pt-home">
      <header class="pt-head">
        <h1 class="brand">Zurrón</h1>
        <div class="pt-orn" aria-hidden="true" />
        <p class="pt-tagline">Tu ficha de personaje para la quinta edición, con las reglas de 2024 y explicada paso a paso.</p>
      </header>

      {mine.length > 0 && (
        <section>
          <h2>En este móvil</h2>
          <div class="list pt-roster">
            {mine.map((c) => (
              <a class="li pt-pc" style={paletteStyle(c)} href={href({ name: 'sheet', id: c.id, tab: 'estado' })} key={c.id}>
                <Portrait c={c} size={56} />
                <span class="grow">
                  <span class="pt-name">{c.name}</span>
                  <Subtitle c={c} />
                </span>
                <span class="pt-go">
                  <Icon name="adelante" size={20} />
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {available.length > 0 && (
        <section>
          <h2>{mine.length ? 'Añadir otro personaje del grupo' : '¿Quién eres?'}</h2>
          {!mine.length && <p class="lede">Elige tu personaje. Se guarda en este móvil y puedes usarlo sin conexión.</p>}
          <div class="list pt-roster">
            {available.map((c) => (
              <button class="li pt-pc pt-adopt" style={paletteStyle(c)} onClick={() => adopt(c)} key={c.id}>
                <Portrait c={c} size={56} />
                <span class="pt-name">{c.name}</span>
                <span class="btn sm brass pt-add">Añadir</span>
                <Subtitle c={c} />
              </button>
            ))}
          </div>
        </section>
      )}

      <a class="pt-new" href={href({ name: 'create' })}>
        <span class="pt-slot" aria-hidden="true" />
        <span class="grow">
          <span class="pt-name">Crear un personaje nuevo</span>
          <span class="pt-meta">{party.length ? 'Si no tienes ficha del grupo, te guío paso a paso.' : 'Te guío paso a paso, sin saberte las reglas.'}</span>
        </span>
        <span class="pt-go">
          <Icon name="adelante" size={20} />
        </span>
      </a>

      <section>
        <h2>Reglas</h2>
        <nav class="list" aria-label="Reglas">
          {RULES.map((r) => (
            <a class="li pt-link" href={href({ name: 'rules', section: r.section })} key={r.section}>
              <span class="pt-ico">
                <Icon name={r.icon} size={22} />
              </span>
              <span class="grow">
                <span class="pt-ltitle">{r.title}</span>
                <span class="pt-meta">{r.text}</span>
              </span>
              <span class="pt-go">
                <Icon name="adelante" size={20} />
              </span>
            </a>
          ))}
        </nav>
      </section>

      <section>
        <h2>Copia de seguridad</h2>
        <p class="lede">
          Las fichas viven solo en este móvil. «Exportar copia» crea un archivo con todas: según el móvil, se abre el menú de compartir (guárdalo en Archivos o Drive, o mándatelo por un chat) o se guarda en Descargas. Haz una de vez en cuando y antes de cambiar de móvil. Para
          recuperarla, o si te han pasado tu ficha en un archivo, usa «Importar copia».
        </p>
        {mine.length > 0 && <p class="dt-last">{oldestCopy ? `Última copia: ${sinceText(oldestCopy)}.` : 'Aún no has hecho ninguna copia desde este móvil.'}</p>}
        <div class="grid2">
          <button class="btn" onClick={() => exportAndTell(mine, rules.book)} disabled={!mine.length}>
            Exportar copia
          </button>
          <button class="btn" onClick={() => fileRef.current?.click()}>
            Importar copia
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" class="hidden" onChange={onImport} />
        {report && (
          <div class="notice dt-report" role="status">
            {report.done && <strong>{report.done}</strong>}
            <ul>
              {report.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <div class="dt-actions">
              <button class="btn sm" onClick={() => setReport(null)}>
                Entendido
              </button>
            </div>
          </div>
        )}
        {mesaCount(mesa) > 0 && (
          <div class="dt-mesa">
            <p class="small muted">Con las copias han llegado cosas de tu mesa que no están en el SRD: {describeMesa(mesa)}.</p>
            <button class="btn sm ghost" onClick={() => setAskMesa(true)}>
              Quitar el contenido de la mesa
            </button>
          </div>
        )}
      </section>

      {!isStandalone() && (
        <section>
          <h2>Instálala</h2>
          <p class="notice">
            {isIOS ? (
              <>
                En Safari toca <strong>Compartir</strong> y luego <strong>Añadir a pantalla de inicio</strong> (en Chrome, el mismo botón está arriba a la derecha). Así se abre como una app, funciona sin conexión y el navegador no borra tus datos. Ojo: la app instalada guarda sus datos aparte del navegador. Si ya
                tienes fichas aquí, exporta antes una copia y, al abrir la app desde la pantalla de inicio, impórtala allí.
              </>
            ) : (
              <>
                En Chrome, abre el menú <strong>⋮</strong> y toca <strong>Instalar aplicación</strong> (o <strong>Añadir a pantalla de inicio</strong>). Así funciona sin conexión.
              </>
            )}
          </p>
        </section>
      )}

      <footer class="pt-legal">
        <p>
          Esta obra incluye material procedente del documento de referencia del sistema 5.2.1 (“SRD 5.2.1”) de Wizards of the Coast LLC, disponible en{' '}
          <a href="https://www.dndbeyond.com/srd">https://www.dndbeyond.com/srd</a>. La licencia sobre el SRD 5.2.1 se concede de acuerdo con la licencia internacional de atribución/reconocimiento 4.0 de Creative Commons, disponible en{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/legalcode">https://creativecommons.org/licenses/by/4.0/legalcode</a>.
        </p>
        <p>El texto del SRD 5.2.1 está adaptado para esta app: reorganizado, con cambios de formato y con explicaciones nuestras añadidas.</p>
        <p>Zurrón es un proyecto de aficionados, no oficial: no está publicado por Wizards of the Coast ni cuenta con su respaldo.</p>
        <p>Compatible con la quinta edición. Lo marcado como «de tu mesa» llega con tus copias, se queda en este móvil y no forma parte de la app.</p>
      </footer>

      <Modal open={!!pending} onClose={() => setPending(null)} title={pending && pending.repeated.length > 1 ? 'Ya tienes esas fichas' : 'Ya tienes esa ficha'}>
        {pending && (
          <>
            {pending.done && <p class="notice">{pending.done}</p>}
            <p>
              {pending.repeated.length === 1
                ? `En este móvil ya está ${pending.repeated[0].name}. ¿La sustituyo por la de la copia? Lo que tengas aquí de esa ficha se perderá.`
                : `En este móvil ya están ${names(pending.repeated)}. ¿Las sustituyo por las de la copia? Lo que tengas aquí de esas fichas se perderá.`}
            </p>
            <div class="list dt-compare">
              {pending.repeated.map((c) => {
                const here = getCharacter(c.id)
                const hereAt = here?.updatedAt ?? ''
                const newer = c.updatedAt > hereAt ? 'copia' : c.updatedAt < hereAt ? 'movil' : null
                return (
                  <div class="li" key={c.id}>
                    <strong>{c.name}</strong>
                    <dl>
                      <dt>En este móvil</dt>
                      <dd>
                        nivel {here?.level}, cambiada el {when(hereAt)}
                        {newer === 'movil' && <span class="tag">Más reciente</span>}
                      </dd>
                      <dt>En la copia</dt>
                      <dd>
                        nivel {c.level}, cambiada el {when(c.updatedAt)}
                        {newer === 'copia' && <span class="tag">Más reciente</span>}
                      </dd>
                    </dl>
                  </div>
                )
              })}
            </div>
            <div class="grid2">
              <button
                class="btn"
                onClick={() => {
                  setPending(null)
                  toast(pending.repeated.length === 1 ? `${pending.repeated[0].name} se queda como estaba` : 'Esas fichas se quedan como estaban')
                }}
              >
                {pending.repeated.length === 1 ? 'No, déjala' : 'No, déjalas'}
              </button>
              <button class="btn primary" onClick={() => replace(pending)}>
                Sí, sustituir
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={askMesa} onClose={() => setAskMesa(false)} title="¿Quitar el contenido de la mesa?">
        <p>Se borran de este móvil {describeMesa(mesa)}: lo que llegó con las copias y no está en el SRD.</p>
        <p>Las fichas no se borran, pero las que lo usen mostrarán avisos (y les faltarán esos rasgos) hasta que vuelvas a importar una copia que lo traiga.</p>
        <div class="grid2">
          <button class="btn" onClick={() => setAskMesa(false)}>
            Cancelar
          </button>
          <button
            class="btn danger"
            onClick={() => {
              const ok = removeMesa()
              setAskMesa(false)
              toast(ok ? 'Contenido de la mesa quitado' : 'Quitado por ahora, pero no se ha podido guardar el cambio en el móvil')
            }}
          >
            Sí, quitar
          </button>
        </div>
      </Modal>
    </div>
  )
}
