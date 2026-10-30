export const APP_NAME = 'Bricojour'
/** Commission prélevée sur la main-d'œuvre de l'intervenant (−20 %). */
export const PLATFORM_FEE_RATE = 0.2
/** Frais ajoutés au client, sur la main-d'œuvre uniquement. */
export const CLIENT_FEE_RATE = 0.2
/** Libellé côté client (+20 %). */
export const CLIENT_FEE_LABEL = 'Frais de service et de mise en relation'
/** Libellé côté intervenant (−20 %). Ne jamais afficher les frais client à l'intervenant. */
export const PROVIDER_FEE_LABEL = 'Commission de service Bricojour'
/**
 * Ventilation INTERNE de la marge plateforme (comptabilité uniquement, jamais affichée) :
 * chaque prélèvement de 20 % = 10 % frais de connexion / mise en relation
 * + 10 % facilitation administrative. Le matériel n'entre jamais dans la marge.
 */
export const INTERNAL_MARGIN_SPLIT = { connection: 0.5, adminFacilitation: 0.5 } as const
/** Matériel imprévu maximum pré-autorisé sur la carte en plus des heures. */
export const MATERIAL_MAX_CENTS = 5000
/** Nombre maximum de lignes "Matériel imprévu" par mission. */
export const MAX_EXPENSES = 10
/** Au-delà, une demande sans intervenant est annulée et la carte libérée. */
export const SEARCH_TIMEOUT_HOURS = 4
/** Géocodeur officiel (Base Adresse Nationale, Géoplateforme IGN). */
export const GEOCODER_URL = 'https://data.geopf.fr/geocodage'
