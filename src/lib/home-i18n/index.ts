import type { SiteLocaleId } from "@/lib/site-theme";
import { HOME_EN } from "./en";
import { mergeHomeCopy } from "./merge";
import { DE_HOME_PATCH } from "./locales/de-patch";
import { ES_HOME_PATCH } from "./locales/es-patch";
import { FR_HOME_PATCH } from "./locales/fr-patch";
import { HOME_OTHER_PATCHES } from "./locales/other-patches";
import { PT_HOME_PATCH } from "./locales/pt-patch";
import type { HomeCopy } from "./types";

export type { HomeCopy, HomeFeature, HomeStep, HomeTestimonial } from "./types";

const PATCHES: Partial<Record<SiteLocaleId, Parameters<typeof mergeHomeCopy>[1]>> = {
  es: ES_HOME_PATCH,
  fr: FR_HOME_PATCH,
  pt: PT_HOME_PATCH,
  de: DE_HOME_PATCH,
  ...HOME_OTHER_PATCHES,
};

export function homeCopy(locale: SiteLocaleId): HomeCopy {
  const patch = PATCHES[locale];
  if (!patch) return HOME_EN;
  const copy = mergeHomeCopy(HOME_EN, patch);
  // Commercial promises must not retain obsolete limits/tax/automation claims in old translations.
  copy.pricing.plans.starter.features = HOME_EN.pricing.plans.starter.features;
  copy.pricing.plans.professional.features = HOME_EN.pricing.plans.professional.features;
  copy.pricing.mostPopular = HOME_EN.pricing.mostPopular;
  copy.pricing.exclGst = HOME_EN.pricing.exclGst;
  copy.pricing.exclTax = HOME_EN.pricing.exclTax;
  return copy;
}
