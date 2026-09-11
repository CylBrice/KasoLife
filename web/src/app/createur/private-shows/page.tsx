"use client";

// Page créateur — Private Shows
// Onglet 1 : configuration des tarifs par type/durée
// Onglet 2 : file d'attente en temps réel (enchère, accept/refus)
// Onglet 3 : show actif (lien vers session vidéo)

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Video, TrendingUp, Clock, Check, X, RefreshCw,
  Settings, Users, Crown, Eye, Save, Loader2, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AmountInput } from "@/components/ui/amount-input";
import { formatFCFA, cn } from "@/lib/utils";
import { api } from "@/lib/api";

const PACKAGES = [15, 30, 45, 60];
const TYPES    = ["STANDARD", "PREMIUM"] as const;
type ShowType  = (typeof TYPES)[number];

interface PriceFloor  { minutes: number; floor: { STANDARD: number; PREMIUM: number } }
interface CreatorPrice { show_type: ShowType; duration_min: number; price_xcon: number; spy_price_per_min_xcon?: number }
interface QueueEntry  {
  id: string; fan_id: string; show_type: ShowType;
  package_minutes: number; bid_xcon: number; expires_at: string;
  position: number; fan?: { id: string; pseudo: string; avatar_url?: string };
}
interface ActiveShow {
  id: string; show_type: ShowType; package_minutes: number;
  price_xcon: number; fan?: { pseudo: string; avatar_url?: string }; started_at: string;
}

type Tab = "config" | "queue" | "actif";

// ── Helpers ──────────────────────────────────────────────────
const formatExpiry = (expiresAt: string) => {
  const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  if (left <= 0) return "Expiré";
  const m = Math.floor(left / 60);
  const s = left % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const formatElapsed = (startedAt: string) => {
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const m = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export default function CreateurPrivateShowsPage() {
  const router = useRouter();
  const [tab, setTab]             = useState<Tab>("queue");
  const [floors, setFloors]       = useState<PriceFloor[]>([]);
  const [prices, setPrices]       = useState<CreatorPrice[]>([]);
  const [queue, setQueue]         = useState<QueueEntry[]>([]);
  const [activeShow, setActiveShow] = useState<ActiveShow | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [acting, setActing]       = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk]       = useState(false);

  // Form state : prices[type][duration] = { price, spy }
  const [form, setForm] = useState<Record<string, Record<number, { price: string; spy: string }>>>({});

  // ── Charger données initiales ─────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [pkgRes, pricesRes, queueRes] = await Promise.all([
        api.get("/private-shows/packages"),
        api.get("/private-shows/prices/me").catch(() => ({ data: { prices: [] } })),
        api.get("/private-shows/queue").catch(() => ({ data: { queue: [] } })),
      ]);

      const floorsData: PriceFloor[] = pkgRes.data.packages || [];
      setFloors(floorsData);

      const creatorPrices: CreatorPrice[] = pricesRes.data.prices || [];
      setPrices(creatorPrices);

      // Initialiser le form avec les prix actuels (ou les planchers)
      const initialForm: typeof form = {};
      for (const type of TYPES) {
        initialForm[type] = {};
        for (const pkg of floorsData) {
          const existing = creatorPrices.find(
            (p) => p.show_type === type && p.duration_min === pkg.minutes
          );
          initialForm[type][pkg.minutes] = {
            price: (existing?.price_xcon ?? pkg.floor[type] ?? "").toString(),
            spy:   (existing?.spy_price_per_min_xcon ?? "").toString(),
          };
        }
      }
      setForm(initialForm);

      setQueue(queueRes.data.queue || []);
    } catch {
      // silencieux
    } finally {
      setLoading(false);
    }
  }, []);

  // Chercher un show actif
  const loadActiveShow = useCallback(async () => {
    try {
      const { data } = await api.get("/private-shows/history?page=1&limit=1&role=creator").catch(() => ({ data: { sessions: [] } }));
      // L'historique ne liste que les ENDED — chercher via queue accepted
      // On vérifie via un endpoint dédié ou on stocke localement après accept
    } catch {}
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Rafraîchir la queue toutes les 5s
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const { data } = await api.get("/private-shows/queue");
        setQueue(data.queue || []);
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // ── Config : mise à jour du form ─────────────────────────
  const setFormField = (type: ShowType, min: number, field: "price" | "spy", val: string) => {
    setForm((prev) => ({
      ...prev,
      [type]: { ...prev[type], [min]: { ...prev[type]?.[min], [field]: val } },
    }));
  };

  const saveConfig = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const entries: any[] = [];
      for (const type of TYPES) {
        for (const pkg of floors) {
          const f = form[type]?.[pkg.minutes];
          if (!f?.price) continue;
          const entry: any = {
            show_type:    type,
            duration_min: pkg.minutes,
            price_xcon:   parseInt(f.price),
          };
          if (type === "STANDARD" && f.spy && parseInt(f.spy) > 0) {
            entry.spy_price_per_min_xcon = parseInt(f.spy);
          }
          entries.push(entry);
        }
      }
      await api.put("/private-shows/prices", { entries });
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
      await loadData();
    } catch (err: any) {
      setSaveError(err?.response?.data?.error || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  // ── Queue : accept / reject ──────────────────────────────
  const accept = async (entry: QueueEntry) => {
    setActing(entry.id);
    try {
      const { data } = await api.post(`/private-shows/queue/${entry.id}/accept`);
      setActiveShow({ ...data.show, fan: entry.fan });
      setQueue((prev) => prev.filter((e) => e.id !== entry.id));
      router.push(`/private-shows/${data.show.id}`);
    } catch (err: any) {
      alert(err?.response?.data?.error || "Erreur");
    } finally {
      setActing(null);
    }
  };

  const reject = async (entry: QueueEntry) => {
    setActing(entry.id);
    try {
      await api.post(`/private-shows/queue/${entry.id}/reject`);
      setQueue((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (err: any) {
      alert(err?.response?.data?.error || "Erreur");
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-medium text-cream flex items-center gap-2">
            <Video className="h-5 w-5 text-gold" />
            Private Shows
          </h2>
          <p className="text-sm text-sage-muted mt-0.5">
            Shows vidéo 1-to-1 — Standard (spy ok) ou Premium (exclusif)
          </p>
        </div>
        {queue.length > 0 && (
          <Badge variant="gold" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {queue.length} en file
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-ink-line bg-ink-raised p-1">
        {[
          { id: "queue",  label: "File d'attente", icon: Users,    count: queue.length },
          { id: "config", label: "Mes tarifs",     icon: Settings, count: 0 },
        ].map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id as Tab)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium transition-colors",
              tab === id
                ? "bg-ink text-cream shadow-sm"
                : "text-sage-muted hover:text-cream",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {count > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-ink">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══ TAB : FILE D'ATTENTE ══════════════════════════════ */}
      {tab === "queue" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-sage-muted">
              Triée par enchère décroissante — le premier a offert le plus.
            </p>
            <button
              onClick={() => api.get("/private-shows/queue").then(({ data }) => setQueue(data.queue || []))}
              className="flex items-center gap-1 text-xs text-sage-muted hover:text-cream transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Actualiser
            </button>
          </div>

          {queue.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-line py-14 text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-sage-muted" />
              <p className="text-sage-muted text-sm">Aucun fan en attente</p>
              <p className="text-sage-muted/60 text-xs mt-1">Les nouvelles demandes apparaissent ici automatiquement</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-line bg-ink-surface p-4"
                >
                  {/* Position */}
                  <div className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    entry.position === 1
                      ? "bg-gold/20 text-gold"
                      : "bg-ink-raised text-sage-muted"
                  )}>
                    #{entry.position}
                  </div>

                  {/* Avatar */}
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-ink-raised">
                    {entry.fan?.avatar_url ? (
                      <Image src={entry.fan.avatar_url} alt="" fill sizes="40px" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-display text-gold">
                        {entry.fan?.pseudo?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                  </div>

                  {/* Infos */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-cream">@{entry.fan?.pseudo}</span>
                      <Badge variant={entry.show_type === "PREMIUM" ? "gold" : "default"} className="flex items-center gap-1">
                        {entry.show_type === "PREMIUM"
                          ? <><Crown className="h-2.5 w-2.5" />Premium</>
                          : <><Eye className="h-2.5 w-2.5" />Standard</>
                        }
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-sage-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />{entry.package_minutes} min
                      </span>
                      <span className="flex items-center gap-1 font-mono text-gold font-semibold">
                        <TrendingUp className="h-3 w-3" />{formatFCFA(entry.bid_xcon)}
                      </span>
                      <span className="text-brick font-mono">
                        ⏱ {formatExpiry(entry.expires_at)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm" variant="outline"
                      disabled={acting === entry.id}
                      onClick={() => reject(entry)}
                      className="border-brick/40 text-brick hover:bg-brick/10"
                    >
                      <X className="h-3.5 w-3.5" />
                      Refuser
                    </Button>
                    <Button
                      size="sm"
                      disabled={acting === entry.id}
                      onClick={() => accept(entry)}
                    >
                      {acting === entry.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Check className="h-3.5 w-3.5" />
                      }
                      Accepter
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB : CONFIG TARIFS ═══════════════════════════════ */}
      {tab === "config" && (
        <div className="space-y-6">
          {TYPES.map((type) => (
            <div key={type} className="space-y-3">
              <div className="flex items-center gap-2">
                {type === "PREMIUM"
                  ? <Crown className="h-4 w-4 text-gold" />
                  : <Eye className="h-4 w-4 text-sage" />
                }
                <h3 className="font-medium text-cream">
                  {type === "PREMIUM" ? "Premium Private (exclusif — pas de spy)" : "Standard (spy autorisé)"}
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {floors.map((pkg) => {
                  const floor = pkg.floor[type];
                  const f = form[type]?.[pkg.minutes] ?? { price: "", spy: "" };
                  const priceVal = parseInt(f.price) || 0;
                  const tooLow   = priceVal > 0 && priceVal < floor;

                  return (
                    <div
                      key={pkg.minutes}
                      className="rounded-xl border border-ink-line bg-ink-surface p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-cream">
                          {pkg.minutes} min
                        </span>
                        <span className="text-xs text-sage-muted">
                          min. {formatFCFA(floor)}
                        </span>
                      </div>

                      {/* Prix du forfait */}
                      <div className="space-y-1">
                        <label className="text-xs text-sage-muted">Prix du forfait (XCon)</label>
                        <input
                          type="number"
                          min={floor}
                          value={f.price}
                          onChange={(e) => setFormField(type, pkg.minutes, "price", e.target.value)}
                          placeholder={floor.toString()}
                          className={cn(
                            "w-full rounded-xl border bg-ink px-3 py-2 text-sm text-cream placeholder:text-sage-muted/50 focus:outline-none focus:ring-1",
                            tooLow
                              ? "border-brick/60 focus:ring-brick/40"
                              : "border-ink-line focus:ring-gold/40",
                          )}
                        />
                        {tooLow && (
                          <p className="text-xs text-brick">Minimum : {formatFCFA(floor)}</p>
                        )}
                      </div>

                      {/* Prix spy (Standard uniquement) */}
                      {type === "STANDARD" && (
                        <div className="space-y-1">
                          <label className="text-xs text-sage-muted flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            Prix spy / minute (XCon)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={f.spy}
                            onChange={(e) => setFormField(type, pkg.minutes, "spy", e.target.value)}
                            placeholder="200"
                            className="w-full rounded-xl border border-ink-line bg-ink px-3 py-2 text-sm text-cream placeholder:text-sage-muted/50 focus:outline-none focus:ring-1 focus:ring-gold/40"
                          />
                          <p className="text-[10px] text-sage-muted/70">
                            Laisser vide = pas de spy disponible pour ce forfait
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Bouton sauvegarder */}
          <div className="flex items-center gap-3">
            <Button onClick={saveConfig} disabled={saving} className="flex items-center gap-2">
              {saving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Save className="h-4 w-4" />
              }
              Enregistrer les tarifs
            </Button>
            {saveOk && (
              <span className="text-sm text-emerald flex items-center gap-1">
                <Check className="h-3.5 w-3.5" />
                Tarifs sauvegardés
              </span>
            )}
            {saveError && (
              <span className="text-sm text-brick">{saveError}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
