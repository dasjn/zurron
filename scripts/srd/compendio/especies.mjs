// Especies de personaje -> SpeciesData[].
// El texto de los atributos sale de es-raw.txt; la lista de atributos, las
// elecciones, los recursos y los resúmenes para novatos se definen aquí.

import { slugify } from '../lib.mjs'
import { srdLines, findLine, joinParagraphs, applyLeadins, toRich, mdTable } from './texto.mjs'
import { applyOverrides, OVERRIDES } from './tablas.mjs'

// Las tablas de especies se quitan del flujo de texto (rompen frases por la
// mitad) y se vuelven a insertar tras el primer párrafo del atributo.
OVERRIDES.push(
  { kind: 'especie', id: 'draconido', from: 'Ancestros dracónicos', to: 'Dragón Tipo de daño Oro', lines: [] },
  { kind: 'especie', id: 'elfo', from: 'Linajes élficos', to: 'Oscuridad Pasar sin rastro', lines: [] },
  { kind: 'especie', id: 'tiefling', from: 'Legados infernales', to: 'Tienes resistencia al daño de fuego.', lines: [] },
  { kind: 'especie', id: 'tiefling', from: 'Nivel 3 Rayo nauseabundo', to: 'Oscuridad', lines: [] },
)

const ANCESTROS = [
  ['Azul', 'relámpago'],
  ['Blanco', 'frío'],
  ['Bronce', 'relámpago'],
  ['Cobre', 'ácido'],
  ['Negro', 'ácido'],
  ['Oro', 'fuego'],
  ['Oropel', 'fuego'],
  ['Plata', 'frío'],
  ['Rojo', 'fuego'],
  ['Verde', 'veneno'],
]
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// [nombre, texto del nivel 1, truco del nivel 1, conjuro del nivel 3, conjuro del nivel 5]
const LINAJES_ELFICOS = [
  ['Alto elfo', 'Conoces el truco prestidigitación. Tras finalizar un descanso largo, puedes sustituir ese truco por otro truco diferente de la lista de conjuros de mago.', 'Prestidigitación', 'Detectar magia', 'Paso brumoso'],
  ['Drow', 'El alcance de tu visión en la oscuridad aumenta a 36 m. También conoces el truco luces danzantes.', 'Luces danzantes', 'Fuego feérico', 'Oscuridad'],
  ['Elfo de los bosques', 'Tu velocidad aumenta a 10,5 m. También conoces el truco saber druídico.', 'Saber druídico', 'Zancada prodigiosa', 'Pasar sin rastro'],
]
const LEGADOS = [
  ['Abisal', 'Tienes resistencia al daño de veneno. También conoces el truco rociada venenosa.', 'Rociada venenosa', 'Rayo nauseabundo', 'Inmovilizar persona'],
  ['Ctónico', 'Tienes resistencia al daño necrótico. También conoces el truco toque helado.', 'Toque helado', 'Falsa vida', 'Rayo debilitador'],
  ['Infernal', 'Tienes resistencia al daño de fuego. También conoces el truco descarga de fuego.', 'Descarga de fuego', 'Reprensión infernal', 'Oscuridad'],
]
/**
 * Conjuros de un linaje para la ficha: el truco desde el nivel 1 y los conjuros
 * de los niveles 3 y 5, que se lanzan una vez gratis por descanso largo (y
 * también con espacios, si los tienes).
 */
const linajeConjuros = (truco, n3, n5) => [
  { level: 1, id: slugify(truco) },
  { level: 3, id: slugify(n3), freeCast: 'largo' },
  { level: 5, id: slugify(n5), freeCast: 'largo' },
]
const tablaNiveles = (title, col, rows) => [
  `**${title}**`,
  ...mdTable([col, 'Nivel 1', 'Nivel 3', 'Nivel 5'], rows),
]

const PB = { proficiencyBonus: true }
/** 1 uso a partir de un nivel de personaje. */
const unUso = (desde = 1) => ({ perLevel: Array.from({ length: 20 }, (_, i) => (i + 1 >= desde ? 1 : 0)) })

/**
 * Configuración por especie. `traits`: nombre del atributo (tal cual la
 * entradilla del PDF, sin punto), nivel de personaje, resumen y extras.
 * `options`: entradillas que son opciones de una elección (no atributos).
 */
const SPECIES = [
  {
    name: 'Dracónido',
    summary: 'Descendiente de dragones: escupes energía como un dragón y resistes su mismo tipo de daño. A nivel 5 puedes desplegar alas mágicas un rato.',
    traits: [
      {
        name: 'Linaje dracónico',
        summary: 'Eliges de qué color de dragón desciendes. Eso decide el tipo de daño de tu aliento y de tu resistencia.',
        table: [`**Ancestros dracónicos**`, ...mdTable(['Dragón', 'Tipo de daño'], ANCESTROS.map(([d, t]) => [d, cap(t)]))],
        choice: {
          kind: 'opcion',
          count: 1,
          options: ANCESTROS.map(([d, t]) => ({
            id: slugify(d),
            name: `${d} (${t})`,
            text: `Tu Ataque de aliento causa daño de ${t} y tienes resistencia al daño de ${t}.`,
          })),
        },
      },
      {
        name: 'Ataque de aliento',
        summary: 'Al atacar, puedes cambiar uno de tus ataques por un soplo (cono o línea) que obliga a los enemigos de la zona a hacer una tirada de salvación de Destreza. Lo usas tantas veces como tu bonificador por competencia por descanso largo.',
        resources: [{ id: 'ataque-de-aliento', name: 'Ataque de aliento', max: PB, recharge: 'largo' }],
      },
      { name: 'Resistencia al daño', summary: 'Recibes la mitad del daño del tipo de tu linaje dracónico.' },
      { name: 'Visión en la oscuridad', summary: 'Ves en la oscuridad hasta 18 m como si fuera luz tenue (en tonos de gris).' },
      {
        name: 'Vuelo dracónico',
        level: 5,
        summary: 'Desde el nivel 5, como acción adicional te salen alas espectrales y puedes volar durante 10 minutos, una vez por descanso largo.',
        resources: [{ id: 'vuelo-draconico', name: 'Vuelo dracónico', max: unUso(5), recharge: 'largo', fromLevel: 5 }],
      },
    ],
  },
  {
    name: 'Elfo',
    summary: 'Pueblo feérico de sentidos finos que no duerme: medita 4 horas en trance. Tu linaje élfico te da trucos y conjuros que mejoran al subir de nivel.',
    traits: [
      {
        name: 'Linaje élfico',
        summary: 'Eliges ser alto elfo, drow o elfo de los bosques. Cada linaje te da un truco a nivel 1 y un conjuro gratis al día a los niveles 3 y 5.',
        table: tablaNiveles('Linajes élficos', 'Linaje', LINAJES_ELFICOS.map(([n, t, , n3, n5]) => [n, t, n3, n5])),
        choice: {
          kind: 'opcion',
          count: 1,
          options: LINAJES_ELFICOS.map(([n, t, c, n3, n5]) => ({
            id: slugify(n),
            name: n,
            text: `${t} Nivel 3: ${n3.toLowerCase()}. Nivel 5: ${n5.toLowerCase()}.`,
            spells: linajeConjuros(c, n3, n5),
            ...(n === 'Drow' ? { darkvision: 36 } : {}),
          })),
          note: 'Elige también Inteligencia, Sabiduría o Carisma como aptitud mágica para estos conjuros.',
        },
      },
      { name: 'Linaje feérico', summary: 'Tienes ventaja en las tiradas de salvación para evitar que te hechicen o para librarte del hechizo.' },
      {
        name: 'Sentidos agudos',
        summary: 'Eres competente en una habilidad a elegir: Percepción, Perspicacia o Supervivencia.',
        choice: {
          kind: 'habilidad',
          count: 1,
          options: [
            { id: 'percepcion', name: 'Percepción' },
            { id: 'perspicacia', name: 'Perspicacia' },
            { id: 'supervivencia', name: 'Supervivencia' },
          ],
        },
      },
      { name: 'Trance', summary: 'No necesitas dormir ni te pueden dormir con magia. Tu descanso largo dura solo 4 horas de meditación consciente.' },
      { name: 'Visión en la oscuridad', summary: 'Ves en la oscuridad hasta 18 m como si fuera luz tenue (en tonos de gris).' },
    ],
  },
  {
    name: 'Enano',
    summary: 'Gente robusta y resistente, ligada a la piedra. Tienes más puntos de golpe, aguantas bien el veneno y ves lejos en la oscuridad.',
    traits: [
      {
        name: 'Afinidad con la piedra',
        summary: 'Como acción adicional, mientras tocas piedra, notas las vibraciones de lo que se mueve a 18 m durante 10 minutos. Usos: tu bonificador por competencia por descanso largo.',
        resources: [{ id: 'afinidad-con-la-piedra', name: 'Afinidad con la piedra', max: PB, recharge: 'largo' }],
      },
      { name: 'Aguante enano', summary: 'Tienes 1 punto de golpe máximo más por cada nivel de personaje.' },
      { name: 'Resistencia enana', summary: 'Recibes la mitad del daño de veneno y tienes ventaja en las tiradas de salvación contra quedar envenenado.' },
      { name: 'Visión en la oscuridad', summary: 'Ves en la oscuridad hasta 36 m como si fuera luz tenue (en tonos de gris).' },
    ],
  },
  {
    name: 'Gnomo',
    summary: 'Pequeños, astutos e ingeniosos. Tu mente se resiste a la magia y tu linaje te da pequeños trucos mágicos.',
    options: ['Gnomo de las rocas', 'Gnomo de los bosques'],
    traits: [
      { name: 'Astucia gnoma', summary: 'Tienes ventaja en las tiradas de salvación de Inteligencia, Sabiduría y Carisma.' },
      {
        name: 'Linaje gnomo',
        summary: 'Eliges ser gnomo de las rocas (trucos de reparar y crear cacharros mecánicos) o de los bosques (ilusión menor y hablar con los animales).',
        choice: {
          kind: 'opcion',
          count: 1,
          options: [
            { id: 'gnomo-de-las-rocas', name: 'Gnomo de las rocas', spells: [{ level: 1, id: 'prestidigitacion' }, { level: 1, id: 'reparar' }] },
            // Los usos gratis los lleva también el recurso de Linaje gnomo.
            { id: 'gnomo-de-los-bosques', name: 'Gnomo de los bosques', spells: [{ level: 1, id: 'ilusion-menor' }, { level: 1, id: 'hablar-con-los-animales', freeCast: 'largo' }] },
          ],
          note: 'Elige también Inteligencia, Sabiduría o Carisma como aptitud mágica para estos conjuros.',
        },
        resources: [
          { id: 'hablar-con-los-animales', name: 'Hablar con los animales (gnomo de los bosques)', max: PB, recharge: 'largo' },
        ],
      },
      { name: 'Visión en la oscuridad', summary: 'Ves en la oscuridad hasta 18 m como si fuera luz tenue (en tonos de gris).' },
    ],
  },
  {
    name: 'Goliat',
    summary: 'Descendientes de gigantes, altos y fuertes. Tu linaje gigante te da un poder sobrenatural y a nivel 5 puedes crecer hasta tamaño Grande.',
    options: [
      'Abrasión del fuego (gigante de fuego)',
      'Caída de las colinas (gigante de las colinas)',
      'Excursión de las nubes (gigante de las nubes)',
      'Frío de la escarcha (gigante de escarcha)',
      'Resistencia de la piedra (gigante de piedra)',
      'Trueno de la tormenta (gigante de las tormentas)',
    ],
    traits: [
      { name: 'Constitución poderosa', summary: 'Tienes ventaja para soltarte cuando te agarran y puedes cargar como si fueras una categoría de tamaño más grande.' },
      {
        name: 'Forma grande',
        level: 5,
        summary: 'Desde el nivel 5, como acción adicional te haces Grande durante 10 minutos: ventaja en pruebas de Fuerza y +3 m de velocidad. Una vez por descanso largo.',
        resources: [{ id: 'forma-grande', name: 'Forma grande', max: unUso(5), recharge: 'largo', fromLevel: 5 }],
      },
      {
        name: 'Linaje gigante',
        summary: 'Eliges un tipo de gigante y ganas su poder (daño extra de fuego o frío, derribar, teletransporte corto, reducir daño o devolver daño de trueno). Usos: tu bonificador por competencia por descanso largo.',
        choice: { kind: 'opcion', count: 1, options: [] }, // se rellena con las entradillas de `options`
        resources: [{ id: 'linaje-gigante', name: 'Linaje gigante', max: PB, recharge: 'largo' }],
      },
    ],
  },
  {
    name: 'Humano',
    summary: 'Versátiles y adaptables. Empiezas con una habilidad extra, una dote de origen adicional y recuperas inspiración heroica tras cada descanso largo.',
    traits: [
      {
        name: 'Diestro',
        summary: 'Eres competente en una habilidad que elijas.',
        choice: { kind: 'habilidad', count: 1, note: 'Cualquier habilidad.' },
      },
      { name: 'Ingenioso', summary: 'Cada vez que terminas un descanso largo obtienes inspiración heroica (repetir una tirada de dado).' },
      {
        name: 'Versátil',
        summary: 'Obtienes una dote de origen extra a tu elección; Habilidoso es la recomendada.',
        choice: { kind: 'dote-origen', count: 1, note: 'Se recomienda Habilidoso.' },
      },
    ],
  },
  {
    name: 'Mediano',
    summary: 'Pequeños, valientes y con mucha suerte. Te escabulles con facilidad y puedes repetir los 1 en las pruebas con d20.',
    traits: [
      { name: 'Agilidad de mediano', summary: 'Puedes atravesar el espacio de criaturas más grandes que tú, aunque no puedes quedarte en él.' },
      { name: 'Fortuna', summary: 'Si sacas un 1 en una prueba con d20, vuelves a tirar y usas el nuevo resultado.' },
      { name: 'Sigiloso por naturaleza', summary: 'Puedes esconderte detrás de una criatura que sea al menos una categoría de tamaño más grande que tú.' },
      { name: 'Valiente', summary: 'Tienes ventaja en las tiradas de salvación contra el miedo (estado de asustado).' },
    ],
  },
  {
    name: 'Orco',
    summary: 'Fuertes e incansables. Te cuesta caer en combate y puedes lanzarte hacia delante con un subidón de adrenalina.',
    traits: [
      {
        name: 'Aguante incansable',
        summary: 'Cuando te reducen a 0 puntos de golpe sin matarte, puedes quedarte con 1 punto de golpe. Una vez por descanso largo.',
        resources: [{ id: 'aguante-incansable', name: 'Aguante incansable', max: unUso(1), recharge: 'largo' }],
      },
      {
        name: 'Descarga de adrenalina',
        summary: 'Puedes correr como acción adicional y ganas puntos de golpe temporales iguales a tu bonificador por competencia. Usos: tu bonificador por competencia por descanso corto o largo.',
        resources: [{ id: 'descarga-de-adrenalina', name: 'Descarga de adrenalina', max: PB, recharge: 'corto' }],
      },
      { name: 'Visión en la oscuridad', summary: 'Ves en la oscuridad hasta 36 m como si fuera luz tenue (en tonos de gris).' },
    ],
  },
  {
    name: 'Tiefling',
    summary: 'Personas con un legado de los Planos Inferiores. Resistes un tipo de daño y conoces conjuros infernales que mejoran al subir de nivel.',
    traits: [
      {
        name: 'Legado infernal',
        summary: 'Eliges legado abisal, ctónico o infernal: te da una resistencia y un truco a nivel 1, y un conjuro gratis al día a los niveles 3 y 5.',
        table: tablaNiveles('Legados infernales', 'Legado', LEGADOS.map(([n, t, , n3, n5]) => [n, t, n3, n5])),
        choice: {
          kind: 'opcion',
          count: 1,
          options: LEGADOS.map(([n, t, c, n3, n5]) => ({
            id: slugify(n),
            name: n,
            text: `${t} Nivel 3: ${n3.toLowerCase()}. Nivel 5: ${n5.toLowerCase()}.`,
            spells: linajeConjuros(c, n3, n5),
          })),
          note: 'Elige también Inteligencia, Sabiduría o Carisma como aptitud mágica para estos conjuros.',
        },
      },
      { name: 'Presencia sobrenatural', summary: 'Conoces el truco taumaturgia, que lanzas con la misma característica que tu legado infernal.' },
      { name: 'Visión en la oscuridad', summary: 'Ves en la oscuridad hasta 18 m como si fuera luz tenue (en tonos de gris).' },
    ],
  },
]

const parseSpeed = (s) => Number(s.replace(' m', '').replace(',', '.'))

export function buildSpecies() {
  const lines = srdLines()
  const start = findLine('Descripciones de las especies', 10000)
  const end = findLine('Descripciones de dotes', start) - 1 // línea "Dotes"

  const pos = []
  let from = start
  for (const sp of SPECIES) {
    const i = findLine(sp.name, from, end)
    pos.push(i)
    from = i + 1
  }

  return SPECIES.map((sp, k) => {
    const id = slugify(sp.name)
    let block = lines.slice(pos[k] + 1, k + 1 < SPECIES.length ? pos[k + 1] : end)

    // cabecera: hasta la línea "Como <especie>, tienes ..."
    const intro = block.findIndex((l) => l.startsWith('Como '))
    const header = block.slice(0, intro).filter(Boolean).join(' ')
    const hm = header.match(/^Tipo de criatura: (.+?) Tamaño: (.+?) Velocidad: (.+)$/)
    if (!hm) throw new Error(`Cabecera rara en ${sp.name}: ${header}`)
    const [, creatureType, sizeText, speedText] = hm

    block = applyOverrides('especie', id, block.slice(intro))
    const traitNames = sp.traits.map((t) => t.name + '.')
    const optionNames = (sp.options ?? []).map((o) => o + '.')
    const paras = applyLeadins(joinParagraphs(block), [...traitNames, ...optionNames])

    // agrupar párrafos por atributo
    const groups = new Map()
    let cur = null
    for (const p of paras) {
      const t = sp.traits.find((t) => p.startsWith(`**${t.name}.**`))
      if (t) {
        cur = t
        if (groups.has(t.name)) throw new Error(`Atributo repetido ${sp.name}/${t.name}`)
        groups.set(t.name, [p.slice(`**${t.name}.**`.length).trim()])
      } else if (cur) groups.get(cur.name).push(p)
      // lo anterior al primer atributo es la frase "Como X, tienes estos atributos especiales:"
    }

    const traits = sp.traits.map((t) => {
      const ps = groups.get(t.name)
      if (!ps) throw new Error(`No encuentro el atributo ${sp.name}/${t.name}`)
      if (t.table) ps.splice(1, 0, ...t.table)
      const f = { id: `${id}-${slugify(t.name)}`, name: t.name, level: t.level ?? 1, text: toRich(ps), summary: t.summary }
      if (t.resources) f.resources = t.resources
      return f
    })

    // elecciones
    const choices = []
    for (const t of sp.traits) {
      if (!t.choice) continue
      const c = { id: `${id}-${slugify(t.name)}`, ...t.choice }
      if (c.kind === 'opcion' && c.options.length === 0) {
        // opciones sacadas del propio texto (goliat)
        const ps = groups.get(t.name)
        c.options = sp.options.map((o) => {
          const p = ps.find((x) => x.startsWith(`**${o}.**`))
          return { id: slugify(o.replace(/ \(.*\)$/, '')), name: o, text: p.slice(`**${o}.**`.length).trim() }
        })
      } else if (c.kind === 'opcion' && sp.options) {
        const ps = groups.get(t.name)
        for (const opt of c.options) {
          const p = ps.find((x) => x.startsWith(`**${opt.name}.**`))
          if (p) opt.text = p.slice(`**${opt.name}.**`.length).trim()
        }
      }
      choices.push(c)
    }

    const sizes = []
    if (/Pequeño/.test(sizeText)) sizes.push('Pequeño')
    if (/Mediano/.test(sizeText)) sizes.push('Mediano')
    if (sizes.length > 1) {
      choices.push({
        id: `${id}-tamano`,
        kind: 'opcion',
        count: 1,
        options: sizes.map((s) => ({ id: slugify(s), name: s })),
        note: 'Se elige al seleccionar la especie.',
      })
    }

    const dv = traits.find((t) => t.name === 'Visión en la oscuridad')
    const out = {
      id,
      name: sp.name,
      source: 'srd',
      creatureType: cap(creatureType),
      sizeText,
      sizes,
      speed: parseSpeed(speedText),
    }
    if (dv) out.darkvision = Number(dv.text.match(/hasta (\d+) m/)[1])
    out.traits = traits
    if (choices.length) out.choices = choices
    out.summary = sp.summary
    return out
  })
}
