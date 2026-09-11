"use client";

// ============================================================
// KASOLIFE — Page fan : demande Private Show
// Fan choisit type (STANDARD/PREMIUM) + durée + bid.
// Bid bloqué immédiatement → écran d'attente avec position
// dans la file, countdown et possibilité de surenchérir.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Video, Clock, Crown, Eye, TrendingUp, CheckCircle,
  Loader2, AlertTriangle, ArrowUp, X, Users,
} from "lucide-react";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { AmountInput } from "@/components/ui/amount-input";
import { Badge } from "@/components/ui/badge";
import { formatFCFA, cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

const PACKAGES = [15, 30, 45, 60] as const;
type ShowType  = "STANDARD" | "PREMIUM";

interface CreatorInfo {
  id: string; pseudo: string; display_name?: string; avatar_url?: string;
}
interface PriceRow {
  show_type: ShowType; duration_min: number;
  price_xcon: number; spy_price_per_min_xcon?: number;
}
interface QueueEntry {
  id: string; bid_xcon: number; status: string; expires_at: string;
  show_type: ShowType; package_minutes: number;
}
interface ActiveShow { id: string }

type Step = "form" | "waiting" | "accepted";

// ── Helpers ──────────────────────────────────────────────────
const fmt = (s: number) => {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};

export default function PrivateShowDemandePage() {
  const { user, loading } = useAuth();
  const router            = useRouter();
  const searchParams      = useSearchParams();
  const creatorId         = searchParams.get("creator");

  const [creator, setCreator]       = useState<CreatorInfo | null>(null);
  const [prices, setPrices]         = useState<PriceRow[]>([]);
  const [selectedType, setType]     = useState<ShowType>("STANDARD");
  const [selectedMin, setMin]       = useState<15 | 30 | 45 | 60>(15);
  const [bidAmount, setBidAmount]   = useState("");
  const [step, setStep]             = useState<Step>("form");
  const [queueEntry, setQueueEntry] = useState<QueueEntry | null>(null);
  const [activeShow, setActiveShow] = useState<ActiveShow | null>(null);
  const [queuePos, setQueuePos]     = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [raising, setRaising]       = useState(false);
  const [newBid, setNewBid]         = useState("");
  const [error, setError]           = useState<string | null>(null);
  const [raiseError, setRaiseError] = useState<string | null>(null);
  const [countdown, setCountdown]   = useState(0);

  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  useEffect(() => {
    if (!creatorId) return;
    api.get(`/creators/${creatorId}`).then(({ data }) => setCreator(data)).catch(() => {});
    api.get(`/private-shows/prices/${creatorId}`).then(({ data }) => {
      const p: PriceRow[] = data.prices || [];
      setPrices(p);
      // Pré-sélectionner le premier forfait disponible
      const first = p.find((r) => r.show_type === "STANDARD" && r.duration_min === 15);
      if (first) {
        setBidAmount(first.price_xcon.toString());
      }
    }).catch(() => {});
  }, [creatorId]);

  // Prix du forfait actuellement sélectionné
  const currentPrice = prices.find(
    (p) => p.show_type === selectedType && p.duration_min === selectedMin,
  );

  // Quand type ou durée change, ajuster le bid au minimum
  useEffect(() => {
    if (currentPrice) {
      setBidAmount((prev) => {
        const n = parseInt(prev);
        if (!n || n < currentPrice.price_xcon) return currentPrice.price_xcon.toString();
        return prev;
      });
    }
  }, [currentPrice]);

  // ── Polling position dans la queue ────────────────────────
  const startPolling = useCallback((entryId: string, cid: string) => {
    pollRef.current = setInterval(async () => {
      try {
        // Récupérer la queue du créateur (endpoint public pour la position)
        const { data } = await api.get(`/private-shows/queue/position?entry_id=${entryId}&creator_id=${cid}`).catch(async () => {
          // Fallback : vérifier si le show a démarré
          const qData = await api.get(`/private-shows/queue/${entryId}/status`).catch(() => null);
          return qData;
        });
        if (!data) return;

        if (data.status === "ACCEPTED" && data.show_id) {
          clearInterval(pollRef.current!);
          clearInterval(countdownRef.current!);
          setActiveShow({ id: data.show_id });
          setStep("accepted");
        } else if (data.status === "REJECTED" || data.status === "EXPIRED" || data.status === "CANCELLED") {
          clearInterval(pollRef.current!);
          clearInterval(countdownRef.current!);
          setError("Votre demande a été refusée ou a expiré. Vous avez été remboursé.");
          setStep("form");
        } else if (data.position != null) {
          setQueuePos(data.position);
        }
      } catch {}
    }, 5000);
  }, []);

  // Countdown expiry
  const startCountdown = useCallback((expiresAt: string) => {
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setCountdown(left);
      if (left === 0) clearInterval(countdownRef.current!);
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current)      clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ── Soumettre la demande ──────────────────────────────────
  const handleSubmit = async () => {
    if (!currentPrice || !creatorId) return;
    const bid = parseInt(bidAmount);
    if (!bid || bid < currentPrice.price_xcon) {
      setError(`Bid minimum : ${formatFCFA(currentPrice.price_xcon)}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post("/private-shows/queue", {
        creator_id:      creatorId,
        show_type:       selectedType,
        package_minutes: selectedMin,
        bid_xcon:        bid,
      });
      setQueueEntry(data.entry);
      setStep("waiting");
      startCountdown(data.entry.expires_at);
      startPolling(data.entry.id, creatorId);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur lors de la demande");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Annuler la demande ────────────────────────────────────
  const handleCancel = async () => {
    if (!queueEntry) return;
    try {
      await api.delete(`/private-shows/queue/${queueEntry.id}`);
      clearInterval(pollRef.current!);
      clearInterval(countdownRef.current!);
      setStep("form");
      setQueueEntry(null);
    } catch (err: any) {
      alert(err?.response?.data?.error || "Erreur lors de l'annulation");
    }
  };

  // ── Surenchérir ───────────────────────────────────────────
  const handleRaise = async () => {
    if (!queueEntry || !newBid) return;
    const raised = parseInt(newBid);
    if (!raised || raised <= queueEntry.bid_xcon) {
      setRaiseError(`Nouveau bid doit être > ${formatFCFA(queueEntry.bid_xcon)}`);
      return;
    }
    setRaising(true);
    setRaiseError(null);
    try {
      const { data } = await api.patch(`/private-shows/queue/${queueEntry.id}/bid`, {
        new_bid_xcon: raised,
      });
      setQueueEntry((prev) => prev ? { ...prev, bid_xcon: raised } : prev);
      setNewBid("");
    } catch (err: any) {
      setRaiseError(err?.response?.data?.error || "Erreur");
    } finally {
      setRaising(false);
    }
  };

  if (loading || !user) return null;
  if (!creatorId) {
    return (
      <div className="flex h-48 items-center justify-center text-sage-muted text-sm">
        Paramètre manquant — retournez sur le profil du créateur.
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // ÉCRAN : ACCEPTÉ → rejoindre le show
  // ════════════════════════════════════════════════════════
  if (step === "accepted" && activeShow) {
    return (
      <>
        <main className="mx-auto max-w-lg px-4 pb-24 pt-6 md:pb-12">
          <div className="rounded-2xl border border-emerald/30 bg-emerald/10 p-6 text-center">
            <CheckCircle className="mx-auto mb-3 h-10 w-10 text-emerald" />
            <p className="font-display text-xl text-cream">Le créateur vous accepte !</p>
            <p className="mt-1 text-sm text-sage-muted">
              Rejoignez le show maintenant — il démarre.
            </p>
            <Button
              className="mt-5 w-full"
              onClick={() => router.push(`/private-shows/${activeShow.id}`)}
            >
              <Video className="h-4 w-4 mr-2" />
              Rejoindre le Private Show
            </Button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // ════════════════════════════════════════════════════════
  // ÉCRAN : EN ATTENTE
  // ════════════════════════════════════════════════════════
  if (step === "waiting" && queueEntry) {
    return (
      <>
        <main className="mx-auto max-w-lg px-4 pb-24 pt-6 md:pb-12 space-y-5">
          <h1 className="font-display text-2xl font-medium text-cream">File d&apos;attente</h1>

          {/* Statut */}
          <div className="rounded-2xl border border-gold/30 bg-gold/10 p-5 text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              <Users className="h-5 w-5 text-gold" />
              <p className="font-medium text-cream">
                {queuePos != null ? `Position #${queuePos}` : "En attente…"}
              </p>
            </div>
            <p className="text-sm text-sage-muted">
              Le créateur voit votre demande et répondra bientôt.
            </p>
            {/* Bid actuel */}
            <div className="rounded-xl bg-ink-raised px-4 py-3">
              <p className="text-xs text-sage-muted mb-1">Votre enchère actuelle</p>
              <p className="font-display text-2xl font-bold text-gold">
                {formatFCFA(queueEntry.bid_xcon)}
              </p>
              <p className="text-xs text-sage-muted mt-0.5">
                {queueEntry.show_type} · {queueEntry.package_minutes} min
              </p>
            </div>
            {/* Countdown expiry */}
            {countdown > 0 && (
              <div className="text-xs text-sage-muted">
                Le créateur a{" "}
                <span className={cn("font-mono font-semibold", countdown < 60 ? "text-brick" : "text-cream")}>
                  {fmt(countdown)}
                </span>{" "}
                pour répondre
              </div>
            )}
            {countdown === 0 && (
              <p className="text-xs text-brick">Délai expiré — vous allez être remboursé.</p>
            )}
          </div>

          {/* Surenchérir */}
          <div className="rounded-xl border border-ink-line bg-ink-surface p-4 space-y-3">
            <p className="text-sm font-medium text-cream flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gold" />
              Augmenter votre enchère
            </p>
            <p className="text-xs text-sage-muted">
              Un bid plus élevé remonte votre position dans la file.
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                value={newBid}
                onChange={(e) => setNewBid(e.target.value)}
                placeholder={`> ${queueEntry.bid_xcon}`}
                className="flex-1 rounded-xl border border-ink-line bg-ink px-3 py-2 text-sm text-cream placeholder:text-sage-muted/50 focus:outline-none focus:ring-1 focus:ring-gold/40"
              />
              <Button size="sm" onClick={handleRaise} disabled={raising || !newBid}>
                {raising ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
                Surenchérir
              </Button>
            </div>
            {raiseError && <p className="text-xs text-brick">{raiseError}</p>}
          </div>

          {/* Annuler */}
          <Button variant="outline" className="w-full border-brick/40 text-brick hover:bg-brick/10" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            Annuler et être remboursé
          </Button>
        </main>
        <Footer />
      </>
    );
  }

  // ════════════════════════════════════════════════════════
  // ÉCRAN : FORMULAIRE
  // ════════════════════════════════════════════════════════

  // Vérifier si le créateur a configuré des prix
  const hasStandard = prices.some((p) => p.show_type === "STANDARD");
  const hasPremium  = prices.some((p) => p.show_type === "PREMIUM");

  return (
    <>
      <main className="mx-auto max-w-lg px-4 pb-24 pt-6 md:pb-12 space-y-5">
        <h1 className="font-display text-2xl font-medium text-cream">Private Show</h1>

        {/* Créateur */}
        {creator && (
          <div className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-surface p-4">
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

        {prices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-line py-10 text-center">
            <Video className="mx-auto mb-3 h-8 w-8 text-sage-muted" />
            <p className="text-sage-muted text-sm">Ce créateur n&apos;a pas encore configuré ses tarifs Private Show.</p>
          </div>
        ) : (
          <>
            {/* Sélection du type */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-sage">Type de show</p>
              <div className="grid grid-cols-2 gap-2">
                {([["STANDARD", Eye, "Spy autorisé"], ["PREMIUM", Crown, "Exclusif — sans spy"]] as const).map(
                  ([type, Icon, desc]) => {
                    const available = type === "STANDARD" ? hasStandard : hasPremium;
                    return (
                      <button
                        key={type}
                        disabled={!available}
                        onClick={() => { setType(type); }}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-xl border px-4 py-3 text-sm transition-colors",
                          !available && "cursor-not-allowed opacity-40",
                          selectedType === type && available
                            ? "border-gold/60 bg-gold/10"
                            : "border-ink-line bg-ink-surface hover:border-gold/30",
                        )}
                      >
                        <Icon className={cn("h-5 w-5", selectedType === type ? "text-gold" : "text-sage-muted")} />
                        <span className={cn("font-medium", selectedType === type ? "text-gold" : "text-cream")}>
                          {type === "STANDARD" ? "Standard" : "Premium"}
                        </span>
                        <span className="text-[10px] text-sage-muted">{desc}</span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Sélection durée */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-sage">Durée</p>
              <div className="grid grid-cols-4 gap-2">
                {PACKAGES.map((min) => {
                  const row = prices.find((p) => p.show_type === selectedType && p.duration_min === min);
                  if (!row) return null;
                  return (
                    <button
                      key={min}
                      onClick={() => setMin(min)}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-xl border px-2 py-3 transition-colors",
                        selectedMin === min
                          ? "border-gold/60 bg-gold/10"
                          : "border-ink-line bg-ink-surface hover:border-gold/30",
                      )}
                    >
                      <Clock className={cn("h-4 w-4", selectedMin === min ? "text-gold" : "text-sage-muted")} />
                      <span className={cn("text-sm font-medium", selectedMin === min ? "text-gold" : "text-cream")}>
                        {min} min
                      </span>
                      <span className={cn("font-mono text-[10px]", selectedMin === min ? "text-gold/80" : "text-sage-muted")}>
                        {formatFCFA(row.price_xcon)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bid */}
            {currentPrice && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-sage flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-gold" />
                    Votre enchère (XCon)
                  </label>
                  <input
                    type="number"
                    value={bidAmount}
                    min={currentPrice.price_xcon}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="w-full rounded-xl border border-ink-line bg-ink px-4 py-3 text-cream focus:outline-none focus:ring-1 focus:ring-gold/40"
                  />
                  <p className="text-xs text-sage-muted">
                    Minimum {formatFCFA(currentPrice.price_xcon)} — une enchère plus haute remonte votre position
                  </p>
                </div>

                {/* Spy info */}
                {selectedType === "STANDARD" && currentPrice.spy_price_per_min_xcon && (
                  <div className="flex items-center gap-2 rounded-xl border border-ink-line bg-ink-surface px-4 py-3">
                    <Eye className="h-4 w-4 shrink-0 text-sage-muted" />
                    <p className="text-xs text-sage-muted">
                      Des spectateurs pourront rejoindre en mode Spy ({formatFCFA(currentPrice.spy_price_per_min_xcon)}/min)
                    </p>
                  </div>
                )}
                {selectedType === "PREMIUM" && (
                  <div className="flex items-center gap-2 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3">
                    <Crown className="h-4 w-4 shrink-0 text-gold" />
                    <p className="text-xs text-gold/80">
                      Show Premium exclusif — aucun spectateur ne peut rejoindre en Spy
                    </p>
                  </div>
                )}

                {/* Récap */}
                <div className="rounded-xl border border-ink-line bg-ink-raised p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-sage">Type</span>
                    <Badge variant={selectedType === "PREMIUM" ? "gold" : "default"} className="flex items-center gap-1">
                      {selectedType === "PREMIUM" ? <Crown className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                      {selectedType}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sage">Durée</span>
                    <span className="text-cream">{selectedMin} minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sage">Débité maintenant</span>
                    <span className="font-mono font-semibold text-gold">
                      {formatFCFA(parseInt(bidAmount) || 0)}
                    </span>
                  </div>
                  <p className="text-xs text-sage-muted pt-1 border-t border-ink-line">
                    Remboursé si refus ou si la session se termine avant le forfait (prorata).
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-brick/30 bg-brick/10 px-4 py-3 text-sm text-brick">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              className="w-full"
              disabled={!currentPrice || submitting || !bidAmount}
              onClick={handleSubmit}
            >
              {submitting
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Envoi…</>
                : <><Video className="h-4 w-4 mr-2" />Entrer dans la file</>
              }
            </Button>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
