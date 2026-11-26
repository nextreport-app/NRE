import Link from "next/link";

const platforms = [
  {
    key: "meta",
    href: "/performance/meta-ads",
    label: "Meta Ads",
    description: "Campaign performance",
  },
  {
    key: "website",
    href: "/performance/google-analytics",
    label: "Website traffic (GA4)",
    description: "Visitors & engagement",
  },
  {
    key: "seo",
    href: "/performance/search-console",
    label: "Google Search Console",
    description: "Search visibility",
  },
] as const;

export function OverviewNavigation({
  current,
  clientId,
}: {
  current: "meta" | "website" | "seo";
  clientId?: string;
}) {
  return (
    <nav aria-label="Performance type" className="nre-platform-navigation">
      {platforms.map(({ key, href, label, description }) => (
        <Link
          key={key}
          href={
            clientId ? `${href}?client=${encodeURIComponent(clientId)}` : href
          }
          aria-label={label}
          aria-current={current === key ? "page" : undefined}
          className="nre-platform-tab"
        >
          <span
            className={`nre-platform-icon nre-platform-icon--${key}`}
            aria-hidden="true"
          >
            {key === "meta" ? (
              <svg
                width="28"
                height="28"
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 16c-3-5-5-8-7-8-4 0-6 7-6 12 0 3 1 4 3 4 4 0 7-8 10-13 2-3 3-3 5-3 4 0 8 7 8 12 0 3-1 4-3 4-4 0-7-8-10-13" />
              </svg>
            ) : key === "website" ? (
              <svg
                width="27"
                height="27"
                viewBox="0 0 28 28"
                fill="currentColor"
              >
                <rect x="3" y="17" width="6" height="8" rx="3" opacity=".65" />
                <rect
                  x="11"
                  y="10"
                  width="6"
                  height="15"
                  rx="3"
                  opacity=".85"
                />
                <rect x="19" y="3" width="6" height="22" rx="3" />
              </svg>
            ) : (
              <svg
                width="27"
                height="27"
                viewBox="0 0 28 28"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="8" />
                <path d="m18 18 7 7M7 14l4-4 3 2 3-4" />
              </svg>
            )}
          </span>
          <span className="nre-platform-copy">
            <span className="nre-platform-label">{label}</span>
            <span className="nre-platform-description">{description}</span>
          </span>
          <span className="nre-platform-indicator" aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}
