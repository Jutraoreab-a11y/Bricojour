import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/push'
import { errorMessage, json } from '@/lib/http'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return json({ message: 'Accès refusé.' }, 403)

  const { workerId, categoryId, status } = await req.json().catch(() => ({}))
  if (!['approved', 'rejected'].includes(status)) return json({ message: 'Statut invalide.' }, 400)

  const { error } = await createAdminClient().from('worker_categories')
    .update({ status }).eq('worker_id', workerId).eq('category_id', categoryId)
  if (error) return json({ message: errorMessage(error) }, 400)

  await sendPush([workerId], status === 'approved'
    ? { title: 'Catégorie débloquée', body: 'Vous pouvez maintenant recevoir ces missions.', url: '/pro' }
    : { title: 'Catégorie non débloquée', body: 'Ajoutez des photos plus parlantes et redemandez l’accès.', url: '/pro/inscription' })
  return json({ ok: true })
}
