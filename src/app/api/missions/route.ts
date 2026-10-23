import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe'
import { MATERIAL_MAX_CENTS } from '@/lib/config'
import { clientPrice } from '@/lib/money'
import { TERMS_VERSION } from '@/lib/legal'
import { errorMessage, json } from '@/lib/http'

const SLOTS = ['asap', 'morning', 'afternoon', 'evening']

/** Crée la mission puis une empreinte bancaire (capture manuelle) couvrant le maximum possible. */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ message: 'Connectez-vous pour réserver.' }, 401)

  const b = await req.json().catch(() => null)
  const lat = Number(b?.lat), lng = Number(b?.lng), hours = Number(b?.estimatedHours)
  if (!b || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json({ message: 'Adresse invalide.' }, 400)
  }
  if (typeof b.title !== 'string' || b.title.trim().length < 3) return json({ message: 'Décrivez le problème en quelques mots.' }, 400)
  if (!SLOTS.includes(b.slot)) return json({ message: 'Créneau invalide.' }, 400)
  if (b.acceptTerms !== true) return json({ message: 'Acceptez les conditions générales pour réserver.' }, 400)

  const { data: cat } = await supabase.from('categories').select('*').eq('id', b.categoryId).eq('is_active', true).maybeSingle()
  if (!cat) return json({ message: 'Ce type de travaux n’est pas proposé.' }, 400)

  const photoPaths = Array.isArray(b.photoPaths)
    ? b.photoPaths.filter((p: unknown) => typeof p === 'string' && p.startsWith(`${user.id}/`)).slice(0, 5)
    : []

  const { data: mission, error } = await supabase.from('missions').insert({
    client_id: user.id,
    category_id: cat.id,
    title: b.title.trim().slice(0, 120),
    description: typeof b.description === 'string' ? b.description.trim().slice(0, 2000) || null : null,
    address: String(b.address ?? '').slice(0, 300),
    location: `SRID=4326;POINT(${lng} ${lat})`,
    photo_paths: photoPaths,
    estimated_hours: hours,
    slot: b.slot,
    hourly_rate_cents: cat.hourly_rate_cents, // écrasé par le trigger : prix imposé
    terms_version: TERMS_VERSION,
    terms_accepted_at: new Date().toISOString(),
    express_execution_requested: true,
  }).select('id').single()
  if (error || !mission) return json({ message: errorMessage(error) }, 400)

  try {
    const admin = createAdminClient()
    const stripe = getStripe()
    const { data: profile } = await admin.from('users').select('stripe_customer_id, full_name').eq('id', user.id).single()
    let customer = profile?.stripe_customer_id as string | null
    if (!customer) {
      const c = await stripe.customers.create({ email: user.email, name: profile?.full_name ?? undefined, metadata: { user_id: user.id } })
      customer = c.id
      await admin.from('users').update({ stripe_customer_id: customer }).eq('id', user.id)
    }

    // Plafond : durée max de la catégorie, frais de service inclus, + matériel imprévu
    const amount = clientPrice(cat.hourly_rate_cents, Number(cat.max_hours)).total + MATERIAL_MAX_CENTS
    const pi = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      customer,
      capture_method: 'manual',
      payment_method_types: ['card'],
      transfer_group: mission.id,
      description: `Intervention ${cat.name}`,
      metadata: { mission_id: mission.id },
    }, { idempotencyKey: `mission-${mission.id}` })

    await admin.from('missions').update({ stripe_payment_intent_id: pi.id, authorized_amount_cents: amount }).eq('id', mission.id)
    return json({ missionId: mission.id, clientSecret: pi.client_secret, amount })
  } catch (e) {
    await createAdminClient().from('missions').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', mission.id)
    return json({ message: `Paiement indisponible : ${errorMessage(e)}` }, 502)
  }
}
