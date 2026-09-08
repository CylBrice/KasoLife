"use client";
import { useState, useCallback, useEffect, type FormEvent } from "react";
import { Smartphone, PlusCircle, Star, BadgeCheck, Loader2, AlertTriangle } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MmNumber {
  id: string; phone: string; phone_masked?: string; operator: string;
  is_verified: boolean; is_default?: boolean;
}

type Msg = { text: string; type: "success" | "error" } | null;
function useMsg() {
  const [msg, setMsg] = useState<Msg>(null);
  const show = (text: string, type: "success" | "error") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };
  return { msg, show };
}
function Toast({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p className={`mt-2 text-sm font-medium ${msg.type === "success" ? "text-emerald-bright" : "text-brick"}`}>{msg.text}</p>
  );
}

const OPERATORS = [
  { code: "MTN", label: "MTN Mobile Money", color: "#FFCC00", fg: "#1A1A1A" },
  { code: "ORANGE", label: "Orange Money", color: "#FF6600", fg: "#FFF" },
  { code: "MOOV", label: "Moov Africa", color: "#0072CE", fg: "#FFF" },
  { code: "WAVE", label: "Wave", color: "#1DC8CD", fg: "#FFF" },
  { code: "AIRTEL", label: "Airtel Money", color: "#ED1C24", fg: "#FFF" },
];

function OpBadge({ code }: { code: string }) {
  const op = OPERATORS.find((o) => o.code === code);
  if (!op) return <span className="text-xs font-bold text-sage">{code}</span>;
  return (
    <span
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-black"
      style={{ backgroundColor: op.color, color: op.fg }}
    >
      {op.label[0]}
    </span>
  );
}

export function TabPaiements() {
  const { locale } = useLocale();
  const isEn = locale === "en";

  const [numbers, setNumbers] = useState<MmNumber[]>([]);
  const mmMsg = useMsg();

  const [mmPhone, setMmPhone] = useState("");
  const [mmOperator, setMmOperator] = useState("MTN");
  const [mmOtp, setMmOtp] = useState("");
  const [mmStep, setMmStep] = useState(1);
  const [mmTimer, setMmTimer] = useState(0);
  const [loading, setLoading] = useState(false);

  const errText = (err: unknown) =>
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error || (isEn ? "Error" : "Erreur");

  const load = useCallback(async () => {
    try { const { data } = await api.get("/wallet/mobile-money"); setNumbers(data || []); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (mmTimer <= 0) return;
    const t = setTimeout(() => setMmTimer((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [mmTimer]);

  const handleRequestOtp = async (e?: FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    try {
      await api.post("/wallet/mobile-money/request-otp", { phone: mmPhone, operator: mmOperator });
      setMmStep(2); setMmTimer(180);
      mmMsg.show(isEn ? "Code sent via SMS." : "Code envoyé par SMS.", "success");
    } catch (err) { mmMsg.show(errText(err), "error"); }
    finally { setLoading(false); }
  };

  const handleAddNumber = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/wallet/mobile-money", { phone: mmPhone, operator: mmOperator, otp: mmOtp });
      mmMsg.show(isEn ? "Number added and verified!" : "Numéro ajouté et vérifié !", "success");
      setMmPhone(""); setMmOtp(""); setMmStep(1); setMmTimer(0);
      await load();
    } catch (err) { mmMsg.show(errText(err), "error"); }
    finally { setLoading(false); }
  };

  const handleDefault = async (id: string) => {
    try { await api.put(`/wallet/mobile-money/${id}/default`); await load(); }
    catch (err) { mmMsg.show(errText(err), "error"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(isEn ? "Delete this number?" : "Supprimer ce numéro ?")) return;
    try {
      await api.delete(`/wallet/mobile-money/${id}`);
      setNumbers((prev) => prev.filter((n) => n.id !== id));
      mmMsg.show(isEn ? "Number deleted." : "Numéro supprimé.", "success");
    } catch (err) { mmMsg.show(errText(err), "error"); }
  };

  return (
    <div className="space-y-4">

      {/* ── Numéros enregistrés ───────────────────────────────────── */}
      {numbers.length > 0 && (
        <div className="card-surface p-5">
          <h2 className="mb-4 flex items-center gap-2 font-display text-base font-medium text-cream">
            <Smartphone className="h-5 w-5 text-gold" />
            {isEn ? "Registered numbers" : "Numéros enregistrés"}
          </h2>
          <div className="space-y-2">
            {numbers.map((mm) => (
              <div key={mm.id} className="flex items-center justify-between rounded-xl border border-ink-line bg-ink-raised px-4 py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <OpBadge code={mm.operator} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-cream">{mm.operator} · {mm.phone_masked || mm.phone}</p>
                    <div className="mt-0.5 flex gap-1.5 flex-wrap">
                      {mm.is_verified && (
                        <Badge variant="emerald" className="text-xs">
                          <BadgeCheck className="h-3 w-3" /> {isEn ? "Verified" : "Vérifié"}
                        </Badge>
                      )}
                      {mm.is_default && (
                        <Badge variant="gold" className="text-xs">
                          <Star className="h-3 w-3" /> {isEn ? "Default" : "Défaut"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {!mm.is_default && (
                    <button onClick={() => handleDefault(mm.id)}
                      className="rounded-xl p-1.5 text-sage transition-colors hover:bg-gold/10 hover:text-gold"
                      title={isEn ? "Set as default" : "Définir par défaut"}>
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => handleDelete(mm.id)}
                    className="rounded-xl p-1.5 text-sage transition-colors hover:bg-brick/10 hover:text-brick"
                    title={isEn ? "Delete" : "Supprimer"}>
                    <span className="text-base">×</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
          <Toast msg={mmMsg.msg} />
        </div>
      )}

      {/* ── Ajouter un numéro ─────────────────────────────────────── */}
      <div className="card-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-medium text-cream">
          <PlusCircle className="h-5 w-5 text-gold" />
          {isEn ? "Add a Mobile Money number" : "Ajouter un numéro Mobile Money"}
        </h2>
        {mmStep === 1 ? (
          <form onSubmit={handleRequestOtp} className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-sage">{isEn ? "Operator" : "Opérateur"}</label>
              <select
                className="h-10 w-full rounded-xl border border-ink-line bg-ink-raised px-3 text-sm text-cream focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                value={mmOperator} onChange={(e) => setMmOperator(e.target.value)}
              >
                {OPERATORS.map((op) => (
                  <option key={op.code} value={op.code}>{op.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-sage">{isEn ? "Phone number" : "Numéro"}</label>
              <input
                type="tel" required
                className="h-10 w-full rounded-xl border border-ink-line bg-ink-raised px-3 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                value={mmPhone} onChange={(e) => setMmPhone(e.target.value)}
                placeholder="+237 6XX XX XX XX"
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" type="submit" disabled={loading || !mmPhone || !mmOperator}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEn ? "Send OTP code" : "Envoyer le code"}
              </Button>
            </div>
            <Toast msg={mmMsg.msg} />
          </form>
        ) : (
          <form onSubmit={handleAddNumber} className="space-y-3">
            <p className="text-sm text-sage">{isEn ? `Code sent via SMS to ${mmPhone}` : `Code envoyé par SMS au ${mmPhone}`}</p>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-sage">{isEn ? "6-digit code" : "Code à 6 chiffres"}</label>
              <input
                className="h-10 w-full rounded-xl border border-ink-line bg-ink-raised px-3 text-center font-mono text-xl tracking-widest text-cream focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                value={mmOtp} onChange={(e) => setMmOtp(e.target.value)} maxLength={6} inputMode="numeric" pattern="[0-9]*" required
              />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" type="submit" disabled={loading || mmOtp.length !== 6}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEn ? "Validate" : "Valider"}
              </Button>
              {mmTimer > 0
                ? <span className="text-xs text-sage-muted">{isEn ? `Resend in ${mmTimer}s` : `Renvoyer dans ${mmTimer}s`}</span>
                : <button type="button" onClick={() => handleRequestOtp()} className="text-xs text-gold hover:underline">{isEn ? "Resend" : "Renvoyer"}</button>}
              <Button size="sm" variant="ghost" type="button" onClick={() => setMmStep(1)} className="ml-auto">{isEn ? "Back" : "Retour"}</Button>
            </div>
            <Toast msg={mmMsg.msg} />
          </form>
        )}
      </div>

      {/* ── Info paiements ────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gold/20 bg-gold/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-gold" />
          <p className="text-xs text-sage">
            {isEn
              ? "These numbers are used for withdrawals. Make sure they are active and registered in your name."
              : "Ces numéros sont utilisés pour vos retraits. Assurez-vous qu'ils sont actifs et enregistrés à votre nom."}
          </p>
        </div>
      </div>

    </div>
  );
}
