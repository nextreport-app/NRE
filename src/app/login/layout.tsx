import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Log In",
  description:
    "Sign in to NextReport to generate Meta, Google Ads, TikTok, and GA4 client reports — API sync or CSV upload to branded .pptx, live link, and PDF.",
  path: "/login",
  noIndex: true,
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
