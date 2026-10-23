// Textes juridiques. À FAIRE VALIDER PAR UN AVOCAT avant la mise en ligne.
// Complétez COMPANY : toute valeur entre crochets s'affiche surlignée en jaune.

export const TERMS_VERSION = '2026-10-22'

export const COMPANY = {
  "societe": "[Raison sociale]",
  "forme": "[SAS / SASU / SARL]",
  "capital": "[montant] €",
  "rcs": "RCS [ville] [numéro SIREN]",
  "siege": "[adresse du siège social]",
  "tva": "[numéro de TVA intracommunautaire]",
  "email": "[contact@votre-domaine.fr]",
  "telephone": "[numéro de téléphone]",
  "directeur": "[prénom et nom du directeur de la publication]",
  "mediateur": "[nom du médiateur de la consommation, adresse et site internet]",
  "assureur": "[nom de l’assureur]",
  "contrat": "[numéro de contrat RC Pro]",
  "plafond": "[plafond de garantie par sinistre]",
  "dpo": "[adresse e-mail dédiée aux données personnelles]",
  "regime_tva": "[TVA applicable ou mention « TVA non applicable, art. 293 B du CGI »]",
  "delai_litige": "[2] jours ouvrés",
  "frais_annulation": "[à définir, par exemple 10 € après acceptation par un intervenant]"
} as const

export type LegalSection = { h: string; p: (string | string[])[] }
export type LegalDoc = { title: string; sections: LegalSection[] }

export const LEGAL_DOCS: Record<'mentions' | 'conditions' | 'confidentialite', LegalDoc> = {
  "mentions": {
    "title": "Mentions légales",
    "sections": [
      {
        "h": "Éditeur du service",
        "p": [
          "Le service Bricojour est édité par {{societe}}, {{forme}} au capital de {{capital}}, immatriculée au {{rcs}}, dont le siège social est situé {{siege}}.",
          "Numéro de TVA intracommunautaire : {{tva}}.",
          "Contact : {{email}}, {{telephone}}.",
          "Directeur de la publication : {{directeur}}."
        ]
      },
      {
        "h": "Hébergement",
        "p": [
          "Application hébergée par Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis.",
          "Base de données et fichiers hébergés par Supabase Inc., sur des serveurs situés dans l’Union européenne.",
          "Paiements traités par Stripe Payments Europe, Limited, 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Irlande."
        ]
      },
      {
        "h": "Médiation de la consommation",
        "p": [
          "En cas de litige non résolu avec notre service client, vous pouvez saisir gratuitement le médiateur de la consommation : {{mediateur}}."
        ]
      },
      {
        "h": "Propriété intellectuelle",
        "p": [
          "La marque, le logo, les textes et l’interface de Bricojour sont protégés. Toute reproduction sans autorisation écrite est interdite. Les photos déposées par les utilisateurs restent leur propriété ; ils nous autorisent à les utiliser uniquement pour le fonctionnement du service."
        ]
      }
    ]
  },
  "conditions": {
    "title": "Conditions générales d’utilisation et de vente",
    "sections": [
      {
        "h": "1. Objet",
        "p": [
          "Bricojour met en relation des particuliers (les clients) avec des bricoleurs indépendants vérifiés (les intervenants) pour de petits travaux réalisés le jour même. Les présentes conditions s’appliquent à toute utilisation du service et à toute réservation.",
          "Bricojour est une place de marché : elle met en relation clients et intervenants et facilite le paiement entre eux. La prestation de travaux est réalisée par l’intervenant. Bricojour n’effectue aucune déclaration fiscale ou sociale pour le compte de ses utilisateurs, qui restent chacun responsables de leurs propres obligations."
        ]
      },
      {
        "h": "2. Comment les missions sont proposées",
        "p": [
          "Une demande est envoyée aux intervenants qui remplissent toutes ces conditions : identité vérifiée, catégorie de travaux débloquée, disponibilité déclarée et adresse dans leur zone d’intervention. La mission est attribuée au premier intervenant qui l’accepte.",
          "Aucun intervenant ne paie pour être mieux placé. Le classement ne dépend d’aucune rémunération."
        ]
      },
      {
        "h": "3. Travaux proposés",
        "p": [
          "Seuls ces petits travaux à bas risque peuvent être réservés :",
          [
            "Sols et parquet : lame décollée, plinthes, petite réparation.",
            "Plomberie de surface : joint, siphon, flexible, robinet.",
            "Fixation et montage : meuble, étagère, tringle, support TV.",
            "Électricité cosmétique : luminaire, prise, interrupteur remplacé à l’identique."
          ],
          "Le gros œuvre, le gaz, le tableau électrique et les travaux en hauteur sont exclus. L’intervenant peut refuser sur place un travail qui sort de ce cadre ou présente un risque."
        ]
      },
      {
        "h": "4. Prix",
        "p": [
          "Main-d’œuvre : 25 € de l’heure, décomptée au quart d’heure, avec un minimum facturé d’une heure par intervention.",
          "Frais de service et de mise en relation : 20 % du montant de la main-d’œuvre, ajoutés au prix payé par le client.",
          "Commission de service Bricojour : 20 % du montant de la main-d’œuvre, retenus sur la somme reversée à l’intervenant.",
          "Matériel imprévu : le matériel acheté par l’intervenant pendant l’intervention est refacturé au prix exact du ticket, sans frais, sur présentation d’une photo du justificatif.",
          "{{regime_tva}}."
        ]
      },
      {
        "h": "5. Réservation et paiement",
        "p": [
          "À la réservation, un montant maximum est bloqué sur votre carte bancaire : durée maximale de la catégorie, frais compris, plus une marge pour le matériel imprévu. Ce montant n’est pas débité.",
          "Seul le montant réel est débité, au moment où vous validez la fin de l’intervention. Le reste de l’empreinte est libéré automatiquement.",
          "Si aucun intervenant n’accepte votre demande dans les 4 heures, elle est annulée et votre carte est libérée sans frais.",
          "Les paiements sont traités par Stripe. Bricojour n’a jamais accès à votre numéro de carte."
        ]
      },
      {
        "h": "6. Fin d’intervention et validation",
        "p": [
          "En fin de chantier, l’intervenant indique le temps réellement passé et, le cas échéant, le matériel imprévu avec sa photo. Vous recevez un récapitulatif.",
          "Glisser pour payer vaut acceptation de l’ensemble du récapitulatif, matériel compris. Les lignes de matériel ne peuvent pas être refusées une par une.",
          "En cas de désaccord, utilisez « Signaler un problème » au lieu de valider. Le paiement reste bloqué et notre équipe vous répond sous {{delai_litige}}."
        ]
      },
      {
        "h": "7. Annulation et droit de rétractation",
        "p": [
          "Vous pouvez annuler gratuitement tant qu’aucun intervenant n’a accepté votre demande. Après acceptation, des frais d’annulation peuvent s’appliquer : {{frais_annulation}}.",
          "Vous disposez en principe d’un délai de rétractation de 14 jours. En réservant, vous demandez expressément que l’intervention ait lieu le jour même, avant la fin de ce délai.",
          "Une fois l’intervention entièrement réalisée, vous ne pouvez plus exercer ce droit (article L221-28 du Code de la consommation). Si vous vous rétractez pendant l’intervention, seule la partie déjà réalisée est due (article L221-25)."
        ]
      },
      {
        "h": "8. Engagements du client",
        "p": [
          "Vous décrivez le problème de façon exacte, donnez accès au lieu d’intervention à l’heure prévue et garantissez des conditions de travail sûres. Vous êtes présent ou représenté par une personne majeure pendant l’intervention."
        ]
      },
      {
        "h": "9. Intervenants",
        "p": [
          "Pour recevoir des missions, l’intervenant fait vérifier son identité et ses coordonnées bancaires par Stripe et dépose au moins deux photos de réalisations par catégorie. Bricojour examine ces photos avant de débloquer la catégorie.",
          "L’intervenant est libre de se déclarer disponible ou non et d’accepter ou de refuser chaque mission, sans exclusivité ni obligation de volume.",
          "L’intervenant est seul responsable de ses obligations fiscales et sociales : il s’engage, lors de son inscription, à déclarer les revenus perçus via la plateforme conformément à la réglementation en vigueur (informations sur impots.gouv.fr et urssaf.fr). Bricojour ne réalise aucune déclaration pour son compte et ne demande pas de numéro SIRET pour s’inscrire.",
          "Comme la loi l’impose aux plateformes (article 242 bis du Code général des impôts), Bricojour informe l’intervenant de ses obligations, lui adresse chaque année un récapitulatif des sommes perçues et transmet ce récapitulatif à l’administration fiscale.",
          "Le versement intervient par Stripe après validation du client : main-d’œuvre facturée moins la commission de service Bricojour (20 %), plus la totalité du matériel imprévu.",
          "Un compte est suspendu automatiquement si la note moyenne passe sous 4 sur 5, à partir de cinq avis reçus. L’intervenant peut contester cette suspension auprès de {{email}}."
        ]
      },
      {
        "h": "10. Avis",
        "p": [
          "Seuls le client et l’intervenant d’une mission terminée peuvent laisser un avis sur cette mission, une seule fois. Les avis ne sont pas modérés avant publication ; ils peuvent être retirés s’ils sont injurieux, diffamatoires ou sans lien avec la mission."
        ]
      },
      {
        "h": "11. Assurance",
        "p": [
          "Les interventions réservées sur Bricojour sont couvertes par une assurance responsabilité civile professionnelle souscrite auprès de {{assureur}}, contrat n° {{contrat}}, dans la limite de {{plafond}}. Tout dommage doit être signalé à {{email}} dans les 48 heures."
        ]
      },
      {
        "h": "12. Messagerie",
        "p": [
          "Une messagerie s’ouvre entre le client et l’intervenant dès l’acceptation de la mission. Elle se ferme 48 heures après la fin de l’intervention. N’y échangez pas de coordonnées bancaires."
        ]
      },
      {
        "h": "13. Responsabilité",
        "p": [
          "L’intervenant est responsable de la bonne exécution des travaux. Bricojour est responsable du bon fonctionnement de la mise en relation et du paiement. Bricojour ne pourra être tenue responsable d’une indisponibilité temporaire du service due à une maintenance ou à un cas de force majeure."
        ]
      },
      {
        "h": "14. Modification des conditions",
        "p": [
          "Ces conditions peuvent évoluer. La version applicable est celle acceptée au moment de la réservation. Toute modification importante est signalée dans l’application."
        ]
      },
      {
        "h": "15. Litiges",
        "p": [
          "Les présentes conditions sont soumises au droit français. En cas de litige, contactez d’abord {{email}}. À défaut de solution, vous pouvez saisir gratuitement le médiateur de la consommation : {{mediateur}}."
        ]
      }
    ]
  },
  "confidentialite": {
    "title": "Politique de confidentialité",
    "sections": [
      {
        "h": "Responsable du traitement",
        "p": [
          "{{societe}}, {{siege}}. Pour toute question sur vos données : {{dpo}}."
        ]
      },
      {
        "h": "Données collectées",
        "p": [
          [
            "Compte : adresse e-mail, nom, téléphone.",
            "Demande d’intervention : adresse, position GPS de l’adresse, description et photos du problème.",
            "Intervenants : identité et coordonnées bancaires (vérifiées et conservées par Stripe), photos de réalisations, point de départ et zone d’intervention, disponibilité.",
            "Échanges : messages et photos envoyés dans la messagerie, avis.",
            "Paiement : référence de transaction. Votre numéro de carte est traité uniquement par Stripe.",
            "Notifications : identifiant technique de l’appareil si vous activez les alertes."
          ]
        ]
      },
      {
        "h": "Pourquoi et sur quelle base",
        "p": [
          [
            "Exécuter le service que vous demandez (mise en relation, paiement, messagerie) : contrat.",
            "Tenir la comptabilité et transmettre à l’administration fiscale les informations que la loi impose aux plateformes : obligation légale.",
            "Prévenir la fraude, assurer la sécurité et la qualité du service, y compris la suspension des comptes mal notés : intérêt légitime.",
            "Envoyer des notifications et utiliser votre position : consentement, retirable à tout moment dans les réglages de votre appareil."
          ]
        ]
      },
      {
        "h": "Qui reçoit vos données",
        "p": [
          "L’intervenant qui accepte votre mission reçoit votre nom, l’adresse exacte et les photos. Avant acceptation, les intervenants alertés ne voient que le code postal, la ville et la distance.",
          "Nos prestataires techniques : Stripe (paiement et vérification d’identité), Supabase (base de données), Vercel (hébergement). Notre assureur en cas de sinistre. L’administration fiscale, pour les seules informations que la loi impose aux plateformes de transmettre (article 242 bis du CGI).",
          "Certains prestataires sont établis aux États-Unis. Les transferts sont encadrés par les clauses contractuelles types de la Commission européenne ou le Data Privacy Framework."
        ]
      },
      {
        "h": "Durée de conservation",
        "p": [
          [
            "Compte : tant qu’il est actif, puis 3 ans après la dernière connexion.",
            "Messages de la messagerie : 12 mois après la fermeture de la conversation.",
            "Photos des demandes et justificatifs de matériel : 3 ans, pour le traitement d’éventuels litiges.",
            "Pièces comptables et données de facturation : 10 ans (obligation légale)."
          ]
        ]
      },
      {
        "h": "Vos droits",
        "p": [
          "Vous pouvez accéder à vos données, les rectifier, les effacer, en limiter l’utilisation, vous y opposer ou les récupérer dans un format lisible. Écrivez à {{dpo}}. Nous répondons sous un mois.",
          "Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (cnil.fr)."
        ]
      },
      {
        "h": "Cookies et stockage local",
        "p": [
          "Bricojour utilise uniquement des cookies nécessaires à la connexion à votre compte, et un stockage local pour retenir si vous avez fermé la proposition d’installation. Aucun cookie publicitaire ni de mesure d’audience n’est déposé, c’est pourquoi aucune bannière de consentement ne s’affiche."
        ]
      },
      {
        "h": "Sécurité",
        "p": [
          "Les échanges sont chiffrés. L’accès aux données est limité par des règles strictes : chacun ne voit que ce qui concerne ses propres missions."
        ]
      }
    ]
  }
}
