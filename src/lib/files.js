import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Reduce fotos del iPhone (a veces 5–10 MB) antes de subirlas
async function comprimir(file, max = 1600) {
  if (!file.type.startsWith('image/')) return file
  try {
    const bmp = await createImageBitmap(file)
    const escala = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * escala)
    c.height = Math.round(bmp.height * escala)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85))
    return blob || file
  } catch {
    return file
  }
}

export async function subirArchivo(file, carpeta) {
  const listo = await comprimir(file)
  const esImagen = (listo.type || file.type).startsWith('image/')
  const ext = esImagen ? 'jpg' : (file.name.split('.').pop() || 'pdf')
  const path = `${carpeta}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('boda').upload(path, listo, {
    contentType: esImagen ? 'image/jpeg' : file.type,
  })
  if (error) throw error
  return path
}

const cache = new Map()

export async function urlFirmada(path) {
  if (!path) return null
  const c = cache.get(path)
  if (c && c.expira > Date.now()) return c.url
  const { data } = await supabase.storage.from('boda').createSignedUrl(path, 60 * 60 * 6)
  if (data?.signedUrl) cache.set(path, { url: data.signedUrl, expira: Date.now() + 1000 * 60 * 60 * 5 })
  return data?.signedUrl ?? null
}

export function useImagen(path, urlExterna) {
  const [src, setSrc] = useState(() => urlExterna || cache.get(path)?.url || null)
  useEffect(() => {
    let vivo = true
    if (urlExterna) { setSrc(urlExterna); return }
    if (!path) { setSrc(null); return }
    urlFirmada(path).then((u) => vivo && setSrc(u))
    return () => { vivo = false }
  }, [path, urlExterna])
  return src
}
