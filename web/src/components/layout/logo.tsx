import Link from "next/link";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-1.5 ${className ?? ""}`}>
      <span className="font-brand text-xl font-extrabold tracking-tight text-cream">
        Kaso
      </span>
      <span className="font-brand text-xl font-extrabold tracking-tight bg-gradient-to-r from-gold to-coral bg-clip-text text-transparent">
        Life
      </span>
      <svg width="16" height="16" viewBox="0 0 20 20" className="shrink-0 -ml-0.5">
        <defs>
          <linearGradient id="logo-dot" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0F9488" />
            <stop offset="100%" stopColor="#8B1538" />
          </linearGradient>
        </defs>
        <circle cx="10" cy="10" r="9" fill="url(#logo-dot)" />
      </svg>
    </Link>
  );
}
