import type { HomeCopy } from "./types";

/** Locale patch — any omitted nested field falls back to English. */
export type HomeCopyPatch = {
  [K in keyof HomeCopy]?: K extends "pricing"
    ? Omit<Partial<HomeCopy["pricing"]>, "plans"> & {
        plans?: {
          [P in keyof HomeCopy["pricing"]["plans"]]?: Partial<
            HomeCopy["pricing"]["plans"][P]
          >;
        };
      }
    : HomeCopy[K] extends readonly unknown[]
      ? HomeCopy[K]
      : HomeCopy[K] extends object
        ? Partial<HomeCopy[K]>
        : HomeCopy[K];
};

export function mergeHomeCopy(base: HomeCopy, patch: HomeCopyPatch): HomeCopy {
  const pricingPatch = patch.pricing;
  return {
    ...base,
    ...patch,
    howItWorksSteps: patch.howItWorksSteps ?? base.howItWorksSteps,
    features: patch.features ?? base.features,
    testimonials: patch.testimonials ?? base.testimonials,
    heroMetrics: patch.heroMetrics ?? base.heroMetrics,
    reportSlideNames: patch.reportSlideNames ?? base.reportSlideNames,
    enquiry: { ...base.enquiry, ...patch.enquiry },
    pricingComparison: {
      ...base.pricingComparison,
      ...patch.pricingComparison,
    },
    pricing: {
      ...base.pricing,
      ...pricingPatch,
      plans: {
        agency_plus: {
          ...base.pricing.plans.agency_plus,
          ...pricingPatch?.plans?.agency_plus,
          features:
            pricingPatch?.plans?.agency_plus?.features ??
            base.pricing.plans.agency_plus.features,
        },
        starter: {
          ...base.pricing.plans.starter,
          ...pricingPatch?.plans?.starter,
          features:
            pricingPatch?.plans?.starter?.features ??
            base.pricing.plans.starter.features,
        },
        professional: {
          ...base.pricing.plans.professional,
          ...pricingPatch?.plans?.professional,
          features:
            pricingPatch?.plans?.professional?.features ??
            base.pricing.plans.professional.features,
        },
      },
    },
  };
}
