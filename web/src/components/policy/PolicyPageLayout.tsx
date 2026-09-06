import type React from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

interface PolicyLink {
  href: string;
  label: string;
}

interface PolicyPageLayoutProps {
  title: string;
  icon: LucideIcon;
  version?: string;
  links?: PolicyLink[];
  children: React.ReactNode;
}

export function PolicyPageLayout({
  title,
  icon: Icon,
  version,
  links = [],
  children,
}: PolicyPageLayoutProps) {
  const displayVersion = version ?? `Version 1.0 — ${new Date().getFullYear()}`;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 pb-16">
      {/* En-tête */}
      <div className="mb-8 flex items-start gap-4 border-b border-gold/30 pb-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <Icon size={20} />
        </div>
        <div>
          <h1 className="font-display text-2xl font-medium text-cream">{title}</h1>
          <p className="mt-1 text-xs text-sage-muted">{displayVersion} · KasoLife SARL — Douala, Cameroun</p>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex flex-col gap-6">{children}</div>

      {/* Liens croisés */}
      {links.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-3 border-t border-ink-line/30 pt-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-ink-line/50 px-4 py-2 text-sm text-sage transition-colors hover:text-cream"
            >
              {link.label} →
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

export function PolicySection({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-ink-line/30 pt-6">
      <h2 className="mb-3 font-display text-base font-medium text-cream">
        {n}. {title}
      </h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-sage">
        {children}
      </div>
    </section>
  );
}
