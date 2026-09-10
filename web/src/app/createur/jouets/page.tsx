"use client";

// Page créateur : contrôle jouet interactif (4.2)
// Créateur active la session → fans envoient des tips → vibrations
// Côté créateur : paramétrer la session + se connecter au jouet via Buttplug.io (Intiface Central)
import { useEffect, useRef, useState } from "react";
import { Zap, ZapOff, Loader2, AlertTriangle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFCFA } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

interface ToySession {
  active: boolean;
  intensity_min: number;
  intensity_max: number;
  tip_min_xcon: number;
  duration_ms: number;
}

export default function CreateurJouetsPage() {
  const { user }       = useAuth();
  const wsRef          = useRef<WebSocket | null>(null);
  const buttplugRef    = useRef<any>(null);

  const [session, setSession]   = useState<ToySession | null>(null);
  const [loading, setLoading]   = useState(false);
  const [toyConnected, setToyConnected] = useState(false);
  const [vibrating, setVibrating]       = useState(false);
  const [lastTip, setLastTip]           = useState<{ amount: number; intensity: number } | null>(null);
  const [error, setError]               = useState<string | null>(null);

  // Config du formulaire
  const [intensityMin, setIntensityMin] = useState(20);
  const [intensityMax, setIntensityMax] = useState(80);
  const [tipMin, setTipMin]             = useState(500);
  const [durationMs, setDurationMs]     = useState(3000);

  // ── Connexion WebSocket live pour recevoir les commandes ──
  useEffect(() => {
    if (!session?.active || !user) return;

    const token = localStorage.getItem("kasolife_token") || sessionStorage.getItem("kasolife_token");
    if (!token) return;

    // On se connecte au WS live stream (utilise le flux existant)
    // Le serveur enverra des events TOY_VIBRATE
    // Pour une session standalone (hors live) on utilise un WS dédié si disponible
    // Pour l'instant, le dispatch passe par le WS du live stream actif.
    // Si le créateur n'est pas en live, les tips sont quand même enregistrés en DB
    // mais la vibration n'est déclenchée que si le WS est connecté.

  }, [session?.active, user]);

  // ── Connexion Buttplug.io via Intiface Central (WebSocket local) ──
  const connectToy = async () => {
    setError(null);
    try {
      // La bibliothèque buttplug-js doit être chargée dynamiquement
      // elle requiert une connexion à Intiface Central ws://localhost:12345
      if (typeof window === "undefined") return;

      // Import dynamique — webpackIgnore pour éviter la résolution au build
      // buttplug-js n'est pas packagé dans le bundle, chargé uniquement au runtime
      const bp = await import(/* webpackIgnore: true */ "buttplug").catch(() => null);
      if (!bp) {
        setError("La bibliothèque Buttplug.io n'est pas disponible. Installez Intiface Central sur votre appareil.");
        return;
      }

      const client = new bp.ButtplugClient("KasoLife");
      const connector = new bp.ButtplugNodeWebsocketClientConnector("ws://localhost:12345");

      await client.connect(connector);
      await client.startScanning();

      setTimeout(() => client.stopScanning(), 5000);

      client.on("deviceadded", (device: any) => {
        setToyConnected(true);
        buttplugRef.current = device;
      });

      client.on("deviceremoved", () => {
        setToyConnected(false);
        buttplugRef.current = null;
      });

    } catch (e: any) {
      setError("Impossible de se connecter à Intiface Central. Vérifiez qu'il est lancé sur votre appareil.");
    }
  };

  const triggerVibration = async (intensity: number, durationMs: number) => {
    const device = buttplugRef.current;
    if (!device) return;
    try {
      setVibrating(true);
      await device.vibrate(intensity / 100);
      setTimeout(async () => {
        try { await device.stop(); } catch { }
        setVibrating(false);
      }, durationMs);
    } catch { setVibrating(false); }
  };

  // ── Activer la session côté serveur ──────────────────────
  const startSession = async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await api.post("/toy-control/session", {
        intensity_min: intensityMin,
        intensity_max: intensityMax,
        tip_min_xcon:  tipMin,
        duration_ms:   durationMs,
      });
      setSession({ active: true, ...data.session });
    } catch (e: any) {
      setError(e?.response?.data?.error || "Erreur lors de l'activation");
    } finally { setLoading(false); }
  };

  const stopSession = async () => {
    setLoading(true);
    try {
      await api.delete("/toy-control/session");
      setSession(null);
      setToyConnected(false);
      if (buttplugRef.current) { try { await buttplugRef.current.stop(); } catch { } }
    } catch { } finally { setLoading(false); }
  };

  // ── Test de vibration ────────────────────────────────────
  const testVibration = () => triggerVibration(intensityMax, durationMs);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-medium text-cream flex items-center gap-2">
          <Zap className="h-5 w-5 text-gold" />
          Jouets interactifs
        </h2>
        <p className="text-sm text-sage-muted mt-0.5">
          Les tips de vos fans déclenchent des vibrations en temps réel via Buttplug.io
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-brick/30 bg-brick/10 px-4 py-3 text-sm text-brick">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      {/* Status */}
      <div className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-surface p-4">
        <div className={`h-3 w-3 rounded-full ${session?.active ? "bg-emerald-400 animate-pulse" : "bg-sage-muted"}`} />
        <div className="flex-1">
          <p className="text-sm font-medium text-cream">
            {session?.active ? "Session active" : "Session inactive"}
          </p>
          <p className="text-xs text-sage-muted">
            {toyConnected ? "Jouet connecté via Intiface Central" : "Jouet non connecté"}
          </p>
        </div>
        {vibrating && (
          <Badge variant="default" className="animate-pulse bg-gold/20 text-gold border-gold/30">
            <Zap className="h-3 w-3 mr-1" />Vibration en cours
          </Badge>
        )}
      </div>

      {/* Paramètres */}
      {!session?.active && (
        <div className="rounded-xl border border-ink-line bg-ink-surface p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-sage" />
            <p className="font-medium text-cream text-sm">Paramètres de la session</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-sage mb-1">Intensité minimum (%)</label>
              <input type="number" min={1} max={99} value={intensityMin}
                onChange={e => setIntensityMin(Number(e.target.value))}
                className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream focus:border-gold focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage mb-1">Intensité maximum (%)</label>
              <input type="number" min={1} max={100} value={intensityMax}
                onChange={e => setIntensityMax(Number(e.target.value))}
                className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream focus:border-gold focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage mb-1">Tip minimum (XAF)</label>
              <input type="number" min={100} value={tipMin}
                onChange={e => setTipMin(Number(e.target.value))}
                className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream focus:border-gold focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-sage mb-1">Durée vibration (ms)</label>
              <input type="number" min={500} max={10000} step={500} value={durationMs}
                onChange={e => setDurationMs(Number(e.target.value))}
                className="w-full rounded-xl border border-ink-line bg-ink-raised px-3 py-2 text-sm text-cream focus:border-gold focus:outline-none" />
            </div>
          </div>
        </div>
      )}

      {/* Boutons d'action */}
      <div className="flex flex-wrap gap-3">
        {!session?.active ? (
          <Button className="flex-1" onClick={startSession} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Activer la session
          </Button>
        ) : (
          <Button variant="outline" className="flex-1 border-brick/40 text-brick" onClick={stopSession} disabled={loading}>
            <ZapOff className="h-4 w-4" />Désactiver
          </Button>
        )}

        {!toyConnected && (
          <Button variant="outline" onClick={connectToy} className="flex-1">
            Connecter le jouet (Intiface)
          </Button>
        )}

        {toyConnected && session?.active && (
          <Button variant="outline" onClick={testVibration} className="flex-1">
            <Zap className="h-4 w-4" />Tester la vibration
          </Button>
        )}
      </div>

      {/* Guide */}
      <div className="rounded-xl border border-ink-line bg-ink-raised p-4 text-xs text-sage-muted space-y-1.5">
        <p className="font-medium text-sage text-sm mb-2">Comment ça fonctionne</p>
        <p>1. Installez <strong className="text-cream">Intiface Central</strong> sur votre appareil (gratuit)</p>
        <p>2. Connectez votre jouet Lovense, We-Vibe ou autre via Intiface Central</p>
        <p>3. Activez la session KasoLife — cliquez sur "Connecter le jouet"</p>
        <p>4. Pendant votre live, les fans envoient des tips → vibrations instantanées</p>
        <p>5. Plus le tip est élevé, plus l'intensité augmente proportionnellement</p>
      </div>
    </div>
  );
}
