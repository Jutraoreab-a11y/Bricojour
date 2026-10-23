'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminDecision({ workerId, categoryId }: { workerId: string; categoryId: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function decide(status: 'approved' | 'rejected') {
    setBusy(true); setError('')
    const res = await fetch('/api/admin/worker-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId, categoryId, status }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(data.message ?? 'Décision non enregistrée.'); return }
    router.refresh()
  }

  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-ghost" disabled={busy} onClick={() => decide('rejected')}>Refuser</button>
        <button className="btn-primary" disabled={busy} onClick={() => decide('approved')}>Débloquer</button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
