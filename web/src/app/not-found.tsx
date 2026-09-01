import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink px-6 text-center">
      <Compass className="h-10 w-10 text-gold" />
      <h1 className="font-display text-xl font-semibold text-cream">
        Page introuvable
      </h1>
      <p className="max-w-sm text-sm text-sage">
        Cette page n'existe pas ou a été déplacée.
      </p>
      <Button asChild className="mt-2 rounded-full">
        <Link href="/">Retour à l'accueil</Link>
      </Button>
    </div>
  );
}
