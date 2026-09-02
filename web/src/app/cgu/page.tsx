import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — KasoLife",
  description: "CGU de la plateforme KasoLife — Douala, Cameroun.",
};

/* ── Icônes SVG inline ── */
const IconDoc = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
      fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <polyline points="10 9 9 9 8 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

export default function CguPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 pb-16">
      {/* Header */}
      <div className="mb-8 flex items-start gap-4 border-b border-gold/30 pb-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <IconDoc />
        </div>
        <div>
          <h1 className="font-display text-2xl font-medium text-cream">Conditions Générales d&apos;Utilisation</h1>
          <p className="mt-1 text-xs text-sage-muted">Version 1.0 — Juin 2026 · KasoLife SARL — Douala, Cameroun</p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <Section n={1} title="Présentation de KasoLife">
          <p>KasoLife est une plateforme de contenu pour créateurs, exploitée par KasoLife SARL, société de droit camerounais domiciliée à Douala, Cameroun. Contact : <a href="mailto:legal@kasolife.com" className="text-gold hover:underline">legal@kasolife.com</a></p>
        </Section>

        <Section n={2} title="Acceptation des CGU">
          <p>L&apos;utilisation de KasoLife implique l&apos;acceptation pleine et entière des présentes CGU. En créant un compte, l&apos;utilisateur reconnaît avoir lu, compris et accepté ces conditions. Les CGU peuvent être modifiées à tout moment ; les utilisateurs en seront informés par notification et/ou email.</p>
        </Section>

        <Section n={3} title="Éligibilité — 18 ans minimum">
          <p>L&apos;accès à KasoLife est strictement réservé aux personnes âgées de 18 ans minimum. Toute inscription implique la déclaration sur l&apos;honneur d&apos;être majeur. KasoLife SARL se réserve le droit de clôturer tout compte dont le titulaire s&apos;avère mineur.</p>
        </Section>

        <Section n={4} title="Création de compte">
          <p>L&apos;inscription est gratuite et requiert un pseudo unique, un numéro de téléphone Mobile Money valide et un mot de passe sécurisé. L&apos;utilisateur est seul responsable de la confidentialité de ses identifiants. Un seul compte par personne est autorisé.</p>
        </Section>

        <Section n={5} title="Rôles sur la plateforme">
          <p><strong className="text-cream">Utilisateur :</strong> peut consulter le contenu gratuit, s&apos;abonner aux créateurs, envoyer des pourboires et acheter du contenu PPV.</p>
          <p><strong className="text-cream">Créateur :</strong> peut publier du contenu (images, vidéos, audios, textes), fixer son prix d&apos;abonnement et retirer ses gains après vérification KYC.</p>
        </Section>

        <Section n={6} title="Monnaie & Wallet">
          <p>L&apos;unité de compte utilisée sur la plateforme est le <strong className="text-cream">xcon</strong>, avec une parité fixe : <strong className="text-cream">1 xcon = 1 FCFA = 1 XAF</strong>. Le xcon ne constitue pas une monnaie électronique indépendante mais une simple unité d&apos;affichage du solde disponible sur le wallet KasoLife.</p>
          <p>Les dépôts et retraits sont effectués en FCFA via Mobile Money (MTN, Orange). Le wallet KasoLife représente un solde disponible sur la plateforme. KasoLife SARL garantit la disponibilité des fonds à tout moment dans la limite des réserves disponibles.</p>
        </Section>

        <Section n={7} title="Commissions & Tarifs">
          <p><strong className="text-cream">Créateurs :</strong> KasoLife prélève une commission sur chaque transaction (abonnement, pourboire, PPV). Le taux est indiqué dans les paramètres du tableau de bord créateur.</p>
          <p><strong className="text-cream">Retraits :</strong> Frais de 1,5% sur chaque retrait, minimum 5 000 FCFA. Délai de traitement : 24 à 48 heures ouvrées.</p>
        </Section>

        <Section n={8} title="Contenu interdit">
          <p>Sont strictement interdits : tout contenu impliquant des mineurs, les contenus haineux ou discriminatoires, la violence explicite non consentie, la fraude, l&apos;usurpation d&apos;identité, le spam et toute activité illégale au regard de la législation camerounaise.</p>
        </Section>

        <Section n={9} title="Vérification KYC">
          <p>La vérification d&apos;identité est obligatoire pour les créateurs souhaitant effectuer des retraits. KasoLife SARL se réserve le droit de suspendre les retraits tant que le KYC n&apos;est pas validé.</p>
        </Section>

        <Section n={10} title="Signalements & Modération">
          <p>Tout utilisateur peut signaler un contenu inapproprié. KasoLife SARL traitera les signalements dans les 48 heures ouvrées et se réserve le droit de supprimer tout contenu en violation des présentes CGU, sans préavis.</p>
        </Section>

        <Section n={11} title="Suspension & Résiliation">
          <p>KasoLife SARL peut suspendre ou résilier tout compte sans préavis en cas de violation grave des CGU. L&apos;utilisateur peut supprimer son compte à tout moment depuis les paramètres. Les soldes disponibles seront restitués après vérification d&apos;identité.</p>
        </Section>

        <Section n={12} title="Propriété intellectuelle">
          <p>Les créateurs conservent la propriété de leurs contenus mais accordent à KasoLife SARL une licence non-exclusive d&apos;hébergement et de diffusion sur la plateforme. KasoLife ne peut utiliser les contenus à des fins publicitaires sans accord explicite du créateur.</p>
        </Section>

        <Section n={13} title="Limitation de responsabilité">
          <p>KasoLife SARL ne peut être tenu responsable des pertes de revenus liées à une suspension de compte pour violation des CGU, ni des perturbations techniques indépendantes de sa volonté. La responsabilité de KasoLife est limitée au montant des fonds détenus sur le wallet.</p>
        </Section>

        <Section n={14} title="Protection des données">
          <p>Les données personnelles sont collectées et traitées conformément à notre <Link href="/confidentialite" className="text-gold hover:underline">Politique de Confidentialité</Link>. Elles ne sont jamais vendues à des tiers.</p>
        </Section>

        <Section n={15} title="Droit applicable & Litiges">
          <p>Les présentes CGU sont soumises au droit camerounais. En cas de litige, les parties s&apos;efforceront de trouver une solution amiable avant tout recours judiciaire. À défaut, les tribunaux de Douala seront seuls compétents.</p>
        </Section>
      </div>

      <div className="mt-10 flex flex-wrap gap-3 border-t border-ink-line/30 pt-6">
        <Link href="/confidentialite" className="rounded-xl border border-ink-line/50 px-4 py-2 text-sm text-sage hover:text-cream transition-colors">
          Politique de confidentialité →
        </Link>
        <Link href="/aide" className="rounded-xl border border-ink-line/50 px-4 py-2 text-sm text-sage hover:text-cream transition-colors">
          Centre d&apos;aide →
        </Link>
      </div>
    </main>
  );
}
