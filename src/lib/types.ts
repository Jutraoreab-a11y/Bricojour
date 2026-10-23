export type MissionStatus =
  | 'pending_payment'
  | 'searching'
  | 'matched'
  | 'in_progress'
  | 'awaiting_validation'
  | 'completed'
  | 'cancelled'
  | 'disputed'

export type Category = {
  id: number
  slug: string
  name: string
  description: string | null
  excluded_work: string | null
  hourly_rate_cents: number
  max_hours: number
  min_billed_hours: number
  is_active: boolean
  sort_order: number
}

export type Mission = {
  id: string
  client_id: string
  worker_id: string | null
  category_id: number
  title: string
  description: string | null
  address: string
  photo_paths: string[]
  scheduled_date: string
  slot: 'asap' | 'morning' | 'afternoon' | 'evening'
  status: MissionStatus
  hourly_rate_cents: number
  estimated_hours: number
  actual_hours: number | null
  billed_hours: number | null
  min_billed_hours: number
  area_label: string | null
  material_cents: number
  material_photo_path: string | null
  material_status: 'none' | 'pending' | 'approved' | 'rejected'
  labor_cents: number
  platform_fee_cents: number
  worker_payout_cents: number
  authorized_amount_cents: number | null
  stripe_payment_intent_id: string | null
  stripe_transfer_id: string | null
  created_at: string
  matched_at: string | null
  started_at: string | null
  finished_at: string | null
  validated_at: string | null
  categories?: { name: string; max_hours: number } | null
}

export type PublicProfile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  rating_avg: number
  rating_count: number
}

export type Expense = {
  id: string
  mission_id: string
  label: string
  amount_cents: number
  photo_path: string
  status: 'pending' | 'approved' | 'rejected'
}

/** Montants côté client, lus via mission_client_amounts() (jamais exposés à l'intervenant). */
export type ClientAmounts = {
  labor_cents: number
  client_fee_cents: number
  materials_cents: number
  client_total_cents: number
}

export type ChatMessage = {
  id: string
  chat_id: string
  sender_id: string
  body: string | null
  photo_path: string | null
  created_at: string
}
