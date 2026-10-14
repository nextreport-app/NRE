/** Re-export for wizard-local imports — source of truth is `@/lib/nre/wizard-generate-baseline`. */
export {
  WIZARD_HAPPY_PATH_BASELINE_VERSION,
  HAPPY_PATH_ELIGIBLE_REPORT_TYPES,
  type WizardGenerateBaseline,
  type HappyPathEligibilityReason,
  type HappyPathEligibility,
  fingerprintCsvHeaders,
  evaluateHappyPathEligibility,
  metricsMatchBaseline,
  selectionFromBaseline,
  buildWizardGenerateBaseline,
  computeMetricsFingerprint,
} from "@/lib/nre/wizard-generate-baseline";
