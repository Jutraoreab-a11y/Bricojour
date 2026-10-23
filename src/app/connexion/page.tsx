import Page from '@/components/Page'
import LoginForm from './LoginForm'

export const metadata = { title: 'Connexion' }

export default async function Connexion({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  return (
    <Page>
      <LoginForm next={sp.next} initialRole={sp.role === 'worker' ? 'worker' : 'client'} linkError={sp.erreur === 'lien'} />
    </Page>
  )
}
