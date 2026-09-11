"use client";
import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Camera, UserCircle, BadgeCheck, ShieldCheck, ShieldAlert,
  ShieldQuestion, ChevronRight, Loader2, AlertTriangle, Trash2,
  Mars, Venus,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/i18n/locale-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

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
    <p className={`mt-2 text-sm font-medium ${msg.type === "success" ? "text-emerald-bright" : "text-brick"}`}>
      {msg.text}
    </p>
  );
}

export function TabIdentite() {
  const { user, refresh } = useAuth();
  const { locale } = useLocale();
  const isEn = locale === "en";

  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const [avatarLoading, setAvatarLoading] = useState(false);
  const [bannerLoading, setBannerLoading] = useState(false);
  const avatarMsg = useMsg();
  const bannerMsg = useMsg();

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const nameMsg = useMsg();
  const [nameSaving, setNameSaving] = useState(false);

  const [newPseudo, setNewPseudo] = useState("");
  const pseudoMsg = useMsg();
  const [pseudoSaving, setPseudoSaving] = useState(false);

  const [bio, setBio] = useState((user as any)?.bio || "");
  const bioMsg = useMsg();
  const [bioSaving, setBioSaving] = useState(false);

  const [birthDate, setBirthDate] = useState("");
  const bdMsg = useMsg();
  const [bdSaving, setBdSaving] = useState(false);

  const [gender, setGender] = useState<"M" | "F" | "">("");
  const genderMsg = useMsg();
  const [genderSaving, setGenderSaving] = useState(false);

  if (!user) return null;

  const u = user as any;
  const errText = (err: unknown) =>
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error || (isEn ? "Error" : "Erreur");

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post("/uploads/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await refresh();
      avatarMsg.show(isEn ? "Photo updated." : "Photo mise à jour.", "success");
    } catch (err) {
      avatarMsg.show(errText(err), "error");
    } finally { setAvatarLoading(false); if (avatarRef.current) avatarRef.current.value = ""; }
  };

  const handleBannerChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post("/uploads/banner", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await refresh();
      bannerMsg.show(isEn ? "Banner updated." : "Bannière mise à jour.", "success");
    } catch (err) {
      bannerMsg.show(errText(err), "error");
    } finally { setBannerLoading(false); if (bannerRef.current) bannerRef.current.value = ""; }
  };

  const handleSaveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!prenom.trim() || !nom.trim()) return;
    setNameSaving(true);
    try {
      await api.put("/auth/name", { prenom: prenom.trim(), nom: nom.trim() });
      await refresh();
      setPrenom(""); setNom("");
      nameMsg.show(isEn ? "Name updated." : "Nom mis à jour.", "success");
    } catch (err) { nameMsg.show(errText(err), "error"); }
    finally { setNameSaving(false); }
  };

  const handleSavePseudo = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPseudo.trim()) return;
    setPseudoSaving(true);
    try {
      await api.put("/auth/pseudo", { pseudo: newPseudo.trim() });
      await refresh();
      setNewPseudo("");
      pseudoMsg.show(isEn ? "Nickname updated." : "Pseudo mis à jour.", "success");
    } catch (err) { pseudoMsg.show(errText(err), "error"); }
    finally { setPseudoSaving(false); }
  };

  const handleSaveBio = async (e: FormEvent) => {
    e.preventDefault();
    setBioSaving(true);
    try {
      await api.put("/auth/profile", { bio });
      await refresh();
      bioMsg.show(isEn ? "Bio updated." : "Bio mise à jour.", "success");
    } catch (err) { bioMsg.show(errText(err), "error"); }
    finally { setBioSaving(false); }
  };

  const handleSaveBirthDate = async (e: FormEvent) => {
    e.preventDefault();
    if (!birthDate) return;
    setBdSaving(true);
    try {
      await api.put("/auth/birth-date", { birth_date: birthDate });
      await refresh();
      setBirthDate("");
      bdMsg.show(isEn ? "Birth date updated." : "Date de naissance mise à jour.", "success");
    } catch (err) { bdMsg.show(errText(err), "error"); }
    finally { setBdSaving(false); }
  };

  const handleSaveGender = async (e: FormEvent) => {
    e.preventDefault();
    if (!gender) return;
    setGenderSaving(true);
    try {
      await api.put("/auth/gender", { gender });
      await refresh();
      setGender("");
      genderMsg.show(isEn ? "Gender updated." : "Genre mis à jour.", "success");
    } catch (err) { genderMsg.show(errText(err), "error"); }
    finally { setGenderSaving(false); }
  };

  const maxBirthDate = new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().split("T")[0];

  return (
    <div className="space-y-4">

      {/* ── Photo de profil ─────────────────────────────────────── */}
      <div className="card-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-medium text-cream">
          <Camera className="h-5 w-5 text-gold" />
          {isEn ? "Profile photo" : "Photo de profil"}
        </h2>
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-ink-raised border-2 border-ink-line">
            {user.avatar_url ? (
              <Image src={user.avatar_url} alt="Avatar" fill className="object-cover" sizes="80px" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-2xl text-gold">
                {user.pseudo?.[0]?.toUpperCase() || "?"}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
            <Button size="sm" variant="secondary" onClick={() => avatarRef.current?.click()} disabled={avatarLoading}>
              {avatarLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {user.avatar_url ? (isEn ? "Change photo" : "Changer la photo") : (isEn ? "Add photo" : "Ajouter une photo")}
            </Button>
          </div>
        </div>
        <Toast msg={avatarMsg.msg} />
      </div>

      {/* ── Bannière ─────────────────────────────────────────────── */}
      <div className="card-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-medium text-cream">
          <Camera className="h-5 w-5 text-gold" />
          {isEn ? "Banner" : "Bannière"}
        </h2>
        <div className="relative aspect-[4/1] w-full overflow-hidden rounded-xl bg-gradient-to-br from-gold/20 via-ink-raised to-emerald/20">
          {u.banner_url && (
            <Image src={u.banner_url} alt="Bannière" fill className="object-cover" sizes="600px" />
          )}
        </div>
        <input ref={bannerRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleBannerChange} />
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => bannerRef.current?.click()} disabled={bannerLoading}>
          {bannerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {u.banner_url ? (isEn ? "Change banner" : "Changer la bannière") : (isEn ? "Add banner" : "Ajouter une bannière")}
        </Button>
        <Toast msg={bannerMsg.msg} />
      </div>

      {/* ── Mon identité (lecture) ───────────────────────────────── */}
      <div className="card-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-medium text-cream">
          <UserCircle className="h-5 w-5 text-gold" />
          {isEn ? "My identity" : "Mon identité"}
        </h2>
        <div className="divide-y divide-ink-line">
          {([
            [isEn ? "Full name" : "Nom complet", u.name || "—"],
            [isEn ? "Nickname" : "Pseudonyme", u.pseudo ? `@${u.pseudo}` : "—"],
            [isEn ? "Date of birth" : "Date de naissance", u.birth_date ? new Date(u.birth_date).toLocaleDateString("fr-FR") : "—"],
            [isEn ? "Member since" : "Membre depuis", u.created_at ? new Date(u.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "—"],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-sage">{label}</span>
              <span className="text-sm font-medium text-cream">{value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-2.5">
            <span className="text-sm text-sage">{isEn ? "Gender" : "Sexe"}</span>
            <span className="text-sm font-medium text-cream">
              {u.gender === "M" && (isEn ? "Male" : "Masculin")}
              {u.gender === "F" && (isEn ? "Female" : "Féminin")}
              {!u.gender && "—"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Modifier identité ─────────────────────────────────────── */}
      <div className="card-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-medium text-cream">
          <BadgeCheck className="h-5 w-5 text-gold" />
          {isEn ? "Edit my identity" : "Modifier mon identité"}
        </h2>

        {/* KYC status */}
        <div className={`mb-4 flex items-center gap-3 rounded-xl px-4 py-3 ${u.kyc_status === "VERIFIED" ? "bg-emerald/10 border border-emerald/30" : "bg-ink-raised border border-ink-line"}`}>
          {u.kyc_status === "VERIFIED"
            ? <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-bright" />
            : u.kyc_status === "FAILED" || u.kyc_status === "SUPPORT"
            ? <ShieldAlert className="h-5 w-5 shrink-0 text-brick" />
            : <ShieldQuestion className="h-5 w-5 shrink-0 text-gold" />}
          <span className={`text-sm font-medium ${u.kyc_status === "VERIFIED" ? "text-emerald-bright" : "text-sage"}`}>
            {u.kyc_status === "VERIFIED"
              ? (isEn ? "Identity verified" : "Identité vérifiée")
              : u.kyc_status === "FAILED"
              ? (isEn ? "Verification failed — you can retry" : "Vérification échouée — vous pouvez réessayer")
              : u.kyc_status === "SUPPORT"
              ? (isEn ? "Limit reached — contact support" : "Limite atteinte — contactez le support")
              : (isEn ? "Identity not verified" : "Identité non vérifiée")}
          </span>
        </div>
        {u.kyc_status !== "SUPPORT" && (
          <div className="mb-5 flex justify-end">
            <Link href="/profil/kyc">
              <Button size="sm">
                {u.kyc_status === "VERIFIED"
                  ? (isEn ? "Update my identity" : "Mettre à jour mon identité")
                  : (isEn ? "Verify my identity" : "Vérifier mon identité")}
                <ChevronRight className="h-4 w-4 shrink-0" />
              </Button>
            </Link>
          </div>
        )}

        {/* Nom complet */}
        <form onSubmit={handleSaveName} className="mb-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-muted">{isEn ? "Full name" : "Nom complet"}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-sage">{isEn ? "First name" : "Prénom"}</label>
              <input
                className="h-10 rounded-xl border border-ink-line bg-ink-raised px-3 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                value={prenom} onChange={(e) => setPrenom(e.target.value)}
                placeholder={u.name?.split(" ")[0] || (isEn ? "First name" : "Prénom")}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-sage">{isEn ? "Last name" : "Nom"}</label>
              <input
                className="h-10 rounded-xl border border-ink-line bg-ink-raised px-3 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                value={nom} onChange={(e) => setNom(e.target.value)}
                placeholder={u.name?.split(" ").slice(1).join(" ") || (isEn ? "Last name" : "Nom")}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" type="submit" disabled={nameSaving || !prenom.trim() || !nom.trim()}>
              {nameSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEn ? "Update" : "Mettre à jour"}
            </Button>
          </div>
          <Toast msg={nameMsg.msg} />
        </form>

        {/* Pseudo */}
        <form onSubmit={handleSavePseudo} className="mb-5 space-y-3 border-t border-ink-line pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-muted">{isEn ? "Nickname" : "Pseudonyme"}</p>
          <div className="flex gap-2">
            <input
              className="h-10 flex-1 rounded-xl border border-ink-line bg-ink-raised px-3 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              value={newPseudo} onChange={(e) => setNewPseudo(e.target.value)}
              placeholder={user.pseudo ? `@${user.pseudo}` : "@monpseudo"}
            />
            <Button size="sm" type="submit" disabled={pseudoSaving || !newPseudo.trim()}>
              {pseudoSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEn ? "Change" : "Changer"}
            </Button>
          </div>
          <Toast msg={pseudoMsg.msg} />
        </form>

        {/* Bio */}
        <form onSubmit={handleSaveBio} className="mb-5 space-y-3 border-t border-ink-line pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-muted">Bio</p>
          <textarea
            className="min-h-20 w-full rounded-xl border border-ink-line bg-ink-raised px-3.5 py-2.5 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold resize-none"
            maxLength={500}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={isEn ? "Tell us about yourself…" : "Parlez un peu de vous…"}
            rows={3}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-sage-muted">{bio.length}/500</span>
            <Button size="sm" type="submit" disabled={bioSaving}>
              {bioSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEn ? "Save" : "Enregistrer"}
            </Button>
          </div>
          <Toast msg={bioMsg.msg} />
        </form>

        {/* Date de naissance */}
        <form onSubmit={handleSaveBirthDate} className="mb-5 space-y-3 border-t border-ink-line pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-muted">{isEn ? "Date of birth" : "Date de naissance"}</p>
          {u.birth_date && (
            <p className="text-xs text-sage">
              {isEn ? "Current: " : "Actuelle : "}{new Date(u.birth_date).toLocaleDateString("fr-FR")}
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="date" max={maxBirthDate}
              className="h-10 flex-1 rounded-xl border border-ink-line bg-ink-raised px-3 text-sm text-cream focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
            />
            <Button size="sm" type="submit" disabled={bdSaving || !birthDate}>
              {bdSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEn ? "Update" : "Mettre à jour"}
            </Button>
          </div>
          <Toast msg={bdMsg.msg} />
        </form>

        {/* Genre */}
        <form onSubmit={handleSaveGender} className="space-y-3 border-t border-ink-line pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-sage-muted">{isEn ? "Gender" : "Sexe"}</p>
          <div className="grid grid-cols-2 gap-3">
            {(["M", "F"] as const).map((g) => (
              <button
                key={g} type="button"
                onClick={() => setGender(g)}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-medium transition-colors ${
                  gender === g
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-ink-line bg-ink-raised text-sage hover:border-gold/50"
                }`}
              >
                {g === "M" ? <Mars className="h-4 w-4" /> : <Venus className="h-4 w-4" />}
                {g === "M" ? (isEn ? "Male" : "Masculin") : (isEn ? "Female" : "Féminin")}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button size="sm" type="submit" disabled={genderSaving || !gender || gender === u.gender}>
              {genderSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEn ? "Update gender" : "Mettre à jour le genre"}
            </Button>
          </div>
          <Toast msg={genderMsg.msg} />
        </form>
      </div>
    </div>
  );
}
