'use client'

import { useEffect, useState } from 'react'
import { GEOCODER_URL } from '@/lib/config'

export type Address = { label: string; lat: number; lng: number }
type Feature = { properties: { label: string; id?: string }; geometry: { coordinates: [number, number] } }

export default function AddressInput({ value, onChange }: { value: Address | null; onChange: (a: Address | null) => void }) {
  const [q, setQ] = useState(value?.label ?? '')
  const [results, setResults] = useState<Feature[]>([])
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (q.trim().length < 4 || q === value?.label) { setResults([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${GEOCODER_URL}/search?q=${encodeURIComponent(q)}&limit=5&index=address`, { signal: ctrl.signal })
        const d = await r.json()
        setResults(d.features ?? [])
      } catch { /* requête annulée */ }
    }, 250)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q, value?.label])

  function pick(f: Feature) {
    const [lng, lat] = f.geometry.coordinates
    onChange({ label: f.properties.label, lat, lng })
    setQ(f.properties.label)
    setResults([])
    setError('')
  }

  function locate() {
    if (!navigator.geolocation) { setError('Géolocalisation indisponible. Saisissez l’adresse.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await fetch(`${GEOCODER_URL}/reverse?lon=${pos.coords.longitude}&lat=${pos.coords.latitude}&limit=1&index=address`)
          const d = await r.json()
          if (d.features?.[0]) pick(d.features[0])
          else setError('Aucune adresse trouvée ici. Saisissez-la.')
        } catch { setError('Recherche impossible. Saisissez l’adresse.') }
        setLocating(false)
      },
      () => { setError('Position refusée. Saisissez l’adresse.'); setLocating(false) },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div>
      <label htmlFor="address" className="label">Adresse de l’intervention</label>
      <div className="relative">
        <input id="address" className="field" autoComplete="street-address" placeholder="12 rue des Lilas, Lyon"
          value={q} onChange={(e) => { setQ(e.target.value); if (value) onChange(null) }} />
        {results.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-[12px] border border-line bg-white shadow-lg">
            {results.map((f, i) => (
              <li key={f.properties.id ?? i}>
                <button type="button" onClick={() => pick(f)} className="block w-full px-4 py-3 text-left text-sm hover:bg-concrete">
                  {f.properties.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" onClick={locate} disabled={locating} className="mt-2 text-sm font-semibold text-plaster">
        {locating ? 'Localisation…' : 'Utiliser ma position actuelle'}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
