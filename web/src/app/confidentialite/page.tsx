import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de Confidentialité — KasoLife",
  description: "Comment KasoLife collecte et protège tes données personnelles.",
};

/* ── Icône SVG shield ── */
const IconShield = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
      fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-ink-line/30 pt-6">
      <h2 className="mb-3 font-display text-base font-medium text-cream">
        {n}. {title}
      </h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-sage">
        {children}
      </div>
    </section>
  );
}

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 pb-16">
      {/* Header */}
      <div className="mb-8 flex items-start gap-4 border-b border-gold/30 pb-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <IconShield />
        </div>
        <div>
          <h1 className="font-display text-2xl font-medium text-cream">Politique de Confidentialité</h1>
          <p className="mt-1 text-xs text-sage-muted">Version 1.0 — Juin 2026 · KasoLife SARL — Douala, Cameroun</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <Section n={1} title="Introduction">
          <p>KasoLife SARL s&apos;engage à protéger la vie privée de ses utilisateurs. La présente politique décrit quelles données sont collectées, comment elles sont utilisées et comment les utilisateurs peuvent exercer leurs droits.</p>
        </Section>

        <Section n={2} title="Données collectées">
          <p><strong className="text-cream">Lors de l&apos;inscription :</strong> pseudo, numéro de téléphone Mobile Money, date de naissance, pays.</p>
          <p><strong className="text-cream">Lors de l&apos;utilisation :</strong> contenu publié, transactions effectuées, abonnements, messages de support, adresse IP, appareil utilisé.</p>
          <p><strong className="text-cream">KYC :</strong> pièce d&apos;identité (stockée chiffrée, accès restreint).</p>
        </Section>

        <Section n={3} title="Finalité du traitement">
          <p>Tes données sont utilisées pour :</p>
          <ul className="ml-4 flex flex-col gap-1 list-disc">
            <li>Fournir et améliorer les services KasoLife</li>
            <li>Traiter les paiements et retraits</li>
            <li>Prévenir la fraude et assurer la sécurité</li>
            <li>Respecter nos obligations légales</li>
            <li>T&apos;envoyer des notifications de service (non publicitaires)</li>
          </ul>
        </Section>

        <Section n={4} title="Base légale">
          <p>Le traitement de tes données est fondé sur l&apos;exécution du contrat (CGU), nos obligations légales, et ton consentement pour les communications optionnelles.</p>
        </Section>

        <Section n={5} title="Partage des données">
          <p>KasoLife ne vend jamais tes données personnelles. Elles peuvent être partagées avec :</p>
          <ul className="ml-4 flex flex-col gap-1 list-disc">
            <li>Opérateurs Mobile Money (pour le traitement des paiements)</li>
            <li>Hébergeurs de confiance (infrastructure chiffrée)</li>
            <li>Autorités légales sur réquisition judiciaire</li>
          </ul>
        </Section>

        <Section n={6} title="Sécurité">
          <p>Toutes les données en transit sont chiffrées (TLS 1.3). Les données sensibles (documents KYC, dates de naissance) sont chiffrées au repos. L&apos;accès est restreint au personnel autorisé uniquement.</p>
        </Section>

        <Section n={7} title="Conservation des données">
          <p>Tes données sont conservées tant que ton compte est actif. En cas de suppression de compte, tes données personnelles sont anonymisées sous 30 jours. Les données financières sont conservées 10 ans conformément à la législation camerounaise.</p>
        </Section>

        <Section n={8} title="Cookies & Traceurs">
          <p>KasoLife utilise uniquement des cookies fonctionnels nécessaires au fonctionnement de l&apos;application (authentification, préférences de langue). Aucun cookie publicitaire ou de traçage tiers n&apos;est utilisé.</p>
        </Section>

        <Section n={9} title="Droits des utilisateurs">
          <p>Tu as le droit d&apos;accéder à tes données, de les rectifier, de demander leur suppression, ou de t&apos;opposer à leur traitement. Pour exercer ces droits, contacte-nous à <a href="mailto:privacy@kasolife.com" className="text-gold hover:underline">privacy@kasolife.com</a>.</p>
        </Section>

        <Section n={10} title="Données des mineurs">
          <p>KasoLife est strictement réservé aux personnes de 18 ans et plus. Si nous découvrons qu&apos;un mineur a créé un compte, celui-ci sera immédiatement clôturé et les données supprimées.</p>
        </Section>

        <Section n={11} title="Transferts internationaux">
          <p>Tes données sont principalement hébergées en Afrique ou en Europe. Tout transfert hors de la zone CEMAC respecte les garanties appropriées (clauses contractuelles types).</p>
        </Section>

        <Section n={12} title="Modifications de la politique">
          <p>KasoLife SARL peut modifier la présente politique à tout moment. Les utilisateurs seront informés par notification push et/ou email. La poursuite de l&apos;utilisation après notification vaut acceptation.</p>
        </Section>

        <Section n={13} title="Contact & DPO">
          <p>Pour toute question relative à tes données personnelles : <a href="mailto:privacy@kasolife.com" className="text-gold hover:underline">privacy@kasolife.com</a></p>
          <p>KasoLife SARL — BP XXXX — Douala, Cameroun</p>
        </Section>
      </div>

      <div className="mt-10 flex flex-wrap gap-3 border-t border-ink-line/30 pt-6">
        <Link href="/cgu" className="rounded-xl border border-ink-line/50 px-4 py-2 text-sm text-sage hover:text-cream transition-colors">
          CGU →
        </Link>
        <Link href="/aide" className="rounded-xl border border-ink-line/50 px-4 py-2 text-sm text-sage hover:text-cream transition-colors">
          Centre d&apos;aide →
        </Link>
      </div>
    </main>
  );
}
