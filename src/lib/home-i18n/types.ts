export type HomeStep = { title: string; description: string };

export type HomeFeature = { title: string; description: string };

export type HomeTestimonial = {
  quote: string;
  role: string;
  company: string;
  location: string;
  agencySize?: string;
};

export type HomeMetricMock = { label: string; value: string };

export type HomePricingPlanCopy = { bestFor: string; features: string[] };

export type HomeCopy = {
  specialistTimeSavings: string;
  howItWorksTitle: string;
  howItWorksSubtitle: string;
  howItWorksSteps: HomeStep[];
  howItWorksLink: string;
  painTitle: string;
  painBody: string;
  painWithoutLabel: string;
  painWithoutCalc: string;
  painWithoutResult: string;
  painWithLabel: string;
  painWithCalc: string;
  painWithResult: string;
  featuresTitle: string;
  featuresSubtitle: string;
  features: HomeFeature[];
  trustStrip: string;
  reportPreviewTitle: string;
  reportPreviewSubtitle: string;
  reportPreviewFootnote: string;
  reportSlideNames: [string, string, string, string];
  reportPrevSlide: string;
  reportNextSlide: string;
  sampleTitle: string;
  sampleBody: string;
  sampleCta: string;
  sampleFootnote: string;
  testimonialsEyebrow: string;
  testimonialsTitle: string;
  testimonials: HomeTestimonial[];
  referTitle: string;
  referLink: string;
  whatsappTitle: string;
  whatsappLink: string;
  whatsappPrefill: string;
  referralLine: string;
  whatsappLine: string;
  leadTitle: string;
  leadBody: string;
  leadPreferEmail: string;
  leadContactLink: string;
  pricingNeedDemo: string;
  /** `{count}` is replaced with a locale-formatted number. */
  socialProofTotal: string;
  socialProofWeek: string;
  socialProofLiveHint: string;
  pricingComparison: {
    featureColumn: string;
    agencyColumn: string;
    proColumn: string;
    clientWorkspaces: string;
    agencyClients: string;
    unlimitedClients: string;
    reportGeneration: string;
    unlimitedReports: string;
    metaReporting: string;
    otherPlatforms: string;
    included: string;
    roadmapIncluded: string;
    whiteLabel: string;
    support: string;
    emailSupport: string;
    prioritySupport: string;
  };
  heroMockCampaign: string;
  heroMockWeekly: string;
  heroMetrics: HomeMetricMock[];
  enquiry: {
    namePlaceholder: string;
    emailPlaceholder: string;
    whatsappPlaceholder: string;
    messagePlaceholder: string;
    send: string;
    sending: string;
    success: string;
    error: string;
  };
  pricing: {
    billingPeriodAria: string;
    monthly: string;
    annual: string;
    mostPopular: string;
    perMonth: string;
    perYear: string;
    saveAnnual: string;
    exclGst: string;
    exclTax: string;
    payInr: string;
    payUsd: string;
    subscribeToPrefix: string;
    redirecting: string;
    plans: {
      starter: HomePricingPlanCopy;
      professional: HomePricingPlanCopy;
    };
  };
};
