import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'
import { errorMessage, json } from '@/lib/http'
import { TERMS_VERSION } from '@/lib/legal'

/** Crée (si besoin) le compte Stripe Connect Express de l'intervenant et renvoie le lien de vérification. */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ message: 'Session expirée.' }, 401)

  const body = await req.json().catch(() => ({}))
  if (body.acceptTerms !== true) return json({ message: 'Acceptez les conditions générales pour continuer.' }, 400)
  if (body.acceptIncomeDeclaration !== true) return json({ message: 'Engagez-vous à déclarer vos revenus pour continuer.' }, 400)

  const admin = createAdminClient()
  const now = new Date().toISOString()
  await admin.from('users').update({ terms_version: TERMS_VERSION, terms_accepted_at: now, income_declaration_accepted_at: now }).eq('id', user.id)
  const { data: me } = await admin.from('users').select('role, stripe_account_id, full_name').eq('id', user.id).single()
  if (me?.role !== 'worker') return json({ message: 'Réservé aux intervenants.' }, 403)

  try {
    const stripe = getStripe()
    let account = me.stripe_account_id as string | null
    if (!account) {
      const a = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
        email: user.email,
        business_type: 'individual',
        capabilities: { transfers: { requested: true } },
        business_profile: { product_description: 'Petits travaux et dépannage à domicile' },
        metadata: { user_id: user.id },
      })
      account = a.id
      await admin.from('users').update({ stripe_account_id: account, kyc_status: 'pending' }).eq('id', user.id)
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin
    const link = await stripe.accountLinks.create({
      account,
      type: 'account_onboarding',
      refresh_url: `${origin}/pro/inscription`,
      return_url: `${origin}/pro/inscription`,
    })
    return json({ url: link.url })
  } catch (e) {
    return json({ message: errorMessage(e) }, 502)
  }
}
