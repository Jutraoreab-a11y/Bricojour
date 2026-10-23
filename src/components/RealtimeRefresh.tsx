'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/** Rafraîchit la page serveur dès qu'une ligne surveillée change. */
export default function RealtimeRefresh({ channel, table, filter }: { channel: string; table: string; filter: string }) {
  const router = useRouter()
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase
      .channel(channel)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [channel, table, filter, router])
  return null
}
