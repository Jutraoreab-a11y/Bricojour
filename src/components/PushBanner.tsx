'use client'

import { useEffect, useState } from 'react'
import { enablePush, pushSupported } from '@/lib/push-client'

export default function PushBanner({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setShow(pushSupported() && Notification.permission !== 'granted')
  }, [])

  if (!show) return null
  return (
    <div className="mb-5 rounded-[16px] bg-ink p-4 text-white">
      <p className="text-sm">{text}</p>
      <button
        className="btn-small mt-3 bg-hiviz text-ink"
        onClick={async () => {
          const r = await enablePush()
          if (r === 'ok') setShow(false)
          else setMsg('Autorisation refusée. Activez les notifications dans les réglages du navigateur.')
        }}
      >
        Activer les alertes
      </button>
      {msg && <p className="mt-2 text-xs text-white/80">{msg}</p>}
    </div>
  )
}
