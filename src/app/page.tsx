import Link from 'next/link'
import { APP_NAME } from '@/lib/config'
import { getPlatformRating } from '@/lib/catalog'
import { LEGAL_LINKS } from '@/components/LegalFooter'

// Page publique : aucune connexion requise, rendue en statique et rafraîchie toutes les 10 min.
export const revalidate = 600

const SERVICES = [
  { name: 'Plomberie de surface', examples: 'Joint, siphon, flexible, robinet', Icon: DropIcon },
  { name: 'Fixation et montage', examples: 'Meuble, étagère, tringle, support TV', Icon: DrillIcon },
  { name: 'Électricité cosmétique', examples: 'Luminaire, prise, interrupteur à l’identique', Icon: BulbIcon },
]

const CLIENT_BENEFITS = [
  { title: 'Pas de devis, pas de surprise', text: 'Un tarif horaire fixe, affiché avant de réserver.', Icon: TagIcon },
  { title: 'Votre argent est protégé', text: 'Le paiement est bloqué à la réservation et débité seulement après votre validation.', Icon: ShieldIcon },
  { title: 'Réparé dans la journée', text: 'Un bricoleur vérifié passe chez vous pour les petits tracas du quotidien.', Icon: ClockIcon },
]

const PRO_BENEFITS = [
  { title: 'Un complément de revenu immédiat', text: 'Vos heures libres deviennent des revenus, versés dès la validation du client.', Icon: CoinsIcon },
  { title: 'Libre et flexible', text: 'Vous passez disponible quand vous voulez et choisissez vos interventions.', Icon: SlidersIcon },
  { title: 'Transparence totale', text: 'Votre décompte détaille chaque heure, la commission et le matériel remboursé.', Icon: ReceiptIcon },
]

export default async function Landing() {
  const rating = await getPlatformRating()

  return (
    <div className="min-h-dvh bg-concrete text-ink">
      <header className="pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-5 lg:h-20 lg:px-10">
          <Link href="/" className="display text-xl lg:text-2xl">{APP_NAME}</Link>
          <nav className="flex items-center gap-2 text-sm font-semibold sm:gap-3" aria-label="Compte">
            <Link href="/pricing" className="hidden px-3 py-2 text-mute hover:text-ink md:inline">Tarifs</Link>
            <Link href="/auth/login" className="whitespace-nowrap rounded-[12px] px-2 py-2 hover:bg-white sm:px-3">Connexion</Link>
            <Link href="/auth/signup" className="whitespace-nowrap rounded-[12px] bg-ink px-3 py-2.5 text-white transition-colors hover:bg-[#2A3747] sm:px-4">
              Créer un compte
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-[1200px] gap-12 px-5 pb-16 pt-8 lg:grid-cols-[minmax(0,1.22fr)_minmax(0,0.78fr)] lg:items-center lg:gap-14 lg:px-10 lg:pb-24 lg:pt-10">
          <div>
            <h1 className="display text-[clamp(2.5rem,4.7vw,4.25rem)]">Cassé ce matin, réparé aujourd’hui.</h1>
            <div className="tape mt-5 h-6 w-full max-w-[22rem] rounded-[4px]" aria-hidden />
            <p className="mt-5 max-w-[34rem] text-lg text-mute lg:text-xl">
              La fuite sous l’évier, l’étagère à fixer, la prise qui pend : un bricoleur vérifié passe chez vous dans la journée, à prix fixe.
            </p>

            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Nos garanties">
              {[
                { label: 'Débité après validation', Icon: ShieldIcon },
                { label: 'Tarif fixe 25 €/h', Icon: TagIcon },
                { label: 'Intervenants vérifiés', Icon: BadgeIcon },
                { label: 'Assurance RC Pro', Icon: UmbrellaIcon },
              ].map(({ label, Icon }) => (
                <li key={label} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-semibold">
                  <Icon className="h-4 w-4 text-plaster" />
                  {label}
                </li>
              ))}
            </ul>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <AccessCard
                href="/client/dashboard"
                title="Je suis un particulier"
                text="J’ai un truc à réparer aujourd’hui."
                tone="light"
              />
              <AccessCard
                href="/handyman/dashboard"
                title="Je suis intervenant"
                text="Mes heures libres deviennent des revenus."
                tone="dark"
              />
            </div>
          </div>

          <WorkOrder rating={rating} />
        </section>

        <section className="border-y border-line bg-white" aria-labelledby="benefits-title">
          <div className="mx-auto max-w-[1200px] px-5 py-16 lg:px-10 lg:py-20">
            <h2 id="benefits-title" className="display max-w-[30rem] text-3xl lg:text-[2.6rem]">Simple pour ceux qui réparent comme pour ceux qui font réparer.</h2>
            <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-16">
              <BenefitColumn title="Pour les particuliers" items={CLIENT_BENEFITS} cta={{ href: '/reserver', label: 'Réserver une intervention' }} />
              <BenefitColumn title="Pour les intervenants" items={PRO_BENEFITS} cta={{ href: '/handyman/dashboard', label: 'Proposer mes services' }} />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-5 py-12 lg:px-10">
          <div className="flex flex-col gap-4 rounded-[24px] bg-ink p-7 text-white md:flex-row md:items-center md:justify-between lg:p-9">
            <div>
              <p className="display text-2xl">Le prix, sans astérisque.</p>
              <p className="mt-2 max-w-[40rem] text-white/75">
                25 €/h de main-d’œuvre, 1 h minimum. Le matériel acheté sur place est refacturé au prix du ticket, sans commission.
                Le détail des frais, côté particulier comme côté intervenant, est public.
              </p>
            </div>
            <Link href="/pricing" className="btn-primary shrink-0 md:w-auto md:px-7">Voir le détail des tarifs</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-10 pb-[calc(env(safe-area-inset-bottom)+40px)] lg:flex-row lg:items-start lg:justify-between lg:px-10">
          <div className="max-w-[26rem]">
            <p className="display text-lg">{APP_NAME}</p>
            <p className="mt-2 text-sm text-mute">
              Place de marché de petits travaux le jour même. Gros œuvre, gaz, tableau électrique et travaux en hauteur ne sont pas proposés.
            </p>
          </div>
          <nav aria-label="Informations légales" className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:flex sm:flex-wrap sm:gap-x-6">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="font-semibold text-mute underline-offset-4 hover:text-ink hover:underline">{l.label}</Link>
            ))}
          </nav>
        </div>
        <p className="mx-auto max-w-[1200px] px-5 pb-8 text-xs text-mute lg:px-10">© {new Date().getFullYear()} {APP_NAME}</p>
      </footer>
    </div>
  )
}

function AccessCard({ href, title, text, tone }: { href: string; title: string; text: string; tone: 'light' | 'dark' }) {
  const styles = tone === 'light' ? 'bg-hiviz text-ink hover:bg-[#EDBD00]' : 'bg-ink text-white hover:bg-[#2A3747]'
  return (
    <Link href={href} className={`group flex min-h-[124px] flex-col justify-between rounded-[22px] p-5 lg:p-6 transition-[background-color,transform] active:scale-[0.98] ${styles}`}>
      <span className="display block text-[1.3rem] leading-tight">{title}</span>
      <span className="mt-4 flex items-end justify-between gap-3">
        <span className={`text-[15px] ${tone === 'dark' ? 'text-white/75' : ''}`}>{text}</span>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 transition-transform group-hover:translate-x-1">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  )
}

function WorkOrder({ rating }: { rating: { avg: number; count: number } | null }) {
  const today = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(new Date())
  return (
    <aside aria-label="Services pris en charge" className="relative">
      <div className="overflow-hidden rounded-[28px] border border-line bg-white shadow-[0_24px_60px_-28px_rgba(29,39,51,0.35)]">
        <div className="tape h-7" aria-hidden />
        <div className="p-5 sm:p-8">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-lg font-bold">Bon d’intervention</p>
            <p className="text-sm text-mute first-letter:uppercase">{today}</p>
          </div>

          <ul className="mt-6 divide-y divide-line">
            {SERVICES.map(({ name, examples, Icon }) => (
              <li key={name} className="flex items-center gap-3 py-4 first:pt-0 sm:gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-concrete text-ink sm:h-12 sm:w-12 sm:rounded-[14px]">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{name}</span>
                  <span className="block text-sm text-mute">{examples}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-bold tabular-nums">25 €/h</span>
                  <span className="hidden text-xs text-mute sm:block">+ 20 % de frais</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-sm text-mute">Aussi : sols et parquet.<span className="sm:hidden"> Tarifs de main-d’œuvre, + 20 % de frais de service.</span></p>

          <div className="my-6 border-t-2 border-dashed border-line" aria-hidden />

          {rating ? (
            <div className="flex items-center gap-5">
              <p className="display text-5xl tabular-nums">{rating.avg.toFixed(1).replace('.', ',')}</p>
              <div>
                <Stars value={rating.avg} />
                <p className="mt-1 text-sm text-mute">Note moyenne des intervenants, sur {rating.count} avis vérifiés après paiement.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-5">
              <p className="display text-5xl tabular-nums">4/5</p>
              <div>
                <p className="font-bold">Note minimale exigée</p>
                <p className="mt-1 text-sm text-mute">Chaque avis vient d’une intervention payée. Sous 4/5 de moyenne, un intervenant est suspendu.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

function BenefitColumn({ title, items, cta }: {
  title: string
  items: { title: string; text: string; Icon: (p: { className?: string }) => React.ReactElement }[]
  cta: { href: string; label: string }
}) {
  return (
    <div>
      <h3 className="text-xl font-bold">{title}</h3>
      <ul className="mt-6 space-y-6">
        {items.map(({ title: t, text, Icon }) => (
          <li key={t} className="flex gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-concrete text-plaster">
              <Icon className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-bold">{t}</span>
              <span className="mt-0.5 block text-mute">{text}</span>
            </span>
          </li>
        ))}
      </ul>
      <Link href={cta.href} className="mt-7 inline-flex font-semibold text-plaster underline underline-offset-4 hover:text-ink">{cta.label}</Link>
    </div>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5 text-[#C99F00]" aria-label={`${value.toFixed(1)} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width="18" height="18" viewBox="0 0 24 24" fill={n <= Math.round(value) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  )
}

/* Icônes au trait, dessinées pour le site */
type IconProps = { className?: string }
const svg = (className: string | undefined, children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    {children}
  </svg>
)
function DropIcon({ className }: IconProps) { return svg(className, <><path d="M12 3c3.5 4.2 6 7.4 6 10.6A6 6 0 0 1 6 13.6C6 10.4 8.5 7.2 12 3z" /><path d="M9.5 14.5a2.6 2.6 0 0 0 2.5 2.4" /></>) }
function DrillIcon({ className }: IconProps) { return svg(className, <><path d="M4 7h11l2 2.5L15 12H4z" /><path d="M17 9.5h4" /><path d="M7 12l-1.5 8h4L11 12" /></>) }
function BulbIcon({ className }: IconProps) { return svg(className, <><path d="M9 17h6M10 20.5h4" /><path d="M12 3.5a5.5 5.5 0 0 0-3.2 10c.8.6 1.2 1.4 1.2 2.3V17h4v-1.2c0-.9.4-1.7 1.2-2.3A5.5 5.5 0 0 0 12 3.5z" /></>) }
function ShieldIcon({ className }: IconProps) { return svg(className, <><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>) }
function TagIcon({ className }: IconProps) { return svg(className, <><path d="M3 12V4h8l9.5 9.5-8 8z" /><circle cx="7.5" cy="8.5" r="1.4" /></>) }
function ClockIcon({ className }: IconProps) { return svg(className, <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>) }
function BadgeIcon({ className }: IconProps) { return svg(className, <><circle cx="12" cy="9" r="5.5" /><path d="M9.5 9l1.8 1.8L14.8 7.3" /><path d="M8.5 13.8L7 21l5-2.5 5 2.5-1.5-7.2" /></>) }
function UmbrellaIcon({ className }: IconProps) { return svg(className, <><path d="M3 12a9 9 0 0 1 18 0z" /><path d="M12 12v6.5a2 2 0 0 1-4 0" /></>) }
function CoinsIcon({ className }: IconProps) { return svg(className, <><ellipse cx="9" cy="7" rx="5.5" ry="2.5" /><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7" /><path d="M9.5 16.3c.8.1 1.6.2 2.5.2 3 0 5.5-1.1 5.5-2.5" /><path d="M3.5 11v4c0 1.4 2.5 2.5 5.5 2.5" /><path d="M17.5 10v8c0 1.4-2.5 2.5-5.5 2.5" /></>) }
function SlidersIcon({ className }: IconProps) { return svg(className, <><path d="M5 4v16M12 4v16M19 4v16" /><circle cx="5" cy="15" r="2" fill="currentColor" /><circle cx="12" cy="8" r="2" fill="currentColor" /><circle cx="19" cy="13" r="2" fill="currentColor" /></>) }
function ReceiptIcon({ className }: IconProps) { return svg(className, <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>) }
