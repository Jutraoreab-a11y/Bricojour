import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/supabase/server'
import { APP_NAME } from '@/lib/config'
import LegalFooter from '@/components/LegalFooter'

/** Porte d'entrée : on choisit son espace, particulier ou intervenant. */
export default async function Landing() {
  const { supabase, user } = await getSessionUser()
  if (user) {
    const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (data?.role === 'worker') redirect('/pro')
    if (data?.role === 'admin') redirect('/admin')
    redirect('/particulier')
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+20px)]">
      <div className="flex items-center justify-between">
        <span className="display text-xl">{APP_NAME}</span>
        <Link href="/connexion" className="text-sm font-semibold text-mute">Connexion</Link>
      </div>

      <div className="mt-auto pt-14">
        <div className="tape h-6 w-28 rounded-[4px]" aria-hidden />
        <h1 className="display mt-6 text-[3rem]">Cassé ce matin, réparé aujourd’hui.</h1>
        <p className="mt-4 text-lg text-mute">
          La fuite, l’étagère, la prise qui pend : un bricoleur vérifié passe chez vous dans la journée.
        </p>
      </div>

      <ul className="mt-8 divide-y divide-line border-y border-line text-[15px]">
        {[
          ['Pas de devis, pas de surprise.', '25 €/h, affiché avant de réserver.'],
          ['Vous payez quand c’est réparé.', 'Rien n’est débité avant votre validation.'],
          ['Vos week-ends vous appartiennent.', 'Les petits travaux, on s’en occupe.'],
        ].map(([strong, rest]) => (
          <li key={strong} className="py-3">
            <span className="font-bold">{strong}</span> <span className="text-mute">{rest}</span>
          </li>
        ))}
      </ul>

      <nav className="mt-8 grid gap-3" aria-label="Choisir votre espace">
        <Link href="/particulier" className="group flex items-center justify-between gap-4 rounded-[22px] bg-hiviz p-6 text-ink transition-transform active:scale-[0.98]">
          <span>
            <span className="display block text-2xl">Je suis un particulier</span>
            <span className="mt-1 block text-[15px]">J’ai un truc à réparer aujourd’hui.</span>
          </span>
          <Chevron />
        </Link>
        <Link href="/intervenant" className="group flex items-center justify-between gap-4 rounded-[22px] bg-ink p-6 text-white transition-transform active:scale-[0.98]">
          <span>
            <span className="display block text-2xl">Je suis intervenant</span>
            <span className="mt-1 block text-[15px] text-white/75">Vos heures libres deviennent des revenus.</span>
          </span>
          <Chevron />
        </Link>
      </nav>

      <p className="mt-8 text-center text-xs text-mute">
        Carte débitée seulement après validation du chantier.<br />Chaque intervention est couverte par une assurance RC Pro.
      </p>
      <LegalFooter className="mt-6" />
    </main>
  )
}

function Chevron() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 transition-transform group-hover:translate-x-1">
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}
