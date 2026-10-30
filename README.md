# Bricojour

PWA mobile-first de mise en relation pour petits travaux le jour même.
Next.js 15 · Tailwind · Supabase (Postgres, Auth, Realtime, Storage) · Stripe Connect · Web Push.

## Mise en route (environ 30 minutes)

1. **Supabase** : créez un projet, puis appliquez les migrations :
   `npx supabase link --project-ref <ref> && npx supabase db push`
   (ou collez les neuf fichiers de `supabase/migrations` dans le SQL Editor, dans l’ordre).
2. **Auth Supabase** : Authentication > URL Configuration, ajoutez `https://votre-domaine/auth/callback` aux Redirect URLs.
3. **Stripe** : activez Connect (comptes Express, pays FR). Créez deux webhooks vers `https://votre-domaine/api/stripe/webhook` :
   - « Votre compte » : `payment_intent.amount_capturable_updated`, `payment_intent.canceled`, `payment_intent.payment_failed` → `STRIPE_WEBHOOK_SECRET`
   - « Comptes connectés » : `account.updated` → `STRIPE_CONNECT_WEBHOOK_SECRET`
4. **Push** : `npx web-push generate-vapid-keys`, reportez les clés dans l’environnement.
5. **Variables** : copiez `.env.example` en `.env.local` et remplissez-le.
6. `npm install && npm run dev`, ou déployez sur Vercel (le cron toutes les 5 min est déclaré dans `vercel.json` ; le plan Hobby limite les crons à un par jour).
7. **Premier admin** : connectez-vous, puis dans le SQL Editor :
   `update public.users set role = 'admin' where id = (select id from auth.users where email = 'vous@exemple.fr');`

## Adresses

| Page | Accès |
|---|---|
| `/` landing | public |
| `/client/dashboard` espace particulier | public (présentation) ; un client connecté y voit ses demandes |
| `/handyman/dashboard` espace intervenant | public (présentation) ; un intervenant connecté y voit son tableau de bord |
| `/reserver` réservation | public ; connexion demandée seulement au paiement, la demande est conservée |
| `/auth/login`, `/auth/signup` | public (lien de connexion par e-mail) |
| `/pricing`, `/terms`, `/privacy`, `/legal` | public |
| `/missions/…`, `/chat/…`, `/pro/…`, `/admin` | connexion requise (`src/proxy.ts`) |

Les anciennes adresses (`/connexion`, `/conditions`, `/confidentialite`, `/mentions-legales`) redirigent vers les nouvelles.
Sans clés Supabase (tests d'interface), toutes les pages publiques fonctionnent ; les pages privées renvoient vers la connexion.

## Parcours

- **Client** : réservation en 4 étapes (catégorie, photos, adresse BAN, empreinte bancaire) → suivi en temps réel → chat → validation par glissement des heures réelles et du supplément matériel → avis.
- **Intervenant** : inscription par lien e-mail → KYC Stripe Express → 2 photos de réalisations par catégorie → validation admin → disponibilité + point de départ → alertes push → acceptation atomique (premier arrivé) → clôture (heures au quart d’heure + ticket matériel).
- **Admin** (`/admin`) : déblocage des compétences, litiges, suivi et export CSV des transactions.

## Argent

- Client : main-d’œuvre (25 €/h, 1 h minimum facturée) + 20 % + matériel accepté au prix coûtant.
- Intervenant : main-d’œuvre − 20 % + 100 % du matériel accepté.
- Libellés : côté client « Frais de service et de mise en relation (20 %) », côté intervenant « Commission de service Bricojour (20 %) ».
- L’intervenant ne peut jamais lire les frais client, ni à l’écran ni par l’API : ils ne sont plus dans la table `missions` et passent par `mission_client_amounts()` (client et admin uniquement).
- Table `transactions` (une ligne par mission validée) : `gross_amount`, `platform_fee_client`, `platform_fee_provider`, `net_provider_payout`, `materials_reimbursement`, `platform_margin`. Le client lit la vue `client_transactions`, l’intervenant la vue `provider_transactions`, chacune sans les frais de l’autre.
- Exemple 2 h : le client paie 60 €, l’intervenant reçoit 40 €, la plateforme garde 20 € (avant frais Stripe).
- Confidentialité : un intervenant alerté voit seulement « code postal + ville » (fonction `my_offers()`) ; l’adresse exacte n’apparaît qu’après acceptation.

- Empreinte bancaire à la réservation : (tarif × durée max de la catégorie) + 20 % de frais + 50 € de matériel imprévu (`MATERIAL_MAX_CENTS`).
- Matériel imprévu : jusqu’à 10 lignes par mission (libellé, montant, photo obligatoire), table `expenses_materials`. Le client ne peut pas refuser une ligne : valider accepte tout le matériel, remboursé à 100 % à l’intervenant. En cas de désaccord, il signale un problème (litige).
- Stripe Connect, modèle marketplace « charges et transferts séparés » : à la validation, capture de `gross_amount` sur le compte plateforme, puis transfert de `net_provider_payout` vers le compte Connect de l’intervenant. La marge (frais client + commission) reste sur le compte plateforme ; les frais Stripe sont pris dessus. Ce modèle est obligatoire ici car l’intervenant n’est pas connu quand la carte est bloquée.
- Le calcul du split est fait en base (colonnes générées) : une seule source de vérité.

## Automatismes

- Diffusion aux intervenants éligibles dès que la carte est validée, relancée toutes les 5 minutes.
- Annulation et libération de la carte après 4 h sans intervenant (`SEARCH_TIMEOUT_HOURS`).
- Chat fermé 48 h après la validation.
- Suspension automatique sous 4/5 de moyenne, à partir de 5 avis (`reviews_after_insert`).
- Paiements échoués rejoués par le cron.

## À faire avant la mise en production

- **Textes juridiques** : complétez `COMPANY` dans `src/lib/legal.ts` (raison sociale, SIREN, médiateur, assureur…). Les valeurs non remplies s’affichent surlignées en jaune sur `/mentions-legales`, `/conditions` et `/confidentialite`. Faites relire les trois textes par un avocat.

- **Déclarations** : Bricojour ne déclare rien pour ses utilisateurs ; chaque intervenant s’engage à l’inscription à déclarer ses revenus (`users.income_declaration_accepted_at`). La plateforme garde son obligation propre de transmission annuelle à l’administration fiscale (article 242 bis du CGI, DAC7) : l’export CSV des transactions sert de base.
- **Assurance** : la mention RC Pro est affichée au paiement ; elle suppose un contrat souscrit par la plateforme.
- **CGU, CGV, mentions légales, politique de confidentialité** (adresse et photos des clients).
- Mettre à jour `APP_NAME` dans `src/lib/config.ts` et les icônes de `public/icons`.
# Bricojour
