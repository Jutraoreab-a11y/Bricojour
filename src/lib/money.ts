import { CLIENT_FEE_RATE, PLATFORM_FEE_RATE } from './config'

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

export const formatEuros = (cents: number) => euros.format(cents / 100)

export function formatHours(h: number) {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  if (!hh && mm) return `${mm} min`
  return mm ? `${hh} h ${String(mm).padStart(2, '0')}` : `${hh} h`
}

/** Heures facturées : jamais moins que le minimum de la catégorie (1 h par défaut). */
export const billedHours = (hours: number, minHours = 1) => Math.max(hours, minHours)

/** Même arrondi que les colonnes générées en base. */
export function split(rateCents: number, hours: number, minHours = 1) {
  const labor = Math.round(rateCents * billedHours(hours, minHours))
  const fee = Math.round(labor * PLATFORM_FEE_RATE)
  return { labor, fee, net: labor - fee }
}

/** Côté client : main-d'œuvre + 20 % de frais de service (même arrondi qu'en base). */
export function clientPrice(rateCents: number, hours: number, minHours = 1) {
  const labor = Math.round(rateCents * billedHours(hours, minHours))
  const serviceFee = Math.round(labor * CLIENT_FEE_RATE)
  return { labor, serviceFee, total: labor + serviceFee }
}

/** Tarif horaire affiché au client, frais de service inclus. */
export const clientHourly = (rateCents: number) => clientPrice(rateCents, 1).total

/**
 * Partage complet d'une transaction marketplace (centimes), identique au calcul en base :
 *  - le client paie la main-d'œuvre + 20 % + le matériel au prix coûtant ;
 *  - l'intervenant reçoit la main-d'œuvre − 20 % + 100 % du matériel ;
 *  - la plateforme garde les deux 20 %, ventilés en interne moitié/moitié.
 */
export function marketplaceSplit(rateCents: number, hours: number, materialsCents = 0, minHours = 1) {
  const labor = Math.round(rateCents * billedHours(hours, minHours))
  const feeClient = Math.round(labor * CLIENT_FEE_RATE)
  const feeProvider = Math.round(labor * PLATFORM_FEE_RATE)
  const margin = feeClient + feeProvider
  const marginAdminFacilitation = Math.floor(margin / 2)
  return {
    labor,
    materials: materialsCents,
    gross: labor + feeClient + materialsCents,
    feeClient,
    feeProvider,
    payout: labor - feeProvider + materialsCents,
    margin,
    marginConnection: margin - marginAdminFacilitation,
    marginAdminFacilitation,
  }
}
