import 'server-only'
import { createClient, supabaseConfigured } from './supabase/server'
import type { Category } from './types'

/** Catalogue de secours, identique au seed SQL (liste blanche des travaux à bas risque). */
export const FALLBACK_CATEGORIES: Category[] = [
  { id: 1, slug: 'sols-parquet', name: 'Sols & parquet', description: 'Lame décollée, plinthes, petite réparation.', excluded_work: 'Pose complète de sol, ponçage de pièce entière, chape.', hourly_rate_cents: 2500, max_hours: 4, min_billed_hours: 1, is_active: true, sort_order: 1 },
  { id: 2, slug: 'plomberie-surface', name: 'Plomberie de surface', description: 'Joint, siphon, flexible, robinet.', excluded_work: 'Intervention sur colonne, gaz, chauffe-eau, réseau encastré.', hourly_rate_cents: 2500, max_hours: 3, min_billed_hours: 1, is_active: true, sort_order: 2 },
  { id: 3, slug: 'fixation-montage', name: 'Fixation & montage', description: 'Meuble, étagère, tringle, support TV.', excluded_work: 'Travaux en hauteur > 3 m, mur porteur, cloison.', hourly_rate_cents: 2500, max_hours: 4, min_billed_hours: 1, is_active: true, sort_order: 3 },
  { id: 4, slug: 'electricite-cosmetique', name: 'Électricité cosmétique', description: 'Luminaire, prise, interrupteur à l’identique.', excluded_work: 'Tableau électrique, création de circuit, mise aux normes.', hourly_rate_cents: 2500, max_hours: 2, min_billed_hours: 1, is_active: true, sort_order: 4 },
]

/** Catégories actives ; repli sur le catalogue local si la base est indisponible. */
export async function getCategories(): Promise<Category[]> {
  if (!supabaseConfigured()) return FALLBACK_CATEGORIES
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order')
    if (error || !data?.length) return FALLBACK_CATEGORIES
    return data as Category[]
  } catch {
    return FALLBACK_CATEGORIES
  }
}

/**
 * Note moyenne réelle des intervenants (avis vérifiés). Renvoie null tant qu'il
 * n'y a pas assez d'avis pour qu'une moyenne ait du sens : on n'affiche jamais
 * de note inventée.
 */
export async function getPlatformRating(minReviews = 10): Promise<{ avg: number; count: number } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  try {
    const res = await fetch(`${url}/rest/v1/rpc/platform_rating`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(1500),
      next: { revalidate: 600 },
    })
    if (!res.ok) return null
    const rows = (await res.json()) as { rating_avg: number | null; rating_count: number }[]
    const r = rows?.[0]
    if (!r || r.rating_avg == null || r.rating_count < minReviews) return null
    return { avg: Number(r.rating_avg), count: r.rating_count }
  } catch {
    return null
  }
}
