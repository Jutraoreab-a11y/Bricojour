'use client'

import { useRef, useState } from 'react'

const KNOB = 56
const PAD = 4

/** Glisser pour confirmer (ou Entrée sur la poignée, pour le clavier). */
export default function SwipeToConfirm({ label, onConfirm, disabled }: {
  label: string
  onConfirm: () => Promise<boolean>
  disabled?: boolean
}) {
  const track = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')

  const max = () => (track.current?.offsetWidth ?? 0) - KNOB - PAD * 2

  async function confirm() {
    setX(max())
    setState('busy')
    const ok = await onConfirm().catch(() => false)
    if (ok) setState('done')
    else { setState('idle'); setX(0) }
  }

  const locked = disabled || state !== 'idle'

  return (
    <div ref={track} className="relative h-16 select-none overflow-hidden rounded-full bg-ink" aria-disabled={locked}>
      <div className="absolute inset-y-0 left-0 bg-hiviz" style={{ width: x + KNOB + PAD * 2, transition: dragging ? 'none' : 'width .25s' }} aria-hidden />
      <span className="pointer-events-none absolute inset-0 grid place-items-center pl-12 text-sm font-bold text-white mix-blend-difference">
        {state === 'busy' ? 'Paiement en cours…' : state === 'done' ? 'Validé' : label}
      </span>
      <button
        type="button"
        aria-label={label}
        disabled={locked}
        className="absolute top-1 grid touch-none place-items-center rounded-full bg-white text-xl text-ink shadow"
        style={{ left: PAD + x, width: KNOB, height: KNOB, transition: dragging ? 'none' : 'left .25s' }}
        onPointerDown={(e) => {
          if (locked) return
          setDragging(true)
          startX.current = e.clientX - x
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!dragging) return
          setX(Math.min(max(), Math.max(0, e.clientX - startX.current)))
        }}
        onPointerUp={() => {
          if (!dragging) return
          setDragging(false)
          if (x > max() * 0.85) confirm()
          else setX(0)
        }}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !locked) { e.preventDefault(); confirm() } }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  )
}
