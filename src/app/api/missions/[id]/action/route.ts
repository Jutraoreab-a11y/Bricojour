import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/push'
import { releasePayment, settleMission } from '@/lib/payments'
import { formatEuros } from '@/lib/money'
import { errorMessage, json } from '@/lib/http'

/** Toutes les transitions de mission passent par ici (RPC sécurisées + effets de bord). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ ok: false, message: 'Session expirée. Reconnectez-vous.' }, 401)

  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()
  const load = async () => (await admin.from('missions').select('*').eq('id', id).single()).data

  try {
    switch (body.action) {
      case 'accept': {
        const { data, error } = await supabase.rpc('accept_mission', { p_mission_id: id })
        if (error) throw error
        if (!data) return json({ ok: false, message: 'Trop tard : un autre intervenant a accepté cette mission.' }, 409)
        const m = await load()
        if (m) await sendPush([m.client_id], { title: 'Intervenant trouvé', body: `Quelqu’un arrive pour « ${m.title} ». Vous pouvez lui écrire.`, url: `/missions/${id}` })
        return json({ ok: true })
      }
      case 'decline': {
        const { error } = await supabase.rpc('decline_mission', { p_mission_id: id })
        if (error) throw error
        return json({ ok: true })
      }
      case 'start': {
        const { error } = await supabase.rpc('start_mission', { p_mission_id: id })
        if (error) throw error
        const m = await load()
        if (m) await sendPush([m.client_id], { title: 'Intervention démarrée', body: 'Votre intervenant est sur place.', url: `/missions/${id}` })
        return json({ ok: true })
      }
      case 'complete': {
        const expenses = Array.isArray(body.expenses)
          ? body.expenses.slice(0, 10).map((e: { label?: unknown; amountCents?: unknown; photoPath?: unknown }) => ({
              label: String(e.label ?? '').trim().slice(0, 120),
              amount_cents: Math.round(Number(e.amountCents) || 0),
              photo_path: typeof e.photoPath === 'string' ? e.photoPath : null,
            }))
          : []
        const { error } = await supabase.rpc('submit_completion', {
          p_mission_id: id,
          p_actual_hours: Number(body.hours),
          p_expenses: expenses,
        })
        if (error) throw error
        const m = await load()
        if (m) await sendPush([m.client_id], { title: 'À valider', body: `Intervention terminée : ${formatEuros(m.labor_cents + Math.round(m.labor_cents * 0.2) + (m.material_status === 'pending' ? m.material_cents : 0))}. Vérifiez et validez.`, url: `/missions/${id}` })
        return json({ ok: true })
      }
      case 'validate': {
        const { error } = await supabase.rpc('validate_completion', { p_mission_id: id })
        if (error) throw error
        try {
          await settleMission(id)
        } catch (e) {
          // La validation est acquise ; la tâche planifiée retentera le paiement.
          console.error('settleMission', id, e)
        }
        const m = await load()
        if (m?.worker_id) await sendPush([m.worker_id], { title: 'Mission validée', body: `${formatEuros(m.worker_payout_cents)} en route vers votre compte.`, url: `/pro/missions/${id}` })
        return json({ ok: true })
      }
      case 'dispute': {
        const { error } = await supabase.rpc('dispute_completion', { p_mission_id: id })
        if (error) throw error
        const m = await load()
        if (m?.worker_id) await sendPush([m.worker_id], { title: 'Problème signalé', body: 'Le client conteste l’intervention. Notre équipe vous contacte.', url: `/pro/missions/${id}` })
        return json({ ok: true })
      }
      case 'cancel': {
        const { error } = await supabase.rpc('cancel_mission', { p_mission_id: id })
        if (error) throw error
        const m = await load()
        await releasePayment(m?.stripe_payment_intent_id ?? null)
        return json({ ok: true })
      }
      default:
        return json({ ok: false, message: 'Action inconnue.' }, 400)
    }
  } catch (e) {
    return json({ ok: false, message: errorMessage(e) }, 400)
  }
}
