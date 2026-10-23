import Link from 'next/link'

export default function LegalFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`text-center text-xs text-mute ${className}`}>
      <nav aria-label="Informations légales" className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        <Link href="/mentions-legales" className="underline-offset-4 hover:underline">Mentions légales</Link>
        <Link href="/conditions" className="underline-offset-4 hover:underline">CGU et CGV</Link>
        <Link href="/confidentialite" className="underline-offset-4 hover:underline">Confidentialité</Link>
      </nav>
    </footer>
  )
}
