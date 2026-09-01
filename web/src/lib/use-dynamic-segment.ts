"use client";

import { useEffect, useState } from "react";

/**
 * Lit un segment dynamique de l'URL directement depuis window.location.
 *
 * Pourquoi : avec `output: 'export'` (requis pour Capacitor), les routes
 * dynamiques (`[pseudo]`, `[userId]`) sont exportées comme une page "coquille"
 * générique — `useParams()` ne reflète pas la vraie valeur de l'URL dans ce
 * contexte. On lit donc directement le chemin du navigateur.
 *
 * @param segmentIndex position du segment dans le chemin (0-indexé)
 *   ex: pour /createurs/jean-dupont → segmentIndex = 1 → "jean-dupont"
 */
export function useDynamicSegment(segmentIndex: number): string | null {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    const segments = window.location.pathname.split("/").filter(Boolean);
    const raw = segments[segmentIndex];
    setValue(raw ? decodeURIComponent(raw) : null);
  }, [segmentIndex]);

  return value;
}
