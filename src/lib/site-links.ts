/** Shared navigation + footer link config for the public marketing site. */

export type SiteLink = {
  href: string;
  label: string;
  /** Hidden while BETA_HIDE_PRICING is true (see lib/beta.ts). */
  hideDuringBeta?: boolean;
};

export const PUBLIC_NAV_LINKS: SiteLink[] = [
  { href: "/how-it-works", label: "Getting Started" },
];

export const FOOTER_PRODUCT_LINKS: SiteLink[] = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "Getting Started" },
  { href: "/help/download", label: "CSV Export Guide" },
  { href: "/pricing", label: "Pricing", hideDuringBeta: true },
];

export const FOOTER_COMPANY_LINKS: SiteLink[] = [
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
  { href: "/refer", label: "Refer an Agency" },
];

export const FOOTER_LEGAL_LINKS: SiteLink[] = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/data-deletion", label: "Data Deletion" },
];

export const SUPPORT_EMAIL = "hello@nextreport.in";
export const WHATSAPP_URL = "https://wa.me/918882578327";

export function filterBetaLinks(links: SiteLink[], hidePricing: boolean): SiteLink[] {
  return links.filter((link) => !(hidePricing && link.hideDuringBeta));
}
