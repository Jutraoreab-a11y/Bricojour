import { getOptionalViewer } from '@/lib/supabase/server'
import Intervenant from '@/app/intervenant/page'
import Pro from '@/app/pro/page'

// Dépend de la session : jamais mis en cache.
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Espace intervenant' }

/** Accès direct depuis la landing : un intervenant connecté voit son tableau de bord, un visiteur la présentation. */
export default async function HandymanDashboard() {
  const { role } = await getOptionalViewer()
  return role === 'worker' ? <Pro /> : <Intervenant />
}
