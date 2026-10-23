import 'server-only'
import { createClient } from '@supabase/supabase-js'

/** Client service_role : contourne la RLS. Uniquement côté serveur. */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
