import type { HomeCopy } from "./types";

/** Locale patch — any omitted nested field falls back to English. */
export type HomeCopyPatch = {
  [K in keyof HomeCopy]?: HomeCopy[K] extends infer U
    ? U extends { starter: unknown; professional: unknown }
      ? {
          [P in keyof U]?: U[P];
        } & {
          plans?: {
            starter?: Partial<HomeCopy["pricing"]["plans"]["starter"]>;
            professional?: Partial<HomeCopy["pricing"]["plans"]["professional"]>;
          };
        }
      : U extends readonly unknown[]
        ? U
        : U extends object
          ? Partial<U>
          : U
    : never;
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
    pricingComparison: { ...base.pricingComparison, ...patch.pricingComparison },
    pricing: {
      ...base.pricing,
      ...pricingPatch,
      plans: {
        starter: {
          ...base.pricing.plans.starter,
          ...pricingPatch?.plans?.starter,
          features: pricingPatch?.plans?.starter?.features ?? base.pricing.plans.starter.features,
        },
        professional: {
          ...base.pricing.plans.professional,
          ...pricingPatch?.plans?.professional,
          features:
            pricingPatch?.plans?.professional?.features ?? base.pricing.plans.professional.features,
        },
      },
    },
  };
}
