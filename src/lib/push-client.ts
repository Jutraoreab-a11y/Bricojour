'use client'

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export type PushResult = 'ok' | 'denied' | 'unsupported' | 'login'

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** Demande la permission (si besoin), abonne l'appareil et l'enregistre côté serveur. */
export async function enablePush(askPermission = true): Promise<PushResult> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission !== 'granted') {
    if (!askPermission) return 'denied'
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return 'denied'
  }
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    }))
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub),
  })
  if (res.status === 401) return 'login'
  return res.ok ? 'ok' : 'denied'
}
