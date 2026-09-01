"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock, FileText, RefreshCw, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubTabs } from "@/components/admin/sub-tabs";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

type Tab = "status" | "history" | "logs";

const STATUSES = [
  { value: "ACTIF",             label: "🟢 Actif",              description: "Plateforme entièrement fonctionnelle." },
  { value: "READ_ONLY",         label: "👁️ Lecture seule",       description: "Consultation possible, transactions désactivées." },
  { value: "MAINTENANCE",       label: "🔧 Maintenance",         description: "Accès restreint, message de maintenance affiché." },
  { value: "FORCE_MAINTENANCE", label: "🚨 Maintenance totale",  description: "Arrêt complet (SUPERADMIN uniquement).", superOnly: true },
];

export default function AdminMaintenancePage() {
  const { user } = useAuth();
  const [tab, setTab]         = useState<Tab>("status");
  const [status, setStatus]   = useState<string>("ACTIF");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  /* Logs */
  const [logFiles, setLogFiles]     = useState<any[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logPreview, setLogPreview] = useState<any>(null);
  const [logFilename, setLogFilename] = useState("");

  const loadStatus = () => {
    api.get("/admin/maintenance/status")
      .then(({ data }) => {
        setStatus(data.status || "ACTIF");
        setHistory(data.history || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStatus(); }, []);

  const handleSet = async (newStatus: string) => {
    if (newStatus === "FORCE_MAINTENANCE") {
      if (!confirm("Confirmer la maintenance totale ? Cela bloquera tous les utilisateurs.")) return;
    }
    setError(null);
    setUpdating(newStatus);
    try {
      await api.post("/admin/maintenance/set", {
        status: newStatus, is_emergency: newStatus === "FORCE_MAINTENANCE",
      });
      setStatus(newStatus);
    } catch (err: any) { setError(err?.response?.data?.error || "Erreur."); }
    finally { setUpdating(null); }
  };

  const loadLogFiles = async () => {
    setLogLoading(true);
    try {
      const { data } = await api.get("/admin/logs");
      setLogFiles(data || []);
    } catch { setLogFiles([]); }
    finally { setLogLoading(false); }
  };

  const loadLogPreview = async (filename: string) => {
    try {
      const { data } = await api.get(`/admin/logs/${filename}`);
      setLogPreview(data);
      setLogFilename(filename);
    } catch (err: any) { alert("Erreur chargement log : " + err.message); }
  };

  const downloadLog = (filename: string) => {
    const url = `${process.env.NEXT_PUBLIC_API_URL}/admin/logs/${filename}/download`;
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
  };

  const TABS = [
    { key: "status",  label: "⚙️ Statut" },
    { key: "history", label: "📋 Historique" },
    { key: "logs",    label: "📜 Logs système" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-cream">Maintenances</h1>
        <p className="mt-1 text-sm text-sage">Statut global et journaux de la plateforme.</p>
      </div>

      <SubTabs tabs={TABS} active={tab} onChange={(k) => {
        setTab(k as Tab);
        if (k === "logs" && logFiles.length === 0) loadLogFiles();
      }} />

      {error && <p className="text-sm text-brick">{error}</p>}

      {/* ── Statut ── */}
      {tab === "status" && (
        loading ? <p className="text-sm text-sage-muted">Chargement...</p> : (
          <div className="flex flex-col gap-3">
            {STATUSES
              .filter((s) => !s.superOnly || user?.role === "SUPERADMIN")
              .map((s) => (
                <Card key={s.value} className={cn(status === s.value && "border-gold/60")}>
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-cream">{s.label}</p>
                        {status === s.value && <Badge variant="gold">Actif</Badge>}
                        {s.superOnly && <AlertTriangle className="h-4 w-4 text-coral" />}
                      </div>
                      <p className="mt-0.5 text-sm text-sage">{s.description}</p>
                    </div>
                    {status !== s.value && (
                      <Button
                        size="sm"
                        variant={s.value === "FORCE_MAINTENANCE" ? "danger" : "secondary"}
                        disabled={updating !== null}
                        onClick={() => handleSet(s.value)}
                      >
                        {updating === s.value ? "..." : "Activer"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        )
      )}

      {/* ── Historique ── */}
      {tab === "history" && (
        <div className="flex flex-col gap-2">
          {history.length === 0 ? (
            <p className="py-12 text-center text-sm text-sage-muted">Aucun historique disponible.</p>
          ) : history.map((h: any, i: number) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-sage-muted" />
                    <span className="text-sm text-cream">
                      <span className="text-sage">{h.from_status}</span>
                      {" → "}
                      <span className="font-medium">{h.to_status}</span>
                    </span>
                    {h.type === "URGENCE" && <Badge variant="coral">Urgence</Badge>}
                  </div>
                  <span className="text-xs text-sage-muted">
                    {h.triggered_at ? new Date(h.triggered_at).toLocaleString("fr-FR") : "—"}
                  </span>
                </div>
                {h.triggered_by_name && (
                  <p className="mt-1 text-xs text-sage">Par @{h.triggered_by_name}</p>
                )}
                {h.notes && <p className="mt-1 text-xs text-sage">{h.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Logs système ── */}
      {tab === "logs" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-sage">Fichiers de logs du serveur.</p>
            <Button size="sm" variant="secondary" onClick={loadLogFiles} disabled={logLoading}>
              <RefreshCw className={cn("h-3.5 w-3.5", logLoading && "animate-spin")} />
              Actualiser
            </Button>
          </div>

          {logLoading ? (
            <p className="text-sm text-sage-muted">Chargement...</p>
          ) : logFiles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-line px-6 py-12 text-center">
              <FileText className="mx-auto h-8 w-8 text-sage-muted" />
              <p className="mt-2 text-sm text-sage-muted">Aucun fichier log disponible.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {logFiles.map((f: any) => (
                <Card key={f.filename}>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-mono text-sm text-cream">{f.filename}</p>
                      <p className="text-xs text-sage-muted">{f.date} · {f.size_kb} KB</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => loadLogPreview(f.filename)}>
                        👁️ Voir
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => downloadLog(f.filename)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Prévisualisation log */}
          {logPreview && (
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-mono text-sm font-medium text-cream">📄 {logFilename}</p>
                  <span className="text-xs text-sage-muted">
                    {logPreview.preview_lines} / {logPreview.total_lines} lignes
                  </span>
                </div>
                <pre className="max-h-96 overflow-y-auto rounded-lg bg-ink p-4 text-[10px] text-sage-muted whitespace-pre-wrap break-all">
                  {logPreview.content}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
