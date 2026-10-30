import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

/**
 * Seules les pages qui affichent des données personnelles demandent une connexion.
 * Landing, espaces particulier / intervenant, réservation, tarifs et pages légales
 * restent accessibles sans compte.
 */
const PRIVATE = ['/missions', '/chat', '/pro', '/admin']

const isPrivate = (path: string) => PRIVATE.some((p) => path === p || path.startsWith(`${p}/`))

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const path = request.nextUrl.pathname
  const toLogin = () => {
    const login = request.nextUrl.clone()
    login.pathname = '/auth/login'
    login.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`
    return NextResponse.redirect(login)
  }

  // Sans configuration Supabase (tests d'interface) : pages publiques libres, pages privées vers la connexion.
  if (!url || !key) return isPrivate(path) ? toLogin() : response

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(toSet: { name: string; value: string; options: CookieOptions }[]) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  let signedIn = false
  try {
    const { data: { user } } = await supabase.auth.getUser()
    signedIn = !!user
  } catch {
    // Supabase injoignable : on ne bloque pas la navigation publique.
    return response
  }

  if (!signedIn && isPrivate(path)) return toLogin()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icons|sw.js|manifest.webmanifest|offline.html|api/stripe|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
