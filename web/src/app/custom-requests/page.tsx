"use client";

// Page fan : mes demandes de contenu personnalisé
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { ShoppingBag, Plus, Clock, CheckCircle, XCircle, AlertTriangle, Loader2, Send, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFCFA, formatRelativeDate } from "@/lib/utils";
import { api } from "@/lib/api";

interface CustomRequest {
  id: string;
  creator_id: string;
  creator_pseudo: string;
  creator_display_name?: string;
  creator_avatar?: string;
  description: string;
  budget_xcon: number;
  counter_price_xcon?: number;
  agreed_price_xcon?: number;
  status: string;
  delivery?: { media_url: string; message?: string };
  created_at: string;
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  PENDING:          { label: "En attente",        color: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
  COUNTER_PROPOSED: { label: "Contre-offre",       color: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  ACCEPTED:         { label: "Acceptée",           color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  IN_PROGRESS:      { label: "En cours",           color: "text-purple-400 bg-purple-400/10 border-purple-400/30" },
  DELIVERED:        { label: "Livrée",             color: "text-gold bg-gold/10 border-gold/30" },
  CONFIRMED:        { label: "Confirmée ✓",        color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  REJECTED:         { label: "Refusée",            color: "text-brick bg-brick/10 border-brick/30" },
  CANCELLED:        { label: "Annulée",            color: "text-sage-muted bg-sage-muted/10 border-sage-muted/30" },
  DISPUTED:         { label: "Litige ouvert",      color: "text-brick bg-brick/10 border-brick/30" },
  REFUNDED:         { label: "Remboursée",         color: "text-sage bg-sage/10 border-sage/30" },
};

export default function CustomRequestsPage() {
  const [requests, setRequests]   = useState<CustomRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [acting, setActing]         = useState<string | null>(null);

  // Formulaire nouvelle demande
  const [creatorId, setCreatorId] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget]           = useState(5000);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/custom-requests/my");
      setRequests(data.requests || []);
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!creatorId.trim() || !description.trim()) {
      setError("ID créateur et description requis"); return;
    }
    setError(null); setSubmitting(true);
    try {
      await api.post("/custom-requests", { creator_id: creatorId, description, budget_xcon: budget });
      setShowForm(false); setCreatorId(""); setDescription(""); setBudget(5000);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Erreur");
    } finally { setSubmitting(false); }
  };

  const acceptCounter = async (id: string) => {
    setActing(id);
    try { await api.post(`/custom-requests/${id}/accept-counter`); load(); }
    catch (e: any) { alert(e?.response?.data?.error || "Erreur"); }
    finally { setActing(null); }
  };

  const confirm = async (id: string) => {
    setActing(id);
    try { await api.post(`/custom-requests/${id}/confirm`); load(); }
    catch (e: any) { alert(e?.response?.data?.error || "Erreur"); }
    finally { setActing(null); }
  };

  const cancel = async (id: string) => {
    setActing(id);
    try { await api.post(`/custom-requests/${id}/cancel`); load(); }
    catch (e: any) { alert(e?.response?.data?.error || "Erreur"); }
    finally { setActing(null); }
  };

  const dispute = async (id: string) => {
    const reason = prompt("Motif du litige :");
    if (!reason?.trim()) return;
    setActing(id);
    try { await api.post(`/custom-requests/${id}/dispute`, { reason }); load(); }
    catch (e: any) { alert(e?.response?.data?.error || "Erreur"); }
    finally { setActing(null); }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-medium text-cream flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-gold" />
            Demandes personnalisées
          </h1>
          <p className="text-sm text-sage-muted mt-0.5">Commandez un contenu unique à votre créateur préféré</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3.5 w-3.5" />
          Nouvelle demande
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-ink-line bg-ink-surface p-5 space-y-4">
          <p className="font-medium text-cream">Nouvelle demande</p>
          {error && (
            <div className="flex items-center gap-2 text-xs text-brick border border-brick/30 bg-brick/10 rounded-xl px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-sage mb-1">ID du créateur *</label>
            <input value={creatorId} onChange={e => setCreatorId(e.target.value)}
              placeholder="UUID du créateur"
              className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-sage mb-1">Description de votre demande *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Décrivez précisément ce que vous souhaitez..."
              className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-sage mb-1">Budget proposé (XAF)</label>
            <input type="number" value={budget} onChange={e => setBudget(Number(e.target.value))}
              className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream focus:border-gold focus:outline-none" />
            <p className="text-xs text-sage-muted mt-1">Le montant sera débité immédiatement — remboursé en cas de refus</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button className="flex-1" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer — {formatFCFA(budget)}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-line py-14 text-center">
          <ShoppingBag className="mx-auto mb-3 h-8 w-8 text-sage-muted" />
          <p className="text-sage-muted text-sm">Aucune demande</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const badge = STATUS_BADGE[req.status] || { label: req.status, color: "" };
            return (
              <div key={req.id} className="rounded-xl border border-ink-line bg-ink-surface p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ink-raised">
                      {req.creator_avatar
                        ? <Image src={req.creator_avatar} alt="" fill sizes="36px" className="object-cover" />
                        : <div className="flex h-full w-full items-center justify-center text-gold font-display text-sm">{req.creator_pseudo[0]?.toUpperCase()}</div>
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-cream truncate">@{req.creator_pseudo}</p>
                      <p className="text-xs text-sage-muted">{formatRelativeDate(req.created_at)}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${badge.color}`}>
                    {badge.label}
                  </span>
                </div>

                <p className="text-sm text-sage leading-relaxed">{req.description}</p>

                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="text-sage-muted">Budget : <span className="text-cream font-mono">{formatFCFA(req.budget_xcon)}</span></span>
                  {req.counter_price_xcon && (
                    <span className="text-sage-muted">Contre-offre : <span className="text-gold font-mono">{formatFCFA(req.counter_price_xcon)}</span></span>
                  )}
                </div>

                {req.delivery && (
                  <div className="rounded-xl border border-gold/20 bg-gold/5 p-3">
                    <p className="text-xs font-medium text-gold mb-1">Contenu livré</p>
                    {req.delivery.message && <p className="text-xs text-sage">{req.delivery.message}</p>}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {req.status === 'COUNTER_PROPOSED' && (
                    <>
                      <Button size="sm" onClick={() => acceptCounter(req.id)} disabled={acting === req.id}>
                        <CheckCircle className="h-3.5 w-3.5" />
                        Accepter {formatFCFA(req.counter_price_xcon!)}
                      </Button>
                      <Button size="sm" variant="outline" className="border-brick/40 text-brick" onClick={() => cancel(req.id)} disabled={acting === req.id}>
                        <XCircle className="h-3.5 w-3.5" />Refuser
                      </Button>
                    </>
                  )}
                  {req.status === 'PENDING' && (
                    <Button size="sm" variant="outline" className="border-brick/40 text-brick" onClick={() => cancel(req.id)} disabled={acting === req.id}>
                      <XCircle className="h-3.5 w-3.5" />Annuler
                    </Button>
                  )}
                  {req.status === 'DELIVERED' && (
                    <>
                      <Button size="sm" onClick={() => confirm(req.id)} disabled={acting === req.id}>
                        <CheckCircle className="h-3.5 w-3.5" />Confirmer la réception
                      </Button>
                      <Button size="sm" variant="outline" className="border-brick/40 text-brick" onClick={() => dispute(req.id)} disabled={acting === req.id}>
                        <AlertTriangle className="h-3.5 w-3.5" />Litige
                      </Button>
                    </>
                  )}
                  {['ACCEPTED','IN_PROGRESS'].includes(req.status) && (
                    <Button size="sm" variant="outline" className="border-brick/40 text-brick" onClick={() => dispute(req.id)} disabled={acting === req.id}>
                      <AlertTriangle className="h-3.5 w-3.5" />Signaler un litige
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
