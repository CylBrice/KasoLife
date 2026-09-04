import Link from "next/link";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-1.5 ${className ?? ""}`}>
      <span className="flex items-baseline">
        <span className="font-brand text-2xl font-extrabold tracking-tight text-emerald dark:text-[#C24A63]">
          Kaso
        </span>
        <span className="font-brand text-2xl font-extrabold tracking-tight bg-gradient-to-r from-gold to-coral bg-clip-text text-transparent">
          Life
        </span>
      </span>
      <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0 -ml-0.5">
        <defs>
          {/* Sphère 3D : gradient radial avec focal point décalé vers la lumière (haut-gauche) */}
          <radialGradient id="logo-dot" cx="38%" cy="32%" r="72%" fx="32%" fy="26%">
            <stop offset="0%"   stopColor="#4ecfb8" />
            <stop offset="30%"  stopColor="#0f9488" />
            <stop offset="62%"  stopColor="#6b1030" />
            <stop offset="85%"  stopColor="#3d0818" />
            <stop offset="100%" stopColor="#1a030c" />
          </radialGradient>

          {/* Ombre interne : assombrit le bas-droite pour donner la profondeur */}
          <radialGradient id="logo-shadow" cx="68%" cy="72%" r="65%" fx="75%" fy="78%">
            <stop offset="0%"   stopColor="#000" stopOpacity="0.55" />
            <stop offset="60%"  stopColor="#000" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>

          {/* Reflet de bord (rim light) : halo froid sur le bas-gauche */}
          <radialGradient id="logo-rim" cx="22%" cy="78%" r="45%">
            <stop offset="0%"   stopColor="#1a6fd4" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#1a6fd4" stopOpacity="0" />
          </radialGradient>

          {/* Shimmer : bande diagonale qui traverse lentement */}
          <linearGradient id="logo-shimmer" gradientUnits="userSpaceOnUse"
                          x1="-10" y1="6" x2="0" y2="14">
            <stop offset="0%"   stopColor="white" stopOpacity="0" />
            <stop offset="42%"  stopColor="white" stopOpacity="0.02" />
            <stop offset="50%"  stopColor="white" stopOpacity="0.20" />
            <stop offset="58%"  stopColor="white" stopOpacity="0.02" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
            <animate attributeName="x1" values="-10;32" dur="4.5s" repeatCount="indefinite" />
            <animate attributeName="x2" values="  0;42" dur="4.5s" repeatCount="indefinite" />
          </linearGradient>

          {/* Filtre flou pour le spéculaire doux */}
          <filter id="logo-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.55" />
          </filter>

          <clipPath id="logo-clip">
            <circle cx="10" cy="10" r="9" />
          </clipPath>
        </defs>

        {/* 1 — Corps de la sphère */}
        <circle cx="10" cy="10" r="9" fill="url(#logo-dot)" />

        {/* 2 — Ombre interne bas-droite */}
        <circle cx="10" cy="10" r="9" fill="url(#logo-shadow)" />

        {/* 3 — Rim light bas-gauche */}
        <circle cx="10" cy="10" r="9" fill="url(#logo-rim)" />

        {/* 4 — Shimmer animé (clipé) */}
        <rect x="1" y="1" width="18" height="18"
              fill="url(#logo-shimmer)" clipPath="url(#logo-clip)" />

        {/* 5 — Spéculaire large et doux (bloom) */}
        <ellipse cx="7.2" cy="6.0" rx="3.0" ry="2.2"
                 fill="white" opacity="0.28"
                 filter="url(#logo-blur)" clipPath="url(#logo-clip)" />

        {/* 6 — Spéculaire net et brillant au centre du bloom */}
        <ellipse cx="6.8" cy="5.6" rx="1.1" ry="0.75"
                 fill="white" opacity="0.70" clipPath="url(#logo-clip)" />
      </svg>
    </Link>
  );
}
