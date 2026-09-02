"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCategoryIcon } from "@/lib/categories";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/i18n/locale-context";
import type { Category } from "@/types";

export default function DevenirCreateurPage() {
  const t = useT();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<{ status: string; rejection_reason?: string } | null>(null);
  const [form, setForm] = useState({ category_id: "", display_name: "", motivation: "", subscription_price_xcon: "1000" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [priceSuggestion, setPriceSuggestion] = useState<{ suggested_xcon: number; basis: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api.get("/creators/categories").then(({ data }) => setCategories(data || []));
    api.get("/creators/apply/status").then(({ data }) => setStatus(data)).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!form.category_id) { setPriceSuggestion(null); return; }
    api.get("/creators/price-suggestion", { params: { category_id: form.category_id } })
      .then(({ data }) => setPriceSuggestion(data))
      .catch(() => setPriceSuggestion(null));
  }, [form.category_id]);

  if (loading || !user) return null;

  if (user.['influencer','admin','super_admin','root_admin'].includes(role)) {
    return (
      <PageShell>
        <Card><CardContent className="p-6 text-center">
          <p className="font-display text-lg text-cream">Vous êtes déjà créateur 🎉</p>
          <p className="mt-1 text-sm text-sage">Gérez votre profil depuis votre tableau de bord.</p>
        </CardContent></Card>
      </PageShell>
    );
  }

  if (user.kyc_status !== "VERIFIED") {
    return (
      <PageShell>
        <Card><CardContent className="p-6 text-center">
          <p className="font-display text-lg text-cream">Vérification d&apos;identité requise</p>
          <p className="mt-1 text-sm text-sage">
            Pour devenir créateur, vous devez d&apos;abord vérifier votre identité (KYC).
          </p>
          <Button className="mt-4" onClick={() => router.push("/profil/kyc")}>{t("becomeCreator.verifyIdentity")}</Button>
        </CardContent></Card>
      </PageShell>
    );
  }

  if (status?.status === "PENDING") {
    return (
      <PageShell>
        <Card><CardContent className="p-6 text-center">
          <p className="font-display text-lg text-cream">Candidature en cours d&apos;examen</p>
          <p className="mt-1 text-sm text-sage">Notre équipe l&apos;examine sous 24-48h.</p>
        </CardContent></Card>
      </PageShell>
    );
  }

  if (success) {
    return (
      <PageShell>
        <Card><CardContent className="p-6 text-center">
          <p className="font-display text-lg text-cream">Candidature envoyée ✅</p>
          <p className="mt-1 text-sm text-sage">Vous recevrez une notification dès qu&apos;elle sera traitée.</p>
        </CardContent></Card>
      </PageShell>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/creators/apply", {
        ...form,
        subscription_price_xcon: Number(form.subscription_price_xcon),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur lors de l'envoi de la candidature.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell>
      <h1 className="font-display text-2xl font-medium text-cream">{t("becomeCreator.title")}</h1>
      <p className="mt-1 text-sm text-sage">
        Choisissez votre catégorie, fixez votre prix d&apos;abonnement et commencez à publier.
      </p>

      {status?.status === "REJECTED" && (
        <p className="mt-4 rounded-xl border border-brick/30 bg-brick/10 px-3 py-2 text-sm text-brick">
          Votre précédente candidature a été refusée : {status.rejection_reason}. Vous pouvez en soumettre une nouvelle.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium text-cream">Catégorie</label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {categories.map((cat) => {
              const Icon = getCategoryIcon(cat.slug);
              const active = form.category_id === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category_id: cat.id }))}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm transition-colors ${
                    active ? "border-gold bg-gold/10 text-gold-bright" : "border-ink-line bg-ink-surface text-sage hover:text-cream"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        <Input
          label={t("becomeCreator.displayName")}
          required
          placeholder="Comment vos abonnés vous verront"
          value={form.display_name}
          onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
        />

        <div>
          <Input
            label={t("becomeCreator.subscriptionPrice")}
            type="number"
            min={500}
            max={100000}
            required
            value={form.subscription_price_xcon}
            onChange={(e) => setForm((f) => ({ ...f, subscription_price_xcon: e.target.value }))}
          />
          {priceSuggestion && (
            <div className="mt-1.5 flex items-center justify-between rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold-bright">
              <span>
                Suggestion : {priceSuggestion.suggested_xcon.toLocaleString("fr-FR")} FCFA — {priceSuggestion.basis}
              </span>
              <button
                type="button"
                className="ml-2 shrink-0 font-medium underline"
                onClick={() => setForm((f) => ({ ...f, subscription_price_xcon: String(priceSuggestion.suggested_xcon) }))}
              >
                Utiliser
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-cream">Présentez-vous (optionnel)</label>
          <textarea
            className="min-h-24 rounded-xl border border-ink-line bg-ink-surface px-3.5 py-2.5 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            placeholder="Quel contenu allez-vous proposer ?"
            value={form.motivation}
            onChange={(e) => setForm((f) => ({ ...f, motivation: e.target.value }))}
          />
        </div>

        <div className="rounded-xl border border-ink-line bg-ink-raised p-3 text-sm text-sage">
          KasoLife prélève 20% sur les abonnements, pourboires et contenus payants.
          Vous recevez 80% directement dans votre solde en attente, que vous pouvez retirer dès 5 000 FCFA.
        </div>

        {error && <p className="text-sm text-brick">{error}</p>}

        <Button type="submit" disabled={!form.category_id || submitting}>
          {submitting ? t("becomeCreator.submitting") : t("becomeCreator.submit")}
        </Button>
      </form>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:pb-12">{children}</main>
      <BottomNav />
      <Footer />
    </>
  );
}
