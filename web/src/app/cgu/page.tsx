import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { PolicyPageLayout, PolicySection } from "@/components/policy/PolicyPageLayout";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — KasoLife",
  description: "CGU de la plateforme KasoLife — Douala, Cameroun.",
};

const LINKS = [
  { href: "/confidentialite", label: "Politique de confidentialité" },
  { href: "/cgf", label: "Conditions Financières (CGF)" },
  { href: "/aide", label: "Centre d'aide" },
];

export default function CguPage() {
  return (
    <PolicyPageLayout
      title="Conditions Générales d'Utilisation"
      icon={FileText}
      version="Version 1.0 — Juin 2026"
      links={LINKS}
    >
      <PolicySection n={1} title="Présentation de KasoLife">
        <p>KasoLife est une plateforme de contenu pour créateurs, exploitée par KasoLife SARL, société de droit camerounais domiciliée à Douala, Cameroun. Contact : <a href="mailto:legal@kasolife.com" className="text-gold hover:underline">legal@kasolife.com</a></p>
      </PolicySection>

      <PolicySection n={2} title="Acceptation des CGU">
        <p>L&apos;utilisation de KasoLife implique l&apos;acceptation pleine et entière des présentes CGU. En créant un compte, l&apos;utilisateur reconnaît avoir lu, compris et accepté ces conditions. Les CGU peuvent être modifiées à tout moment ; les utilisateurs en seront informés par notification et/ou email.</p>
      </PolicySection>

      <PolicySection n={3} title="Éligibilité — 18 ans minimum">
        <p>L&apos;accès à KasoLife est strictement réservé aux personnes âgées de 18 ans minimum. Toute inscription implique la déclaration sur l&apos;honneur d&apos;être majeur. KasoLife SARL se réserve le droit de clôturer tout compte dont le titulaire s&apos;avère mineur.</p>
      </PolicySection>

      <PolicySection n={4} title="Création de compte">
        <p>L&apos;inscription est gratuite et requiert un pseudo unique, un numéro de téléphone Mobile Money valide et un mot de passe sécurisé. L&apos;utilisateur est seul responsable de la confidentialité de ses identifiants. Un seul compte par personne est autorisé.</p>
      </PolicySection>

      <PolicySection n={5} title="Rôles sur la plateforme">
        <p><strong className="text-cream">Utilisateur :</strong> peut consulter le contenu gratuit, s&apos;abonner aux créateurs, envoyer des pourboires et acheter du contenu PPV.</p>
        <p><strong className="text-cream">Créateur :</strong> peut publier du contenu (images, vidéos, audios, textes), fixer son prix d&apos;abonnement et retirer ses gains après vérification KYC.</p>
      </PolicySection>

      <PolicySection n={6} title="Monnaie & Wallet">
        <p>L&apos;unité de compte utilisée sur la plateforme est le <strong className="text-cream">xcon</strong>, avec une parité fixe : <strong className="text-cream">1 xcon = 1 FCFA = 1 XAF</strong>. Le xcon ne constitue pas une monnaie électronique indépendante mais une simple unité d&apos;affichage du solde disponible sur le wallet KasoLife.</p>
        <p>Les dépôts et retraits sont effectués en FCFA via Mobile Money (MTN, Orange). KasoLife SARL garantit la disponibilité des fonds à tout moment dans la limite des réserves disponibles.</p>
      </PolicySection>

      <PolicySection n={7} title="Commissions & Tarifs">
        <p><strong className="text-cream">Créateurs :</strong> KasoLife prélève une commission sur chaque transaction (abonnement, pourboire, PPV). Le taux est indiqué dans les paramètres du tableau de bord créateur.</p>
        <p><strong className="text-cream">Retraits :</strong> Frais de 1,5 % sur chaque retrait, minimum 5 000 FCFA. Délai de traitement : 24 à 48 heures ouvrées. Voir les <Link href="/cgf" className="text-gold hover:underline">Conditions Financières</Link> pour le détail.</p>
      </PolicySection>

      <PolicySection n={8} title="Contenu interdit">
        <p>Sont strictement interdits : tout contenu impliquant des mineurs, les contenus haineux ou discriminatoires, la violence explicite non consentie, la fraude, l&apos;usurpation d&apos;identité, le spam et toute activité illégale au regard de la législation camerounaise.</p>
      </PolicySection>

      <PolicySection n={9} title="Vérification KYC">
        <p>La vérification d&apos;identité est obligatoire pour les créateurs souhaitant effectuer des retraits. KasoLife SARL se réserve le droit de suspendre les retraits tant que le KYC n&apos;est pas validé.</p>
      </PolicySection>

      <PolicySection n={10} title="Signalements & Modération">
        <p>Tout utilisateur peut signaler un contenu inapproprié. KasoLife SARL traitera les signalements dans les 48 heures ouvrées et se réserve le droit de supprimer tout contenu en violation des présentes CGU, sans préavis.</p>
      </PolicySection>

      <PolicySection n={11} title="Suspension & Résiliation">
        <p>KasoLife SARL peut suspendre ou résilier tout compte sans préavis en cas de violation grave des CGU. L&apos;utilisateur peut supprimer son compte à tout moment depuis les paramètres. Les soldes disponibles seront restitués après vérification d&apos;identité.</p>
      </PolicySection>

      <PolicySection n={12} title="Propriété intellectuelle">
        <p>Les créateurs conservent la propriété de leurs contenus mais accordent à KasoLife SARL une licence non-exclusive d&apos;hébergement et de diffusion sur la plateforme. KasoLife ne peut utiliser les contenus à des fins publicitaires sans accord explicite du créateur.</p>
      </PolicySection>

      <PolicySection n={13} title="Limitation de responsabilité">
        <p>KasoLife SARL ne peut être tenu responsable des pertes de revenus liées à une suspension de compte pour violation des CGU, ni des perturbations techniques indépendantes de sa volonté. La responsabilité de KasoLife est limitée au montant des fonds détenus sur le wallet.</p>
      </PolicySection>

      <PolicySection n={14} title="Protection des données">
        <p>Les données personnelles sont collectées et traitées conformément à notre <Link href="/confidentialite" className="text-gold hover:underline">Politique de Confidentialité</Link>. Elles ne sont jamais vendues à des tiers.</p>
      </PolicySection>

      <PolicySection n={15} title="Droit applicable & Litiges">
        <p>Les présentes CGU sont soumises au droit camerounais. En cas de litige, les parties s&apos;efforceront de trouver une solution amiable avant tout recours judiciaire. À défaut, les tribunaux de Douala seront seuls compétents.</p>
      </PolicySection>
    </PolicyPageLayout>
  );
}
