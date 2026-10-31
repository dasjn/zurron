// Tablas y perfiles que el texto plano del PDF desordena. Cada sustitución
// localiza un tramo de líneas crudas dentro de una entrada (desde la línea que
// empieza por `from` hasta la que empieza por `to`, ambas incluidas, o hasta
// justo antes de la que empieza por `until`) y lo reemplaza por `lines`
// (filas Markdown "| ... |" o párrafos ya limpios), o por lo que devuelva
// `transform(tramo)`.
// Las tablas desordenadas se han transcrito a mano a partir de es.txt
// (-layout) y comprobado contra en.txt.

import { mdTable } from './texto.mjs'

/** Título en negrita + tabla Markdown. */
export const T = (title, head, rows) => [...(title ? [`**${title}**`] : []), ...mdTable(head, rows)]

/**
 * Filas del tipo "2–6 El objetivo no se mueve..." -> tabla de 2 columnas.
 * Une las líneas que no empiezan por el patrón de la primera columna.
 */
const rowsTable = (title, head, keyRe, boldLead = false) => (tramo) => {
  const rows = []
  for (const l of tramo.slice(title ? 2 : 1)) {
    if (!l.trim() || l.trim() === head.join(' ')) continue
    const m = l.match(keyRe)
    if (m) rows.push([m[1], l.slice(m[0].length).trim()])
    else if (rows.length) rows[rows.length - 1][1] += ' ' + l.trim()
  }
  if (boldLead) for (const r of rows) r[1] = r[1].replace(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\.) /,'**$1** ')
  return T(title, head, rows)
}

/** Perfil de criatura (conjuros que invocan algo) en texto legible. */
function perfil({ nombre, tipo, ca, pg, velocidad, stats, extra = [], secciones = [] }) {
  const out = [`**${nombre}**`, tipo + '.', `**CA:** ${ca}. **PG:** ${pg}. **Velocidad:** ${velocidad}.`]
  const names = ['Fue', 'Des', 'Con', 'Int', 'Sab', 'Car']
  out.push(...mdTable(['Característica', 'Puntuación', 'Mod.', 'Salv.'], names.map((n, i) => [n, ...stats[i]])))
  for (const [k, v] of extra) out.push(`**${k}:** ${v}`)
  for (const [titulo, items] of secciones) {
    out.push(`**${titulo}**`)
    for (const [lead, texto] of items) out.push(`**${lead}** ${texto}`)
  }
  return out
}

const VD_INVOCADO = 'ninguno (0 PX; BC igual a tu bonificador por competencia)'

export const OVERRIDES = [
  // ───────────── Conjuros ─────────────
  {
    kind: 'conjuro',
    id: 'animar-objetos',
    from: 'Objeto animado',
    to: 'Golpe.',
    transform: (tramo) =>
      perfil({
        nombre: 'Objeto animado',
        tipo: 'Autómata Enorme o más pequeño, sin alineamiento',
        ca: '15',
        pg: '10 (Mediano o más pequeño), 20 (Grande), 40 (Enorme)',
        velocidad: '9 m',
        stats: [
          ['16', '+3', '+3'],
          ['10', '+0', '+0'],
          ['10', '+0', '+0'],
          ['3', '−4', '−4'],
          ['3', '−4', '−4'],
          ['1', '−5', '−5'],
        ],
        extra: [
          ['Inmunidades', 'psíquico, veneno; asustado, cansancio, envenenado, hechizado, paralizado'],
          ['Sentidos', 'visión ciega 9 m; Percepción pasiva 6'],
          ['Idiomas', 'entiende los idiomas que conozcas'],
          ['VD', VD_INVOCADO],
        ],
        secciones: [['Acciones', [['Golpe.', tramo.find((l) => l.startsWith('Golpe.')).slice(7)]]]],
      }),
  },
  {
    kind: 'conjuro',
    id: 'augurio',
    from: 'Presagios',
    to: 'Ni buenos ni malos',
    lines: T('Presagios', ['Presagio', 'Para los resultados que sean...'], [
      ['Fortuna', 'Buenos'],
      ['Desdicha', 'Malos'],
      ['Fortuna y desdicha', 'Buenos y malos'],
      ['Indiferencia', 'Ni buenos ni malos'],
    ]),
  },
  {
    kind: 'conjuro',
    id: 'confusion',
    from: '1d10 Comportamiento del turno',
    to: '9–10 ',
    transform: rowsTable(null, ['1d10', 'Comportamiento del turno'], /^(\d+(?:–\d+)?) /),
  },
  {
    kind: 'conjuro',
    id: 'controlar-el-clima',
    from: 'Precipitaciones',
    to: 'Nivel Estado 1 Calmo',
    lines: [
      ...T('Precipitaciones', ['Nivel', 'Estado'], [
        ['1', 'Despejado'],
        ['2', 'Nubes escasas'],
        ['3', 'Cielo cubierto o niebla de superficie'],
        ['4', 'Lluvia, granizo o nieve'],
        ['5', 'Lluvia torrencial, tormenta de granizo o ventisca'],
      ]),
      '',
      ...T('Temperatura', ['Nivel', 'Estado'], [
        ['1', 'Ola de calor'],
        ['2', 'Caliente'],
        ['3', 'Templado'],
        ['4', 'Fresco'],
        ['5', 'Frío'],
        ['6', 'Frío extremo'],
      ]),
      '',
      ...T('Viento', ['Nivel', 'Estado'], [
        ['1', 'Calmo'],
        ['2', 'Viento moderado'],
        ['3', 'Viento fuerte'],
        ['4', 'Galerna'],
        ['5', 'Tempestad'],
      ]),
    ],
  },
  {
    kind: 'conjuro',
    id: 'creacion',
    from: 'Materiales',
    to: 'Duración 24 horas',
    lines: T('Materiales', ['Material', 'Duración'], [
      ['Materia vegetal', '24 horas'],
      ['Piedra o cristal', '12 horas'],
      ['Metales preciosos', '1 hora'],
      ['Gemas', '10 minutos'],
      ['Adamantina o mithral', '1 minuto'],
    ]),
  },
  {
    kind: 'conjuro',
    id: 'escudrinar',
    from: 'Conocimiento sobre el objetivo',
    to: '−10',
    lines: [
      ...mdTable(['Conocimiento sobre el objetivo', 'Modificador de la tirada de salvación'], [
        ['De segundas (has oído hablar del objetivo)', '+5'],
        ['De primera mano (has conocido al objetivo)', '+0'],
        ['Familiar (conoces bien al objetivo)', '−5'],
      ]),
      '',
      ...mdTable(['¿Qué tienes del objetivo?', 'Modificador de la tirada de salvación'], [
        ['Dibujo u otro retrato', '−2'],
        ['Prenda u otra posesión', '−4'],
        ['Parte del cuerpo, mechón de pelo o trozo de uña', '−10'],
      ]),
    ],
  },
  {
    kind: 'conjuro',
    id: 'hallar-corcel',
    from: 'Corcel sobrenatural',
    to: 'Toque sanador',
    transform: (tramo) => {
      const after = (lead) => tramo.find((l) => l.startsWith(lead)).slice(lead.length).trim()
      return perfil({
        nombre: 'Corcel sobrenatural',
        tipo: 'Celestial, feérico o infernal Grande (a tu elección), neutral',
        ca: '10 + 1 por cada nivel del conjuro',
        pg: '5 + 10 por cada nivel del conjuro (el corcel tiene una cantidad de dados de golpe [d10] igual al nivel del conjuro)',
        velocidad: '18 m, volar 18 m (requiere un conjuro de nivel 4 o superior)',
        stats: [
          ['18', '+4', '+4'],
          ['12', '+1', '+1'],
          ['14', '+2', '+2'],
          ['6', '−2', '−2'],
          ['12', '+1', '+1'],
          ['8', '−1', '−1'],
        ],
        extra: [
          ['Sentidos', 'Percepción pasiva 11'],
          ['Idiomas', 'telepatía 1,5 km (solo funciona contigo)'],
          ['VD', VD_INVOCADO],
        ],
        secciones: [
          ['Atributos', [['Vínculo vital.', after('Vínculo vital.')]]],
          ['Acciones', [['Golpetazo sobrenatural.', after('Golpetazo sobrenatural.')]]],
          [
            'Acciones adicionales',
            [
              ['Mirada siniestra (solo infernal; se recarga tras un descanso largo).', after('Mirada siniestra (solo infernal; se recarga tras un descanso largo).')],
              ['Paso feérico (solo feérico; se recarga tras un descanso largo).', after('Paso feérico (solo feérico; se recarga tras un descanso largo).')],
              ['Toque sanador (solo celestial; se recarga tras un descanso largo).', after('Toque sanador (solo celestial; se recarga tras un descanso largo).')],
            ],
          ],
        ],
      })
    },
  },
  {
    kind: 'conjuro',
    id: 'insecto-gigante',
    // el nombre del perfil coincide con el del conjuro: el tramo empieza en "Bestia Grande"
    from: 'Bestia Grande, sin alineamiento',
    to: 'Escupitajo venenoso',
    transform: (tramo) => {
      const after = (lead) => tramo.find((l) => l.startsWith(lead)).slice(lead.length).trim()
      return perfil({
        nombre: 'Insecto gigante',
        tipo: 'Bestia Grande, sin alineamiento',
        ca: '11 + el nivel del conjuro',
        pg: '30 + 10 por cada nivel del conjuro superior al 4',
        velocidad: '12 m, trepar 12 m, volar 12 m (solo avispa)',
        stats: [
          ['17', '+3', '+3'],
          ['13', '+1', '+1'],
          ['15', '+2', '+2'],
          ['4', '−3', '−3'],
          ['14', '+2', '+2'],
          ['3', '−4', '−4'],
        ],
        extra: [
          ['Sentidos', 'visión en la oscuridad 18 m; Percepción pasiva 12'],
          ['Idiomas', 'entiende los idiomas que conozcas'],
          ['VD', VD_INVOCADO],
        ],
        secciones: [
          ['Atributos', [['Trepar cual arácnido.', after('Trepar cual arácnido.')]]],
          [
            'Acciones',
            [
              ['Ataque múltiple.', after('Ataque múltiple.')],
              ['Punzada venenosa.', after('Punzada venenosa.')],
              ['Proyectil de telarañas (solo araña).', after('Proyectil de telarañas (solo araña).')],
            ],
          ],
          ['Acciones adicionales', [['Escupitajo venenoso (solo ciempiés).', after('Escupitajo venenoso (solo ciempiés).')]]],
        ],
      })
    },
    // quita también la línea "Insecto gigante" que precede al tipo
    dropBefore: 'Insecto gigante',
  },
  {
    kind: 'conjuro',
    id: 'invocar-dragon',
    from: 'Espíritu dracónico',
    to: 'Ataque de aliento.',
    transform: (tramo) => {
      const after = (lead) => tramo.find((l) => l.startsWith(lead)).slice(lead.length).trim()
      return perfil({
        nombre: 'Espíritu dracónico',
        tipo: 'Dragón Grande, neutral',
        ca: '14 + el nivel del conjuro',
        pg: '50 + 10 por cada nivel del conjuro superior al 5',
        velocidad: '9 m, nadar 9 m, volar 18 m',
        stats: [
          ['19', '+4', '+4'],
          ['14', '+2', '+2'],
          ['17', '+3', '+3'],
          ['10', '+0', '+0'],
          ['14', '+2', '+2'],
          ['14', '+2', '+2'],
        ],
        extra: [
          ['Resistencias', 'ácido, frío, fuego, relámpago, veneno'],
          ['Inmunidades', 'asustado, envenenado, hechizado'],
          ['Sentidos', 'visión ciega 9 m, visión en la oscuridad 18 m; Percepción pasiva 12'],
          ['Idiomas', 'dracónico, entiende los idiomas que conozcas'],
          ['VD', VD_INVOCADO],
        ],
        secciones: [
          ['Atributos', [['Resistencias compartidas.', after('Resistencias compartidas.')]]],
          [
            'Acciones',
            [
              ['Ataque múltiple.', after('Ataque múltiple.')],
              ['Desgarro.', after('Desgarro.')],
              ['Ataque de aliento.', after('Ataque de aliento.')],
            ],
          ],
        ],
      })
    },
  },
  {
    kind: 'conjuro',
    id: 'muro-prismatico',
    from: 'Capas prismáticas',
    to: '7 Violeta.',
    transform: rowsTable('Capas prismáticas', ['Orden', 'Efectos'], /^(\d) /, true),
  },
  {
    kind: 'conjuro',
    id: 'palabra-divina',
    from: 'Efectos de palabra divina',
    to: '41–50 ',
    lines: T('Efectos de palabra divina', ['Puntos de golpe', 'Efecto'], [
      ['0–20', 'El objetivo muere.'],
      ['21–30', 'El objetivo tiene los estados de aturdido, cegado y ensordecido durante 1 hora.'],
      ['31–40', 'El objetivo tiene los estados de cegado y ensordecido durante 10 minutos.'],
      ['41–50', 'El objetivo tiene el estado de ensordecido durante 1 minuto.'],
    ]),
  },
  {
    kind: 'conjuro',
    id: 'reencarnar',
    from: '1d10 Especie 1',
    to: '1d10 Especie 6',
    lines: mdTable(['1d10', 'Especie'], [
      ['1', 'Vuelve a tirar'],
      ['2', 'Dracónido'],
      ['3', 'Elfo'],
      ['4', 'Enano'],
      ['5', 'Gnomo'],
      ['6', 'Goliat'],
      ['7', 'Humano'],
      ['8', 'Mediano'],
      ['9', 'Orco'],
      ['10', 'Tiefling'],
    ]),
  },
  {
    kind: 'conjuro',
    id: 'rociada-prismatica',
    from: 'Rayos prismáticos',
    to: '8 Especial.',
    transform: rowsTable('Rayos prismáticos', ['1d8', 'Rayo'], /^(\d) /, true),
  },
  {
    kind: 'conjuro',
    id: 'teletransporte',
    from: 'Resultado del teletransporte',
    until: 'Familiaridad. Los términos',
    lines: T('Resultado del teletransporte', ['Familiaridad', 'Percance', 'Área similar', 'Lejos del objetivo', 'En el objetivo'], [
      ['Círculo permanente', '—', '—', '—', '01–00'],
      ['Objeto vinculado', '—', '—', '—', '01–00'],
      ['Muy familiar', '01–05', '06–13', '14–24', '25–00'],
      ['Visto esporádicamente', '01–33', '34–43', '44–53', '54–00'],
      ['Visto una vez o descrito', '01–43', '44–53', '54–73', '74–00'],
      ['Destino falso', '01–50', '51–00', '—', '—'],
    ]),
  },
]

const bullets = (items) => items.map((x) => '• ' + x)

OVERRIDES.push(
  // ───────────── Glosario ─────────────
  {
    kind: 'glosario',
    id: 'accion',
    from: 'Atacar Ayudar Buscar',
    to: 'Preparar una acción Utilizar',
    lines: bullets(['Atacar', 'Ayudar', 'Buscar', 'Correr', 'Destrabarse', 'Esconderse', 'Esquivar', 'Estudiar', 'Influir', 'Magia', 'Preparar una acción', 'Utilizar']),
  },
  {
    kind: 'glosario',
    id: 'area-de-efecto',
    from: 'Cilindro Cono',
    to: 'Esfera Línea',
    lines: bullets(['Cilindro', 'Cono', 'Cubo', 'Emanación', 'Esfera', 'Línea']),
  },
  {
    kind: 'glosario',
    id: 'estado',
    from: 'Agarrado Apresado',
    to: 'Incapacitado Inconsciente',
    lines: bullets(['Agarrado', 'Apresado', 'Asustado', 'Aturdido', 'Cansancio', 'Cegado', 'Derribado', 'Ensordecido', 'Envenenado', 'Hechizado', 'Incapacitado', 'Inconsciente', 'Invisible', 'Paralizado', 'Petrificado']),
  },
  {
    kind: 'glosario',
    id: 'tipo-de-criatura',
    from: 'Aberración Autómata',
    to: 'Infernal Monstruosidad',
    lines: bullets(['Aberración', 'Autómata', 'Bestia', 'Celestial', 'Cieno', 'Dragón', 'Elemental', 'Feérico', 'Gigante', 'Humanoide', 'Infernal', 'Monstruosidad', 'Muerto viviente', 'Planta']),
  },
  {
    kind: 'glosario',
    id: 'buscar',
    from: 'Búsqueda',
    to: 'Objeto de detección',
    lines: T('Búsqueda', ['Habilidad', 'Objeto de detección'], [
      ['Medicina', 'Dolencia o causa de la muerte de una criatura'],
      ['Percepción', 'Criatura u objeto ocultos'],
      ['Perspicacia', 'Estado mental de una criatura'],
      ['Supervivencia', 'Huellas o alimentos'],
    ]),
  },
  {
    kind: 'glosario',
    id: 'capacidad-de-carga',
    from: 'Capacidad de carga',
    to: 'Gargantuesco',
    lines: T('Capacidad de carga', ['Tamaño de la criatura', 'Máximo', 'Arrastrar, levantar o empujar'], [
      ['Diminuto', 'Fue × 3,75 kg', 'Fue × 7,5 kg'],
      ['Pequeño/Mediano', 'Fue × 7,5 kg', 'Fue × 15 kg'],
      ['Grande', 'Fue × 15 kg', 'Fue × 30 kg'],
      ['Enorme', 'Fue × 30 kg', 'Fue × 60 kg'],
      ['Gargantuesco', 'Fue × 60 kg', 'Fue × 120 kg'],
    ]),
  },
  {
    kind: 'glosario',
    id: 'deshidratacion',
    from: 'Consumo de agua al día',
    to: 'Agua 16 l',
    lines: T('Consumo de agua al día', ['Tamaño', 'Agua'], [
      ['Diminuto', '1 l'],
      ['Pequeño', '4 l'],
      ['Mediano', '4 l'],
      ['Grande', '16 l'],
      ['Enorme', '64 l'],
      ['Gargantuesco', '256 l'],
    ]),
  },
  {
    kind: 'glosario',
    id: 'desnutricion',
    from: 'Consumo de alimentos al día',
    to: 'Alimentos 2 kg',
    lines: T('Consumo de alimentos al día', ['Tamaño', 'Alimentos'], [
      ['Diminuto', '125 g'],
      ['Pequeño', '0,5 kg'],
      ['Mediano', '0,5 kg'],
      ['Grande', '2 kg'],
      ['Enorme', '8 kg'],
      ['Gargantuesco', '32 kg'],
    ]),
  },
  {
    kind: 'glosario',
    id: 'estudiar',
    from: 'Áreas de conocimiento',
    to: 'Deidades, jerarquías',
    lines: T('Áreas de conocimiento', ['Habilidad', 'Áreas'], [
      ['Conocimiento arcano', 'Conjuros, objetos mágicos, símbolos sobrenaturales, tradiciones mágicas, planos de existencia y determinadas criaturas (aberraciones, autómatas, elementales, feéricos y monstruosidades)'],
      ['Historia', 'Acontecimientos y personajes históricos, civilizaciones antiguas, guerras y determinadas criaturas (gigantes y humanoides)'],
      ['Investigación', 'Trampas, códigos, enigmas y artilugios'],
      ['Naturaleza', 'Terreno, flora, clima y determinadas criaturas (bestias, cienos, dragones y plantas)'],
      ['Religión', 'Deidades, jerarquías religiosas y ritos, símbolos sagrados, sectas y determinadas criaturas (celestiales, infernales y muertos vivientes)'],
    ]),
  },
  {
    kind: 'glosario',
    id: 'influir',
    from: 'Pruebas de influencia',
    to: 'Convencer poco a poco',
    lines: T('Pruebas de influencia', ['Prueba de característica', 'Interacción'], [
      ['Carisma (Engaño)', 'Engañar a un monstruo que te entienda.'],
      ['Carisma (Interpretación)', 'Entretener a un monstruo.'],
      ['Carisma (Intimidación)', 'Intimidar a un monstruo.'],
      ['Carisma (Persuasión)', 'Persuadir a un monstruo que te entienda.'],
      ['Sabiduría (Trato con animales)', 'Convencer poco a poco a una bestia o monstruosidad.'],
    ]),
  },
  {
    kind: 'glosario',
    id: 'romper-objetos',
    from: 'Clase de armadura de objetos',
    to: '17 Piedra',
    lines: T('Clase de armadura de objetos', ['CA', 'Sustancia'], [
      ['11', 'Tela, papel, cuerda'],
      ['13', 'Cristal, vidrio, hielo'],
      ['15', 'Madera'],
      ['17', 'Piedra'],
      ['19', 'Hierro, acero'],
      ['21', 'Mithral'],
      ['23', 'Adamantina'],
    ]),
  },
  {
    kind: 'glosario',
    id: 'romper-objetos',
    from: 'Puntos de golpe de objetos',
    to: '5 (1d10) 27 (5d10)',
    lines: T('Puntos de golpe de objetos', ['Tamaño', 'Frágil', 'Resistente'], [
      ['Diminuto (botella, cerradura)', '2 (1d4)', '5 (2d4)'],
      ['Pequeño (cofre, laúd)', '3 (1d6)', '10 (3d6)'],
      ['Mediano (barril, candelabro)', '4 (1d8)', '18 (4d8)'],
      ['Grande (carreta, mesa de comedor)', '5 (1d10)', '27 (5d10)'],
    ]),
  },
  {
    kind: 'glosario',
    id: 'tipos-de-dano',
    from: 'Tipo',
    to: 'Gas tóxico, veneno',
    lines: T('Tipos de daño', ['Tipo', 'Ejemplos'], [
      ['Ácido', 'Enzimas digestivas, líquidos corrosivos'],
      ['Contundente', 'Aplastamientos, caídas, objetos romos'],
      ['Cortante', 'Garras, objetos cortantes'],
      ['Frío', 'Agua gélida, ráfagas heladas'],
      ['Fuego', 'Calor insoportable, llamas'],
      ['Fuerza', 'Energía mágica pura'],
      ['Necrótico', 'Energía que absorbe la vida'],
      ['Perforante', 'Colmillos, objetos punzantes'],
      ['Psíquico', 'Energía que desgarra la mente'],
      ['Radiante', 'Energía sagrada, radiación abrasadora'],
      ['Relámpago', 'Electricidad'],
      ['Trueno', 'Sonido conmocionador'],
      ['Veneno', 'Gas tóxico, veneno'],
    ]),
  },
)

/**
 * Aplica las sustituciones de `kind`/`id` a las líneas crudas de una entrada.
 * Lanza error si una sustitución no encuentra su tramo (para que no se pierda
 * en silencio al cambiar el texto de origen).
 */
export function applyOverrides(kind, id, lines) {
  let out = lines
  for (const o of OVERRIDES) {
    if (o.kind !== kind || o.id !== id) continue
    const fail = (what) => {
      throw new Error(`Sustitución ${kind}/${id}: no encuentro "${what}"`)
    }
    let a = out.findIndex((l) => l.startsWith(o.from))
    if (a < 0) fail(o.from)
    let b
    if (o.until !== undefined) {
      b = out.findIndex((l, i) => i > a && l.startsWith(o.until)) - 1
      if (b < 0) fail(o.until)
    } else if (o.to !== undefined) {
      b = out.findIndex((l, i) => i >= a && l.startsWith(o.to))
      if (b < 0) fail(o.to)
    } else b = a
    const tramo = out.slice(a, b + 1)
    if (o.dropBefore) {
      let k = a - 1
      while (k >= 0 && out[k] === '') k--
      if (out[k] === o.dropBefore) a = k
    }
    const repl = o.transform ? o.transform(tramo) : o.lines
    o.used = true
    out = [...out.slice(0, a), '', ...repl, '', ...out.slice(b + 1)]
  }
  return out
}

export function unusedOverrides() {
  return OVERRIDES.filter((o) => !o.used).map((o) => `${o.kind}/${o.id}`)
}
