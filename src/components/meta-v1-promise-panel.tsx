import Link from "next/link";
import {
  META_V1_PROMISE_BULLETS,
  META_V1_PROMISE_HEADLINE,
} from "@/lib/product-positioning";

type Variant = "marketing" | "wizard";

const variantClasses: Record<
  Variant,
  { wrap: string; title: string; list: string; link: string }
> = {
  marketing: {
    wrap: "rounded-xl border border-navy-border bg-navy-panel p-6 sm:p-8",
    title: "text-lg font-semibold text-white",
    list: "mt-4 space-y-2.5 text-sm leading-relaxed text-ink-secondary",
    link: "mt-4 inline-block text-sm font-medium text-accent hover:underline",
  },
  wizard: {
    wrap: "rounded-lg border border-dash-border bg-dash-sidebar/50 px-4 py-3",
    title: "text-[13px] font-semibold text-white",
    list: "mt-2 space-y-1.5 text-[13px] leading-relaxed text-dash-ink-secondary",
    link: "mt-2 inline-block text-[13px] font-medium text-dash-accent underline hover:no-underline",
  },
};

/** Shared v1 scope copy — homepage + wizard import step. */
export function MetaV1PromisePanel({ variant = "marketing" }: { variant?: Variant }) {
  const c = variantClasses[variant];
  return (
    <div className={c.wrap}>
      <h3 className={c.title}>{META_V1_PROMISE_HEADLINE}</h3>
      <ul className={`${c.list} list-disc pl-5`}>
        {META_V1_PROMISE_BULLETS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <Link href="/help/download" className={c.link}>
        Full CSV export guide →
      </Link>
    </div>
  );
}
