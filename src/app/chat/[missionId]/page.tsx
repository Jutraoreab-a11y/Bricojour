import { notFound } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase/server'
import type { ChatMessage } from '@/lib/types'
import ChatRoom from './ChatRoom'

export const metadata = { title: 'Discussion' }

export default async function ChatPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params
  const { supabase, user } = await getSessionUser()
  const { data: chat } = await supabase.from('chats').select('*').eq('mission_id', missionId).maybeSingle()
  if (!chat) notFound()

  const otherId = chat.client_id === user!.id ? chat.worker_id : chat.client_id
  const [{ data: messages }, { data: other }, { data: mission }] = await Promise.all([
    supabase.from('chat_messages').select('*').eq('chat_id', chat.id).order('created_at').limit(500),
    supabase.from('public_profiles').select('full_name').eq('id', otherId).maybeSingle(),
    supabase.from('missions').select('title').eq('id', missionId).maybeSingle(),
  ])

  const isWorker = chat.worker_id === user!.id
  return (
    <ChatRoom
      chatId={chat.id}
      userId={user!.id}
      initial={(messages ?? []) as ChatMessage[]}
      closesAt={chat.closes_at}
      otherName={other?.full_name ?? (isWorker ? 'Client' : 'Intervenant')}
      subtitle={mission?.title ?? ''}
      backHref={isWorker ? `/pro/missions/${missionId}` : `/missions/${missionId}`}
    />
  )
}
