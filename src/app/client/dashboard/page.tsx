import { getOptionalViewer } from '@/lib/supabase/server'
import Particulier from '@/app/particulier/page'
import Missions from '@/app/missions/page'

// Dépend de la session : jamais mis en cache.
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Espace particulier' }

/** Accès direct depuis la landing : un client connecté voit ses demandes, un visiteur la présentation. */
export default async function ClientDashboard() {
  const { role } = await getOptionalViewer()
  return role === 'client' ? <Missions /> : <Particulier />
}
