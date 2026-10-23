import type { MissionStatus } from './types'

export const STATUS_LABEL: Record<MissionStatus, string> = {
  pending_payment: 'Confirmation du paiement',
  searching: 'Recherche d’un intervenant',
  matched: 'Intervenant en route',
  in_progress: 'Intervention en cours',
  awaiting_validation: 'À valider',
  completed: 'Terminée',
  cancelled: 'Annulée',
  disputed: 'Contestée',
}

export const SLOT_LABEL = {
  asap: 'Dès que possible',
  morning: 'Ce matin',
  afternoon: 'Cet après-midi',
  evening: 'En soirée',
} as const

/** Étapes affichées au client, dans l'ordre. */
export const CLIENT_STEPS = ['Paiement bloqué', 'Intervenant trouvé', 'Intervention', 'Validation'] as const

export function clientStepIndex(status: MissionStatus) {
  switch (status) {
    case 'pending_payment': return -1
    case 'searching': return 0
    case 'matched': return 1
    case 'in_progress': return 2
    case 'awaiting_validation':
    case 'disputed': return 3
    case 'completed': return 4
    default: return -1
  }
}

export function statusTone(status: MissionStatus) {
  if (status === 'awaiting_validation') return 'bg-hiviz text-ink'
  if (status === 'completed') return 'bg-ok/10 text-ok'
  if (status === 'cancelled' || status === 'disputed') return 'bg-alert/10 text-alert'
  return 'bg-plaster/10 text-plaster'
}
