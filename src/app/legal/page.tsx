import Page from '@/components/Page'
import LegalDocView from '@/components/LegalDocView'

export const metadata = { title: 'Mentions légales' }

export default function LegalPage() {
  return (
    <Page>
      <LegalDocView doc="mentions" />
    </Page>
  )
}
