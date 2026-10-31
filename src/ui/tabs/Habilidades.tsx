import { ABILITIES } from '../../data/types'
import { ABILITY_NAMES, ABILITY_SHORT, SKILLS, signed } from '../../rules/constants'
import type { TabProps } from '../Sheet'

/** «a, b y c» */
function listEs(xs: string[]) {
  return xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`
}

const ARMOR_NAMES = { ligera: 'ligeras', media: 'medias', pesada: 'pesadas' } as const

export function Habilidades({ c, d }: TabProps) {
  const anyHalf = Object.values(d.skills).some((x) => x.half)

  const armorTypes = d.cls ? (['ligera', 'media', 'pesada'] as const).filter((k) => d.cls!.armor[k]).map((k) => ARMOR_NAMES[k]) : []
  const shield = !!d.cls?.armor.escudo
  const armorText = armorTypes.length ? `Armaduras ${listEs(armorTypes)}${shield ? '; también escudos' : ''}` : shield ? 'Escudos' : ''

  return (
    <div>
      <div class="band">
        <div>
          <div class="label">Percepción pasiva</div>
          <div class="v">{d.passivePerception}</div>
          <div class="s">Lo que notas sin buscar</div>
        </div>
        <div>
          <div class="label">Competencia</div>
          <div class="v">{signed(d.pb)}</div>
          <div class="s">Bonificador</div>
        </div>
      </div>
      <p class="lede cb-after-band">Para una prueba tira d20 y suma el número. Si iguala o supera la dificultad (CD) que diga la DM, lo consigues.</p>
      {d.exhaustion.level > 0 && (
        <p class="notice">
          <strong>Cansancio {signed(-d.exhaustion.d20)}.</strong> Ya está restado en las salvaciones y las habilidades. En una prueba de característica sin habilidad, réstalo tú.
        </p>
      )}

      <h2>Características y salvaciones</h2>
      <div class="grid3" id="revisar-caracteristicas">
        {ABILITIES.map((a) => {
          const sv = d.saves[a]
          return (
            <div class="vital cb-abil" key={a}>
              <div class="label">{ABILITY_NAMES[a]}</div>
              <div class="v">{signed(d.mods[a])}</div>
              <div class="cb-score" title="Puntuación">
                <span class="cb-sr">Puntuación </span>
                {d.scores[a]}
              </div>
              <div class={`cb-save ${sv.proficient ? 'on' : ''}`}>
                <span class="cb-dotbox">
                  <span class={`dot ${sv.proficient ? 'on' : ''}`} aria-hidden="true" />
                </span>
                Salvación <strong>{signed(sv.bonus)}</strong>
                {sv.proficient && <span class="cb-sr"> (competente)</span>}
              </div>
            </div>
          )
        })}
      </div>
      <ul class="cb-keys cb-keys-col">
        <li>El número grande es lo que sumas al d20 cuando usas esa característica. El pequeño es la puntuación: de ella sale el grande.</li>
        <li>
          <span class="cb-dotbox">
            <span class="dot on" aria-hidden="true" />
          </span>
          <span>Competente: sumas tu bonificador por competencia ({signed(d.pb)}).</span>
        </li>
      </ul>

      <h2>Habilidades</h2>
      <div class="list" id="revisar-habilidades">
        {SKILLS.map((s) => {
          const v = d.skills[s.id]
          const kind = v.expertise ? 'double' : v.proficient ? 'on' : v.half ? 'half' : ''
          return (
            <div class={`li cb-skill ${kind ? 'on' : ''}`} key={s.id}>
              <span class="cb-dotbox">
                <span class={`dot ${kind}`} aria-hidden="true" />
              </span>
              <span class="grow">
                {s.name}
                {v.expertise && <span class="tag">Pericia</span>}
                {!v.expertise && v.proficient && <span class="cb-sr"> (competente)</span>}
                {v.half && !v.proficient && <span class="cb-sr"> (mitad de competencia)</span>}
              </span>
              <span class="cb-skill-ab" title={ABILITY_NAMES[s.ability]}>
                {ABILITY_SHORT[s.ability]}
              </span>
              <span class="v">{signed(v.bonus)}</span>
            </div>
          )
        })}
      </div>
      <ul class="cb-keys">
        <li>
          <span class="cb-dotbox">
            <span class="dot on" aria-hidden="true" />
          </span>
          Competente
        </li>
        <li>
          <span class="cb-dotbox">
            <span class="dot double" aria-hidden="true" />
          </span>
          Pericia: competencia doble
        </li>
        {anyHalf && (
          <li>
            <span class="cb-dotbox">
              <span class="dot half" aria-hidden="true" />
            </span>
            Aprendiz de mucho: la mitad
          </li>
        )}
      </ul>

      <h2>Herramientas, idiomas y armas</h2>
      <div class="card cb-prof">
        <div class="cb-prof-row">
          <div class="label">Herramientas</div>
          <p>{c.tools.length ? listEs(c.tools) : <span class="muted">Ninguna</span>}</p>
        </div>
        <div class="cb-prof-row">
          <div class="label">Idiomas</div>
          <p>{c.languages.length ? listEs(c.languages) : <span class="muted">Ninguno</span>}</p>
        </div>
        {d.cls && (
          <>
            <div class="cb-prof-row">
              <div class="label">Armas</div>
              <p>{d.cls.weaponText}</p>
            </div>
            <div class="cb-prof-row">
              <div class="label">Armaduras</div>
              <p>{armorText || <span class="muted">Ninguna</span>}</p>
            </div>
          </>
        )}
        {c.extraProficiencies?.length ? (
          <div class="cb-prof-row">
            <div class="label">Otras competencias</div>
            <p>{listEs(c.extraProficiencies)}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
