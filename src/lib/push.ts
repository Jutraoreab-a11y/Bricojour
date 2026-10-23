import 'server-only'
import webpush from 'web-push'
import { createAdminClient } from './supabase/admin'

let configured = false

export type PushPayload = { title: string; body: string; url: string }

export async function sendPush(userIds: string[], payload: PushPayload) {
  if (!userIds.length || !process.env.VAPID_PRIVATE_KEY) return
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    )
    configured = true
  }
  const admin = createAdminClient()
  const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', userIds)

  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 30, urgency: 'high' },
        )
      } catch (e: unknown) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) {
          await admin.from('push_subscriptions').delete().eq('id', s.id)
        }
      }
    }),
  )
}
