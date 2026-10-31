// Contenido propio de la mesa: trasfondos, dotes o subclases de otros libros
// que no están en el SRD. No viene con la app publicada: llega dentro de una
// copia de seguridad y se guarda en este móvil, junto a las fichas. Desde el
// inicio se puede quitar.

import type { RuleBook } from './rules/book'

const KEY = 'fichaviva:mesa'

/** Las listas del libro que admiten contenido propio. */
export const MESA_LISTS = ['classes', 'subclasses', 'species', 'backgrounds', 'feats', 'spells', 'weapons', 'armor', 'gear'] as const
export type MesaList = (typeof MESA_LISTS)[number]
export type MesaPack = Partial<Record<MesaList, { id: string; name: string }[]>>

/** Nombre de cada lista para los textos: [una, varias]. */
export const MESA_NAMES: Record<MesaList, [string, string]> = {
  classes: ['clase', 'clases'],
  subclasses: ['subclase', 'subclases'],
  species: ['especie', 'especies'],
  backgrounds: ['trasfondo', 'trasfondos'],
  feats: ['dote', 'dotes'],
  spells: ['conjuro', 'conjuros'],
  weapons: ['arma', 'armas'],
  armor: ['armadura', 'armaduras'],
  gear: ['objeto', 'objetos'],
}

const listeners = new Set<() => void>()

let current: MesaPack = read()

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage ?? undefined
  } catch {
    return undefined
  }
}

function read(): MesaPack {
  try {
    const raw = storage()?.getItem(KEY)
    if (raw) return clean(JSON.parse(raw))
  } catch {
    // almacenamiento bloqueado o JSON roto: sin contenido propio
  }
  return {}
}

export function storedMesa(): MesaPack {
  return current
}

/* ---------- Qué tiene que traer cada cosa ---------- */

// s = texto, n = número, b = sí/no, a = lista, sa = lista de textos, o = objeto,
// rasgos = lista de rasgos (id, nombre, nivel y texto), n? = número o null
type Kind = 's' | 'n' | 'b' | 'a' | 'sa' | 'o' | 'rasgos' | 'n?'
type Spec = { need: Record<string, Kind>; may?: Record<string, Kind>; fill?: Record<string, unknown> }

// Lo que el motor y las pantallas leen sin comprobar: si falta, la entrada se rechaza
// (un conjuro sin escuela rompía Reglas › Conjuros y el editor de conjuros).
const SPECS: Record<MesaList, Spec> = {
  classes: {
    need: { hitDie: 'n', primaryAbilities: 'sa', savingThrows: 'sa', skillChoices: 'o', weaponText: 's', weapons: 'o', armor: 'o', startingEquipment: 'a', columns: 'a', features: 'rasgos', subclassLevel: 'n', subclasses: 'sa' },
    may: { spellcasting: 'o', spellList: 'sa', weaponMastery: 'a', toolText: 's', summary: 's' },
  },
  subclasses: { need: { classId: 's', features: 'rasgos' }, may: { text: 's', alwaysPrepared: 'a', summary: 's' } },
  species: { need: { sizes: 'sa', speed: 'n', traits: 'rasgos' }, may: { darkvision: 'n', choices: 'a', summary: 's', creatureType: 's', sizeText: 's' }, fill: { creatureType: 'Humanoide', sizeText: '' } },
  backgrounds: { need: { abilities: 'sa', feat: 'o', skills: 'sa', tool: 's', equipment: 'a' }, may: { text: 's' } },
  feats: { need: { category: 's', text: 's' }, may: { prerequisite: 's', summary: 's', choice: 'o', resources: 'a', abilityIncrease: 'o', repeatable: 'b' } },
  spells: {
    need: { level: 'n', school: 's', classes: 'sa', castingTime: 's', range: 's', components: 's', duration: 's', text: 's' },
    may: { concentration: 'b', ritual: 'b', higherLevels: 's' },
    fill: { concentration: false, ritual: false },
  },
  weapons: { need: { category: 's', kind: 's', damage: 's', damageType: 's', properties: 'sa' }, may: { mastery: 's', weight: 's', cost: 's' }, fill: { mastery: '', weight: '', cost: '' } },
  armor: { need: { category: 's', baseAC: 'n', dexCap: 'n?' }, may: { strength: 'n', stealthDisadvantage: 'b', weight: 's', cost: 's' }, fill: { stealthDisadvantage: false, weight: '', cost: '' } },
  gear: { need: {}, may: { weight: 's', cost: 's', text: 's' }, fill: { weight: '', cost: '' } },
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)

function fits(v: unknown, k: Kind): boolean {
  switch (k) {
    case 's':
      return typeof v === 'string'
    case 'n':
      return typeof v === 'number' && Number.isFinite(v)
    case 'n?':
      return v === null || (typeof v === 'number' && Number.isFinite(v))
    case 'b':
      return typeof v === 'boolean'
    case 'a':
      return Array.isArray(v)
    case 'sa':
      return Array.isArray(v) && v.every((x) => typeof x === 'string')
    case 'o':
      return isObj(v)
    case 'rasgos':
      return Array.isArray(v) && v.every((f) => isObj(f) && typeof f.id === 'string' && typeof f.name === 'string' && typeof f.level === 'number' && typeof f.text === 'string')
  }
}

/** La entrada lista para el libro, o undefined si le falta algo que se usa sin comprobar. */
function checkItem(list: MesaList, x: unknown): { id: string; name: string } | undefined {
  if (!isObj(x) || typeof x.id !== 'string' || !x.id || typeof x.name !== 'string') return undefined
  const spec = SPECS[list]
  for (const [k, kind] of Object.entries(spec.need)) if (!fits(x[k], kind)) return undefined
  for (const [k, kind] of Object.entries(spec.may ?? {})) if (x[k] !== undefined && !fits(x[k], kind)) return undefined
  if (list === 'backgrounds' && typeof (x.feat as { id?: unknown }).id !== 'string') return undefined
  const out: Record<string, unknown> = { ...spec.fill }
  for (const [k, v] of Object.entries(x)) if (k !== '__proto__') out[k] = v
  out.source = 'mesa'
  return out as { id: string; name: string }
}

/** Se queda con las entradas completas y las marca como de la mesa; cuenta las rechazadas. */
export function checkMesa(data: unknown): { pack: MesaPack; rejected: number } {
  const pack: MesaPack = {}
  let rejected = 0
  if (!isObj(data)) return { pack, rejected }
  for (const list of MESA_LISTS) {
    const items = data[list]
    if (!Array.isArray(items)) continue
    const ok: { id: string; name: string }[] = []
    for (const x of items) {
      const item = checkItem(list, x)
      if (item) ok.push(item)
      else rejected++
    }
    if (ok.length) pack[list] = ok
  }
  return { pack, rejected }
}

/** Solo las entradas completas, marcadas como de la mesa. */
export function clean(data: unknown): MesaPack {
  return checkMesa(data).pack
}

/** Cuántas entradas hay en total. */
export function mesaCount(pack: MesaPack): number {
  return MESA_LISTS.reduce((n, l) => n + (pack[l]?.length ?? 0), 0)
}

/** «2 trasfondos y 1 dote». */
export function describeMesa(pack: MesaPack): string {
  const parts = MESA_LISTS.filter((l) => pack[l]?.length).map((l) => {
    const n = pack[l]!.length
    return `${n} ${MESA_NAMES[l][n === 1 ? 0 : 1]}`
  })
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : (parts[0] ?? '')
}

function save(pack: MesaPack): boolean {
  current = pack
  let ok = true
  try {
    const s = storage()
    if (!s) ok = false
    else if (mesaCount(pack)) s.setItem(KEY, JSON.stringify(pack))
    else s.removeItem(KEY)
  } catch {
    // sin espacio o modo privado: vale para esta sesión
    ok = false
  }
  for (const l of listeners) l()
  return ok
}

/**
 * Añade (o actualiza por id) el contenido de una copia y avisa para recargar las reglas.
 * Con `keepExisting`, lo que ya hay en el móvil no se toca (solo entra lo nuevo).
 * Devuelve cuántas entradas han entrado y si se han podido guardar en el móvil.
 */
export function addMesa(pack: MesaPack, opts: { keepExisting?: boolean } = {}): { count: number; saved: boolean } {
  const stored: MesaPack = { ...current }
  let count = 0
  for (const list of MESA_LISTS) {
    const incoming = pack[list]
    if (!incoming?.length) continue
    const byId = new Map((stored[list] ?? []).map((x) => [x.id, x]))
    for (const x of incoming) {
      if (opts.keepExisting && byId.has(x.id)) continue
      byId.set(x.id, x)
      count++
    }
    stored[list] = [...byId.values()]
  }
  if (!count) return { count, saved: true }
  return { count, saved: save(stored) }
}

/** Quita del móvil todo el contenido de la mesa que llegó con las copias. */
export function removeMesa(): boolean {
  return save({})
}

export function onMesaChange(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

// Otra pestaña ha importado o quitado contenido de la mesa
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY && e.key !== null) return
    current = read()
    for (const l of listeners) l()
  })

/** El contenido de la mesa que hay en el libro, para meterlo en una copia. */
export function mesaOf(book: RuleBook): MesaPack {
  const out: MesaPack = {}
  for (const list of MESA_LISTS) {
    const items = (book[list] as { id: string; name: string; source?: string }[]).filter((x) => x.source === 'mesa')
    if (items.length) out[list] = items
  }
  return out
}
