const SOCIAL_LINKS = [
  { label: "GitHub", href: "https://github.com/nextreport", ariaLabel: "NextReport on GitHub" },
  { label: "X", href: "https://x.com/nextreportapp", ariaLabel: "X (Twitter)" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/nextreport", ariaLabel: "LinkedIn" },
  { label: "Facebook", href: "https://www.facebook.com/nextreportapp", ariaLabel: "Facebook" },
  { label: "Instagram", href: "https://www.instagram.com/nextreportapp/", ariaLabel: "Instagram" },
] as const;

/** Footer Connect column — text links stacked vertically (no icons). */
export function SocialLinksFooter() {
  return (
    <ul className="mt-3 flex flex-col gap-2 text-[13px]">
      {SOCIAL_LINKS.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={link.ariaLabel}
            className="text-ink-muted transition-colors hover:text-ink"
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** @deprecated Use SocialLinksFooter in site chrome; kept for any legacy icon row usage. */
export function SocialLinks() {
  return <SocialLinksFooter />;
}
