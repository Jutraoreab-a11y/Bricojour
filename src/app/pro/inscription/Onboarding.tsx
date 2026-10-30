'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PhotoPicker from '@/components/PhotoPicker'
import { createClient } from '@/lib/supabase/client'

const KYC_TEXT: Record<string, string> = {
  not_started: 'À faire',
  pending: 'En cours de vérification',
  verified: 'Vérifié',
  rejected: 'Refusé : contactez le support',
}
const REQUEST_TEXT: Record<string, string> = {
  pending: 'En cours d’examen',
  approved: 'Débloquée',
  rejected: 'Refusée : ajoutez des photos plus parlantes',
}

export default function Onboarding({ userId, kycStatus, radiusKm, categories, requests, portfolio }: {
  userId: string
  kycStatus: string
  radiusKm: number
  categories: { id: number; name: string; description: string | null }[]
  requests: { category_id: number; status: string }[]
  portfolio: { id: string; category_id: number; photo_path: string }[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [radius, setRadius] = useState(radiusKm)
  const [accepted, setAccepted] = useState(false)
  const [declares, setDeclares] = useState(false)

  async function startKyc() {
    if (!accepted) { setError('Cochez la case pour accepter les conditions générales.'); return }
    if (!declares) { setError('Cochez la case d’engagement à déclarer vos revenus.'); return }
    setBusy(true); setError('')
    const res = await fetch('/api/stripe/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acceptTerms: true, acceptIncomeDeclaration: true }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.url) { setBusy(false); setError(data.message ?? 'Vérification indisponible. Réessayez.'); return }
    window.location.href = data.url
  }

  async function addPhoto(categoryId: number, path: string) {
    const { error: err } = await createClient().from('worker_portfolio').insert({ worker_id: userId, category_id: categoryId, photo_path: path })
    if (err) setError('Photo non enregistrée.')
    router.refresh()
  }

  async function removePhoto(path: string) {
    const item = portfolio.find((p) => p.photo_path === path)
    if (!item) return
    await createClient().from('worker_portfolio').delete().eq('id', item.id)
    await createClient().storage.from('portfolio').remove([path])
    router.refresh()
  }

  async function requestCategory(categoryId: number) {
    const { error: err } = await createClient().from('worker_categories').insert({ worker_id: userId, category_id: categoryId })
    if (err) setError('Demande non envoyée.')
    router.refresh()
  }

  async function saveRadius(km: number) {
    setRadius(km)
    await createClient().from('users').update({ service_radius_km: km }).eq('id', userId)
  }

  return (
    <div>
      <h1 className="display text-3xl">Mon profil intervenant</h1>
      <p className="mt-2 text-mute">Trois étapes, et vous recevez vos premières missions.</p>
      {error && <p className="error">{error}</p>}

      <ol className="mt-6 space-y-6">
        <li className="sheet">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-bold">1. Identité et versements</h2>
            <span className={`chip ${kycStatus === 'verified' ? 'bg-ok/10 text-ok' : 'bg-concrete'}`}>{KYC_TEXT[kycStatus]}</span>
          </div>
          <p className="mt-2 text-sm text-mute">
            Pièce d’identité et IBAN, vérifiés par notre partenaire de paiement Stripe. Vos gains y sont versés après chaque mission validée.
          </p>
          {kycStatus !== 'verified' && (
            <label className="mt-4 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-ink" checked={accepted} onChange={(e) => { setAccepted(e.target.checked); setError('') }} />
              <span>J’accepte les <Link href="/terms" target="_blank" className="font-semibold underline">conditions générales</Link>, notamment l’article 9 sur les intervenants.</span>
            </label>
          )}
          {kycStatus !== 'verified' && (
            <label className="mt-3 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-ink" checked={declares} onChange={(e) => { setDeclares(e.target.checked); setError('') }} />
              <span>J’accepte de déclarer mes revenus perçus via la plateforme conformément à la réglementation en vigueur.</span>
            </label>
          )}
          {kycStatus !== 'verified' && (
            <button className="btn-dark mt-4" disabled={busy} onClick={startKyc}>
              {busy ? 'Redirection…' : kycStatus === 'not_started' ? 'Vérifier mon identité' : 'Reprendre la vérification'}
            </button>
          )}
        </li>

        <li className="sheet">
          <h2 className="font-bold">2. Vos compétences</h2>
          <p className="mt-2 text-sm text-mute">
            Pour chaque type de travaux, montrez deux réalisations passées (avant/après, travail fini). Notre équipe débloque la catégorie après examen.
          </p>
          <div className="mt-4 space-y-5">
            {categories.map((c) => {
              const req = requests.find((r) => r.category_id === c.id)
              const photos = portfolio.filter((p) => p.category_id === c.id).map((p) => p.photo_path)
              const locked = req?.status === 'pending' || req?.status === 'approved'
              return (
                <div key={c.id} className="border-t border-line pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold">{c.name}</p>
                    {req && <span className={`chip ${req.status === 'approved' ? 'bg-ok/10 text-ok' : req.status === 'rejected' ? 'bg-alert/10 text-alert' : 'bg-concrete'}`}>{REQUEST_TEXT[req.status]}</span>}
                  </div>
                  <div className="mt-3">
                    <PhotoPicker bucket="portfolio" max={4} paths={photos}
                      onAdd={(p) => addPhoto(c.id, p)} onRemove={locked ? undefined : removePhoto} addLabel="Réalisation" />
                  </div>
                  {!req && (
                    <button className="btn-small mt-3 bg-ink text-white disabled:opacity-40" disabled={photos.length < 2}
                      onClick={() => requestCategory(c.id)}>
                      {photos.length < 2 ? `Encore ${2 - photos.length} photo${photos.length === 1 ? '' : 's'}` : 'Demander l’accès'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </li>

        <li className="sheet">
          <h2 className="font-bold">3. Votre zone</h2>
          <label htmlFor="radius" className="mt-2 block text-sm text-mute">Distance maximale depuis votre point de départ : <strong className="text-ink">{radius} km</strong></label>
          <input id="radius" type="range" min={2} max={30} step={1} value={radius} className="mt-3 w-full accent-ink"
            onChange={(e) => setRadius(Number(e.target.value))} onPointerUp={() => saveRadius(radius)} onKeyUp={() => saveRadius(radius)} />
          <p className="mt-2 text-sm text-mute">Le point de départ s’enregistre depuis votre tableau de bord.</p>
        </li>
      </ol>

      <button className="btn-primary mt-6" onClick={() => router.push('/handyman/dashboard')}>Aller au tableau de bord</button>
    </div>
  )
}
