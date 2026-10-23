import Link from 'next/link'
import { redirect } from 'next/navigation'
import Page from '@/components/Page'
import StatusChip from '@/components/StatusChip'
import Stars from '@/components/Stars'
import { getSessionUser } from '@/lib/supabase/server'
import { formatEuros } from '@/lib/money'
import type { Mission } from '@/lib/types'
import ProDashboard, { type Offer } from './ProDashboard'

export const metadata = { title: 'Espace pro' }

export default async function Pro() {
  const { supabase, user } = await getSessionUser()
  const { data: me } = await supabase.from('users').select('*').eq('id', user!.id).single()
  if (me?.role !== 'worker') redirect('/missions')

  const ready = me.worker_status === 'active' && me.kyc_status === 'verified'
  const [{ data: offers }, { data: active }, { data: done }] = await Promise.all([
    supabase.rpc('my_offers'), // adresse exacte masquée tant que la mission n'est pas acceptée
    supabase.from('missions').select('id, title, status, categories(name)')
      .eq('worker_id', user!.id).in('status', ['matched', 'in_progress', 'awaiting_validation', 'disputed'])
      .order('matched_at', { ascending: false }),
    supabase.from('missions').select('id, title, status, worker_payout_cents, validated_at, categories(name)')
      .eq('worker_id', user!.id).eq('status', 'completed').order('validated_at', { ascending: false }).limit(10),
  ])

  const liveOffers = (offers ?? []) as Offer[]
  const earned = ((done ?? []) as unknown as Mission[]).reduce((s, m) => s + m.worker_payout_cents, 0)

  return (
    <Page>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="display text-3xl">Bonjour {me.full_name?.split(' ')[0] ?? ''}</h1>
          <div className="mt-1"><Stars value={Number(me.rating_avg)} count={me.rating_count} /></div>
        </div>
        <Link href="/pro/inscription" className="btn-small border-2 border-line">Mon profil</Link>
      </div>

      {me.worker_status === 'suspended' && (
        <p className="error mt-5">Votre compte est suspendu : votre note moyenne est passée sous 4/5. Contactez le support pour en discuter.</p>
      )}
      {!ready && me.worker_status !== 'suspended' && (
        <div className="sheet mt-5">
          <p className="font-semibold">Terminez votre inscription pour recevoir des missions.</p>
          <p className="mt-1 text-sm text-mute">Vérification d’identité, coordonnées bancaires et photos de vos réalisations.</p>
          <Link href="/pro/inscription" className="btn-primary mt-4">Continuer l’inscription</Link>
        </div>
      )}

      {ready && (
        <ProDashboard
          userId={user!.id}
          available={me.is_available}
          hasLocation={!!me.base_location}
          radiusKm={me.service_radius_km}
          offers={liveOffers}
        />
      )}

      {(active ?? []).length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold">En cours</h2>
          <ul className="mt-3 space-y-2">
            {((active ?? []) as unknown as Mission[]).map((m) => (
              <li key={m.id}>
                <Link href={`/pro/missions/${m.id}`} className="sheet flex items-center justify-between gap-3 !p-4">
                  <div><p className="font-semibold">{m.title}</p><p className="text-sm text-mute">{m.categories?.name}</p></div>
                  <StatusChip status={m.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Dernières missions</h2>
          <p className="text-sm text-mute">{formatEuros(earned)} versés</p>
        </div>
        {(done ?? []).length === 0
          ? <p className="mt-2 text-sm text-mute">Vos missions terminées apparaîtront ici.</p>
          : (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {((done ?? []) as unknown as Mission[]).map((m) => (
                <li key={m.id}>
                  <Link href={`/pro/missions/${m.id}`} className="flex justify-between gap-3 py-3 text-sm">
                    <span>{m.title}</span><span className="font-semibold">{formatEuros(m.worker_payout_cents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </section>
    </Page>
  )
}
