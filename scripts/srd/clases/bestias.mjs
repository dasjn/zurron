// Bestias del apartado «Animales» (capítulo de monstruos) para las formas
// conocidas de Forma salvaje del druida: nombre, valor de desafío, tamaño y
// velocidades. Solo se leen las cabeceras de los perfiles.

import { slugify } from '../lib.mjs'

const SIZES = 'Diminut[ao]|Pequeñ[ao]|Median[ao]|Grande|Enorme|Gargantues[ca][ao]?'
const TYPE_LINE = new RegExp(`^(Bestia|Aberración|Autómata|Celestial|Cieno|Dragón|Elemental|Feérico|Gigante|Humanoide|Infernal|Monstruosidad|Muerto viviente|Planta) (${SIZES})\\b`)

/** "1/4" -> 0.25 */
const crValue = (t) => (t.includes('/') ? Number(t.split('/')[0]) / Number(t.split('/')[1]) : Number(t))

/** Lista de bestias del SRD (sin las de otros tipos que hay en el mismo apartado). */
export function parseBeasts(L) {
  const start = L.findIndex((l, i) => l === 'Animales' && L.slice(i + 1, i + 80).some((x) => /^Bestia /.test(x)))
  if (start < 0) throw new Error('No encuentro el apartado «Animales»')
  const out = []
  for (let i = start; i < L.length; i++) {
    const m = L[i].match(TYPE_LINE)
    if (!m) continue
    let j = i - 1
    while (j > start && !L[j].trim()) j--
    const name = L[j].trim()
    let speed = ''
    let crText = ''
    for (let k = i + 1; k < i + 40 && k < L.length; k++) {
      if (!speed && /Velocidad:/.test(L[k])) speed = L[k].replace(/^.*Velocidad:\s*/, '').replace(/\.$/, '').trim()
      const c = L[k].match(/VD:\s*([\d/]+)/)
      if (c) {
        crText = c[1]
        break
      }
    }
    if (m[1] !== 'Bestia') continue
    if (!speed || !crText) throw new Error(`Perfil de bestia incompleto: ${name}`)
    out.push({ id: slugify(name), name, size: m[2], speed, crText, cr: crValue(crText), fly: /\bvolar\b/.test(speed) })
  }
  if (out.length < 50) throw new Error(`Solo ${out.length} bestias en «Animales»`)
  return out
}

/** Opciones de una elección de formas conocidas: VD máximo y si pueden volar. */
export function beastOptions(beasts, { maxCr, fly }) {
  return beasts
    .filter((b) => b.cr <= maxCr && (fly || !b.fly))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map((b) => ({ id: b.id, name: b.name, text: `Bestia ${b.size.toLowerCase()} de VD ${b.crText}. Velocidad: ${b.speed}.` }))
}
