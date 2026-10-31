// Guardado en el propio móvil (localStorage). Cada cambio se guarda al momento,
// cada ficha en su propia clave: una ficha grande (con retrato) no impide
// guardar las demás, y cada toque escribe solo la ficha que cambia.
// Si el móvil no deja guardar (sin espacio, modo privado), no se calla: la app
// muestra un aviso fijo que pide exportar una copia (app.tsx) hasta que se pueda.
// Otra pestaña (la app instalada y el navegador a la vez) se entera de los
// cambios por el evento «storage». Las copias de seguridad están en backup.ts.

import { useEffect, useState } from 'preact/hooks'
import { CHARACTER_SCHEMA, type Character } from './model/character'
import { migrate } from './migrate'

/** Formato antiguo: todas las fichas en una sola clave. Se sigue leyendo para pasarlo al nuevo. */
const OLD_KEY = 'fichaviva:v1'
/** Orden de las fichas en el inicio: lista de ids. */
const ORDER_KEY = 'fichaviva:fichas'
/** Una clave por ficha: «fichaviva:ficha:<id>». */
const PREFIX = 'fichaviva:ficha:'

/** Por qué no se ha podido guardar: sin espacio, o el navegador no deja (modo privado, bloqueado). */
export type SaveProblem = 'lleno' | 'bloqueado'

// Un Map y no un objeto: un id como «constructor» no puede tropezar con lo heredado.
let byId = new Map<string, Character>()
let order: string[] = []
/** Fichas cuyo último cambio no ha llegado a guardarse (se reintenta en cada cambio). */
const unsaved = new Set<string>()
let orderUnsaved = false
let problem: SaveProblem | null = null
/** El paso al formato nuevo no cupo: se sigue guardando todo junto en la clave antigua. */
let legacy = false
const listeners = new Set<() => void>()

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage ?? undefined
  } catch {
    // con las cookies bloqueadas, solo mirar localStorage ya falla
    return undefined
  }
}

function kindOf(e: unknown): SaveProblem {
  const name = (e as { name?: string })?.name ?? ''
  const code = (e as { code?: number })?.code
  return /quota/i.test(name) || code === 22 || code === 1014 ? 'lleno' : 'bloqueado'
}

const parse = (raw: string | null): unknown => {
  if (raw === null) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}
const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const ids = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [])

/** Ficha de la clave antigua: { characters: { id: ficha }, order: [ids] }. */
function readOld(raw: string | null): Character[] {
  const s = parse(raw) as { characters?: unknown; order?: unknown } | undefined
  if (!s || typeof s.characters !== 'object' || !s.characters) return []
  const all = s.characters as Record<string, unknown>
  const keys = [...new Set([...ids(s.order), ...Object.keys(all)])].filter((id) => hasOwn(all, id))
  return keys.map((id) => migrate(all[id])).filter((c): c is Character => !!c)
}

/** Lee del móvil una ficha guardada con clave propia (solo si la clave y el id coinciden). */
function readOne(s: Storage, id: string): Character | undefined {
  const c = migrate(parse(s.getItem(PREFIX + id)))
  return c && c.id === id ? c : undefined
}

function load() {
  byId = new Map()
  order = []
  legacy = false
  const s = storage()
  if (!s) return
  try {
    const oldRaw = s.getItem(OLD_KEY)
    const orderRaw = s.getItem(ORDER_KEY)
    if (orderRaw === null && oldRaw !== null) return moveOld(s, oldRaw)
    // Las de la lista, en su orden, y luego las que tengan clave pero no llegaran a la lista
    const listed = ids(parse(orderRaw))
    const keyed: string[] = []
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i)
      if (k?.startsWith(PREFIX)) keyed.push(k.slice(PREFIX.length))
    }
    for (const id of new Set([...listed, ...keyed])) {
      const c = readOne(s, id)
      if (c) byId.set(id, c)
    }
    order = [...byId.keys()]
    // Ya migrado, pero una pestaña con la versión anterior de la app ha vuelto a escribir en la clave antigua
    if (oldRaw !== null) mergeOld(s, oldRaw)
  } catch {
    // almacenamiento bloqueado: empezamos vacío y el aviso saldrá al primer cambio
  }
}

/** Pasa las fichas de la clave antigua a una clave por ficha. Si no cabe, todo sigue como estaba. */
function moveOld(s: Storage, oldRaw: string) {
  const list = readOld(oldRaw)
  for (const c of list) byId.set(c.id, c)
  order = list.map((c) => c.id)
  const writeAll = () => {
    for (const c of list) s.setItem(PREFIX + c.id, JSON.stringify(c))
    s.setItem(ORDER_KEY, JSON.stringify(order))
  }
  const undo = () => {
    for (const c of list) s.removeItem(PREFIX + c.id)
    s.removeItem(ORDER_KEY)
  }
  try {
    writeAll()
    s.removeItem(OLD_KEY)
    return
  } catch {
    // no caben las dos copias a la vez: se quita la antigua y se prueba otra vez
  }
  try {
    undo()
    s.removeItem(OLD_KEY)
    writeAll()
  } catch {
    // ni así: se deja exactamente lo que había (cabía) y se sigue con el formato antiguo
    try {
      undo()
      s.setItem(OLD_KEY, oldRaw)
    } catch {
      // nada más que hacer; las fichas siguen en memoria y el aviso pedirá exportar
    }
    legacy = true
  }
}

/** Mezcla lo que haya en la clave antigua: gana el cambio más reciente de cada ficha. */
function mergeOld(s: Storage, oldRaw: string) {
  const changed: string[] = []
  for (const c of readOld(oldRaw)) {
    const mine = byId.get(c.id)
    if (mine && mine.updatedAt >= c.updatedAt) continue
    byId.set(c.id, c)
    if (!order.includes(c.id)) order.push(c.id)
    changed.push(c.id)
  }
  if (persist(changed, changed.length > 0)) {
    try {
      s.removeItem(OLD_KEY)
    } catch {
      // se volverá a mezclar la próxima vez
    }
  }
}

/** Escribe en el móvil las fichas indicadas (y las que quedaran pendientes). true si todo ha ido bien. */
function persist(changedIds: string[], orderChanged: boolean): boolean {
  const s = storage()
  const pending = new Set([...unsaved, ...changedIds])
  if (orderChanged) orderUnsaved = true
  if (!s) {
    for (const id of pending) unsaved.add(id)
    problem = 'bloqueado'
    return false
  }
  if (legacy) {
    try {
      const characters: Record<string, Character> = {}
      for (const id of order) characters[id] = byId.get(id)!
      s.setItem(OLD_KEY, JSON.stringify({ characters, order }))
      unsaved.clear()
      orderUnsaved = false
    } catch (e) {
      for (const id of pending) unsaved.add(id)
      problem = kindOf(e)
    }
  } else {
    for (const id of pending) {
      const c = byId.get(id)
      try {
        if (c) s.setItem(PREFIX + id, JSON.stringify(c))
        else s.removeItem(PREFIX + id)
        unsaved.delete(id)
      } catch (e) {
        unsaved.add(id)
        problem = kindOf(e)
      }
    }
    if (orderUnsaved) {
      try {
        s.setItem(ORDER_KEY, JSON.stringify(order))
        orderUnsaved = false
      } catch (e) {
        problem = kindOf(e)
      }
    }
  }
  // La lista del orden se puede rehacer leyendo las claves: si solo falla ella, no se pierde nada
  if (!unsaved.size) problem = null
  askPersist()
  return !unsaved.size
}

let persistAsked = false
function askPersist() {
  if (persistAsked) return
  persistAsked = true
  // Pide al navegador que no borre los datos por falta de espacio.
  globalThis.navigator?.storage?.persist?.().catch(() => {})
}

function notify() {
  for (const l of listeners) l()
}

load()

/* ---------- Otra pestaña ha cambiado algo ---------- */

function onStorage(e: StorageEvent) {
  const s = storage()
  if (!s || (e.storageArea && e.storageArea !== s)) return
  if (e.key === null) load()
  else if (e.key === ORDER_KEY) {
    const listed = ids(parse(e.newValue))
    for (const id of listed) if (!byId.has(id)) {
      const c = readOne(s, id)
      if (c) byId.set(id, c)
    }
    // Las que no están en la lista nueva pero siguen guardadas (o pendientes aquí) no se pierden
    order = [...new Set([...listed.filter((id) => byId.has(id)), ...order.filter((id) => byId.has(id))])]
  } else if (e.key.startsWith(PREFIX)) {
    const id = e.key.slice(PREFIX.length)
    unsaved.delete(id)
    if (e.newValue === null) {
      byId.delete(id)
      order = order.filter((x) => x !== id)
    } else {
      const c = migrate(parse(e.newValue))
      if (!c || c.id !== id) return
      byId.set(id, c)
      if (!order.includes(id)) order.push(id)
    }
  } else if (e.key === OLD_KEY && e.newValue !== null && !legacy) mergeOld(s, e.newValue)
  else if (e.key === OLD_KEY && legacy) load()
  else return
  if (!unsaved.size) problem = null
  notify()
}

if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)

/* ---------- Lo que usa la app ---------- */

export function characters(): Character[] {
  return order.map((id) => byId.get(id)).filter((c): c is Character => !!c)
}

export function getCharacter(id: string): Character | undefined {
  return byId.get(id)
}

/**
 * Guarda la ficha. Devuelve false si no ha llegado al móvil: entonces sigue en
 * memoria (se puede exportar) y `saveProblem()` dice por qué.
 */
export function saveCharacter(c: Character): boolean {
  const isNew = !byId.has(c.id)
  byId.set(c.id, { ...c, schema: CHARACTER_SCHEMA })
  if (isNew) order = [...order, c.id]
  persist([c.id], isNew)
  notify()
  return !unsaved.has(c.id)
}

export function deleteCharacter(id: string): boolean {
  byId.delete(id)
  order = order.filter((x) => x !== id)
  const ok = persist([id], true)
  notify()
  return ok
}

/** Si el último guardado ha fallado, por qué. null si todo está guardado. */
export function saveProblem(): SaveProblem | null {
  return problem
}

/** Fichas con cambios que no han llegado al móvil. */
export function unsavedCharacters(): Character[] {
  return [...unsaved].map((id) => byId.get(id)).filter((c): c is Character => !!c)
}

/** Vuelve a intentar guardar lo pendiente (tras hacer sitio). true si ya está todo guardado. */
export function retrySave(): boolean {
  const ok = persist([], false)
  notify()
  return ok
}

/** Re-renderiza el componente cuando cambia cualquier ficha (aquí o en otra pestaña). */
export function useStore() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const l = () => setTick((t) => t + 1)
    listeners.add(l)
    return () => listeners.delete(l)
  }, [])
}

/* ---------- Ficha que rompió la pantalla ---------- */

// Si una ficha rompe la pantalla, al volver a abrir la app no se abre sola:
// sin barra de direcciones (app instalada) sería un callejón sin salida.
const CRASH_KEY = 'fichaviva:fallo'

/** Id de la ficha que falló la última vez que se abrió, si alguna. */
export function crashedSheet(): string | undefined {
  try {
    return storage()?.getItem(CRASH_KEY) ?? undefined
  } catch {
    return undefined
  }
}

/** Apunta (o borra, con null) la ficha que ha roto la pantalla. */
export function markCrash(id: string | null) {
  try {
    if (id) storage()?.setItem(CRASH_KEY, id)
    else if (crashedSheet()) storage()?.removeItem(CRASH_KEY)
  } catch {
    // sin almacenamiento: solo se pierde la marca
  }
}
