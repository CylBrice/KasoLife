"use client";

// Page créateur : gestion des demandes Private Chat entrantes
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Video, Clock, Camera, Check, X, RefreshCw, PhoneIncoming } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFCFA, formatRelativeDate } from "@/lib/utils";
import { api } from "@/lib/api";

interface Request {
  id: string;
  fan_id: string;
  package_minutes: number;
  price_xcon: number;
  cam2cam_required: boolean;
  request_expires_at: string;
  created_at: string;
  fan?: { id: string; pseudo: string; avatar_url?: string };
}

export default function CreateurPrivateChatPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/private-chat/requests/pending");
      setRequests(data.requests || []);
    } catch {
      // silencieux
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Rafraîchir toutes les 60s (réduit de 20s → 60s = 66% moins de requêtes)
  useEffect(() => {
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const accept = async (req: Request) => {
    setActing(req.id);
    try {
      const { data } = await api.post(`/private-chat/requests/${req.id}/accept`);
      router.push(`/private-chat/${req.id}`);
    } catch (err: any) {
      alert(err?.response?.data?.error || "Erreur");
    } finally {
      setActing(null);
    }
  };

  const reject = async (req: Request) => {
    setActing(req.id);
    try {
      await api.post(`/private-chat/requests/${req.id}/reject`, { reason: "Indisponible pour le moment" });
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err: any) {
      alert(err?.response?.data?.error || "Erreur");
    } finally {
      setActing(null);
    }
  };

  // Délai restant
  const getExpiry = (expiresAt: string) => {
    const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    if (left <= 0) return "Expiré";
    const m = Math.floor(left / 60);
    const s = left % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-cream flex items-center gap-2">
            <PhoneIncoming className="h-5 w-5 text-gold" />
            Demandes Private Chat
          </h2>
          <p className="text-sm text-sage-muted mt-0.5">Acceptez ou refusez les demandes de session 1-to-1</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" />
          Actualiser
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <RefreshCw className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-line py-14 text-center">
          <Video className="mx-auto mb-3 h-8 w-8 text-sage-muted" />
          <p className="text-sage-muted text-sm">Aucune demande en attente</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-line bg-ink-surface p-4">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-ink-raised">
                {req.fan?.avatar_url ? (
                  <Image src={req.fan.avatar_url} alt="" fill sizes="40px" className="object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gold font-display">
                    {req.fan?.pseudo?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-cream">@{req.fan?.pseudo}</span>
                  {req.cam2cam_required && (
                    <Badge variant="default" className="flex items-center gap-1">
                      <Camera className="h-3 w-3" />Cam2Cam
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-sage-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />{req.package_minutes} min
                  </span>
                  <span className="font-mono text-gold">{formatFCFA(req.price_xcon)}</span>
                  <span className="text-brick font-mono">⏱ {getExpiry(req.request_expires_at)}</span>
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acting === req.id}
                  onClick={() => reject(req)}
                  className="border-brick/40 text-brick hover:bg-brick/10"
                >
                  <X className="h-3.5 w-3.5" />
                  Refuser
                </Button>
                <Button
                  size="sm"
                  disabled={acting === req.id}
                  onClick={() => accept(req)}
                >
                  <Check className="h-3.5 w-3.5" />
                  Accepter
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
