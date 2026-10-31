// Utilidades compartidas por los scripts que convierten el SRD 5.2.1 (español)
// en JSON. Lee el texto extraído con `pdftotext -enc UTF-8` (sin -layout).
// No modificar desde un script concreto: si necesitas otra utilidad, créala
// en tu propio módulo.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const APP_DIR = resolve(here, '../..')
export const SRD_TEXT = resolve(APP_DIR, '../srd/text/es-raw.txt')
export const OUT_DIR = resolve(APP_DIR, 'src/data/srd')

const FOOTER = 'Documento de referencia del sistema 5.2.1'

/**
 * Devuelve las líneas del SRD limpias:
 * - quita guiones blandos (U+00AD) y une las palabras cortadas con guion
 *   no separable (U+2011) seguido de espacio: "Inspira‑ ción" -> "Inspiración";
 * - quita los pies de página ("35", "Documento de referencia...", "183 Documento...").
 */
export function loadSrdLines() {
  let t = readFileSync(SRD_TEXT, 'utf8')
  t = t.replace(/\r/g, '')
  t = t.replace(/­\s?/g, '')
  t = t.replace(/‑ /g, '')
  t = t.replace(/‑/g, '-')
  t = t.replace(/\f/g, '\n')
  const lines = t.split('\n')
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    if (l === FOOTER) continue
    if (new RegExp(`^\\d{1,3} ${FOOTER}$`).test(l)) continue
    // número de página suelto justo antes del pie
    if (/^\d{1,3}$/.test(l)) {
      const next = (lines[i + 1] ?? '').trim()
      const next2 = (lines[i + 2] ?? '').trim()
      if (next === FOOTER || (next === '' && next2 === FOOTER)) continue
    }
    out.push(l)
  }
  return out
}

/** "Palabra de curación" -> "palabra-de-curacion" */
export function slugify(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Comillas de la app: el SRD en español usa “inglesas”; la app, «latinas».
 * Se cambian solo al escribir el JSON (los analizadores siguen leyendo el texto
 * tal cual) y solo por parejas. Antes se cierra la que el SRD deja abierta en
 * una enumeración («“Asfixia”, “Caídas, “Deshidratación”»).
 */
export function spanishQuotes(s) {
  return s.replace(/“([^“”,]+), (?=“)/g, '“$1”, ').replace(/“([^“”]*)”/g, '«$1»')
}

function withSpanishQuotes(v) {
  if (typeof v === 'string') return spanishQuotes(v)
  if (Array.isArray(v)) return v.map(withSpanishQuotes)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, withSpanishQuotes(x)]))
  return v
}

export function writeJson(name, data) {
  mkdirSync(OUT_DIR, { recursive: true })
  const file = resolve(OUT_DIR, name)
  writeFileSync(file, JSON.stringify(withSpanishQuotes(data), null, 1) + '\n', 'utf8')
  return file
}
