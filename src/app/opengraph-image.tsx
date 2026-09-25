import { ImageResponse } from "next/og";

export const alt = "NextReport — Meta Ads reporting for agencies (Google, TikTok & GA4 launching soon)";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default Open Graph / Twitter card image for all public pages. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "64px",
          background: "linear-gradient(135deg, #0d1b2e 0%, #111f35 100%)",
          color: "#ffffff",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#f5b45a",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          NextReport
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 52,
            fontWeight: 800,
            lineHeight: 1.15,
            maxWidth: 900,
          }}
        >
          Send polished client reports in under 2 minutes
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 26,
            lineHeight: 1.4,
            color: "#94a3b8",
            maxWidth: 880,
          }}
        >
          Meta Ads — API sync or CSV → .pptx, live link & PDF · Google, TikTok & GA4 soon
        </div>
      </div>
    ),
    { ...size },
  );
}
