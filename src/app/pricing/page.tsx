import Link from 'next/link'
import Page from '@/components/Page'
import { CLIENT_FEE_LABEL, PROVIDER_FEE_LABEL } from '@/lib/config'
import { formatEuros, marketplaceSplit } from '@/lib/money'

export const metadata = {
  title: 'Transparence des tarifs',
  description: 'Comment est calculé le prix d’une intervention Bricojour, côté particulier et côté intervenant.',
}

const RATE = 2500
// Exemple : 2 h de main-d'œuvre et 8,90 € de matériel acheté sur place
const ex = marketplaceSplit(RATE, 2, 890)

function Row({ dt, dd, strong }: { dt: React.ReactNode; dd: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'border-t border-line pt-2 font-bold' : ''}`}>
      <dt className={strong ? '' : 'text-mute'}>{dt}</dt>
      <dd className="shrink-0 tabular-nums">{dd}</dd>
    </div>
  )
}

export default function Pricing() {
  return (
    <Page>
      <h1 className="display text-4xl">Transparence des tarifs</h1>
      <p className="mt-3 text-mute">
        Pas de devis, pas d’abonnement. Bricojour est une place de marché : elle se rémunère uniquement par une commission prélevée sur chaque intervention payée.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Le tarif de base</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px]">
          <li>Main-d’œuvre : <strong>{formatEuros(RATE)}/h</strong>, quelle que soit la catégorie de travaux.</li>
          <li>Décompte au quart d’heure, avec un minimum d’une heure par intervention.</li>
          <li>Matériel imprévu : refacturé au prix exact du ticket, sur photo du justificatif, sans aucune commission.</li>
        </ul>
      </section>

      <section className="sheet mt-8">
        <h2 className="text-lg font-bold">Vous êtes un particulier</h2>
        <p className="mt-1 text-sm text-mute">{CLIENT_FEE_LABEL} : 20 % de la main-d’œuvre, ajoutés à votre prix.</p>
        <p className="mt-4 text-sm font-semibold">Exemple : 2 h de travail et un flexible à 8,90 €</p>
        <dl className="mt-2 space-y-1.5 text-sm">
          <Row dt="Main-d’œuvre (2 h × 25 €)" dd={formatEuros(ex.labor)} />
          <Row dt={`${CLIENT_FEE_LABEL} (20 %)`} dd={formatEuros(ex.feeClient)} />
          <Row dt="Matériel (prix du ticket)" dd={formatEuros(ex.materials)} />
          <Row strong dt="Vous payez" dd={formatEuros(ex.gross)} />
        </dl>
        <p className="mt-3 text-xs text-mute">Votre carte est seulement bloquée à la réservation. Rien n’est débité avant que vous validiez la fin de l’intervention.</p>
      </section>

      <section className="sheet mt-4">
        <h2 className="text-lg font-bold">Vous êtes intervenant</h2>
        <p className="mt-1 text-sm text-mute">{PROVIDER_FEE_LABEL} : 20 % de la main-d’œuvre, retenus sur votre versement. Soit {formatEuros(RATE * 0.8)} net par heure.</p>
        <p className="mt-4 text-sm font-semibold">Même exemple, de votre côté</p>
        <dl className="mt-2 space-y-1.5 text-sm">
          <Row dt="Main-d’œuvre (2 h × 25 €)" dd={formatEuros(ex.labor)} />
          <Row dt={`${PROVIDER_FEE_LABEL} (20 %)`} dd={`− ${formatEuros(ex.feeProvider)}`} />
          <Row dt="Matériel remboursé à 100 %" dd={`+ ${formatEuros(ex.materials)}`} />
          <Row strong dt="Vous recevez" dd={formatEuros(ex.payout)} />
        </dl>
        <p className="mt-3 text-xs text-mute">Versé par Stripe dès que le client valide. Vous déclarez vous-même vos revenus : Bricojour ne fait aucune déclaration à votre place.</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Ce que garde Bricojour</h2>
        <p className="mt-2 text-[15px]">
          Sur cet exemple, {formatEuros(ex.margin)} : les {formatEuros(ex.feeClient)} de frais côté particulier et les {formatEuros(ex.feeProvider)} de commission côté intervenant.
          Ils financent la mise en relation, le paiement sécurisé, l’assurance et le service client. Les frais bancaires de Stripe sont pris sur cette part.
        </p>
      </section>

      <div className="mt-8 grid gap-2 sm:grid-cols-2">
        <Link href="/reserver" className="btn-primary">Réserver une intervention</Link>
        <Link href="/handyman/dashboard" className="btn-ghost">Devenir intervenant</Link>
      </div>
    </Page>
  )
}
