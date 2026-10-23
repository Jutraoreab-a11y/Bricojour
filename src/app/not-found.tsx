import Link from 'next/link'
import Page from '@/components/Page'

export default function NotFound() {
  return (
    <Page>
      <h1 className="display text-4xl">Page introuvable</h1>
      <p className="mt-3 text-mute">Ce lien ne mène nulle part, ou vous n’avez pas accès à cette mission.</p>
      <Link href="/" className="btn-primary mt-6">Retour à l’accueil</Link>
    </Page>
  )
}
