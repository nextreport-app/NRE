/**
 * Agency logo on client reports — live share link header only (not embedded on PPT slides).
 * Display caps match share-report-branding-header.tsx (sm breakpoint).
 */

export const AGENCY_LOGO_DISPLAY_MAX_PX = {
  width: 160,
  height: 36,
} as const;

/** 2× display cap — recommended upload size for sharp rendering on retina screens. */
export const AGENCY_LOGO_RECOMMENDED_PX = {
  width: 320,
  height: 72,
} as const;

export function agencyLogoUploadGuidance(): string {
  const { width, height } = AGENCY_LOGO_RECOMMENDED_PX;
  const { width: maxW, height: maxH } = AGENCY_LOGO_DISPLAY_MAX_PX;
  return `Recommended upload: ${width} × ${height} px (wide horizontal logo). We scale it to fit up to ${maxW} × ${maxH} px on the live share link header without cropping. PNG, JPG, WebP, or SVG — max 2MB. Transparent PNG or SVG works best.`;
}
