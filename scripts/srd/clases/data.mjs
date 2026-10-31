// Datos de las clases que no se pueden extraer de forma fiable del texto
// (las tablas salen desordenadas en es-raw.txt). Los valores se han transcrito
// de las tablas "Rasgos de X" del SRD 5.2.1 en español y validate.mjs los
// contrasta automáticamente con las tablas de en.txt (versión -layout).
//
// Convención de arrays: 20 valores, índice 0 = nivel 1 de la clase.

/** Array de 20 valores calculado por nivel. */
export const r20 = (f) => Array.from({ length: 20 }, (_, i) => f(i + 1))
/** Valores escalonados: steps([[1, 2], [3, 3]]) -> 2,2,3,3,... (antes del primer escalón: `before`). */
export const steps = (pairs, before = 0) =>
  r20((lvl) => {
    let v = before
    for (const [l, x] of pairs) if (lvl >= l) v = x
    return v
  })
/** 1 uso a partir de un nivel. */
export const once = (from) => r20((l) => (l >= from ? 1 : 0))
const dash = (arr) => arr.map((v) => (v === 0 ? '—' : v))

// --- Progresiones compartidas ------------------------------------------------
const CANTRIPS_2 = steps([[1, 2], [4, 3], [10, 4]]) // bardo, brujo, druida
const CANTRIPS_3 = steps([[1, 3], [4, 4], [10, 5]]) // clérigo, mago
const CANTRIPS_4 = steps([[1, 4], [4, 5], [10, 6]]) // hechicero
const PREPARED_FULL = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22]
const PREPARED_MAGO = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25]
const PREPARED_HECHICERO = [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22]
const PREPARED_BRUJO = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15]
const PREPARED_MEDIO = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15]

export const RAGES = steps([[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]])
export const BARD_DIE = steps([[1, 'd6'], [5, 'd8'], [10, 'd10'], [15, 'd12']])
export const INVOCATIONS = [1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10]
export const CLERIC_CHANNEL = steps([[2, 2], [6, 3], [18, 4]])
export const WILD_SHAPE = steps([[2, 2], [6, 3], [17, 4]])
export const FAVORED_ENEMY = steps([[1, 2], [5, 3], [9, 4], [13, 5], [17, 6]])
export const SECOND_WIND = steps([[1, 2], [4, 3], [10, 4]])
export const SORCERY_POINTS = r20((l) => (l >= 2 ? l : 0))
export const FOCUS_POINTS = r20((l) => (l >= 2 ? l : 0))
export const PALADIN_CHANNEL = steps([[3, 2], [11, 3]])

export const PACT = {
  slots: steps([[1, 1], [2, 2], [11, 3], [17, 4]]),
  slotLevel: steps([[1, 1], [3, 2], [5, 3], [7, 4], [9, 5]]),
}

// --- Recursos ----------------------------------------------------------------
/** Recurso de "una vez por descanso" a partir de un nivel. */
export const onceRes = (id, name, from, recharge = 'largo') => ({
  id,
  name,
  max: { perLevel: once(from) },
  recharge,
  fromLevel: from,
})

// --- Clases --------------------------------------------------------------------
// Para cada clase:
//   core: atributos básicos que no se pueden leer bien del texto.
//   columns / spellcasting / weaponMastery: tabla de la clase.
//   subclassFeatureLevels: niveles con "Rasgo de subclase" en la tabla.
//   features: configuración por slug del nombre del rasgo (choice, resources).
//   repeats: rasgos que la tabla vuelve a mostrar en otros niveles. Se duplican
//     con su propia elección; `text` es un texto corto que remite al rasgo
//     original y dice qué cambia (si no, se copia el texto entero).
//   choice.spells: de qué listas y niveles salen los conjuros de una elección
//     'conjuro' (toSheet: los elegidos van a la ficha como conjuros extra).
//   choice.alternative: opción de un estilo de combate que no es una dote
//     (Guerrero druídico, Guerrero bendito): dos trucos de otra lista.
//   choice.beasts / suggested: formas de bestia de Forma salvaje y las recomendadas.
//   alwaysPrepared: conjuros que un rasgo de clase deja siempre preparados.
export const CLASSES = [
  {
    id: 'barbaro',
    name: 'Bárbaro',
    core: {
      hitDie: 12,
      primaryAbilities: ['fue'],
      savingThrows: ['fue', 'con'],
      weaponText: 'Armas sencillas y marciales',
      weapons: { simple: true, martial: true },
      armorText: 'Armaduras ligeras y medias y escudos',
      armor: { ligera: true, media: true, pesada: false, escudo: true },
    },
    weaponMastery: steps([[1, 2], [4, 3], [10, 4]]),
    columns: [
      { key: 'furias', label: 'N.º de furias', values: RAGES },
      { key: 'dano-por-furia', label: 'Daño por furia', values: steps([[1, '+2'], [9, '+3'], [16, '+4']]) },
      { key: 'maestria-con-armas', label: 'Maestría con armas', values: steps([[1, 2], [4, 3], [10, 4]]) },
    ],
    subclassFeatureLevels: [6, 10, 14],
    features: {
      furia: {
        resources: [{ id: 'furia', name: 'Furia', max: { perLevel: RAGES }, recharge: 'corto-uno' }],
      },
      'maestria-con-armas': { choice: { kind: 'maestria-armas', count: 2 } },
      'conocimiento-primigenio': { choice: { kind: 'habilidad', count: 1, skillsFromClass: true } },
      'furia-persistente': { resources: [onceRes('furia-persistente', 'Furia persistente', 15)] },
    },
    repeats: [
      ...[
        [4, 'tres'],
        [10, 'cuatro'],
      ].map(([lvl, n]) => ({
        slug: 'maestria-con-armas',
        levels: [lvl],
        choice: { kind: 'maestria-armas', count: 1 },
        text: `Puedes usar las propiedades de maestría de un tipo más de arma cuerpo a cuerpo: ${n} en total. Lo demás funciona como explica Maestría con armas (nivel 1).`,
      })),
    ],
  },
  {
    id: 'bardo',
    name: 'Bardo',
    core: {
      hitDie: 8,
      primaryAbilities: ['car'],
      savingThrows: ['des', 'car'],
      weaponText: 'Armas sencillas',
      weapons: { simple: true, martial: false },
      armorText: 'Armaduras ligeras',
      armor: { ligera: true, media: false, pesada: false, escudo: false },
      toolText: 'Elige tres instrumentos musicales',
    },
    spellcasting: {
      ability: 'car',
      progression: 'completo',
      focus: 'instrumento musical',
      cantrips: CANTRIPS_2,
      prepared: PREPARED_FULL,
      ritual: true,
    },
    columns: [{ key: 'dado-bardico', label: 'Dado bárdico', values: BARD_DIE }],
    subclassFeatureLevels: [6, 14],
    features: {
      'inspiracion-bardica': {
        resources: [
          {
            id: 'inspiracion-bardica',
            name: 'Inspiración bárdica',
            max: { abilityMod: 'car', min: 1 },
            recharge: 'largo',
            rechargeFrom: [{ level: 5, recharge: 'corto' }],
            die: BARD_DIE,
          },
        ],
      },
      pericia: { choice: { kind: 'pericia', count: 2 } },
    },
    repeats: [
      {
        slug: 'pericia',
        levels: [9],
        choice: { kind: 'pericia', count: 2 },
        text: 'Ganas pericia en otras dos de tus competencias en habilidades de tu elección, como explica Pericia (nivel 2).',
      },
    ],
    alwaysPrepared: [{ level: 20, spells: ['Palabra de poder: sanar', 'Palabra de poder: matar'] }],
  },
  {
    id: 'brujo',
    name: 'Brujo',
    core: {
      hitDie: 8,
      primaryAbilities: ['car'],
      savingThrows: ['sab', 'car'],
      weaponText: 'Armas sencillas',
      weapons: { simple: true, martial: false },
      armorText: 'Armaduras ligeras',
      armor: { ligera: true, media: false, pesada: false, escudo: false },
    },
    spellcasting: {
      ability: 'car',
      progression: 'pacto',
      focus: 'canalizador arcano',
      cantrips: CANTRIPS_2,
      prepared: PREPARED_BRUJO,
      ritual: true,
    },
    columns: [
      { key: 'invocaciones', label: 'Invocaciones sobrenaturales', values: INVOCATIONS },
    ],
    subclassFeatureLevels: [6, 10, 14],
    features: {
      'invocaciones-sobrenaturales': { choice: { kind: 'invocacion', count: 1, options: 'invocaciones' } },
      'astucia-magica': { resources: [onceRes('astucia-magica', 'Astucia mágica', 2)] },
      'contactar-patron': { resources: [onceRes('contactar-patron', 'Contactar patrón', 9)] },
      'arcanum-mistico': {
        choice: { kind: 'conjuro', count: 1, note: 'Un conjuro de brujo de nivel 6 (arcanum).', spells: { lists: ['brujo'], levels: [6], toSheet: true } },
        resources: [onceRes('arcanum-mistico-6', 'Arcanum místico (nivel 6)', 11)],
      },
    },
    repeats: [
      // Invocaciones nuevas según la columna «Invocaciones» (1,3,3,3,5,5,6,6,7,...).
      ...[2, 5, 7, 9, 12, 15, 18].map((lvl) => {
        const n = INVOCATIONS[lvl - 1] - INVOCATIONS[lvl - 2]
        return {
          slug: 'invocaciones-sobrenaturales',
          levels: [lvl],
          choice: { kind: 'invocacion', count: n },
          text: `Aprendes ${n === 1 ? 'otra invocación' : `${n} invocaciones más`} de tu elección para ${n === 1 ? 'la' : 'las'} que cumplas los requisitos (ahora tienes ${INVOCATIONS[lvl - 1]} en total). ${n === 1 ? 'Funciona' : 'Funcionan'} como explica Invocaciones sobrenaturales (nivel 1).`,
        }
      }),
      ...[
        [13, 7],
        [15, 8],
        [17, 9],
      ].map(([lvl, sl]) => ({
        slug: 'arcanum-mistico',
        levels: [lvl],
        choice: { kind: 'conjuro', count: 1, note: `Un conjuro de brujo de nivel ${sl} (arcanum).`, spells: { lists: ['brujo'], levels: [sl], toSheet: true } },
        resources: [onceRes(`arcanum-mistico-${sl}`, `Arcanum místico (nivel ${sl})`, lvl)],
        text: `Escoge un conjuro de brujo de nivel ${sl} como otro arcanum. Puedes lanzarlo una vez sin gastar un espacio de conjuro y lo recuperas tras finalizar un descanso largo, como explica Arcanum místico (nivel 11).`,
      })),
    ],
    alwaysPrepared: [{ level: 9, spells: ['Contactar con otro plano'] }],
  },
  {
    id: 'clerigo',
    name: 'Clérigo',
    core: {
      hitDie: 8,
      primaryAbilities: ['sab'],
      savingThrows: ['sab', 'car'],
      weaponText: 'Armas sencillas',
      weapons: { simple: true, martial: false },
      armorText: 'Armaduras ligeras y medias y escudos',
      armor: { ligera: true, media: true, pesada: false, escudo: true },
    },
    spellcasting: {
      ability: 'sab',
      progression: 'completo',
      focus: 'símbolo sagrado',
      cantrips: CANTRIPS_3,
      prepared: PREPARED_FULL,
      ritual: true,
    },
    columns: [{ key: 'canalizar-divinidad', label: 'Canalizar divinidad', values: dash(CLERIC_CHANNEL) }],
    subclassFeatureLevels: [6, 17],
    features: {
      'orden-divina': { choice: { kind: 'opcion', count: 1, optionsFromLeadIns: ['Protector', 'Taumaturgo'] } },
      'canalizar-divinidad': {
        resources: [
          { id: 'canalizar-divinidad', name: 'Canalizar divinidad', max: { perLevel: CLERIC_CHANNEL }, recharge: 'corto-uno', fromLevel: 2 },
        ],
      },
      'golpes-benditos': { choice: { kind: 'opcion', count: 1, optionsFromLeadIns: ['Golpe divino', 'Lanzamiento potente'] } },
      'intercesion-divina': { resources: [onceRes('intercesion-divina', 'Intercesión divina', 10)] },
    },
    repeats: [],
  },
  {
    id: 'druida',
    name: 'Druida',
    core: {
      hitDie: 8,
      primaryAbilities: ['sab'],
      savingThrows: ['int', 'sab'],
      weaponText: 'Armas sencillas',
      weapons: { simple: true, martial: false },
      armorText: 'Armaduras ligeras y escudos',
      armor: { ligera: true, media: false, pesada: false, escudo: true },
      toolText: 'Útiles de herborista',
    },
    spellcasting: {
      ability: 'sab',
      progression: 'completo',
      focus: 'canalizador druídico',
      cantrips: CANTRIPS_2,
      prepared: PREPARED_FULL,
      ritual: true,
    },
    columns: [{ key: 'forma-salvaje', label: 'Forma salvaje', values: dash(WILD_SHAPE) }],
    subclassFeatureLevels: [6, 10, 14],
    features: {
      'orden-primigenia': { choice: { kind: 'opcion', count: 1, optionsFromLeadIns: ['Guardián', 'Naturalista'] } },
      'forma-salvaje': {
        choice: {
          kind: 'opcion',
          count: 4,
          // Opciones: las bestias del apartado «Animales» (bestias.mjs).
          beasts: { maxCr: 1 / 4, fly: false },
          // Las que recomienda el SRD.
          suggested: ['arana', 'caballo-de-monta', 'lobo', 'rata'],
          note: 'Formas de bestia conocidas: bestias de VD 1/4 o menos sin velocidad volando (consulta la tabla «Formas de bestia»).',
        },
        resources: [
          { id: 'forma-salvaje', name: 'Forma salvaje', max: { perLevel: WILD_SHAPE }, recharge: 'corto-uno', fromLevel: 2 },
        ],
      },
      'resurgimiento-salvaje': {
        resources: [onceRes('resurgimiento-salvaje', 'Resurgimiento salvaje (espacio de conjuro)', 5)],
      },
      'furia-elemental': { choice: { kind: 'opcion', count: 1, optionsFromLeadIns: ['Golpe primordial', 'Lanzamiento potente'] } },
      archidruida: { resources: [onceRes('mago-de-la-naturaleza', 'Mago de la naturaleza (Forma salvaje → espacio)', 20)] },
    },
    repeats: [
      {
        slug: 'forma-salvaje',
        levels: [4],
        choice: {
          kind: 'opcion',
          count: 2,
          beasts: { maxCr: 1 / 2, fly: false },
          suggested: ['oso-negro', 'simio'],
          note: 'Dos formas de bestia conocidas más (VD máx. 1/2, sin velocidad volando).',
        },
        noResources: true,
        text: 'Conoces dos formas de bestia más (seis en total), que ya pueden tener un valor de desafío de hasta 1/2, aún sin velocidad volando. Lo demás funciona como explica Forma salvaje (nivel 2).',
      },
      {
        slug: 'forma-salvaje',
        levels: [8],
        choice: {
          kind: 'opcion',
          count: 2,
          beasts: { maxCr: 1, fly: true },
          suggested: ['oso-pardo', 'murcielago-gigante'],
          note: 'Dos formas de bestia conocidas más (VD máx. 1; ya pueden tener velocidad volando).',
        },
        noResources: true,
        text: 'Conoces dos formas de bestia más (ocho en total), que ya pueden tener un valor de desafío de hasta 1 y velocidad volando. Lo demás funciona como explica Forma salvaje (nivel 2).',
      },
    ],
    alwaysPrepared: [{ level: 1, spells: ['Hablar con los animales'] }],
  },
  {
    id: 'explorador',
    name: 'Explorador',
    core: {
      hitDie: 10,
      primaryAbilities: ['des', 'sab'],
      savingThrows: ['fue', 'des'],
      weaponText: 'Armas sencillas y marciales',
      weapons: { simple: true, martial: true },
      armorText: 'Armaduras ligeras y medias y escudos',
      armor: { ligera: true, media: true, pesada: false, escudo: true },
    },
    spellcasting: {
      ability: 'sab',
      progression: 'medio',
      focus: 'canalizador druídico',
      cantrips: r20(() => 0),
      prepared: PREPARED_MEDIO,
      ritual: true,
    },
    weaponMastery: r20(() => 2),
    columns: [{ key: 'enemigo-predilecto', label: 'Enemigo predilecto', values: FAVORED_ENEMY }],
    subclassFeatureLevels: [7, 11, 15],
    features: {
      'enemigo-predilecto': {
        resources: [
          { id: 'enemigo-predilecto', name: 'Enemigo predilecto (marca del cazador gratis)', max: { perLevel: FAVORED_ENEMY }, recharge: 'largo' },
        ],
      },
      'maestria-con-armas': { choice: { kind: 'maestria-armas', count: 2 } },
      'estilo-de-combate': {
        choice: {
          kind: 'estilo-combate',
          count: 1,
          note: 'O, en su lugar, la opción Guerrero druídico (dos trucos de druida).',
          // Opción que no es una dote: sale del párrafo con esa entradilla.
          alternative: { name: 'Guerrero druídico', cantrips: { list: 'druida', count: 2, ability: 'sab', suggested: ['guia', 'voluta-estelar'] } },
        },
      },
      'explorador-habil': { choice: { kind: 'pericia', count: 1, languages: 2, note: 'Además, aprendes dos idiomas de tu elección.' } },
      pericia: { choice: { kind: 'pericia', count: 2 } },
      infatigable: {
        resources: [
          { id: 'infatigable', name: 'Infatigable (PG temporales)', max: { abilityMod: 'sab', min: 1 }, recharge: 'largo', fromLevel: 10 },
        ],
      },
      'velo-de-la-naturaleza': {
        resources: [
          { id: 'velo-de-la-naturaleza', name: 'Velo de la naturaleza', max: { abilityMod: 'sab', min: 1 }, recharge: 'largo', fromLevel: 14 },
        ],
      },
    },
    repeats: [],
    alwaysPrepared: [{ level: 1, spells: ['Marca del cazador'] }],
  },
  {
    id: 'guerrero',
    name: 'Guerrero',
    core: {
      hitDie: 10,
      primaryAbilities: ['fue', 'des'],
      savingThrows: ['fue', 'con'],
      weaponText: 'Armas sencillas y marciales',
      weapons: { simple: true, martial: true },
      armorText: 'Armaduras ligeras, medias y pesadas y escudos',
      armor: { ligera: true, media: true, pesada: true, escudo: true },
    },
    weaponMastery: steps([[1, 3], [4, 4], [10, 5], [16, 6]]),
    columns: [
      { key: 'tomar-aliento', label: 'Tomar aliento', values: SECOND_WIND },
      { key: 'maestria-con-armas', label: 'Maestría con armas', values: steps([[1, 3], [4, 4], [10, 5], [16, 6]]) },
    ],
    subclassFeatureLevels: [7, 10, 15, 18],
    features: {
      'estilo-de-combate': { choice: { kind: 'estilo-combate', count: 1 } },
      'maestria-con-armas': { choice: { kind: 'maestria-armas', count: 3 } },
      'tomar-aliento': {
        resources: [{ id: 'tomar-aliento', name: 'Tomar aliento', max: { perLevel: SECOND_WIND }, recharge: 'corto-uno' }],
      },
      'accion-subita': {
        resources: [
          { id: 'accion-subita', name: 'Acción súbita', max: { perLevel: steps([[2, 1], [17, 2]]) }, recharge: 'corto', fromLevel: 2 },
        ],
      },
      indomito: {
        resources: [
          { id: 'indomito', name: 'Indómito', max: { perLevel: steps([[9, 1], [13, 2], [17, 3]]) }, recharge: 'largo', fromLevel: 9 },
        ],
      },
    },
    repeats: [
      ...[
        [4, 'cuatro'],
        [10, 'cinco'],
        [16, 'seis'],
      ].map(([lvl, n]) => ({
        slug: 'maestria-con-armas',
        levels: [lvl],
        choice: { kind: 'maestria-armas', count: 1 },
        text: `Puedes usar las propiedades de maestría de un tipo más de arma: ${n} en total. Lo demás funciona como explica Maestría con armas (nivel 1).`,
      })),
    ],
  },
  {
    id: 'hechicero',
    name: 'Hechicero',
    core: {
      hitDie: 6,
      primaryAbilities: ['car'],
      savingThrows: ['con', 'car'],
      weaponText: 'Armas sencillas',
      weapons: { simple: true, martial: false },
      armorText: 'Ninguna',
      armor: { ligera: false, media: false, pesada: false, escudo: false },
    },
    spellcasting: {
      ability: 'car',
      progression: 'completo',
      focus: 'canalizador arcano',
      cantrips: CANTRIPS_4,
      prepared: PREPARED_HECHICERO,
      ritual: true,
    },
    columns: [{ key: 'puntos-de-hechiceria', label: 'Puntos de hechicería', values: dash(SORCERY_POINTS) }],
    subclassFeatureLevels: [6, 14, 18],
    features: {
      'hechiceria-innata': {
        resources: [{ id: 'hechiceria-innata', name: 'Hechicería innata', max: { perLevel: r20(() => 2) }, recharge: 'largo' }],
      },
      'fuente-de-magia': {
        resources: [
          {
            id: 'puntos-de-hechiceria',
            name: 'Puntos de hechicería',
            max: { perLevel: SORCERY_POINTS },
            recharge: 'largo',
            pool: true,
            fromLevel: 2,
          },
        ],
      },
      metamagia: { choice: { kind: 'metamagia', count: 2, options: 'metamagia' } },
      'recuperacion-magica': { resources: [onceRes('recuperacion-magica', 'Recuperación mágica', 5)] },
    },
    repeats: [
      ...[
        [10, 'cuatro'],
        [17, 'seis'],
      ].map(([lvl, n]) => ({
        slug: 'metamagia',
        levels: [lvl],
        choice: { kind: 'metamagia', count: 2 },
        text: `Consigues otras dos opciones de metamagia de tu elección (${n} en total). Funcionan como explica Metamagia (nivel 2).`,
      })),
    ],
  },
  {
    id: 'mago',
    name: 'Mago',
    core: {
      hitDie: 6,
      primaryAbilities: ['int'],
      savingThrows: ['int', 'sab'],
      weaponText: 'Armas sencillas',
      weapons: { simple: true, martial: false },
      armorText: 'Ninguna',
      armor: { ligera: false, media: false, pesada: false, escudo: false },
    },
    spellcasting: {
      ability: 'int',
      progression: 'completo',
      focus: 'canalizador arcano o libro de conjuros',
      cantrips: CANTRIPS_3,
      prepared: PREPARED_MAGO,
      ritual: true,
    },
    columns: [],
    subclassFeatureLevels: [6, 10, 14],
    features: {
      'recuperacion-arcana': { resources: [onceRes('recuperacion-arcana', 'Recuperación arcana', 1)] },
      academico: {
        choice: {
          kind: 'pericia',
          count: 1,
          skillOptions: ['Conocimiento arcano', 'Historia', 'Investigación', 'Medicina', 'Naturaleza', 'Religión'],
          note: 'Debes tener competencia en la habilidad elegida.',
        },
      },
      'maestria-sobre-conjuros': {
        choice: {
          kind: 'conjuro',
          count: 2,
          note: 'Un conjuro de nivel 1 y otro de nivel 2 de tu libro de conjuros con tiempo de lanzamiento de una acción.',
          spells: { lists: ['mago'], levels: [1, 2], onePerLevel: true, castingTime: 'Acción', toSheet: true },
        },
      },
      'conjuros-caracteristicos': {
        choice: { kind: 'conjuro', count: 2, note: 'Dos conjuros de nivel 3 de tu libro de conjuros.', spells: { lists: ['mago'], levels: [3], toSheet: true } },
        resources: [
          { id: 'conjuros-caracteristicos', name: 'Conjuros característicos', max: { perLevel: steps([[20, 2]]) }, recharge: 'corto', fromLevel: 20 },
        ],
      },
    },
    repeats: [],
  },
  {
    id: 'monje',
    name: 'Monje',
    core: {
      hitDie: 8,
      primaryAbilities: ['des', 'sab'],
      savingThrows: ['fue', 'des'],
      weaponText: 'Armas sencillas, además de marciales que tengan la propiedad “ligera”',
      weapons: { simple: true, martial: 'ligeras' }, // marciales con la propiedad Ligera
      armorText: 'Ninguna',
      armor: { ligera: false, media: false, pesada: false, escudo: false },
      toolText: 'Elige un tipo de herramientas de artesano o instrumento musical',
    },
    columns: [
      { key: 'artes-marciales', label: 'Artes marciales', values: steps([[1, '1d6'], [5, '1d8'], [11, '1d10'], [17, '1d12']]) },
      { key: 'puntos-de-concentracion', label: 'Puntos de concentración', values: dash(FOCUS_POINTS) },
      {
        key: 'movimiento-sin-armadura',
        label: 'Movimiento sin armadura',
        values: steps([[2, '+3 m'], [6, '+4,5 m'], [10, '+6 m'], [14, '+7,5 m'], [18, '+9 m']], '—'),
      },
    ],
    subclassFeatureLevels: [6, 11, 17],
    features: {
      'concentracion-de-monje': {
        resources: [
          {
            id: 'puntos-de-concentracion',
            name: 'Puntos de concentración',
            max: { perLevel: FOCUS_POINTS },
            recharge: 'corto',
            pool: true,
            fromLevel: 2,
          },
        ],
      },
      'metabolismo-asombroso': { resources: [onceRes('metabolismo-asombroso', 'Metabolismo asombroso', 2)] },
    },
    repeats: [],
  },
  {
    id: 'paladin',
    name: 'Paladín',
    core: {
      hitDie: 10,
      primaryAbilities: ['fue', 'car'],
      savingThrows: ['sab', 'car'],
      weaponText: 'Armas sencillas y marciales',
      weapons: { simple: true, martial: true },
      armorText: 'Armaduras ligeras, medias y pesadas y escudos',
      armor: { ligera: true, media: true, pesada: true, escudo: true },
    },
    spellcasting: {
      ability: 'car',
      progression: 'medio',
      focus: 'símbolo sagrado',
      cantrips: r20(() => 0),
      prepared: PREPARED_MEDIO,
      ritual: true,
    },
    weaponMastery: r20(() => 2),
    columns: [{ key: 'canalizar-divinidad', label: 'Canalizar divinidad', values: dash(PALADIN_CHANNEL) }],
    subclassFeatureLevels: [7, 15, 20],
    features: {
      'imponer-las-manos': {
        resources: [
          { id: 'imponer-las-manos', name: 'Imponer las manos', max: { levelTimes: 5 }, recharge: 'largo', pool: true },
        ],
      },
      'maestria-con-armas': { choice: { kind: 'maestria-armas', count: 2 } },
      'castigo-de-paladin': {
        resources: [onceRes('castigo-de-paladin', 'Castigo de paladín (castigo divino gratis)', 2)],
      },
      'estilo-de-combate': {
        choice: {
          kind: 'estilo-combate',
          count: 1,
          note: 'O, en su lugar, la opción Guerrero bendito (dos trucos de clérigo).',
          alternative: { name: 'Guerrero bendito', cantrips: { list: 'clerigo', count: 2, ability: 'car', suggested: ['guia', 'llama-sagrada'] } },
        },
      },
      'canalizar-divinidad': {
        resources: [
          { id: 'canalizar-divinidad', name: 'Canalizar divinidad', max: { perLevel: PALADIN_CHANNEL }, recharge: 'corto-uno', fromLevel: 3 },
        ],
      },
      'corcel-fiel': { resources: [onceRes('corcel-fiel', 'Corcel fiel (hallar corcel gratis)', 5)] },
    },
    repeats: [],
    alwaysPrepared: [
      { level: 2, spells: ['Castigo divino'] },
      { level: 5, spells: ['Hallar corcel'] },
    ],
  },
  {
    id: 'picaro',
    name: 'Pícaro',
    core: {
      hitDie: 8,
      primaryAbilities: ['des'],
      savingThrows: ['des', 'int'],
      weaponText: 'Armas sencillas, además de marciales que tengan las propiedades “ligera” o “sutil”',
      weapons: { simple: true, martial: 'sutiles-o-ligeras' }, // marciales con Sutil o Ligera
      armorText: 'Armaduras ligeras',
      armor: { ligera: true, media: false, pesada: false, escudo: false },
      toolText: 'Herramientas de ladrón',
    },
    weaponMastery: r20(() => 2),
    columns: [{ key: 'ataque-furtivo', label: 'Ataque furtivo', values: r20((l) => `${Math.ceil(l / 2)}d6`) }],
    subclassFeatureLevels: [9, 13, 17],
    features: {
      pericia: { choice: { kind: 'pericia', count: 2 } },
      'jerga-de-ladrones': { choice: { kind: 'idioma', count: 1 } },
      'maestria-con-armas': { choice: { kind: 'maestria-armas', count: 2 } },
      'golpe-de-suerte': { resources: [onceRes('golpe-de-suerte', 'Golpe de suerte', 20, 'corto')] },
    },
    repeats: [
      {
        slug: 'pericia',
        levels: [6],
        choice: { kind: 'pericia', count: 2 },
        text: 'Ganas pericia en otras dos de tus competencias en habilidades de tu elección, como explica Pericia (nivel 1).',
      },
    ],
  },
]

// --- Subclases -----------------------------------------------------------------
// spellTable: tabla "Conjuros de ..." (se convierte en alwaysPrepared y en una
// tabla Markdown dentro del rasgo).
export const SUBCLASSES = {
  barbaro: {
    features: {
      'presencia-intimidante': { resources: [onceRes('presencia-intimidante', 'Presencia intimidante', 14)] },
    },
  },
  bardo: {
    features: {
      'competencias-adicionales': { choice: { kind: 'habilidad', count: 3 } },
      'descubrimientos-magicos': {
        choice: {
          kind: 'conjuro',
          count: 2,
          note: 'De las listas de clérigo, druida o mago; trucos o conjuros de un nivel para el que tengas espacios. Siempre preparados.',
          spells: { lists: ['clerigo', 'druida', 'mago'], upToSlots: true, toSheet: true },
        },
      },
    },
  },
  brujo: {
    spellFeature: 'conjuros-del-infernal',
    spellTable: [
      [3, ['Manos ardientes', 'Orden imperiosa', 'Rayo abrasador', 'Sugestión']],
      [5, ['Bola de fuego', 'Nube apestosa']],
      [7, ['Escudo de fuego', 'Muro de fuego']],
      [9, ['Geas', 'Plaga de insectos']],
    ],
    features: {
      'la-suerte-del-oscuro': {
        resources: [
          { id: 'la-suerte-del-oscuro', name: 'La suerte del oscuro', max: { abilityMod: 'car', min: 1 }, recharge: 'largo', fromLevel: 6 },
        ],
      },
      'arrastrar-por-el-infierno': { resources: [onceRes('arrastrar-por-el-infierno', 'Arrastrar por el infierno', 14)] },
    },
  },
  clerigo: {
    spellFeature: 'conjuros-del-dominio-de-la-vida',
    spellTable: [
      [3, ['Auxilio', 'Bendición', 'Curar heridas', 'Restablecimiento menor']],
      [5, ['Palabra de curación en masa', 'Revivir']],
      [7, ['Aura de vida', 'Guarda contra la muerte']],
      [9, ['Curar heridas en masa', 'Restablecimiento mayor']],
    ],
    features: {},
  },
  druida: {
    // Conjuros según el tipo de terreno elegido: no cabe en alwaysPrepared (que no
    // depende de elecciones). Se guardan en `alwaysPreparedByOption` (campo extra).
    spellFeature: 'conjuros-del-circulo-de-la-tierra',
    terrains: [
      {
        id: 'arido',
        name: 'Terreno árido',
        resistance: 'Fuego',
        spells: [
          [3, ['Contorno borroso', 'Descarga de fuego', 'Manos ardientes']],
          [5, ['Bola de fuego']],
          [7, ['Marchitar']],
          [9, ['Muro de piedra']],
        ],
      },
      {
        id: 'polar',
        name: 'Terreno polar',
        resistance: 'Frío',
        spells: [
          [3, ['Inmovilizar persona', 'Nube de oscurecimiento', 'Rayo de escarcha']],
          [5, ['Tormenta de aguanieve']],
          [7, ['Tormenta de hielo']],
          [9, ['Cono de frío']],
        ],
      },
      {
        id: 'templado',
        name: 'Terreno templado',
        resistance: 'Relámpago',
        spells: [
          [3, ['Agarre electrizante', 'Dormir', 'Paso brumoso']],
          [5, ['Relámpago']],
          [7, ['Libertad de movimiento']],
          [9, ['Paso arbóreo']],
        ],
      },
      {
        id: 'tropical',
        name: 'Terreno tropical',
        resistance: 'Veneno',
        spells: [
          [3, ['Rayo nauseabundo', 'Salpicadura ácida', 'Telaraña']],
          [5, ['Nube apestosa']],
          [7, ['Polimorfar']],
          [9, ['Plaga de insectos']],
        ],
      },
    ],
    features: {
      'recuperacion-natural': {
        resources: [
          onceRes('recuperacion-natural-conjuro', 'Recuperación natural (conjuro gratis)', 6),
          onceRes('recuperacion-natural-espacios', 'Recuperación natural (recuperar espacios)', 6),
        ],
      },
    },
  },
  explorador: {
    features: {
      'el-cazador-y-la-presa': {
        choice: {
          kind: 'opcion',
          count: 1,
          optionsFromLeadIns: ['Azote de colosos', 'Destructor de hordas'],
          note: 'Puedes cambiarla tras un descanso corto o largo.',
        },
      },
      'tacticas-defensivas': {
        choice: {
          kind: 'opcion',
          count: 1,
          optionsFromLeadIns: ['Defensa contra ataques múltiples', 'Escapar de la horda'],
          note: 'Puedes cambiarla tras un descanso corto o largo.',
        },
      },
    },
  },
  guerrero: {
    features: {
      'estilo-de-combate-adicional': { choice: { kind: 'estilo-combate', count: 1 } },
    },
  },
  hechicero: {
    spellFeature: 'conjuros-draconicos',
    spellTable: [
      [3, ['Aliento de dragón', 'Alterar el propio aspecto', 'Orbe cromático', 'Orden imperiosa']],
      [5, ['Terror', 'Volar']],
      [7, ['Hechizar monstruo', 'Ojo arcano']],
      [9, ['Conocer las leyendas', 'Invocar dragón']],
    ],
    features: {
      'afinidad-elemental': {
        choice: {
          kind: 'opcion',
          count: 1,
          options: [
            { id: 'acido', name: 'Ácido' },
            { id: 'frio', name: 'Frío' },
            { id: 'fuego', name: 'Fuego' },
            { id: 'relampago', name: 'Relámpago' },
            { id: 'veneno', name: 'Veneno' },
          ],
        },
      },
      'alas-de-dragon': { resources: [onceRes('alas-de-dragon', 'Alas de dragón', 14)] },
      'companero-dragon': { resources: [onceRes('companero-dragon', 'Compañero dragón (invocar dragón gratis)', 18)] },
    },
  },
  mago: {
    features: {
      'experto-en-evocacion': {
        choice: {
          kind: 'conjuro',
          count: 2,
          note: 'Dos conjuros de mago de evocación de nivel 2 o inferior, gratis en tu libro.',
          // Van al libro de conjuros, que la ficha no lleva: quedan apuntados en la elección.
          spells: { lists: ['mago'], levels: [1, 2], school: 'Evocación' },
        },
      },
    },
  },
  monje: {
    features: {
      'plenitud-de-cuerpo': {
        resources: [
          { id: 'plenitud-de-cuerpo', name: 'Plenitud de cuerpo', max: { abilityMod: 'sab', min: 1 }, recharge: 'largo', fromLevel: 6 },
        ],
      },
    },
  },
  paladin: {
    spellFeature: 'conjuros-del-juramento-de-entrega',
    spellTable: [
      [3, ['Escudo de fe', 'Protección contra el bien y el mal']],
      [5, ['Auxilio', 'Zona de la verdad']],
      [9, ['Disipar magia', 'Señal de esperanza']],
      [13, ['Guardián de la fe', 'Libertad de movimiento']],
      [17, ['Comunión', 'Golpe flamígero']],
    ],
    features: {
      'halo-sagrado': { resources: [onceRes('halo-sagrado', 'Halo sagrado', 20)] },
    },
  },
  picaro: { features: {} },
}

// --- Correcciones de texto -------------------------------------------------------
// Problemas de maquetación del PDF que la extracción no puede resolver sola.
// `find` se busca en los párrafos unidos con "\n"; `replace` puede usar "\n"
// para partir un párrafo.
export const TEXT_FIXES = [
  {
    feature: 'explorador-explorador-habil',
    find: 'beneficios. Idiomas. Conoces',
    replace: 'beneficios.\nIdiomas. Conoces',
  },
  {
    feature: 'ladron-sigilo-supremo',
    find: 'Golpe astuto. Ataque sigiloso (coste: 1d6). Si',
    replace: 'Golpe astuto.\nAtaque sigiloso (coste: 1d6). Si',
  },
  {
    // En el PDF en español la frase aparece antes de "Retirada"; pertenece a "Veneno".
    feature: 'picaro-golpe-astuto',
    find: '\nPara usar este efecto, debes llevar contigo unos útiles de envenenador.',
    replace: '',
  },
  {
    feature: 'picaro-golpe-astuto',
    find: 'se librará del efecto.',
    replace: 'se librará del efecto. Para usar este efecto, debes llevar contigo unos útiles de envenenador.',
    optional: true,
  },
  { feature: 'picaro-talentos-fiables', find: 'en el d20 por un 10', replace: 'en el d20 por un 10.' },
]

// Recuadros laterales que el PDF intercala en otro rasgo: se mueven a su sitio.
export const SIDEBARS = [
  {
    classId: 'paladin',
    start: 'Romper tu juramento',
    title: 'Romper tu juramento',
    moveTo: 'paladin-subclase-de-paladin',
  },
  {
    classId: 'mago',
    start: 'Ampliar y sustituir un libro de',
    title: 'Ampliar y sustituir un libro de conjuros',
    moveTo: 'mago-lanzamiento-de-conjuros',
  },
]
