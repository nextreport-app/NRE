import Link from "next/link";
import {
  MetaAdsBrandIcon,
  Ga4BrandIcon,
  SearchConsoleBrandIcon,
} from "./platform-brand-icons";

const platforms = [
  {
    key: "meta",
    href: "/performance/meta-ads",
    label: "Meta Ads",
    Icon: MetaAdsBrandIcon,
  },
  {
    key: "website",
    href: "/performance/google-analytics",
    label: "Website traffic (GA4)",
    Icon: Ga4BrandIcon,
  },
  {
    key: "seo",
    href: "/performance/search-console",
    label: "Google Search Console",
    Icon: SearchConsoleBrandIcon,
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
      {platforms.map(({ key, href, label, Icon }) => (
        <Link
          key={key}
          href={
            clientId ? `${href}?client=${encodeURIComponent(clientId)}` : href
          }
          aria-label={label}
          aria-current={current === key ? "page" : undefined}
          className="nre-platform-tab"
        >
          <span className="nre-platform-icon" aria-hidden="true">
            <Icon />
          </span>
          <span className="nre-platform-label">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
