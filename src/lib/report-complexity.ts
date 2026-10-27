import { ServiceError } from "./service-error";
export const MAX_REPORT_DETAIL_SLIDES = 50;
/** Reject excessive detail explicitly; never truncate or silently change report figures. */
export function assertReportComplexity(data: { campaignSlides?: readonly unknown[]; adSetSlides?: readonly unknown[] }) {
  if ((data.campaignSlides?.length ?? 0) + (data.adSetSlides?.length ?? 0) > MAX_REPORT_DETAIL_SLIDES) throw new ServiceError("A report supports up to 50 campaign/ad-set detail slides. Select fewer details or split the report; campaign totals are not truncated.", 413);
}
