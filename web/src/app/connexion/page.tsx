"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/i18n/locale-context";

export default function ConnexionPage() {
  const { login } = useAuth();
  const t = useT();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(phone, password);
      router.push("/");
    } catch (err: any) {
      setError(err?.response?.data?.error || t("auth.loginError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>

        <h1 className="font-display text-2xl font-medium text-cream">{t("auth.loginTitle")}</h1>
        <p className="mt-1 text-sm text-sage">{t("auth.loginSubtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <Input label={t("auth.phone")} type="tel" placeholder="+237690000000" required value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label={t("auth.password")} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />

          {error && <p className="rounded-xl bg-brick/10 border border-brick/30 px-3 py-2 text-sm text-brick">{error}</p>}

          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? t("auth.loggingIn") : t("auth.loginButton")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-sage">
          {t("auth.noAccount")}{" "}
          <Link href="/inscription" className="text-gold hover:underline">{t("nav.signup")}</Link>
        </p>
      </div>
    </main>
  );
}
