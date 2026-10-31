import { useEffect, useState } from 'preact/hooks'
import type { Note } from '../../model/character'
import { getCharacter } from '../../store'
import { Icon, Modal, toast } from '../common'
import type { TabProps } from '../Sheet'

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

/* ---------- Borrador de la nota que se está escribiendo ---------- */

// Se guarda a cada tecla en su propia clave: si la app se cierra, se recarga o
// se actualiza a mitad de una nota, al volver a Notas sigue ahí.
const DRAFT_KEY = 'fichaviva:nota'

function readDraft(charId: string): Note | undefined {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')
    if (d?.charId !== charId || typeof d.note?.id !== 'string') return undefined
    const n = d.note
    return { id: n.id, date: typeof n.date === 'string' && n.date ? n.date : today(), title: String(n.title ?? ''), body: String(n.body ?? '') }
  } catch {
    return undefined
  }
}

function writeDraft(charId: string, note: Note | null) {
  try {
    if (note) localStorage.setItem(DRAFT_KEY, JSON.stringify({ charId, note }))
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    // sin espacio: la nota sigue en pantalla, solo se pierde el borrador
  }
}

/** ¿La nota en el editor es distinta de la guardada (o, si es nueva, tiene algo escrito)? */
const changed = (n: Note, saved: Note | undefined) => (saved ? n.title !== saved.title || n.body !== saved.body || n.date !== saved.date : !!(n.title.trim() || n.body.trim()))

export function Notas({ c, update }: TabProps) {
  // Si había una nota a medias, se abre tal cual
  const [editing, setEditing] = useState<Note | null>(() => readDraft(c.id) ?? null)
  const [q, setQ] = useState('')
  const notes = [...c.notes].sort((a, b) => b.date.localeCompare(a.date))
  const shown = q ? notes.filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(q.toLowerCase())) : notes
  const saved = editing ? c.notes.find((x) => x.id === editing.id) : undefined
  const isNew = !!editing && !saved
  const dirty = !!editing && changed(editing, saved)

  useEffect(() => {
    if (editing) toast('He recuperado la nota que estabas escribiendo')
    // solo al abrir la pestaña
  }, [])

  // El borrador sigue al editor: con cambios se guarda, sin cambios se quita
  useEffect(() => {
    writeDraft(c.id, editing && dirty ? editing : null)
  }, [editing, dirty])

  const close = () => setEditing(null)
  const save = (n: Note) => {
    const exists = c.notes.some((x) => x.id === n.id)
    update({ ...c, notes: exists ? c.notes.map((x) => (x.id === n.id ? n : x)) : [...c.notes, n] })
  }
  const remove = (n: Note) => {
    update({ ...c, notes: c.notes.filter((x) => x.id !== n.id) })
    toast('Nota borrada', {
      label: 'Deshacer',
      run: () => {
        const cur = getCharacter(c.id)
        if (cur && !cur.notes.some((x) => x.id === n.id)) update({ ...cur, notes: [...cur.notes, n] })
      },
    })
  }
  const newNote = () => setEditing({ id: Math.random().toString(36).slice(2, 9), date: today(), title: '', body: '' })

  return (
    <div class="fx-tab">
      <h2>Diario de campaña</h2>
      {notes.length === 0 ? (
        <div class="fx-blank">
          <Icon name="notas" size={32} />
          <h3>Tu diario está en blanco</h3>
          <p>Apunta lo que pasa en cada sesión: nombres, pistas, deudas, promesas… La próxima vez sabrás dónde lo dejasteis.</p>
          <button class="btn primary block" onClick={newNote}>
            Nueva nota
          </button>
          <p class="small faint">Se guarda en este móvil.</p>
        </div>
      ) : (
        <>
          <p class="lede">Apunta lo que pasa en cada sesión: nombres, pistas, deudas, promesas… Se guarda en este móvil.</p>
          <button class="btn primary block" onClick={newNote}>
            Nueva nota
          </button>
          {notes.length > 3 && (
            <input class="input fx-after" type="search" placeholder="Buscar en las notas" value={q} onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)} aria-label="Buscar en las notas" />
          )}
          {shown.length > 0 ? (
            <div class="list fx-notes">
              {shown.map((n) => (
                <button key={n.id} class="li fx-row fx-note fx-press" onClick={() => setEditing(n)}>
                  <span class="fx-note-head">
                    <strong class={n.title ? undefined : 'fx-untitled'}>{n.title || 'Sin título'}</strong>
                    <span class="fx-note-date num">{fmt(n.date)}</span>
                  </span>
                  {n.body && <span class="fx-note-body">{n.body}</span>}
                </button>
              ))}
            </div>
          ) : (
            <p class="small muted fx-after">Ninguna nota dice «{q}». Prueba con otra palabra.</p>
          )}
        </>
      )}

      <Modal open={!!editing} onClose={close} title={isNew ? 'Nueva nota' : 'Nota'} dirty={dirty}>
        {editing && (
          <>
            <div class="fx-form">
              <label class="field">
                <span class="label">Título</span>
                <input class="input" placeholder="Sesión 3: la boda" value={editing.title} onInput={(e) => setEditing({ ...editing, title: (e.currentTarget as HTMLInputElement).value })} />
              </label>
              <label class="field">
                <span class="label">Fecha</span>
                <input class="input fx-narrow" type="date" value={editing.date} onInput={(e) => setEditing({ ...editing, date: (e.currentTarget as HTMLInputElement).value || today() })} />
              </label>
              <label class="field">
                <span class="label">Qué ha pasado</span>
                <textarea class="input fx-tall" value={editing.body} onInput={(e) => setEditing({ ...editing, body: (e.currentTarget as HTMLTextAreaElement).value })} />
              </label>
            </div>
            <div class="footerbar fx-sheetbar fx-foot-actions">
              <button
                class="btn danger"
                onClick={() => {
                  // Borrar quita la nota guardada al momento, con «Deshacer» en el aviso
                  if (saved) remove(saved)
                  else if (dirty) {
                    const draft = editing
                    toast('Nota descartada', { label: 'Deshacer', run: () => setEditing(draft) })
                  }
                  close()
                }}
              >
                {isNew ? 'Descartar' : 'Borrar'}
              </button>
              <button
                class="btn primary block"
                onClick={() => {
                  save(editing)
                  close()
                  toast('Nota guardada')
                }}
              >
                Guardar
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
