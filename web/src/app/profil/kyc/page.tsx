"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldQuestion, ShieldAlert } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/i18n/locale-context";

interface KycStatus {
  kyc_status: string;
  attempts_left: number;
  max_attempts: number;
}

export default function KycPage() {
  const t = useT();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<KycStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      api.get("/kyc/status").then(({ data }) => setStatus(data)).catch(() => {});
    }
  }, [user]);

  if (loading || !user) return null;

  const handleStart = async () => {
    setError(null);
    setStarting(true);
    try {
      const { data } = await api.post("/kyc/initiate");
      if (data.session_url) {
        window.location.href = data.session_url;
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur lors du lancement de la vérification.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-lg px-4 pb-24 pt-6 md:pb-12">
        <h1 className="font-display text-2xl font-medium text-cream">Vérification d&apos;identité</h1>
        <p className="mt-1 text-sm text-sage">
          KasoLife exige une vérification d&apos;identité (KYC) pour devenir créateur et pour
          retirer vos revenus. Le processus prend quelques minutes via notre partenaire Didit.
        </p>

        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            {status?.kyc_status === "VERIFIED" ? (
              <>
                <ShieldCheck className="h-10 w-10 text-emerald-bright" />
                <p className="font-display text-lg text-cream">Identité vérifiée ✅</p>
                <p className="text-sm text-sage">Vous pouvez devenir créateur et effectuer des retraits.</p>
                <Button onClick={() => router.push("/profil")} variant="secondary">{t("kyc.backToProfile")}</Button>
              </>
            ) : status?.kyc_status === "SUPPORT" ? (
              <>
                <ShieldAlert className="h-10 w-10 text-brick" />
                <p className="font-display text-lg text-cream">Limite de tentatives atteinte</p>
                <p className="text-sm text-sage">Veuillez contacter notre support pour finaliser votre vérification.</p>
              </>
            ) : (
              <>
                <ShieldQuestion className="h-10 w-10 text-gold" />
                <p className="font-display text-lg text-cream">
                  {status?.kyc_status === "FAILED" ? "Vérification échouée" : "Identité non vérifiée"}
                </p>
                <p className="text-sm text-sage">
                  Vous aurez besoin d&apos;une pièce d&apos;identité valide (CNI, passeport) et
                  d&apos;un appareil avec caméra.
                </p>
                {status && (
                  <p className="text-xs text-sage-muted">
                    Tentatives restantes : {status.attempts_left}/{status.max_attempts}
                  </p>
                )}
                {error && <p className="text-sm text-brick">{error}</p>}
                <Button onClick={handleStart} disabled={starting}>
                  {starting ? t("kyc.starting") : t("kyc.start")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
      <BottomNav />
      <Footer />
    </>
  );
}
