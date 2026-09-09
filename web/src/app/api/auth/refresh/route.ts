import { NextRequest, NextResponse } from 'next/server';
import { BACKEND, RT_COOKIE, RT_COOKIE_OPTS } from '@/lib/auth-bff';

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get(RT_COOKIE)?.value;
    if (!refreshToken) return NextResponse.json({ error: 'No session' }, { status: 401 });

    const upstream = await fetch(`${BACKEND}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': req.headers.get('user-agent') ?? '',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      const response = NextResponse.json(data, { status: upstream.status });
      response.cookies.delete(RT_COOKIE);
      return response;
    }

    // Rotation : nouveau refresh token dans le cookie HttpOnly
    const response = NextResponse.json({ accessToken: data.accessToken });
    response.cookies.set(RT_COOKIE, data.refreshToken, RT_COOKIE_OPTS);
    return response;
  } catch (err) {
    console.error('[BFF /auth/refresh]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
