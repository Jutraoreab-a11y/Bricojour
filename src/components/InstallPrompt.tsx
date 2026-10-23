'use client'

import { useEffect, useState } from 'react'
import { enablePush, pushSupported } from '@/lib/push-client'
import { APP_NAME } from '@/lib/config'

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const DISMISS_KEY = 'install-prompt-dismissed'

export default function InstallPrompt() {
  const [open, setOpen] = useState(false)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIos, setIsIos] = useState(false)
  const [pushMsg, setPushMsg] = useState('')

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(() => {
        // Réabonne silencieusement un appareil déjà autorisé (changement de compte, clés renouvelées).
        if (pushSupported() && Notification.permission === 'granted') enablePush(false).catch(() => {})
      })
    }

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    let dismissed = false
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1' } catch {}
    if (standalone || dismissed) return

    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent))
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    const t = setTimeout(() => setOpen(true), 3500)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      clearTimeout(t)
    }
  }, [])

  function close() {
    setOpen(false)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  async function notifications() {
    const r = await enablePush()
    setPushMsg(
      r === 'ok' ? 'Alertes activées sur cet appareil.'
      : r === 'login' ? 'Alertes autorisées. Elles seront reliées à votre compte à la connexion.'
      : r === 'unsupported' ? (isIos ? 'Sur iPhone, installez d’abord l’app sur l’écran d’accueil.' : 'Ce navigateur ne gère pas les alertes.')
      : 'Alertes refusées. Vous pouvez les réactiver dans les réglages du navigateur.',
    )
  }

  if (!open) return null

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="install-title"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="sheet shadow-[0_-8px_30px_rgba(29,39,51,0.18)]">
        <div className="tape -mx-5 -mt-5 mb-4 h-5 rounded-t-[20px]" aria-hidden />
        <h2 id="install-title" className="text-lg font-bold">Gardez {APP_NAME} sous la main</h2>
        <p className="mt-1 text-sm text-mute">
          Installée sur l’écran d’accueil, l’app vous prévient dès qu’un intervenant accepte ou qu’une mission arrive.
        </p>
        {isIos && !deferred && (
          <p className="mt-3 rounded-[10px] bg-concrete px-3 py-2 text-sm">
            Touchez le bouton Partager de Safari, puis « Sur l’écran d’accueil ».
          </p>
        )}
        <div className="mt-4 grid gap-2">
          {deferred && <button className="btn-primary" onClick={install}>Installer l’app</button>}
          <button className={deferred ? 'btn-ghost' : 'btn-primary'} onClick={notifications}>Activer les alertes</button>
          <button className="py-2 text-sm font-semibold text-mute" onClick={close}>Plus tard</button>
        </div>
        {pushMsg && <p className="mt-2 text-sm" role="status">{pushMsg}</p>}
      </div>
    </div>
  )
}
