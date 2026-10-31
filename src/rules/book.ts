// El "libro de reglas" que usa el motor: todos los datos del SRD más el
// contenido de la mesa, con índices por id. El motor nunca importa JSON
// directamente; recibe un Rules, así los tests pueden pasar datos de prueba.

import type {
  ArmorData,
  BackgroundData,
  ClassData,
  FeatData,
  GearData,
  RuleEntry,
  SpeciesData,
  SpellData,
  SubclassData,
  WeaponData,
} from '../data/types'

export interface SlotTables {
  /** [nivel de clase - 1][nivel de conjuro - 1] */
  completo: number[][]
  medio: number[][]
  pacto: { slots: number[]; slotLevel: number[] }
}

export interface RuleBook {
  classes: ClassData[]
  subclasses: SubclassData[]
  species: SpeciesData[]
  backgrounds: BackgroundData[]
  feats: FeatData[]
  spells: SpellData[]
  weapons: WeaponData[]
  armor: ArmorData[]
  masteries: RuleEntry[]
  weaponProperties: RuleEntry[]
  glossary: RuleEntry[]
  gear: GearData[]
  slots: SlotTables
}

function byId<T extends { id: string }>(xs: T[]): Map<string, T> {
  return new Map(xs.map((x) => [x.id, x]))
}

export class Rules {
  private readonly classes: Map<string, ClassData>
  private readonly subclasses: Map<string, SubclassData>
  private readonly species: Map<string, SpeciesData>
  private readonly backgrounds: Map<string, BackgroundData>
  private readonly feats: Map<string, FeatData>
  private readonly spells: Map<string, SpellData>
  private readonly weapons: Map<string, WeaponData>
  private readonly armors: Map<string, ArmorData>
  private readonly glossaryById: Map<string, RuleEntry>
  private readonly masteriesById: Map<string, RuleEntry>

  readonly book: RuleBook

  constructor(book: RuleBook) {
    this.book = book
    this.classes = byId(book.classes)
    this.subclasses = byId(book.subclasses)
    this.species = byId(book.species)
    this.backgrounds = byId(book.backgrounds)
    this.feats = byId(book.feats)
    this.spells = byId(book.spells)
    this.weapons = byId(book.weapons)
    this.armors = byId(book.armor)
    this.glossaryById = byId(book.glossary)
    this.masteriesById = byId(book.masteries)
  }

  cls(id: string) {
    return this.classes.get(id)
  }
  subclass(id: string | undefined) {
    return id ? this.subclasses.get(id) : undefined
  }
  subclassesOf(classId: string) {
    return this.book.subclasses.filter((s) => s.classId === classId)
  }
  speciesOf(id: string) {
    return this.species.get(id)
  }
  background(id: string) {
    return this.backgrounds.get(id)
  }
  feat(id: string) {
    return this.feats.get(id)
  }
  spell(id: string) {
    return this.spells.get(id)
  }
  weapon(id: string) {
    return this.weapons.get(id)
  }
  armor(id: string) {
    return this.armors.get(id)
  }
  mastery(id: string) {
    return this.masteriesById.get(id)
  }
  glossary(id: string) {
    return this.glossaryById.get(id)
  }
  /** Estados (Agarrado, Asustado...) del glosario. */
  conditions() {
    return this.book.glossary.filter((g) => g.tag === 'Estado')
  }
}
