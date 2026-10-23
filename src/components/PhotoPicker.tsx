'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import SignedImage from './SignedImage'

const MAX_BYTES = 8 * 1024 * 1024

export default function PhotoPicker({ bucket, max, paths, onAdd, onRemove, addLabel = 'Ajouter une photo' }: {
  bucket: string
  max: number
  paths: string[]
  onAdd: (path: string) => void | Promise<void>
  onRemove?: (path: string) => void
  addLabel?: string
}) {
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, max - paths.length)
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Reconnectez-vous pour envoyer des photos.'); setBusy(false); return }

    for (const file of files) {
      if (!file.type.startsWith('image/')) { setError('Seules les photos sont acceptées.'); continue }
      if (file.size > MAX_BYTES) { setError('Photo trop lourde : 8 Mo maximum.'); continue }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type })
      if (upErr) { setError('Envoi impossible. Vérifiez votre connexion et réessayez.'); continue }
      setPreviews((p) => ({ ...p, [path]: URL.createObjectURL(file) }))
      await onAdd(path)
    }
    setBusy(false)
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {paths.map((p) => (
          <div key={p} className="relative aspect-square overflow-hidden rounded-[12px] border border-line bg-white">
            {previews[p]
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={previews[p]} alt="" className="h-full w-full object-cover" />
              : <SignedImage bucket={bucket} path={p} alt="" className="h-full w-full" />}
            {onRemove && (
              <button type="button" onClick={() => onRemove(p)} aria-label="Retirer la photo"
                className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-ink/80 text-sm text-white">×</button>
            )}
          </div>
        ))}
        {paths.length < max && (
          <label className="grid aspect-square cursor-pointer place-items-center rounded-[12px] border-2 border-dashed border-line bg-white p-2 text-center text-xs font-semibold text-mute hover:border-ink">
            <input type="file" accept="image/*" multiple={max - paths.length > 1} className="sr-only" onChange={handle} disabled={busy} />
            {busy ? 'Envoi…' : <span><span className="block text-2xl leading-none text-ink">+</span>{addLabel}</span>}
          </label>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
