// URL du backend — accessible côté serveur uniquement (pas NEXT_PUBLIC_)
import type { NextRequest } from 'next/server';

export const BACKEND = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export const RT_COOKIE = 'kaso_rt';

const RT_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 jours

// Le flag Secure doit refléter le protocole RÉEL de la requête. Un cookie
// marqué Secure posé sur HTTP est silencieusement rejeté par le navigateur,
// ce qui rend toute session impossible à restaurer (refresh 401 en boucle)
// quand l'app est servie en clair (IP:port, reverse-proxy non TLS).
export function isSecureRequest(req: NextRequest): boolean {
  const forwardedProto = req.headers.get('x-forwarded-proto');
  if (forwardedProto) return forwardedProto.split(',')[0].trim() === 'https';
  return req.nextUrl.protocol === 'https:';
}

export function rtCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: RT_COOKIE_MAX_AGE,
  };
}
