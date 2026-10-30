import Page from '@/components/Page'
import AuthForm from '@/components/auth/AuthForm'

export const metadata = { title: 'Connexion' }

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  return (
    <Page>
      <AuthForm mode="login" next={sp.next} initialRole={sp.role === 'worker' ? 'worker' : 'client'} linkError={sp.erreur === 'lien'} />
    </Page>
  )
}
