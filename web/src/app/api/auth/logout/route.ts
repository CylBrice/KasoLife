import { NextRequest, NextResponse } from 'next/server';
import { BACKEND, RT_COOKIE } from '@/lib/auth-bff';

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(RT_COOKIE)?.value;
  const authHeader   = req.headers.get('authorization');

  if (refreshToken) {
    // Révocation best-effort — non bloquant
    fetch(`${BACKEND}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(RT_COOKIE);
  return response;
}
