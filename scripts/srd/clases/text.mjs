// Utilidades de texto para convertir la prosa de las clases (es-raw.txt) en
// RichText. El texto "sin -layout" trae la prosa limpia, pero las tablas
// aparecen desordenadas e intercaladas entre los párrafos: aquí se filtran.

import { slugify } from '../lib.mjs'

const LOWER_START = /^[a-záéíóúñü]/
// Final de párrafo: punto, dos puntos, cierre de comillas/paréntesis tras punto...
const TERMINAL = /[.:;!?…]["”»)]?$|[.:;!?]\)$/

/** Fila o celda de tabla (números, dados, rayas, "+2", "1d6", "+4,5 m"...). */
export function isTableToken(line) {
  return /—/.test(line) || /^[\d\s+—–\-dD/,.ºm]*$/.test(line)
}

/** Une dos trozos de un mismo párrafo (corte de columna o de página). */
function joinParts(a, b) {
  if (/[a-záéíóúñ]-$/.test(a)) return a.slice(0, -1) + b // "salva-" + "ción"
  return a + ' ' + b
}

/**
 * Convierte las líneas del cuerpo de un rasgo en párrafos limpios.
 * - Junta párrafos cortados por saltos de columna/página.
 * - Descarta celdas de tabla y títulos sueltos (se registran en `dropped`).
 */
export function linesToParagraphs(lines, dropped = []) {
  const paras = []
  let open = false
  const nextNonEmpty = (i) => {
    for (let j = i + 1; j < lines.length; j++) if (lines[j]) return lines[j]
    return ''
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const lower = LOWER_START.test(line)
    if (open && (lower || line.startsWith('“'))) {
      paras[paras.length - 1] = joinParts(paras[paras.length - 1], line)
      open = !TERMINAL.test(line)
      continue
    }
    if (lower) {
      dropped.push(line)
      continue
    }
    if (isTableToken(line)) {
      dropped.push(line)
      continue
    }
    if (TERMINAL.test(line)) {
      paras.push(line)
      open = false
      continue
    }
    if (line.startsWith('•')) {
      paras.push(line)
      open = true
      continue
    }
    // Sin puntuación final: es prosa si continúa en la siguiente línea o si es
    // una frase larga (al PDF a veces le falta el punto final). La columna
    // "Rasgos de clase" de las tablas sale como una línea larga: se descarta.
    const next = nextNonEmpty(i)
    if (/^Rasgos de clase /.test(line)) {
      dropped.push(line)
      continue
    }
    if ((line.length > 40 && LOWER_START.test(next)) || line.length > 80) {
      paras.push(line)
      open = true
      continue
    }
    dropped.push(line)
  }
  // Separa viñetas en línea: "• uno. • dos." -> dos líneas.
  const out = []
  for (const p of paras) {
    if (p.startsWith('•') && p.includes(' • ')) {
      for (const part of p.split(/\s+•\s+/)) out.push(part.startsWith('•') ? part : '• ' + part)
    } else if (/:\s+•\s/.test(p)) {
      const [head, ...rest] = p.split(/\s+•\s+/)
      out.push(head)
      for (const r of rest) out.push('• ' + r)
    } else out.push(p)
  }
  return out.map((p) => (p.startsWith('•') ? '• ' + p.replace(/^•\s*/, '') : p))
}

// ---------------------------------------------------------------------------
// Encabezados en línea ("Número de usos. Puedes...") -> "**Número de usos.** Puedes..."

// Primeras frases cortas que NO son encabezados (son oraciones normales).
const NOT_LEAD_IN = new Set([
  'Encarnas un poder primigenio',
  'Tienes las siguientes opciones de efectos',
  'El poder de los elementos fluye por ti',
])
// Encabezados que empiezan por un posesivo/artículo (el resto de frases así no lo son).
const LEAD_IN_ALLOW = new Set(['Tu CD de salvación'])
// Verbos en segunda persona con los que empiezan frases normales.
const VERB_START =
  /^(Puedes|Tienes|Obtienes|Eres|Estás|Has|Ganas|Encarnas|Sabes|Conoces|Aprendes|Consigues|Recurres|Recuperas|Usas|Haces|Elige|Escoge|Tira|Gasta|Cuando|Si|Mientras|Como|Al|Durante|Siempre|Además|Una vez|Este|Esta|Estos|Estas|Ese|Esa|Por ejemplo|Ahora|También|Ya)\b/

const LEAD_IN = /^((?:[A-ZÁÉÍÓÚÑ¿][^.!?:()]{0,55}?)(?: \((?:coste|cost)[^)]*\))?)\.\s+(?=[A-ZÁÉÍÓÚÑ¿“(0-9])/

export function leadIn(p) {
  if (p.startsWith('•')) return null
  const m = p.match(LEAD_IN)
  if (!m) return null
  const phrase = m[1]
  if (phrase.split(/\s+/).length > 8) return null
  if (NOT_LEAD_IN.has(phrase)) return null
  if (VERB_START.test(phrase)) return null
  if (/^(Tu|Tus|Te|El|La|Los|Las|Un|Una)\b/.test(phrase) && !LEAD_IN_ALLOW.has(phrase)) return null
  return phrase
}

export function boldLeadIns(p, seen) {
  const li = leadIn(p)
  if (!li) return p
  if (seen) seen.add(li)
  return `**${li}.**` + p.slice(li.length + 1)
}

/** Párrafos -> RichText (viñetas consecutivas en bloque, resto separado por línea en blanco). */
export function toRichText(paras, { leadIns = true, seen } = {}) {
  const blocks = []
  for (const raw of paras) {
    const p = leadIns ? boldLeadIns(raw, seen) : raw
    const prev = blocks[blocks.length - 1]
    if (p.startsWith('• ') && prev && prev.split('\n').pop().startsWith('• ')) {
      blocks[blocks.length - 1] = prev + '\n' + p
    } else blocks.push(p)
  }
  return blocks.join('\n\n')
}

/** Tabla Markdown para RichText. */
export function mdTable(header, rows) {
  const line = (cells) => '| ' + cells.join(' | ') + ' |'
  return [line(header), '|' + header.map(() => '---').join('|') + '|', ...rows.map(line)].join('\n')
}

export const HEADING = /^Nivel (\d+): (.+)$/

/**
 * Divide una sección en rasgos "Nivel N: Nombre".
 * Devuelve { intro: string[], features: { level, name, lines }[] }.
 */
export function splitFeatures(lines) {
  const intro = []
  const features = []
  for (const l of lines) {
    const m = l.match(HEADING)
    if (m) {
      features.push({ level: Number(m[1]), name: m[2].trim(), lines: [] })
      continue
    }
    if (features.length) features[features.length - 1].lines.push(l)
    else intro.push(l)
  }
  return { intro, features }
}

export { slugify }
