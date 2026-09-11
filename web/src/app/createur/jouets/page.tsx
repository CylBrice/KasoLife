"use client";

// Page créateur : contrôle jouet interactif (4.2)
// Créateur active la session → fans envoient des tips → vibrations
// Côté créateur : paramétrer la session + se connecter au jouet via Buttplug.io (Intiface Central)
import { useEffect, useRef, useState } from "react";
import { Zap, ZapOff, Loader2, AlertTriangle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AmountInput } from "@/components/ui/amount-input";
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

  // ── Connexion WebSocket pour recevoir les commandes TOY_VIBRATE ──
  useEffect(() => {
    if (!session?.active || !user) return;

    const token = localStorage.getItem("kasolife_token") || sessionStorage.getItem("kasolife_token");
    if (!token) return;

    // Récupère le live stream actif du créateur s'il existe
    const getActiveLiveStream = async () => {
      try {
        const { data: streams } = await api.get("/live");
        const active = streams?.streams?.find((s: any) => s.creator?.id === user.id);
        if (!active) return null;
        return active.id;
      } catch {
        return null;
      }
    };

    (async () => {
      const streamId = await getActiveLiveStream();
      if (!streamId) {
        console.log("[Toy] Pas de live stream actif — vibrations activées au test manuel uniquement");
        return;
      }

      const wsBase = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3003").replace(/\/$/, "");
      const ws = new WebSocket(`${wsBase}/live/ws?streamId=${streamId}&token=${token}`);

      ws.onopen = () => {
        console.log("[Toy] WebSocket connecté au live stream");
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "TOY_VIBRATE") {
            setLastTip({ amount: msg.amount_xcon, intensity: msg.intensity });
            triggerVibration(msg.intensity, msg.duration_seconds * 1000);
          }
        } catch {}
      };

      ws.onerror = () => {
        console.warn("[Toy] Erreur WebSocket — les vibrations manuelles restent disponibles");
      };

      ws.onclose = () => {
        console.log("[Toy] WebSocket fermé");
      };

      wsRef.current = ws;
    })();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
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
            <AmountInput label="Intensité minimum (%)" value={intensityMin} onChange={setIntensityMin} min={1} max={99} step={1} />
            <AmountInput label="Intensité maximum (%)" value={intensityMax} onChange={setIntensityMax} min={1} max={100} step={1} />
            <AmountInput label="Tip minimum (XAF)" value={tipMin} onChange={setTipMin} min={100} step={50} />
            <AmountInput label="Durée vibration (ms)" value={durationMs} onChange={setDurationMs} min={500} max={10000} step={500} />
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
