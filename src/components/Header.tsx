import Link from 'next/link'
import { getOptionalViewer } from '@/lib/supabase/server'
import { APP_NAME } from '@/lib/config'

export default async function Header() {
  const { userId, role } = await getOptionalViewer()

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-concrete/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-5">
        <Link href="/" className="display text-xl">{APP_NAME}</Link>
        <nav className="flex items-center gap-4 text-sm font-semibold">
          {!userId && <Link href="/auth/login">Connexion</Link>}
          {!userId && <Link href="/auth/signup" className="rounded-[10px] bg-ink px-3 py-1.5 text-white">Créer un compte</Link>}
          {role === 'client' && <Link href="/client/dashboard">Mes demandes</Link>}
          {role === 'worker' && <Link href="/handyman/dashboard">Espace pro</Link>}
          {role === 'admin' && <Link href="/admin">Admin</Link>}
          {userId && (
            <form action="/auth/signout" method="post">
              <button className="text-mute">Déconnexion</button>
            </form>
          )}
        </nav>
      </div>
    </header>
  )
}
