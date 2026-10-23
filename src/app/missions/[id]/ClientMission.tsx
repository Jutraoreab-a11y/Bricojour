'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ActionButton, { missionAction } from '@/components/ActionButton'
import PushBanner from '@/components/PushBanner'
import ReviewForm from '@/components/ReviewForm'
import SignedImage from '@/components/SignedImage'
import Stars from '@/components/Stars'
import StatusChip from '@/components/StatusChip'
import SwipeToConfirm from '@/components/SwipeToConfirm'
import { CLIENT_FEE_LABEL } from '@/lib/config'
import { formatEuros, formatHours } from '@/lib/money'
import { CLIENT_STEPS, clientStepIndex, SLOT_LABEL } from '@/lib/status'
import type { ClientAmounts, Expense, Mission, PublicProfile } from '@/lib/types'

export default function ClientMission({ mission: m, worker, chat, hasReviewed, expenses, amounts, userId }: {
  mission: Mission
  worker: PublicProfile | null
  chat: { id: string; closes_at: string | null } | null
  hasReviewed: boolean
  expenses: Expense[]
  amounts: ClientAmounts | null
  userId: string
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const stepIdx = clientStepIndex(m.status)
  const chatOpen = chat && (!chat.closes_at || new Date(chat.closes_at) > new Date())
  const materialTotal = expenses.reduce((s, e) => s + e.amount_cents, 0)
  const clientFee = amounts?.client_fee_cents ?? Math.round(m.labor_cents * 0.2)
  const total = m.labor_cents + clientFee + materialTotal

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-mute">{m.categories?.name}</p>
          <h1 className="display mt-1 text-3xl">{m.title}</h1>
        </div>
        <StatusChip status={m.status} />
      </div>

      {m.status !== 'cancelled' && (
        <ol className="mt-6 grid grid-cols-4 gap-1" aria-label="Avancement">
          {CLIENT_STEPS.map((s, i) => (
            <li key={s} className="text-[11px] font-semibold leading-tight">
              <div className={`mb-1.5 h-1.5 rounded-full ${i <= stepIdx ? 'bg-ink' : 'bg-line'}`} />
              <span className={i <= stepIdx ? 'text-ink' : 'text-mute'}>{s}</span>
            </li>
          ))}
        </ol>
      )}

      {m.status === 'pending_payment' && (
        <p className="sheet mt-6 text-sm">Nous attendons la confirmation de votre banque. Cette page se met à jour toute seule.</p>
      )}

      {m.status === 'searching' && (
        <div className="mt-6">
          <PushBanner text="Activez les alertes pour savoir dès qu’un intervenant accepte." />
          <div className="sheet">
            <div className="tape -mx-5 -mt-5 mb-4 h-4 animate-pulse rounded-t-[20px]" aria-hidden />
            <p className="font-semibold">Les intervenants proches sont prévenus.</p>
            <p className="mt-1 text-sm text-mute">Le premier qui accepte vient chez vous {SLOT_LABEL[m.slot].toLowerCase()}. Sans réponse dans les 4 heures, la demande est annulée et votre carte libérée.</p>
          </div>
        </div>
      )}

      {worker && ['matched', 'in_progress', 'awaiting_validation', 'completed', 'disputed'].includes(m.status) && (
        <div className="sheet mt-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-mute">Votre intervenant</p>
            <p className="text-lg font-bold">{worker.full_name ?? 'Intervenant'}</p>
            <Stars value={Number(worker.rating_avg)} count={worker.rating_count} />
          </div>
          {chatOpen && <Link href={`/chat/${m.id}`} className="btn-small bg-ink text-white">Écrire</Link>}
        </div>
      )}

      {m.status === 'awaiting_validation' && m.actual_hours != null && (
        <section className="mt-6">
          <h2 className="text-xl font-bold">Vérifiez et validez</h2>
          <dl className="sheet mt-3 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-mute">
                Main-d’œuvre : {formatHours(Number(m.billed_hours))} à {formatEuros(m.hourly_rate_cents)}/h
                {Number(m.actual_hours) < Number(m.billed_hours) && (
                  <span className="block text-xs">{formatHours(Number(m.actual_hours))} réalisées, minimum facturé {formatHours(Number(m.min_billed_hours))}</span>
                )}
              </dt>
              <dd className="font-semibold">{formatEuros(m.labor_cents)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-mute">{CLIENT_FEE_LABEL} (20 %)</dt>
              <dd className="font-semibold">{formatEuros(clientFee)}</dd>
            </div>
            {expenses.length > 0 && (
              <div className="border-t border-line pt-3">
                <dt className="font-semibold text-ink">Matériel imprévu</dt>
                <dd className="mt-1 text-xs text-mute">Refacturé au prix du ticket, sans frais. En cas de désaccord, signalez un problème plutôt que de valider.</dd>
                <ul className="mt-3 space-y-3">
                  {expenses.map((e) => (
                    <li key={e.id} className="flex items-center gap-3">
                      <SignedImage bucket="material-receipts" path={e.photo_path} alt={`Justificatif : ${e.label}`} className="h-16 w-16 shrink-0 rounded-[10px]" />
                      <span className="flex-1 font-medium">{e.label}</span>
                      <span className="font-semibold">{formatEuros(e.amount_cents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t border-line pt-3 text-base">
              <dt className="font-bold">À payer</dt>
              <dd className="display text-2xl">{formatEuros(total)}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <SwipeToConfirm
              label={`Glissez pour payer ${formatEuros(total)}`}
              onConfirm={async () => {
                setError('')
                const r = await missionAction(m.id, 'validate')
                if (!r.ok) { setError(r.message ?? 'Validation impossible.'); return false }
                router.refresh()
                return true
              }}
            />
          </div>
          {error && <p className="error">{error}</p>}
          <div className="mt-3">
            <ActionButton missionId={m.id} action="dispute" label="Signaler un problème" className="btn-ghost"
              confirmText="Le paiement sera suspendu le temps que notre équipe examine la situation. Continuer ?" />
          </div>
        </section>
      )}

      {m.status === 'disputed' && (
        <p className="sheet mt-6 text-sm">Votre signalement est entre les mains de notre équipe. Le paiement reste suspendu en attendant.</p>
      )}

      {m.status === 'completed' && (
        <section className="mt-6 space-y-4">
          <div className="sheet">
            <p className="text-sm text-mute">Montant payé</p>
            <p className="display text-3xl">{formatEuros(amounts?.client_total_cents ?? total)}</p>
            <p className="mt-1 text-sm text-mute">
              {formatHours(Number(m.billed_hours))} de main-d’œuvre ({formatEuros(m.labor_cents)}), {formatEuros(clientFee)} de frais de service et de mise en relation{m.material_status === 'approved' ? ` et ${formatEuros(m.material_cents)} de matériel imprévu` : ''}.
            </p>
          </div>
          {!hasReviewed && <ReviewForm missionId={m.id} userId={userId} who={worker?.full_name ?? 'votre intervenant'} />}
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-bold">Votre demande</h2>
        <p className="mt-2 text-sm text-mute">{m.address}</p>
        {m.description && <p className="mt-2 whitespace-pre-line text-sm">{m.description}</p>}
        {m.photo_paths.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {m.photo_paths.map((p) => <SignedImage key={p} bucket="mission-photos" path={p} alt="Photo du problème" className="aspect-square w-full rounded-[12px]" />)}
          </div>
        )}
      </section>

      {(m.status === 'pending_payment' || m.status === 'searching') && (
        <div className="mt-8">
          <ActionButton missionId={m.id} action="cancel" label="Annuler la demande" className="btn-ghost"
            confirmText="Annuler la demande et libérer votre carte ?" />
        </div>
      )}
    </div>
  )
}
