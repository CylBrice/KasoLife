"use client";

import { useEffect, useState, useCallback } from "react";
import { Mail, Plus, Trash2, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubTabs } from "@/components/admin/sub-tabs";
import { formatRelativeDate } from "@/lib/utils";
import { api } from "@/lib/api";

type Tab = "tickets" | "emails" | "rapport";

const PRIORITY_VARIANT: Record<string, any> = {
  URGENT: "coral", HIGH: "coral", MEDIUM: "gold", LOW: "default",
};

export default function AdminSupportPage() {
  const [tab, setTab] = useState<Tab>("tickets");

  /* Tickets */
  const [tickets, setTickets]     = useState<any[]>([]);
  const [ticketsLoading, setTL]   = useState(false);
  const [statusFilter, setStatus] = useState("");
  const [priorityFilter, setPrio] = useState("");

  /* Emails */
  const [emails, setEmails]         = useState<any[]>([]);
  const [emailsLoading, setEL]      = useState(false);
  const [newEmail, setNewEmail]     = useState("");

  /* Rapport IA */
  const [reports, setReports]       = useState<any[]>([]);
  const [reportText, setReportText] = useState("");
  const [reportLoading, setRL]      = useState(false);

  const [error, setError] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    setTL(true);
    const params = new URLSearchParams({ limit: "50" });
    if (statusFilter)   params.set("status",   statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    try {
      const { data } = await api.get(`/support/admin/all?${params}`);
      setTickets(data || []);
    } catch { setTickets([]); }
    finally { setTL(false); }
  }, [statusFilter, priorityFilter]);

  const loadEmails = useCallback(async () => {
    setEL(true);
    try {
      const { data } = await api.get("/support/admin/emails");
      setEmails(data || []);
    } catch { setEmails([]); }
    finally { setEL(false); }
  }, []);

  const loadReports = useCallback(async () => {
    try {
      const { data } = await api.get("/support/admin/ai-reports");
      setReports(data || []);
    } catch { setReports([]); }
  }, []);

  useEffect(() => {
    if (tab === "tickets") loadTickets();
    if (tab === "emails")  { loadEmails(); }
    if (tab === "rapport") loadReports();
  }, [tab]);

  useEffect(() => {
    if (tab === "tickets") loadTickets();
  }, [statusFilter, priorityFilter]);

  const handleAddEmail = async () => {
    if (!newEmail.trim()) return;
    setError(null);
    try {
      await api.post("/support/admin/emails", { email: newEmail.trim() });
      setNewEmail(""); loadEmails();
    } catch (err: any) { setError(err?.response?.data?.error || "Erreur."); }
  };

  const handleDeleteEmail = async (id: string) => {
    if (!confirm("Supprimer cette adresse email ?")) return;
    try { await api.delete(`/support/admin/emails/${id}`); loadEmails(); }
    catch (err: any) { setError(err?.response?.data?.error || "Erreur."); }
  };

  const handleGenerateReport = async () => {
    setRL(true); setReportText("");
    try {
      const { data } = await api.post("/support/admin/ai-report");
      setReportText(data.report || "");
      loadReports();
    } catch (err: any) { setError(err?.response?.data?.error || "Erreur."); }
    finally { setRL(false); }
  };

  const handleDeleteReport = async (id: string) => {
    if (!confirm("Supprimer ce rapport ?")) return;
    try { await api.delete(`/support/admin/ai-reports/${id}`); loadReports(); }
    catch { }
  };

  const handleDownloadReport = () => {
    if (!reportText) return;
    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `rapport_support_kasolife_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const TABS = [
    { key: "tickets", label: "🎫 Tickets" },
    { key: "emails",  label: "📧 Emails" },
    { key: "rapport", label: "🤖 Rapport IA" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">Support</h1>
        <p className="mt-1 text-sm text-sage">Tickets utilisateurs, emails de notification et rapports IA.</p>
      </div>

      <SubTabs tabs={TABS} active={tab} onChange={(k) => setTab(k as Tab)} />

      {error && <p className="text-sm text-brick">{error}</p>}

      {/* ── Tickets ── */}
      {tab === "tickets" && (
        <div className="flex flex-col gap-4">
          {/* Filtres */}
          <div className="flex flex-wrap gap-2">
            {["", "OPEN", "CLOSED"].map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${statusFilter === s ? "border-gold bg-gold/10 text-gold-bright" : "border-ink-line text-sage hover:text-cream"}`}>
                {s || "Tous statuts"}
              </button>
            ))}
            {["", "LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
              <button key={p} onClick={() => setPrio(p)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${priorityFilter === p ? "border-coral bg-coral/10 text-coral" : "border-ink-line text-sage hover:text-cream"}`}>
                {p || "Toutes prio."}
              </button>
            ))}
            <Button size="sm" variant="secondary" onClick={loadTickets} disabled={ticketsLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${ticketsLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {ticketsLoading ? <p className="text-sm text-sage-muted">Chargement...</p> :
           tickets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-line px-6 py-12 text-center">
              <p className="font-display text-lg text-cream">Aucun ticket</p>
            </div>
           ) : (
            <div className="flex flex-col gap-2">
              {tickets.map((t: any) => (
                <Card key={t.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-cream">{t.user?.name || "—"}</span>
                          {t.user?.phone && <span className="font-mono text-xs text-sage-muted">{t.user.phone}</span>}
                          <Badge variant={PRIORITY_VARIANT[t.priority] || "default"}>{t.priority || "LOW"}</Badge>
                          <Badge variant={t.conv_status === "OPEN" ? "emerald" : "default"}>{t.conv_status || "OPEN"}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-sage line-clamp-2">{(t.message || "").slice(0, 120)}</p>
                      </div>
                      <span className="text-xs text-sage-muted shrink-0">
                        {t.created_at ? formatRelativeDate(t.created_at) : "—"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Emails de notification ── */}
      {tab === "emails" && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="p-5">
              <p className="mb-3 text-sm font-medium text-cream">Adresses email de notification</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
                  placeholder="email@exemple.com"
                  className="h-11 flex-1 rounded-xl border border-ink-line bg-ink-raised px-4 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none"
                />
                <Button onClick={handleAddEmail} disabled={!newEmail.trim()}>
                  <Plus className="h-4 w-4" /> Ajouter
                </Button>
              </div>
            </CardContent>
          </Card>

          {emailsLoading ? <p className="text-sm text-sage-muted">Chargement...</p> :
           emails.length === 0 ? (
            <p className="text-sm text-sage-muted text-center py-8">Aucune adresse email enregistrée.</p>
           ) : (
            <div className="flex flex-col gap-2">
              {emails.map((e: any) => (
                <Card key={e.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-sage-muted shrink-0" />
                      <span className="text-sm text-cream">{e.email}</span>
                    </div>
                    <Button size="sm" variant="danger" onClick={() => handleDeleteEmail(e.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Rapport IA ── */}
      {tab === "rapport" && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="p-5">
              <p className="mb-1 text-sm font-medium text-cream">🤖 Rapport IA — 7 derniers jours</p>
              <p className="mb-4 text-xs text-sage">Analyse les messages utilisateurs et génère un rapport d&apos;anomalies et recommandations.</p>
              <Button onClick={handleGenerateReport} disabled={reportLoading}>
                {reportLoading ? "⏳ Génération en cours..." : "🤖 Générer le rapport IA"}
              </Button>
            </CardContent>
          </Card>

          {reportText && (
            <Card>
              <CardContent className="p-5">
                <div className="mb-3 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={handleDownloadReport}>
                    ⬇️ Télécharger
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(reportText)}>
                    📋 Copier
                  </Button>
                </div>
                <pre className="max-h-96 overflow-y-auto rounded-lg bg-ink p-4 text-xs text-sage whitespace-pre-wrap">
                  {reportText}
                </pre>
              </CardContent>
            </Card>
          )}

          {reports.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-sage-muted font-medium">Rapports précédents</p>
              {reports.map((r: any) => (
                <Card key={r.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm text-cream">📄 {new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
                      {r.messages_count && <p className="text-xs text-sage-muted">{r.messages_count} messages analysés</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={async () => {
                        const { data } = await api.get(`/support/admin/ai-reports/${r.id}`);
                        setReportText(data.report_text || "");
                      }}>👁️ Voir</Button>
                      <Button size="sm" variant="danger" onClick={() => handleDeleteReport(r.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
