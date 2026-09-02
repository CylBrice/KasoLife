// Proxy vers le backend Node.js — évite CORS et expose le token JWT
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('kasolife_token')?.value;

  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

  const res = await fetch(`${backendUrl}/stories/feed`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    next: { revalidate: 60 },
  });

  if (!res.ok) return NextResponse.json([], { status: 200 });

  const data = await res.json();
  return NextResponse.json(data);
}
