"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { BottomNav } from "@/components/layout/bottom-nav";

/* ── Icônes SVG inline (style KasoPlex) ── */
const IconChat = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
      fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconShield = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
      fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);
const IconWallet = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="2" y="7" width="20" height="14" rx="2" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
    <path d="M16 3H5a3 3 0 0 0-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="17" cy="14" r="1.5" fill="currentColor" />
  </svg>
);
const IconHeart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);
const IconLock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="3" y="11" width="18" height="11" rx="2" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1.5" fill="currentColor" />
  </svg>
);
const IconPhone = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="5" y="2" width="14" height="20" rx="2" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
    <line x1="12" y1="18" x2="12.01" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const SECTIONS = [
  {
    id: "comment-fonctionne",
    icon: <IconHeart />,
    title: "Comment fonctionne KasoLife ?",
    content: (
      <>
        <p className="text-sm text-sage leading-relaxed">
          KasoLife est une plateforme de contenu pour créateurs. Les créateurs publient des photos, vidéos, audios ou textes.
          Les fans peuvent s&apos;abonner pour accéder au contenu exclusif, envoyer des pourboires ou acheter du contenu à la pièce (PPV).
        </p>
        <ol className="mt-3 flex flex-col gap-1.5 text-sm text-sage">
          {[
            "Crée un compte gratuitement",
            "Découvre les créateurs dans le feed",
            "Abonne-toi pour accéder au contenu exclusif",
            "Recharge ton wallet via Mobile Money",
            "Envoie des pourboires à tes créateurs favoris",
          ].map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold-bright">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </>
    ),
  },
  {
    id: "wallet",
    icon: <IconWallet />,
    title: "Wallet — Dépôt & Retrait",
    content: (
      <>
        <p className="text-sm text-sage leading-relaxed">Ton wallet KasoLife se recharge via Mobile Money (MTN ou Orange).</p>
        <div className="mt-3 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3">
          <p className="text-xs font-bold text-gold-bright uppercase tracking-wider mb-1">Dépôt</p>
          <p className="text-sm text-sage">Va dans Wallet → Recharger → saisis le montant → confirme sur ton téléphone.</p>
        </div>
        <div className="mt-2 rounded-xl border border-coral/20 bg-coral/5 px-4 py-3">
          <p className="text-xs font-bold text-coral uppercase tracking-wider mb-1">Retrait (créateurs uniquement)</p>
          <p className="text-sm text-sage">Retrait minimum : 5 000 FCFA · Frais : 1,5 % · Délai : 24–48 h après validation KYC.</p>
        </div>
      </>
    ),
  },
  {
    id: "abonnement",
    icon: <IconHeart />,
    title: "Abonnements & Contenu PPV",
    content: (
      <>
        <p className="text-sm text-sage leading-relaxed">
          Chaque créateur fixe librement son prix d&apos;abonnement mensuel.
          Certains contenus sont également disponibles à la pièce (PPV) sans abonnement.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          {[
            ["🆓 Gratuit", "Visible par tous"],
            ["🔒 Abonnés", "Abonnement mensuel"],
            ["💎 PPV", "Achat unique"],
            ["💬 Message", "Messagerie privée"],
          ].map(([label, desc]) => (
            <div key={label} className="rounded-lg border border-ink-line/50 bg-ink-raised p-3">
              <p className="font-medium text-cream">{label}</p>
              <p className="mt-0.5 text-sage-muted">{desc}</p>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    id: "kyc",
    icon: <IconShield />,
    title: "Vérification d'identité (KYC)",
    content: (
      <>
        <p className="text-sm text-sage leading-relaxed">
          La vérification KYC est obligatoire pour les créateurs souhaitant retirer leurs gains.
          Elle garantit la sécurité et la conformité de la plateforme.
        </p>
        <ol className="mt-3 flex flex-col gap-1.5 text-sm text-sage">
          {[
            "Va dans Mon Profil → Vérification d'identité",
            "Télécharge une pièce d'identité valide (CNI, passeport)",
            "Attends la validation par notre équipe (24–72 h)",
            "Reçois la confirmation par notification",
          ].map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold-bright">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </>
    ),
  },
  {
    id: "securite",
    icon: <IconLock />,
    title: "Sécurité & Confidentialité",
    content: (
      <p className="text-sm text-sage leading-relaxed">
        Toutes tes données sont chiffrées. Nous ne partageons jamais tes informations personnelles avec des tiers.
        Active les notifications pour être alerté de toute activité suspecte sur ton compte.
        En cas de problème, contacte notre support immédiatement.
      </p>
    ),
  },
  {
    id: "installer",
    icon: <IconPhone />,
    title: "Installer l'app (PWA)",
    content: (
      <>
        <p className="text-sm text-sage">Ajoute KasoLife sur ton écran d&apos;accueil — aucune App Store nécessaire !</p>
        <div className="mt-3 flex flex-col gap-2 text-sm text-sage">
          <div className="rounded-xl border border-ink-line/50 bg-ink-raised p-3">
            <p className="font-medium text-cream mb-1">📱 iPhone (Safari uniquement)</p>
            <ol className="flex flex-col gap-1 text-xs text-sage-muted">
              <li>1. Ouvre dans Safari</li>
              <li>2. Appuie sur le bouton Partager ⬆</li>
              <li>3. «Sur l&apos;écran d&apos;accueil»</li>
            </ol>
          </div>
          <div className="rounded-xl border border-ink-line/50 bg-ink-raised p-3">
            <p className="font-medium text-cream mb-1">🤖 Android (Chrome)</p>
            <ol className="flex flex-col gap-1 text-xs text-sage-muted">
              <li>1. Ouvre dans Chrome</li>
              <li>2. Menu ⋮ → «Ajouter à l&apos;écran d&apos;accueil»</li>
            </ol>
          </div>
        </div>
      </>
    ),
  },
  {
    id: "contact",
    icon: <IconChat />,
    title: "Contacter le support",
    content: (
      <>
        <p className="text-sm text-sage">Notre équipe est disponible 7j/7 via le chat intégré ou par email.</p>
        <div className="mt-3 flex flex-col gap-2">
          <Link href="/support" className="flex items-center gap-3 rounded-xl border border-ink-line/50 bg-ink-raised px-4 py-3 text-sm text-cream hover:border-gold/50 transition-colors">
            <span className="text-xl">💬</span>
            <span>Chat support en direct</span>
          </Link>
          <a href="mailto:support@kasolife.com" className="flex items-center gap-3 rounded-xl border border-ink-line/50 bg-ink-raised px-4 py-3 text-sm text-cream hover:border-gold/50 transition-colors">
            <span className="text-xl">📧</span>
            <span>support@kasolife.com</span>
          </a>
        </div>
      </>
    ),
  },
];

export default function AidePage() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:pb-12">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-medium text-cream">Centre d&apos;aide</h1>
          <p className="mt-1 text-sm text-sage">Tout ce que tu dois savoir sur KasoLife.</p>
        </div>

        <div className="flex flex-col gap-2">
          {SECTIONS.map((s) => (
            <div key={s.id} className="overflow-hidden rounded-xl border border-ink-line/50 bg-ink-surface transition-colors">
              <button
                onClick={() => setOpen(open === s.id ? null : s.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
                  {s.icon}
                </span>
                <span className="flex-1 font-medium text-cream">{s.title}</span>
                <span className="text-sage-muted text-sm">{open === s.id ? "▲" : "▼"}</span>
              </button>
              {open === s.id && (
                <div className="border-t border-ink-line/50 px-5 pb-5 pt-4">
                  {s.content}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-sage-muted">Tu n&apos;as pas trouvé ta réponse ?</p>
          <Link href="/support" className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-medium text-ink hover:bg-gold-bright transition-colors">
            <IconChat />
            Contacter le support
          </Link>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
