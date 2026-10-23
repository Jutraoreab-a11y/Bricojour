import 'server-only'
import Stripe from 'stripe'

let stripe: Stripe | null = null

export function getStripe() {
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  return stripe
}

/** Met à jour le statut KYC d'un intervenant à partir de son compte Stripe Connect. */
export async function syncConnectAccount(account: Stripe.Account) {
  const { createAdminClient } = await import('./supabase/admin')
  const admin = createAdminClient()
  const ready = account.payouts_enabled && account.capabilities?.transfers === 'active'
  const rejected = account.requirements?.disabled_reason?.startsWith('rejected')

  const { data: user } = await admin
    .from('users')
    .select('id, worker_status')
    .eq('stripe_account_id', account.id)
    .maybeSingle()
  if (!user) return

  await admin
    .from('users')
    .update({
      kyc_status: ready ? 'verified' : rejected ? 'rejected' : 'pending',
      worker_status: ready && user.worker_status === 'onboarding' ? 'active' : user.worker_status,
    })
    .eq('id', user.id)
}
