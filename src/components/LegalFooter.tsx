import Link from 'next/link'

export const LEGAL_LINKS = [
  { href: '/terms', label: 'CGU et CGV' },
  { href: '/privacy', label: 'Confidentialité' },
  { href: '/legal', label: 'Mentions légales' },
  { href: '/pricing', label: 'Transparence des tarifs' },
] as const

export default function LegalFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`text-center text-xs text-mute ${className}`}>
      <nav aria-label="Informations légales" className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        {LEGAL_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="underline-offset-4 hover:underline">{l.label}</Link>
        ))}
      </nav>
    </footer>
  )
}
