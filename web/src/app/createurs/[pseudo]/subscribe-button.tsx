"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, HeartOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

export function SubscribeButton({
  creatorId,
  priceXcon,
  isSubscribed,
  isOwnProfile,
  acceptingSubs,
}: {
  creatorId: string;
  priceXcon: number;
  isSubscribed: boolean;
  isOwnProfile: boolean;
  acceptingSubs: boolean;
}) {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [subscribed, setSubscribed] = useState(isSubscribed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isOwnProfile) return null;

  const handleSubscribe = async () => {
    if (!user) {
      router.push("/connexion");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.post(`/subscriptions/${creatorId}`);
      setSubscribed(true);
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Abonnement impossible.");
    } finally {
      setLoading(false);
    }
  };

  if (subscribed) {
    return (
      <Button variant="secondary" size="sm" disabled>
        <Heart className="h-4 w-4 fill-coral text-coral" />
        Abonné
      </Button>
    );
  }

  if (!acceptingSubs) {
    return (
      <Button variant="secondary" size="sm" disabled>
        <HeartOff className="h-4 w-4" />
        N&apos;accepte plus d&apos;abonnés
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleSubscribe} disabled={loading} size="sm">
        {loading ? "..." : `S'abonner — ${formatFCFA(priceXcon)}/30j`}
      </Button>
      {error && <p className="text-xs text-brick">{error}</p>}
    </div>
  );
}
