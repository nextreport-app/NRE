import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Reset Password",
  description: "Set a new password for your NextReport account.",
  path: "/reset-password",
  noIndex: true,
});

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
