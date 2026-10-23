import { PROVIDER_FEE_LABEL } from '@/lib/config'
import { formatEuros, formatHours } from '@/lib/money'

type Line = { label: string; cents: number }

/**
 * Décompte intervenant, ligne par ligne. Base : taux horaire de la plateforme.
 * Les frais ajoutés au client ne figurent jamais ici.
 */
export default function WorkerBreakdown({ rateCents, plannedHours, actualHours, minHours, materials, title = 'Votre décompte' }: {
  rateCents: number
  plannedHours: number
  actualHours: number
  minHours: number
  materials: Line[]
  title?: string
}) {
  const billed = Math.max(actualHours, minHours)
  const plannedCents = Math.round(rateCents * plannedHours)
  const laborCents = Math.round(rateCents * billed)
  const diffHours = billed - plannedHours
  const diffCents = laborCents - plannedCents
  const feeCents = Math.round(laborCents * 0.2)
  const materialCents = materials.reduce((s, l) => s + l.cents, 0)
  const total = laborCents - feeCents + materialCents
  const sign = (n: number) => (n > 0 ? '+ ' : n < 0 ? '− ' : '')

  const Row = ({ dt, dd, strong, muted }: { dt: React.ReactNode; dd: React.ReactNode; strong?: boolean; muted?: boolean }) => (
    <div className={`flex justify-between gap-4 ${strong ? 'font-bold' : ''}`}>
      <dt className={muted ? 'text-mute' : ''}>{dt}</dt>
      <dd className="shrink-0 text-right tabular-nums">{dd}</dd>
    </div>
  )

  return (
    <section className="sheet text-sm" aria-label={title}>
      <h3 className="font-bold">{title}</h3>

      <dl className="mt-3 space-y-2">
        <Row muted dt="Taux horaire" dd={`${formatEuros(rateCents)}/h`} />
      </dl>

      <dl className="mt-3 space-y-2 border-t border-line pt-3">
        <Row dt={<>Heures prévues <span className="text-mute">({formatHours(plannedHours)} × {formatEuros(rateCents)})</span></>} dd={formatEuros(plannedCents)} />
        <Row dt="Heures effectuées" dd={formatHours(actualHours)} />
        {actualHours < minHours && (
          <Row muted dt={`Minimum facturé par intervention`} dd={formatHours(minHours)} />
        )}
        <Row
          dt={<>Différence facturée <span className="text-mute">({diffHours === 0 ? 'aucune' : `${sign(diffHours)}${formatHours(Math.abs(diffHours))}`})</span></>}
          dd={diffCents === 0 ? formatEuros(0) : `${sign(diffCents)}${formatEuros(Math.abs(diffCents))}`}
        />
        <Row strong dt={<>Main-d’œuvre <span className="font-normal text-mute">({formatHours(billed)} × {formatEuros(rateCents)})</span></>} dd={formatEuros(laborCents)} />
      </dl>

      <dl className="mt-3 space-y-2 border-t border-line pt-3">
        <Row dt={`${PROVIDER_FEE_LABEL} (20 % de ${formatEuros(laborCents)})`} dd={`− ${formatEuros(feeCents)}`} />
        <Row strong dt="Main-d’œuvre nette" dd={formatEuros(laborCents - feeCents)} />
      </dl>

      {materials.length > 0 && (
        <dl className="mt-3 space-y-2 border-t border-line pt-3">
          <p className="font-semibold">Matériel imprévu remboursé à 100 %</p>
          {materials.map((l, i) => <Row key={i} muted dt={l.label || `Matériel ${i + 1}`} dd={`+ ${formatEuros(l.cents)}`} />)}
          <Row strong dt="Total matériel" dd={`+ ${formatEuros(materialCents)}`} />
        </dl>
      )}

      <dl className="mt-3 border-t-2 border-ink pt-3 text-base">
        <Row strong dt="Versé sur votre compte" dd={<span className="display text-xl">{formatEuros(total)}</span>} />
      </dl>
    </section>
  )
}
