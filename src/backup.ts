// Copias de seguridad: un .json con una o varias fichas. En el móvil se usa
// el menú de compartir (para guardarlo en Archivos/Drive o mandarlo por chat);
// si no está disponible (Chrome en Android no suele compartir .json), se
// descarga. La copia lleva también el contenido de la mesa (trasfondos,
// dotes… que no están en el SRD), para que la ficha funcione igual en otro móvil.
// Al importar, cada ficha pasa por migrate(): lo que falte se rellena y lo raro se tira.

import { checkMesa, mesaOf, storedMesa, type MesaPack } from './mesa'
import { isNewerSchema, migrate } from './migrate'
import type { Character } from './model/character'
import type { RuleBook, Rules } from './rules/book'
import { derive } from './rules/derive'

/** La versión del formato de copia que sabe leer esta app. */
export const BACKUP_VERSION = 1

interface BackupFile {
  app: 'ficha-viva'
  version: number
  exportedAt: string
  characters: Character[]
  mesa?: MesaPack
}

export interface Backup {
  characters: Character[]
  mesa: MesaPack
  /** Cosas raras del archivo que no impiden importarlo, para contarlas. */
  warnings: string[]
}

export type ExportResult = { via: 'compartido' | 'descargado' | 'cancelado'; name: string }

/** Nombre de archivo sin caracteres raros: el id de una ficha importada puede traer cualquier cosa. */
const fileSafe = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'ficha'

/** Sin `book` (p. ej. desde la pantalla de fallo), la copia lleva el contenido de la mesa guardado en el móvil. */
export async function exportCharacters(chars: Character[], book?: RuleBook): Promise<ExportResult> {
  const mesa = book ? mesaOf(book) : storedMesa()
  const data: BackupFile = { app: 'ficha-viva', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), characters: chars, ...(Object.keys(mesa).length ? { mesa } : {}) }
  const day = new Date().toISOString().slice(0, 10)
  const name = chars.length === 1 ? `${fileSafe(chars[0].id)}-${day}.json` : `zurron-${day}.json`
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
  const file = new File([blob], name, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      markExported(chars)
      return { via: 'compartido', name }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return { via: 'cancelado', name }
      // otro fallo al compartir: se descarga
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  markExported(chars)
  return { via: 'descargado', name }
}

/** Qué decir tras exportar: dónde ha ido la copia. */
export function exportMessage(r: ExportResult): string | undefined {
  if (r.via === 'descargado') return `Copia guardada en Descargas: ${r.name}`
  if (r.via === 'compartido') return 'Copia de seguridad hecha: está donde la hayas guardado o enviado'
  return undefined
}

/* ---------- Cuándo se hizo la última copia en este móvil ---------- */

const COPIES_KEY = 'fichaviva:copias'

function readCopies(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(COPIES_KEY) ?? '{}')
    const out: Record<string, string> = {}
    if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw)) if (k !== '__proto__' && typeof v === 'string') out[k] = v
    return out
  } catch {
    return {}
  }
}

function markExported(chars: Character[]) {
  const all = readCopies()
  const now = new Date().toISOString()
  for (const c of chars) all[c.id] = now
  try {
    localStorage.setItem(COPIES_KEY, JSON.stringify(all))
  } catch {
    // sin espacio: solo se pierde el recordatorio
  }
}

/** Cuándo se exportó por última vez esta ficha desde este móvil (ISO), si alguna vez. */
export function lastExport(id: string): string | undefined {
  const all = readCopies()
  return Object.prototype.hasOwnProperty.call(all, id) ? all[id] : undefined
}

/* ---------- Importar ---------- */

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)

export async function readBackup(file: File, rules?: Rules): Promise<Backup> {
  return parseBackup(await file.text(), rules)
}

/** Lee el texto de una copia (o de una ficha suelta). Con `rules`, una ficha sin PG actuales empieza con los máximos. */
export function parseBackup(text: string, rules?: Rules): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Ese archivo no es una copia de Zurrón: no se puede leer. Elige el archivo .json que exportaste.')
  }
  const backup = isObj(data) && data.app === 'ficha-viva' ? data : undefined
  let list: unknown[]
  if (backup) {
    const v = backup.version
    if (typeof v === 'number' && v > BACKUP_VERSION)
      throw new Error('Esta copia es de una versión más nueva de Zurrón. Actualiza la app (ciérrala y vuelve a abrirla con conexión) e impórtala otra vez.')
    if (!Array.isArray(backup.characters)) throw new Error('Esta copia de Zurrón no trae la lista de fichas: puede que el archivo esté dañado. Prueba con otra copia.')
    list = backup.characters
  } else if (Array.isArray(data)) list = data
  else if (isObj(data) && 'id' in data) list = [data]
  else throw new Error('No he encontrado ninguna ficha en el archivo. Elige una copia exportada desde Zurrón.')

  const warnings: string[] = []
  const maxHp = rules ? (c: Character) => derive(c, rules).maxHp : undefined
  const byId = new Map<string, Character>()
  const repeated = new Set<string>()
  let broken = 0
  let newer = 0
  for (const raw of list) {
    if (isNewerSchema(raw)) {
      newer++
      continue
    }
    const c = migrate(raw, { maxHp })
    if (!c) {
      broken++
      continue
    }
    const prev = byId.get(c.id)
    if (prev) repeated.add(c.id)
    // Con el mismo id dos veces, se queda la que se cambió más tarde
    if (!prev || c.updatedAt > prev.updatedAt) byId.set(c.id, c)
  }
  const characters = [...byId.values()]
  if (!characters.length) {
    if (newer) throw new Error('Las fichas de esta copia son de una versión más nueva de Zurrón. Actualiza la app (ciérrala y vuelve a abrirla con conexión) e impórtala otra vez.')
    throw new Error('No he encontrado ninguna ficha que se pueda leer en el archivo. Prueba con otra copia.')
  }
  for (const id of repeated)
    warnings.push(`El archivo trae varias veces la ficha de ${byId.get(id)!.name}: me quedo con la que se cambió más tarde.`)
  if (broken) warnings.push(broken === 1 ? 'Una ficha del archivo estaba dañada y no se ha importado.' : `${broken} fichas del archivo estaban dañadas y no se han importado.`)
  if (newer) warnings.push(newer === 1 ? 'Una ficha es de una versión más nueva de Zurrón y no se ha importado: actualiza la app.' : `${newer} fichas son de una versión más nueva de Zurrón y no se han importado: actualiza la app.`)

  const { pack: mesa, rejected } = backup ? checkMesa(backup.mesa) : { pack: {}, rejected: 0 }
  if (rejected)
    warnings.push(
      rejected === 1
        ? 'Una cosa del contenido de tu mesa (un trasfondo, una dote…) venía incompleta y no se ha importado. La ficha que la use mostrará un aviso.'
        : `${rejected} cosas del contenido de tu mesa (trasfondos, dotes…) venían incompletas y no se han importado. Las fichas que las usen mostrarán un aviso.`,
    )
  return { characters, mesa, warnings }
}
