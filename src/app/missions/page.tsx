import Link from 'next/link'
import Page from '@/components/Page'
import StatusChip from '@/components/StatusChip'
import { getSessionUser } from '@/lib/supabase/server'
import type { Mission } from '@/lib/types'

export const metadata = { title: 'Mes demandes' }

export default async function Missions() {
  const { supabase, user } = await getSessionUser()
  const { data } = await supabase
    .from('missions')
    .select('id, title, status, created_at, categories(name)')
    .eq('client_id', user!.id)
    .order('created_at', { ascending: false })
  const missions = (data ?? []) as unknown as Mission[]

  return (
    <Page>
      <div className="flex items-end justify-between gap-4">
        <h1 className="display text-3xl">Mes demandes</h1>
        <Link href="/reserver" className="btn-small bg-hiviz">Nouvelle</Link>
      </div>
      {missions.length === 0 ? (
        <div className="sheet mt-6">
          <p className="font-semibold">Aucune demande pour l’instant.</p>
          <p className="mt-1 text-sm text-mute">Décrivez votre problème : un intervenant proche peut passer aujourd’hui.</p>
          <Link href="/reserver" className="btn-primary mt-4">Réserver une intervention</Link>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {missions.map((m) => (
            <li key={m.id}>
              <Link href={`/missions/${m.id}`} className="block py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{m.title}</p>
                  <StatusChip status={m.status} />
                </div>
                <p className="mt-1 text-sm text-mute">
                  {m.categories?.name}, {new Date(m.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
