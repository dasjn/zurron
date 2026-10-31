// Cambios de estado en partida: daño, curación, descansos, recursos.
// Todas las funciones devuelven un personaje nuevo (no mutan).

import type { Character, PlayState } from '../model/character'
import type { Derived } from './derive'

function withState(c: Character, patch: Partial<PlayState>): Character {
  return { ...c, state: { ...c.state, ...patch }, updatedAt: new Date().toISOString() }
}

const NO_SAVES = { success: 0, fail: 0 }

/* ---------- 0 PG: tiradas de salvación contra muerte ---------- */

/** Muerto: tres fallos (la muerte instantánea también se apunta como tres fallos). */
export const isDead = (s: PlayState) => s.deathSaves.fail >= 3
/** Estable: a 0 PG con tres éxitos. Sigue inconsciente, pero ya no tira salvaciones. */
export const isStable = (s: PlayState) => s.hp <= 0 && !isDead(s) && s.deathSaves.success >= 3

export interface DamageResult {
  next: Character
  /** Daño que se han comido los PG temporales. */
  fromTemp: number
  /** PG perdidos (sin contar los temporales). */
  lost: number
  /** Fallos de salvación contra muerte que suma este daño (solo a 0 PG). */
  failures: number
  /** El daño que sobra al caer a 0 PG (o el que recibes ya a 0) iguala o supera tus PG máximos. */
  instantDeath: boolean
  /** Ha muerto con este daño: muerte instantánea o tercer fallo. */
  died: boolean
  /** Conjuro en el que se concentraba y que pierde al caer inconsciente. */
  droppedConcentration?: string
}

/**
 * Daño. Primero se van los PG temporales y los PG nunca bajan de 0.
 * - Si te deja a 0 PG y el daño que sobra iguala o supera tus PG máximos, mueres al instante.
 * - Ya a 0 PG, cada daño es un fallo de salvación contra muerte (dos si es un crítico) y, si
 *   iguala o supera tus PG máximos, mueres. Si estabas estable, dejas de estarlo.
 * - A 0 PG quedas inconsciente (incapacitado): se rompe la concentración.
 */
export function applyDamage(c: Character, d: Derived, amount: number, crit = false): DamageResult {
  const s = c.state
  if (!(amount > 0) || isDead(s)) return { next: c, fromTemp: 0, lost: 0, failures: 0, instantDeath: false, died: false }
  const fromTemp = Math.min(s.tempHp, amount)
  const rest = amount - fromTemp
  const before = Math.max(0, s.hp)
  const hp = Math.max(0, before - rest)
  let deathSaves = s.deathSaves
  let failures = 0
  let instantDeath = false
  if (before > 0) {
    if (hp === 0) {
      instantDeath = rest - before >= d.maxHp
      deathSaves = instantDeath ? { success: 0, fail: 3 } : NO_SAVES
    }
  } else if (rest > 0) {
    instantDeath = rest >= d.maxHp
    failures = crit ? 2 : 1
    // Si estaba estable, la cuenta vuelve a empezar
    const from = isStable(s) ? NO_SAVES : s.deathSaves
    deathSaves = { success: from.success, fail: instantDeath ? 3 : Math.min(3, from.fail + failures) }
  }
  const droppedConcentration = hp === 0 ? s.concentration : undefined
  const next = withState(c, { tempHp: s.tempHp - fromTemp, hp, deathSaves, concentration: hp === 0 ? undefined : s.concentration })
  return { next, fromTemp, lost: before - hp, failures, instantDeath, died: isDead(next.state), droppedConcentration }
}

export function takeDamage(c: Character, d: Derived, amount: number, crit = false): Character {
  return applyDamage(c, d, amount, crit).next
}

/** CD de la tirada de salvación de Constitución para mantener la concentración: 10 o la mitad del daño (hacia abajo), hasta 30. */
export function concentrationDc(damage: number): number {
  return Math.min(30, Math.max(10, Math.floor(damage / 2)))
}

/**
 * Una tirada de salvación contra muerte: `roll` es lo que sale en el d20 y `penalty` lo que resta el cansancio.
 * Un total de 10 o más es un éxito; un 1 en el dado, dos fallos; un 20 en el dado te devuelve a 1 PG.
 */
export function deathSave(c: Character, roll: number, penalty = 0): Character {
  const s = c.state
  if (s.hp > 0 || isDead(s) || isStable(s)) return c
  if (roll >= 20) return withState(c, { hp: 1, deathSaves: NO_SAVES })
  if (roll > 1 && roll - penalty >= 10) return withState(c, { deathSaves: { ...s.deathSaves, success: Math.min(3, s.deathSaves.success + 1) } })
  return withState(c, { deathSaves: { ...s.deathSaves, fail: Math.min(3, s.deathSaves.fail + (roll <= 1 ? 2 : 1)) } })
}

/** Curación: cuenta desde 0 (nunca desde PG negativos) y no pasa del máximo. Si estabas a 0 PG, vuelves en ti y la cuenta de salvaciones se borra. */
export function heal(c: Character, d: Derived, amount: number): Character {
  if (!(amount > 0)) return c
  const before = Math.max(0, c.state.hp)
  const hp = Math.min(d.maxHp, before + Math.round(amount))
  return withState(c, { hp, deathSaves: before === 0 ? NO_SAVES : c.state.deathSaves })
}

/** Los PG temporales no se suman: te quedas con el valor más alto. */
export function setTempHp(c: Character, amount: number): Character {
  const tempHp = Math.max(c.state.tempHp, Math.round(amount) || 0)
  return tempHp === c.state.tempHp ? c : withState(c, { tempHp })
}

/** PG escritos a mano. Pasar de 0 a más borra la cuenta de salvaciones; caer a 0 rompe la concentración. */
export function setHp(c: Character, d: Derived, hp: number): Character {
  if (!Number.isFinite(hp)) return c
  const next = Math.max(0, Math.min(d.maxHp, Math.round(hp)))
  const was = Math.max(0, c.state.hp)
  if (next === was) return c.state.hp === was ? c : withState(c, { hp: next })
  const patch: Partial<PlayState> = { hp: next, deathSaves: NO_SAVES }
  if (next === 0) patch.concentration = undefined
  return withState(c, patch)
}

/* ---------- Descansos ---------- */

/** Para empezar un descanso, corto o largo, hay que tener al menos 1 PG. */
export const canRest = (c: Character) => c.state.hp > 0

/** «Ingenioso» (humano): obtienes Inspiración heroica al terminar un descanso largo. */
const RESOURCEFUL = 'humano-ingenioso'

/** ¿Terminar un descanso largo te da Inspiración heroica? */
export function longRestInspiration(d: Derived): boolean {
  return !!d.species?.traits.some((t) => t.id === RESOURCEFUL && t.level <= d.level)
}

/** Gastar un dado de puntos de golpe en un descanso corto: tirada + CON, mínimo 1. */
export function spendHitDie(c: Character, d: Derived, rolled: number): Character {
  if (c.state.hitDiceUsed >= d.level || !canRest(c)) return c
  const gained = Math.max(1, rolled + d.mods.con)
  return withState(c, {
    hitDiceUsed: c.state.hitDiceUsed + 1,
    hp: Math.min(d.maxHp, c.state.hp + gained),
  })
}

export function shortRest(c: Character, d: Derived): Character {
  if (!canRest(c)) return c
  const used = { ...c.state.resourcesUsed }
  for (const r of d.resources) {
    if (r.recharge === 'corto') used[r.key] = 0
    else if (r.recharge === 'corto-uno') used[r.key] = Math.max(0, (used[r.key] ?? 0) - 1)
  }
  return withState(c, { resourcesUsed: used, pactSlotsUsed: 0 })
}

export function longRest(c: Character, d: Derived): Character {
  if (!canRest(c)) return c
  const used: Record<string, number> = {}
  for (const [k, v] of Object.entries(c.state.resourcesUsed)) {
    const r = d.resources.find((x) => x.key === k)
    // Lo que se recarga al amanecer (objetos mágicos) lo dejamos como estaba.
    if (r?.recharge === 'amanecer') used[k] = v
  }
  return withState(c, {
    hp: d.maxHp,
    tempHp: 0,
    hitDiceUsed: 0,
    slotsUsed: [],
    pactSlotsUsed: 0,
    resourcesUsed: used,
    exhaustion: Math.max(0, c.state.exhaustion - 1),
    deathSaves: NO_SAVES,
    concentration: undefined,
    heroicInspiration: c.state.heroicInspiration || longRestInspiration(d),
  })
}

/* ---------- Espacios y usos ---------- */

export function setSlotsUsed(c: Character, d: Derived, spellLevel: number, used: number): Character {
  const max = d.spell?.slots[spellLevel - 1] ?? 0
  const slotsUsed = [...c.state.slotsUsed]
  while (slotsUsed.length < spellLevel) slotsUsed.push(0)
  slotsUsed[spellLevel - 1] = Math.max(0, Math.min(max, used))
  return withState(c, { slotsUsed })
}

export function setPactSlotsUsed(c: Character, d: Derived, used: number): Character {
  const max = d.spell?.pact?.slots ?? 0
  return withState(c, { pactSlotsUsed: Math.max(0, Math.min(max, used)) })
}

/** Gasta el espacio más bajo disponible de al menos `minLevel`. Devuelve undefined si no queda. */
export function spendSlot(c: Character, d: Derived, minLevel: number): { next: Character; level: number } | undefined {
  const slots = d.spell?.slots ?? []
  for (let l = Math.max(1, minLevel); l <= slots.length; l++) {
    const used = c.state.slotsUsed[l - 1] ?? 0
    if (used < slots[l - 1]) return { next: setSlotsUsed(c, d, l, used + 1), level: l }
  }
  const pact = d.spell?.pact
  if (pact && pact.level >= minLevel && c.state.pactSlotsUsed < pact.slots)
    return { next: setPactSlotsUsed(c, d, c.state.pactSlotsUsed + 1), level: pact.level }
  return undefined
}

export function setResourceUsed(c: Character, key: string, used: number, max: number): Character {
  return withState(c, { resourcesUsed: { ...c.state.resourcesUsed, [key]: Math.max(0, Math.min(max, used)) } })
}

/** Recurso con los usos gratis de un conjuro de dote o especie («<conjuro> gratis»), si los tiene. */
export function freeCast(d: Derived, spellId: string) {
  return d.resources.find((r) => r.spell === spellId)
}

/** Lanza gratis un conjuro de dote o especie: gasta un uso. Undefined si no le quedan. */
export function castFree(c: Character, d: Derived, spellId: string): Character | undefined {
  const r = freeCast(d, spellId)
  if (!r || r.used >= r.max) return undefined
  return setResourceUsed(c, r.key, r.used + 1, r.max)
}

/* ---------- Rasgos que curan ---------- */

/** Claves de recurso de los rasgos que curan con un toque. */
export const SECOND_WIND = 'clase:tomar-aliento'
export const LAY_ON_HANDS = 'clase:imponer-las-manos'

/** PG que da Tomar aliento: lo que sale en el d10 más tu nivel de guerrero. */
export function secondWindHealing(d: Derived, rolled: number): number {
  return Math.max(1, Math.min(10, Math.round(rolled))) + d.level
}

/** Tomar aliento (guerrero): gasta un uso y te cura 1d10 + tu nivel. `rolled` es lo que salió en el d10. */
export function secondWind(c: Character, d: Derived, rolled: number): Character | undefined {
  const r = d.resources.find((x) => x.key === SECOND_WIND)
  if (!r || r.used >= r.max) return undefined
  return setResourceUsed(heal(c, d, secondWindHealing(d, rolled)), r.key, r.used + 1, r.max)
}

/**
 * Imponer las manos (paladín): gasta `points` de la reserva (5 × nivel de paladín).
 * Si es para ti, recuperas esos PG; si es para otra criatura, aquí solo se gasta la reserva.
 */
export function layOnHands(c: Character, d: Derived, points: number, self: boolean): Character | undefined {
  const r = d.resources.find((x) => x.key === LAY_ON_HANDS)
  const n = Math.min(r ? r.max - r.used : 0, Math.round(points))
  if (!r || !(n > 0)) return undefined
  return setResourceUsed(self ? heal(c, d, n) : c, r.key, r.used + n, r.max)
}

export function patchState(c: Character, patch: Partial<PlayState>): Character {
  return withState(c, patch)
}
