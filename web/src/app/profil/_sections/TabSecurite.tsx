"use client";
import { useState, useEffect, useCallback, type FormEvent } from "react";
import Link from "next/link";
import {
  LockKeyhole, Smartphone, Mail, MonitorSmartphone, ShieldCheck,
  AlertTriangle, ChevronRight, Loader2, BadgeCheck, Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/i18n/locale-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

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

interface Session {
  id: string; user_agent?: string; ip_address?: string; created_at?: string;
}

export function TabSecurite() {
  const { user, logout } = useAuth();
  const { locale } = useLocale();
  const isEn = locale === "en";
  const router = useRouter();

  const u = user as any;
  const errText = (err: unknown) =>
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error || (isEn ? "Error" : "Erreur");

  // ── Mot de passe ──
  const [curPwd, setCurPwd] = useState(""); const [newPwd, setNewPwd] = useState(""); const [confPwd, setConfPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const pwdMsg = useMsg();

  const handlePwd = async (e: FormEvent) => {
    e.preventDefault();
    if (newPwd !== confPwd) { pwdMsg.show(isEn ? "Passwords do not match." : "Les mots de passe ne correspondent pas.", "error"); return; }
    if (newPwd.length < 8) { pwdMsg.show(isEn ? "Minimum 8 characters." : "8 caractères minimum.", "error"); return; }
    setPwdSaving(true);
    try {
      await api.put("/auth/change-password", { current_password: curPwd, new_password: newPwd });
      setCurPwd(""); setNewPwd(""); setConfPwd("");
      pwdMsg.show(isEn ? "Password updated. You have been logged out of all devices." : "Mot de passe mis à jour. Déconnecté de tous vos appareils.", "success");
    } catch (err) { pwdMsg.show(errText(err), "error"); }
    finally { setPwdSaving(false); }
  };

  // ── Email ──
  const [email, setEmail] = useState(u?.email || "");
  const [emailConfirmed, setEmailConfirmed] = useState(!!u?.email_confirmed);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailStep, setEmailStep] = useState(1);
  const [emailValue, setEmailValue] = useState(""); const [emailPwd, setEmailPwd] = useState(""); const [emailOtp, setEmailOtp] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const emailMsg = useMsg();

  useEffect(() => {
    if (u) { setEmail(u.email || ""); setEmailConfirmed(!!u.email_confirmed); }
  }, [u?.email, u?.email_confirmed]);

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEmailSaving(true);
    try {
      if (email) await api.put("/auth/change-email", { new_email: emailValue, password: emailPwd });
      else await api.post("/auth/email/submit", { email: emailValue });
      setEmailStep(2);
      emailMsg.show(isEn ? `Code sent to ${emailValue}` : `Code envoyé à ${emailValue}`, "success");
    } catch (err) { emailMsg.show(errText(err), "error"); }
    finally { setEmailSaving(false); }
  };

  const handleEmailConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setEmailSaving(true);
    try {
      const path = email ? "/auth/change-email/confirm" : "/auth/email/confirm";
      await api.post(path, { otp: emailOtp });
      setEmail(emailValue); setEmailConfirmed(true);
      setShowEmailForm(false); setEmailStep(1); setEmailValue(""); setEmailPwd(""); setEmailOtp("");
      emailMsg.show(isEn ? "Email confirmed." : "Email confirmé avec succès.", "success");
    } catch (err) { emailMsg.show(errText(err), "error"); }
    finally { setEmailSaving(false); }
  };

  // ── 2FA ──
  const [twofa, setTwofa] = useState(!!u?.twofa_enabled);
  const [twofaMethod, setTwofaMethod] = useState<"sms" | "email">(u?.twofa_method || "email");
  const [twofaSaving, setTwofaSaving] = useState(false);
  const twofaMsg = useMsg();

  useEffect(() => {
    if (u) { setTwofa(!!u.twofa_enabled); setTwofaMethod(u.twofa_method || "email"); }
  }, [u?.twofa_enabled, u?.twofa_method]);

  const handleToggle2FA = async () => {
    if (!emailConfirmed && !twofa) {
      twofaMsg.show(isEn ? "Please confirm your email first." : "Confirmez d'abord votre email.", "error");
      return;
    }
    setTwofaSaving(true);
    try {
      if (twofa) {
        await api.post("/auth/2fa/disable");
        setTwofa(false);
        twofaMsg.show(isEn ? "2FA disabled." : "2FA désactivé.", "success");
      } else {
        await api.post("/auth/2fa/setup", { method: twofaMethod });
        setTwofa(true);
        twofaMsg.show(isEn ? "2FA enabled." : "2FA activé.", "success");
      }
    } catch (err) { twofaMsg.show(errText(err), "error"); }
    finally { setTwofaSaving(false); }
  };

  // ── Numéro de connexion ──
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const [phoneStep, setPhoneStep] = useState(1);
  const [phoneValue, setPhoneValue] = useState(""); const [phonePwd, setPhonePwd] = useState(""); const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneCountdown, setPhoneCountdown] = useState(0);
  const phoneMsg = useMsg();

  useEffect(() => {
    if (phoneCountdown <= 0) return;
    const t = setTimeout(() => setPhoneCountdown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [phoneCountdown]);

  const handlePhoneSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    setPhoneSaving(true);
    try {
      await api.put("/auth/change-phone", { new_phone: phoneValue, password: phonePwd });
      setPhoneStep(2); setPhoneCountdown(180);
      phoneMsg.show(isEn ? `Code sent to ${phoneValue}` : `Code envoyé au ${phoneValue}`, "success");
    } catch (err) { phoneMsg.show(errText(err), "error"); }
    finally { setPhoneSaving(false); }
  };

  const handlePhoneConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setPhoneSaving(true);
    try {
      await api.post("/auth/change-phone/confirm", { otp: phoneOtp });
      phoneMsg.show(isEn ? "Login number updated." : "Numéro de connexion mis à jour.", "success");
      setShowPhoneForm(false); setPhoneStep(1); setPhoneValue(""); setPhonePwd(""); setPhoneOtp("");
    } catch (err) { phoneMsg.show(errText(err), "error"); }
    finally { setPhoneSaving(false); }
  };

  // ── Sessions ──
  const [sessions, setSessions] = useState<Session[]>([]);
  const sessMsg = useMsg();

  const loadSessions = useCallback(async () => {
    try { const { data } = await api.get("/auth/sessions"); setSessions(data || []); } catch {}
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const revokeSession = async (id: string) => {
    try {
      await api.delete(`/auth/sessions/${id}`);
      setSessions((s) => s.filter((x) => x.id !== id));
      sessMsg.show(isEn ? "Session revoked." : "Session révoquée.", "success");
    } catch (err) { sessMsg.show(errText(err), "error"); }
  };

  const revokeAll = async () => {
    if (!confirm(isEn ? "Log out all your devices?" : "Déconnecter tous vos appareils ?")) return;
    try { await api.post("/auth/logout-all"); logout(); router.push("/connexion"); }
    catch (err) { sessMsg.show(errText(err), "error"); }
  };

  // ── Suppression compte ──
  const [showDelete, setShowDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);
  const deleteMsg = useMsg();

  const handleDeleteAccount = async () => {
    if (deleteText !== "SUPPRIMER") return;
    setDeleteSaving(true);
    try {
      await api.delete("/auth/account");
      logout(); router.push("/");
    } catch (err) { deleteMsg.show(errText(err), "error"); setDeleteSaving(false); }
  };

  if (!user) return null;

  return (
    <div className="space-y-4">

      {/* ── Mot de passe ─────────────────────────────────────────── */}
      <div className="card-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-medium text-cream">
          <LockKeyhole className="h-5 w-5 text-gold" />
          {isEn ? "Change password" : "Changer le mot de passe"}
        </h2>
        <form onSubmit={handlePwd} className="space-y-3">
          {[
            [isEn ? "Current password" : "Mot de passe actuel", curPwd, setCurPwd],
            [isEn ? "New password" : "Nouveau mot de passe", newPwd, setNewPwd],
            [isEn ? "Confirm" : "Confirmer", confPwd, setConfPwd],
          ].map(([label, value, setter]) => (
            <div key={String(label)} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-sage">{String(label)}</label>
              <input
                type="password"
                className="h-10 w-full rounded-xl border border-ink-line bg-ink-raised px-3 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                value={String(value)}
                onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          ))}
          {newPwd && (
            <ul className="space-y-1">
              {[
                [newPwd.length >= 8, isEn ? "At least 8 characters" : "Au moins 8 caractères"],
                [/[A-Z]/.test(newPwd), isEn ? "One uppercase letter" : "Une majuscule"],
                [/[0-9]/.test(newPwd), isEn ? "One digit" : "Un chiffre"],
              ].map(([ok, label]) => (
                <li key={String(label)} className={`text-xs flex items-center gap-1.5 ${ok ? "text-emerald-bright" : "text-sage-muted"}`}>
                  <span>{ok ? "✓" : "○"}</span> {String(label)}
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <Button size="sm" type="submit" disabled={pwdSaving || !curPwd || !newPwd || !confPwd}>
              {pwdSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEn ? "Update password" : "Mettre à jour"}
            </Button>
          </div>
          <Toast msg={pwdMsg.msg} />
        </form>
      </div>

      {/* ── Email + 2FA ───────────────────────────────────────────── */}
      <div className="card-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-medium text-cream">
          <Mail className="h-5 w-5 text-gold" />
          {isEn ? "Email address" : "Adresse email"}
        </h2>
        {!showEmailForm ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              {email ? (
                <>
                  <p className="text-sm font-medium text-cream">{email}</p>
                  <div className="mt-1">
                    {emailConfirmed
                      ? <span className="flex items-center gap-1 text-xs font-semibold text-emerald-bright"><BadgeCheck className="h-3.5 w-3.5" /> {isEn ? "Verified" : "Vérifié"}</span>
                      : <span className="text-xs font-semibold text-gold">{isEn ? "Not verified" : "Non vérifié"}</span>}
                  </div>
                </>
              ) : (
                <p className="text-sm text-sage-muted">{isEn ? "No email linked" : "Aucun email associé"}</p>
              )}
            </div>
            <Button size="sm" variant="secondary" onClick={() => { setShowEmailForm(true); setEmailStep(1); }}>
              {email ? (isEn ? "Edit" : "Modifier") : (isEn ? "Add" : "Ajouter")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : emailStep === 1 ? (
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-sage">{isEn ? "New email address" : "Nouvelle adresse email"}</label>
              <input type="email" required
                className="h-10 w-full rounded-xl border border-ink-line bg-ink-raised px-3 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                value={emailValue} onChange={(e) => setEmailValue(e.target.value)} placeholder="vous@exemple.com" />
            </div>
            {email && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-sage">{isEn ? "Password" : "Mot de passe"}</label>
                <input type="password" required
                  className="h-10 w-full rounded-xl border border-ink-line bg-ink-raised px-3 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                  value={emailPwd} onChange={(e) => setEmailPwd(e.target.value)} placeholder="••••••••" />
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={emailSaving || !emailValue || (!!email && !emailPwd)}>
                {emailSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEn ? "Send OTP code" : "Envoyer le code"}
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setShowEmailForm(false)}>{isEn ? "Back" : "Retour"}</Button>
            </div>
            <Toast msg={emailMsg.msg} />
          </form>
        ) : (
          <form onSubmit={handleEmailConfirm} className="space-y-3">
            <p className="text-sm text-sage">{isEn ? `Code sent to ${emailValue}` : `Code envoyé à ${emailValue}`}</p>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-sage">{isEn ? "6-digit code" : "Code à 6 chiffres"}</label>
              <input
                className="h-10 w-full rounded-xl border border-ink-line bg-ink-raised px-3 text-center font-mono text-xl tracking-widest text-cream focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                value={emailOtp} onChange={(e) => setEmailOtp(e.target.value)} maxLength={6} inputMode="numeric" pattern="[0-9]*" required
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={emailSaving || emailOtp.length !== 6}>
                {emailSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEn ? "Validate" : "Valider"}
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setEmailStep(1)}>{isEn ? "Back" : "Retour"}</Button>
            </div>
            <Toast msg={emailMsg.msg} />
          </form>
        )}

        {/* 2FA */}
        <div className="mt-5 border-t border-ink-line pt-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-gold" />
              <span className="text-sm font-medium text-cream">{isEn ? "Two-factor authentication (2FA)" : "Double authentification (2FA)"}</span>
            </div>
            <button
              type="button" role="switch" aria-checked={twofa}
              onClick={handleToggle2FA}
              disabled={twofaSaving}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 focus-visible:ring-offset-1 ${twofa ? "bg-gold" : "bg-toggle-off"} disabled:opacity-50`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${twofa ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
          {!twofa && (
            <div className="flex gap-2 mb-2">
              {(["email", "sms"] as const).map((m) => (
                <button key={m} type="button"
                  onClick={() => setTwofaMethod(m)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${twofaMethod === m ? "bg-gold/20 text-gold border border-gold/40" : "bg-ink-raised text-sage border border-ink-line hover:border-gold/30"}`}
                >
                  {m === "email" ? "Email" : "SMS"}
                </button>
              ))}
            </div>
          )}
          {!emailConfirmed && !twofa && (
            <p className="text-xs text-sage-muted">{isEn ? "Confirm your email first to enable 2FA." : "Confirmez votre email pour activer la 2FA."}</p>
          )}
          {twofa && (
            <p className="text-xs text-sage">{isEn ? `A code will be sent via ${u?.twofa_method || twofaMethod} at each login.` : `Un code sera envoyé par ${u?.twofa_method === "sms" ? "SMS" : "email"} à chaque connexion.`}</p>
          )}
          <Toast msg={twofaMsg.msg} />
        </div>
      </div>

      {/* ── Numéro de connexion ───────────────────────────────────── */}
      <div className="card-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-medium text-cream">
          <Smartphone className="h-5 w-5 text-gold" />
          {isEn ? "Login phone number" : "Numéro de connexion"}
        </h2>
        {!showPhoneForm ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-cream">{u?.phone_masked || "—"}</p>
            <Button size="sm" variant="secondary" onClick={() => { setShowPhoneForm(true); setPhoneStep(1); }}>
              {isEn ? "Edit" : "Modifier"} <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : phoneStep === 1 ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-sage">{isEn ? "New phone number" : "Nouveau numéro"}</label>
              <input type="tel" required
                className="h-10 w-full rounded-xl border border-ink-line bg-ink-raised px-3 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                value={phoneValue} onChange={(e) => setPhoneValue(e.target.value)} placeholder="+237 6XX XX XX XX" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-sage">{isEn ? "Password" : "Mot de passe"}</label>
              <input type="password" required
                className="h-10 w-full rounded-xl border border-ink-line bg-ink-raised px-3 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                value={phonePwd} onChange={(e) => setPhonePwd(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={phoneSaving || !phoneValue || !phonePwd}>
                {phoneSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEn ? "Send OTP" : "Envoyer le code"}
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setShowPhoneForm(false)}>{isEn ? "Back" : "Retour"}</Button>
            </div>
            <Toast msg={phoneMsg.msg} />
          </form>
        ) : (
          <form onSubmit={handlePhoneConfirm} className="space-y-3">
            <p className="text-sm text-sage">{isEn ? `Code sent via SMS to ${phoneValue}` : `Code envoyé par SMS au ${phoneValue}`}</p>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-sage">{isEn ? "6-digit code" : "Code à 6 chiffres"}</label>
              <input
                className="h-10 w-full rounded-xl border border-ink-line bg-ink-raised px-3 text-center font-mono text-xl tracking-widest text-cream focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value)} maxLength={6} inputMode="numeric" pattern="[0-9]*" required />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" type="submit" disabled={phoneSaving || phoneOtp.length !== 6}>
                {phoneSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEn ? "Validate" : "Valider"}
              </Button>
              {phoneCountdown > 0
                ? <span className="text-xs text-sage-muted">{isEn ? `Resend in ${phoneCountdown}s` : `Renvoyer dans ${phoneCountdown}s`}</span>
                : <button type="button" onClick={() => handlePhoneSubmit()} disabled={phoneSaving} className="text-xs text-gold hover:underline">{isEn ? "Resend" : "Renvoyer"}</button>}
              <Button size="sm" variant="ghost" type="button" onClick={() => setPhoneStep(1)} className="ml-auto">{isEn ? "Back" : "Retour"}</Button>
            </div>
            <Toast msg={phoneMsg.msg} />
          </form>
        )}
      </div>

      {/* ── Sessions actives ──────────────────────────────────────── */}
      <div className="card-surface p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-base font-medium text-cream">
            <MonitorSmartphone className="h-5 w-5 text-gold" />
            {isEn ? "Active sessions" : "Sessions actives"}
          </h2>
          <Button size="sm" variant="outline" onClick={revokeAll} className="shrink-0 border-brick/40 text-brick hover:bg-brick/10 hover:text-brick">
            {isEn ? "Revoke all" : "Tout révoquer"}
          </Button>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-sage-muted">{isEn ? "No active session." : "Aucune session active."}</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-ink-line bg-ink-raised px-4 py-3 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-cream">{s.user_agent || (isEn ? "Unknown device" : "Appareil inconnu")}</p>
                  <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                    {s.ip_address && <span className="font-mono text-xs text-sage-muted">{s.ip_address}</span>}
                    {s.created_at && <span className="text-xs text-sage-muted">{new Date(s.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                  </div>
                </div>
                <button onClick={() => revokeSession(s.id)} className="shrink-0 rounded-xl border border-brick/40 bg-brick/10 px-3 py-1.5 text-xs font-medium text-brick transition-colors hover:bg-brick/20">
                  {isEn ? "Revoke" : "Révoquer"}
                </button>
              </div>
            ))}
          </div>
        )}
        <Toast msg={sessMsg.msg} />
      </div>

      {/* ── Documents légaux ──────────────────────────────────────── */}
      <div className="card-surface p-5">
        <h2 className="mb-3 font-display text-base font-medium text-cream">{isEn ? "Legal documents" : "Documents légaux"}</h2>
        <div className="space-y-2">
          {[
            ["/confidentialite", isEn ? "Privacy Policy (GDPR)" : "Politique de Confidentialité (RGPD)"],
            ["/cgu", isEn ? "Terms of Service" : "Conditions Générales d'Utilisation"],
          ].map(([href, label]) => (
            <Link key={String(href)} href={String(href)}
              className="flex items-center justify-between rounded-xl border border-ink-line bg-ink-raised px-4 py-3 text-sm text-coral hover:bg-ink hover:border-gold/30 transition-colors">
              {String(label)} <ChevronRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      </div>

      {/* ── Zone danger — suppression de compte ──────────────────── */}
      <div className="rounded-xl border border-brick/30 bg-brick/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-brick" />
          <p className="text-sm font-medium text-brick">{isEn ? "Danger zone" : "Zone sensible"}</p>
        </div>
        {!showDelete ? (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="border-brick/40 text-brick hover:bg-brick/10 hover:text-brick" onClick={() => setShowDelete(true)}>
              <Trash2 className="h-4 w-4" />
              {isEn ? "Delete my account" : "Supprimer mon compte"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-cream">
              {isEn
                ? <>This action is <strong>irreversible</strong>. All your data will be permanently deleted. Type <span className="font-mono font-bold text-brick">SUPPRIMER</span> to confirm.</>
                : <>Cette action est <strong>irréversible</strong>. Toutes vos données seront définitivement supprimées. Tapez <span className="font-mono font-bold text-brick">SUPPRIMER</span> pour confirmer.</>}
            </p>
            <input
              type="text" placeholder="SUPPRIMER"
              value={deleteText} onChange={(e) => setDeleteText(e.target.value)}
              className="h-10 w-full rounded-xl border border-brick/40 bg-ink-raised px-3 text-sm text-cream placeholder:text-sage-muted focus:border-brick focus:outline-none focus:ring-1 focus:ring-brick"
            />
            <Toast msg={deleteMsg.msg} />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setShowDelete(false); setDeleteText(""); }}>{isEn ? "Cancel" : "Annuler"}</Button>
              <Button variant="danger" size="sm" disabled={deleteText !== "SUPPRIMER" || deleteSaving} onClick={handleDeleteAccount}>
                {deleteSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEn ? "Delete permanently" : "Supprimer définitivement"}
              </Button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
