import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const csv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
const eur = (cents: number) => (cents / 100).toFixed(2)

/** Export comptable : une ligne par transaction (montants en euros). */
export async function GET() {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return new Response('Accès refusé', { status: 403 })

  const { data } = await createAdminClient()
    .from('transactions')
    .select('*, client:users!transactions_client_id_fkey(full_name), provider:users!transactions_provider_id_fkey(full_name)')
    .order('created_at')

  const header = [
    'date', 'mission', 'client', 'intervenant', 'statut',
    'gross_amount', 'platform_fee_client', 'platform_fee_provider',
    'net_provider_payout', 'materials_reimbursement', 'marge_plateforme',
    'marge_dont_connexion', 'marge_dont_facilitation_admin',
    'stripe_charge', 'stripe_transfer',
  ]
  const name = (x: unknown) => (x as { full_name?: string } | null)?.full_name ?? ''
  const rows = (data ?? []).map((t) => [
    t.created_at, t.mission_id, name(t.client), name(t.provider), t.status,
    eur(t.gross_amount), eur(t.platform_fee_client), eur(t.platform_fee_provider),
    eur(t.net_provider_payout), eur(t.materials_reimbursement), eur(t.platform_margin),
    eur(t.margin_connection_fee), eur(t.margin_admin_facilitation),
    t.stripe_charge_id, t.stripe_transfer_id,
  ].map(csv).join(';'))

  return new Response('﻿' + [header.join(';'), ...rows].join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
