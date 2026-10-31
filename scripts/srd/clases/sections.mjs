// Localiza en las líneas del SRD las secciones de cada clase.

export const CLASS_NAMES = {
  barbaro: ['Bárbaro', 'bárbaro'],
  bardo: ['Bardo', 'bardo'],
  brujo: ['Brujo', 'brujo'],
  clerigo: ['Clérigo', 'clérigo'],
  druida: ['Druida', 'druida'],
  explorador: ['Explorador', 'explorador'],
  guerrero: ['Guerrero', 'guerrero'],
  hechicero: ['Hechicero', 'hechicero'],
  mago: ['Mago', 'mago'],
  monje: ['Monje', 'monje'],
  paladin: ['Paladín', 'paladín'],
  picaro: ['Pícaro', 'pícaro'],
}

const ALL_TITLES = new Set(Object.values(CLASS_NAMES).map((n) => n[0]))

function indexOfExact(L, text, from = 0) {
  for (let i = from; i < L.length; i++) if (L[i] === text) return i
  return -1
}
function indexWhere(L, pred, from = 0) {
  for (let i = from; i < L.length; i++) if (pred(L[i], i)) return i
  return -1
}

/** Fin de la sección de clase: siguiente encabezado de otra parte del capítulo. */
function sectionEnd(L, from, stopAtTables = false) {
  return indexWhere(
    L,
    (l) =>
      ALL_TITLES.has(l) ||
      (stopAtTables && /^Rasgos de [a-záéíóú]+$/.test(l)) ||
      /^Atributos básicos de /.test(l) ||
      /^(Lista de conjuros de |Subclase de [a-záéíóú]+: |Opciones de )/.test(l) ||
      l === 'Orígenes',
    from + 1,
  )
}

/**
 * Devuelve los rangos [inicio, fin) de cada parte de una clase.
 */
export function classSections(L, id) {
  const [, lower] = CLASS_NAMES[id]
  // El capítulo de clases empieza en "Clases"; buscamos a partir de ahí.
  const chapter = indexOfExact(L, 'Clases', 1000)
  const core = indexOfExact(L, `Atributos básicos de ${lower}`, chapter)
  const feats = indexOfExact(L, `Rasgos de clase de ${lower}`, chapter)
  const sub = indexWhere(L, (l) => l.startsWith(`Subclase de ${lower}: `), chapter)
  const list = indexOfExact(L, `Lista de conjuros de ${lower}`, chapter)
  const options = indexWhere(L, (l, i) => i > feats && /^Opciones de /.test(l) && i < (list > 0 ? list : sub), feats)
  if (core < 0 || feats < 0 || sub < 0) throw new Error(`Secciones no encontradas para ${id}`)
  return {
    core: [core, core + 45],
    features: [feats + 1, sectionEnd(L, feats)],
    options: options > 0 ? [options, sectionEnd(L, options)] : null,
    spellList: list > 0 ? [list, sectionEnd(L, list)] : null,
    subclass: [sub, sectionEnd(L, sub, true)],
  }
}
