import 'server-only'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(toSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Appelé depuis un Server Component : le middleware rafraîchit la session.
          }
        },
      },
    },
  )
}

export async function getSessionUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export const supabaseConfigured = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * Pour les pages publiques : renvoie l'utilisateur et son rôle s'il est connecté,
 * sans jamais faire échouer la page (Supabase absent ou injoignable → visiteur).
 */
export async function getOptionalViewer(): Promise<{ userId: string | null; role: string | null }> {
  if (!supabaseConfigured()) return { userId: null, role: null }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { userId: null, role: null }
    const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
    return { userId: user.id, role: data?.role ?? null }
  } catch {
    return { userId: null, role: null }
  }
}
