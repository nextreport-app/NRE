"use client";

import { useSiteTheme } from "@/components/site-theme-provider";
import { wizardCopy, type WizardCopy } from "@/lib/wizard-i18n";

export function useWizardCopy(): WizardCopy {
  const { locale } = useSiteTheme();
  return wizardCopy(locale);
}
