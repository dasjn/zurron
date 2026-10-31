// Script auxiliar (no forma parte de build.mjs): extrae del PDF del SRD en
// español los encabezados y las entradillas en negrita ("Número de usos.")
// para que build.mjs sepa qué poner en **negrita** y dónde empieza cada
// párrafo cuando el texto plano los pega en una sola línea.
//
// Uso (desde app/):
//   node scripts/srd/compendio/pdf-negritas.mjs [ruta.xml]
// Sin argumento ejecuta `pdftohtml -xml` (poppler) sobre ../srd/SP_SRD_CC_v5.2.1.pdf
// (páginas 89-211) en un directorio temporal. Escribe pdf-negritas.json junto
// a este script; ese JSON se guarda en el repositorio para que build.mjs no
// dependa de poppler.

import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_DIR } from '../lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const PDF = resolve(APP_DIR, '../srd/SP_SRD_CC_v5.2.1.pdf')

let xmlPath = process.argv[2]
if (!xmlPath) {
  const dir = mkdtempSync(join(tmpdir(), 'srd-xml-'))
  execFileSync('pdftohtml', ['-xml', '-i', '-q', '-enc', 'UTF-8', '-f', '89', '-l', '211', PDF, join(dir, 'es')])
  xmlPath = join(dir, 'es.xml')
}
if (!existsSync(xmlPath)) throw new Error(`No existe ${xmlPath}`)
const xml = readFileSync(xmlPath, 'utf8')

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

// Une dos trozos de línea respetando los guiones de fin de línea.
function joinPieces(a, b) {
  a = a.replace(/\s+$/, '')
  if (/[‑­-]$/.test(a)) return a.slice(0, -1) + b.trimStart()
  return a + ' ' + b.trimStart()
}
const clean = (s) => s.replace(/­/g, '').replace(/‑/g, '-').replace(/\s+/g, ' ').trim()

// Fuentes de encabezado (tamaño/familia del PDF en español).
const HEADING_FONTS = { 2: 'cap', 3: 'h1', 5: 'h2', 6: 'h3', 12: 'tabla' }

const items = []
let page = 0
const re = /<page number="(\d+)"|<text [^>]*left="(\d+)"[^>]*font="(\d+)">(.*?)<\/text>/g
let m
let prev = null // último item, para fusionar continuaciones
// Detección de párrafos partidos por un salto de columna o de página: la
// primera línea de una columna sin sangría (left 95 o 470) que no sigue a un
// encabezado continúa el párrafo anterior. Se guarda su comienzo ("cont").
let band = null
let afterHeading = false
let hanging = false
const BODY_LEFT = { 95: 1, 470: 2 }
while ((m = re.exec(xml))) {
  if (m[1]) {
    page = Number(m[1])
    band = 0 // un cambio de página cuenta como cambio de columna
    continue
  }
  const font = Number(m[3])
  const left = Number(m[2])
  const raw = decode(m[4])
  if (font === 0 || font === 1) continue // cabecera y número de página
  const kind = HEADING_FONTS[font]
  const curBand = left < 450 ? 1 : 2
  const isLead = /^(<i>)?<b>/.test(raw)
  const flush = BODY_LEFT[left] === curBand // sin sangría
  // Tras una lista con sangría francesa (entradilla sin sangría y resto de
  // líneas sangradas), el párrafo siguiente tampoco lleva sangría: no es
  // una continuación aunque empiece arriba de una columna.
  if (!kind && band !== null && curBand !== band && !afterHeading && !hanging && flush && !isLead) {
    const t = clean(raw.replace(/<\/?[ib]>/g, ''))
    if (/^[A-ZÁÉÍÓÚÑ¿¡“]/.test(t)) items.push({ p: page, k: 'cont', t: t.slice(0, 40) })
  }
  if (kind) hanging = false
  else if (isLead && flush) hanging = true
  else if (!isLead && flush && hanging) hanging = false
  band = curBand
  afterHeading = !!kind || font === 13 || font === 14 || font === 16
  if (kind) {
    const text = raw.replace(/<\/?[ib]>/g, '')
    if (prev && prev.k === kind && prev.open) {
      prev.raw = joinPieces(prev.raw, text)
      prev.t = clean(prev.raw)
      continue
    }
    prev = { p: page, k: kind, raw: text, t: clean(text), open: true }
    items.push(prev)
    continue
  }
  if (prev) prev.open = false
  // Entradilla: el elemento empieza en negrita (cursiva+negrita o solo negrita).
  const lm = raw.match(/^(?:<i>)?<b>(.*?)<\/b>/)
  if (lm && (font === 11 || font === 15)) {
    const text = lm[1].replace(/<\/?[ib]>/g, '')
    const last = items[items.length - 1]
    if (last && last.k === 'neg' && last.cont) {
      last.raw = joinPieces(last.raw, text)
    } else {
      items.push({ p: page, k: 'neg', raw: text })
    }
    const cur = items[items.length - 1]
    cur.t = clean(cur.raw)
    // Si la negrita llega al final del elemento y no termina en punto, sigue en la línea siguiente.
    const rest = raw.slice(lm[0].length).replace(/<\/i>/, '').trim()
    cur.cont = rest === '' && !/[.:]$/.test(cur.t)
    continue
  }
}

const out = items.map(({ p, k, t }) => ({ p, k, t }))
const file = resolve(here, 'pdf-negritas.json')
writeFileSync(file, JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n{') + '\n', 'utf8')
console.log(`${out.length} elementos -> ${file}`)
