import Page from '@/components/Page'
import BookingFlow from './BookingFlow'
import { createClient } from '@/lib/supabase/server'
import type { Category } from '@/lib/types'

export const metadata = { title: 'Réserver' }

export default async function Reserver({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order')
  return (
    <Page>
      <BookingFlow categories={(data ?? []) as Category[]} initialSlug={sp.c} />
    </Page>
  )
}
