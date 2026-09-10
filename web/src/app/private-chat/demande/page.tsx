"use client";

// Page de demande Private Chat — accessible via /private-chat/demande?creator=<id>
// Fan choisit son forfait, paie, attend l'acceptation du créateur.

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Clock, Video, Camera, CheckCircle, Loader2, AlertTriangle,
} from "lucide-react";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFCFA } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

interface Package { minutes: number; price_xcon: number; label: string; }
interface Creator { id: string; pseudo: string; avatar_url?: string; display_name?: string; }

export default function PrivateChatDemandePage() {
  const { user, loading } = useAuth();
  const router            = useRouter();
  const searchParams      = useSearchParams();
  const creatorId         = searchParams.get("creator");

  const [creator, setCreator]           = useState<Creator | null>(null);
  const [packages, setPackages]         = useState<Package[]>([]);
  const [selected, setSelected]         = useState<Package | null>(null);
  const [cam2cam, setCam2cam]           = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [chatId, setChatId]             = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  useEffect(() => {
    if (!creatorId) return;
    api.get(`/creators/${creatorId}`).then(({ data }) => setCreator(data)).catch(() => {});
    api.get("/private-chat/packages").then(({ data }) => {
      setPackages(data.packages || []);
      if (data.packages?.length) setSelected(data.packages[0]);
    }).catch(() => {});
  }, [creatorId]);

  const handleRequest = async () => {
    if (!selected || !creatorId) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post("/private-chat/request", {
        creator_id: creatorId,
        package_minutes: selected.minutes,
        cam2cam,
      });
      setChatId(data.chat.id);
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur lors de la demande");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) return null;
  if (!creatorId) return (
    <div className="flex h-48 items-center justify-center text-sage-muted text-sm">
      Paramètre manquant — retournez sur le profil du créateur.
    </div>
  );

  return (
    <>
      <main className="mx-auto max-w-lg px-4 pb-24 pt-6 md:pb-12">
        <h1 className="font-display text-2xl font-medium text-cream mb-5">Private Chat</h1>

        {/* Créateur */}
        {creator && (
          <div className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-surface p-4 mb-5">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-ink-raised">
              {creator.avatar_url ? (
                <Image src={creator.avatar_url} alt="" fill sizes="48px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-gold">
                  {(creator.display_name || creator.pseudo)[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="font-medium text-cream">{creator.display_name || creator.pseudo}</p>
              <p className="text-sm text-sage-muted">@{creator.pseudo}</p>
            </div>
          </div>
        )}

        {submitted ? (
          /* ── Confirmation ── */
          <div className="rounded-2xl border border-emerald/30 bg-emerald/10 p-6 text-center">
            <CheckCircle className="mx-auto mb-3 h-10 w-10 text-emerald" />
            <p className="font-display text-lg text-cream">Demande envoyée !</p>
            <p className="mt-1 text-sm text-sage-muted">
              Le créateur a quelques minutes pour accepter. Vous serez notifié dès qu&apos;il répond.
            </p>
            <div className="mt-4 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push("/messages")}
              >
                Mes messages
              </Button>
              {chatId && (
                <Button
                  className="flex-1"
                  onClick={() => router.push(`/private-chat/${chatId}`)}
                >
                  Rejoindre la session
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Forfaits */}
            <div className="space-y-2 mb-5">
              <p className="text-sm font-medium text-sage mb-2">Choisissez votre forfait</p>
              {packages.map((pkg) => (
                <button
                  key={pkg.minutes}
                  onClick={() => setSelected(pkg)}
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                    selected?.minutes === pkg.minutes
                      ? "border-gold/60 bg-gold/10"
                      : "border-ink-line bg-ink-surface hover:border-gold/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Clock className={`h-5 w-5 ${selected?.minutes === pkg.minutes ? "text-gold" : "text-sage-muted"}`} />
                    <span className={`font-medium ${selected?.minutes === pkg.minutes ? "text-gold" : "text-cream"}`}>
                      {pkg.label}
                    </span>
                  </div>
                  <span className={`font-mono font-semibold ${selected?.minutes === pkg.minutes ? "text-gold" : "text-cream"}`}>
                    {formatFCFA(pkg.price_xcon)}
                  </span>
                </button>
              ))}
            </div>

            {/* Option Cam2Cam */}
            <button
              onClick={() => setCam2cam(!cam2cam)}
              className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 mb-5 transition-colors ${
                cam2cam ? "border-gold/60 bg-gold/10" : "border-ink-line bg-ink-surface hover:border-gold/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <Camera className={`h-5 w-5 ${cam2cam ? "text-gold" : "text-sage-muted"}`} />
                <div className="text-left">
                  <p className={`font-medium ${cam2cam ? "text-gold" : "text-cream"}`}>Mode Cam2Cam</p>
                  <p className="text-xs text-sage-muted">Votre webcam sera activée — le créateur peut la voir</p>
                </div>
              </div>
              <Badge variant={cam2cam ? "emerald" : "default"}>{cam2cam ? "Activé" : "Optionnel"}</Badge>
            </button>

            {/* Récapitulatif */}
            {selected && (
              <div className="rounded-xl border border-ink-line bg-ink-raised p-4 mb-5 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-sage">Durée</span>
                  <span className="text-cream">{selected.minutes} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sage">Total débité maintenant</span>
                  <span className="font-mono font-semibold text-gold">{formatFCFA(selected.price_xcon)}</span>
                </div>
                <p className="text-xs text-sage-muted pt-1">
                  Si la session se termine avant le forfait, vous serez remboursé au prorata.
                </p>
              </div>
            )}

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-brick/30 bg-brick/10 px-4 py-3 text-sm text-brick">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              className="w-full"
              disabled={!selected || submitting}
              onClick={handleRequest}
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Envoi en cours…</>
              ) : (
                <><Video className="h-4 w-4 mr-2" />Envoyer la demande</>
              )}
            </Button>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
