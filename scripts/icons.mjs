// Genera los iconos de la app (favicon, pantalla de inicio de iPhone/Android)
// a partir de un d20 dibujado en SVG. Uso: node scripts/icons.mjs

import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const pub = resolve(dirname(fileURLToPath(import.meta.url)), '../public')

const BG = '#2A1A16'
const BRASS = '#E2B85A'
const RED = '#A3311F'
const INK = '#4A1A10'

// «20» en Grenze Bold, ya en contornos (unidades de la fuente, y hacia abajo,
// caja de 25,-486 a 947,11) para no depender de la fuente al dibujar.
const TWENTY =
  'M34 0 25 -59 182 -250Q211 -285 224 -311Q238 -336 238 -360Q238 -376 232 -392Q226 -409 216 -409Q211 -409 195 -406Q178 -403 162 -399Q145 -396 139 -395L129 -312H58L51 -465Q73 -469 104 -472Q135 -476 167 -479Q199 -482 224 -484Q248 -486 258 -486Q291 -486 323 -475Q355 -465 377 -440Q398 -416 398 -374Q398 -339 384 -307Q369 -275 343 -241L231 -102V-91H337L348 -162H419L423 0ZM722 11Q606 11 551 -55Q495 -121 495 -239Q495 -281 507 -325Q518 -369 544 -405Q569 -441 613 -464Q656 -486 720 -486Q837 -486 892 -421Q947 -356 947 -239Q947 -197 936 -152Q924 -108 898 -71Q872 -34 828 -12Q785 11 722 11ZM702 -61Q726 -61 746 -68Q765 -75 784 -85Q790 -109 793 -144Q795 -180 795 -239Q795 -333 781 -372Q768 -411 738 -411Q716 -411 695 -404Q674 -398 658 -387Q651 -362 649 -323Q648 -285 648 -239Q648 -143 660 -102Q673 -61 702 -61Z'
const TWENTY_BOX = [25, -486, 947, 11]

/** El «20» centrado en (cx, cy) con el ancho dado, en unidades del lienzo. */
function twenty(cx, cy, width) {
  const [x0, y0, x1, y1] = TWENTY_BOX
  const k = width / (x1 - x0)
  return `<path d="${TWENTY}" fill="${INK}" transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${k.toFixed(5)}) translate(${-(x0 + x1) / 2} ${-(y0 + y1) / 2})"/>`
}

/** d20 visto de frente en un lienzo de 100×100, con la cara del 20 dorada. `pad` encoge el dado (iconos "maskable"). */
function d20(pad = 0, rounded = true) {
  const s = (100 - pad * 2) / 100
  const at = (x, y) => [pad + x * s, pad + y * s]
  const p = (x, y) => at(x, y).map((n) => n.toFixed(2)).join(',')
  const T = [50, 10], UR = [84.64, 30], LR = [84.64, 70], B = [50, 90], LL = [15.36, 70], UL = [15.36, 30]
  const A = [50, 30], L = [29, 64], R = [71, 64]
  const line = (a, b) => `M${p(...a)}L${p(...b)}`
  const hex = [T, UR, LR, B, LL, UL].map((v) => p(...v)).join(' ')
  const tri = [A, L, R].map((v) => p(...v)).join(' ')
  const edges = [line(T, A), line(UL, A), line(UL, L), line(UR, A), line(UR, R), line(LL, L), line(LR, R), line(B, L), line(B, R)].join('')
  const [cx, cy] = at(50, 56.3)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><linearGradient id="cara" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7E4B2"/><stop offset="1" stop-color="#D8B26A"/></linearGradient></defs>
  <rect width="100" height="100" rx="${rounded ? 22 : 0}" fill="${BG}"/>
  <polygon points="${hex}" fill="${RED}" stroke="${BRASS}" stroke-width="${(3.2 * s).toFixed(2)}" stroke-linejoin="round"/>
  <path d="${edges}" stroke="${BRASS}" stroke-width="${(2.2 * s).toFixed(2)}" stroke-linecap="round" fill="none"/>
  <polygon points="${tri}" fill="url(#cara)" stroke="${BRASS}" stroke-width="${(3.4 * s).toFixed(2)}" stroke-linejoin="round"/>
  ${twenty(cx, cy, 19 * s)}
</svg>`
}

function png(svg, size, file) {
  const out = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
  writeFileSync(resolve(pub, file), out)
}

writeFileSync(resolve(pub, 'favicon.svg'), d20(4))
png(d20(6, false), 180, 'apple-touch-icon.png') // iOS redondea las esquinas solo
png(d20(6), 192, 'icon-192.png')
png(d20(6), 512, 'icon-512.png')
png(d20(16, false), 512, 'icon-maskable-512.png') // zona segura para Android
console.log('Iconos generados en public/')
