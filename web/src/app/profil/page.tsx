"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BadgeCheck, ShieldCheck, ShieldAlert, ShieldQuestion, LogOut, Plus, Star, Trash2 } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useT, useLocale } from "@/i18n/locale-context";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

interface MobileMoney {
  id: string;
  operator: string;
  phone_masked: string;
  is_default: boolean;
  is_verified: boolean;
}

export default function ProfilPage() {
  const t = useT();
  const { locale } = useLocale();
  const { user, loading, logout, refresh } = useAuth();
  const router = useRouter();
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [mobileMoneys, setMobileMoneys] = useState<MobileMoney[]>([]);
  const [showAddMm, setShowAddMm] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      setBio((user as any).bio || "");
      api.get("/wallet/mobile-money").then(({ data }) => setMobileMoneys(data || [])).catch(() => {});
    }
  }, [user]);

  if (loading || !user) return null;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/uploads/avatar", formData, { headers: { "Content-Type": "multipart/form-data" } });
      await refresh();
    } catch {} finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveBio = async () => {
    setSaving(true);
    try {
      await api.put("/auth/profile", { bio });
      await refresh();
    } catch {} finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:pb-12">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-full bg-ink-raised">
            {user.avatar_url ? (
              <Image src={user.avatar_url} alt="" fill className="object-cover" sizes="80px" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-2xl text-gold">
                {user.pseudo?.[0]?.toUpperCase()}
              </div>
            )}
            <label className="absolute inset-0 flex items-center justify-center bg-ink/60 text-xs text-cream opacity-0 transition-opacity hover:opacity-100 cursor-pointer">
              {uploadingAvatar ? "..." : "Modifier"}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>
          <div>
            <h1 className="font-display text-2xl font-medium text-cream">@{user.pseudo}</h1>
            <p className="text-sm text-sage">{user.name}</p>
            <Badge variant={user.role === "CREATOR" ? "emerald" : "default"} className="mt-1">
              {user.role}
            </Badge>
          </div>
        </div>

        {/* KYC */}
        <Card className="mt-6">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <KycIcon status={user.kyc_status} />
              <div>
                <p className="font-medium text-cream">Vérification d&apos;identité (KYC)</p>
                <p className="text-sm text-sage">{KYC_LABELS[user.kyc_status] || user.kyc_status}</p>
              </div>
            </div>
            {user.kyc_status !== "VERIFIED" && (
              <Button size="sm" onClick={() => router.push("/profil/kyc")}>Vérifier</Button>
            )}
          </CardContent>
        </Card>

        {/* Bio */}
        <Card className="mt-4">
          <CardHeader><CardTitle>À propos</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <textarea
              className="min-h-24 rounded-xl border border-ink-line bg-ink-raised px-3.5 py-2.5 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              placeholder={t("profile.aboutPlaceholder")}
              maxLength={500}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <Button size="sm" onClick={handleSaveBio} disabled={saving} className="self-start">
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </CardContent>
        </Card>

        {/* Mobile Money */}
        <Card className="mt-4">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("profile.mobileMoneyNumbers")}</CardTitle>
            <Button size="sm" variant="secondary" onClick={() => setShowAddMm(true)}>
              <Plus className="h-4 w-4" /> Ajouter
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {mobileMoneys.length === 0 ? (
              <p className="text-sm text-sage-muted">Aucun numéro enregistré.</p>
            ) : (
              mobileMoneys.map((mm) => (
                <div key={mm.id} className="flex items-center justify-between rounded-xl border border-ink-line bg-ink-raised px-3 py-2">
                  <div>
                    <p className="text-sm text-cream">{mm.operator} · {mm.phone_masked}</p>
                    <div className="mt-0.5 flex gap-1.5">
                      {mm.is_default && <Badge variant="gold"><Star className="h-3 w-3" /> Par défaut</Badge>}
                      <Badge variant={mm.is_verified ? "emerald" : "default"}>
                        {mm.is_verified ? t("profile.verified") : t("profile.unverified")}
                      </Badge>
                    </div>
                  </div>
                  <MobileMoneyActions mm={mm} onChange={(updated) => setMobileMoneys(updated)} all={mobileMoneys} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {showAddMm && (
          <AddMobileMoneyDialog
            onClose={() => setShowAddMm(false)}
            onAdded={(mm) => { setMobileMoneys((prev) => [...prev, mm]); setShowAddMm(false); }}
          />
        )}

        {/* Langue */}
        <Card className="mt-4">
          <CardContent className="flex items-center justify-between p-4">
            <p className="text-sm font-medium text-cream">{t("common.language")}</p>
            <LanguageSwitcher />
          </CardContent>
        </Card>

        <Button variant="ghost" className="mt-6 w-full" onClick={() => { logout(); router.push("/"); }}>
          <LogOut className="h-4 w-4" /> {t("profile.logout")}
        </Button>
      </main>
      <BottomNav />
    </>
  );
}

const KYC_LABELS: Record<string, string> = {
  PENDING: "Non vérifiée — requise pour devenir créateur ou retirer des fonds",
  VERIFIED: "Identité vérifiée",
  FAILED: "Vérification échouée — vous pouvez réessayer",
  SUPPORT: "Limite de tentatives atteinte — contactez le support",
};

function KycIcon({ status }: { status: string }) {
  if (status === "VERIFIED") return <ShieldCheck className="h-6 w-6 text-emerald-bright" />;
  if (status === "FAILED" || status === "SUPPORT") return <ShieldAlert className="h-6 w-6 text-brick" />;
  return <ShieldQuestion className="h-6 w-6 text-gold" />;
}

function MobileMoneyActions({
  mm, onChange, all,
}: { mm: MobileMoney; onChange: (list: MobileMoney[]) => void; all: MobileMoney[] }) {
  const setDefault = async () => {
    try {
      await api.put(`/wallet/mobile-money/${mm.id}/default`);
      onChange(all.map((m) => ({ ...m, is_default: m.id === mm.id })));
    } catch {}
  };
  const remove = async () => {
    if (!confirm("Supprimer ce numéro ?")) return;
    try {
      await api.delete(`/wallet/mobile-money/${mm.id}`);
      onChange(all.filter((m) => m.id !== mm.id));
    } catch {}
  };
  return (
    <div className="flex gap-1">
      {!mm.is_default && (
        <button onClick={setDefault} className="rounded p-1.5 text-sage hover:text-gold" title="Définir par défaut">
          <Star className="h-4 w-4" />
        </button>
      )}
      <button onClick={remove} className="rounded p-1.5 text-sage hover:text-brick" title="Supprimer">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function AddMobileMoneyDialog({
  onClose, onAdded,
}: { onClose: () => void; onAdded: (mm: MobileMoney) => void }) {
  const t = useT();
  const [phone, setPhone] = useState("");
  const [operator, setOperator] = useState("MTN");
  const [otpRequested, setOtpRequested] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      await api.post("/wallet/mobile-money/request-otp", { phone, operator });
      setOtpRequested(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur lors de l'envoi du code.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/wallet/mobile-money", { phone, operator, otp });
      onAdded(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Code invalide.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-ink-line bg-ink-surface p-5">
        <h3 className="font-display text-lg text-cream">Ajouter un numéro Mobile Money</h3>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-cream">Opérateur</label>
            <select
              className="h-11 rounded-xl border border-ink-line bg-ink-raised px-3.5 text-sm text-cream focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              disabled={otpRequested}
            >
              <option value="MTN">MTN Mobile Money</option>
              <option value="ORANGE">Orange Money</option>
            </select>
          </div>
          <Input
            label={t("profile.phoneNumber")}
            type="tel"
            placeholder="+237690000000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={otpRequested}
          />
          {otpRequested && (
            <Input
              label={t("profile.smsCode")}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
          )}
          {error && <p className="text-sm text-brick">{error}</p>}
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={onClose}>{t("common.cancel")}</Button>
            {otpRequested ? (
              <Button className="flex-1" onClick={handleConfirm} disabled={loading || !otp}>
                {loading ? "..." : t("common.confirm")}
              </Button>
            ) : (
              <Button className="flex-1" onClick={handleRequestOtp} disabled={loading || !phone}>
                {loading ? "..." : t("profile.sendCode")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
