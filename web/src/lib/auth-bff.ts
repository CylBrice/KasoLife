// URL du backend — accessible côté serveur uniquement (pas NEXT_PUBLIC_)
export const BACKEND = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export const RT_COOKIE = 'kaso_rt';

export const RT_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60, // 30 jours
};
