import Page from '@/components/Page'
import BookingFlow from './BookingFlow'
import { getCategories } from '@/lib/catalog'

export const metadata = { title: 'Réserver' }

export default async function Reserver({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const categories = await getCategories()
  return (
    <Page>
      <BookingFlow categories={categories} initialSlug={sp.c} resume={sp.reprise === '1'} />
    </Page>
  )
}
