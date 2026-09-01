"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/i18n/locale-context";

export default function KycResultPage() {
  const t = useT();
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;

    // Le traitement webhook Didit peut prendre quelques secondes —
    // on vérifie périodiquement le statut.
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const { data } = await api.get("/kyc/result");
        if (data.kyc_status !== "PENDING" || attempts >= 10) {
          setStatus(data.kyc_status);
          setChecking(false);
          clearInterval(interval);
          if (data.kyc_status === "VERIFIED") await refresh();
        }
      } catch {
        if (attempts >= 10) { setChecking(false); clearInterval(interval); }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [user, refresh]);

  if (loading || !user) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-lg px-4 pb-24 pt-6 md:pb-12">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            {checking ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-gold" />
                <p className="font-display text-lg text-cream">{t("kyc.result.processing")}</p>
                <p className="text-sm text-sage">
                  Nous vérifions le résultat de votre vérification d&apos;identité.
                </p>
              </>
            ) : status === "VERIFIED" ? (
              <>
                <ShieldCheck className="h-10 w-10 text-emerald-bright" />
                <p className="font-display text-lg text-cream">{t("kyc.result.verified")}</p>
                <p className="text-sm text-sage">
                  Vous pouvez maintenant devenir créateur et effectuer des retraits.
                </p>
                <Button onClick={() => router.push("/devenir-createur")}>{t("kyc.result.becomeCreator")}</Button>
              </>
            ) : (
              <>
                <ShieldAlert className="h-10 w-10 text-coral" />
                <p className="font-display text-lg text-cream">Vérification en cours de traitement</p>
                <p className="text-sm text-sage">
                  Le résultat n&apos;est pas encore disponible. Vous recevrez une notification
                  dès qu&apos;il sera traité (généralement sous quelques minutes).
                </p>
                <Button variant="secondary" onClick={() => router.push("/profil")}>Retour au profil</Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
