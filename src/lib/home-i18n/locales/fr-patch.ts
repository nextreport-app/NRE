import type { HomeCopyPatch } from "../merge";

export const FR_HOME_PATCH: HomeCopyPatch = {
  specialistTimeSavings:
    "Chaque rapport automatisé économise environ 15 à 25 minutes de travail spécialisé. Aux tarifs habituels des agences, cela libère une vraie capacité chaque mois — pas seulement un vendredi plus court.",
  howItWorksTitle: "Des rapports clients en trois étapes",
  howItWorksSubtitle: "L’assistant comporte quatre étapes détaillées — voici la version courte.",
  howItWorksSteps: [
    {
      title: "Importer le CSV",
      description:
        "Choisissez le type de rapport, exportez le CSV jour par jour depuis Meta Ads Reporting, puis importez.",
    },
    {
      title: "Confirmer et relire",
      description: "Sélectionnez les campagnes, vérifiez les objectifs et prévisualisez les métriques avant de générer.",
    },
    {
      title: "Générer et partager",
      description: "PPTX brandé, lien, Google Drive, WhatsApp ou e-mail — souvent en moins de 2 minutes.",
    },
  ],
  howItWorksLink: "Voir le parcours complet en 4 étapes →",
  painTitle: "Arrêtez de passer des heures sur le reporting chaque semaine",
  painBody:
    "Une agence digitale moyenne consacre 25 minutes par client et par semaine à télécharger les données, mettre en forme les slides et rédiger les synthèses. Avec 10 clients, c’est plus de 4 heures par semaine sans valeur stratégique. NextReport le fait en moins de 2 minutes.",
  painWithoutLabel: "Sans NextReport",
  painWithoutCalc: "10 clients × 25 minutes",
  painWithoutResult: "= plus de 4 h/semaine",
  painWithLabel: "Avec NextReport",
  painWithCalc: "10 clients × 2 minutes",
  painWithResult: "= 20 minutes/semaine",
  featuresTitle: "Tout pour de meilleurs rapports Meta",
  featuresSubtitle: "Lancement avec Meta Ads — Google Ads, TikTok et GA4 bientôt.",
  features: [
    {
      title: "Import CSV",
      description:
        "Exportez Les 30 derniers jours ou Mois précédent avec ventilation par jour depuis Ads Manager — la méthode prise en charge aujourd’hui.",
    },
    {
      title: "Comparaison mois précédent",
      description:
        "Importez un CSV du mois précédent pour afficher mois dernier vs période actuelle dans Total combiné — option à l’étape 1.",
    },
    {
      title: "Détection des objectifs",
      description:
        "Leads, achats, trafic, portée, etc. — les bonnes métriques pour chaque campagne Meta.",
    },
    {
      title: "Synthèses IA",
      description: "Chaque slide reçoit un résumé et des insights rédigés par IA — sans rédaction manuelle.",
    },
    {
      title: "Rapports comparatifs",
      description: "Comparez deux périodes campagne par campagne — cette semaine vs la précédente ou une plage personnalisée.",
    },
    {
      title: "Lien navigateur",
      description: "Vos clients ouvrent le rapport sur tout appareil — sans application PowerPoint.",
    },
    {
      title: "Reporting site GA4",
      description: "Trafic, canaux, pages d’atterrissage, appareil et géo — un deck complet de performance web.",
    },
    {
      title: "Google et TikTok Ads",
      description: "Même modèle brandé et même assistant — import CSV à l’ouverture des prochaines plateformes.",
    },
  ],
  trustStrip:
    "Chaque chiffre provient de votre compte Meta ou export CSV. Nous ne modifions jamais vos données de campagne.",
  reportPreviewTitle: "Ce que vos clients recevront",
  reportPreviewSubtitle:
    "Un PowerPoint entièrement brandé avec insights IA — généré automatiquement à partir de vos données.",
  reportPreviewFootnote: "Vos vrais rapports utiliseront vos données et l’identité de votre agence.",
  reportSlideNames: ["Synthèse campagne", "Ensemble de publicités", "Perf. MTD", "Total combiné"],
  reportPrevSlide: "Slide précédente",
  reportNextSlide: "Slide suivante",
  sampleTitle: "Voir avant de s’inscrire",
  sampleBody:
    "Téléchargez un vrai rapport NextReport — même format, mêmes insights IA, même qualité professionnelle.",
  sampleCta: "Télécharger un exemple →",
  sampleFootnote: "Sans inscription. S’ouvre dans PowerPoint ou Google Slides.",
  testimonialsEyebrow: "Premiers utilisateurs",
  testimonialsTitle: "Les agences envoient leurs rapports plus vite",
  testimonials: [
    {
      quote:
        "Nous passions une demi-journée chaque lundi à formater les rapports Meta. NextReport a réduit cela à moins de 15 minutes pour toute la base clients.",
      role: "Fondateur",
      company: "Agence performance",
      location: "Inde",
    },
    {
      quote:
        "Les synthèses IA sont vraiment utilisables — j’édite une phrase et j’envoie. Les clients voient la différence.",
      role: "Account manager",
      company: "Agence digitale boutique",
      location: "EAU",
    },
    {
      quote:
        "Export Slides plus lien : fini de courir après les téléchargements. Un lien, et c’est réglé.",
      role: "Media buyer freelance",
      company: "Consultant indépendant",
      location: "États-Unis",
    },
  ],
  referTitle: "Parrainer une agence",
  referLink: "Comment fonctionnent les parrainages →",
  whatsappTitle: "WhatsApp pour agences",
  whatsappLink: "Ouvrir WhatsApp →",
  whatsappPrefill: "Bonjour — je suis une agence qui utilise (ou teste) NextReport pour Meta.",
  referralLine:
    "Parrainez une autre agence : à leur abonnement, un mois gratuit chacun au prochain renouvellement.",
  whatsappLine:
    "Agences en Inde : contactez-nous sur WhatsApp pour l’installation, le reporting et les nouveautés.",
  leadTitle: "Posez-nous vos questions",
  leadBody: "Démo, tarifs ou fonctionnalité — laissez un message, réponse sous un jour ouvré.",
  leadPreferEmail: "Plutôt par e-mail ?",
  leadContactLink: "Formulaire de contact →",
  pricingNeedDemo: "Besoin d’une démo ? Écrivez à",
  heroMockCampaign: "Coastal Skin Co. — Génération de leads",
  heroMockWeekly: "Hebdo",
  heroMetrics: [
    { label: "Dépenses pub", value: "$480" },
    { label: "Portée", value: "40,000" },
    { label: "Impressions", value: "80,000" },
    { label: "Leads formulaire instantané", value: "120" },
    { label: "Coût par lead", value: "$4.00" },
    { label: "CTR (tous)", value: "2.00%" },
    { label: "Clics lien", value: "1,200" },
    { label: "Coût par clic", value: "$0.30" },
  ],
  enquiry: {
    namePlaceholder: "Votre nom",
    emailPlaceholder: "E-mail professionnel",
    whatsappPlaceholder: "WhatsApp (+91, +1, +44 …)",
    messagePlaceholder: "Parlez-nous de votre agence ou posez une question…",
    send: "Envoyer",
    sending: "Envoi…",
    success: "Merci — nous répondons sous un jour ouvré.",
    error: "Erreur — écrivez directement à hello@nextreport.in.",
  },
  pricing: {
    billingPeriodAria: "Période de facturation",
    monthly: "Mensuel",
    annual: "Annuel (−20 %)",
    mostPopular: "Le plus populaire",
    perMonth: "/mois",
    perYear: "/an",
    saveAnnual: "Économisez 20 % vs mensuel",
    exclGst: "Hors GST 18 %",
    exclTax: "Hors taxes",
    payInr: "Paiement sécurisé UPI, cartes, net banking",
    payUsd: "Paiement sécurisé carte crédit/débit",
    subscribeToPrefix: "S’abonner à",
    redirecting: "Redirection…",
    plans: {
      starter: {
        bestFor: "Freelances et petites agences",
        features: [
          "Jusqu’à 10 clients — Meta, Google, TikTok et GA4 inclus",
          "Génération de rapports illimitée",
          "Meta Ads — import CSV (en ligne)",
          "Google, TikTok et GA4 — bientôt",
          "Synthèses et insights IA",
          "PowerPoint, Google Slides et lien web",
          "Sauvegarde Google Drive",
          "Rapports white-label",
          "Webhooks Slack et Zapier",
          "Support e-mail sous 24 h",
        ],
      },
      professional: {
        bestFor: "Agences en croissance",
        features: [
          "Clients illimités — toutes plateformes incluses",
          "Tout le plan Agency",
          "Reporting CSV Meta pour chaque client ; plus de plateformes au lancement",
          "Rapports trimestriels, YTD et créatifs — bientôt",
          "Support e-mail prioritaire",
          "Accès anticipé aux nouveautés",
        ],
      },
    },
  },
};
