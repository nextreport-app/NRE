import type { MetaAdSetReportingConfig } from "@/lib/meta-api";
import { ServiceError } from "@/lib/service-error";

const PIXEL_EVENTS: Record<string, string> = {
  LEAD: "lead", COMPLETE_REGISTRATION: "complete_registration", CONTACT: "contact",
  SUBMIT_APPLICATION: "submit_application", PURCHASE: "purchase", ADD_TO_CART: "add_to_cart",
  INITIATED_CHECKOUT: "initiate_checkout", ADD_PAYMENT_INFO: "add_payment_info",
  SEARCH: "search", CONTENT_VIEW: "view_content", SCHEDULE: "schedule",
  START_TRIAL: "start_trial", SUBSCRIBE: "subscribe", DONATE: "donate",
};

/** A specific configured event takes precedence over all-location lead/purchase totals. */
export function configuredResultAction(config: MetaAdSetReportingConfig): string | undefined {
  if (["LINK_CLICKS", "LANDING_PAGE_VIEWS", "REACH", "IMPRESSIONS", "ENGAGED_USERS", "THRUPLAY", "VIDEO_VIEWS", "POST_ENGAGEMENT"].includes(config.optimization_goal ?? "")) return undefined;
  const promoted = config.promoted_object;
  if (promoted?.custom_conversion_id) {
    if (!/^\d+$/.test(promoted.custom_conversion_id)) throw new ServiceError("Meta returned an invalid custom conversion ID.", 422);
    return `offsite_conversion.custom.${promoted.custom_conversion_id}`;
  }
  if (!promoted?.pixel_id) return undefined;
  const event = promoted.custom_event_type;
  if (!event || !PIXEL_EVENTS[event]) throw new ServiceError("This ad set's website conversion event could not be mapped safely. Use CSV reporting while its event configuration is reviewed.", 422);
  return `offsite_conversion.fb_pixel_${PIXEL_EVENTS[event]}`;
}
