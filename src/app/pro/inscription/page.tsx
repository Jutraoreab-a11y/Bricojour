import { redirect } from 'next/navigation'
import Page from '@/components/Page'
import { getSessionUser } from '@/lib/supabase/server'
import { getStripe, syncConnectAccount } from '@/lib/stripe'
import type { Category } from '@/lib/types'
import Onboarding from './Onboarding'

export const metadata = { title: 'Mon profil intervenant' }

export default async function Inscription() {
  const { supabase, user } = await getSessionUser()
  let { data: me } = await supabase.from('users').select('*').eq('id', user!.id).single()
  if (me?.role !== 'worker') redirect('/client/dashboard')

  // Au retour de Stripe, le webhook peut avoir du retard : on resynchronise.
  if (me.stripe_account_id && me.kyc_status !== 'verified' && process.env.STRIPE_SECRET_KEY) {
    try {
      await syncConnectAccount(await getStripe().accounts.retrieve(me.stripe_account_id))
      ;({ data: me } = await supabase.from('users').select('*').eq('id', user!.id).single())
    } catch { /* compte injoignable : statut inchangé */ }
  }

  const [{ data: categories }, { data: requests }, { data: portfolio }] = await Promise.all([
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('worker_categories').select('category_id, status').eq('worker_id', user!.id),
    supabase.from('worker_portfolio').select('id, category_id, photo_path').eq('worker_id', user!.id),
  ])

  return (
    <Page>
      <Onboarding
        userId={user!.id}
        kycStatus={me.kyc_status}
        radiusKm={me.service_radius_km}
        categories={(categories ?? []) as Category[]}
        requests={(requests ?? []) as { category_id: number; status: string }[]}
        portfolio={(portfolio ?? []) as { id: string; category_id: number; photo_path: string }[]}
      />
    </Page>
  )
}
