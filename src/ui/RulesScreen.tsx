import type { ComponentChildren } from 'preact'
import { useMemo, useState } from 'preact/hooks'
import { href } from '../router'
import { Disclosure, Icon, RichText, useRules } from './common'
import { SpellBody, spellMeta } from './SpellEditor'
import './css/portada.css'

const SECTIONS = [
  { id: 'jugar', label: 'Cómo se juega' },
  { id: 'glosario', label: 'Glosario' },
  { id: 'conjuros', label: 'Conjuros' },
]

/** Las listas largas se pintan por tandas para que el móvil no se atasque. */
const PAGE = 100

/** Cuántas filas se ven. Al cambiar la búsqueda o un filtro (`key`), se vuelve a la primera tanda. */
function usePage(key: string) {
  const [state, setState] = useState({ key, n: PAGE })
  const n = state.key === key ? state.n : PAGE
  return [n, () => setState({ key, n: n + PAGE })] as const
}

/** Pie de una lista cortada: cuántas se ven y un botón para ver más. Nunca se esconde nada sin decirlo. */
function ShowMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  if (shown >= total) return null
  return (
    <div class="pt-more">
      <p class="small muted num">
        Ves {shown} de {total}.
      </p>
      <button class="btn block" onClick={onMore}>
        Mostrar {Math.min(PAGE, total - shown)} más
      </button>
    </div>
  )
}

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/* ---------- Buscador: todas las palabras, en cualquier orden, sin tildes ---------- */

const words = (t: string) => norm(t).split(/[^a-z0-9]+/).filter(Boolean)

/** Palabras que no ayudan a buscar: «salvación de muerte» busca «salvación» y «muerte». */
const STOP = new Set(['a', 'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'lo', 'los', 'me', 'mi', 'o', 'para', 'por', 'que', 'se', 'su', 'un', 'una', 'y'])

/** Raíz tosca para que «curar» encuentre «Curación» y «armas», «Arma». */
function stem(w: string) {
  const s = w.replace(/(?:aciones|acion|amiento|arse|erse|irse|ados|adas|idos|idas|ado|ada|ido|ida|ar|er|ir|es|os|as|o|a|e|s)$/, '')
  return s.length >= 3 ? s : w
}

/** Lo buscado, ya en raíces. Si solo hay palabras vacías («de»), se buscan esas. */
function queryStems(q: string): string[] {
  const all = words(q)
  const useful = all.filter((w) => !STOP.has(w))
  return (useful.length ? useful : all).map(stem)
}

/** Cada raíz buscada tiene que empezar alguna palabra del texto (ya partido con `words`). */
const hasAll = (stems: string[], ws: string[]) => stems.every((s) => ws.some((w) => w.startsWith(s)))

/**
 * Cómo lo dice quien empieza → nombre oficial en el glosario. Salen las primeras
 * si la búsqueda tiene todas las palabras de la izquierda.
 */
const SYNONYMS: [string, string[]][] = [
  ['pg', ['Puntos de golpe', 'Puntos de golpe temporales']],
  ['vida', ['Puntos de golpe', 'Curación']],
  ['curar', ['Curación', 'Dados de puntos de golpe']],
  ['ca', ['Clase de armadura']],
  ['cd', ['Clase de dificultad']],
  ['dos armas', ['Ligera', 'Acción adicional']],
  ['muerte', ['Tirada de salvación contra muerte', 'Estable', 'Muerto']],
  ['morir', ['Tirada de salvación contra muerte', 'Estable', 'Muerto']],
  ['accion bonus', ['Acción adicional']],
  ['accion extra', ['Acción adicional']],
  ['golpe critico', ['Crítico']],
  ['20 natural', ['Crítico']],
  ['tumbado', ['Derribado']],
  ['suelo', ['Derribado']],
  ['desmayado', ['Inconsciente']],
  ['miedo', ['Asustado']],
  ['veneno', ['Envenenado']],
  ['cansado', ['Cansancio']],
  ['sigilo', ['Esconderse']],
  ['hechizo', ['Conjuro', 'Truco']],
  ['xp', ['Puntos de experiencia']],
  ['px', ['Puntos de experiencia']],
]

/** Nombres oficiales que tocan por sinónimo, en orden y sin repetir. */
function synonymTargets(stems: string[]): string[] {
  const out: string[] = []
  for (const [key, targets] of SYNONYMS) {
    const ok = key.split(' ').every((k) => {
      const ks = stem(k)
      // Las siglas («pg», «ca») tienen que estar enteras; lo demás vale a medio escribir.
      return stems.some((s) => s === ks || (k.length > 3 && ((s.length >= 3 && ks.startsWith(s)) || s.startsWith(ks))))
    })
    if (ok) for (const t of targets) if (!out.includes(t)) out.push(t)
  }
  return out
}

export function RulesScreen({ section, q }: { section: string; q?: string }) {
  const current = SECTIONS.some((s) => s.id === section) ? section : 'jugar'
  const seg = (
    <nav class="pt-seg" aria-label="Secciones de reglas">
      {SECTIONS.map((s) => (
        <a key={s.id} href={href({ name: 'rules', section: s.id })} aria-current={s.id === current ? 'page' : undefined}>
          {s.label}
        </a>
      ))}
    </nav>
  )
  return (
    <div class="wrap pt-rules">
      <div class="pt-bar">
        <a class="btn sm ghost" href="#/">
          <Icon name="atras" size={20} />
          Inicio
        </a>
        <h1 class="pt-title">Reglas</h1>
        <span />
      </div>
      <main>
        {current === 'jugar' && <HowToPlay head={seg} />}
        {current === 'glosario' && <Glossary head={seg} initial={q} />}
        {current === 'conjuros' && <Spells head={seg} initial={q} />}
      </main>
    </div>
  )
}

/** Cabecera fija: el segmentado y, si hay, el buscador. */
function Sticky({ children }: { children: ComponentChildren }) {
  return <div class="pt-sticky">{children}</div>
}

function SearchBox({ value, onInput, placeholder, label }: { value: string; onInput: (v: string) => void; placeholder: string; label: string }) {
  return (
    <div class="pt-search">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="M15 15l5 5" />
      </svg>
      <input class="input" type="search" placeholder={placeholder} value={value} onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)} aria-label={label} />
    </div>
  )
}

function HowToPlay({ head }: { head: ComponentChildren }) {
  return (
    <div class="pt-read">
      <Sticky>{head}</Sticky>
      <p class="lede pt-intro">Lo justo para empezar a jugar sin miedo. La DM siempre tiene la última palabra.</p>

      <h2>La tirada de siempre</h2>
      <div class="card frame">
        <p class="pt-formula">
          d20 + bonificador <span class="pt-ge">≥</span> número objetivo
        </p>
        <p>
          Casi todo en el juego se resuelve así. El <strong>bonificador</strong> lo tienes en la ficha. El <strong>número objetivo</strong> es la <strong>CD</strong> (clase de dificultad) que dice la DM, o la <strong>CA</strong> del enemigo si estás atacando. Hay tres tipos de tirada:
        </p>
        <ul class="pt-ul">
          <li>
            <strong>Prueba de característica</strong>: intentar algo difícil (trepar, convencer, buscar). Usa la habilidad que encaje: Atletismo, Persuasión, Percepción…
          </li>
          <li>
            <strong>Tirada de salvación</strong>: resistir algo que te pasa (un veneno, una bola de fuego). La DM te dice cuál.
          </li>
          <li>
            <strong>Tirada de ataque</strong>: golpear o lanzar un conjuro de ataque. Si iguala o supera la CA, aciertas.
          </li>
        </ul>
      </div>

      <h2>Ventaja y desventaja</h2>
      <div class="grid2">
        <div class="card pt-duo good">
          <h3>
            <Icon name="subir" size={20} />
            Ventaja
          </h3>
          <p class="small">
            Tira 2d20 y quédate el <strong>mayor</strong>. Cuando algo te favorece: atacar a alguien derribado a tu lado, que te ayuden…
          </p>
        </div>
        <div class="card pt-duo bad">
          <h3>
            <Icon name="subir" size={20} />
            Desventaja
          </h3>
          <p class="small">
            Tira 2d20 y quédate el <strong>menor</strong>. Cuando algo te perjudica: atacar a lo que no ves, estar envenenado…
          </p>
        </div>
      </div>
      <p class="small muted pt-after">Si tienes las dos a la vez, se anulan: tiras un solo d20. Un 20 natural al atacar es un crítico (dados de daño dobles); un 1 natural siempre falla.</p>

      <h2>Tu turno en combate</h2>
      <div class="list pt-defs">
        <div class="li">
          <span>
            <strong>Movimiento</strong>
            <span>Hasta tu velocidad (cada casilla son 1,5 m). Puedes repartirlo antes y después de actuar.</span>
          </span>
        </div>
        <div class="li">
          <span>
            <strong>Una acción</strong>
            <span>Atacar, lanzar un conjuro, Correr, Esquivar, Destrabarse, Ayudar, Esconderse…</span>
          </span>
        </div>
        <div class="li">
          <span>
            <strong>Una acción adicional</strong>
            <span>Solo si un rasgo o conjuro te la da. En tu ficha, la pestaña Turno te dice cuáles tienes.</span>
          </span>
        </div>
        <div class="li">
          <span>
            <strong>Una reacción</strong>
            <span>Una por ronda, incluso fuera de tu turno: por ejemplo, un ataque de oportunidad.</span>
          </span>
        </div>
        <div class="li">
          <span>
            <strong>Interactuar con un objeto</strong>
            <span>Gratis: desenvainar, abrir una puerta…</span>
          </span>
        </div>
      </div>
      <p class="small muted pt-after">
        El orden lo marca la <strong>iniciativa</strong>: al empezar el combate, todos tiran d20 + iniciativa y se actúa de mayor a menor.
      </p>

      <h2>Puntos de golpe y caer a 0</h2>
      <div class="card">
        <p>
          El daño te quita PG. Los <strong>PG temporales</strong> se gastan primero y no se suman entre sí: si te dan más, te quedas con la cantidad más alta. Si llegas a 0 PG caes inconsciente y, al empezar cada uno de tus turnos, haces una <strong>tirada de salvación contra muerte</strong> (d20: 10 o más es un éxito). Tres éxitos: te estabilizas. Tres fallos: mueres. Un 1 cuenta como dos fallos y un 20 te levanta con 1 PG. Cualquier curación te levanta.
        </p>
        <ul class="pt-ul">
          <li>
            <strong>Si te golpean estando a 0 PG</strong>, cada golpe cuenta como un fallo. Si es un crítico, como dos.
          </li>
          <li>
            <strong>Muerte instantánea</strong>: si un golpe te deja a 0 PG y el daño que sobra es igual o mayor que tus PG máximos, mueres en el acto. Por ejemplo, con 12 PG máximos y 6 PG, un golpe de 18 te mata. Si ya estabas a 0 PG, te mata un golpe igual o mayor que tus PG máximos.
          </li>
        </ul>
      </div>

      <h2>Descansar</h2>
      <div class="grid2">
        <div class="card">
          <h3>Descanso corto</h3>
          <p class="pt-kicker">1 hora</p>
          <p class="small">Gastas dados de golpe para curarte y recuperas algunos rasgos.</p>
        </div>
        <div class="card">
          <h3>Descanso largo</h3>
          <p class="pt-kicker">8 horas</p>
          <p class="small">Todo a tope: PG, dados de golpe, espacios de conjuro y rasgos. Uno por día, y para empezarlo necesitas al menos 1 PG.</p>
        </div>
      </div>

      <h2>Conjuros en dos minutos</h2>
      <div class="card">
        <ul class="pt-ul">
          <li>
            <strong>Trucos</strong>: gratis, todas las veces que quieras.
          </li>
          <li>
            <strong>Conjuros de nivel 1 o más</strong>: gastan un <strong>espacio de conjuro</strong> de ese nivel o superior. Se recuperan con descanso largo.
          </li>
          <li>
            <strong>Concentración (C)</strong>: solo puedes mantener uno. Si te dañan, salvación de Constitución (CD 10 o la mitad del daño, lo que sea mayor, hasta un máximo de CD 30) o se acaba. Si caes a 0 PG, se acaba sin tirar.
          </li>
          <li>
            Si el conjuro pide <strong>salvación</strong>, el enemigo tira contra tu <strong>CD de conjuros</strong>. Si pide <strong>ataque</strong>, tiras d20 + tu ataque mágico contra su CA.
          </li>
        </ul>
      </div>

      <h2>Subir de nivel</h2>
      <div class="card">
        <p>
          Cuando la DM os diga que subís, abre tu ficha y toca <strong>Subir a nivel 2</strong> (o al que toque), arriba a la derecha. El asistente te explica qué ganas y te pregunta solo lo que tienes que elegir. Si te equivocas, en Personaje puedes deshacerlo.
        </p>
      </div>
    </div>
  )
}

function Glossary({ head, initial }: { head: ComponentChildren; initial?: string }) {
  const rules = useRules()
  const [q, setQ] = useState(initial ?? '')
  const [tag, setTag] = useState<string | null>(null)
  const tags = useMemo(() => {
    const count = new Map<string, number>()
    for (const g of rules.book.glossary) if (g.tag) count.set(g.tag, (count.get(g.tag) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [rules])
  // Palabras de cada entrada, partidas una sola vez.
  const index = useMemo(() => {
    const extra = [...rules.book.masteries.map((m) => ({ ...m, tag: 'Maestría' })), ...rules.book.weaponProperties.map((m) => ({ ...m, tag: 'Propiedad de arma' }))]
    return [...rules.book.glossary, ...extra].map((g) => ({ g, name: words(g.name), text: words(g.text) }))
  }, [rules])
  const spellIndex = useSpellIndex()
  const { entries, spellHits } = useMemo(() => {
    const n = norm(q).trim()
    const stems = queryStems(q)
    const inTag = index.filter((x) => !tag || x.g.tag === tag)
    if (!stems.length) return { entries: inTag.map((x) => x.g).sort((a, b) => a.name.localeCompare(b.name, 'es')), spellHits: 0 }
    // Primero lo que se busca con otras palabras; luego lo que lo tiene en el nombre y, si la búsqueda es larga, en el texto.
    const bySynonym = synonymTargets(stems).flatMap((name) => inTag.filter((x) => x.g.name === name).map((x) => x.g))
    const rest = inTag
      .filter((x) => !bySynonym.includes(x.g) && (hasAll(stems, x.name) || (n.length > 3 && hasAll(stems, x.text))))
      .map((x) => ({ g: x.g, rank: norm(x.g.name).startsWith(n) ? 0 : hasAll(stems, x.name) ? 1 : 2 }))
      .sort((a, b) => a.rank - b.rank || a.g.name.localeCompare(b.g.name, 'es'))
      .map((x) => x.g)
    // Conjuros solo si se ha escrito algo con sentido: «ca» o «de» darían decenas.
    const meaningful = words(q).filter((w) => !STOP.has(w)).join('').length >= 3
    return { entries: [...bySynonym, ...rest], spellHits: meaningful ? spellIndex.filter((s) => hasAll(stems, s.name)).length : 0 }
  }, [q, tag, index, spellIndex])
  const [shown, more] = usePage(`${q}|${tag}`)
  const toSpells = href({ name: 'rules', section: 'conjuros', q: q.trim() })
  const spellsText = spellHits === 1 ? 'un conjuro con ese nombre' : `${spellHits} conjuros con ese nombre`
  return (
    <div>
      <Sticky>
        {head}
        <SearchBox value={q} onInput={setQ} placeholder="Buscar: derribado, ventaja, cobertura…" label="Buscar en el glosario" />
      </Sticky>
      <div class="pt-filters">
        <div class="chips" role="group" aria-label="Filtrar por tipo">
          <button class={`chip ${!tag ? 'on' : ''}`} aria-pressed={!tag} onClick={() => setTag(null)}>
            Todo
          </button>
          {[...tags, 'Maestría', 'Propiedad de arma'].map((t) => (
            <button key={t} class={`chip ${tag === t ? 'on' : ''}`} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <p class="pt-count num" aria-live="polite">
        {entries.length === 1 ? '1 entrada' : `${entries.length} entradas`}
      </p>
      {entries.length === 0 && spellHits === 0 && (
        <p class="notice">{tag ? <>No hay nada así en «{tag}». Toca «Todo» para buscar en todo el glosario.</> : 'No hay nada con ese nombre. Prueba con otra palabra.'}</p>
      )}
      {entries.length === 0 && spellHits > 0 && (
        <div class="notice">
          <p>No está en el glosario, pero hay {spellsText}.</p>
          <a class="btn sm" href={toSpells}>
            Buscar en Conjuros
          </a>
        </div>
      )}
      {entries.length > 0 && spellHits > 0 && (
        <p class="small muted">
          También hay {spellsText}.{' '}
          <a class="link" href={toSpells}>
            Buscar en Conjuros
          </a>
        </p>
      )}
      {entries.slice(0, shown).map((g) => (
        <Disclosure key={`${g.tag}:${g.id}`} title={g.name} extra={g.tag ? <span class="tag">{g.tag}</span> : undefined}>
          <RichText text={g.text} />
        </Disclosure>
      ))}
      <ShowMore shown={Math.min(shown, entries.length)} total={entries.length} onMore={more} />
    </div>
  )
}

/** Conjuros con su nombre ya partido en palabras (lo usan el glosario y la lista de conjuros). */
function useSpellIndex() {
  const rules = useRules()
  return useMemo(() => rules.book.spells.map((s) => ({ s, name: words(s.name) })), [rules])
}

function Spells({ head, initial }: { head: ComponentChildren; initial?: string }) {
  const rules = useRules()
  const index = useSpellIndex()
  const [q, setQ] = useState(initial ?? '')
  const [cls, setCls] = useState<string | null>(null)
  const [level, setLevel] = useState<number | null>(null)
  const classes = rules.book.classes.filter((c) => c.spellcasting)
  const list = useMemo(() => {
    const stems = queryStems(q)
    return index
      .filter((x) => (!cls || x.s.classes.includes(cls)) && (level === null || x.s.level === level) && hasAll(stems, x.name))
      .map((x) => x.s)
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'es'))
  }, [q, cls, level, index])
  const [shown, more] = usePage(`${q}|${cls}|${level}`)
  return (
    <div>
      <Sticky>
        {head}
        <SearchBox value={q} onInput={setQ} placeholder="Buscar conjuro" label="Buscar conjuro" />
      </Sticky>
      <div class="pt-filters">
        <p class="label" id="pt-f-clase">
          Clase
        </p>
        <div class="chips" role="group" aria-labelledby="pt-f-clase">
          {classes.map((c) => (
            <button key={c.id} class={`chip ${cls === c.id ? 'on' : ''}`} aria-pressed={cls === c.id} onClick={() => setCls(cls === c.id ? null : c.id)}>
              {c.name}
            </button>
          ))}
        </div>
        <p class="label" id="pt-f-nivel">
          Nivel
        </p>
        <div class="chips pt-levels" role="group" aria-labelledby="pt-f-nivel">
          {Array.from({ length: 10 }, (_, l) => (
            <button key={l} class={`chip num ${level === l ? 'on' : ''}`} aria-pressed={level === l} onClick={() => setLevel(level === l ? null : l)}>
              {l === 0 ? 'Trucos' : l}
            </button>
          ))}
        </div>
      </div>
      <p class="pt-count num" aria-live="polite">
        {list.length === 1 ? '1 conjuro' : `${list.length} conjuros`}
      </p>
      {list.length === 0 && <p class="notice">{cls || level !== null ? 'No hay ningún conjuro así. Prueba con otro nombre o quita algún filtro.' : 'No hay ningún conjuro con ese nombre. Prueba con otra palabra.'}</p>}
      {list.slice(0, shown).map((s) => (
        <Disclosure key={s.id} title={s.name} summary={`${spellMeta(s)} · ${s.castingTime.split(',')[0]}`}>
          <SpellBody s={s} />
          <p class="small muted pt-classes">Clases: {s.classes.map((id) => rules.cls(id)?.name ?? id).join(', ')}</p>
        </Disclosure>
      ))}
      <ShowMore shown={Math.min(shown, list.length)} total={list.length} onMore={more} />
    </div>
  )
}
