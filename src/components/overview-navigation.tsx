import Link from "next/link";
import { useId } from "react";
const platforms = [
  {
    key: "meta",
    href: "/performance/meta-ads",
    label: "Meta Ads",
    description: "Campaigns, costs & results",
  },
  {
    key: "website",
    href: "/performance/google-analytics",
    label: "Website Traffic (GA4)",
    description: "Visitors, activity & engagement",
  },
  {
    key: "seo",
    href: "/performance/search-console",
    label: "Google Search Console",
    description: "Search clicks, queries & rankings",
  },
] as const;

function PlatformIcon({ platform }: { platform: "meta" | "website" | "seo" }) {
  const gradientId = useId();
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={`url(#${gradientId})`}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--nre-platform-icon-start)" />
          <stop offset="1" stopColor="var(--nre-platform-icon-end)" />
        </linearGradient>
      </defs>
      {platform === "meta" ? (
        <>
          <path d="M4 10h4l11-5v14L8 15H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" />
          <path d="m5 15 2 6h3l-2-6M15 7v10M22 10v4" />
        </>
      ) : platform === "website" ? (
        <>
          <path d="M4 19V5M4 19h16" />
          <path d="M8 15v-3m5 3V8m5 7V4" />
        </>
      ) : (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5M7 12l3-3 2 2 2-3" />
        </>
      )}
    </svg>
  );
}

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
          className="nre-dashboard-entry"
        >
          <span className="nre-dashboard-entry-top">
            <span
              className={`nre-platform-icon nre-platform-icon--${key}`}
              aria-hidden="true"
            >
              <PlatformIcon platform={key} />
            </span>
            <span className="nre-dashboard-entry-title">{label}</span>
          </span>
          <span className="nre-dashboard-entry-copy">
            <span className="nre-dashboard-entry-description">
              {description}
            </span>
            {current === key && (
              <span className="nre-dashboard-entry-current" aria-hidden="true">
                <span />
                Viewing
              </span>
            )}
          </span>
        </Link>
      ))}
    </nav>
  );
}
