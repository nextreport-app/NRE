/** Stable AI-copy map key for a campaign or ad-set slide — shared by render + share projection. */
export function slideAiKey(slide: { kind: "campaign" | "adset"; campaignName: string; adSetName?: string }): string {
  return slide.kind === "campaign" ? `campaign:${slide.campaignName}` : `adset:${slide.campaignName}/${slide.adSetName}`;
}
