'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export async function missionAction(missionId: string, action: string, extra: Record<string, unknown> = {}) {
  const res = await fetch(`/api/missions/${missionId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok && data.ok !== false, message: data.message as string | undefined }
}

export default function ActionButton({ missionId, action, label, busyLabel, className = 'btn-dark', confirmText, onDone }: {
  missionId: string
  action: string
  label: string
  busyLabel?: string
  className?: string
  confirmText?: string
  onDone?: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <div>
      <button className={className} disabled={busy} onClick={async () => {
        if (confirmText && !window.confirm(confirmText)) return
        setBusy(true); setError('')
        const r = await missionAction(missionId, action)
        setBusy(false)
        if (!r.ok) { setError(r.message ?? 'Action impossible.'); return }
        onDone?.()
        router.refresh()
      }}>
        {busy ? busyLabel ?? 'Un instant…' : label}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
