"use client";
import { useState, useRef, type FormEvent, type ChangeEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Camera, UserCircle, BadgeCheck, ShieldCheck, ShieldAlert,
  ShieldQuestion, ChevronRight, Loader2, AlertTriangle, Trash2,
  Mars, Venus, ImageIcon, Info,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/i18n/locale-context";
import { api } from "@/lib/api";
import { HtmlTitleInput, sanitizeHtmlTitle } from "@/components/ui/html-title-input";
import { Button } from "@/components/ui/button";
import { Modal, ModalActions } from "@/components/ui/modal";
import { ImageCropper, type CropResult } from "@/components/ui/image-cropper";

// Formats acceptés — alignés avec le backend KasoLife
const ACCEPTED_MIME = "image/jpeg,image/png,image/webp,image/avif,image/gif";
const ACCEPTED_LABEL = ".jpg, .png, .webp, .avif, .gif — max 5 Mo";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo

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
    <p className={`mt-2 flex items-center gap-1.5 text-sm font-medium ${msg.type === "success" ? "text-emerald-bright" : "text-brick"}`}>
      {msg.type === "error" && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
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

  // Crop state
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);
  const [bannerCropSrc, setBannerCropSrc] = useState<string | null>(null);

  const [avatarLoading, setAvatarLoading] = useState(false);
  const [bannerLoading, setBannerLoading] = useState(false);
  const avatarMsg = useMsg();
  const bannerMsg = useMsg();

  // Confirmation suppression
  const [deleteTarget, setDeleteTarget] = useState<"avatar" | "banner" | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const nameMsg = useMsg();
  const [nameSaving, setNameSaving] = useState(false);

  const [lifeurName, setLifeurName] = useState((user as any)?.creator_profile?.display_name || "");
  const lifeurNameMsg = useMsg();
  const [lifeurNameSaving, setLifeurNameSaving] = useState(false);

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

  // ── Validation taille fichier ────────────────────────────────
  const validateFile = (file: File, showFn: (t: string, tp: "success" | "error") => void): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      showFn(isEn ? "File too large (max 5 MB)" : "Fichier trop volumineux (max 5 Mo)", "error");
      return false;
    }
    return true;
  };

  // ── Avatar : sélection → crop ────────────────────────────────
  const handleAvatarFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateFile(file, avatarMsg.show)) return;
    const url = URL.createObjectURL(file);
    setAvatarCropSrc(url);
    if (avatarRef.current) avatarRef.current.value = "";
  };

  const handleAvatarCropConfirm = async (result: CropResult) => {
    setAvatarCropSrc(null);
    setAvatarLoading(true);
    avatarMsg.show("", "success"); // reset
    try {
      const fd = new FormData();
      fd.append("file", result.blob, "avatar.webp");
      await api.post("/uploads/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await refresh();
      avatarMsg.show(isEn ? "Photo updated." : "Photo mise à jour.", "success");
    } catch (err) {
      avatarMsg.show(errText(err), "error");
    } finally {
      setAvatarLoading(false);
    }
  };

  // ── Bannière : sélection → crop ──────────────────────────────
  const handleBannerFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateFile(file, bannerMsg.show)) return;
    const url = URL.createObjectURL(file);
    setBannerCropSrc(url);
    if (bannerRef.current) bannerRef.current.value = "";
  };

  const handleBannerCropConfirm = async (result: CropResult) => {
    setBannerCropSrc(null);
    setBannerLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", result.blob, "banner.webp");
      await api.post("/uploads/banner", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await refresh();
      bannerMsg.show(isEn ? "Banner updated." : "Bannière mise à jour.", "success");
    } catch (err) {
      bannerMsg.show(errText(err), "error");
    } finally {
      setBannerLoading(false);
    }
  };

  // ── Suppression avatar / bannière ────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/uploads/${deleteTarget}`);
      await refresh();
      setDeleteTarget(null);
      (deleteTarget === "avatar" ? avatarMsg : bannerMsg).show(
        isEn ? "Deleted." : "Supprimé.",
        "success",
      );
    } catch (err) {
      (deleteTarget === "avatar" ? avatarMsg : bannerMsg).show(errText(err), "error");
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Formulaires identité ─────────────────────────────────────
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

  const handleSaveLifeurName = async (e: FormEvent) => {
    e.preventDefault();
    const sanitized = sanitizeHtmlTitle(lifeurName.trim());
    if (!sanitized) return;
    if (sanitized.length > 100) {
      lifeurNameMsg.show(isEn ? "Max 100 characters." : "100 caractères maximum.", "error");
      return;
    }
    setLifeurNameSaving(true);
    try {
      await api.put("/creators/me", { display_name: sanitized });
      await refresh();
      lifeurNameMsg.show(isEn ? "Name updated." : "Nom mis à jour.", "success");
    } catch (err) { lifeurNameMsg.show(errText(err), "error"); }
    finally { setLifeurNameSaving(false); }
  };

  const PSEUDO_MAX = 5;
  const EXEMPT_ROLES = ["super_admin", "root_admin"];
  const pseudoChangesCount = (u.pseudo_changes_count ?? 0) as number;
  const isExempt = EXEMPT_ROLES.includes(u.role);
  const pseudoChangesRemaining = isExempt ? null : PSEUDO_MAX - pseudoChangesCount;
  const pseudoLimitReached = !isExempt && pseudoChangesRemaining !== null && pseudoChangesRemaining <= 0;

  const [showPseudoWarning, setShowPseudoWarning] = useState(false);

  const handleSavePseudo = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPseudo.trim()) return;
    // Afficher popup si dernier changement restant
    if (!isExempt && pseudoChangesRemaining === 1 && !showPseudoWarning) {
      setShowPseudoWarning(true);
      return;
    }
    setShowPseudoWarning(false);
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
      await api.put("/auth/profile", { bio: sanitizeHtmlTitle(bio) });
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
          <div className="flex flex-row flex-wrap gap-2">
            <input
              ref={avatarRef}
              type="file"
              accept={ACCEPTED_MIME}
              className="hidden"
              onChange={handleAvatarFileSelect}
            />
            <Button size="sm" variant="secondary" onClick={() => avatarRef.current?.click()} disabled={avatarLoading}>
              {avatarLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {user.avatar_url
                ? (isEn ? "Change photo" : "Changer la photo")
                : (isEn ? "Add photo" : "Ajouter une photo")}
            </Button>
            {user.avatar_url && (
              <button
                type="button"
                onClick={() => setDeleteTarget("avatar")}
                disabled={avatarLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-800/60 bg-rose-800/80 px-3 h-9 text-sm font-medium text-white transition-colors hover:bg-rose-900 disabled:pointer-events-none disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {isEn ? "Remove photo" : "Supprimer la photo"}
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-sage-muted">
          <ImageIcon className="h-3 w-3 shrink-0" />
          {ACCEPTED_LABEL}
        </p>
        <Toast msg={avatarMsg.msg} />
      </div>

      {/* ── Bannière ─────────────────────────────────────────────── */}
      <div className="card-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 font-display text-base font-medium text-cream">
          <Camera className="h-5 w-5 text-gold" />
          {isEn ? "Banner" : "Bannière"}
        </h2>
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-br from-gold/20 via-ink-raised to-emerald/20">
          {u.banner_url && (
            <Image src={u.banner_url} alt="Bannière" fill className="object-cover" sizes="600px" />
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={bannerRef}
            type="file"
            accept={ACCEPTED_MIME}
            className="hidden"
            onChange={handleBannerFileSelect}
          />
          <Button size="sm" variant="secondary" onClick={() => bannerRef.current?.click()} disabled={bannerLoading}>
            {bannerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {u.banner_url
              ? (isEn ? "Change banner" : "Changer la bannière")
              : (isEn ? "Add banner" : "Ajouter une bannière")}
          </Button>
          {u.banner_url && (
            <button
              type="button"
              onClick={() => setDeleteTarget("banner")}
              disabled={bannerLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-800/60 bg-rose-800/80 px-3 h-9 text-sm font-medium text-white transition-colors hover:bg-rose-900 disabled:pointer-events-none disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {isEn ? "Remove banner" : "Supprimer la bannière"}
            </button>
          )}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-sage-muted">
          <ImageIcon className="h-3 w-3 shrink-0" />
          {ACCEPTED_LABEL}
        </p>
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
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-sage-muted">{isEn ? "Full name" : "Nom complet"}</p>
            <span className="flex items-center gap-1 rounded-lg bg-ink-raised px-2 py-0.5 text-[10px] text-sage-muted">
              <ShieldCheck className="h-3 w-3 shrink-0 text-gold" />
              {isEn ? "Private — never visible publicly" : "Privé — jamais visible publiquement"}
            </span>
          </div>
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

        {/* Nom Lifeur(se) — visible pour tous les utilisateurs */}
        <form onSubmit={handleSaveLifeurName} className="mb-5 space-y-3 border-t border-ink-line pt-5">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-muted">
                {isEn ? "Lifer name" : "Nom Lifeur(se)"}
              </p>
              <p className="text-xs text-sage">
                {isEn
                  ? "Your public name displayed on your profile and to your subscribers. Supports HTML for styling, animations and emojis."
                  : "Votre nom public affiché sur votre profil et auprès de vos abonnés. Supporte le HTML pour la mise en forme, les animations et les emojis."}
              </p>
            </div>

            <HtmlTitleInput
              value={lifeurName}
              onChange={setLifeurName}
              maxLength={100}
              placeholder={isEn ? "✨ My Name ✨" : "✨ Mon Nom ✨"}
            />

            <div className="flex justify-end">
              <Button size="sm" type="submit" disabled={lifeurNameSaving || !sanitizeHtmlTitle(lifeurName).trim()}>
                {lifeurNameSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isEn ? "Update" : "Mettre à jour"}
              </Button>
            </div>
            <Toast msg={lifeurNameMsg.msg} />
          </form>

        {/* Pseudo */}
        <form onSubmit={handleSavePseudo} className="mb-5 space-y-3 border-t border-ink-line pt-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-sage-muted">{isEn ? "Nickname" : "Pseudonyme"}</p>
            {/* Décompte changements restants */}
            {!isExempt && (
              <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                pseudoLimitReached
                  ? "bg-brick/15 text-brick"
                  : pseudoChangesRemaining === 1
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-ink-raised text-sage-muted"
              }`}>
                <Info className="h-3 w-3 shrink-0" />
                {pseudoLimitReached
                  ? (isEn ? "0 changes left" : "0 changement restant")
                  : isEn
                    ? `${pseudoChangesRemaining}/${PSEUDO_MAX} changes left`
                    : `${pseudoChangesRemaining}/${PSEUDO_MAX} changements restants`}
              </span>
            )}
          </div>

          {/* Règles de validation visibles */}
          <p className="text-xs text-sage-muted">
            {isEn
              ? "3–20 characters: letters, numbers and underscore (_) only"
              : "3 à 20 caractères : lettres, chiffres et underscore (_) uniquement"}
          </p>

          <div className="flex gap-2">
            <input
              className="h-10 flex-1 rounded-xl border border-ink-line bg-ink-raised px-3 text-sm text-cream placeholder:text-sage-muted focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold disabled:opacity-50"
              value={newPseudo}
              onChange={(e) => setNewPseudo(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              placeholder={user.pseudo ? `@${user.pseudo}` : "@monpseudo"}
              maxLength={20}
              disabled={pseudoLimitReached}
            />
            <Button size="sm" type="submit" disabled={pseudoSaving || !newPseudo.trim() || pseudoLimitReached}>
              {pseudoSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEn ? "Change" : "Changer"}
            </Button>
          </div>

          {/* Alerte limite atteinte */}
          {pseudoLimitReached && (
            <p className="flex items-center gap-1.5 text-xs text-brick">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {isEn
                ? `You have used all ${PSEUDO_MAX} lifetime pseudo changes. Contact support if needed.`
                : `Vous avez utilisé vos ${PSEUDO_MAX} changements de pseudo autorisés à vie. Contactez le support si nécessaire.`}
            </p>
          )}

          <Toast msg={pseudoMsg.msg} />
        </form>

        {/* Popup confirmation dernier changement */}
        <Modal
          open={showPseudoWarning}
          onClose={() => setShowPseudoWarning(false)}
          title={isEn ? "⚠️ Last pseudo change" : "⚠️ Dernier changement de pseudo"}
          size="sm"
        >
          <p className="text-sm text-sage">
            {isEn
              ? `This is your last allowed pseudo change (${PSEUDO_MAX}/${PSEUDO_MAX}). Once confirmed, you will no longer be able to change your username. Are you sure?`
              : `C'est votre dernier changement de pseudo autorisé (${PSEUDO_MAX}/${PSEUDO_MAX}). Une fois confirmé, vous ne pourrez plus changer votre identifiant. Êtes-vous sûr(e) ?`}
          </p>
          <ModalActions>
            <Button variant="ghost" size="sm" onClick={() => setShowPseudoWarning(false)}>
              {isEn ? "Cancel" : "Annuler"}
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={pseudoSaving}
              onClick={() => {
                // Relancer le submit en bypassant le guard (warning déjà affiché)
                setPseudoSaving(true);
                api.put("/auth/pseudo", { pseudo: newPseudo.trim() })
                  .then(() => refresh())
                  .then(() => { setNewPseudo(""); pseudoMsg.show(isEn ? "Nickname updated." : "Pseudo mis à jour.", "success"); })
                  .catch((err: any) => pseudoMsg.show(errText(err), "error"))
                  .finally(() => { setPseudoSaving(false); setShowPseudoWarning(false); });
              }}
            >
              {pseudoSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEn ? "Confirm — last change" : "Confirmer — dernier changement"}
            </Button>
          </ModalActions>
        </Modal>

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

      {/* ── Croppers ─────────────────────────────────────────────── */}
      {avatarCropSrc && (
        <ImageCropper
          imageSrc={avatarCropSrc}
          ratio="square"
          onCancel={() => { setAvatarCropSrc(null); URL.revokeObjectURL(avatarCropSrc); }}
          onConfirm={handleAvatarCropConfirm}
        />
      )}
      {bannerCropSrc && (
        <ImageCropper
          imageSrc={bannerCropSrc}
          ratio="banner"
          onCancel={() => { setBannerCropSrc(null); URL.revokeObjectURL(bannerCropSrc); }}
          onConfirm={handleBannerCropConfirm}
        />
      )}

      {/* ── Modale confirmation suppression ─────────────────────── */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget === "avatar"
          ? (isEn ? "Remove profile photo?" : "Supprimer la photo de profil ?")
          : (isEn ? "Remove banner?" : "Supprimer la bannière ?")}
        size="sm"
      >
        <p className="text-sm text-sage">
          {isEn
            ? "This action cannot be undone."
            : "Cette action est irréversible."}
        </p>
        <ModalActions>
          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
            {isEn ? "Cancel" : "Annuler"}
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleteLoading}>
            {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {isEn ? "Delete" : "Supprimer"}
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
