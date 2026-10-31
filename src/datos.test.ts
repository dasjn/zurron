// Tests de los datos: guardado en el móvil, copias, contenido de la mesa,
// puesta al día de fichas viejas y rutas raras. Solo con el SRD y con fichas
// de prueba inventadas. localStorage y window son de mentira (el entorno es node).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Character } from './model/character'
import { Rules, type RuleBook } from './rules/book'
import { derive } from './rules/derive'
import { migrate, safeColor, safePortrait } from './migrate'
import { checkMesa, describeMesa } from './mesa'
import { parseBackup } from './backup'
import { href, parse } from './router'

const DATA = resolve(__dirname, 'data/srd')
const json = (name: string) => JSON.parse(readFileSync(resolve(DATA, name), 'utf8'))

function srdRules(): Rules {
  const book: RuleBook = {
    classes: json('classes.json'),
    subclasses: json('subclasses.json'),
    species: json('species.json'),
    backgrounds: json('backgrounds.json'),
    feats: json('feats.json'),
    spells: json('spells.json'),
    weapons: json('weapons.json'),
    armor: json('armor.json'),
    masteries: json('masteries.json'),
    weaponProperties: json('weapon-properties.json'),
    glossary: json('glossary.json'),
    gear: json('gear.json'),
    slots: json('spell-slots.json'),
  }
  return new Rules(book)
}
const rules = srdRules()

/** Una ficha de prueba completa (guerrero humano de nivel 1). */
function sample(id = 'prueba', name = 'Prueba'): Character {
  const c = migrate({ id, name, classId: 'guerrero', speciesId: 'humano', backgroundId: 'soldado', level: 1, updatedAt: '2026-01-01T10:00:00.000Z', createdAt: '2026-01-01T10:00:00.000Z' })!
  c.state.hp = derive(c, rules).maxHp
  return c
}

/* ---------- localStorage y window de mentira ---------- */

class MemoryStorage {
  data = new Map<string, string>()
  /** Caracteres que caben (claves y valores), como el límite del navegador. */
  limit: number
  constructor(limit = Infinity) {
    this.limit = limit
  }
  get length() {
    return this.data.size
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null
  }
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null
  }
  setItem(k: string, v: string) {
    const used = [...this.data].reduce((n, [a, b]) => n + (a === k ? 0 : a.length + b.length), 0)
    if (used + k.length + v.length > this.limit) {
      const e = new Error('lleno')
      e.name = 'QuotaExceededError'
      throw e
    }
    this.data.set(k, String(v))
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
  clear() {
    this.data.clear()
  }
}

let storage: MemoryStorage
let handlers: Record<string, ((e: unknown) => void)[]>

function stubBrowser(s = new MemoryStorage()) {
  storage = s
  handlers = {}
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('window', { addEventListener: (t: string, f: (e: unknown) => void) => (handlers[t] ??= []).push(f) })
}

/** Carga store.ts de cero (lee el localStorage de mentira al importarse). */
async function freshStore() {
  vi.resetModules()
  return import('./store')
}

/** Lo que vería la otra pestaña: otra pestaña escribe y aquí llega el evento «storage». */
function fromOtherTab(key: string, value: string | null) {
  if (value === null) storage.removeItem(key)
  else storage.setItem(key, value)
  for (const f of handlers.storage ?? []) f({ key, newValue: value, storageArea: storage })
}

beforeEach(() => stubBrowser())
afterEach(() => vi.unstubAllGlobals())

/* ---------- migrate() ---------- */

describe('migrate', () => {
  it('rellena una ficha a medias y el motor la calcula sin romperse', () => {
    const c = migrate({ id: 'vieja', name: 'Vieja', classId: 'guerrero', speciesId: 'humano', level: 2 })!
    expect(c).toBeDefined()
    for (const k of ['skills', 'expertise', 'tools', 'languages', 'feats', 'weaponMasteries', 'equipment', 'customFeatures', 'guide', 'notes', 'history', 'hpRolls'] as const) expect(Array.isArray(c[k])).toBe(true)
    expect(c.spells).toEqual({ cantrips: [], prepared: [], extra: [] })
    expect(c.baseScores).toEqual({ fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 })
    expect(c.state.deathSaves).toEqual({ success: 0, fail: 0 })
    expect(c.persona).toEqual({})
    expect(() => derive(c, rules)).not.toThrow()
  })

  it('cambia lo que tiene un tipo raro y respeta lo que está bien', () => {
    const c = migrate({
      id: 'rara',
      name: 'Rara',
      level: 99,
      skills: 'sigilo',
      expertise: ['sigilo', 3],
      choices: { a: ['x', 1], b: 'no' },
      coins: { po: '12', pp: 5 },
      state: { hp: 7, exhaustion: 9, conditions: ['derribado'], toggles: { x: true, y: 'no' } },
      notes: [{ id: 'n1', title: 'Hola', body: 'texto', date: '2026-03-04' }, { title: 'sin id' }],
      overrides: { speed: '10,5', ac: 15 },
    })!
    expect(c.level).toBe(20)
    expect(c.skills).toEqual([])
    expect(c.expertise).toEqual(['sigilo'])
    expect(c.choices).toEqual({ a: ['x'] })
    expect(c.coins).toEqual({ pc: 0, pp: 5, pe: 0, po: 0, ppt: 0 })
    expect(c.state.hp).toBe(7)
    expect(c.state.exhaustion).toBe(6)
    expect(c.state.toggles).toEqual({ x: true })
    expect(c.notes).toHaveLength(1)
    expect(c.overrides.speed).toBeUndefined()
    expect(c.overrides.ac).toBe(15)
  })

  it('sin PG actuales empieza con los máximos si se le dan las reglas', () => {
    const c = migrate({ id: 'pg', name: 'PG', classId: 'guerrero', speciesId: 'humano', level: 1 }, { maxHp: (x) => derive(x, rules).maxHp })!
    expect(c.state.hp).toBeGreaterThan(0)
    expect(c.state.hp).toBe(derive(c, rules).maxHp)
  })

  it('pone al día también las copias de antes de subir de nivel', () => {
    const c = migrate({ id: 'h', name: 'H', level: 2, history: [{ date: '2026-01-02', fromLevel: 1, toLevel: 2, snapshot: { id: 'h', name: 'H', level: 1 } }, { fromLevel: 1 }] })!
    expect(c.history).toHaveLength(1)
    expect(c.history[0].snapshot.spells.cantrips).toEqual([])
  })

  it('rechaza lo que no es una ficha y lo de una versión más nueva', () => {
    expect(migrate(null)).toBeUndefined()
    expect(migrate({ name: 'Sin id' })).toBeUndefined()
    expect(migrate({ id: 'x' })).toBeUndefined()
    expect(migrate({ id: 'x', name: 'X', schema: 99 })).toBeUndefined()
  })

  it('no deja pasar retratos ni colores de fuera', () => {
    const c = migrate({ id: 'l', name: 'L', look: { portrait: 'https://ejemplo.invalid/pixel.png', palette: { light: {}, dark: { accent: 'url(https://ejemplo.invalid/x)', 'accent-soft': '#2e2417' } } } })!
    expect(c.look?.portrait).toBeUndefined()
    expect(c.look?.palette?.dark).toEqual({ 'accent-soft': '#2e2417' })
    expect(safePortrait('data:image/svg+xml;base64,PHN2Zz4=')).toBeUndefined()
    expect(safePortrait('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBeDefined()
    expect(safeColor('#abc')).toBe('#abc')
    expect(safeColor('red; background: url(x)')).toBeUndefined()
  })

  it('una clave «__proto__» del archivo no cambia nada', () => {
    const c = migrate(JSON.parse('{"id":"p","name":"P","__proto__":{"level":7},"choices":{"__proto__":["x"]}}'))!
    expect(c.level).toBe(1)
    expect(Object.getPrototypeOf(c.choices)).toBe(Object.prototype)
    expect(c.choices).toEqual({})
  })
})

/* ---------- Copias ---------- */

const file = (o: unknown) => JSON.stringify(o)
const backup = (characters: unknown, extra: object = {}) => file({ app: 'ficha-viva', version: 1, exportedAt: '2026-01-01T00:00:00Z', characters, ...extra })

describe('leer una copia', () => {
  it('lee una copia normal y la pone al día', () => {
    const r = parseBackup(backup([{ id: 'a', name: 'A', schema: 1 }]), rules)
    expect(r.characters.map((c) => c.id)).toEqual(['a'])
    expect(r.characters[0].spells.prepared).toEqual([])
    expect(r.warnings).toEqual([])
  })

  it('explica en castellano que no es JSON', () => {
    expect(() => parseBackup('{ esto no es json')).toThrow(/no es una copia de Zurrón/)
  })

  it('rechaza «characters» que no es una lista, con un mensaje claro', () => {
    expect(() => parseBackup(file({ app: 'ficha-viva', version: 1, characters: { a: 1 } }))).toThrow(/no trae la lista de fichas/)
    expect(() => parseBackup(file({ app: 'ficha-viva', version: 1 }))).toThrow(/no trae la lista de fichas/)
  })

  it('rechaza una copia de una versión más nueva', () => {
    expect(() => parseBackup(file({ app: 'ficha-viva', version: 2, characters: [] }))).toThrow(/versión más nueva/)
    expect(() => parseBackup(backup([{ id: 'n', name: 'N', schema: 5 }]))).toThrow(/versión más nueva/)
  })

  it('avisa de ids repetidos y se queda con la ficha cambiada más tarde', () => {
    const r = parseBackup(
      backup([
        { id: 'a', name: 'A vieja', updatedAt: '2026-01-01T00:00:00Z' },
        { id: 'a', name: 'A nueva', updatedAt: '2026-02-01T00:00:00Z' },
        { id: 'b', name: 'B' },
      ]),
    )
    expect(r.characters.map((c) => c.name)).toEqual(['A nueva', 'B'])
    expect(r.warnings.join(' ')).toMatch(/varias veces la ficha de A nueva/)
  })

  it('cuenta las fichas dañadas y las de otra versión sin tirar la copia', () => {
    const r = parseBackup(backup([{ id: 'a', name: 'A' }, { nombre: 'rota' }, { id: 'z', name: 'Z', schema: 9 }]))
    expect(r.characters).toHaveLength(1)
    expect(r.warnings.join(' ')).toMatch(/dañada/)
    expect(r.warnings.join(' ')).toMatch(/versión más nueva/)
  })

  it('una ficha suelta (sin envoltorio de copia) también vale', () => {
    expect(parseBackup(file({ id: 'suelta', name: 'Suelta' })).characters[0].id).toBe('suelta')
  })

  it('el contenido de la mesa incompleto se rechaza y se avisa', () => {
    const r = parseBackup(backup([{ id: 'a', name: 'A' }], { mesa: { spells: [{ id: 'conjuro-raro', name: 'Conjuro raro', level: 1 }] } }))
    expect(r.mesa).toEqual({})
    expect(r.warnings.join(' ')).toMatch(/incompleta/)
  })
})

/* ---------- Contenido de la mesa ---------- */

describe('contenido de la mesa', () => {
  const spell = { id: 'chispa-de-prueba', name: 'Chispa de prueba', level: 0, school: 'Evocación', classes: ['mago'], castingTime: 'Acción', range: '18 m', components: 'V, S', duration: 'Instantánea', text: 'Una chispa.' }
  const background = { id: 'trasfondo-de-prueba', name: 'Trasfondo de prueba', abilities: ['fue', 'des', 'con'], feat: { id: 'alerta' }, skills: ['atletismo', 'percepcion'], tool: 'Un juego', equipment: [] }

  it('acepta lo completo, rellena lo opcional y lo marca como de la mesa', () => {
    const { pack, rejected } = checkMesa({ spells: [spell], backgrounds: [background] })
    expect(rejected).toBe(0)
    expect(pack.spells?.[0]).toMatchObject({ id: spell.id, source: 'mesa', concentration: false, ritual: false })
    expect(pack.backgrounds?.[0]).toMatchObject({ source: 'mesa' })
    expect(describeMesa(pack)).toBe('1 trasfondo y 1 conjuro')
  })

  it('rechaza un conjuro sin escuela, tiempo o clases (rompía Reglas › Conjuros)', () => {
    const { school: _s, ...noSchool } = spell
    const { castingTime: _t, ...noTime } = spell
    const { pack, rejected } = checkMesa({ spells: [noSchool, noTime, { ...spell, classes: 'mago' }] })
    expect(rejected).toBe(3)
    expect(pack.spells).toBeUndefined()
  })

  it('rechaza un trasfondo sin dote y entradas sin id o nombre', () => {
    const { rejected } = checkMesa({ backgrounds: [{ ...background, feat: {} }, { name: 'Sin id' }, { id: 'sin-nombre' }] })
    expect(rejected).toBe(3)
  })

  it('rechaza una subclase con rasgos mal formados', () => {
    const { rejected } = checkMesa({ subclasses: [{ id: 's', name: 'S', classId: 'mago', features: [{ id: 'r', name: 'R' }] }] })
    expect(rejected).toBe(1)
  })
})

/* ---------- Rutas ---------- */

describe('rutas', () => {
  it('un «%» suelto en la dirección no rompe el arranque', () => {
    expect(() => parse('#/p/%E0%A4%A/estado')).not.toThrow()
    expect(parse('#/p/%E0%A4%A/estado')).toEqual({ name: 'sheet', id: '%E0%A4%A', tab: 'estado' })
    expect(() => parse('#/reglas/conjuros?q=%')).not.toThrow()
  })

  it('ids con nombres de Object se tratan como cualquier otro', () => {
    expect(parse('#/p/constructor/estado')).toEqual({ name: 'sheet', id: 'constructor', tab: 'estado' })
    expect(parse(href({ name: 'sheet', id: 'á b/c', tab: 'notas' }))).toEqual({ name: 'sheet', id: 'á b/c', tab: 'notas' })
  })
})

/* ---------- Guardado en el móvil ---------- */

describe('guardado', () => {
  it('una ficha por clave, y guardar una ficha solo escribe esa', async () => {
    const store = await freshStore()
    store.saveCharacter(sample('a', 'A'))
    store.saveCharacter(sample('b', 'B'))
    expect(storage.getItem('fichaviva:fichas')).toBe('["a","b"]')
    expect(JSON.parse(storage.getItem('fichaviva:ficha:a')!).name).toBe('A')
    const spy = vi.spyOn(storage, 'setItem')
    const a = store.getCharacter('a')!
    expect(store.saveCharacter({ ...a, state: { ...a.state, hp: 1 } })).toBe(true)
    expect(spy.mock.calls.map(([k]) => k)).toEqual(['fichaviva:ficha:a'])
  })

  it('pasa las fichas de «fichaviva:v1» a una clave por ficha', async () => {
    const a = sample('a', 'A')
    const b = sample('b', 'B')
    storage.setItem('fichaviva:v1', file({ characters: { b, a }, order: ['a', 'b'] }))
    const store = await freshStore()
    expect(store.characters().map((c) => c.id)).toEqual(['a', 'b'])
    expect(storage.getItem('fichaviva:v1')).toBeNull()
    expect(storage.getItem('fichaviva:fichas')).toBe('["a","b"]')
    expect(JSON.parse(storage.getItem('fichaviva:ficha:b')!).id).toBe('b')
  })

  it('si no caben las dos copias a la vez, migra igual quitando antes la antigua', async () => {
    const a = { ...sample('a', 'A'), notes: [{ id: 'n', date: '2026-01-01', title: 'Larga', body: 'x'.repeat(20000) }] }
    const old = file({ characters: { a }, order: ['a'] })
    stubBrowser(new MemoryStorage(old.length + 'fichaviva:v1'.length + 2000))
    storage.setItem('fichaviva:v1', old)
    const store = await freshStore()
    expect(store.characters()).toHaveLength(1)
    expect(storage.getItem('fichaviva:v1')).toBeNull()
    expect(storage.getItem('fichaviva:ficha:a')).not.toBeNull()
  })

  it('las fichas viejas incompletas se leen puestas al día', async () => {
    storage.setItem('fichaviva:v1', file({ characters: { v: { id: 'v', name: 'V', classId: 'guerrero', speciesId: 'humano' } }, order: ['v'] }))
    const store = await freshStore()
    const v = store.getCharacter('v')!
    expect(v.spells.extra).toEqual([])
    expect(() => derive(v, rules)).not.toThrow()
  })

  it('un id como «constructor» no se confunde con lo heredado', async () => {
    const store = await freshStore()
    expect(store.getCharacter('constructor')).toBeUndefined()
    expect(store.getCharacter('toString')).toBeUndefined()
    store.saveCharacter(sample('constructor', 'Constructora'))
    expect(store.getCharacter('constructor')?.name).toBe('Constructora')
    expect(store.characters().map((c) => c.id)).toEqual(['constructor'])
    const again = await freshStore()
    expect(again.characters().map((c) => c.name)).toEqual(['Constructora'])
  })

  it('si el móvil no deja guardar, lo dice (y la ficha sigue en memoria)', async () => {
    const store = await freshStore()
    expect(store.saveCharacter(sample('a', 'A'))).toBe(true)
    storage.limit = 0
    const a = store.getCharacter('a')!
    expect(store.saveCharacter({ ...a, name: 'A cambiada' })).toBe(false)
    expect(store.saveProblem()).toBe('lleno')
    expect(store.unsavedCharacters().map((c) => c.name)).toEqual(['A cambiada'])
    expect(store.getCharacter('a')?.name).toBe('A cambiada')
    // Con sitio otra vez, «Reintentar» lo guarda
    storage.limit = Infinity
    expect(store.retrySave()).toBe(true)
    expect(store.saveProblem()).toBeNull()
    expect(JSON.parse(storage.getItem('fichaviva:ficha:a')!).name).toBe('A cambiada')
  })

  it('una ficha enorme que no cabe no impide guardar las demás', async () => {
    const store = await freshStore()
    store.saveCharacter(sample('a', 'A'))
    storage.limit = storage.data.size ? [...storage.data].reduce((n, [k, v]) => n + k.length + v.length, 0) + 30000 : 30000
    const big = { ...sample('grande', 'Grande'), notes: [{ id: 'n', date: '2026-01-01', title: 'x', body: 'x'.repeat(60000) }] }
    expect(store.saveCharacter(big)).toBe(false)
    const a = store.getCharacter('a')!
    expect(store.saveCharacter({ ...a, state: { ...a.state, hp: 2 } })).toBe(true)
    expect(JSON.parse(storage.getItem('fichaviva:ficha:a')!).state.hp).toBe(2)
    expect(store.saveProblem()).toBe('lleno')
  })

  it('se entera de lo que cambia otra pestaña', async () => {
    const store = await freshStore()
    store.saveCharacter(sample('a', 'A'))
    // Sin Preact: basta con ver que los datos cambian
    const a = store.getCharacter('a')!
    fromOtherTab('fichaviva:ficha:a', file({ ...a, state: { ...a.state, hp: 3 } }))
    expect(store.getCharacter('a')?.state.hp).toBe(3)
    fromOtherTab('fichaviva:ficha:b', file(sample('b', 'B')))
    fromOtherTab('fichaviva:fichas', '["a","b"]')
    expect(store.characters().map((c) => c.id)).toEqual(['a', 'b'])
    fromOtherTab('fichaviva:ficha:a', null)
    fromOtherTab('fichaviva:fichas', '["b"]')
    expect(store.characters().map((c) => c.id)).toEqual(['b'])
  })

  it('si una pestaña con la versión anterior escribe en la clave antigua, se mezcla lo más reciente', async () => {
    const store = await freshStore()
    const a = sample('a', 'A')
    store.saveCharacter(a)
    const newer = { ...a, name: 'A desde la versión vieja', updatedAt: '2030-01-01T00:00:00.000Z' }
    fromOtherTab('fichaviva:v1', file({ characters: { a: newer }, order: ['a'] }))
    expect(store.getCharacter('a')?.name).toBe('A desde la versión vieja')
    expect(storage.getItem('fichaviva:v1')).toBeNull()
  })
})
