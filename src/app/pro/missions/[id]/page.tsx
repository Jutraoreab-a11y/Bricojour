import { notFound } from 'next/navigation'
import Page from '@/components/Page'
import RealtimeRefresh from '@/components/RealtimeRefresh'
import { getSessionUser } from '@/lib/supabase/server'
import type { Expense, Mission } from '@/lib/types'
import WorkerMission from './WorkerMission'

export default async function ProMission({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user } = await getSessionUser()
  const { data: mission } = await supabase.from('missions').select('*, categories(name, max_hours)').eq('id', id).maybeSingle()
  if (!mission || mission.worker_id !== user!.id) notFound()

  const [{ data: client }, { data: chat }, { data: review }, { data: expenses }] = await Promise.all([
    supabase.from('public_profiles').select('full_name').eq('id', mission.client_id).maybeSingle(),
    supabase.from('chats').select('closes_at').eq('mission_id', id).maybeSingle(),
    supabase.from('reviews').select('id').eq('mission_id', id).eq('reviewer_id', user!.id).maybeSingle(),
    supabase.from('expenses_materials').select('*').eq('mission_id', id).order('created_at'),
  ])

  return (
    <Page>
      <RealtimeRefresh channel={`pro-mission-${id}`} table="missions" filter={`id=eq.${id}`} />
      <WorkerMission
        mission={mission as Mission}
        clientName={client?.full_name ?? 'Client'}
        chatOpen={!!chat && (!chat.closes_at || new Date(chat.closes_at) > new Date())}
        hasReviewed={!!review}
        expenses={(expenses ?? []) as Expense[]}
        userId={user!.id}
      />
    </Page>
  )
}
