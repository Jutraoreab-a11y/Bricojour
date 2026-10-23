import Page from '@/components/Page'
import LegalDocView from '@/components/LegalDocView'

export const metadata = { title: 'Confidentialité' }

export default function LegalPage() {
  return (
    <Page>
      <LegalDocView doc="confidentialite" />
    </Page>
  )
}
