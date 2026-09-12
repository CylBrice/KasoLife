"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, Wallet as WalletIcon, Smartphone, History } from "lucide-react";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/ui/amount-input";
import { formatFCFA, formatRelativeDate } from "@/lib/utils";
import { api } from "@/lib/api";
import { useT } from "@/i18n/locale-context";
import { useAuth } from "@/contexts/auth-context";
import { TabPaiements } from "@/app/profil/_sections/TabPaiements";

interface Transaction {
  id: string;
  type: string;
  amount_xcon: number;
  description?: string;
  created_at: string;
}

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

function QuickAmounts({ onSelect, selected }: { onSelect: (v: number) => void; selected: number }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {QUICK_AMOUNTS.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onSelect(v)}
          className={`rounded-xl border px-3 py-1.5 font-mono text-sm font-medium transition-colors ${
            selected === v
              ? "border-gold bg-gold/10 text-gold"
              : "border-ink-line bg-ink-raised text-sage hover:border-gold/50 hover:text-cream"
          }`}
        >
          {v.toLocaleString("fr-FR")}
        </button>
      ))}
    </div>
  );
}

export default function WalletPage() {
  const t = useT();
  const { user, wallet, refresh, loading } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [mode, setMode] = useState<"none" | "deposit" | "withdraw">("none");

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      api.get("/wallet/history").then(({ data }) => setTransactions(data || [])).catch(() => {});
    }
  }, [user]);

  if (loading || !user) return null;

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:pb-12">
        <h1 className="flex items-center gap-2 font-display text-2xl font-medium text-cream">
          <WalletIcon className="h-6 w-6 text-gold" /> Wallet
        </h1>

        <Card className="mt-4">
          <CardContent className="flex flex-col gap-4 p-5">
            <div>
              <p className="text-sm text-sage">{t("wallet.availableBalance")}</p>
              <p className="font-mono text-3xl tabular text-gold-bright">
                {formatFCFA(wallet?.balance_xcon ?? 0)}
              </p>
            </div>
            {(['influencer','admin','super_admin','root_admin'] as string[]).includes(user.role) && (
              <div>
                <p className="text-sm text-sage">{t("wallet.pendingEarnings")}</p>
                <p className="font-mono text-xl tabular text-emerald-bright">
                  {formatFCFA(wallet?.pending_balance_xcon ?? 0)}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => setMode("deposit")} className="flex-1">
                <ArrowDownToLine className="h-4 w-4" /> Déposer
              </Button>
              <Button onClick={() => setMode("withdraw")} variant="secondary" className="flex-1">
                <ArrowUpFromLine className="h-4 w-4" /> Retirer
              </Button>
            </div>
          </CardContent>
        </Card>

        {mode === "deposit" && (
          <DepositForm onDone={() => { setMode("none"); refresh(); }} />
        )}
        {mode === "withdraw" && (
          <WithdrawForm onDone={() => { setMode("none"); refresh(); }} />
        )}

        <h2 className="mt-6 flex items-center gap-2 font-display text-lg font-medium text-cream">
          <Smartphone className="h-5 w-5 text-gold" /> Mobile Money
        </h2>
        <div className="mt-2">
          <TabPaiements />
        </div>

        <h2 className="mt-6 flex items-center gap-2 font-display text-lg font-medium text-cream">
          <History className="h-5 w-5 text-gold" /> {t("wallet.history")}
        </h2>
        <div className="mt-2 flex flex-col gap-1.5">
          {transactions.length === 0 && (
            <div className="rounded-xl border border-ink-line bg-white dark:bg-ink-surface px-4 py-8 text-center">
              <p className="text-sm text-gray-400 dark:text-sage-muted">Pas d&apos;historique</p>
            </div>
          )}
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between rounded-xl border border-ink-line bg-white dark:bg-ink-surface px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-cream">{t(`wallet.tx.${tx.type}`, {}) || tx.type}</p>
                <p className="text-xs text-gray-400 dark:text-sage-muted">{formatRelativeDate(tx.created_at)}</p>
              </div>
              <p className={`font-mono text-sm tabular font-semibold ${tx.amount_xcon >= 0 ? "text-emerald-600 dark:text-emerald-bright" : "text-gray-700 dark:text-cream"}`}>
                {tx.amount_xcon >= 0 ? "+" : ""}{formatFCFA(tx.amount_xcon)}
              </p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}

function DepositForm({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data: mmList } = await api.get("/wallet/mobile-money");
      const defaultMm = mmList?.find((m: any) => m.is_default) || mmList?.[0];
      if (!defaultMm) {
        setError("Ajoutez un numéro Mobile Money dans votre profil avant de déposer.");
        return;
      }
      const { data } = await api.post("/wallet/deposit", {
        montant_xcon: Number(amount),
        mobile_money_id: defaultMm.id,
      });
      setPaymentUrl(data.paymentUrl);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur lors du dépôt.");
    } finally {
      setLoading(false);
    }
  };

  if (paymentUrl) {
    return (
      <Card className="mt-3">
        <CardContent className="p-4">
          <p className="text-sm text-cream">Finalisez votre dépôt sur la page de paiement :</p>
          <a href={paymentUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block">
            <Button className="w-full">Ouvrir la page de paiement</Button>
          </a>
          <button onClick={onDone} className="mt-2 w-full text-center text-sm text-sage hover:text-cream">
            Fermer
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-3">
      <CardHeader><CardTitle>{t("wallet.deposit")}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <QuickAmounts selected={Number(amount) || 0} onSelect={(v) => setAmount(String(v))} />
          <AmountInput label={t("wallet.depositLabel")} value={Number(amount) || 0} onChange={(v) => setAmount(String(v))} min={500} step={100} />
          {error && <p className="text-sm text-brick">{error}</p>}
          <Button type="submit" disabled={loading}>{loading ? "..." : t("wallet.depositContinue")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function WithdrawForm({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data: mmList } = await api.get("/wallet/mobile-money");
      const defaultMm = mmList?.find((m: any) => m.is_default) || mmList?.[0];
      if (!defaultMm) {
        setError("Ajoutez un numéro Mobile Money vérifié dans votre profil.");
        return;
      }
      const { data } = await api.post("/wallet/withdraw", {
        montant_xcon: Number(amount),
        mobile_money_id: defaultMm.id,
      });
      setSuccess(data.message || "Retrait effectué.");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Erreur lors du retrait.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mt-3">
      <CardHeader><CardTitle>{t("wallet.withdraw")}</CardTitle></CardHeader>
      <CardContent>
        {success ? (
          <div>
            <p className="text-sm text-emerald-bright">{success}</p>
            <button onClick={onDone} className="mt-2 text-sm text-sage hover:text-cream">{t("common.close")}</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <QuickAmounts selected={Number(amount) || 0} onSelect={(v) => setAmount(String(v))} />
            <AmountInput label={t("wallet.withdrawLabel")} value={Number(amount) || 0} onChange={(v) => setAmount(String(v))} min={500} step={100} />
            {error && <p className="text-sm text-brick">{error}</p>}
            <Button type="submit" disabled={loading}>{loading ? "..." : t("wallet.withdraw")}</Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
