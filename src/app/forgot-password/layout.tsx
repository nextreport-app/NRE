import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Forgot Password",
  description: "Request a password reset link for your NextReport account.",
  path: "/forgot-password",
  noIndex: true,
});

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
