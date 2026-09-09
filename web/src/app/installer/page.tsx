"use client";

import Link from "next/link";
import { Smartphone, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InstallerPage() {
  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:pb-12">
        <div className="mb-6">
          <Link href="/" className="mb-4 flex items-center gap-1.5 text-sm text-sage-muted hover:text-cream transition-colors">
            <ArrowLeft className="h-4 w-4" /> Retour
          </Link>
          <h1 className="font-display text-2xl font-medium text-cream">Installer KasoLife</h1>
          <p className="mt-1 text-sm text-sage">Ajoute KasoLife sur ton écran d&apos;accueil — aucune App Store nécessaire !</p>
        </div>

        <div className="flex flex-col gap-4">
          {/* iPhone */}
          <div className="rounded-xl border border-ink-line/50 bg-ink-surface p-5">
            <p className="flex items-center gap-2 font-medium text-cream mb-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10">
                <Smartphone className="h-4 w-4 text-gold" />
              </span>
              iPhone (Safari uniquement)
            </p>
            <ol className="flex flex-col gap-2 text-sm text-sage pl-2">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold-bright">1</span>
                Ouvre <strong className="text-cream">kasolife.com</strong> dans Safari
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold-bright">2</span>
                Appuie sur le bouton <strong className="text-cream">Partager ⬆</strong> en bas de l&apos;écran
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold-bright">3</span>
                Sélectionne <strong className="text-cream">«Sur l&apos;écran d&apos;accueil»</strong>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold-bright">4</span>
                Appuie sur <strong className="text-cream">Ajouter</strong>
              </li>
            </ol>
          </div>

          {/* Android */}
          <div className="rounded-xl border border-ink-line/50 bg-ink-surface p-5">
            <p className="flex items-center gap-2 font-medium text-cream mb-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10">
                <Smartphone className="h-4 w-4 text-gold" />
              </span>
              Android (Chrome)
            </p>
            <ol className="flex flex-col gap-2 text-sm text-sage pl-2">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold-bright">1</span>
                Ouvre <strong className="text-cream">kasolife.com</strong> dans Chrome
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold-bright">2</span>
                Appuie sur le menu <strong className="text-cream">⋮</strong> en haut à droite
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold-bright">3</span>
                Sélectionne <strong className="text-cream">«Ajouter à l&apos;écran d&apos;accueil»</strong>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 text-[10px] font-bold text-gold-bright">4</span>
                Confirme en appuyant sur <strong className="text-cream">Ajouter</strong>
              </li>
            </ol>
          </div>

          {/* Info */}
          <div className="rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 text-sm text-sage">
            <p className="font-medium text-gold-bright mb-1">Pourquoi installer l&apos;app ?</p>
            <ul className="flex flex-col gap-1 text-sage-muted">
              <li>• Accès rapide depuis ton écran d&apos;accueil</li>
              <li>• Expérience plein écran sans la barre du navigateur</li>
              <li>• Notifications push (Android)</li>
              <li>• Fonctionne hors connexion pour les pages déjà visitées</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Button asChild variant="secondary">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Retour à l&apos;accueil
            </Link>
          </Button>
        </div>
      </main>
    </>
  );
}
