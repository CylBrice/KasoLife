"use client";

// Page créateur : gestion des demandes de contenu personnalisé
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { MessageSquarePlus, Check, X, ArrowRightLeft, Upload, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFCFA, formatRelativeDate } from "@/lib/utils";
import { api } from "@/lib/api";

interface CustomRequest {
  id: string;
  fan_id: string;
  fan_pseudo: string;
  fan_avatar?: string;
  description: string;
  budget_xcon: number;
  counter_price_xcon?: number;
  status: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Nouvelle demande", COUNTER_PROPOSED: "Contre-offre envoyée",
  ACCEPTED: "Acceptée", IN_PROGRESS: "En cours", DELIVERED: "Livrée",
  CONFIRMED: "Confirmée", REJECTED: "Refusée", CANCELLED: "Annulée par le fan",
  DISPUTED: "Litige", REFUNDED: "Remboursée",
};

type Tab = "pending" | "active" | "done";

export default function CreateurCustomRequestsPage() {
  const [tab, setTab]           = useState<Tab>("pending");
  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState<string | null>(null);

  // Pour la contre-offre
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [counterPrice, setCounterPrice] = useState(0);

  // Pour la livraison
  const [deliverFor, setDeliverFor]   = useState<string | null>(null);
  const [mediaUrl, setMediaUrl]       = useState("");
  const [deliverMessage, setDeliverMessage] = useState("");

  const statusGroups: Record<Tab, string[]> = {
    pending: ["PENDING", "COUNTER_PROPOSED"],
    active:  ["ACCEPTED", "IN_PROGRESS", "DELIVERED"],
    done:    ["CONFIRMED", "REJECTED", "CANCELLED", "DISPUTED", "REFUNDED"],
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/custom-requests/incoming?limit=50");
      setRequests(data.requests || []);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = requests.filter(r => statusGroups[tab].includes(r.status));

  const accept = async (id: string) => {
    setActing(id);
    try { await api.post(`/custom-requests/${id}/accept`); load(); }
    catch (e: any) { alert(e?.response?.data?.error || "Erreur"); }
    finally { setActing(null); }
  };

  const reject = async (id: string) => {
    const reason = prompt("Motif du refus (optionnel) :") ?? "";
    setActing(id);
    try { await api.post(`/custom-requests/${id}/reject`, { reason }); load(); }
    catch (e: any) { alert(e?.response?.data?.error || "Erreur"); }
    finally { setActing(null); }
  };

  const sendCounter = async (id: string) => {
    if (!counterPrice || counterPrice <= 0) return;
    setActing(id);
    try { await api.post(`/custom-requests/${id}/counter`, { counter_price_xcon: counterPrice }); setCounterFor(null); load(); }
    catch (e: any) { alert(e?.response?.data?.error || "Erreur"); }
    finally { setActing(null); }
  };

  const deliver = async (id: string) => {
    if (!mediaUrl.trim()) { alert("URL du média requise"); return; }
    setActing(id);
    try {
      await api.post(`/custom-requests/${id}/deliver`, {
        media_url: mediaUrl, message: deliverMessage || undefined,
      });
      setDeliverFor(null); setMediaUrl(""); setDeliverMessage("");
      load();
    } catch (e: any) { alert(e?.response?.data?.error || "Erreur"); }
    finally { setActing(null); }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "pending", label: "Nouvelles" },
    { key: "active",  label: "En cours" },
    { key: "done",    label: "Terminées" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-cream flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-gold" />
            Demandes personnalisées
          </h2>
          <p className="text-sm text-sage-muted mt-0.5">Gérez les commandes de contenu de vos fans</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex gap-1 rounded-xl border border-ink-line bg-ink-raised p-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-xl py-1.5 text-xs font-medium transition-colors ${
              tab === t.key ? "bg-ink-surface text-cream shadow" : "text-sage-muted hover:text-sage"
            }`}
          >
            {t.label}
            {t.key !== "done" && (
              <span className="ml-1 text-gold">
                ({requests.filter(r => statusGroups[t.key].includes(r.status)).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-line py-14 text-center">
          <MessageSquarePlus className="mx-auto mb-3 h-8 w-8 text-sage-muted" />
          <p className="text-sage-muted text-sm">Aucune demande dans cette catégorie</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(req => (
            <div key={req.id} className="rounded-xl border border-ink-line bg-ink-surface p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ink-raised">
                  {req.fan_avatar
                    ? <Image src={req.fan_avatar} alt="" fill sizes="36px" className="object-cover" />
                    : <div className="flex h-full w-full items-center justify-center text-gold font-display text-sm">{req.fan_pseudo[0]?.toUpperCase()}</div>
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-cream">@{req.fan_pseudo}</span>
                    <span className="text-xs text-sage-muted">{formatRelativeDate(req.created_at)}</span>
                  </div>
                  <p className="text-xs text-sage-muted">{STATUS_LABEL[req.status] || req.status}</p>
                </div>
              </div>

              <p className="text-sm text-sage leading-relaxed">{req.description}</p>

              <div className="flex flex-wrap gap-3 text-xs">
                <span>Budget fan : <span className="text-gold font-mono">{formatFCFA(req.budget_xcon)}</span></span>
                {req.counter_price_xcon && (
                  <span>Votre contre-offre : <span className="text-cream font-mono">{formatFCFA(req.counter_price_xcon)}</span></span>
                )}
              </div>

              {/* Actions selon statut */}
              {req.status === 'PENDING' && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => accept(req.id)} disabled={acting === req.id}>
                    <Check className="h-3.5 w-3.5" />Accepter {formatFCFA(req.budget_xcon)}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setCounterFor(req.id); setCounterPrice(req.budget_xcon); }} disabled={acting === req.id}>
                    <ArrowRightLeft className="h-3.5 w-3.5" />Contre-proposer
                  </Button>
                  <Button size="sm" variant="outline" className="border-brick/40 text-brick" onClick={() => reject(req.id)} disabled={acting === req.id}>
                    <X className="h-3.5 w-3.5" />Refuser
                  </Button>
                </div>
              )}

              {counterFor === req.id && (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={counterPrice}
                    onChange={e => setCounterPrice(Number(e.target.value))}
                    className="w-40 rounded-xl border border-ink-line bg-ink-raised px-3 py-1.5 text-sm text-cream focus:border-gold focus:outline-none"
                  />
                  <Button size="sm" onClick={() => sendCounter(req.id)} disabled={acting === req.id}>
                    Envoyer la contre-offre
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCounterFor(null)}>Annuler</Button>
                </div>
              )}

              {req.status === 'ACCEPTED' && (
                <Button size="sm" onClick={() => { setDeliverFor(req.id); }} disabled={acting === req.id}>
                  <Upload className="h-3.5 w-3.5" />Livrer le contenu
                </Button>
              )}

              {deliverFor === req.id && (
                <div className="space-y-2">
                  <input
                    value={mediaUrl}
                    onChange={e => setMediaUrl(e.target.value)}
                    placeholder="URL du contenu (R2)..."
                    className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none"
                  />
                  <textarea
                    value={deliverMessage}
                    onChange={e => setDeliverMessage(e.target.value)}
                    rows={2}
                    placeholder="Message accompagnant la livraison (optionnel)"
                    className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => deliver(req.id)} disabled={acting === req.id}>
                      {acting === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Confirmer la livraison
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDeliverFor(null)}>Annuler</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
