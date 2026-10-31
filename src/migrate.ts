// Pone al día una ficha leída de fuera (copia importada o guardado del móvil):
// rellena lo que falte con valores por defecto, tira lo que tenga un tipo raro
// y limpia lo que viene de fuera y se pinta tal cual (retrato y colores).
// Así una ficha antigua o a medias no rompe el motor ni las pestañas.

import { ABILITIES, type Ability } from './data/types'
import { CHARACTER_SCHEMA, type Character, type LevelUpRecord, type Look, type PlayState } from './model/character'

type Obj = Record<string, unknown>

const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x)
/** Copia de un objeto sin la clave «__proto__» (JSON.parse la deja como propia). */
const own = (x: unknown): Obj => {
  const out: Obj = {}
  if (isObj(x)) for (const [k, v] of Object.entries(x)) if (k !== '__proto__') out[k] = v
  return out
}
const str = (x: unknown, d = '') => (typeof x === 'string' ? x : d)
const optStr = (x: unknown) => (typeof x === 'string' ? x : undefined)
const num = (x: unknown, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : d)
const optNum = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const int = (x: unknown, min: number, max: number, d: number) => Math.min(max, Math.max(min, Math.round(num(x, d))))
const strs = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [])
const objs = (x: unknown) => (Array.isArray(x) ? x.filter(isObj) : [])
/** Diccionario cuyos valores pasan `ok` (los demás se tiran). */
function dict<T>(x: unknown, fix: (v: unknown) => T | undefined): Record<string, T> {
  const out: Record<string, T> = {}
  for (const [k, v] of Object.entries(own(x))) {
    const f = fix(v)
    if (f !== undefined) out[k] = f
  }
  return out
}

/* ---------- Lo que se pinta tal cual: retrato y colores ---------- */

// Solo imágenes incrustadas: una dirección cualquiera haría que el móvil la pidiera al abrir la ficha.
const PORTRAIT = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/]+=*$/i
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
// object-position: «50% 30%», «center top», «0px 12px»
const POSITION = /^[a-z0-9.%\s-]{1,40}$/i

export const safePortrait = (x: unknown) => (typeof x === 'string' && PORTRAIT.test(x) ? x : undefined)
export const safeColor = (x: unknown) => (typeof x === 'string' && HEX.test(x.trim()) ? x.trim() : undefined)
export const safePosition = (x: unknown) => (typeof x === 'string' && POSITION.test(x) ? x : undefined)

function look(x: unknown): Look | undefined {
  if (!isObj(x)) return undefined
  const out: Look = own(x) as Look
  out.portrait = safePortrait(x.portrait)
  out.portraitPosition = safePosition(x.portraitPosition)
  const p = x.palette
  out.palette = isObj(p) ? { light: dict(p.light, safeColor), dark: dict(p.dark, safeColor) } : undefined
  for (const k of ['portrait', 'portraitPosition', 'palette'] as const) if (out[k] === undefined) delete out[k]
  return Object.keys(out).length ? out : undefined
}

/* ---------- Ficha ---------- */

export interface MigrateOptions {
  /** PG máximos, para una ficha sin PG actuales (si no, se queda a 0). */
  maxHp?: (c: Character) => number
}

/** ¿De una versión de Zurrón más nueva que esta? Entonces no se toca. */
export const isNewerSchema = (x: unknown) => isObj(x) && typeof x.schema === 'number' && x.schema > CHARACTER_SCHEMA

/**
 * Ficha completa a partir de lo que haya: lo que falte o tenga un tipo raro se
 * cambia por el valor de una ficha vacía. Sin id o sin nombre (o de una versión
 * más nueva), devuelve undefined. Lo que no conoce lo deja tal cual.
 */
export function migrate(raw: unknown, opts: MigrateOptions = {}): Character | undefined {
  if (!isObj(raw) || typeof raw.id !== 'string' || !raw.id.trim() || typeof raw.name !== 'string' || isNewerSchema(raw)) return undefined
  const r = own(raw)
  const now = new Date().toISOString()
  const createdAt = str(r.createdAt, now)

  const scores = own(r.baseScores)
  const bonus = own(r.backgroundBonus)
  const spells = own(r.spells)
  const coins = own(r.coins)
  const ov = own(r.overrides)
  const st = own(r.state)
  const deathSaves = own(st.deathSaves)

  const c: Character = {
    ...(r as Partial<Character>),
    schema: CHARACTER_SCHEMA,
    id: raw.id,
    name: raw.name,
    player: optStr(r.player),
    tagline: optStr(r.tagline),
    createdAt,
    updatedAt: str(r.updatedAt, createdAt),

    speciesId: str(r.speciesId),
    speciesChoices: dict(r.speciesChoices, optStr),
    backgroundId: str(r.backgroundId),
    baseScores: Object.fromEntries(ABILITIES.map((a) => [a, num(scores[a], 10)])) as Record<Ability, number>,
    backgroundBonus: Object.fromEntries(ABILITIES.filter((a) => optNum(bonus[a]) !== undefined).map((a) => [a, bonus[a] as number])),

    classId: str(r.classId),
    level: int(r.level, 1, 20, 1),
    subclassId: optStr(r.subclassId),
    hpRolls: Array.isArray(r.hpRolls) ? r.hpRolls.map((x) => optNum(x) ?? null) : [],

    skills: strs(r.skills) as Character['skills'],
    expertise: strs(r.expertise) as Character['expertise'],
    tools: strs(r.tools),
    languages: strs(r.languages),
    extraProficiencies: Array.isArray(r.extraProficiencies) ? strs(r.extraProficiencies) : undefined,

    choices: dict(r.choices, (v) => (Array.isArray(v) ? strs(v) : undefined)),
    feats: objs(r.feats)
      .filter((f) => typeof f.id === 'string')
      .map((f) => ({
        ...own(f),
        id: f.id as string,
        source: str(f.source),
        abilityIncrease: isObj(f.abilityIncrease) ? dict(f.abilityIncrease, optNum) : undefined,
        choices: isObj(f.choices) ? dict(f.choices, (v) => (Array.isArray(v) ? strs(v) : undefined)) : undefined,
      })),
    weaponMasteries: strs(r.weaponMasteries),

    spells: {
      cantrips: strs(spells.cantrips),
      prepared: strs(spells.prepared),
      extra: objs(spells.extra)
        .filter((x) => typeof x.id === 'string')
        .map((x) => ({ ...own(x), id: x.id as string, source: str(x.source) }) as Character['spells']['extra'][number]),
    },

    equipment: objs(r.equipment)
      .filter((it) => typeof it.name === 'string')
      .map((it, i) => {
        const ref = own(it.ref)
        return {
          ...own(it),
          id: typeof it.id === 'string' && it.id ? it.id : `objeto-${i + 1}`,
          name: it.name as string,
          qty: Math.max(0, num(it.qty, 1)),
          ref: (ref.kind === 'arma' || ref.kind === 'armadura') && typeof ref.id === 'string' ? { kind: ref.kind, id: ref.id } : undefined,
          notes: optStr(it.notes),
          weight: optStr(it.weight),
        }
      }),
    coins: { pc: num(coins.pc), pp: num(coins.pp), pe: num(coins.pe), po: num(coins.po), ppt: num(coins.ppt) },

    customFeatures: objs(r.customFeatures)
      .filter((f) => typeof f.id === 'string' && typeof f.name === 'string')
      .map((f) => ({
        ...own(f),
        id: f.id as string,
        name: f.name as string,
        text: str(f.text),
        summary: optStr(f.summary),
        source: str(f.source, 'dm'),
        resources: Array.isArray(f.resources)
          ? objs(f.resources)
              .filter((x) => typeof x.id === 'string' && typeof x.name === 'string' && optNum(x.max) !== undefined)
              .map((x) => ({ id: x.id as string, name: x.name as string, max: x.max as number, recharge: (['corto', 'largo', 'corto-uno'].includes(x.recharge as string) ? x.recharge : 'largo') as 'corto' | 'largo' | 'corto-uno' }))
          : undefined,
      })),
    overrides: { ...own(ov), ac: optNum(ov.ac), speed: optNum(ov.speed), maxHp: optNum(ov.maxHp), initiative: optNum(ov.initiative), note: optStr(ov.note) },

    persona: dict(r.persona, optStr),
    look: look(r.look),
    guide: objs(r.guide)
      .filter((g) => typeof g.id === 'string')
      .map((g) => ({ id: g.id as string, title: str(g.title), body: str(g.body) })),
    notes: objs(r.notes)
      .filter((n) => typeof n.id === 'string')
      .map((n) => ({ id: n.id as string, date: /^\d{4}-\d{2}-\d{2}/.test(str(n.date)) ? (n.date as string).slice(0, 10) : createdAt.slice(0, 10), title: str(n.title), body: str(n.body) })),
    state: undefined as unknown as PlayState,
    history: [],
  }

  c.state = {
    ...own(st),
    hp: 0,
    tempHp: Math.max(0, num(st.tempHp)),
    hitDiceUsed: Math.max(0, num(st.hitDiceUsed)),
    slotsUsed: Array.isArray(st.slotsUsed) ? st.slotsUsed.map((x) => Math.max(0, num(x))) : [],
    pactSlotsUsed: Math.max(0, num(st.pactSlotsUsed)),
    resourcesUsed: dict(st.resourcesUsed, optNum),
    conditions: strs(st.conditions),
    exhaustion: int(st.exhaustion, 0, 6, 0),
    deathSaves: { success: int(deathSaves.success, 0, 3, 0), fail: int(deathSaves.fail, 0, 3, 0) },
    heroicInspiration: st.heroicInspiration === true,
    concentration: optStr(st.concentration),
    toggles: dict(st.toggles, (v) => (typeof v === 'boolean' ? v : undefined)),
  }
  // Los PG actuales necesitan las reglas (los máximos salen del motor)
  const hp = optNum(st.hp)
  if (hp !== undefined) c.state.hp = Math.max(0, hp)
  else if (opts.maxHp) {
    try {
      c.state.hp = opts.maxHp(c)
    } catch {
      // sin reglas para esta ficha: se queda a 0 y la persona lo corrige en Estado
    }
  }

  // Historial de subidas: cada copia de antes de subir también se pone al día
  c.history = objs(r.history).flatMap((h): LevelUpRecord[] => {
    const snap = migrate({ ...own(h.snapshot), history: [] })
    if (!snap || optNum(h.fromLevel) === undefined || optNum(h.toLevel) === undefined) return []
    const { history: _h, ...snapshot } = snap
    return [{ date: str(h.date, c.updatedAt), fromLevel: h.fromLevel as number, toLevel: h.toLevel as number, snapshot, summary: strs(h.summary) }]
  })

  // Lo opcional que ha quedado vacío no se guarda
  for (const k of ['player', 'tagline', 'subclassId', 'extraProficiencies', 'look'] as const) if (c[k] === undefined) delete c[k]
  return c
}
