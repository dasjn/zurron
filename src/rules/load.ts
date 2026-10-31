// Carga los datos de reglas (SRD + mesa) y las fichas del grupo. Cada JSON
// es un trozo aparte que el service worker deja guardado para usar sin red.
// src/data/mesa y src/data/party no se publican: si no están, la app arranca
// solo con el SRD y el contenido de la mesa llega con las copias (mesa.ts).

import type { Character, Look } from '../model/character'
import type { RuleBook, SlotTables } from './book'
import { Rules } from './book'
import { storedMesa, type MesaList } from '../mesa'

type Loader = () => Promise<unknown>
const srd = import.meta.glob<unknown>('../data/srd/*.json', { import: 'default' })
const mesa = import.meta.glob<unknown>('../data/mesa/*.json', { import: 'default' })
// expected.json son las cifras de las fichas antiguas para los tests: no va en la app.
const party = import.meta.glob<unknown>(['../data/party/*.json', '!../data/party/expected.json'], { import: 'default' })

async function file(map: Record<string, Loader>, name: string): Promise<unknown> {
  const key = Object.keys(map).find((p) => p.endsWith(`/${name}`))
  return key ? map[key]() : undefined
}

async function list<T extends { id: string }>(key: string, name: string): Promise<T[]> {
  const [a, b] = await Promise.all([file(srd, name), file(mesa, name)])
  const own = (storedMesa()[key as MesaList] ?? []) as unknown as T[]
  const out = [...((a as T[] | undefined) ?? []), ...((b as T[] | undefined) ?? [])]
  // Lo de la copia no pisa lo que ya viene con la app.
  const seen = new Set(out.map((x) => x.id))
  return [...out, ...own.filter((x) => !seen.has(x.id))]
}

const LISTS = {
  classes: 'classes.json',
  subclasses: 'subclasses.json',
  species: 'species.json',
  backgrounds: 'backgrounds.json',
  feats: 'feats.json',
  spells: 'spells.json',
  weapons: 'weapons.json',
  armor: 'armor.json',
  masteries: 'masteries.json',
  weaponProperties: 'weapon-properties.json',
  glossary: 'glossary.json',
  gear: 'gear.json',
} as const

export async function loadRules(): Promise<Rules> {
  const entries = await Promise.all(Object.entries(LISTS).map(async ([k, f]) => [k, await list(k, f)] as const))
  const slots = (await file(srd, 'spell-slots.json')) as SlotTables
  const book = { ...Object.fromEntries(entries), slots } as RuleBook
  return new Rules(book)
}

/** Fichas del grupo que vienen con la app (plantillas para el primer uso). */
export async function loadParty(): Promise<Character[]> {
  const looks = ((await file(party, 'looks.json')) ?? {}) as Record<string, Look>
  const out: Character[] = []
  for (const [path, load] of Object.entries(party)) {
    if (path.endsWith('/looks.json')) continue
    const c = (await load()) as Character
    out.push({ ...c, look: { ...looks[c.id], ...c.look } })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}
