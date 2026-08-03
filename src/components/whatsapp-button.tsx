"use client";

// Placeholder support number — the user said they'll update this manually.
const WHATSAPP_URL = "https://wa.me/918882578327";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="white" width="28" height="28" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.043L.785 23.542a.5.5 0 00.626.665l4.861-1.537A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.33 0-4.49-.698-6.29-1.892l-3.45 1.091 1.108-3.372A9.944 9.944 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  );
}

/**
 * Global floating "Chat with us on WhatsApp" button — rendered unconditionally
 * from the root layout (so it appears on both public and dashboard pages
 * without duplicating it into every page/layout) and hidden purely via CSS
 * on /light-preview (see globals.css's body:has(#light-preview-page) rule,
 * the same mechanism the site-wide footer already uses there) rather than a
 * dynamic pathname check, which would force the whole app out of static
 * rendering — see layout.tsx's own footer comment for why.
 */
export function WhatsAppButton() {
  return (
    <div className="whatsapp-float group fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      <span
        className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-md bg-navy-panel px-3 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
        role="tooltip"
      >
        Chat with us on WhatsApp
      </span>

      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] shadow-lg transition-transform hover:scale-105 sm:h-14 sm:w-14"
      >
        <WhatsAppIcon />
      </a>
    </div>
  );
}
