'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ReviewForm({ missionId, userId, who }: { missionId: string; userId: string; who: string }) {
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating) { setError('Choisissez une note de 1 à 5.'); return }
    setBusy(true)
    const { error: err } = await createClient().from('reviews').insert({
      mission_id: missionId,
      reviewer_id: userId,
      reviewee_id: userId, // remplacé par le trigger côté base
      rating,
      comment: comment.trim() || null,
    })
    setBusy(false)
    if (err) { setError('Avis non enregistré. Réessayez.'); return }
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="sheet">
      <h2 className="font-bold">Notez {who}</h2>
      <div className="mt-3 flex gap-1" role="radiogroup" aria-label="Note">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} sur 5`}
            onClick={() => setRating(n)}
            className={`grid h-12 w-12 place-items-center rounded-[12px] text-2xl ${n <= rating ? 'bg-hiviz text-ink' : 'bg-concrete text-mute'}`}>
            ★
          </button>
        ))}
      </div>
      <textarea className="field mt-3" rows={3} maxLength={1000} placeholder="Un mot sur l’intervention (facultatif)"
        value={comment} onChange={(e) => setComment(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button className="btn-dark mt-3" disabled={busy}>{busy ? 'Envoi…' : 'Publier l’avis'}</button>
    </form>
  )
}
