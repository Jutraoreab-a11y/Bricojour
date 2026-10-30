import { permanentRedirect } from 'next/navigation'

/** Ancienne adresse conservée pour les liens existants. */
export default function OldLegalPage() {
  permanentRedirect('/privacy')
}
