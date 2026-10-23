import 'server-only'
import { getStripe } from './stripe'
import { createAdminClient } from './supabase/admin'

/**
 * Stripe Connect, modèle marketplace « charges et transferts séparés » :
 *  1. Encaissement : capture du montant client (main-d'œuvre + 20 % de frais + matériel)
 *     sur le compte de la plateforme.
 *  2. Transfert : envoi du net intervenant (main-d'œuvre − 20 % + 100 % du matériel)
 *     sur son compte Connect, adossé à la charge (source_transaction).
 *  3. La marge (frais client + commission intervenant) reste sur le compte plateforme.
 *
 * Ce modèle est imposé par le fonctionnement « premier arrivé » : l'intervenant
 * n'est pas connu au moment où la carte est bloquée, donc pas de destination charge.
 *
 * Les montants viennent exclusivement de la table `transactions`, créée en base
 * à la validation du client. Idempotent : la tâche planifiée peut le rejouer.
 */
export async function settleMission(missionId: string) {
  const admin = createAdminClient()
  const { data: t } = await admin
    .from('transactions')
    .select('*, provider:users!transactions_provider_id_fkey(stripe_account_id)')
    .eq('mission_id', missionId)
    .single()
  if (!t || t.status === 'transferred' || !t.stripe_payment_intent_id) return

  const fail = async (reason: string) => {
    await admin.from('transactions').update({ status: 'failed', failure_reason: reason.slice(0, 500) }).eq('id', t.id)
    throw new Error(reason)
  }

  const stripe = getStripe()

  // 1. Encaissement du montant client
  let pi = await stripe.paymentIntents.retrieve(t.stripe_payment_intent_id)
  if (pi.status === 'requires_capture') {
    pi = await stripe.paymentIntents.capture(
      pi.id,
      { amount_to_capture: t.gross_amount },
      { idempotencyKey: `capture-${missionId}` },
    )
  }
  if (pi.status !== 'succeeded') return fail(`Paiement non capturé (${pi.status})`)
  if (pi.amount_received !== t.gross_amount) {
    return fail(`Montant capturé (${pi.amount_received}) différent du montant attendu (${t.gross_amount})`)
  }

  const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id ?? null
  if (t.status !== 'captured') {
    await admin.from('transactions')
      .update({ status: 'captured', stripe_charge_id: chargeId, captured_at: new Date().toISOString(), failure_reason: null })
      .eq('id', t.id)
  }

  // 2. Transfert du net vers l'intervenant
  const destination = (t.provider as { stripe_account_id: string | null } | null)?.stripe_account_id
  if (!destination) return fail('Compte de versement de l’intervenant manquant')

  const transfer = await stripe.transfers.create(
    {
      amount: t.net_provider_payout,
      currency: t.currency,
      destination,
      source_transaction: chargeId ?? undefined,
      transfer_group: missionId,
      description: 'Mission Bricojour',
      metadata: {
        mission_id: missionId,
        labor_amount: String(t.labor_amount),
        platform_fee_provider: String(t.platform_fee_provider),
        materials_reimbursement: String(t.materials_reimbursement),
      },
    },
    { idempotencyKey: `transfer-${missionId}` },
  )

  await admin.from('transactions')
    .update({ status: 'transferred', stripe_transfer_id: transfer.id, transferred_at: new Date().toISOString(), failure_reason: null })
    .eq('id', t.id)
  await admin.from('missions').update({ stripe_transfer_id: transfer.id }).eq('id', missionId)
}

/** Libère l'empreinte bancaire d'une mission annulée. */
export async function releasePayment(paymentIntentId: string | null) {
  if (!paymentIntentId) return
  try {
    await getStripe().paymentIntents.cancel(paymentIntentId)
  } catch {
    // Déjà annulé ou capturé : rien à faire.
  }
}
