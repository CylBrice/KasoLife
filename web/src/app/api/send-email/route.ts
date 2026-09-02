// ============================================================
// KasoLife — Route Next.js : relais SMTP PlanetHoster
// Railway bloque le SMTP sortant → ce endpoint Next.js/Vercel
// sert de relais : backend appelle PH_EMAIL_RELAY_URL/api/send-email
// Env : EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER,
//       EMAIL_SMTP_PASS, PH_EMAIL_RELAY_SECRET
// ============================================================
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  const secret = req.headers.get('x-email-secret');
  if (!secret || secret !== process.env.PH_EMAIL_RELAY_SECRET) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { from, to, subject, html, text } = await req.json();
  if (!from || !to || !subject) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  }

  const transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_SMTP_HOST,
    port:   parseInt(process.env.EMAIL_SMTP_PORT || '587'),
    secure: process.env.EMAIL_SMTP_PORT === '465',
    auth: {
      user: process.env.EMAIL_SMTP_USER,
      pass: process.env.EMAIL_SMTP_PASS,
    },
  });

  await transporter.sendMail({ from, to, subject, html, text });

  return NextResponse.json({ ok: true });
}
