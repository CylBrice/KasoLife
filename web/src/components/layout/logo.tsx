import Link from "next/link";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className ?? ""}`}>
      <svg width="28" height="28" viewBox="0 0 48 48" className="shrink-0">
        <rect width="48" height="48" rx="10" fill="#16302A" />
        <g stroke="#E8A33D" strokeWidth="3" fill="none" strokeLinecap="round">
          <path d="M10 10 L38 38 M38 10 L10 38" opacity="0.9" />
        </g>
        <circle cx="24" cy="24" r="4" fill="#E8A33D" />
      </svg>
      <span className="font-display text-lg font-semibold tracking-tight text-cream">
        KasoLife
      </span>
    </Link>
  );
}
