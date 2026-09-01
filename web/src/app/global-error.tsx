"use client";

// Filet de secours si le RootLayout lui-même plante — doit fournir son
// propre <html>/<body> puisqu'il remplace layout.tsx dans ce cas précis.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body style={{ background: "#E3F2FD", color: "#0B2545" }}>
        <div
          style={{
            display: "flex", minHeight: "100vh", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "1rem",
            padding: "1.5rem", textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
            KasoLife est temporairement indisponible
          </h1>
          <p style={{ maxWidth: "24rem", fontSize: "0.875rem", opacity: 0.8 }}>
            Rechargez la page. Si le problème persiste, contactez le support.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "0.5rem", borderRadius: "9999px", background: "#8B1538",
              padding: "0.5rem 1.5rem", fontSize: "0.875rem", fontWeight: 600,
              color: "#FFFFFF", border: "none", cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
