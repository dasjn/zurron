import { Component, type ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import type { RuleBook, Rules } from './rules/book'
import { onMesaChange } from './mesa'
import { loadRules } from './rules/load'
import { useRoute, type Route } from './router'
import { characters, markCrash, retrySave, saveProblem, unsavedCharacters, useStore } from './store'
import { RulesContext, ToastHost, exportAndTell, toast } from './ui/common'
import { Home } from './ui/Home'
import { Sheet } from './ui/Sheet'
import { LevelUp } from './ui/LevelUp'
import { RulesScreen } from './ui/RulesScreen'
import { Create } from './ui/Create'

/* ---------- Versión nueva de la app ---------- */

let applyUpdate: (() => void) | null = null
const updateListeners = new Set<() => void>()

/** main.tsx avisa de que hay una versión nueva lista; `apply` la pone (recargando). */
export function offerUpdate(apply: () => void) {
  applyUpdate = apply
  updateListeners.forEach((l) => l())
}

/* ---------- Si una pantalla falla ---------- */

class Guard extends Component<{ route: Route; book?: RuleBook; children: ComponentChildren }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(error)
    const r = this.props.route
    if (r.name === 'sheet' || r.name === 'levelup') markCrash(r.id)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const home = () => {
      // En el inicio ya: solo queda recargar
      if (this.props.route.name === 'home') location.reload()
      else location.hash = '#/'
    }
    return (
      <div class="wrap dt-crash">
        <p class="brand">Zurrón</p>
        <h1>Algo ha fallado al mostrar esta pantalla</h1>
        <p>Tus fichas siguen guardadas en este móvil. Vuelve al inicio y prueba otra vez. Si vuelve a pasar, exporta una copia y pásasela a quien os ayuda con la app.</p>
        <div class="grid2">
          <button class="btn primary" onClick={home}>
            Volver al inicio
          </button>
          <button class="btn" onClick={() => exportAndTell(characters(), this.props.book)} disabled={!characters().length}>
            Exportar copia
          </button>
        </div>
        <details>
          <summary>Detalles del fallo</summary>
          <pre>{String(error.stack ?? error.message ?? error)}</pre>
        </details>
      </div>
    )
  }
}

/* ---------- Avisos fijos arriba ---------- */

function SaveBar({ book }: { book?: RuleBook }) {
  const problem = saveProblem()
  if (!problem) return null
  const names = unsavedCharacters().map((c) => c.name)
  const who = names.length ? names.join(', ') : 'tus fichas'
  return (
    <div class="notice error dt-bar" role="alert">
      <strong>No se ha podido guardar</strong>
      {problem === 'lleno' ? (
        <p>
          No queda espacio en este móvil y los últimos cambios de {who} solo están en esta pantalla: se perderán al cerrar la app. Exporta una copia ahora. Para hacer sitio, quita algún retrato o borra fichas que ya no uses, y toca «Reintentar».
        </p>
      ) : (
        <p>Este navegador no deja guardar datos (puede que estés en modo privado). Los cambios de {who} se perderán al cerrar: exporta una copia antes de salir.</p>
      )}
      <div class="dt-actions">
        <button class="btn sm primary" onClick={() => exportAndTell(characters(), book)}>
          Exportar copia
        </button>
        <button class="btn sm" onClick={() => toast(retrySave() ? 'Ya está todo guardado' : 'Sigue sin poder guardarse')}>
          Reintentar
        </button>
      </div>
    </div>
  )
}

function UpdateBar({ onLater }: { onLater: () => void }) {
  return (
    <div class="notice dt-update" role="status">
      <span>Hay una versión nueva de Zurrón.</span>
      <button class="btn sm ghost" onClick={onLater}>
        Luego
      </button>
      <button class="btn sm brass" onClick={() => applyUpdate?.()}>
        Actualizar
      </button>
    </div>
  )
}

function Bars({ book }: { book?: RuleBook }) {
  useStore()
  const [, setTick] = useState(0)
  useEffect(() => {
    const l = () => setTick((t) => t + 1)
    updateListeners.add(l)
    return () => updateListeners.delete(l)
  }, [])
  const [later, setLater] = useState(false)
  const problem = saveProblem()
  const update = !!applyUpdate && !later
  const was = useRef(problem)
  // Al empezar a fallar, también un aviso efímero: quien está escribiendo más abajo lo ve
  useEffect(() => {
    if (problem && !was.current) toast('No se ha podido guardar en este móvil. Mira el aviso de arriba.')
    was.current = problem
  }, [problem])
  // Sin nada que decir, ni el hueco
  if (!problem && !update) return null
  return (
    <div class="dt-bars">
      <SaveBar book={book} />
      {update && <UpdateBar onLater={() => setLater(true)} />}
    </div>
  )
}

export function App() {
  const [rules, setRules] = useState<Rules | null>(null)
  const [error, setError] = useState<string | null>(null)
  const route = useRoute()

  useEffect(() => {
    const load = () =>
      loadRules()
        .then(setRules)
        .catch((e) => setError(String(e)))
    load()
    // Una copia con contenido de la mesa (trasfondos, dotes…) cambia el libro.
    return onMesaChange(load)
  }, [])

  if (error)
    return (
      <div class="wrap">
        <p class="brand">Zurrón</p>
        <p class="notice error">No he podido cargar las reglas: {error}. Cierra la app y vuelve a abrirla; si sigue igual, ábrela con conexión.</p>
      </div>
    )
  if (!rules)
    return (
      <div class="wrap center">
        <p class="brand" style={{ marginTop: '30vh' }}>
          Zurrón
        </p>
        <p class="muted">Abriendo el libro de reglas…</p>
      </div>
    )

  let screen
  switch (route.name) {
    case 'sheet':
      screen = <Sheet id={route.id} tab={route.tab} />
      break
    case 'levelup':
      screen = <LevelUp id={route.id} />
      break
    case 'rules':
      screen = <RulesScreen section={route.section} q={route.q} />
      break
    case 'create':
      screen = <Create />
      break
    default:
      screen = <Home />
  }
  // Cambiar de pantalla deja atrás el fallo (la clave hace un Guard nuevo)
  const where = route.name === 'sheet' || route.name === 'levelup' ? `${route.name}:${route.id}` : route.name
  return (
    <RulesContext.Provider value={rules}>
      <Bars book={rules.book} />
      <Guard key={where} route={route} book={rules.book}>
        {screen}
      </Guard>
      <ToastHost />
    </RulesContext.Provider>
  )
}
