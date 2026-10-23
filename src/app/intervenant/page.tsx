import Link from 'next/link'
import Page from '@/components/Page'
import { formatEuros, split } from '@/lib/money'

export const metadata = { title: 'Intervenant' }

const RATE = 2500

export default function Intervenant() {
  const { net } = split(RATE, 1)
  return (
    <Page>
      <div className="tape h-6 w-28 rounded-[4px]" aria-hidden />
      <h1 className="display mt-6 text-[2.6rem]">Des missions près de chez vous, quand vous voulez.</h1>
      <p className="mt-4 text-lg text-mute">
        Petits dépannages du jour : un joint, une étagère, un luminaire. Vous passez disponible, vous acceptez ce qui vous arrange.
      </p>

      <div className="mt-8 rounded-[20px] bg-ink p-6 text-white">
        <p className="text-sm text-white/70">Taux horaire</p>
        <p className="display mt-1 text-5xl text-hiviz">{formatEuros(RATE)}/h</p>
        <p className="mt-2 text-sm text-white/70">
          Soit {formatEuros(net)} net par heure après la commission de service Bricojour (20 %). 1 h minimum par intervention. Le matériel acheté sur place vous est remboursé au centime.
        </p>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Pour commencer</h2>
        <ol className="mt-4 space-y-5">
          {[
            ['Vérifiez votre identité', 'Pièce d’identité et IBAN, en quelques minutes, via notre partenaire de paiement.'],
            ['Montrez votre travail', 'Deux photos de réalisations par type de travaux pour débloquer les missions.'],
            ['Recevez les alertes', 'Les missions proches arrivent sur votre téléphone. Le premier qui accepte l’obtient.'],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="display grid h-10 w-10 shrink-0 place-items-center rounded-full bg-hiviz text-lg">{i + 1}</span>
              <div>
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-mute">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Link href="/connexion?role=worker" className="btn-primary mt-10">Créer mon compte intervenant</Link>
      <p className="mt-4 text-center text-sm">
        Déjà inscrit ? <Link href="/connexion?role=worker&next=/pro" className="font-semibold text-plaster underline underline-offset-4">Se connecter</Link>
      </p>
      <p className="mt-8 text-center text-xs text-mute">
        Uniquement des petits travaux à bas risque : pas de gros œuvre, de gaz, de tableau électrique ni de travaux en hauteur.
      </p>
    </Page>
  )
}
