import Link from "next/link";

export function FooterLinkColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-white">{title}</h3>
      <nav className="mt-4 flex flex-col gap-2.5 text-sm text-ink-muted">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="transition-colors hover:text-white">
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
