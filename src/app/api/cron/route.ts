import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchMission } from '@/lib/matching'
import { releasePayment, settleMission } from '@/lib/payments'
import { sendPush } from '@/lib/push'
import { SEARCH_TIMEOUT_HOURS } from '@/lib/config'
import { json } from '@/lib/http'

/**
 * Toutes les 5 minutes (Vercel Cron) :
 *  1. relance la diffusion des missions en recherche (nouveaux intervenants disponibles) ;
 *  2. annule les recherches trop longues et libère la carte ;
 *  3. rejoue les paiements qui ont échoué après validation.
 */
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: 'non autorisé' }, 401)
  }
  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - SEARCH_TIMEOUT_HOURS * 3600_000).toISOString()

  const { data: expired } = await admin.from('missions')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('status', 'searching').lt('created_at', cutoff)
    .select('id, client_id, stripe_payment_intent_id')
  for (const m of expired ?? []) {
    await releasePayment(m.stripe_payment_intent_id)
    await admin.from('proposals').update({ status: 'expired' }).eq('mission_id', m.id).eq('status', 'notified')
    await sendPush([m.client_id], { title: 'Aucun intervenant disponible', body: 'Votre demande est annulée et votre carte libérée.', url: `/missions/${m.id}` })
  }

  const { data: searching } = await admin.from('missions').select('id').eq('status', 'searching')
  let notified = 0
  for (const m of searching ?? []) notified += await dispatchMission(m.id)

  // Paiements à finaliser : transaction créée à la validation mais pas encore transférée
  const { data: unsettled } = await admin.from('transactions').select('mission_id')
    .neq('status', 'transferred').not('stripe_payment_intent_id', 'is', null)
  let settled = 0
  for (const t of unsettled ?? []) {
    try { await settleMission(t.mission_id); settled++ } catch (e) { console.error('cron settle', t.mission_id, e) }
  }

  // Conservation annoncée : messages supprimés 12 mois après la fermeture de la discussion
  const purgeBefore = new Date(Date.now() - 365 * 24 * 3600_000).toISOString()
  const { data: oldChats } = await admin.from('chats').select('id').lt('closes_at', purgeBefore)
  if (oldChats?.length) {
    await admin.from('chat_messages').delete().in('chat_id', oldChats.map((c) => c.id))
  }

  return json({ expired: expired?.length ?? 0, notified, settled, purgedChats: oldChats?.length ?? 0 })
}
