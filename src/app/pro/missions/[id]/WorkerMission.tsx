'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ActionButton, { missionAction } from '@/components/ActionButton'
import PhotoPicker from '@/components/PhotoPicker'
import ReviewForm from '@/components/ReviewForm'
import SignedImage from '@/components/SignedImage'
import StatusChip from '@/components/StatusChip'
import WorkerBreakdown from '@/components/WorkerBreakdown'
import { MAX_EXPENSES } from '@/lib/config'
import { formatHours } from '@/lib/money'
import { SLOT_LABEL } from '@/lib/status'
import type { Expense, Mission } from '@/lib/types'

type Draft = { key: string; label: string; euros: string; photo: string | null }

const toCents = (euros: string) => Math.round((parseFloat(euros.replace(',', '.')) || 0) * 100)
const newDraft = (): Draft => ({ key: crypto.randomUUID(), label: '', euros: '', photo: null })

export default function WorkerMission({ mission: m, clientName, chatOpen, hasReviewed, expenses, userId }: {
  mission: Mission; clientName: string; chatOpen: boolean; hasReviewed: boolean; expenses: Expense[]; userId: string
}) {
  const router = useRouter()
  const maxHours = Number(m.categories?.max_hours ?? 4)
  const [hours, setHours] = useState(Math.min(Number(m.estimated_hours), maxHours))
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const minHours = Number(m.min_billed_hours ?? 1)
  const step = (d: number) => setHours((h) => Math.min(maxHours, Math.max(0.25, Math.round((h + d) * 4) / 4)))
  const update = (key: string, patch: Partial<Draft>) => {
    setError('')
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  }

  async function submit() {
    for (const [i, d] of drafts.entries()) {
      const n = `Matériel ${i + 1}`
      if (d.label.trim().length < 2) return setError(`${n} : indiquez un libellé.`)
      if (toCents(d.euros) <= 0) return setError(`${n} : indiquez le montant en euros.`)
      if (!d.photo) return setError(`${n} : la photo du ticket ou du matériel est obligatoire.`)
    }
    setBusy(true); setError('')
    const r = await missionAction(m.id, 'complete', {
      hours,
      expenses: drafts.map((d) => ({ label: d.label.trim(), amountCents: toCents(d.euros), photoPath: d.photo })),
    })
    setBusy(false)
    if (!r.ok) { setError(r.message ?? 'Envoi impossible.'); return }
    router.refresh()
  }

  return (
    <div>
      <Link href="/pro" className="text-sm font-semibold text-plaster">Tableau de bord</Link>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-mute">{m.categories?.name}</p>
          <h1 className="display mt-1 text-3xl">{m.title}</h1>
        </div>
        <StatusChip status={m.status} />
      </div>

      <div className="sheet mt-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-sm text-mute">Client</p><p className="font-bold">{clientName}</p></div>
          {chatOpen && <Link href={`/chat/${m.id}`} className="btn-small bg-ink text-white">Écrire</Link>}
        </div>
        <div className="border-t border-line pt-3">
          <p className="text-sm text-mute">Adresse, {SLOT_LABEL[m.slot].toLowerCase()}</p>
          <p className="font-semibold">{m.address}</p>
          <a className="mt-1 inline-block text-sm font-semibold text-plaster" target="_blank" rel="noreferrer"
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(m.address)}`}>Ouvrir l’itinéraire</a>
        </div>
        {m.description && <p className="whitespace-pre-line border-t border-line pt-3 text-sm">{m.description}</p>}
        {m.photo_paths.length > 0 && (
          <div className="grid grid-cols-3 gap-2 border-t border-line pt-3">
            {m.photo_paths.map((p) => <SignedImage key={p} bucket="mission-photos" path={p} alt="Photo du problème" className="aspect-square w-full rounded-[12px]" />)}
          </div>
        )}
      </div>

      {m.status === 'matched' && (
        <div className="mt-6">
          <ActionButton missionId={m.id} action="start" label="Je suis sur place : démarrer" className="btn-primary" />
          <p className="mt-2 text-center text-xs text-mute">Le client est prévenu du démarrage.</p>
        </div>
      )}

      {m.status === 'in_progress' && (
        <section className="mt-6">
          <h2 className="text-xl font-bold">Terminer l’intervention</h2>

          <div className="sheet mt-3">
            <p className="label">Temps réellement passé</p>
            <div className="flex items-center justify-between gap-3">
              <button type="button" className="grid h-14 w-14 place-items-center rounded-[14px] bg-concrete text-2xl font-bold" onClick={() => step(-0.25)} aria-label="Moins 15 minutes">−</button>
              <p className="display text-4xl" aria-live="polite">{formatHours(hours)}</p>
              <button type="button" className="grid h-14 w-14 place-items-center rounded-[14px] bg-concrete text-2xl font-bold" onClick={() => step(0.25)} aria-label="Plus 15 minutes">+</button>
            </div>
            <p className="mt-2 text-center text-xs text-mute">Par quarts d’heure, {formatHours(maxHours)} maximum.</p>
            {hours < minHours && <p className="mt-1 text-center text-sm font-semibold text-ok">Facturé {formatHours(minHours)} : c’est le minimum par intervention.</p>}
          </div>

          <div className="mt-4">
            <h3 className="font-bold">Matériel imprévu</h3>
            <p className="text-sm text-mute">Acheté sur place ? Ajoutez chaque achat avec sa photo : il vous est remboursé en totalité.</p>
            <ul className="mt-3 space-y-3">
              {drafts.map((d, i) => (
                <li key={d.key} className="sheet !p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">Matériel {i + 1}</p>
                    <button type="button" className="text-sm font-semibold text-alert" onClick={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))}>Retirer</button>
                  </div>
                  <label className="label mt-3" htmlFor={`l-${d.key}`}>Libellé</label>
                  <input id={`l-${d.key}`} className="field" maxLength={120} placeholder="Flexible inox 50 cm" value={d.label} onChange={(e) => update(d.key, { label: e.target.value })} />
                  <label className="label mt-3" htmlFor={`a-${d.key}`}>Montant (€)</label>
                  <input id={`a-${d.key}`} className="field" inputMode="decimal" placeholder="8,90" value={d.euros} onChange={(e) => update(d.key, { euros: e.target.value })} />
                  <p className="label mt-3">Photo du ticket ou du matériel</p>
                  <PhotoPicker bucket="material-receipts" max={1} paths={d.photo ? [d.photo] : []}
                    onAdd={(p) => update(d.key, { photo: p })} onRemove={() => update(d.key, { photo: null })} addLabel="Justificatif" />
                </li>
              ))}
            </ul>
            {drafts.length < MAX_EXPENSES && (
              <button type="button" className="btn-ghost mt-3" onClick={() => setDrafts((ds) => [...ds, newDraft()])}>
                + Ajouter du matériel imprévu
              </button>
            )}
          </div>

          <div className="mt-4">
            <WorkerBreakdown
              rateCents={m.hourly_rate_cents}
              plannedHours={Number(m.estimated_hours)}
              actualHours={hours}
              minHours={minHours}
              materials={drafts.filter((d) => toCents(d.euros) > 0).map((d) => ({ label: d.label.trim(), cents: toCents(d.euros) }))}
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn-primary mt-4" disabled={busy} onClick={submit}>{busy ? 'Envoi…' : 'Envoyer au client pour validation'}</button>
        </section>
      )}

      {m.status === 'awaiting_validation' && m.actual_hours != null && (
        <div className="mt-6 space-y-3">
          <p className="sheet text-sm">Le client a reçu le récapitulatif. Le versement part dès qu’il valide.</p>
          <WorkerBreakdown
            rateCents={m.hourly_rate_cents}
            plannedHours={Number(m.estimated_hours)}
            actualHours={Number(m.actual_hours)}
            minHours={minHours}
            materials={expenses.map((e) => ({ label: e.label, cents: e.amount_cents }))}
          />
        </div>
      )}
      {m.status === 'disputed' && (
        <p className="error mt-6">Le client a signalé un problème. Notre équipe vous contacte rapidement.</p>
      )}

      {m.status === 'completed' && (
        <section className="mt-6 space-y-4">
          <WorkerBreakdown
            title="Décompte de la mission"
            rateCents={m.hourly_rate_cents}
            plannedHours={Number(m.estimated_hours)}
            actualHours={Number(m.actual_hours)}
            minHours={minHours}
            materials={expenses.filter((e) => e.status !== 'rejected').map((e) => ({ label: e.label, cents: e.amount_cents }))}
          />
          {!hasReviewed && <ReviewForm missionId={m.id} userId={userId} who={clientName} />}
        </section>
      )}
    </div>
  )
}
