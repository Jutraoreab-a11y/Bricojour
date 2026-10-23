import Link from 'next/link'
import Page from '@/components/Page'
import { createClient } from '@/lib/supabase/server'
import { formatEuros } from '@/lib/money'
import type { Category } from '@/lib/types'

export const metadata = { title: "Particulier" }

export default async function Particulier() {
  const supabase = await createClient()
  const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order')
  const categories = (data ?? []) as Category[]
  const today = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(new Date())

  return (
    <Page>
      <section>
        <div className="tape rounded-[6px] px-3 pb-2 pt-6">
          <p className="text-sm font-bold">Interventions possibles {today}</p>
        </div>
        <h1 className="display mt-7 text-[2.65rem]">Un bricoleur chez vous aujourd’hui.</h1>
        <p className="mt-4 text-lg text-mute">
          Fuite sous l’évier, lame de parquet, meuble à monter, luminaire à changer.
          25 €/h de main-d’œuvre, frais affichés avant de payer. La carte n’est débitée qu’après votre validation.
        </p>
        <Link href="/reserver" className="btn-primary mt-7">Réserver une intervention</Link>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold">Ce que nos intervenants font</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/reserver?c=${c.slug}`} className="flex items-start justify-between gap-4 py-4">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="mt-1 text-sm text-mute">{c.description}</p>
                </div>
                <div className="shrink-0 text-right"><p className="font-bold">{formatEuros(c.hourly_rate_cents)}/h</p><p className="text-xs text-mute">+ 20 % de frais</p></div>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-mute">
          Gros œuvre, gaz, tableau électrique et travaux en hauteur ne sont pas proposés.
        </p>
        <p className="mt-2 text-sm text-mute">
          Tarif : 25 €/h de main-d’œuvre + 20 % de frais de service et de mise en relation, 1 h minimum. Le matériel éventuel est refacturé au prix du ticket.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold">Comment ça se passe</h2>
        <ol className="mt-4 space-y-5">
          {[
            ['Décrivez le problème', 'Deux ou trois photos suffisent. Vous voyez le tarif horaire avant de valider.'],
            ['Un intervenant proche accepte', 'Vous échangez avec lui dans l’app jusqu’à son arrivée.'],
            ['Vous validez d’un geste', 'Vous confirmez les heures réelles et le matériel éventuel. Le paiement part à ce moment-là.'],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="display grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-lg text-hiviz">{i + 1}</span>
              <div>
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-mute">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-12 text-center text-sm">
        Vous êtes bricoleur ? <Link href="/intervenant" className="font-semibold text-plaster underline underline-offset-4">Proposer mes services</Link>
      </p>

      <p className="mt-8 text-center text-xs text-mute">
        Chaque intervention est couverte par notre assurance responsabilité civile professionnelle.
      </p>
    </Page>
  )
}
