// Glosario de reglas -> RuleEntry[] (con la etiqueta [estado], [acción]... en `tag`).

import { slugify } from '../lib.mjs'
import { srdLines, findLine, pdfItems, leadinIndex, richFromLines } from './texto.mjs'
import { applyOverrides } from './tablas.mjs'

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export function buildGlossary() {
  const lines = srdLines()
  const start = findLine('Definiciones de las reglas', 15000)
  // el capítulo siguiente aparece partido: "Herramientas" / "del juego"
  const end = findLine('del juego', start) - 1
  if (lines[end] !== 'Herramientas') throw new Error('No encuentro el final del glosario')

  // Los nombres de las entradas salen de los encabezados del PDF (págs. 194-210).
  const heads = pdfItems().filter((x) => x.p >= 194 && x.p <= 210 && x.k === 'h3').map((x) => x.t)
  const leadins = leadinIndex(194, 210)

  const pos = []
  let from = start + 1
  for (const h of heads) {
    const i = findLine(h, from, end)
    pos.push(i)
    from = i + 1
  }
  // La intro "Estas son las definiciones de diversas reglas." no es una entrada.

  const entries = []
  for (let k = 0; k < heads.length; k++) {
    const head = heads[k]
    const m = head.match(/^(.*?) \[(.+)\]$/)
    const name = m ? m[1] : head
    const id = slugify(name)
    let body = lines.slice(pos[k] + 1, k + 1 < heads.length ? pos[k + 1] : end)
    body = applyOverrides('glosario', id, body)
    const entry = { id, name, text: richFromLines(body, leadins.near(head), leadins.all) }
    if (m) entry.tag = cap(m[2])
    entries.push(entry)
  }
  return entries
}
