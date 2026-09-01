"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

/** Bloque l'accès aux enfants tant que l'utilisateur n'est pas authentifié —
 * redirige vers /connexion sinon. Évite le flash de contenu protégé pendant
 * le chargement en ne rendant rien tant que loading/redirection est en cours. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/connexion");
  }, [loading, user, router]);

  if (loading || !user) return null;
  return <>{children}</>;
}
