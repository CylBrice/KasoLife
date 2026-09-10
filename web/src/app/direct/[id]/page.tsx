import LiveViewerClient from "./live-viewer-client";

// Requis par `output: 'export'` — génère une page "coquille" générique.
// Le vrai id est lu côté client via useDynamicSegment (window.location).
export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function LiveViewerPage() {
  return <LiveViewerClient />;
}
