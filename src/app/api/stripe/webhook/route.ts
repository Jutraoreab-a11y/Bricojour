import type Stripe from 'stripe'
import { getStripe, syncConnectAccount } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchMission } from '@/lib/matching'
import { json } from '@/lib/http'

/**
 * Un seul endpoint pour deux abonnements Stripe :
 *  - "Votre compte" (paiements)        → STRIPE_WEBHOOK_SECRET
 *  - "Comptes connectés" (KYC Connect) → STRIPE_CONNECT_WEBHOOK_SECRET
 */
export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const raw = await req.text()
  if (!sig) return json({ error: 'signature manquante' }, 400)

  let event: Stripe.Event | null = null
  for (const secret of [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET]) {
    if (!secret) continue
    try { event = getStripe().webhooks.constructEvent(raw, sig, secret); break } catch { /* essai suivant */ }
  }
  if (!event) return json({ error: 'signature invalide' }, 400)

  const admin = createAdminClient()

  switch (event.type) {
    case 'payment_intent.amount_capturable_updated': {
      // Empreinte bancaire confirmée : on lance la recherche d'intervenants.
      const pi = event.data.object as Stripe.PaymentIntent
      const missionId = pi.metadata.mission_id
      if (!missionId) break
      const { data } = await admin.from('missions').update({ status: 'searching' })
        .eq('id', missionId).eq('status', 'pending_payment').select('id')
      if (data?.length) await dispatchMission(missionId)
      break
    }
    case 'payment_intent.canceled':
    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent
      if (pi.metadata.mission_id && event.type === 'payment_intent.canceled') {
        await admin.from('missions').update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('id', pi.metadata.mission_id).in('status', ['pending_payment', 'searching'])
      }
      break
    }
    case 'account.updated': {
      await syncConnectAccount(event.data.object as Stripe.Account)
      break
    }
  }
  return json({ received: true })
}
