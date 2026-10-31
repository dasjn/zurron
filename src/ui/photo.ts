// Retrato: la foto se recorta al centro y se reduce a 320 px de lado para que
// quepa en la copia de seguridad (va dentro de la ficha como imagen incrustada).

import { safePortrait } from '../migrate'

/** Falla (lanza un error) si el móvil no sabe leer la imagen, p. ej. un formato raro. */
export async function resizePhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('Imagen vacía')
    const side = 320
    const s = Math.min(img.naturalWidth, img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = side
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Sin lienzo')
    ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, side, side)
    const out = safePortrait(canvas.toDataURL('image/jpeg', 0.82))
    if (!out) throw new Error('No se ha podido convertir la imagen')
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Qué decir si la foto no se puede leer. */
export const PHOTO_ERROR = 'No he podido leer esa foto. Prueba con otra (una foto normal de la cámara, JPG o PNG).'
