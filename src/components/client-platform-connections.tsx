import Link from "next/link";
import {
  Ga4BrandIcon,
  GoogleAdsBrandIcon,
  MetaAdsBrandIcon,
  TikTokAdsBrandIcon,
} from "@/components/platform-brand-icons";

export interface PlatformConnectionRow {
  connected: boolean;
  /** Connected account label — email or name when available. */
  detail: string | null;
  configured: boolean;
}

export interface ClientPlatformConnectionsProps {
  meta: PlatformConnectionRow;
  googleAds: PlatformConnectionRow;
  tiktok: PlatformConnectionRow;
  ga4: PlatformConnectionRow;
}

const PLATFORMS: {
  key: keyof ClientPlatformConnectionsProps;
  name: string;
  hash: string;
  Icon: typeof MetaAdsBrandIcon;
}[] = [
  { key: "meta", name: "Meta Ads", hash: "meta-ads", Icon: MetaAdsBrandIcon },
  { key: "googleAds", name: "Google Ads", hash: "google-ads", Icon: GoogleAdsBrandIcon },
  { key: "tiktok", name: "TikTok Ads", hash: "tiktok-ads", Icon: TikTokAdsBrandIcon },
  { key: "ga4", name: "Google Analytics", hash: "ga4", Icon: Ga4BrandIcon },
];

function StatusBadge({ connected, configured }: { connected: boolean; configured: boolean }) {
  if (!configured) {
    return (
      <span className="rounded-full border border-dash-border bg-dash-bg px-2 py-0.5 text-[12px] font-medium text-dash-ink-secondary">
        Not available
      </span>
    );
  }
  if (connected) {
    return (
      <span className="rounded-full border border-emerald-800/50 bg-emerald-950/30 px-2 py-0.5 text-[12px] font-medium text-emerald-200">
        Connected
      </span>
    );
  }
  return (
    <span className="rounded-full border border-amber-800/50 bg-amber-950/30 px-2 py-0.5 text-[12px] font-medium text-amber-200">
      Not connected
    </span>
  );
}

/**
 * Manage page — account-level ad platform OAuth status with links to Account settings.
 * GA4 property linking stays in Ga4PropertyPicker below this summary.
 */
export function ClientPlatformConnections(props: ClientPlatformConnectionsProps) {
  return (
    <div className="space-y-3">
      <p className="text-[15px] leading-relaxed text-dash-ink-secondary">
        Connect your ad accounts once in Account settings. Every client can use these connections in the report
        wizard.
      </p>
      <ul className="divide-y divide-dash-border rounded-lg border border-dash-border">
        {PLATFORMS.map(({ key, name, hash, Icon }) => {
          const row = props[key];
          const actionLabel = !row.configured
            ? "Unavailable"
            : row.connected
              ? "Manage"
              : "Connect";
          const actionHref = `/account#${hash}`;

          return (
            <li key={key} className="flex items-center gap-3 px-3 py-3 sm:px-4">
              <div className="flex-shrink-0">
                <Icon />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[15px] font-medium text-dash-ink">{name}</p>
                  <StatusBadge connected={row.connected} configured={row.configured} />
                </div>
                {row.connected && row.detail ? (
                  <p className="mt-0.5 truncate text-[13px] text-dash-ink-secondary">{row.detail}</p>
                ) : null}
              </div>
              {row.configured ? (
                <Link
                  href={actionHref}
                  className="flex-shrink-0 rounded-md border border-dash-border px-3 py-1.5 text-[13px] font-medium text-dash-ink-secondary hover:bg-dash-bg hover:text-dash-ink"
                >
                  {actionLabel} →
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
