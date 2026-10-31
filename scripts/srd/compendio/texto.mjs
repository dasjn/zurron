// Utilidades de texto para el compendio (conjuros, glosario, dotes...).
// Trabajan sobre las líneas que devuelve loadSrdLines() de ../lib.mjs.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSrdLines } from '../lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))

let _lines
/** Líneas limpias del SRD (cacheadas). */
export function srdLines() {
  if (!_lines) _lines = loadSrdLines()
  return _lines
}

/** Índice de la primera línea igual a `text` (exacta) a partir de `from`. */
export function findLine(text, from = 0, to = Infinity) {
  const lines = srdLines()
  for (let i = from; i < Math.min(lines.length, to); i++) if (lines[i] === text) return i
  throw new Error(`No encuentro la línea "${text}" desde ${from}`)
}

/** Encabezados y entradillas en negrita sacados del PDF (ver pdf-negritas.mjs). */
let _neg
export function pdfItems() {
  if (!_neg) _neg = JSON.parse(readFileSync(resolve(here, 'pdf-negritas.json'), 'utf8'))
  return _neg
}

/**
 * Entradillas en negrita agrupadas por encabezado h3 dentro de un rango de
 * páginas: Map<nombreEncabezado, string[]>. Solo las que acaban en "." o ":".
 */
export function leadinsByHeading(pFrom, pTo, headingKinds = ['h3']) {
  const map = new Map()
  let cur = null
  for (const it of pdfItems()) {
    if (it.p < pFrom || it.p > pTo) continue
    if (headingKinds.includes(it.k)) {
      cur = it.t
      if (!map.has(cur)) map.set(cur, [])
    } else if (it.k === 'neg' && cur && /[.:]$/.test(it.t)) {
      map.get(cur).push(it.t)
    }
  }
  return map
}

/**
 * Índice de entradillas de un capítulo. El orden de lectura del XML a veces
 * cuelga una entradilla del encabezado vecino, así que `near(nombre)` junta
 * las del encabezado, el anterior y el siguiente (para partir párrafos), y
 * `all` reúne todas las del capítulo (para poner negrita al inicio de párrafo).
 */
export function leadinIndex(pFrom, pTo, headingKinds = ['h3']) {
  const map = leadinsByHeading(pFrom, pTo, headingKinds)
  const names = [...map.keys()]
  const all = [...new Set([...map.values()].flat())]
  return {
    all,
    near(name) {
      const i = names.indexOf(name)
      if (i < 0) return []
      return [...new Set([i - 1, i, i + 1].flatMap((k) => map.get(names[k]) ?? []))]
    },
  }
}

const normStart = (s) => s.replace(/[\s\-‑­]/g, '')
let _conts
function isContinuation(l) {
  // se compara la línea completa del PDF (hasta 40 caracteres) para no confundir
  // comienzos frecuentes como "Hasta que el conjuro termine, ..."
  if (!_conts) _conts = pdfItems().filter((x) => x.k === 'cont' && x.t.length >= 30).map((x) => normStart(x.t))
  const n = normStart(l)
  return _conts.some((c) => n.startsWith(c))
}

const TERMINAL =/[.!?:…]$/
const startsLower = (s) => /^[a-záéíóúüñ(]/.test(s)

/**
 * Une las líneas en párrafos.
 * - Las líneas vacías (saltos de columna/página) se ignoran.
 * - Una línea continúa la anterior si la anterior no acaba en puntuación final
 *   o si empieza en minúscula.
 * - "pala-" + "bra" -> "palabra".
 */
export function joinParagraphs(lines) {
  const paras = []
  let gap = false
  for (let raw of lines) {
    const l = raw.replace(/​/g, '').replace(/ {2,}/g, ' ').trim()
    if (!l) {
      gap = true
      continue
    }
    const afterGap = gap
    gap = false
    const prev = paras[paras.length - 1]
    // párrafo partido por un salto de columna justo tras un punto (ver pdf-negritas.mjs)
    if (prev !== undefined && afterGap && !/^(\||\*\*|• )/.test(prev) && isContinuation(l)) {
      paras[paras.length - 1] = prev + ' ' + l
      continue
    }
    // Las líneas que empiezan por "|" o "**" vienen de tablas.mjs: siempre aparte.
    if (prev !== undefined && !/^(\||\*\*)/.test(l) && !/^(\||\*\*)/.test(prev) && !l.startsWith('• ')) {
      if (/[a-záéíóúñ]-$/i.test(prev) && startsLower(l)) {
        paras[paras.length - 1] = prev.slice(0, -1) + l
        continue
      }
      // tras una viñeta, una línea en mayúscula es un párrafo nuevo
      const afterBullet = prev.startsWith('• ') && !startsLower(l)
      if (!afterBullet && (!TERMINAL.test(prev) || startsLower(l))) {
        paras[paras.length - 1] = prev + ' ' + l
        continue
      }
    }
    paras.push(l)
  }
  return paras
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Parte los párrafos que contienen varias entradillas pegadas
 * ("... aumentar. Ataques afectados. Tienes ...") y pone en negrita las
 * entradillas que abren párrafo. `leadins` son las del PDF para esta entrada.
 */
export function applyLeadins(paras, leadins = [], boldSet = leadins) {
  const byLen = (a, b) => b.length - a.length
  const uniq = [...new Set(leadins)].sort(byLen)
  const bold = [...new Set([...leadins, ...boldSet])].sort(byLen)
  let out = paras
  for (const li of uniq) {
    const re = new RegExp(`([.:)”]) (${escapeRe(li)} )`)
    const next = []
    for (const p of out) {
      if (p.startsWith('|')) {
        next.push(p)
        continue
      }
      let rest = p
      let m
      while ((m = rest.match(re))) {
        const cut = m.index + m[1].length
        next.push(rest.slice(0, cut))
        rest = rest.slice(cut + 1)
      }
      next.push(rest)
    }
    out = next
  }
  return out.map((p) => {
    for (const li of bold) {
      if (p.startsWith(li + ' ') || p === li) return `**${li}**` + p.slice(li.length)
    }
    return p
  })
}

/** Separa las viñetas "•" pegadas en un mismo párrafo: cada una en su línea. */
export function splitBullets(paras) {
  const out = []
  for (const p of paras) {
    if (!p.includes('•')) {
      out.push(p)
      continue
    }
    const parts = p.split(/\s*•\s*/)
    if (parts[0]) out.push(parts[0])
    for (const b of parts.slice(1)) if (b) out.push('• ' + b)
  }
  return out
}

/**
 * Convierte la lista de párrafos en RichText: párrafos separados por línea en
 * blanco; las viñetas consecutivas y las filas de tabla van en líneas seguidas.
 */
export function toRich(paras) {
  let s = ''
  let prevKind = null
  for (const p of paras) {
    const kind = p.startsWith('• ') ? 'li' : p.startsWith('|') ? 'tr' : 'p'
    if (s) s += kind === prevKind && kind !== 'p' ? '\n' : '\n\n'
    s += p
    prevKind = kind
  }
  // superíndices perdidos en la extracción: "250 m2" -> "250 m²"
  return s.replace(/(\d) m2\b/g, '$1 m²').replace(/(\d) m3\b/g, '$1 m³')
}

/** Tabla Markdown a partir de cabecera y filas. */
export function mdTable(head, rows) {
  const line = (cells) => '| ' + cells.join(' | ') + ' |'
  return [line(head), '|' + head.map(() => '---').join('|') + '|', ...rows.map(line)]
}

/** Pipeline completo: líneas crudas -> RichText. */
export function richFromLines(lines, leadins = [], boldSet = leadins) {
  return toRich(applyLeadins(splitBullets(joinParagraphs(lines)), leadins, boldSet))
}
