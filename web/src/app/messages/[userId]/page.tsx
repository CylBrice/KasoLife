import ConversationClient from "./conversation-client";

// Requis par `output: 'export'` — génère une page "coquille" générique.
// Le vrai userId est lu côté client via useDynamicSegment (window.location).
export async function generateStaticParams() {
  return [{ userId: "placeholder" }];
}

export default function ConversationPage() {
  return <ConversationClient />;
}
