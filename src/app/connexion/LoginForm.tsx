'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm({ next, initialRole, linkError }: { next?: string; initialRole: 'client' | 'worker'; linkError: boolean }) {
  const [role, setRole] = useState(initialRole)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(linkError ? 'Ce lien a expiré. Demandez-en un nouveau.' : '')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    const target = next?.startsWith('/') ? next : role === 'worker' ? '/pro' : '/reserver'
    const { error: err } = await createClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`,
        data: { role, full_name: name.trim() || undefined }, // utilisé uniquement à la création du compte
      },
    })
    setBusy(false)
    if (err) setError('Envoi impossible. Vérifiez l’adresse e-mail.')
    else setSent(true)
  }

  if (sent) {
    return (
      <div className="sheet mt-6">
        <h1 className="display text-3xl">Regardez vos e-mails</h1>
        <p className="mt-3 text-mute">Nous avons envoyé un lien de connexion à <strong className="text-ink">{email}</strong>. Ouvrez-le sur ce téléphone.</p>
        <button className="mt-4 text-sm font-semibold text-plaster" onClick={() => setSent(false)}>Changer d’adresse</button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-2">
      <h1 className="display text-4xl">Connexion</h1>
      <p className="mt-2 text-mute">Sans mot de passe : un lien arrive par e-mail.</p>

      <fieldset className="mt-6 grid grid-cols-2 gap-2 rounded-[14px] bg-white p-1">
        <legend className="sr-only">Je suis</legend>
        {(['client', 'worker'] as const).map((r) => (
          <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)}
            className={`rounded-[10px] py-3 text-sm font-bold ${role === r ? 'bg-ink text-white' : 'text-mute'}`}>
            {r === 'client' ? 'J’ai besoin d’aide' : 'Je suis bricoleur'}
          </button>
        ))}
      </fieldset>
      <p className="mt-2 text-xs text-mute">Le type de compte est choisi à la première connexion.</p>

      <label htmlFor="name" className="label mt-5">Prénom et nom</label>
      <input id="name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />

      <label htmlFor="email" className="label mt-4">Adresse e-mail</label>
      <input id="email" type="email" required className="field" autoComplete="email" inputMode="email"
        value={email} onChange={(e) => setEmail(e.target.value)} />

      {error && <p className="error">{error}</p>}
      <button className="btn-primary mt-6" disabled={busy || !email}>{busy ? 'Envoi…' : 'Recevoir le lien'}</button>
      <p className="mt-3 text-center text-xs text-mute">
        En continuant, vous acceptez les <Link href="/conditions" className="underline">conditions générales</Link> et la <Link href="/confidentialite" className="underline">politique de confidentialité</Link>.
      </p>
    </form>
  )
}
