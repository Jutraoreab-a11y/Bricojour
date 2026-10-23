'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PushBanner from '@/components/PushBanner'
import RealtimeRefresh from '@/components/RealtimeRefresh'
import SignedImage from '@/components/SignedImage'
import { missionAction } from '@/components/ActionButton'
import { createClient } from '@/lib/supabase/client'
import { formatEuros, formatHours, split } from '@/lib/money'
import { SLOT_LABEL } from '@/lib/status'
import type { Mission } from '@/lib/types'

export type Offer = {
  mission_id: string
  title: string
  category_name: string
  area_label: string | null
  distance_m: number | null
  estimated_hours: number
  hourly_rate_cents: number
  min_billed_hours: number
  slot: Mission['slot']
  photo_paths: string[]
}

export default function ProDashboard({ userId, available, hasLocation, radiusKm, offers }: {
  userId: string; available: boolean; hasLocation: boolean; radiusKm: number; offers: Offer[]
}) {
  const router = useRouter()
  const [isAvailable, setIsAvailable] = useState(available)
  const [msg, setMsg] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function toggle() {
    const next = !isAvailable
    if (next && !hasLocation) { setMsg('Enregistrez d’abord votre point de départ.'); return }
    setIsAvailable(next)
    const { error } = await createClient().from('users').update({ is_available: next }).eq('id', userId)
    if (error) { setIsAvailable(!next); setMsg('Mise à jour impossible. Réessayez.') }
  }

  function saveLocation() {
    if (!navigator.geolocation) { setMsg('Géolocalisation indisponible sur cet appareil.'); return }
    setMsg('Localisation…')
    navigator.geolocation.getCurrentPosition(async (p) => {
      const { error } = await createClient().from('users')
        .update({ base_location: `SRID=4326;POINT(${p.coords.longitude} ${p.coords.latitude})` }).eq('id', userId)
      setMsg(error ? 'Position non enregistrée.' : 'Point de départ enregistré.')
      router.refresh()
    }, () => setMsg('Autorisez la géolocalisation pour recevoir les missions proches.'), { enableHighAccuracy: true })
  }

  async function respond(missionId: string, action: 'accept' | 'decline') {
    setBusyId(missionId); setMsg('')
    const r = await missionAction(missionId, action)
    setBusyId(null)
    if (action === 'accept' && r.ok) { router.push(`/pro/missions/${missionId}`); return }
    if (!r.ok) setMsg(r.message ?? 'Action impossible.')
    router.refresh()
  }

  return (
    <div className="mt-6">
      <RealtimeRefresh channel={`proposals-${userId}`} table="proposals" filter={`worker_id=eq.${userId}`} />
      <PushBanner text="Activez les alertes : les missions sont attribuées au premier qui accepte." />

      <button onClick={toggle} aria-pressed={isAvailable}
        className={`flex w-full items-center justify-between rounded-[20px] p-5 text-left transition-colors ${isAvailable ? 'bg-hiviz' : 'bg-white border border-line'}`}>
        <span>
          <span className="display block text-2xl">{isAvailable ? 'Disponible' : 'Indisponible'}</span>
          <span className="text-sm">{isAvailable ? `Vous recevez les missions à moins de ${radiusKm} km.` : 'Touchez pour recevoir des missions.'}</span>
        </span>
        <span className={`relative h-8 w-14 shrink-0 rounded-full ${isAvailable ? 'bg-ink' : 'bg-line'}`} aria-hidden>
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-[left] ${isAvailable ? 'left-7' : 'left-1'}`} />
        </span>
      </button>
      <button onClick={saveLocation} className="mt-2 text-sm font-semibold text-plaster">
        {hasLocation ? 'Mettre à jour mon point de départ' : 'Enregistrer mon point de départ'}
      </button>
      {msg && <p className="mt-2 text-sm" role="status">{msg}</p>}

      <section className="mt-8">
        <h2 className="text-xl font-bold">Missions proposées</h2>
        {offers.length === 0 ? (
          <p className="mt-2 text-sm text-mute">Aucune mission pour l’instant. Restez disponible : vous serez alerté dès qu’une demande arrive près de chez vous.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {offers.map((o) => (
              <li key={o.mission_id} className="sheet">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-mute">{o.category_name}</p>
                    <p className="text-lg font-bold">{o.title}</p>
                  </div>
                  <p className="display shrink-0 text-xl">{formatEuros(o.hourly_rate_cents)}/h</p>
                </div>
                <p className="mt-2 text-sm text-mute">
                  {o.area_label}{o.distance_m != null ? `, à ${(o.distance_m / 1000).toFixed(1).replace('.', ',')} km` : ''}.
                  {' '}{SLOT_LABEL[o.slot]}, environ {formatHours(Number(o.estimated_hours))}.
                </p>
                {(() => {
                  const e = split(o.hourly_rate_cents, Number(o.estimated_hours), Number(o.min_billed_hours))
                  return (
                    <dl className="mt-3 space-y-1 rounded-[12px] bg-concrete p-3 text-sm">
                      <div className="flex justify-between"><dt className="text-mute">Heures prévues ({formatHours(Number(o.estimated_hours))} × {formatEuros(o.hourly_rate_cents)})</dt><dd>{formatEuros(e.labor)}</dd></div>
                      <div className="flex justify-between"><dt className="text-mute">Commission de service Bricojour (20 %)</dt><dd>− {formatEuros(e.fee)}</dd></div>
                      <div className="flex justify-between font-bold"><dt>Estimation pour vous</dt><dd>{formatEuros(e.net)}</dd></div>
                      <p className="pt-1 text-xs text-mute">Ajustée selon les heures réellement effectuées.</p>
                    </dl>
                  )
                })()}
                {o.photo_paths.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {o.photo_paths.slice(0, 3).map((p) => <SignedImage key={p} bucket="mission-photos" path={p} alt="Photo du problème" className="h-16 w-16 rounded-[10px]" />)}
                  </div>
                )}
                <p className="mt-2 text-xs text-mute">L’adresse exacte s’affiche quand vous acceptez.</p>
                <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
                  <button className="btn-ghost px-5" disabled={busyId === o.mission_id} onClick={() => respond(o.mission_id, 'decline')}>Passer</button>
                  <button className="btn-primary" disabled={busyId === o.mission_id} onClick={() => respond(o.mission_id, 'accept')}>
                    {busyId === o.mission_id ? 'Un instant…' : 'Accepter la mission'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
