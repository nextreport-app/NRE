/**
 * Brand-styled platform icons for integration pickers.
 * Used nominatively to identify which ad/analytics platform a report connects to.
 * Colors match each vendor's public brand palette — descriptive integration use only.
 */

const SIZE = 40;

function IconFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={label}
    >
      {children}
    </svg>
  );
}

/** Meta Ads — Meta blue tile with the infinity mark. */
export function MetaAdsBrandIcon() {
  return (
    <IconFrame label="Meta Ads">
      <rect width="40" height="40" rx="10" fill="#0081FB" />
      <path
        fill="#fff"
        d="M27.6 20c0-2.4-1.9-4.3-4.3-4.3-1.5 0-2.8.8-3.5 2-.7-1.2-2-2-3.5-2-2.4 0-4.3 1.9-4.3 4.3 0 3.2 4 6.2 7.8 9.5 3.8-3.3 7.8-6.3 7.8-9.5zm-7.8 6.5c-2-1.7-5-4.1-5-6.5 0-1.3 1.1-2.4 2.4-2.4 1 0 1.8.5 2.2 1.4.4-.9 1.2-1.4 2.2-1.4 1.3 0 2.4 1.1 2.4 2.4 0 2.4-3 4.8-5 6.5z"
      />
    </IconFrame>
  );
}

/** Google Ads — yellow / green circles + blue wedge. */
export function GoogleAdsBrandIcon() {
  return (
    <IconFrame label="Google Ads">
      <rect width="40" height="40" rx="10" fill="#fff" />
      <circle cx="13.5" cy="14.5" r="5.25" fill="#FBBC04" />
      <circle cx="13.5" cy="26.5" r="5.25" fill="#34A853" />
      <path fill="#4285F4" d="M21.5 9 33.5 30.5c.7 1.3-.2 2.9-1.7 2.9H19c-.9 0-1.7-.5-2.2-1.2L8.5 14.8c-.7-1.2.2-2.7 1.5-2.7h8.2c.9 0 1.7.5 2.2 1.2L21.5 9z" />
    </IconFrame>
  );
}

/** TikTok Ads — note mark on dark tile with cyan + pink accent. */
export function TikTokAdsBrandIcon() {
  return (
    <IconFrame label="TikTok Ads">
      <rect width="40" height="40" rx="10" fill="#010101" />
      <path
        fill="#25F4EE"
        d="M25.5 11.5v10.2c0 2.9-2.4 5.3-5.3 5.3s-5.3-2.4-5.3-5.3 2.4-5.3 5.3-5.3c.3 0 .7 0 1 .1v3.1a2.2 2.2 0 0 0-1-.2c-1.2 0-2.2 1-2.2 2.2s1 2.2 2.2 2.2 2.2-1 2.2-2.2V11.5h2.1z"
      />
      <path
        fill="#FE2C55"
        d="M27 11.5v10.2c0 2.9-2.4 5.3-5.3 5.3-.9 0-1.7-.2-2.4-.6 1.3-.8 2.2-2.2 2.2-3.9v-1.1c.3.1.7.1 1 .1.3 0 .7 0 1-.1v-3.1c-.3.1-.7.1-1 .1-.3 0-.7 0-1-.1V11.5H27z"
      />
    </IconFrame>
  );
}

/** GA4 — orange tile with ascending bars (Analytics 4 app icon style). */
export function Ga4BrandIcon() {
  return (
    <IconFrame label="Google Analytics 4">
      <rect width="40" height="40" rx="10" fill="#E37400" />
      <rect x="11" y="22" width="5" height="10" rx="1" fill="#fff" />
      <rect x="18" y="17" width="5" height="15" rx="1" fill="#fff" />
      <rect x="25" y="12" width="5" height="20" rx="1" fill="#fff" />
    </IconFrame>
  );
}
