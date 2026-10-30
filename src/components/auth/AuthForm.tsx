'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'signup'
type Role = 'client' | 'worker'

const supabaseReady = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** Connexion et inscription sans mot de passe (lien envoyé par e-mail). */
export default function AuthForm({ mode, next, initialRole, linkError }: {
  mode: Mode
  next?: string
  initialRole: Role
  linkError?: boolean
}) {
  const [role, setRole] = useState<Role>(initialRole)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(linkError ? 'Ce lien a expiré. Demandez-en un nouveau.' : '')
  const [unknownEmail, setUnknownEmail] = useState(false)

  const isSignup = mode === 'signup'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setUnknownEmail(false)
    if (!supabaseReady()) { setError('La connexion n’est pas encore configurée sur cet environnement.'); return }
    setBusy(true)
    const fallback = role === 'worker' ? '/handyman/dashboard' : '/client/dashboard'
    const target = next?.startsWith('/') ? next : fallback
    const { error: err } = await createClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`,
        shouldCreateUser: isSignup,
        data: isSignup ? { role, full_name: name.trim() || undefined } : undefined,
      },
    })
    setBusy(false)
    if (!err) { setSent(true); return }
    if (!isSignup && /signups? not allowed|not found|user/i.test(err.message)) setUnknownEmail(true)
    else setError('Envoi impossible. Vérifiez l’adresse e-mail.')
  }

  if (sent) {
    return (
      <div className="sheet mt-6">
        <h1 className="display text-3xl">Regardez vos e-mails</h1>
        <p className="mt-3 text-mute">
          Nous avons envoyé un lien {isSignup ? 'pour activer votre compte' : 'de connexion'} à <strong className="text-ink">{email}</strong>. Ouvrez-le sur cet appareil.
        </p>
        <button className="mt-4 text-sm font-semibold text-plaster" onClick={() => setSent(false)}>Changer d’adresse</button>
      </div>
    )
  }

  const switchHref = `${isSignup ? '/auth/login' : '/auth/signup'}${next ? `?next=${encodeURIComponent(next)}` : ''}`

  return (
    <form onSubmit={submit} className="mt-2">
      <h1 className="display text-4xl">{isSignup ? 'Créer un compte' : 'Connexion'}</h1>
      <p className="mt-2 text-mute">Sans mot de passe : un lien arrive par e-mail.</p>

      {isSignup && (
        <>
          <fieldset className="mt-6 grid grid-cols-2 gap-2 rounded-[14px] bg-white p-1">
            <legend className="sr-only">Je suis</legend>
            {(['client', 'worker'] as const).map((r) => (
              <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)}
                className={`rounded-[10px] py-3 text-sm font-bold ${role === r ? 'bg-ink text-white' : 'text-mute'}`}>
                {r === 'client' ? 'Je suis un particulier' : 'Je suis intervenant'}
              </button>
            ))}
          </fieldset>

          <label htmlFor="name" className="label mt-5">Prénom et nom</label>
          <input id="name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </>
      )}

      <label htmlFor="email" className="label mt-4">Adresse e-mail</label>
      <input id="email" type="email" required className="field" autoComplete="email" inputMode="email"
        value={email} onChange={(e) => { setEmail(e.target.value); setUnknownEmail(false) }} />

      {error && <p className="error">{error}</p>}
      {unknownEmail && (
        <p className="error">
          Aucun compte avec cette adresse. <Link href={switchHref} className="underline">Créer un compte</Link>
        </p>
      )}
      <button className="btn-primary mt-6" disabled={busy || !email}>
        {busy ? 'Envoi…' : isSignup ? 'Créer mon compte' : 'Recevoir le lien de connexion'}
      </button>

      <p className="mt-4 text-center text-sm">
        {isSignup ? 'Déjà un compte ? ' : 'Pas encore de compte ? '}
        <Link href={switchHref} className="font-semibold text-plaster underline underline-offset-4">
          {isSignup ? 'Se connecter' : 'Créer un compte'}
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-mute">
        En continuant, vous acceptez les <Link href="/terms" className="underline">conditions générales</Link> et la <Link href="/privacy" className="underline">politique de confidentialité</Link>.
      </p>
    </form>
  )
}
