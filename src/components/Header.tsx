import Link from 'next/link'
import { getSessionUser } from '@/lib/supabase/server'
import { APP_NAME } from '@/lib/config'

export default async function Header() {
  const { supabase, user } = await getSessionUser()
  let role: string | null = null
  if (user) {
    const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
    role = data?.role ?? null
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-concrete/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-5">
        <Link href="/" className="display text-xl">{APP_NAME}</Link>
        <nav className="flex items-center gap-4 text-sm font-semibold">
          {!user && <Link href="/connexion">Connexion</Link>}
          {role === 'client' && <Link href="/missions">Mes demandes</Link>}
          {role === 'worker' && <Link href="/pro">Espace pro</Link>}
          {role === 'admin' && <Link href="/admin">Admin</Link>}
          {user && (
            <form action="/auth/signout" method="post">
              <button className="text-mute">Déconnexion</button>
            </form>
          )}
        </nav>
      </div>
    </header>
  )
}
