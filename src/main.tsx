import { render } from 'preact'
import { registerSW } from 'virtual:pwa-register'
import './styles.css'
import { App, offerUpdate } from './app'
import { leaveLayers, openLayers, parse } from './router'
import { characters, crashedSheet } from './store'

// Cada jugador suele tener una sola ficha en su móvil: si es así, se abre directamente
// (salvo que la última vez esa ficha rompiera la pantalla: entonces, al inicio).
const mine = characters()
if (!location.hash && mine.length === 1 && crashedSheet() !== mine[0].id) history.replaceState(null, '', `#/p/${encodeURIComponent(mine[0].id)}/estado`)

render(<App />, document.getElementById('app')!)

/* ---------- Versiones nuevas ---------- */

// La app nueva se descarga sola con conexión, pero no se pone sin más: recargar a
// mitad de una nota la perdería. Se ofrece «Actualizar» y, si nadie lo toca, se
// pone sola cuando es seguro: la app está en segundo plano y no hay ninguna
// ventana ni asistente abierto. Sin conexión se usa la copia guardada.

/** ¿Se puede recargar sin perder nada? */
function safeNow() {
  const r = parse(location.hash).name
  return document.visibilityState === 'hidden' && openLayers() === 0 && r !== 'create' && r !== 'levelup'
}

/** Lo que pone la versión nueva, si hay una pendiente. */
let apply: (() => void) | null = null
/** «Actualizar» tocado (o puesta sola): al cambiar de versión, se recarga sin preguntar. */
let wanted = false
let swapped = false

function pending(fn: () => void) {
  apply = fn
  offerUpdate(fn)
  if (safeNow()) fn()
}

/** La versión nueva ya manda en esta pestaña (se pidió aquí o en otra): toca recargar, cuando se pueda. */
function onSwap() {
  if (swapped) return
  swapped = true
  // Antes, fuera del historial las ventanas abiertas (la nota a medias tiene su borrador)
  if (wanted || safeNow()) leaveLayers(() => location.reload())
  else pending(() => leaveLayers(() => location.reload()))
}

// Se vigila el cambio de versión directamente: workbox solo lo cuenta en páginas que ya
// dependían de la caché al abrirse, y en la primera sesión no es así.
let controller = navigator.serviceWorker?.controller ?? null
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  const was = controller
  controller = navigator.serviceWorker.controller
  // La primera vez solo empieza a depender de la caché: eso no es una versión nueva
  if (was || wanted) onSwap()
})

const updateSW = registerSW({
  immediate: true,
  // Hay una versión nueva esperando
  onNeedRefresh() {
    pending(() => {
      wanted = true
      leaveLayers(() => {
        updateSW(true)
        // Por si el navegador no llegara a avisar del cambio
        setTimeout(() => location.reload(), 6000)
      })
    })
  },
  // Sin esto, la app recargaría sin preguntar
  onNeedReload: onSwap,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    // Una app que se deja abierta días también se entera: al volver a ella, mira si hay versión nueva
    let last = Date.now()
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 60 * 60 * 1000) return
      last = Date.now()
      reg.update().catch(() => {})
    })
  },
})

// Al pasar a segundo plano con una versión nueva pendiente, se pone si es seguro
document.addEventListener('visibilitychange', () => {
  if (apply && safeNow()) apply()
})
