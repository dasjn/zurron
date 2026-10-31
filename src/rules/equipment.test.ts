// Tests del equipo inicial con los datos del SRD: todas las opciones de las
// 12 clases y de los trasfondos, casos comprobados a mano y enlaces (`ref`) de
// armas y armaduras. Lo de la mesa tiene sus tests en src/data/mesa (fuera de git).

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Coins } from '../model/character'
import { Rules, type RuleBook } from './book'
import { parseEquipment, parseEquipmentParts, splitEquipment, type ParsedEquipment } from './equipment'

const DATA = resolve(__dirname, '../data')
const json = (p: string) => JSON.parse(readFileSync(resolve(DATA, p), 'utf8'))
const list = (name: string) => (existsSync(resolve(DATA, 'srd', name)) ? json(`srd/${name}`) : [])

function loadBook(): Rules {
  const book: RuleBook = {
    classes: list('classes.json'),
    subclasses: list('subclasses.json'),
    species: list('species.json'),
    backgrounds: list('backgrounds.json'),
    feats: list('feats.json'),
    spells: list('spells.json'),
    weapons: list('weapons.json'),
    armor: list('armor.json'),
    masteries: list('masteries.json'),
    weaponProperties: list('weapon-properties.json'),
    glossary: list('glossary.json'),
    gear: list('gear.json'),
    slots: json('srd/spell-slots.json'),
  }
  return new Rules(book)
}

const rules = loadBook()

/** Todas las opciones de equipo: "guerrero A", "trasfondo acolito A"... */
const OPTIONS: { key: string; text: string }[] = [
  ...rules.book.classes.flatMap((c) => c.startingEquipment.map((e) => ({ key: `${c.id} ${e.option}`, text: e.text }))),
  ...rules.book.backgrounds.flatMap((b) => b.equipment.map((e) => ({ key: `trasfondo ${b.id} ${e.option}`, text: e.text }))),
]
const textOf = (key: string) => {
  const o = OPTIONS.find((x) => x.key === key)
  if (!o) throw new Error(`No existe la opción ${key}`)
  return o.text
}
const parse = (key: string) => parseEquipment(textOf(key), rules)

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const words = (s: string) => strip(s).split(/[^a-z0-9]+/).filter(Boolean)
/** Raíz tosca e independiente del módulo: "jabalinas" ~ "jabalina", "virotes" ~ "virote". */
const stem = (w: string) => w.replace(/(es|s|e)$/, '')
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'e', 'o', 'u', 'para', 'con', 'a', 'al', 'en'])
const refs = (r: ParsedEquipment) => r.items.filter((i) => i.ref).map((i) => `${i.ref!.kind}:${i.ref!.id}`).sort()
const byName = (r: ParsedEquipment, name: string) => r.items.find((i) => i.name === name)

describe('todas las opciones de equipo', () => {
  it('hay opciones de las 12 clases y de todos los trasfondos', () => {
    expect(rules.book.classes).toHaveLength(12)
    for (const c of rules.book.classes) expect(c.startingEquipment.length, c.id).toBeGreaterThan(0)
    for (const b of rules.book.backgrounds) expect(b.equipment.length, b.id).toBeGreaterThan(0)
  })

  it.each(OPTIONS)('$key: no se pierde texto y los ids son únicos', ({ text }) => {
    // 1. Partir: los trozos están en el texto, en orden, y entre ellos solo hay separadores.
    const frags = splitEquipment(text, rules)
    let at = 0
    for (const f of frags) {
      expect(f.trim(), 'trozo vacío').not.toBe('')
      const i = text.indexOf(f, at)
      expect(i, `«${f}» no está en el texto`).toBeGreaterThanOrEqual(at)
      expect(text.slice(at, i), `se pierde «${text.slice(at, i)}»`).toMatch(/^[\s,;.]*(?:\b(?:y|e)\b)?[\s,;.]*$/i)
      at = i + f.length
    }
    expect(text.slice(at), 'se pierde el final').toMatch(/^[\s,;.]*$/)

    // 2. Cada trozo se convierte en objeto, monedas o elección, sin perder palabras.
    const parts = parseEquipmentParts(text, rules)
    expect(parts.map((p) => p.text)).toEqual(frags)
    const res = parseEquipment(text, rules)
    for (const p of parts) {
      expect(p.item || p.coins, `«${p.text}» no da nada`).toBeTruthy()
      if (p.pending) {
        expect(res.pending, `«${p.text}» falta en pending`).toContain(p.text)
        expect(p.item?.notes, `«${p.text}» sin nota`).toBeTruthy()
        continue
      }
      if (p.coins && !p.item) {
        const [n, unit] = p.text.trim().split(/\s+/)
        expect(p.coins).toEqual({ [unit]: Number(n) })
        continue
      }
      const it = p.item!
      expect(it.name.trim()).not.toBe('')
      expect(it.qty).toBeGreaterThan(0)
      const target = new Set(words(`${it.name} ${it.notes ?? ''}`).map(stem))
      // En «pergamino (10 hojas)» el 10 va a qty y la unidad puede irse.
      const units = new Set([...p.text.matchAll(/\(\s*\d+\s+([^)\s]+)\s*\)/g)].flatMap((m) => words(m[1])))
      for (const w of words(p.text)) {
        if (STOP.has(w) || units.has(w)) continue
        if (/^\d+$/.test(w)) expect(Number(w), `«${p.text}»: el ${w} no está en qty`).toBe(it.qty)
        else expect(target.has(stem(w)), `«${p.text}»: se pierde «${w}» en ${JSON.stringify(it)}`).toBe(true)
      }
    }

    // 3. parseEquipment = suma de los trozos; ids únicos.
    expect(res.items).toEqual(parts.flatMap((p) => (p.item ? [p.item] : [])))
    const coins: Partial<Coins> = {}
    for (const p of parts) for (const [k, v] of Object.entries(p.coins ?? {})) coins[k as keyof Coins] = (coins[k as keyof Coins] ?? 0) + v
    expect(res.coins).toEqual(coins)
    const ids = res.items.map((i) => i.id)
    expect(new Set(ids).size, `ids repetidos: ${ids.join(', ')}`).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    // Lo de ponerse la armadura lo decide el creador (según el entrenamiento).
    for (const it of res.items) expect(it.equipped).toBeUndefined()
  })

  it('las opciones que son solo oro dan cero objetos', () => {
    for (const o of OPTIONS) {
      if (!/^\s*\d+\s*po\s*$/.test(o.text)) continue
      expect(parseEquipment(o.text, rules), o.key).toEqual({ items: [], coins: { po: Number(o.text.trim().split(/\s+/)[0]) } })
    }
  })
})

// Armas y armaduras que tiene que enlazar cada opción (las que no salen, sin ref).
const EXPECTED_REFS: Record<string, string[]> = {
  'barbaro A': ['arma:hacha-a-dos-manos', 'arma:hacha-de-mano'],
  'bardo A': ['armadura:armadura-de-cuero', 'arma:daga'],
  'brujo A': ['armadura:armadura-de-cuero', 'arma:hoz', 'arma:daga'],
  'clerigo A': ['armadura:camisa-de-malla', 'armadura:escudo', 'arma:maza'],
  // El bastón como canalizador druídico o arcano también es un arma.
  'druida A': ['armadura:armadura-de-cuero', 'armadura:escudo', 'arma:hoz', 'arma:baston'],
  'explorador A': ['armadura:armadura-de-cuero-tachonado', 'arma:cimitarra', 'arma:espada-corta', 'arma:arco-largo'],
  'guerrero A': ['armadura:cota-de-malla', 'arma:espadon', 'arma:mangual', 'arma:jabalina'],
  'guerrero B': ['armadura:armadura-de-cuero-tachonado', 'arma:cimitarra', 'arma:espada-corta', 'arma:arco-largo'],
  'hechicero A': ['arma:lanza', 'arma:daga'],
  'mago A': ['arma:daga', 'arma:baston'],
  'monje A': ['arma:lanza', 'arma:daga'],
  'paladin A': ['armadura:cota-de-malla', 'armadura:escudo', 'arma:espada-larga', 'arma:jabalina'],
  'picaro A': ['armadura:armadura-de-cuero', 'arma:daga', 'arma:espada-corta', 'arma:arco-corto'],
  'trasfondo acolito A': [],
  'trasfondo criminal A': ['arma:daga'],
  'trasfondo erudito A': ['arma:baston'],
  'trasfondo soldado A': ['arma:lanza', 'arma:arco-corto'],
}

describe('armas y armaduras enlazadas', () => {
  it('la lista cubre todas las opciones con objetos de las 12 clases y los trasfondos', () => {
    for (const o of OPTIONS) if (parseEquipment(o.text, rules).items.length) expect(Object.keys(EXPECTED_REFS), o.key).toContain(o.key)
  })

  it.each(Object.entries(EXPECTED_REFS))('%s', (key, expected) => {
    expect(refs(parse(key))).toEqual([...expected].sort())
  })

  it('cada ref existe en el SRD', () => {
    for (const o of OPTIONS)
      for (const it of parseEquipment(o.text, rules).items) {
        if (!it.ref) continue
        const found = it.ref.kind === 'arma' ? rules.weapon(it.ref.id) : rules.armor(it.ref.id)
        expect(found, `${o.key}: ${it.ref.kind} ${it.ref.id}`).toBeDefined()
      }
  })

  it('la munición y la aljaba no son armas', () => {
    const r = parse('guerrero B')
    expect(byName(r, 'Flecha')).toEqual({ id: 'flecha', name: 'Flecha', qty: 20 })
    expect(byName(r, 'Aljaba')?.ref).toBeUndefined()
  })
})

describe('casos comprobados a mano', () => {
  it('guerrero A', () => {
    expect(parse('guerrero A')).toEqual({
      items: [
        { id: 'cota-de-malla', name: 'Cota de malla', qty: 1, ref: { kind: 'armadura', id: 'cota-de-malla' }, weight: '27,5 kg' },
        { id: 'espadon', name: 'Espadón', qty: 1, ref: { kind: 'arma', id: 'espadon' }, weight: '3 kg' },
        { id: 'mangual', name: 'Mangual', qty: 1, ref: { kind: 'arma', id: 'mangual' }, weight: '1 kg' },
        { id: 'jabalina', name: 'Jabalina', qty: 8, ref: { kind: 'arma', id: 'jabalina' }, weight: '1 kg' },
        {
          id: 'paquete-de-explorador-de-mazmorras',
          name: 'Paquete de explorador de mazmorras',
          qty: 1,
          notes: 'Contiene abrojos, 10 antorchas, cantimplora, cuerda, 2 frascos de aceite, mochila, palanqueta, raciones para 10 días y yesquero.',
          weight: '27,5 kg',
        },
      ],
      coins: { po: 4 },
    })
  })

  it('guerrero C: solo oro', () => {
    expect(parse('guerrero C')).toEqual({ items: [], coins: { po: 155 } })
  })

  it('pícaro A', () => {
    const r = parse('picaro A')
    expect(r.items.map((i) => [i.name, i.qty])).toEqual([
      ['Armadura de cuero', 1],
      ['Daga', 2],
      ['Espada corta', 1],
      ['Arco corto', 1],
      ['Flecha', 20],
      ['Aljaba', 1],
      ['Herramientas de ladrón', 1],
      ['Paquete de ladrón', 1],
    ])
    expect(r.coins).toEqual({ po: 8 })
    expect(r.pending).toBeUndefined()
    expect(byName(r, 'Armadura de cuero')?.ref).toEqual({ kind: 'armadura', id: 'armadura-de-cuero' })
    expect(byName(r, 'Daga')?.ref).toEqual({ kind: 'arma', id: 'daga' })
    expect(byName(r, 'Herramientas de ladrón')).toEqual({ id: 'herramientas-de-ladron', name: 'Herramientas de ladrón', qty: 1 })
    expect(byName(r, 'Paquete de ladrón')?.notes).toBe(
      'Contiene bolas de metal, campana, cantimplora, cuerda, 7 frascos de aceite, linterna sorda, mochila, palanqueta, raciones para 5 días, 10 velas y yesquero.',
    )
  })

  it('mago A: el canalizador (bastón) también es un arma', () => {
    const r = parse('mago A')
    expect(r.items.map((i) => [i.name, i.qty])).toEqual([
      ['Daga', 2],
      ['Canalizador arcano (bastón)', 1],
      ['Libro de conjuros', 1],
      ['Paquete de erudito', 1],
      ['Túnica', 1],
    ])
    const staff = byName(r, 'Canalizador arcano (bastón)')!
    expect(staff.id).toBe('canalizador-arcano-baston')
    expect(staff.ref).toEqual({ kind: 'arma', id: 'baston' })
    expect(staff.notes).toMatch(/^Canalizador mágico/)
    expect(staff.notes).toMatch(/arma: bastón\.$/)
    expect(byName(r, 'Libro de conjuros')).toEqual({ id: 'libro-de-conjuros', name: 'Libro de conjuros', qty: 1 })
    expect(byName(r, 'Paquete de erudito')?.notes).toBe('Contiene 10 frascos de aceite, 10 hojas de pergamino, lámpara, libro, mochila, pluma, tinta y yesquero.')
    expect(r.coins).toEqual({ po: 5 })
    expect(r.pending).toBeUndefined()
  })

  it('clérigo A', () => {
    const r = parse('clerigo A')
    expect(r.items.map((i) => [i.name, i.qty, i.ref])).toEqual([
      ['Camisa de malla', 1, { kind: 'armadura', id: 'camisa-de-malla' }],
      ['Escudo', 1, { kind: 'armadura', id: 'escudo' }],
      ['Maza', 1, { kind: 'arma', id: 'maza' }],
      ['Paquete de sacerdote', 1, undefined],
      ['Símbolo sagrado', 1, undefined],
    ])
    expect(byName(r, 'Paquete de sacerdote')?.notes).toBe('Contiene agua bendita, lámpara, manta, mochila, raciones para 7 días, túnica y yesquero.')
    expect(byName(r, 'Símbolo sagrado')?.notes).toBe(
      'Canalizador mágico: sustituye a los componentes materiales que no tienen coste. Puede ser amuleto, emblema o relicario.',
    )
    expect(r.coins).toEqual({ po: 7 })
  })

  it('bardo A: instrumento a elegir', () => {
    const r = parse('bardo A')
    expect(r.items.map((i) => [i.name, i.qty])).toEqual([
      ['Armadura de cuero', 1],
      ['Daga', 2],
      ['Instrumento musical', 1],
      ['Paquete de artista', 1],
    ])
    expect(byName(r, 'Instrumento musical')).toEqual({
      id: 'instrumento-musical',
      name: 'Instrumento musical',
      qty: 1,
      notes: 'A tu elección. Cuando lo sepas, cámbiale el nombre.',
    })
    expect(r.pending).toEqual(['instrumento musical de tu elección'])
    expect(r.coins).toEqual({ po: 19 })
  })

  it('monje A: herramienta o instrumento ya elegido', () => {
    const r = parse('monje A')
    expect(r.items.map((i) => [i.name, i.qty])).toEqual([
      ['Lanza', 1],
      ['Daga', 5],
      ['Herramientas de artesano o instrumento musical', 1],
      ['Paquete de explorador', 1],
    ])
    expect(byName(r, 'Herramientas de artesano o instrumento musical')?.notes).toBe(
      'Es el que has elegido para la competencia con herramientas. Cuando lo sepas, cámbiale el nombre.',
    )
    expect(r.pending).toEqual(['herramientas de artesano o instrumento musical que has elegido para la competencia con herramientas'])
  })

  it('acólito A: paréntesis de detalle y de cantidad', () => {
    expect(parse('trasfondo acolito A')).toEqual({
      items: [
        { id: 'suministros-de-caligrafo', name: 'Suministros de calígrafo', qty: 1 },
        { id: 'libro-de-oraciones', name: 'Libro (de oraciones)', qty: 1, weight: '2,5 kg' },
        // La cantidad del paréntesis pasa a qty y la unidad se va: cada pergamino del SRD es una hoja.
        { id: 'pergamino', name: 'Pergamino', qty: 10 },
        {
          id: 'simbolo-sagrado',
          name: 'Símbolo sagrado',
          qty: 1,
          notes: 'Canalizador mágico: sustituye a los componentes materiales que no tienen coste. Puede ser amuleto, emblema o relicario.',
        },
        { id: 'tunica', name: 'Túnica', qty: 1, weight: '2 kg' },
      ],
      coins: { po: 8 },
    })
  })

  it('soldado A: juego «el mismo que arriba»', () => {
    const r = parse('trasfondo soldado A')
    expect(byName(r, 'Juego')?.notes).toMatch(/^Es el mismo que elegiste para la competencia con herramientas\./)
    expect(r.pending).toEqual(['juego (el mismo que arriba)'])
    expect(r.coins).toEqual({ po: 14 })
  })
})

describe('textos sueltos', () => {
  const p = (t: string) => parseEquipment(t, rules)

  it('cantidades en palabras y en cifras, en singular', () => {
    const r = p('dos hachas de mano, 3 espadas cortas, una ballesta ligera y 20 virotes')
    expect(r.items.map((i) => [i.name, i.qty, i.ref?.id])).toEqual([
      ['Hacha de mano', 2, 'hacha-de-mano'],
      ['Espada corta', 3, 'espada-corta'],
      ['Ballesta ligera', 1, 'ballesta-ligera'],
      ['Virote', 20, undefined],
    ])
  })

  it('armaduras con nombres compuestos y variantes', () => {
    const r = p('armadura de pieles, armadura de cuero tachonado, cota de malla, escudo de madera')
    expect(r.items.map((i) => [i.name, i.ref])).toEqual([
      ['Armadura de pieles', { kind: 'armadura', id: 'armadura-de-pieles' }],
      ['Armadura de cuero tachonado', { kind: 'armadura', id: 'armadura-de-cuero-tachonado' }],
      ['Cota de malla', { kind: 'armadura', id: 'cota-de-malla' }],
      ['Escudo de madera', { kind: 'armadura', id: 'escudo' }],
    ])
  })

  it('monedas de todo tipo', () => {
    expect(p('3 pp, 10 pc, 2 ppt, 1 pe, 5 piezas de oro y 4 po')).toEqual({ items: [], coins: { pp: 3, pc: 10, ppt: 2, pe: 1, po: 9 } })
    expect(p('bolsa con 15 po')).toEqual({ items: [{ id: 'bolsa', name: 'Bolsa', qty: 1, weight: '0,5 kg' }], coins: { po: 15 } })
  })

  it('elecciones: objeto genérico con nota y el texto en pending', () => {
    const r = p('un símbolo sagrado o un canalizador druídico, un tipo de suministros de artesano y un arma sencilla a tu elección')
    expect(r.items.map((i) => i.name)).toEqual(['Símbolo sagrado o canalizador druídico', 'Suministros de artesano', 'Arma sencilla'])
    expect(r.items[0].notes).toBe('Elige uno: símbolo sagrado o canalizador druídico. Cuando lo sepas, cámbiale el nombre.')
    expect(r.items[1].notes).toBe('A tu elección. Cuando lo sepas, cámbiale el nombre.')
    expect(r.pending).toEqual(['un símbolo sagrado o un canalizador druídico', 'un tipo de suministros de artesano', 'un arma sencilla a tu elección'])
  })

  it('elecciones con cantidades o con «que elijas»', () => {
    const r = p('dos dagas o una espada corta, un instrumento musical que elijas')
    expect(r.items.map((i) => [i.name, i.qty, i.ref])).toEqual([
      ['Dos dagas o espada corta', 1, undefined],
      ['Instrumento musical', 1, undefined],
    ])
    expect(r.items[0].notes).toBe('Elige uno: dos dagas o espada corta. Cuando lo sepas, cámbiale el nombre.')
    expect(r.pending).toEqual(['dos dagas o una espada corta', 'un instrumento musical que elijas'])
  })

  it('un nombre del SRD con «o» no es una elección', () => {
    expect(p('2 estuches para mapas o pergaminos')).toEqual({
      items: [{ id: 'estuche-para-mapas-o-pergaminos', name: 'Estuche para mapas o pergaminos', qty: 2, weight: '0,5 kg' }],
      coins: {},
    })
  })

  it('no parte comas ni «y» dentro de paréntesis', () => {
    expect(splitEquipment('bolsa (con tiza, cordel y vela), 2 dagas y 5 po')).toEqual(['bolsa (con tiza, cordel y vela)', '2 dagas', '5 po'])
    expect(splitEquipment('lanza, 2 dagas, y 4 po.')).toEqual(['lanza', '2 dagas', '4 po'])
    expect(splitEquipment('2 dagas y 4 po, ')).toEqual(['2 dagas', '4 po'])
    const r = p('bolsa (con tiza, cordel y vela), 2 dagas y 5 po')
    expect(r.items[0].name).toBe('Bolsa (con tiza, cordel y vela)')
  })

  it('medidas entre paréntesis no son cantidades; recipientes sí enlazan con el equipo', () => {
    expect(p('cuerda (15 m)').items).toEqual([{ id: 'cuerda-15-m', name: 'Cuerda (15 m)', qty: 1, weight: '2,5 kg' }])
    expect(p('8 frascos de aceite').items).toEqual([{ id: 'frasco-de-aceite', name: 'Frasco de aceite', qty: 8, weight: '0,5 kg' }])
  })

  it('ids únicos aunque se repita el nombre', () => {
    expect(p('daga, daga, 2 dagas').items.map((i) => i.id)).toEqual(['daga', 'daga-2', 'daga-3'])
  })

  it('no lanza nunca y lo desconocido entra tal cual', () => {
    for (const t of ['', '   ', ',,, y ,', '((', 'abc (def', ')))', 'y', '0 po', 'cosa rara de la DM', 'un', '(10 hojas)', 'constructor po', 'hasOwnProperty']) {
      expect(() => p(t), JSON.stringify(t)).not.toThrow()
    }
    expect(p('')).toEqual({ items: [], coins: {} })
    expect(p('0 po')).toEqual({ items: [], coins: { po: 0 } })
    expect(p('cinco po y 4po')).toEqual({ items: [], coins: { po: 9 } })
    expect(p('constructor, toString y __proto__').items.map((i) => i.name)).toEqual(['Constructor', 'ToString', '__proto__'])
    expect(p('cosa rara de la DM').items).toEqual([{ id: 'cosa-rara-de-la-dm', name: 'Cosa rara de la DM', qty: 1 }])
    expect(p('abc (def').items[0].name).toBe('Abc (def)')
    expect(p('(10 hojas)').items).toEqual([{ id: '10-hojas', name: '(10 hojas)', qty: 1 }])
    // Con un libro de reglas vacío tampoco falla.
    const empty = new Rules({ ...rules.book, weapons: [], armor: [], gear: [] })
    expect(parseEquipment('cota de malla, 8 jabalinas y 4 po', empty)).toEqual({
      items: [
        { id: 'cota-de-malla', name: 'Cota de malla', qty: 1 },
        { id: 'jabalina', name: 'Jabalina', qty: 8 },
      ],
      coins: { po: 4 },
    })
    // Ni con argumentos raros.
    expect(() => parseEquipment(undefined as unknown as string, rules)).not.toThrow()
    expect(() => parseEquipment('daga', undefined as unknown as Rules)).not.toThrow()
  })
})
