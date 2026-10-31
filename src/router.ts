// Rutas con # para que funcionen en cualquier alojamiento estático.
//   #/                      inicio
//   #/p/<id>/<pestaña>      ficha
//   #/p/<id>/subir          asistente de subir de nivel
//   #/reglas/<sección>      glosario, conjuros, cómo se juega
//   #/crear                 crear un personaje nuevo
//
// Además, cada ventana abierta (Modal) añade una entrada al historial con la
// misma dirección: así el botón Atrás del móvil la cierra en vez de salir de
// la pantalla (y perder lo que hubiera escrito). Ver openLayer().

import { useEffect, useState } from 'preact/hooks'

export type Route =
  | { name: 'home' }
  | { name: 'sheet'; id: string; tab: string }
  | { name: 'levelup'; id: string }
  | { name: 'rules'; section: string; q?: string }
  | { name: 'create' }

/** Un «%» suelto en la dirección no puede tumbar la app al arrancar. */
function decode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export function parse(hash: string): Route {
  const [path, query] = hash.replace(/^#/, '').split('?')
  const parts = path.split('/').filter(Boolean).map(decode)
  if (parts[0] === 'p' && parts[1]) {
    if (parts[2] === 'subir') return { name: 'levelup', id: parts[1] }
    return { name: 'sheet', id: parts[1], tab: parts[2] ?? 'estado' }
  }
  if (parts[0] === 'crear') return { name: 'create' }
  if (parts[0] === 'reglas') {
    let q: string | undefined
    try {
      q = new URLSearchParams(query ?? '').get('q') ?? undefined
    } catch {
      q = undefined
    }
    return { name: 'rules', section: parts[1] ?? 'jugar', q }
  }
  return { name: 'home' }
}

export function href(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/'
    case 'sheet':
      return `#/p/${encodeURIComponent(r.id)}/${r.tab}`
    case 'levelup':
      return `#/p/${encodeURIComponent(r.id)}/subir`
    case 'rules':
      return `#/reglas/${r.section}${r.q ? `?q=${encodeURIComponent(r.q)}` : ''}`
    case 'create':
      return '#/crear'
  }
}

/** Navega. Si hay ventanas abiertas, antes quita sus entradas del historial (si no, Atrás volvería a ellas). */
export function go(r: Route, replace = false) {
  navigate(href(r), replace)
}

/** Como go(), con una dirección «#/…» ya hecha (un enlace tocado dentro de una ventana). */
export function navigate(h: string, replace = false) {
  settle(() => {
    popTo(0)
    settle(() => {
      if (replace) {
        history.replaceState(null, '', h)
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      } else location.hash = h
    })
  })
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash))
  useEffect(() => {
    const on = () => {
      setRoute(parse(location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

/* ---------- Ventanas y botón Atrás ---------- */

// Cada ventana abierta tiene una entrada { capa: n } encima de la de su pantalla.
// Al cerrarla con un botón se quita esa entrada (history.back); al pulsar Atrás,
// la entrada ya no está y la ventana decide: cerrarse o, si hay cambios sin
// guardar, quedarse (recupera su entrada) y preguntar.

interface Layer {
  depth: number
  /** Atrás del sistema. true si se cierra; false si se queda abierta. */
  onBack: () => boolean
}

const layers: Layer[] = []
/** history.back/go nuestros cuyo popstate aún no ha llegado. */
let ownPops = 0
let queued: (() => void)[] = []

const depthNow = () => (history.state as { capa?: number } | null)?.capa ?? 0

/** Ejecuta `fn` cuando no quede ningún «atrás» nuestro pendiente (si no, un pushState se colaría antes). */
function settle(fn: () => void) {
  if (ownPops) queued.push(fn)
  else fn()
}

/** Un «atrás» nuestro ha llegado (o se da por llegado): si no queda ninguno, sigue lo que esperaba. */
function ownPopDone() {
  ownPops--
  clearTimeout(timers.shift())
  if (ownPops) return
  const fns = queued
  queued = []
  fns.forEach((f) => f())
}
const timers: number[] = []

/** Vuelve en el historial hasta la entrada de esa profundidad, sin avisar a las ventanas. */
function popTo(depth: number) {
  const n = depthNow() - depth
  if (n <= 0) return
  ownPops++
  history.go(-n)
  // Si el navegador no llegara a avisar, que nada se quede esperando para siempre
  timers.push(window.setTimeout(() => ownPops && ownPopDone(), 1000))
}

function onPopState() {
  if (ownPops) return ownPopDone()
  // Atrás (o adelante) del sistema: las ventanas cuya entrada ya no está, de arriba abajo
  const depth = depthNow()
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i]
    if (l.depth <= depth) break
    if (!l.onBack()) {
      history.pushState({ capa: l.depth }, '')
      break
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', onPopState)
  // Recargar con una ventana abierta deja su entrada en el historial: se vuelve a la de la pantalla
  // (si no, luego haría falta pulsar Atrás una vez de más sin que pase nada)
  popTo(0)
}

export interface LayerHandle {
  /** Quita la entrada de la ventana (al cerrarla con un botón). Se puede llamar varias veces. */
  release: () => void
  /** ¿Es la ventana de más arriba? Solo esa responde a Escape. */
  isTop: () => boolean
}

/** Una ventana se abre: añade su entrada al historial. */
export function openLayer(onBack: () => boolean): LayerHandle {
  const below = layers[layers.length - 1]
  const layer: Layer = { depth: (below ? below.depth : depthNow()) + 1, onBack }
  layers.push(layer)
  settle(() => {
    if (!layers.includes(layer)) return
    // Encima de la entrada en la que estemos de verdad (puede que acabe de quitarse otra ventana)
    layer.depth = depthNow() + 1
    history.pushState({ capa: layer.depth }, '')
  })
  return {
    release: () => {
      const i = layers.indexOf(layer)
      if (i < 0) return
      layers.splice(i, 1)
      settle(() => {
        if (depthNow() >= layer.depth) popTo(layer.depth - 1)
      })
    },
    isTop: () => layers[layers.length - 1] === layer,
  }
}

/**
 * Quita del historial las entradas de las ventanas y luego hace `fn` (p. ej. recargar):
 * tras recargar, volver a una entrada de antes cargaría la página otra vez.
 */
export function leaveLayers(fn: () => void) {
  settle(() => {
    popTo(0)
    settle(fn)
  })
}

/** Cuántas ventanas hay abiertas (con una abierta no se actualiza la app sola). */
export function openLayers(): number {
  return layers.length
}
