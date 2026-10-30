import { redirect } from 'next/navigation'

/** Ancienne adresse : redirige vers /auth/login en gardant les paramètres. */
export default async function Connexion({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const qs = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === 'string')).toString()
  redirect(`/auth/login${qs ? `?${qs}` : ''}`)
}
