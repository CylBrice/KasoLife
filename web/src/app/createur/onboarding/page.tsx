"use client";

// Onboarding créateur guidé (4.4) — barre de progression non-bloquante
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, Circle, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface Step {
  key: string;
  label: string;
  done: boolean;
}

interface OnboardingData {
  steps: Step[];
  completed: number;
  total: number;
  percent: number;
}

const STEP_LINKS: Record<string, { href: string; cta: string }> = {
  avatar:     { href: "/createur/profil",   cta: "Ajouter ma photo" },
  bio:        { href: "/createur/profil",   cta: "Écrire ma bio" },
  first_post: { href: "/createur/posts",    cta: "Publier un contenu" },
  sub_price:  { href: "/abonnements",       cta: "Fixer mon prix" },
  first_sub:  { href: "/createur",          cta: "Partager mon profil" },
};

export default function CreateurOnboardingPage() {
  const [data, setData]     = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/creators/me/onboarding")
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
  );

  if (!data) return null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="text-center">
        <Sparkles className="mx-auto mb-3 h-8 w-8 text-gold" />
        <h2 className="font-display text-2xl font-medium text-cream">Bienvenue sur KasoLife</h2>
        <p className="text-sm text-sage-muted mt-1">Complétez ces étapes pour attirer vos premiers fans</p>
      </div>

      {/* Barre de progression */}
      <div className="rounded-xl border border-ink-line bg-ink-surface p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-sage">{data.completed}/{data.total} étapes complétées</span>
          <span className="font-mono text-lg font-bold text-gold">{data.percent}%</span>
        </div>
        <div className="h-3 w-full rounded-full bg-ink-raised overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold/80 to-gold transition-all duration-700"
            style={{ width: `${data.percent}%` }}
          />
        </div>
        {data.percent === 100 && (
          <p className="text-center text-sm text-emerald-400 mt-3 font-medium">
            Profil complet — vous êtes prêt à monétiser !
          </p>
        )}
      </div>

      {/* Liste des étapes */}
      <div className="space-y-2">
        {data.steps.map((step, i) => {
          const link = STEP_LINKS[step.key];
          return (
            <div
              key={step.key}
              className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${
                step.done
                  ? "border-emerald-400/20 bg-emerald-400/5"
                  : "border-ink-line bg-ink-surface hover:border-gold/30"
              }`}
            >
              <div className="shrink-0">
                {step.done
                  ? <CheckCircle className="h-6 w-6 text-emerald-400" />
                  : <Circle className="h-6 w-6 text-sage-muted" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${step.done ? "text-sage line-through" : "text-cream"}`}>
                  {step.label}
                </p>
              </div>
              {!step.done && link && (
                <Link href={link.href}>
                  <Button size="sm" variant="outline">
                    {link.cta}
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* Lien vers le profil public */}
      <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 text-center">
        <p className="text-sm text-sage-muted">Partagez votre profil pour gagner vos premiers abonnés</p>
        <Link href="/createur" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-gold hover:underline">
          Voir mon profil public <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
