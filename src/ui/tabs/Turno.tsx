import { useLayoutEffect, useState } from 'preact/hooks'
import { ABILITIES, type ClassData, type Recharge, type SpellData, type WeaponData } from '../../data/types'
import type { Character } from '../../model/character'
import { ABILITY_NAMES, metres, signed, squares } from '../../rules/constants'
import { masteryWeapons } from '../../rules/create'
import { atLevel, type Attack, type Derived, type FeatureView, type ResourceView } from '../../rules/derive'
import { setResourceUsed } from '../../rules/rests'
import { href } from '../../router'
import { Disclosure, Modal, Option, Pips, RichText, useRules } from '../common'
import { keepUnits } from '../SpellEditor'
import type { TabProps } from '../Sheet'
import '../css/combate.css'

/**
 * Rasgos que se usan con tu acción: «como acción», «acción de Magia»… y los que
 * mejoran una acción de cualquiera («puedes llevar a cabo la acción de esconderte…»),
 * salvo si en la misma frase la hacen «como acción adicional» (Defensa paciente).
 */
const ACTION_RE =
  /\b(como|usar|usando|realizar|realizando|llevar a cabo|gastar) (una |tu )?acción(?! adicional)\b|acción de Magia|\b(llevar a cabo|realizar|usar) la acción de (esconder|correr|destrabar|esquivar|ayudar|buscar|influir|estudiar|utilizar)(?![^.]*acción adicional)/i
const BONUS_RE = /acción adicional/i
const REACTION_RE = /\breacción\b/i
/**
 * Rasgos que cambian o añaden algo a tus ataques («cuando lleves a cabo la acción de atacar»,
 * «cuando aciertes», «daño adicional»…). Van junto a los ataques, que es donde se buscan.
 */
const ATTACK_RE =
  /acción de atacar|aciert(?:es|as)\b|al acertar|cuando ataques|si utilizas ataque temerario|primera tirada de ataque|tirada de ataque contra una criatura y fallas|falles con una tirada de ataque|tiradas de ataque con armas|daño (?:adicional|extra)|ataque extra|ataque sin armas|tires el daño/i
/** «Ataque adicional» y sus mejoras: cuántos ataques haces con la acción de atacar. */
const EXTRA_ATTACK_RE = /podrás hacer (dos|tres|cuatro) ataques en lugar de uno/i
const COUNT: Record<string, number> = { dos: 2, tres: 3, cuatro: 4 }

/** Pista de recarga, como frase (igual que en Estado). */
const RECHARGE: Record<Recharge, string> = {
  corto: 'Vuelven con descanso corto o largo',
  largo: 'Vuelven con descanso largo',
  'corto-uno': 'Recuperas 1 con descanso corto y todos con largo',
  amanecer: 'Vuelven al amanecer',
}

/** Cada maestría en una línea, para quien no sabe jugar (el texto completo, abajo en el selector). */
const MASTERY_LINE: Record<string, string> = {
  debilitar: 'Si aciertas, su próximo ataque va con desventaja.',
  derribar: 'Si aciertas, puede caer al suelo.',
  empujar: 'Si aciertas, lo apartas 3 m de ti.',
  hender: 'Si aciertas, puedes atacar también a otro que esté a su lado.',
  mellar: 'Con dos armas ligeras, el ataque de la segunda no gasta tu acción adicional.',
  molestar: 'Si le haces daño, tu siguiente ataque contra él va con ventaja.',
  ralentizar: 'Si le haces daño, pierde 3 m de velocidad.',
  rozar: 'Aunque falles, le haces algo de daño.',
}

function firstSentence(t: string) {
  const plain = t.replace(/\*\*/g, '').split('\n')[0]
  const m = plain.match(/^.{20,220}?[.!?](\s|$)/)
  return m ? m[0].trim() : plain.slice(0, 200)
}

function FeatureLine({ f }: { f: FeatureView }) {
  return (
    <Disclosure title={f.name} summary={keepUnits(f.summary ?? firstSentence(f.text))}>
      <RichText text={keepUnits(f.text)} />
    </Disclosure>
  )
}

interface Breath {
  f: FeatureView
  dc: number
  save: string
  dice: string
  /** Tipo de daño según el linaje elegido. */
  type?: string
  shape?: string
  uses?: ResourceView
}

/**
 * Ataque de aliento (dracónido): CD, salvación, dados según el nivel y tipo de daño
 * según el linaje, sacados del texto del rasgo. Si algo no se puede leer, no hay fila
 * y el rasgo sale como uno más en «Tus rasgos al atacar».
 */
function breathOf(d: Derived): Breath | undefined {
  const f = d.features.find((x) => x.origin === 'especie' && /^Ataque de aliento$/i.test(x.name))
  if (!f) return undefined
  const t = f.text
  const save = t.match(/salvación de (\p{L}+)/u)?.[1]
  const abilityName = t.match(/CD 8 más tu modificador por (\p{L}+)/u)?.[1]
  const ability = ABILITIES.find((a) => ABILITY_NAMES[a] === abilityName)
  let dice = t.match(/(\d+d\d+) de daño/)?.[1]
  // «El daño aumenta… a los niveles 5 (2d10), 11 (3d10) y 17 (4d10)»
  for (const [, lvl, dd] of t.matchAll(/(\d+) \((\d+d\d+)\)/g)) if (d.level >= Number(lvl)) dice = dd
  if (!save || !ability || !dice) return undefined
  const lineage = d.features.find((x) => x.origin === 'especie' && x !== f && x.choice && /aliento/i.test(x.text))
  const opt = lineage?.choice?.options?.find((o) => lineage.chosen?.includes(o.id))
  const type = opt?.name.match(/\(([^)]+)\)/)?.[1] ?? opt?.text?.match(/daño de (\p{L}+)/u)?.[1]
  const cone = t.match(/cono de ([\d,]+ m)/)?.[1]
  const line = t.match(/línea de ([\d,]+ m)/)?.[1]
  return {
    f,
    dc: 8 + d.mods[ability] + d.pb,
    save,
    dice,
    type,
    shape: cone && line ? `un cono de ${cone} o una línea de ${line} (eliges cada vez)` : undefined,
    uses: d.resources.find((r) => r.origin === 'especie' && /aliento/i.test(r.name)),
  }
}

/** El aliento como una fila más de la lista de ataques: se usa en lugar de uno de ellos. */
function BreathRow({ b, c, update }: { b: Breath; c: Character; update: (c: Character) => void }) {
  const u = b.uses
  const left = u ? u.max - u.used : 0
  return (
    <div class="cb-atk">
      <h3 class="cb-atk-name">{b.f.name}</h3>
      <div class="cb-atk-nums">
        <div class="cb-atk-cell">
          <span class="label">Salvación</span>
          <span class="cb-atk-v">CD {b.dc}</span>
          <span class="cb-atk-s">de {b.save}</span>
        </div>
        <div class="cb-atk-cell">
          <span class="label">Daño</span>
          <span class="cb-atk-v">
            {b.dice} {b.type && <span class="cb-type">{b.type}</span>}
          </span>
          <span class="cb-atk-s">La mitad si la superan</span>
        </div>
      </div>
      <p class="cb-atk-p">
        {keepUnits(
          `Cambias uno de tus ataques por un soplo${b.shape ? `: ${b.shape}` : ''}. Quien esté dentro hace una salvación de ${b.save}: si falla, recibe el daño; si la supera, la mitad.`,
        )}
        {!b.type && ' El tipo de daño lo decide tu linaje dracónico: elígelo en Rasgos.'}
      </p>
      {u && (
        <div class="cb-uses">
          <Pips max={u.max} used={u.used} label={`Usos de ${b.f.name}`} onChange={(n) => update(setResourceUsed(c, u.key, n, u.max))} />
          <span>
            Te {left === 1 ? 'queda' : 'quedan'} {left} de {u.max}. {RECHARGE[u.recharge]}.
          </span>
        </div>
      )}
    </div>
  )
}

/** «a, b y c» */
function listEs(xs: string[]) {
  return xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`
}

/** «A dos manos, munición (virote) y recarga.» */
const sentence = (t: string) => {
  const low = t.toLowerCase()
  return `${low.charAt(0).toUpperCase()}${low.slice(1)}.`
}

const RANGE_RE = /^(Arrojadiza|Munición)\s*\(alcance\s*([\d,.]+)\/([\d,.]+)(?:;\s*([^)]+))?\)/i

/** Propiedades del arma en limpio y el alcance explicado en una frase. */
function weaponText(a: Attack) {
  const props: string[] = []
  let reach: string | undefined
  for (const p of a.properties) {
    const m = p.match(RANGE_RE)
    if (m) {
      const [, kind, near, far, ammo] = m
      const thrown = /^arroj/i.test(kind)
      props.push(ammo ? `${kind} (${ammo})` : kind)
      // Espacio duro entre cifra y «m» para que no se partan
      const nb = String.fromCharCode(160)
      reach = thrown ? `Si la lanzas, llega a ${near}${nb}m; hasta ${far}${nb}m con desventaja.` : `Alcance de ${near}${nb}m; hasta ${far}${nb}m con desventaja.`
      continue
    }
    props.push(/^Versátil/i.test(p) ? 'Versátil' : p)
  }
  return { props, reach }
}

function AttackRow({ a }: { a: Attack }) {
  const { props, reach } = weaponText(a)
  return (
    <div class="cb-atk">
      <h3 class="cb-atk-name">{a.name}</h3>
      <div class="cb-atk-nums">
        <div class="cb-atk-cell">
          <span class="label">Atacar</span>
          <span class="cb-atk-v">
            <span class="cb-d20">d20</span> {signed(a.attack)}
          </span>
        </div>
        <div class="cb-atk-cell">
          <span class="label">Daño</span>
          <span class="cb-atk-v">
            {a.damage} <span class="cb-type">{a.damageType}</span>
          </span>
          {a.versatile && <span class="cb-atk-s">A dos manos: {a.versatile}</span>}
        </div>
      </div>
      {(props.length > 0 || reach) && (
        <p class="cb-atk-p">
          {props.length > 0 && <>{sentence(listEs(props))} </>}
          {reach}
        </p>
      )}
      {a.mastery && (
        <p class="cb-atk-p cb-mastery">
          <span class="tag accent">Maestría: {a.mastery.name}</span>
          {keepUnits(a.mastery.text?.replace(/\*\*/g, '') ?? '')}
        </p>
      )}
      {a.notes.map((n) => (
        <p class="cb-atk-p" key={n}>
          {n}
        </p>
      ))}
    </div>
  )
}

const DAMAGE_TYPES = 'ácido|contundente|cortante|frío|fuego|fuerza|necrótico|perforante|psíquico|radiante|relámpago|trueno|veneno'
/** Salvación que hace el objetivo (no «ventaja en las tiradas de salvación de…», que es para ti). */
const SAVE_RE = new RegExp(String.raw`(?<!ventaja en |en las |a las |en sus |haz una )tiradas? de salvación de (${ABILITIES.map((a) => ABILITY_NAMES[a]).join('|')})`, 'u')
/** «1d8 de daño radiante», «1d4 + 1 de daño de fuerza», «2d8 de daño radiante adicional». */
const DAMAGE_RE = new RegExp(String.raw`(\d+d\d+(?:\s*\+\s*\d+)?) de daño(?: (?:de )?(${DAMAGE_TYPES}))?( adicional)?`, 'u')
/** «una cantidad de daño de fuerza igual a 1d8 más tu modificador por aptitud mágica» (Arma espiritual). */
const DAMAGE_MOD_RE = new RegExp(String.raw`daño (?:de )?(${DAMAGE_TYPES}) igual a (\d+d\d+) más tu modificador por aptitud mágica`, 'u')
const HEAL_RE = /recuperan? una cantidad de puntos de golpe igual a (\d+d\d+) más tu modificador por aptitud mágica/
/** Frase que dice qué pasa: el daño, el estado, la curación o el acierto. */
const OUTCOME_RE = /daño|recupera|estado de|aciert/
/** La frase del daño habla de acertar, de la salvación o de quien lo recibe. */
const HIT_RE = /aciert|salvación|falla|supera|recib|sufr|objetivo/i
const BEAMS: Record<string, number> = { dos: 2, tres: 3, cuatro: 4 }

/** Lo que hace falta en la mesa para lanzar un conjuro que ataca, obliga a salvar o cura. */
export interface SpellCard {
  s: SpellData
  attack?: number
  save?: { dc: number; ability: string }
  /** Dados a tu nivel (los trucos mejoran a los niveles 5, 11 y 17); `extra` si se suma a un ataque (Castigo divino). */
  damage?: { dice: string; type?: string; extra: boolean }
  /** La mitad del daño si superan la salvación. */
  half: boolean
  heal?: string
  /** Rayos de Descarga sobrenatural a tu nivel (un ataque por rayo). */
  beams?: number
  /** Una frase del conjuro con su efecto. */
  effect: string
}

/**
 * Cifras de un conjuro sacadas de su texto: tirada de ataque, CD y salvación, dados de daño o
 * de curación. Sin nada de eso (Detectar magia, Escudo…) no hay tarjeta: queda como chip.
 */
export function spellCard(s: SpellData, level: number, n: { dc: number; attack: number; mod: number }): SpellCard | undefined {
  const t = s.text.replace(/\*\*/g, '')
  const attack = /ataque de conjuro/i.test(t) ? n.attack : undefined
  const sv = t.match(SAVE_RE)
  const save = sv ? { dc: n.dc, ability: sv[1] } : undefined
  const plus = (dice: string) => (n.mod === 0 ? dice : `${dice} ${n.mod > 0 ? '+' : '−'} ${Math.abs(n.mod)}`)
  let damage: SpellCard['damage']
  const dm = t.match(DAMAGE_MOD_RE)
  const dd = t.match(DAMAGE_RE)
  const sentences = t
    .split(/\n+|•/)
    .flatMap((p) => p.match(/[^.!?]+[.!?]?/g) ?? [])
    .map((x) => x.trim())
    .filter(Boolean)
  if (dm && (!dd || (dm.index ?? 0) < (dd.index ?? 0))) damage = { dice: plus(dm[2]), type: dm[1], extra: false }
  // Solo el daño que hace el conjuro al objetivo (no el de la Telaraña si arde)
  else if (dd && (dd[3] || HIT_RE.test(sentences.find((x) => x.includes(dd[0])) ?? '')))
    damage = { dice: dd[1].replace(/\s*\+\s*/, ' + '), type: dd[2], extra: !!dd[3] }
  const base = damage?.dice
  // «El daño aumenta en 1d8 cuando alcanzas los niveles 5 (2d8), 11 (3d8) y 17 (4d8)»
  if (damage && s.level === 0 && /El daño aumenta/.test(s.higherLevels ?? ''))
    for (const [, lvl, dice] of (s.higherLevels ?? '').matchAll(/(\d+) \((\d+d\d+)\)/g)) if (level >= Number(lvl)) damage.dice = dice
  let beams: number | undefined
  for (const [, w, lvl] of (s.higherLevels ?? '').matchAll(/(dos|tres|cuatro) rayos a nivel (\d+)/g)) if (level >= Number(lvl)) beams = BEAMS[w]
  const h = t.match(HEAL_RE)
  const heal = h ? plus(h[1]) : undefined
  if (attack === undefined && !save && !heal && !damage?.extra) return undefined
  let effect = sentences.find((x) => OUTCOME_RE.test(x)) ?? sentences.find((x) => SAVE_RE.test(x)) ?? sentences[0] ?? ''
  // El dado de la frase, el de tu nivel; y si es muy larga, hasta una coma
  if (base && damage && damage.dice !== base) effect = effect.replace(base, damage.dice)
  if (effect.length > 230) {
    const cut = Math.max(effect.lastIndexOf(', ', 225), effect.lastIndexOf('; ', 225))
    effect = `${effect.slice(0, cut > 100 ? cut : effect.lastIndexOf(' ', 225)).trim()}…`
  }
  return { s, attack, save, damage, half: !!save && /la mitad (?:del |de |de ese )daño/.test(t), heal, beams, effect }
}

/** Un conjuro con cifras como una fila más de la lista de ataques; el botón abre su ficha en Conjuros. */
function SpellRow({ k, link }: { k: SpellCard; link: string }) {
  const { s } = k
  return (
    <div class="cb-atk">
      <h3 class="cb-atk-name">
        {s.name}
        <span class="tag">{s.level > 0 ? `Nv ${s.level}` : 'Truco'}</span>
        {s.concentration && <span class="tag">C</span>}
      </h3>
      <div class="cb-atk-nums">
        {k.attack !== undefined ? (
          <div class="cb-atk-cell">
            <span class="label">Atacar</span>
            <span class="cb-atk-v">
              <span class="cb-d20">d20</span> {signed(k.attack)}
            </span>
            {k.beams && <span class="cb-atk-s">{k.beams} rayos: un ataque por rayo</span>}
          </div>
        ) : (
          k.save && (
            <div class="cb-atk-cell">
              <span class="label">Salvación</span>
              <span class="cb-atk-v">CD {k.save.dc}</span>
              <span class="cb-atk-s">de {k.save.ability}</span>
            </div>
          )
        )}
        {k.damage && (
          <div class="cb-atk-cell">
            <span class="label">{k.damage.extra ? 'Daño extra' : 'Daño'}</span>
            <span class="cb-atk-v">
              {k.damage.dice} {k.damage.type && <span class="cb-type">{k.damage.type}</span>}
            </span>
            {k.half && <span class="cb-atk-s">La mitad si la superan</span>}
          </div>
        )}
        {k.heal && !k.damage && (
          <div class="cb-atk-cell">
            <span class="label">Curación</span>
            <span class="cb-atk-v">{k.heal}</span>
            <span class="cb-atk-s">puntos de golpe</span>
          </div>
        )}
      </div>
      {k.effect && <p class="cb-atk-p">{keepUnits(k.effect)}</p>}
      <p class="cb-atk-p">
        <a class="btn soft sm" href={link} aria-label={`${s.level > 0 ? 'Lanzar' : 'Leer'} ${s.name}`}>
          {s.level > 0 ? 'Lanzar' : 'Leer el conjuro'}
        </a>
      </p>
    </div>
  )
}

export function Turno({ c, d, update }: TabProps) {
  const rules = useRules()
  const [masteryOpen, setMasteryOpen] = useState(false)

  const castable: SpellData[] = [...c.spells.cantrips, ...c.spells.prepared, ...(d.spell?.alwaysPrepared ?? []), ...c.spells.extra.map((x) => x.id)]
    .filter((id, i, all) => all.indexOf(id) === i)
    .map((id) => rules.spell(id))
    .filter((s): s is SpellData => !!s)
    .sort((a, b) => a.level - b.level)
  const byTime = (re: RegExp) => castable.filter((s) => re.test(s.castingTime))
  const actionSpells = byTime(/^Acción(?! adicional)/i)
  const bonusSpells = byTime(/^Acción adicional/i)
  const reactionSpells = byTime(/^Reacción/i)

  const actionFeatures = d.features.filter((f) => ACTION_RE.test(f.text) && !BONUS_RE.test(f.text.split('\n')[0]))
  const bonusFeatures = d.features.filter((f) => BONUS_RE.test(f.text))
  const reactionFeatures = d.features.filter((f) => REACTION_RE.test(f.text))
  // Manda el de más ataques (a nivel 11 el guerrero tiene «Ataque adicional» y «Dos ataques adicionales»)
  const extraAttack = d.features
    .map((f) => ({ f, n: COUNT[f.text.match(EXTRA_ATTACK_RE)?.[1].toLowerCase() ?? ''] ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)[0]
  const breath = breathOf(d)
  const attackFeatures = d.features.filter(
    (f) =>
      ATTACK_RE.test(f.text) &&
      !EXTRA_ATTACK_RE.test(f.text) &&
      f !== breath?.f &&
      !actionFeatures.includes(f) &&
      !bonusFeatures.includes(f) &&
      !reactionFeatures.includes(f),
  )
  const genericActions = rules.book.glossary.filter((g) => g.tag === 'Acción')
  const opportunity = rules.glossary('ataques-de-oportunidad')

  const masteryMax = atLevel(d.cls?.weaponMastery, c.level) ?? 0
  const masteryLeft = masteryMax - c.weaponMasteries.length
  // Cada conjuro abre su ficha en Conjuros (con el botón de lanzar)
  const spellHref = (s: SpellData) => `${href({ name: 'sheet', id: c.id, tab: 'conjuros' })}?conjuro=${encodeURIComponent(s.id)}`
  /** CD, ataque y modificador del conjuro: los de tu clase o, si es de una dote o especie, los de su característica. */
  const castWith = (id: string) => {
    const x = c.spells.extra.find((e) => e.id === id)
    const own = c.spells.cantrips.includes(id) || c.spells.prepared.includes(id) || !!d.spell?.alwaysPrepared.includes(id)
    if (d.spell && (own || !x?.ability)) return { dc: d.spell.dc, attack: d.spell.attack, mod: d.mods[d.spell.ability] }
    if (!x?.ability) return undefined
    const m = d.mods[x.ability]
    return { dc: 8 + d.pb + m, attack: d.pb + m - d.exhaustion.d20, mod: m }
  }
  /** Los que atacan, piden salvación o curan van como tarjetas; el resto, como chips. */
  const spellList = (list: SpellData[], others: string) => {
    const cards = list.map((s) => ({ s, k: castWith(s.id) })).map(({ s, k }) => ({ s, card: k && spellCard(s, d.level, k) }))
    const withCard = cards.filter((x) => x.card)
    const rest = cards.filter((x) => !x.card).map((x) => x.s)
    return (
      <>
        {withCard.length > 0 && (
          <div class="list">
            {withCard.map(({ s, card }) => (
              <SpellRow k={card!} link={spellHref(s)} key={s.id} />
            ))}
          </div>
        )}
        {rest.length > 0 && (
          <div>
            {withCard.length > 0 && <h4 class="cb-also">{others}</h4>}
            <div class="chips">
              {rest.map((s) => (
                <a class="chip" key={s.id} href={spellHref(s)}>
                  {s.name}
                  {s.level > 0 && <span class="cb-chip-lv">Nv {s.level}</span>}
                </a>
              ))}
            </div>
          </div>
        )}
      </>
    )
  }
  const ex = d.exhaustion

  return (
    <div>
      <p class="lede">Cada turno tienes estas cuatro cosas. No hace falta usarlas todas, y puedes hacerlas en el orden que quieras.</p>

      <h2>Movimiento</h2>
      <div class="card cb-move">
        <div class="cb-move-v">
          <div class="v">{metres(d.speed)}</div>
          <div class="s">{squares(d.speed)} casillas</div>
          {ex.level > 0 && <div class="s">Cansancio −{metres(ex.speed)}</div>}
        </div>
        <p>Puedes partirlo: moverte, atacar y seguir moviéndote. Si te alejas de un enemigo que te tiene a su alcance, puede hacerte un ataque de oportunidad (salvo que uses la acción de Destrabarse).</p>
      </div>

      <h2>
        Acción <span class="cb-h2n">1 por turno</span>
      </h2>
      <div class="cb-sec">
        <h3 class="cb-sub">Atacar</h3>
        <p class="cb-hint">
          Tira d20 y suma el número de «Atacar». Si iguala o supera la CA del enemigo, aciertas y tiras el daño. Un 20 natural es crítico: tiras los dados de daño dos veces.
          {ex.level > 0 && ` Tu cansancio ya está restado (−${ex.d20}).`}
          {extraAttack && (
            <>
              {' '}
              Con <strong>{extraAttack.f.name}</strong> haces {extraAttack.n} ataques con esta acción.
            </>
          )}
        </p>
        <div class="list">
          {d.attacks.map((a) => (
            <AttackRow a={a} key={a.key} />
          ))}
          {breath && <BreathRow b={breath} c={c} update={update} />}
        </div>
        {attackFeatures.length > 0 && (
          <div>
            <h4 class="cb-also">Tus rasgos al atacar</h4>
            {attackFeatures.map((f) => (
              <FeatureLine f={f} key={f.key} />
            ))}
          </div>
        )}
        {masteryMax > 0 &&
          (masteryLeft === 0 ? (
            <button id="revisar-maestrias" class="btn soft block cb-mbtn" aria-label={`Cambiar maestrías con armas (${c.weaponMasteries.length} de ${masteryMax})`} onClick={() => setMasteryOpen(true)}>
              <span class="cb-mbtn-t">Maestrías con armas</span>
              <span class="cb-n">
                {c.weaponMasteries.length} de {masteryMax}
              </span>
            </button>
          ) : (
            <button id="revisar-maestrias" class="btn primary block cb-mbtn" onClick={() => setMasteryOpen(true)}>
              <span class="cb-mbtn-t">
                Maestrías con armas
                <small>
                  {masteryLeft > 0
                    ? `Te ${masteryLeft === 1 ? 'falta 1' : `faltan ${masteryLeft}`}: toca para ${masteryLeft === 1 ? 'elegirla' : 'elegirlas'}`
                    : `Te ${masteryLeft === -1 ? 'sobra 1' : `sobran ${-masteryLeft}`}: toca para quitar`}
                </small>
              </span>
              <span class="cb-n">
                {c.weaponMasteries.length} de {masteryMax}
              </span>
            </button>
          ))}

        {actionSpells.length > 0 && (
          <>
            <h3 class="cb-sub">Lanzar un conjuro</h3>
            <p class="cb-hint">Con «Atacar», tira d20 y suma el número, como con un arma. Con «Salvación», tira el objetivo: si no saca tu CD o más, le afecta. Los trucos no gastan espacios.</p>
            {spellList(actionSpells, 'Otros conjuros con tu acción')}
          </>
        )}

        {actionFeatures.length > 0 && (
          <>
            <h3 class="cb-sub">Con tus rasgos</h3>
            <div>
              {actionFeatures.map((f) => (
                <FeatureLine f={f} key={f.key} />
              ))}
            </div>
          </>
        )}

        <div class="cb-others">
          <Disclosure title="Otras acciones que puede hacer cualquiera" summary="Correr, Esquivar, Destrabarse, Ayudar, Esconderse, Influir…">
            {genericActions.map((g) => (
              <div class="cb-gen" key={g.id}>
                <h4>{g.name}</h4>
                <RichText text={keepUnits(g.text)} />
              </div>
            ))}
          </Disclosure>
        </div>
      </div>

      <h2>
        Acción adicional <span class="cb-h2n">1 por turno</span>
      </h2>
      <div class="cb-sec">
        {bonusFeatures.length === 0 && bonusSpells.length === 0 && <p class="cb-empty">Ahora mismo nada te da una acción adicional. Solo existe si un rasgo o conjuro lo dice.</p>}
        {bonusFeatures.length > 0 && (
          <div>
            {bonusFeatures.map((f) => (
              <FeatureLine f={f} key={f.key} />
            ))}
          </div>
        )}
        {bonusSpells.length > 0 && (
          <>
            <h3 class="cb-sub">Conjuros de acción adicional</h3>
            {spellList(bonusSpells, 'Otros conjuros de acción adicional')}
          </>
        )}
      </div>

      <h2>
        Reacción <span class="cb-h2n">1 por ronda</span>
      </h2>
      <div class="cb-sec">
        <div>
          <Disclosure title="Ataque de oportunidad" summary="Cuando un enemigo que ves sale de tu alcance, puedes hacerle un ataque cuerpo a cuerpo.">
            {opportunity && <RichText text={keepUnits(opportunity.text)} />}
          </Disclosure>
          {reactionFeatures.map((f) => (
            <FeatureLine f={f} key={f.key} />
          ))}
        </div>
        {reactionSpells.length > 0 && (
          <>
            <h3 class="cb-sub">Conjuros de reacción</h3>
            {spellList(reactionSpells, 'Otros conjuros de reacción')}
          </>
        )}
      </div>

      <MasteryPicker open={masteryOpen} onClose={() => setMasteryOpen(false)} max={masteryMax} chosen={c.weaponMasteries} onSave={(ids) => update({ ...c, weaponMasteries: ids })} cls={d.cls} />
    </div>
  )
}

const WEAPON_GROUPS: { title: string; category: WeaponData['category']; kind: WeaponData['kind'] }[] = [
  { title: 'Sencillas cuerpo a cuerpo', category: 'sencilla', kind: 'cuerpo-a-cuerpo' },
  { title: 'Sencillas a distancia', category: 'sencilla', kind: 'distancia' },
  { title: 'Marciales cuerpo a cuerpo', category: 'marcial', kind: 'cuerpo-a-cuerpo' },
  { title: 'Marciales a distancia', category: 'marcial', kind: 'distancia' },
]

export function MasteryPicker({ open, onClose, max, chosen, onSave, cls }: { open: boolean; onClose: () => void; max: number; chosen: string[]; onSave: (ids: string[]) => void; cls?: ClassData }) {
  const rules = useRules()
  const [sel, setSel] = useState<string[]>(chosen)
  // Cada vez que se abre empieza por lo guardado: lo que se tocó y no se guardó se descarta
  useLayoutEffect(() => {
    if (open) setSel(chosen)
  }, [open])
  // Solo las armas que tu clase puede elegir (el bárbaro, cuerpo a cuerpo; el pícaro, sutiles o ligeras…).
  // Las que ya tenías se quedan en la lista para poder quitarlas.
  const allowed = cls ? new Set(masteryWeapons(cls, rules).map((w) => w.id)) : null
  const weapons = rules.book.weapons.filter((w) => !allowed || allowed.has(w.id) || chosen.includes(w.id))
  const toggle = (w: WeaponData) => setSel((s) => (s.includes(w.id) ? s.filter((x) => x !== w.id) : s.length < max ? [...s, w.id] : s))
  const left = max - sel.length
  const used = new Set(weapons.filter((w) => sel.includes(w.id)).map((w) => w.mastery))
  const full = max > 0 && left <= 0
  return (
    <Modal open={open} onClose={onClose} title={`Maestría con armas (${sel.length}/${max})`} dirty={sel.length !== chosen.length || sel.some((id) => !chosen.includes(id))}>
      <div class="cb-mp">
        <p class="lede">
          Elige con qué armas usas su propiedad de maestría: un efecto extra al golpear. Puedes cambiar una tras cada descanso largo.
          {left > 0 && <strong> Te {left === 1 ? 'falta 1' : `faltan ${left}`}.</strong>}
        </p>
        {sel.length > 0 && (
          <p class="cb-mp-picked">
            Elegidas: <strong>{listEs(sel.map((id) => rules.weapon(id)?.name ?? id))}</strong>.
          </p>
        )}
        {WEAPON_GROUPS.map((g) => {
          const list = weapons.filter((w) => w.category === g.category && w.kind === g.kind)
          if (!list.length) return null
          return (
            <div key={g.title}>
              <h3 class="cb-mp-group">{g.title}</h3>
              {list.map((w) => (
                <Option key={w.id} on={sel.includes(w.id)} onClick={() => toggle(w)} disabled={!sel.includes(w.id) && sel.length >= max}>
                  <span class="cb-mp-row">
                    <strong>{w.name}</strong>
                    <span class="cb-mp-m">{rules.mastery(w.mastery)?.name ?? w.mastery}</span>
                  </span>
                  {MASTERY_LINE[w.mastery] && <span class="cb-mp-why">{keepUnits(MASTERY_LINE[w.mastery])}</span>}
                </Option>
              ))}
            </div>
          )
        })}
        <div class="cb-mp-help">
          <Disclosure title="Qué hace cada maestría" summary={used.size ? `Las tuyas: ${listEs([...used].map((m) => rules.mastery(m)?.name ?? m))}` : undefined}>
            {rules.book.masteries.map((m) => (
              <div class="cb-gen" key={m.id}>
                <h4>{m.name}</h4>
                <RichText text={keepUnits(m.text)} />
              </div>
            ))}
          </Disclosure>
        </div>
      </div>
      <div class="footerbar cb-foot">
        {full && (
          <p class="cb-limit" role="status">
            {left === 0 ? `Ya tienes ${max}. Quita una para elegir otra.` : `Tienes ${sel.length} y el máximo es ${max}: quita ${-left}.`}
          </p>
        )}
        <button
          class="btn primary block"
          onClick={() => {
            onSave(sel)
            onClose()
          }}
        >
          Guardar
        </button>
      </div>
    </Modal>
  )
}
