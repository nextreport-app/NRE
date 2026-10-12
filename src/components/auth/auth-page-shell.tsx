import Link from "next/link";
import type { ReactNode } from "react";

export function AuthPageShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <Link href="/" className="inline-flex items-center justify-center gap-2">
          <img src="/logo.png" alt="NextReport logo" className="block h-9 w-9" />
          <span className="text-[22px] font-bold tracking-[-0.3px] text-ink" style={{ fontFamily: "var(--font-inter), sans-serif" }}>
            NextReport
          </span>
        </Link>
        <h1 className="mt-5 text-xl font-semibold text-ink">{title}</h1>
        <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>
      </div>

      <div className="rounded-xl border border-navy-border bg-navy-panel/80 p-6 shadow-sm backdrop-blur-sm">{children}</div>

      {footer ? <div className="mt-6">{footer}</div> : null}

      <p className="mt-8 text-center text-xs leading-relaxed text-ink-muted">
        <Link href="/" className="hover:text-ink-secondary hover:underline">
          ← Back to home
        </Link>
        <span className="mx-2 text-navy-border">·</span>
        <Link href="/privacy" className="hover:text-ink-secondary hover:underline">
          Privacy
        </Link>
        <span className="mx-2 text-navy-border">·</span>
        <Link href="/terms" className="hover:text-ink-secondary hover:underline">
          Terms
        </Link>
        <span className="mx-2 text-navy-border">·</span>
        <Link href="/support" className="hover:text-ink-secondary hover:underline">
          Support
        </Link>
      </p>
    </div>
  );
}

export const authInputClassName =
  "w-full rounded-md border border-navy-border bg-navy px-3 py-2 text-sm text-ink outline-none focus:border-accent autofill:shadow-[inset_0_0_0px_1000px_#111f35]";

export function AuthFieldLabel({ htmlFor, children, action }: { htmlFor: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-1 flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="text-sm text-ink-secondary">
        {children}
      </label>
      {action}
    </div>
  );
}
