import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PolicyPageLayout, PolicySection } from "@/components/policy/PolicyPageLayout";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politique de Confidentialité — KasoLife",
  description: "Comment KasoLife collecte et protège tes données personnelles.",
};

const LINKS = [
  { href: "/cgu", label: "CGU" },
  { href: "/cgf", label: "Conditions Financières (CGF)" },
  { href: "/aide", label: "Centre d'aide" },
];

export default function ConfidentialitePage() {
  return (
    <PolicyPageLayout
      title="Politique de Confidentialité"
      icon={ShieldCheck}
      version="Version 1.0 — Juin 2026"
      links={LINKS}
    >
      <PolicySection n={1} title="Introduction">
        <p>KasoLife SARL s&apos;engage à protéger la vie privée de ses utilisateurs. La présente politique décrit quelles données sont collectées, comment elles sont utilisées et comment les utilisateurs peuvent exercer leurs droits.</p>
      </PolicySection>

      <PolicySection n={2} title="Données collectées">
        <p><strong className="text-cream">Lors de l&apos;inscription :</strong> pseudo, numéro de téléphone Mobile Money, date de naissance, pays.</p>
        <p><strong className="text-cream">Lors de l&apos;utilisation :</strong> contenu publié, transactions effectuées, abonnements, messages de support, adresse IP, appareil utilisé.</p>
        <p><strong className="text-cream">KYC :</strong> pièce d&apos;identité (stockée chiffrée, accès restreint).</p>
      </PolicySection>

      <PolicySection n={3} title="Finalité du traitement">
        <p>Tes données sont utilisées pour :</p>
        <ul className="ml-4 flex flex-col gap-1 list-disc">
          <li>Fournir et améliorer les services KasoLife</li>
          <li>Traiter les paiements et retraits</li>
          <li>Prévenir la fraude et assurer la sécurité</li>
          <li>Respecter nos obligations légales</li>
          <li>T&apos;envoyer des notifications de service (non publicitaires)</li>
        </ul>
      </PolicySection>

      <PolicySection n={4} title="Base légale">
        <p>Le traitement de tes données est fondé sur l&apos;exécution du contrat (CGU), nos obligations légales, et ton consentement pour les communications optionnelles.</p>
      </PolicySection>

      <PolicySection n={5} title="Partage des données">
        <p>KasoLife ne vend jamais tes données personnelles. Elles peuvent être partagées avec :</p>
        <ul className="ml-4 flex flex-col gap-1 list-disc">
          <li>Opérateurs Mobile Money (pour le traitement des paiements)</li>
          <li>Hébergeurs de confiance (infrastructure chiffrée)</li>
          <li>Autorités légales sur réquisition judiciaire</li>
        </ul>
      </PolicySection>

      <PolicySection n={6} title="Sécurité">
        <p>Toutes les données en transit sont chiffrées (TLS 1.3). Les données sensibles (documents KYC, dates de naissance) sont chiffrées au repos. L&apos;accès est restreint au personnel autorisé uniquement.</p>
      </PolicySection>

      <PolicySection n={7} title="Conservation des données">
        <p>Tes données sont conservées tant que ton compte est actif. En cas de suppression de compte, tes données personnelles sont anonymisées sous 30 jours. Les données financières sont conservées 10 ans conformément à la législation camerounaise.</p>
      </PolicySection>

      <PolicySection n={8} title="Cookies & Traceurs">
        <p>KasoLife utilise uniquement des cookies fonctionnels nécessaires au fonctionnement de l&apos;application (authentification, préférences de langue). Aucun cookie publicitaire ou de traçage tiers n&apos;est utilisé.</p>
      </PolicySection>

      <PolicySection n={9} title="Droits des utilisateurs">
        <p>Tu as le droit d&apos;accéder à tes données, de les rectifier, de demander leur suppression, ou de t&apos;opposer à leur traitement. Pour exercer ces droits, contacte-nous à <a href="mailto:privacy@kasolife.com" className="text-gold hover:underline">privacy@kasolife.com</a>.</p>
      </PolicySection>

      <PolicySection n={10} title="Données des mineurs">
        <p>KasoLife est strictement réservé aux personnes de 18 ans et plus. Si nous découvrons qu&apos;un mineur a créé un compte, celui-ci sera immédiatement clôturé et les données supprimées.</p>
      </PolicySection>

      <PolicySection n={11} title="Transferts internationaux">
        <p>Tes données sont principalement hébergées en Afrique ou en Europe. Tout transfert hors de la zone CEMAC respecte les garanties appropriées (clauses contractuelles types).</p>
      </PolicySection>

      <PolicySection n={12} title="Modifications de la politique">
        <p>KasoLife SARL peut modifier la présente politique à tout moment. Les utilisateurs seront informés par notification push et/ou email. La poursuite de l&apos;utilisation après notification vaut acceptation.</p>
      </PolicySection>

      <PolicySection n={13} title="Contact & DPO">
        <p>Pour toute question relative à tes données personnelles : <a href="mailto:privacy@kasolife.com" className="text-gold hover:underline">privacy@kasolife.com</a></p>
        <p>KasoLife SARL — BP XXXX — Douala, Cameroun</p>
      </PolicySection>
    </PolicyPageLayout>
  );
}
