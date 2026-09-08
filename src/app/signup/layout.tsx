import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Start Free Trial",
  description:
    "Create your NextReport account. 7-day free trial, no credit card required. Generate your first Meta, Google, TikTok, or GA4 client report in minutes.",
  path: "/signup",
  noIndex: true,
});

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
