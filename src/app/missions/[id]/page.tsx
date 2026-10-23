import { notFound } from 'next/navigation'
import Page from '@/components/Page'
import RealtimeRefresh from '@/components/RealtimeRefresh'
import { getSessionUser } from '@/lib/supabase/server'
import type { ClientAmounts, Expense, Mission, PublicProfile } from '@/lib/types'
import ClientMission from './ClientMission'

export default async function MissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user } = await getSessionUser()
  const { data: mission } = await supabase.from('missions').select('*, categories(name, max_hours)').eq('id', id).maybeSingle()
  if (!mission || mission.client_id !== user!.id) notFound()

  const [{ data: worker }, { data: chat }, { data: review }, { data: expenses }, { data: amounts }] = await Promise.all([
    mission.worker_id
      ? supabase.from('public_profiles').select('*').eq('id', mission.worker_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('chats').select('id, closes_at').eq('mission_id', id).maybeSingle(),
    supabase.from('reviews').select('id').eq('mission_id', id).eq('reviewer_id', user!.id).maybeSingle(),
    supabase.from('expenses_materials').select('*').eq('mission_id', id).order('created_at'),
    supabase.rpc('mission_client_amounts', { p_mission_id: id }).maybeSingle(),
  ])

  return (
    <Page>
      <RealtimeRefresh channel={`mission-${id}`} table="missions" filter={`id=eq.${id}`} />
      <ClientMission
        mission={mission as Mission}
        worker={worker as PublicProfile | null}
        chat={chat as { id: string; closes_at: string | null } | null}
        hasReviewed={!!review}
        expenses={(expenses ?? []) as Expense[]}
        amounts={amounts as ClientAmounts | null}
        userId={user!.id}
      />
    </Page>
  )
}
