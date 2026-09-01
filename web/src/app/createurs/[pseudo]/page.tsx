import CreatorProfileClient from "./creator-profile-client";

// Requis par `output: 'export'` — génère une page "coquille" générique.
// Le vrai pseudo est lu côté client via useDynamicSegment (window.location).
export async function generateStaticParams() {
  return [{ pseudo: "placeholder" }];
}

export default function CreatorProfilePage() {
  return <CreatorProfileClient />;
}
