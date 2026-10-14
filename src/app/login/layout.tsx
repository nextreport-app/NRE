import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Log In",
  description:
    "Sign in to NextReport to generate Meta Ads client reports — CSV upload to branded .pptx and live share link.",
  path: "/login",
  noIndex: true,
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
