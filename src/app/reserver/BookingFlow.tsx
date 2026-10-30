'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import AddressInput, { type Address } from '@/components/AddressInput'
import PhotoPicker from '@/components/PhotoPicker'
import { CLIENT_FEE_LABEL } from '@/lib/config'
import { clientPrice, formatEuros, formatHours } from '@/lib/money'
import { SLOT_LABEL } from '@/lib/status'
import type { Category } from '@/lib/types'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '')
type Slot = keyof typeof SLOT_LABEL
const DRAFT_KEY = 'bricojour-booking-draft'
type Draft = { categoryId: number; title: string; description: string; hours: number; slot: Slot; address: Address }
const STEPS = ['Type de travaux', 'Le problème', 'Adresse', 'Paiement']

export default function BookingFlow({ categories, initialSlug, resume }: { categories: Category[]; initialSlug?: string; resume?: boolean }) {
  const initial = categories.find((c) => c.slug === initialSlug)
  const [step, setStep] = useState(initial ? 1 : 0)
  const [categoryId, setCategoryId] = useState<number | null>(initial?.id ?? null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [hours, setHours] = useState(1)
  const [slot, setSlot] = useState<Slot>('asap')
  const [address, setAddress] = useState<Address | null>(null)
  const [payment, setPayment] = useState<{ missionId: string; clientSecret: string; amount: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)

  // Retour après connexion : on reprend la demande là où elle s'était arrêtée.
  useEffect(() => {
    if (!resume) return
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const d = JSON.parse(raw) as Draft
      sessionStorage.removeItem(DRAFT_KEY)
      if (!categories.some((c) => c.id === d.categoryId)) return
      setCategoryId(d.categoryId); setTitle(d.title); setDescription(d.description)
      setHours(d.hours); setSlot(d.slot); setAddress(d.address); setStep(3)
    } catch { /* brouillon illisible ou stockage indisponible : on repart de zéro */ }
  }, [resume, categories])

  const category = categories.find((c) => c.id === categoryId)
  const hourOptions = useMemo(() => {
    const o: number[] = []
    if (category) for (let h = Number(category.min_billed_hours); h <= Number(category.max_hours); h += 0.5) o.push(h)
    return o
  }, [category])

  async function createMission() {
    if (!category || !address) return
    if (!accepted) { setError('Cochez la case pour accepter les conditions et l’intervention le jour même.'); return }
    setBusy(true); setError('')
    const res = await fetch('/api/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId: category.id, title, description, photoPaths: photos,
        estimatedHours: hours, slot, address: address.label, lat: address.lat, lng: address.lng, acceptTerms: accepted,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.status === 401) {
      try {
        const draft: Draft = { categoryId: category.id, title, description, hours, slot, address }
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      } catch { /* stockage indisponible : la demande sera à ressaisir */ }
      setNeedsLogin(true)
      return
    }
    if (!res.ok) { setError(data.message ?? 'La demande n’a pas pu être créée. Réessayez.'); return }
    setPayment(data)
  }

  return (
    <div>
      <div className="flex gap-1" aria-hidden>
        {STEPS.map((s, i) => <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-ink' : 'bg-line'}`} />)}
      </div>
      <p className="mt-3 text-sm text-mute">Étape {step + 1} sur {STEPS.length} : {STEPS[step]}</p>

      {step === 0 && (
        <section>
          <h1 className="display mt-2 text-3xl">De quoi avez-vous besoin ?</h1>
          <div className="mt-5 grid gap-2">
            {categories.map((c) => (
              <button key={c.id} onClick={() => { setCategoryId(c.id); setHours(Number(c.min_billed_hours)); setStep(1) }}
                className={`rounded-[16px] border-2 bg-white p-4 text-left ${c.id === categoryId ? 'border-ink' : 'border-line'}`}>
                <span className="flex justify-between gap-3 font-bold"><span>{c.name}</span><span>{formatEuros(c.hourly_rate_cents)}/h</span></span>
                <span className="block text-right text-xs text-mute">+ 20 % de frais de service et de mise en relation</span>
                <span className="mt-1 block text-sm text-mute">{c.description}</span>
                {c.excluded_work && <span className="mt-2 block text-xs text-mute">Non inclus : {c.excluded_work}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && category && (
        <section>
          <h1 className="display mt-2 text-3xl">{category.name}</h1>
          <label htmlFor="title" className="label mt-5">En quelques mots</label>
          <input id="title" className="field" maxLength={120} placeholder="Ex. : fuite sous l’évier de la cuisine"
            value={title} onChange={(e) => setTitle(e.target.value)} />

          <label htmlFor="desc" className="label mt-4">Détails utiles (facultatif)</label>
          <textarea id="desc" className="field" rows={3} maxLength={2000} placeholder="Accès, étage, matériel déjà sur place…"
            value={description} onChange={(e) => setDescription(e.target.value)} />

          <p className="label mt-4">Photos du problème</p>
          <PhotoPicker bucket="mission-photos" max={5} paths={photos}
            onAdd={(p) => setPhotos((x) => [...x, p])} onRemove={(p) => setPhotos((x) => x.filter((y) => y !== p))} />

          <label htmlFor="hours" className="label mt-5">Durée estimée</label>
          <select id="hours" className="field" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            {hourOptions.map((h) => <option key={h} value={h}>{formatHours(h)} : environ {formatEuros(clientPrice(category.hourly_rate_cents, h).total)}</option>)}
          </select>
          <p className="mt-1 text-xs text-mute">Estimation frais de service et de mise en relation inclus. Seules les heures réellement effectuées vous seront facturées, avec un minimum de {formatHours(Number(category.min_billed_hours))}.</p>

          <p className="label mt-5">Quand, aujourd’hui ?</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(SLOT_LABEL) as Slot[]).map((s) => (
              <button key={s} type="button" aria-pressed={slot === s} onClick={() => setSlot(s)}
                className={`rounded-[12px] border-2 py-3 text-sm font-semibold ${slot === s ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}>
                {SLOT_LABEL[s]}
              </button>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-[auto_1fr] gap-2">
            <button className="btn-ghost px-6" onClick={() => setStep(0)}>Retour</button>
            <button className="btn-primary" disabled={title.trim().length < 3} onClick={() => setStep(2)}>Continuer</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <h1 className="display mt-2 text-3xl">Où intervenir ?</h1>
          <div className="mt-5"><AddressInput value={address} onChange={setAddress} /></div>
          <div className="mt-6 grid grid-cols-[auto_1fr] gap-2">
            <button className="btn-ghost px-6" onClick={() => setStep(1)}>Retour</button>
            <button className="btn-primary" disabled={!address} onClick={() => setStep(3)}>Continuer</button>
          </div>
        </section>
      )}

      {step === 3 && category && address && (
        <section>
          <h1 className="display mt-2 text-3xl">Récapitulatif</h1>
          <dl className="sheet mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-mute">Travaux</dt><dd className="text-right font-semibold">{category.name}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-mute">Adresse</dt><dd className="text-right font-semibold">{address.label}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-mute">Créneau</dt><dd className="font-semibold">{SLOT_LABEL[slot]}</dd></div>
            <div className="flex justify-between gap-4 border-t border-line pt-3"><dt className="text-mute">Main-d’œuvre ({formatHours(hours)} à {formatEuros(category.hourly_rate_cents)}/h)</dt><dd className="font-semibold">{formatEuros(clientPrice(category.hourly_rate_cents, hours).labor)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-mute">{CLIENT_FEE_LABEL} (20 %)</dt><dd className="font-semibold">{formatEuros(clientPrice(category.hourly_rate_cents, hours).serviceFee)}</dd></div>
            <div className="flex justify-between gap-4 border-t border-line pt-3 text-base"><dt>Estimation</dt><dd className="font-bold">{formatEuros(clientPrice(category.hourly_rate_cents, hours).total)}</dd></div>
          </dl>

          <div className="mt-4 rounded-[16px] bg-ink/5 p-4 text-sm">
            <p className="font-semibold">Votre carte n’est pas débitée maintenant.</p>
            <p className="mt-1 text-mute">
              Nous bloquons un montant maximum le temps de l’intervention. Vous ne payez que les heures réelles et le matériel que vous acceptez.
            </p>
            <p className="mt-3 flex items-start gap-2 font-semibold text-ok">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="mt-0.5 shrink-0" aria-hidden><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>
              Intervention couverte par notre assurance responsabilité civile professionnelle.
            </p>
          </div>

          {!payment ? (
            <>
              <label className="mt-5 flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-ink" checked={accepted} onChange={(e) => { setAccepted(e.target.checked); setError('') }} />
                <span>
                  J’accepte les <Link href="/terms" target="_blank" className="font-semibold underline">conditions générales</Link> et je demande que l’intervention ait lieu aujourd’hui, avant la fin du délai de rétractation. Je perds ce droit une fois l’intervention entièrement réalisée.
                </span>
              </label>
              {error && <p className="error">{error}</p>}
              {needsLogin && (
                <div className="mt-4 rounded-[14px] bg-ink p-4 text-white">
                  <p className="font-semibold">Dernière étape : identifiez-vous</p>
                  <p className="mt-1 text-sm text-white/80">Votre demande est gardée. Après connexion, vous revenez directement au paiement.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link href={`/auth/signup?next=${encodeURIComponent('/reserver?reprise=1')}`} className="btn-small bg-hiviz text-ink">Créer un compte</Link>
                    <Link href={`/auth/login?next=${encodeURIComponent('/reserver?reprise=1')}`} className="btn-small border-2 border-white/30">Se connecter</Link>
                  </div>
                </div>
              )}
              <div className="mt-6 grid grid-cols-[auto_1fr] gap-2">
                <button className="btn-ghost px-6" onClick={() => setStep(2)}>Retour</button>
                <button className="btn-primary" disabled={busy} onClick={createMission}>{busy ? 'Préparation…' : 'Passer au paiement'}</button>
              </div>
            </>
          ) : (
            <div className="mt-6">
              <p className="mb-3 text-sm">Montant bloqué au maximum : <strong>{formatEuros(payment.amount)}</strong></p>
              <Elements stripe={stripePromise} options={{
                clientSecret: payment.clientSecret,
                locale: 'fr',
                appearance: { theme: 'stripe', variables: { colorPrimary: '#1D2733', borderRadius: '12px', fontFamily: 'system-ui, sans-serif' } },
              }}>
                <PaymentForm missionId={payment.missionId} />
              </Elements>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function PaymentForm({ missionId }: { missionId: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function pay(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setBusy(true); setError('')
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/missions/${missionId}` },
    })
    if (err) { setError(err.message ?? 'Paiement refusé.'); setBusy(false) }
  }

  return (
    <form onSubmit={pay}>
      <PaymentElement />
      {error && <p className="error">{error}</p>}
      <button className="btn-primary mt-5" disabled={!stripe || busy}>{busy ? 'Vérification…' : 'Bloquer le paiement et lancer la recherche'}</button>
    </form>
  )
}
