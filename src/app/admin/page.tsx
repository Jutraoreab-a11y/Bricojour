import { notFound } from 'next/navigation'
import Page from '@/components/Page'
import { getSessionUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatEuros } from '@/lib/money'
import AdminDecision from './AdminDecision'

export const metadata = { title: 'Administration' }

export default async function Admin() {
  const { supabase, user } = await getSessionUser()
  const { data: me } = await supabase.from('users').select('role').eq('id', user!.id).single()
  if (me?.role !== 'admin') notFound()

  const admin = createAdminClient()
  const [{ data: pending }, { data: disputes }, { data: tx }] = await Promise.all([
    admin.from('worker_categories').select('worker_id, category_id, created_at, users(full_name), categories(name)').eq('status', 'pending').order('created_at'),
    admin.from('missions').select('id, title, labor_cents, material_cents, finished_at').eq('status', 'disputed'),
    admin.from('transactions').select('status, gross_amount, platform_margin'),
  ])

  const totals = (tx ?? []).reduce(
    (acc, t) => ({
      gross: acc.gross + t.gross_amount,
      margin: acc.margin + t.platform_margin,
      pending: acc.pending + (t.status === 'transferred' ? 0 : 1),
    }),
    { gross: 0, margin: 0, pending: 0 },
  )

  const requests = await Promise.all((pending ?? []).map(async (r) => {
    const { data: photos } = await admin.from('worker_portfolio').select('photo_path')
      .eq('worker_id', r.worker_id).eq('category_id', r.category_id)
    const { data: signed } = photos?.length
      ? await admin.storage.from('portfolio').createSignedUrls(photos.map((p) => p.photo_path), 3600)
      : { data: [] }
    return { ...r, urls: (signed ?? []).map((s) => s.signedUrl).filter(Boolean) as string[] }
  }))

  return (
    <Page>
      <h1 className="display text-3xl">Administration</h1>

      <section className="mt-6">
        <h2 className="text-xl font-bold">Compétences à examiner ({requests.length})</h2>
        {requests.length === 0 && <p className="mt-2 text-sm text-mute">Rien à examiner.</p>}
        <ul className="mt-3 space-y-3">
          {requests.map((r) => (
            <li key={`${r.worker_id}-${r.category_id}`} className="sheet">
              <p className="font-bold">{(r.users as unknown as { full_name: string | null })?.full_name ?? 'Intervenant'}</p>
              <p className="text-sm text-mute">{(r.categories as unknown as { name: string })?.name}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {r.urls.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="Réalisation" className="aspect-square w-full rounded-[12px] object-cover" />
                  </a>
                ))}
              </div>
              <AdminDecision workerId={r.worker_id} categoryId={r.category_id} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Litiges ({disputes?.length ?? 0})</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {(disputes ?? []).map((d) => (
            <li key={d.id} className="flex justify-between gap-3 py-3 text-sm">
              <span>{d.title}</span><span className="font-semibold">{formatEuros(d.labor_cents + Math.round(d.labor_cents * 0.2) + d.material_cents)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-mute">Résolution : capture ou annulation du paiement depuis le tableau de bord Stripe, puis mise à jour du statut.</p>
      </section>

      <section className="mt-8 sheet">
        <h2 className="font-bold">Transactions</h2>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-mute">Encaissé auprès des clients</dt><dd className="font-semibold">{formatEuros(totals.gross)}</dd></div>
          <div className="flex justify-between"><dt className="text-mute">Marge plateforme (frais client + commission)</dt><dd className="font-semibold">{formatEuros(totals.margin)}</dd></div>
          <div className="flex justify-between"><dt className="text-mute">Transferts en attente ou en échec</dt><dd className={totals.pending ? 'font-semibold text-alert' : 'font-semibold'}>{totals.pending}</dd></div>
        </dl>
        <a href="/api/admin/transactions-export" className="btn-dark mt-4">Exporter en CSV</a>
      </section>
    </Page>
  )
}
