"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/i18n/locale-context";

const COUNTRIES = [
  { code: "CM", label: "Cameroun (+237)" },
  { code: "CI", label: "Côte d'Ivoire (+225)" },
  { code: "SN", label: "Sénégal (+221)" },
  { code: "GA", label: "Gabon (+241)" },
  { code: "BF", label: "Burkina Faso (+226)" },
  { code: "TG", label: "Togo (+228)" },
  { code: "BJ", label: "Bénin (+229)" },
];

export default function InscriptionPage() {
  return (
    <Suspense>
      <InscriptionForm />
    </Suspense>
  );
}

function InscriptionForm() {
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref") || undefined;
  const t = useT();

  const [form, setForm] = useState({
    phone: "",
    pseudo: "",
    name: "",
    password: "",
    country_iso: "CM",
    birth_date: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({ ...form, ref });
      router.push("/");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Une erreur est survenue. Vérifiez vos informations.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <h1 className="font-display text-2xl font-medium text-cream">{t("auth.signupTitle")}</h1>
        <p className="mt-1 text-sm text-sage">{t("auth.signupSubtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <Input label={t("auth.phone")} type="tel" placeholder="+237690000000" required value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          <Input label={t("auth.fullName")} required value={form.name} onChange={(e) => update("name", e.target.value)} />
          <Input label={t("auth.pseudo")} required placeholder={t("auth.pseudoHint")} value={form.pseudo} onChange={(e) => update("pseudo", e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-cream">{t("auth.country")}</label>
            <select
              className="h-11 rounded-xl border border-ink-line bg-ink-surface px-3.5 text-sm text-cream focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              value={form.country_iso}
              onChange={(e) => update("country_iso", e.target.value)}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
          <Input label={t("auth.birthDate")} type="date" required value={form.birth_date} onChange={(e) => update("birth_date", e.target.value)} />
          <Input label={t("auth.password")} type="password" required minLength={8} value={form.password} onChange={(e) => update("password", e.target.value)} />

          {error && <p className="rounded-xl bg-brick/10 border border-brick/30 px-3 py-2 text-sm text-brick">{error}</p>}

          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? t("auth.signingUp") : t("auth.signupButton")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-sage">
          {t("auth.hasAccount")}{" "}
          <Link href="/connexion" className="text-gold hover:underline">{t("auth.loginButton")}</Link>
        </p>
        <p className="mt-2 text-center text-xs text-sage-muted">{t("auth.ageNotice")}</p>
      </div>
    </main>
  );
}
