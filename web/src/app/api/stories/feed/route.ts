// Proxy vers le backend Node.js — évite CORS sur les stories
import { NextResponse, type NextRequest } from 'next/server';
import { BACKEND, RT_COOKIE } from '@/lib/auth-bff';

export async function GET(req: NextRequest) {
  // L'access token est envoyé par le client dans le header Authorization
  let token = req.headers.get('authorization')?.replace('Bearer ', '');

  // Fallback : si pas d'access token, tente un refresh silencieux depuis le cookie HttpOnly
  if (!token) {
    const refreshToken = req.cookies.get(RT_COOKIE)?.value;
    if (refreshToken) {
      try {
        const r = await fetch(`${BACKEND}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (r.ok) {
          const d = await r.json();
          token = d.accessToken;
        }
      } catch { /* best-effort */ }
    }
  }

  try {
    const res = await fetch(`${BACKEND}/stories/feed`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      next: { revalidate: 60 },
    });
    if (!res.ok) return NextResponse.json([], { status: 200 });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
