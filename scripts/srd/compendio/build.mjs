// Genera los JSON del compendio (conjuros, especies, trasfondos, dotes,
// equipo y glosario) a partir del SRD 5.2.1 en español y los valida.
//
// Uso (desde app/):  node scripts/srd/compendio/build.mjs
// Solo validar lo ya generado:  node scripts/srd/compendio/check.mjs

import { writeJson } from '../lib.mjs'
import { buildSpells } from './conjuros.mjs'
import { buildSpecies } from './especies.mjs'
import { buildBackgrounds, buildFeats } from './origenes.mjs'
import { buildWeapons, buildArmor, buildMasteries, buildWeaponProperties, buildGear } from './equipo.mjs'
import { buildGlossary } from './glosario.mjs'
import { unusedOverrides } from './tablas.mjs'
import { runChecks } from './check.mjs'

const outputs = {
  'spells.json': buildSpells(),
  'species.json': buildSpecies(),
  'backgrounds.json': buildBackgrounds(),
  'feats.json': buildFeats(),
  'weapons.json': buildWeapons(),
  'armor.json': buildArmor(),
  'masteries.json': buildMasteries(),
  'weapon-properties.json': buildWeaponProperties(),
  'glossary.json': buildGlossary(),
  'gear.json': buildGear(),
}

const unused = unusedOverrides()
if (unused.length) {
  console.error('Sustituciones de tablas.mjs que no se han aplicado:', unused.join(', '))
  process.exit(1)
}

for (const [name, data] of Object.entries(outputs)) writeJson(name, data)

const ok = runChecks(outputs)
process.exit(ok ? 0 : 1)
