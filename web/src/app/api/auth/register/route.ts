import { NextRequest, NextResponse } from 'next/server';
import { BACKEND, RT_COOKIE, RT_COOKIE_OPTS } from '@/lib/auth-bff';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const upstream = await fetch(`${BACKEND}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': req.headers.get('user-agent') ?? '',
        'X-Forwarded-For': req.headers.get('x-forwarded-for') ?? '',
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();

    if (!upstream.ok) return NextResponse.json(data, { status: upstream.status });

    const response = NextResponse.json({
      user: data.user,
      accessToken: data.accessToken || data.token,
      message: data.message,
    });

    if (data.refreshToken) {
      response.cookies.set(RT_COOKIE, data.refreshToken, RT_COOKIE_OPTS);
    }

    return response;
  } catch (err) {
    console.error('[BFF /auth/register]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
