import 'server-only'
import { createAdminClient } from './supabase/admin'
import { sendPush } from './push'
import { formatEuros, split } from './money'

const MAX_WORKERS_PER_WAVE = 20

/**
 * Diffuse une mission aux intervenants éligibles (catégorie débloquée,
 * disponibles, dans leur rayon). Idempotent : un intervenant déjà notifié
 * ne l'est pas deux fois. Renvoie le nombre de nouveaux intervenants alertés.
 */
export async function dispatchMission(missionId: string) {
  const admin = createAdminClient()
  const { data: workers, error } = await admin.rpc('eligible_workers', { p_mission_id: missionId })
  if (error || !workers?.length) return 0

  const rows = (workers as { worker_id: string; distance_m: number }[])
    .slice(0, MAX_WORKERS_PER_WAVE)
    .map((w) => ({ mission_id: missionId, worker_id: w.worker_id, distance_m: w.distance_m }))

  const { data: inserted } = await admin
    .from('proposals')
    .upsert(rows, { onConflict: 'mission_id,worker_id', ignoreDuplicates: true })
    .select('worker_id')
  if (!inserted?.length) return 0

  const { data: m } = await admin
    .from('missions')
    .select('title, hourly_rate_cents, estimated_hours, categories(name)')
    .eq('id', missionId)
    .single()

  const category = (m?.categories as unknown as { name: string } | null)?.name ?? 'Mission'
  const net = m ? split(m.hourly_rate_cents, Number(m.estimated_hours)).net : 0

  await sendPush(
    inserted.map((r) => r.worker_id),
    {
      title: `${category} : ${m?.title ?? 'nouvelle demande'}`,
      body: `Environ ${formatEuros(net)} pour vous. Premier qui accepte, premier servi.`,
      url: '/handyman/dashboard',
    },
  )
  return inserted.length
}
