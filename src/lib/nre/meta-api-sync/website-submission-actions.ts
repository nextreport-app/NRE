/** Action types / result indicators that map to Ads Manager "website submission" for OUTCOME_LEADS. */
const CUSTOM_CONVERSION = /offsite_conversion\.custom\./i;

export function isWebsiteSubmissionResultAction(actionType: string): boolean {
  if (!actionType) return false;
  if (
    actionType === "offsite_conversion.fb_pixel_lead" ||
    actionType === "website_lead" ||
    actionType === "onsite_web_lead" ||
    actionType === "lead"
  ) {
    return true;
  }
  if (/offsite_conversion\.fb_pixel_custom/i.test(actionType)) return true;
  if (CUSTOM_CONVERSION.test(actionType)) return true;
  return false;
}
