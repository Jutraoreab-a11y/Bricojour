import Page from '@/components/Page'
import AuthForm from '@/components/auth/AuthForm'

export const metadata = { title: 'Créer un compte' }

export default async function Signup({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  return (
    <Page>
      <AuthForm mode="signup" next={sp.next} initialRole={sp.role === 'worker' ? 'worker' : 'client'} />
    </Page>
  )
}
