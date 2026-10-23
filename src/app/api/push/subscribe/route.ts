import { createClient } from '@/lib/supabase/server'
import { json } from '@/lib/http'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ message: 'Connexion requise.' }, 401)

  const sub = await req.json().catch(() => null)
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return json({ message: 'Abonnement invalide.' }, 400)

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: req.headers.get('user-agent')?.slice(0, 300) ?? null,
  }, { onConflict: 'endpoint' })
  if (error) return json({ message: 'Enregistrement impossible.' }, 400)
  return json({ ok: true })
}
