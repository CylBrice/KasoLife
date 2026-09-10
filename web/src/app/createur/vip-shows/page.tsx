"use client";

// Page créateur : lancer et gérer un VIP Show
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Users, Clock, Play, Square, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatFCFA } from "@/lib/utils";
import { api } from "@/lib/api";

type ShowStatus = "idle" | "creating" | "waiting" | "starting" | "live";

export default function CreateurVipShowsPage() {
  const router  = useRouter();
  const [showStatus, setShowStatus] = useState<ShowStatus>("idle");
  const [showId, setShowId]         = useState<string | null>(null);
  const [graceLeft, setGraceLeft]   = useState<number | null>(null);
  const [fanCount, setFanCount]     = useState(0);
  const [error, setError]           = useState<string | null>(null);

  // Formulaire
  const [title, setTitle]           = useState("");
  const [price, setPrice]           = useState(5000);
  const [minFans, setMinFans]       = useState(2);
  const [graceMinutes, setGraceMinutes] = useState(5);

  // Polling fans
  useEffect(() => {
    if (!showId || showStatus !== "live") return;
    const id = setInterval(async () => {
      try {
        const { data } = await api.get(`/vip-shows/${showId}`);
        setFanCount(data.current_fans || 0);
        if (data.grace_ends_at) {
          const left = Math.max(0, Math.floor((new Date(data.grace_ends_at).getTime() - Date.now()) / 1000));
          setGraceLeft(left);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, [showId, showStatus]);

  const createAndStart = async () => {
    if (!title.trim()) { setError("Titre requis"); return; }
    setError(null);
    setShowStatus("creating");
    try {
      const { data: createData } = await api.post("/vip-shows/create", {
        title, price_xcon: price, min_fans: minFans, grace_minutes: graceMinutes,
      });
      const id = createData.show.id;
      setShowId(id);
      setShowStatus("starting");

      const { data: startData } = await api.post(`/vip-shows/${id}/start`);
      // Ouvrir le viewer créateur avec le token
      router.push(`/vip-shows/${id}?token=${startData.token}&ws=${encodeURIComponent(startData.ws_url)}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur lors de la création");
      setShowStatus("idle");
    }
  };

  const endShow = async () => {
    if (!showId) return;
    try {
      await api.post(`/vip-shows/${showId}/end`);
      setShowStatus("idle");
      setShowId(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur lors de la fin");
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-medium text-cream flex items-center gap-2">
          <Crown className="h-5 w-5 text-gold" />
          VIP Shows
        </h2>
        <p className="text-sm text-sage-muted mt-0.5">
          Show privé — {minFans} fans minimum, {graceMinutes} min gratuites, ensuite accès payant.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-brick/30 bg-brick/10 px-4 py-3 text-sm text-brick">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <label className="block text-xs font-medium text-sage mb-1">Titre du show *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Mon VIP Show exclusif"
              className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-sage mb-1">Prix accès (XAF)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage mb-1">Fans min.</label>
              <input
                type="number"
                min={2}
                value={minFans}
                onChange={(e) => setMinFans(Math.max(2, Number(e.target.value)))}
                className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream focus:border-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage mb-1">Grace (min)</label>
              <input
                type="number"
                min={1}
                max={30}
                value={graceMinutes}
                onChange={(e) => setGraceMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream focus:border-gold focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-xl border border-ink-line bg-ink-raised p-3 text-xs text-sage-muted">
            <p>• Les fans présents pendant les <strong className="text-cream">{graceMinutes} premières minutes</strong> ont accès gratuit au show complet.</p>
            <p className="mt-1">• Les fans qui rejoignent après paient <strong className="text-gold">{formatFCFA(price)}</strong> pour accéder.</p>
            <p className="mt-1">• Le show démarre dès que <strong className="text-cream">{minFans} fans minimum</strong> sont connectés.</p>
          </div>

          <Button
            className="w-full"
            onClick={createAndStart}
            disabled={showStatus !== "idle" || !title.trim()}
          >
            {showStatus === "creating" || showStatus === "starting" ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Démarrage…</>
            ) : (
              <><Play className="h-4 w-4 mr-2" />Lancer le VIP Show</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
