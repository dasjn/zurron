// Genera src/data/srd/classes.json, subclasses.json y spell-slots.json a partir
// del SRD 5.2.1 en español. Uso (desde app/):  node scripts/srd/clases/build.mjs
//
// - La prosa de los rasgos sale de es-raw.txt (lib.mjs/loadSrdLines).
// - Las tablas numéricas están en data.mjs y validate.mjs las contrasta con
//   las tablas de en.txt; las tablas de espacios de conjuro se leen de es.txt.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadSrdLines, slugify, writeJson, APP_DIR } from '../lib.mjs'
import { classSections, CLASS_NAMES } from './sections.mjs'
import { splitFeatures, linesToParagraphs, toRichText, mdTable, HEADING } from './text.mjs'
import { parseSpellList, parseSpellDescriptions } from './spells.mjs'
import { CLASSES, SUBCLASSES, TEXT_FIXES, SIDEBARS, PACT } from './data.mjs'
import { CLASS_SUMMARIES, FEATURE_SUMMARIES, OPTION_SUMMARIES, SUBCLASS_SUMMARIES, genericSummary } from './summaries.mjs'
import { parseBeasts, beastOptions } from './bestias.mjs'
import { validate } from './validate.mjs'

const L = loadSrdLines()
const log = []
const warn = (m) => log.push(m)

// ---------------------------------------------------------------------------
// Habilidades

const SKILL_IDS = {
  acrobacias: 'acrobacias',
  'conocimiento-arcano': 'arcanos',
  arcanos: 'arcanos',
  atletismo: 'atletismo',
  engano: 'engano',
  historia: 'historia',
  interpretacion: 'interpretacion',
  intimidacion: 'intimidacion',
  investigacion: 'investigacion',
  'juego-de-manos': 'juego-de-manos',
  medicina: 'medicina',
  naturaleza: 'naturaleza',
  percepcion: 'percepcion',
  perspicacia: 'perspicacia',
  persuasion: 'persuasion',
  religion: 'religion',
  sigilo: 'sigilo',
  supervivencia: 'supervivencia',
  'trato-con-animales': 'trato-con-animales',
}
function skillId(name) {
  const id = SKILL_IDS[slugify(name)]
  if (!id) throw new Error(`Habilidad desconocida: ${name}`)
  return id
}
const SKILL_NAMES = {
  acrobacias: 'Acrobacias',
  arcanos: 'Conocimiento arcano',
  atletismo: 'Atletismo',
  engano: 'Engaño',
  historia: 'Historia',
  interpretacion: 'Interpretación',
  intimidacion: 'Intimidación',
  investigacion: 'Investigación',
  'juego-de-manos': 'Juego de manos',
  medicina: 'Medicina',
  naturaleza: 'Naturaleza',
  percepcion: 'Percepción',
  perspicacia: 'Perspicacia',
  persuasion: 'Persuasión',
  religion: 'Religión',
  sigilo: 'Sigilo',
  supervivencia: 'Supervivencia',
  'trato-con-animales': 'Trato con animales',
}
const COUNTS = { una: 1, dos: 2, tres: 3, cuatro: 4 }

// ---------------------------------------------------------------------------
// Atributos básicos

function parseCore(id, [a, b]) {
  const lines = L.slice(a, b)
  const skillLine = lines.find((l) => /^Elige (dos|tres|cuatro)\b/.test(l))
  if (!skillLine) throw new Error(`${id}: sin línea de habilidades`)
  const m = skillLine.match(/^Elige (dos|tres|cuatro)( cualesquiera)?:?\s*(.*)$/)
  const count = COUNTS[m[1]]
  let from
  if (m[2]) from = 'cualquiera'
  else {
    from = m[3]
      .replace(/\.$/, '')
      .split(/, | o /)
      .map((s) => skillId(s.trim()))
  }
  const eqLine = lines.find((l) => /^Elige A(, B)? o [BC]:/.test(l))
  if (!eqLine) throw new Error(`${id}: sin equipo inicial`)
  const body = eqLine.replace(/^Elige [^:]+:\s*/, '')
  const startingEquipment = []
  const re = /\(([A-C])\)\s*(.*?)(?=(?:,? o |; )\([A-C]\)|$)/g
  let mm
  while ((mm = re.exec(body))) startingEquipment.push({ option: mm[1], text: mm[2].trim().replace(/[;,]$/, '') })
  const hitDie = lines.map((l) => l.match(/1d(\d+) por nivel de/)).find(Boolean)
  return { skillChoices: { count, from }, startingEquipment, hitDieText: hitDie ? Number(hitDie[1]) : null, raw: lines }
}

// ---------------------------------------------------------------------------
// Opciones (invocaciones, metamagia)

function parseOptions([a, b]) {
  const lines = L.slice(a + 2, b) // salta el título y la frase de introducción
  const items = []
  const nextNonEmpty = (i) => {
    for (let j = i + 1; j < lines.length; j++) if (lines[j]) return lines[j]
    return ''
  }
  lines.forEach((l, i) => {
    if (!l) {
      if (items.length) items[items.length - 1].lines.push(l)
      return
    }
    const isName =
      l.length <= 50 &&
      /^[A-ZÁÉÍÓÚÑ]/.test(l) &&
      !/[.:;!?)]$/.test(l) &&
      !/^(Requisitos|Coste):/.test(l) &&
      !/^[a-záéíóúñ]/.test(nextNonEmpty(i))
    if (isName) items.push({ name: l, meta: [], lines: [] })
    else if (/^(Requisitos|Coste):/.test(l)) items[items.length - 1].meta.push(l)
    else items[items.length - 1].lines.push(l)
  })
  return items.map((it) => {
    const dropped = []
    const paras = linesToParagraphs(it.lines, dropped)
    if (dropped.length) warn(`Opción ${it.name}: descartado ${JSON.stringify(dropped)}`)
    const meta = it.meta.map((m) => m.replace(/^(Requisitos|Coste):\s*/, '**$1:** ').replace(/([^.])$/, '$1.'))
    return { id: slugify(it.name), name: it.name, text: [...meta, toRichText(paras)].join('\n\n') }
  })
}

// ---------------------------------------------------------------------------
// Rasgos

/** Quita los recuadros laterales del rango y los devuelve aparte. */
function extractSidebars(classId, lines) {
  const out = []
  for (const sb of SIDEBARS.filter((s) => s.classId === classId)) {
    const i = lines.indexOf(sb.start)
    if (i < 0) throw new Error(`Recuadro no encontrado: ${sb.start}`)
    let j = i + 1
    while (j < lines.length && !HEADING.test(lines[j])) j++
    const body = lines.slice(i + 1, j).filter((l) => !/^conjuros$/.test(l)) // resto del título partido
    lines.splice(i, j - i)
    out.push({ ...sb, paras: linesToParagraphs(body) })
  }
  return out
}

function applyFixes(fid, paras) {
  let joined = paras.join('\n')
  for (const fx of TEXT_FIXES.filter((f) => f.feature === fid)) {
    if (!joined.includes(fx.find)) {
      if (!fx.optional) throw new Error(`Corrección no aplicada en ${fid}: ${fx.find}`)
      continue
    }
    joined = joined.replace(fx.find, fx.replace)
    fx.applied = true
  }
  return joined.split('\n').filter(Boolean)
}

/** Tablas que el PDF trae dentro de un rasgo (se reconstruyen en Markdown). */
const INLINE_TABLES = {
  'druida-forma-salvaje': {
    after: 'Al escoger las formas conocidas',
    title: 'Formas de bestia',
    header: ['Nivel de druida', 'Formas conocidas', 'VD máx.', 'Velocidad volando'],
    rows: [
      ['2', '4', '1/4', 'No'],
      ['4', '6', '1/2', 'No'],
      ['8', '8', '1', 'Sí'],
    ],
  },
  'hechicero-fuente-de-magia': {
    after: 'Cualquier espacio creado mediante este rasgo',
    title: 'Crear espacios de conjuro',
    header: ['Nivel del espacio de conjuro', 'Coste en puntos de hechicería', 'Nivel mínimo de hechicero'],
    rows: [
      ['1', '2', '2'],
      ['2', '3', '3'],
      ['3', '5', '5'],
      ['4', '6', '7'],
      ['5', '7', '9'],
    ],
  },
}

function insertTable(paras, t) {
  const block = [`**${t.title}**`, mdTable(t.header, t.rows)]
  if (!t.after) return [...paras, ...block]
  const i = paras.findIndex((p) => p.startsWith(t.after))
  if (i < 0) throw new Error(`Tabla ${t.title}: párrafo "${t.after}" no encontrado`)
  return [...paras.slice(0, i + 1), ...block, ...paras.slice(i + 1)]
}

/** Opciones de un rasgo a partir de sus párrafos con encabezado en línea. */
function optionsFromLeadIns(paras, names) {
  return names.map((name) => {
    const p = paras.find((x) => x.startsWith(name + '.'))
    if (!p) throw new Error(`Opción "${name}" no encontrada`)
    return { id: slugify(name), name, text: p.slice(name.length + 1).trim() }
  })
}

function buildChoice(cfg, fid, paras, ctx) {
  if (!cfg) return undefined
  const c = { id: fid, kind: cfg.kind, count: cfg.count }
  if (cfg.optionsFromLeadIns) c.options = optionsFromLeadIns(paras, cfg.optionsFromLeadIns)
  if (cfg.options === 'invocaciones' || cfg.options === 'metamagia') c.options = ctx.options
  else if (Array.isArray(cfg.options)) c.options = cfg.options
  if (cfg.skillsFromClass) c.options = ctx.skillOptions
  if (cfg.skillOptions) c.options = cfg.skillOptions.map((n) => ({ id: skillId(n), name: n }))
  if (cfg.beasts) c.options = beastOptions(BEASTS, cfg.beasts)
  // Estilo de combate: la opción que no es una dote va en options, con sus trucos.
  if (cfg.alternative) c.options = [{ ...optionsFromLeadIns(paras, [cfg.alternative.name])[0], cantrips: cfg.alternative.cantrips }]
  if (cfg.suggested) {
    const missing = cfg.suggested.filter((id) => !c.options?.some((o) => o.id === id))
    if (missing.length) throw new Error(`${fid ?? cfg.kind}: recomendadas sin opción: ${missing}`)
    c.suggested = cfg.suggested
  }
  if (cfg.languages) c.languages = cfg.languages
  if (cfg.spells) c.spells = cfg.spells
  if (cfg.note) c.note = cfg.note
  return c
}

const SUBCLASS_FEATURE_TEXT = (lower, lvl) =>
  `Obtienes el rasgo de nivel ${lvl} de tu subclase de ${lower} (consulta la descripción de tu subclase).`

/** Asigna ids: "<prefijo>-<slug>", con sufijo -nN si el nombre se repite en varios niveles. */
function assignIds(prefix, feats) {
  const count = {}
  for (const f of feats) count[f.slug] = (count[f.slug] || 0) + 1
  for (const f of feats) f.id = `${prefix}-${f.slug}` + (count[f.slug] > 1 ? `-n${f.level}` : '')
}

const usedSummaries = new Set()
function finalizeFeature(f, ctx) {
  const out = { id: f.id, name: f.name, level: f.level, text: f.text }
  if (f.choice) out.choice = { ...f.choice, id: f.id }
  let s = FEATURE_SUMMARIES[f.id]
  if (s) usedSummaries.add(f.id)
  else s = genericSummary(out, ctx)
  if (s) out.summary = s
  else missingSummaries.push({ id: f.id, owner: ctx.classId, level: f.level })
  if (f.resources?.length) out.resources = f.resources
  return out
}

// ---------------------------------------------------------------------------
// Construcción

const spellDescriptions = parseSpellDescriptions(L)
const BEASTS = parseBeasts(L)
const classes = []
const subclasses = []
const missingSummaries = []
const leadInsSeen = new Set()

for (const cfg of CLASSES) {
  const id = cfg.id
  const [, lower] = CLASS_NAMES[id]
  const sec = classSections(L, id)
  const core = parseCore(id, sec.core)
  if (core.hitDieText !== cfg.core.hitDie) throw new Error(`${id}: dado de golpe ${core.hitDieText} ≠ ${cfg.core.hitDie}`)
  // Las características de data.mjs deben aparecer tal cual en la tabla de atributos básicos.
  const coreText = core.raw.join(' ').replace(/\s+/g, ' ')
  const AB = { fue: 'Fuerza', des: 'Destreza', con: 'Constitución', int: 'Inteligencia', sab: 'Sabiduría', car: 'Carisma' }
  const saves = cfg.core.savingThrows.map((a) => AB[a])
  if (!new RegExp(saves.join(' [ye] ')).test(coreText)) throw new Error(`${id}: salvaciones "${saves}" no aparecen en el texto`)
  const prim = cfg.core.primaryAbilities.map((a) => AB[a])
  const primRe = new RegExp(`Característica principal (${prim.join(' (y|o) ')})( |$)`)
  if (!primRe.test(coreText)) throw new Error(`${id}: característica principal "${prim}" no aparece en el texto`)
  const skillOptions =
    core.skillChoices.from === 'cualquiera' ? [] : core.skillChoices.from.map((sid) => ({ id: sid, name: SKILL_NAMES[sid] }))

  const options = sec.options ? parseOptions(sec.options) : null
  for (const o of options ?? []) {
    if (!OPTION_SUMMARIES[o.id]) throw new Error(`${id}: opción sin resumen ${o.id}`)
    o.summary = OPTION_SUMMARIES[o.id]
  }

  // --- rasgos del texto
  const featLines = L.slice(...sec.features)
  const sidebars = extractSidebars(id, featLines)
  const { features: raw } = splitFeatures(featLines)
  const feats = []
  for (const r of raw) {
    const dropped = []
    let paras = linesToParagraphs(r.lines, dropped)
    const slug = slugify(r.name)
    const baseId = `${id}-${slug}`
    paras = applyFixes(baseId, paras)
    if (INLINE_TABLES[baseId]) paras = insertTable(paras, INLINE_TABLES[baseId])
    if (dropped.length && !INLINE_TABLES[baseId] && r.level !== 1) warn(`${baseId}: descartado ${JSON.stringify(dropped).slice(0, 200)}`)
    feats.push({ level: r.level, name: r.name, slug, paras, order: feats.length })
  }
  for (const sb of sidebars) {
    const target = feats.find((f) => `${id}-${f.slug}` === sb.moveTo)
    if (!target) throw new Error(`Destino de recuadro no encontrado: ${sb.moveTo}`)
    target.paras.push(`**${sb.title}**`, ...sb.paras)
  }

  // --- configuración por rasgo (elecciones y recursos)
  const ctx = { options, skillOptions }
  for (const f of feats) {
    const fc = cfg.features[f.slug]
    if (f.slug === `subclase-de-${slugify(lower)}`) {
      f.choice = { kind: 'subclase', count: 1, options: [] } // se rellenan con la subclase
    } else if (f.slug === 'mejora-de-caracteristica') {
      f.choice = { kind: 'dote', count: 1, note: 'Mejora de característica u otra dote para la que cumplas los requisitos.' }
    } else if (f.slug === 'don-epico') {
      f.choice = { kind: 'don-epico', count: 1, note: 'Una dote de don épico u otra dote para la que cumplas los requisitos.' }
    }
    if (fc?.choice) f.choice = buildChoice(fc.choice, null, f.paras, ctx)
    if (fc?.resources) f.resources = fc.resources
  }
  for (const key of Object.keys(cfg.features)) {
    if (!feats.some((f) => f.slug === key)) throw new Error(`${id}: rasgo configurado inexistente "${key}"`)
  }

  // --- rasgos repetidos (Mejora de característica, Pericia, Invocaciones...)
  const extra = []
  const asi = feats.find((f) => f.slug === 'mejora-de-caracteristica')
  const asiText = asi.paras.join(' ')
  const mLv = asiText.match(/en los niveles ([\d, y]+) de/)
  const asiLevels = [asi.level, ...mLv[1].split(/, | y /).map(Number)]
  for (const lvl of asiLevels.slice(1)) extra.push({ ...asi, level: lvl, order: 1000 + extra.length })
  for (const rep of cfg.repeats) {
    const base = feats.find((f) => f.slug === rep.slug)
    if (!base) throw new Error(`${id}: repetición de rasgo inexistente ${rep.slug}`)
    for (const lvl of rep.levels) {
      extra.push({
        ...base,
        // Texto corto que remite al rasgo original (si no, el texto entero).
        paras: rep.text ? [rep.text] : base.paras,
        level: lvl,
        choice: buildChoice(rep.choice, null, base.paras, { ...ctx, options: null }),
        resources: rep.resources,
        order: 1000 + extra.length,
      })
    }
  }
  for (const lvl of cfg.subclassFeatureLevels) {
    extra.push({
      level: lvl,
      name: 'Rasgo de subclase',
      slug: 'rasgo-de-subclase',
      paras: [SUBCLASS_FEATURE_TEXT(lower, lvl)],
      order: 2000 + lvl,
    })
  }
  const all = [...feats, ...extra].sort((a, b) => a.level - b.level || a.order - b.order)
  assignIds(id, all)
  for (const f of all) f.text = toRichText(f.paras, { seen: leadInsSeen })

  // Notas que apuntan al rasgo con la lista de opciones.
  for (const f of all) {
    if (f.choice && ['invocacion', 'metamagia'].includes(f.choice.kind) && !f.choice.options) {
      const base = all.find((x) => x.choice?.kind === f.choice.kind && x.choice.options)
      f.choice.note = `Opciones: las del rasgo ${base.id}.`
    }
  }

  // --- subclase
  const sub = buildSubclass(id, lower, sec.subclass)
  const subChoice = all.find((f) => f.choice?.kind === 'subclase')
  subChoice.choice.options = [{ id: sub.id, name: sub.name }]

  // --- lista de conjuros
  let spellList
  if (sec.spellList) {
    const { byLevel, problems } = parseSpellList(L, sec.spellList)
    problems.forEach((p) => warn(`${id} lista de conjuros: ${p}`))
    const ids = Object.values(byLevel).flat().map(slugify)
    // El SRD omite algunos conjuros en las listas de clase aunque su descripción
    // los atribuye a la clase (p. ej. Fuerza fantasmal). Se añaden y se informa.
    const fromDesc = [...spellDescriptions].filter(([, d]) => d.classes.includes(id)).map(([k]) => k)
    for (const sid of fromDesc) {
      if (!ids.includes(sid)) {
        warn(`${id}: "${spellDescriptions.get(sid).name}" falta en la lista de clase pero su descripción la incluye; añadido.`)
        ids.push(sid)
      }
    }
    const lvlOf = (sid) => spellDescriptions.get(sid)?.level ?? 99
    spellList = [...new Set(ids)].sort((a, b) => lvlOf(a) - lvlOf(b) || a.localeCompare(b))
  }

  const clsOut = {
    id,
    name: cfg.name,
    source: 'srd',
    hitDie: cfg.core.hitDie,
    primaryAbilities: cfg.core.primaryAbilities,
    savingThrows: cfg.core.savingThrows,
    skillChoices: core.skillChoices,
    weaponText: cfg.core.weaponText,
    weapons: cfg.core.weapons,
    armor: cfg.core.armor,
    armorText: cfg.core.armorText,
    ...(cfg.core.toolText ? { toolText: cfg.core.toolText } : {}),
    startingEquipment: core.startingEquipment,
    ...(cfg.spellcasting ? { spellcasting: cfg.spellcasting } : {}),
    ...(cfg.weaponMastery ? { weaponMastery: cfg.weaponMastery } : {}),
    columns: cfg.columns,
    features: all.map((f) => finalizeFeature(f, { classId: id, className: cfg.name, subclassName: sub.name })),
    subclassLevel: 3,
    subclasses: [sub.id],
    ...(spellList ? { spellList } : {}),
    ...(cfg.alwaysPrepared
      ? { alwaysPrepared: cfg.alwaysPrepared.map((e) => ({ level: e.level, spells: e.spells.map(slugify) })) }
      : {}),
    summary: CLASS_SUMMARIES[id],
  }
  classes.push(clsOut)
  subclasses.push(sub)
}


function spellTableMd(title, levelLabel, rows) {
  return [`**${title}**`, mdTable([levelLabel, 'Conjuros'], rows.map(([lvl, names]) => [String(lvl), names.join(', ')]))]
}

function buildSubclass(classId, lower, range) {
  const lines = L.slice(...range)
  const heading = lines.shift()
  const name = heading.replace(/^Subclase de [^:]+:\s*/, '')
  const sid = slugify(name)
  const scfg = SUBCLASSES[classId]
  const { intro, features: raw } = splitFeatures(lines)
  const introParas = linesToParagraphs(intro)
  const feats = []
  for (const r of raw) {
    const dropped = []
    let paras = linesToParagraphs(r.lines, dropped)
    const slug = slugify(r.name)
    paras = applyFixes(`${sid}-${slug}`, paras)
    const f = { level: r.level, name: r.name, slug, paras, order: feats.length }
    const isSpellFeature = scfg.spellFeature === slug
    if (dropped.length && !isSpellFeature && slug !== 'proteccion-de-la-naturaleza') warn(`${sid}-${slug}: descartado ${JSON.stringify(dropped).slice(0, 200)}`)
    if (isSpellFeature && scfg.spellTable) {
      paras.push(...spellTableMd(r.name, `Nivel de ${lower}`, scfg.spellTable))
    }
    if (isSpellFeature && scfg.terrains) {
      for (const t of scfg.terrains) paras.push(...spellTableMd(t.name, `Nivel de ${lower}`, t.spells))
      f.choice = {
        kind: 'opcion',
        count: 1,
        options: scfg.terrains.map((t) => ({
          id: t.id,
          name: t.name,
          text: t.spells.map(([lvl, names]) => `Nivel ${lvl}: ${names.join(', ')}.`).join('\n\n'),
        })),
        note: 'Puedes cambiar de terreno tras cada descanso largo.',
      }
    }
    if (slug === 'proteccion-de-la-naturaleza' && scfg.terrains) {
      paras.push(
        '**Protección de la naturaleza**',
        mdTable(['Tipo de terreno', 'Resistencia'], scfg.terrains.map((t) => [t.name.replace('Terreno ', '').replace(/^./, (c) => c.toUpperCase()), t.resistance])),
      )
    }
    const fc = scfg.features[slug]
    if (fc?.choice) f.choice = buildChoice(fc.choice, null, paras, {})
    if (fc?.resources) f.resources = fc.resources
    feats.push(f)
  }
  for (const key of Object.keys(scfg.features)) {
    if (!feats.some((f) => f.slug === key)) throw new Error(`${sid}: rasgo configurado inexistente "${key}"`)
  }
  assignIds(sid, feats)
  for (const f of feats) f.text = toRichText(f.paras, { seen: leadInsSeen })
  const out = {
    id: sid,
    classId,
    name,
    source: 'srd',
    text: toRichText(introParas, { leadIns: false }),
    features: feats.map((f) => finalizeFeature(f, { classId, className: CLASS_NAMES[classId][0], subclassName: name })),
  }
  if (scfg.spellTable) {
    out.alwaysPrepared = scfg.spellTable.map(([level, names]) => ({ level, spells: names.map(slugify) }))
  }
  if (scfg.terrains) {
    // Campo extra (no está en SubclassData): conjuros siempre preparados según la
    // opción elegida en el rasgo `choiceId`.
    const feat = out.features.find((f) => f.choice?.kind === 'opcion' && f.choice.options?.some((o) => o.id === 'arido'))
    out.alwaysPreparedByOption = {
      choiceId: feat.id,
      options: Object.fromEntries(
        scfg.terrains.map((t) => [t.id, t.spells.map(([level, names]) => ({ level, spells: names.map(slugify) }))]),
      ),
    }
  }
  out.summary = SUBCLASS_SUMMARIES[sid]
  return out
}

// ---------------------------------------------------------------------------
// Espacios de conjuro (es.txt, versión -layout)

function parseSlotRows(lines, startIdx, cells, count = 20) {
  const rows = []
  for (let i = startIdx; i < lines.length && rows.length < count; i++) {
    const m = lines[i].match(/^\s{2,8}(\d{1,2})\s+((?:[\d—]\s?){1,9})/)
    if (!m) continue
    const lvl = Number(m[1])
    if (lvl !== rows.length + 1) continue
    const compact = m[2].replace(/\s/g, '')
    if (compact.length < cells) continue
    rows.push(compact.slice(0, cells).split('').map((c) => (c === '—' ? 0 : Number(c))))
  }
  return rows
}

const ES_LAYOUT = readFileSync(resolve(APP_DIR, '../srd/text/es.txt'), 'utf8').replace(/\r/g, '').split('\n')
function spellSlots() {
  const mc = ES_LAYOUT.findIndex((l) => l.includes('Lanzador de conjuros multiclase:'))
  const completo = parseSlotRows(ES_LAYOUT, mc, 9)
  // Tabla del paladín: "1   +2   Imponer las manos, ...  —  2   2 ————"
  const pal = ES_LAYOUT.findIndex((l) => /^\s*Rasgos de paladín\s*$/.test(l))
  const medio = []
  for (let i = pal; i < ES_LAYOUT.length && medio.length < 20; i++) {
    const m = ES_LAYOUT[i].match(/^\s{2,6}(\d{1,2})\s+\+\d\s.*?((?:[\d—]\s?){5})\s*$/)
    if (!m || Number(m[1]) !== medio.length + 1) continue
    medio.push([...m[2].replace(/\s/g, '').split('').map((c) => (c === '—' ? 0 : Number(c))), 0, 0, 0, 0])
  }
  return { completo, medio, pacto: PACT }
}

const slots = spellSlots()

// ---------------------------------------------------------------------------
// Validación y escritura

const report = validate({ classes, subclasses, slots, spellDescriptions, L, leadInsSeen })
const files = [
  writeJson('classes.json', classes),
  writeJson('subclasses.json', subclasses),
  writeJson('spell-slots.json', slots),
]
for (const fx of TEXT_FIXES) if (!fx.applied && !fx.optional) warn(`Corrección sin aplicar: ${fx.feature}`)
for (const k of Object.keys(FEATURE_SUMMARIES)) if (!usedSummaries.has(k)) warn(`Resumen sin rasgo: ${k}`)

console.log(`Clases: ${classes.length} (${classes.reduce((n, c) => n + c.features.length, 0)} rasgos)`)
console.log(`Subclases: ${subclasses.length} (${subclasses.reduce((n, c) => n + c.features.length, 0)} rasgos)`)
console.log(`Escrito: ${files.join(', ')}`)
if (log.length) console.log('\nAvisos:\n- ' + log.join('\n- '))
// Resúmenes obligatorios: bardo, guerrero, hechicero y paladín (y sus subclases)
// en todos los niveles; resto de clases en los niveles 1-5.
const focus = ['bardo', 'guerrero', 'hechicero', 'paladin']
const missingFocus = missingSummaries.filter((m) => focus.includes(m.owner) || m.level <= 5)
console.log(`\nResúmenes para novatos: ${missingSummaries.length} rasgos sin resumen (nivel 6+ de las demás clases)`)
if (missingFocus.length) {
  console.error('  FALTAN resúmenes obligatorios: ' + missingFocus.map((m) => m.id).join(', '))
  process.exitCode = 1
}
console.log('\n' + report.summary)
if (report.errors.length) {
  console.error(`\nVALIDACIÓN: ${report.errors.length} errores`)
  for (const e of report.errors) console.error('  ✗ ' + e)
  process.exitCode = 1
} else console.log('\nVALIDACIÓN: OK')
