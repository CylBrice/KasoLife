import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { PolicyPageLayout, PolicySection } from "@/components/policy/PolicyPageLayout";

export const metadata: Metadata = {
  title: "Conditions Générales Financières — KasoLife",
  description: "Conditions financières applicables aux transactions sur la plateforme KasoLife.",
};

const LINKS = [
  { href: "/cgu", label: "CGU" },
  { href: "/confidentialite", label: "Politique de confidentialité" },
  { href: "/aide", label: "Centre d'aide" },
];

export default function CgfPage() {
  return (
    <PolicyPageLayout
      title="Conditions Générales Financières"
      icon={CreditCard}
      version="Version 1.0 — À venir"
      links={LINKS}
    >
      <PolicySection n={1} title="Monnaie de la plateforme — xcon">
        <p>L&apos;unité de compte utilisée sur KasoLife est le <strong className="text-cream">xcon</strong>, avec une parité fixe et garantie : <strong className="text-cream">1 xcon = 1 FCFA = 1 XAF</strong>. Le xcon ne constitue pas une monnaie électronique indépendante.</p>
      </PolicySection>

      <PolicySection n={2} title="Dépôts">
        <p>Les dépôts sont effectués en FCFA via Mobile Money (MTN, Orange Money). Le montant minimum de dépôt est de <strong className="text-cream">500 FCFA</strong>. Les fonds sont crédités instantanément après confirmation de l&apos;opérateur.</p>
      </PolicySection>

      <PolicySection n={3} title="Retraits">
        <p>Les retraits sont effectués vers un numéro Mobile Money enregistré et vérifié. Montant minimum : <strong className="text-cream">5 000 FCFA</strong>. Frais : <strong className="text-cream">1,5 %</strong> du montant retiré. Délai de traitement : 24 à 48 heures ouvrées.</p>
        <p>La vérification KYC est obligatoire avant tout premier retrait.</p>
      </PolicySection>

      <PolicySection n={4} title="Commissions créateurs">
        <p>KasoLife prélève une commission sur chaque transaction (abonnement, pourboire, contenu PPV). Le taux exact est communiqué dans le tableau de bord créateur et peut évoluer selon notification préalable.</p>
      </PolicySection>

      <PolicySection n={5} title="Remboursements">
        <p>Aucun remboursement n&apos;est accordé sur les abonnements en cours ni sur les achats de contenu PPV déjà consultés. En cas de litige avéré, KasoLife SARL tranchera après examen du dossier.</p>
      </PolicySection>

      <PolicySection n={6} title="Sécurité des transactions">
        <p>Toutes les transactions sont chiffrées et tracées. KasoLife SARL utilise des systèmes de détection de fraude en temps réel. Tout comportement suspect peut entraîner la suspension immédiate des opérations financières.</p>
      </PolicySection>

      <PolicySection n={7} title="Limites de transactions">
        <p>Sans vérification KYC, le dépôt cumulé mensuel est limité à <strong className="text-cream">50 000 FCFA</strong> et le retrait à <strong className="text-cream">20 000 FCFA</strong>. Ces limites sont levées après validation du KYC complet.</p>
      </PolicySection>

      <PolicySection n={8} title="Contenu à compléter">
        <p className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-sage-muted italic">
          Cette section est en cours de rédaction. Le document complet sera publié prochainement. Pour toute question financière urgente, contactez <a href="mailto:legal@kasolife.com" className="text-gold hover:underline">legal@kasolife.com</a>.
        </p>
      </PolicySection>
    </PolicyPageLayout>
  );
}
