// ============================================================
// KASOLIFE — Service Email v2
// Deux providers commutables via platform_config.EMAIL_PROVIDER :
//   RESEND       → API Resend (HTTP)
//   PLANETHOSTER → SMTP PlanetHoster relayé par la route Next.js /api/send-email
//     (Railway bloque le SMTP sortant, le frontend Next.js non)
// Fallback croisé : si le provider choisi échoue, l'autre prend le relais.
// Deux expéditeurs : noreply@ (utilisateurs) et alertes@ (admin)
// Env : RESEND_API_KEY, PH_EMAIL_RELAY_URL, PH_EMAIL_RELAY_SECRET
// ============================================================
'use strict';

const supabase = require('../config/supabase');

const FROM_USERS  = 'KasoLife <noreply@kasolife.com>';
const FROM_ADMINS = 'KasoLife Alertes <alertes@kasolife.com>';

const isHtml = (content) => typeof content === 'string' &&
  (content.trimStart().startsWith('<!DOCTYPE') || content.trimStart().startsWith('<html'));

// ── Helper HTML commun — base pour tous les emails utilisateurs ──────────────
const buildEmailBase = ({ badgeText, badgeColor, badgeBg, subtitle, pseudo, bodyHtml, preheader = '' }) => `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>KasoLife</title>
  <style>
    :root { color-scheme: light only; }
    * { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    body { margin: 0 !important; padding: 0 !important; background-color: #F4F6FB !important; }
    table { border-collapse: collapse !important; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .header-cell { padding: 20px 16px !important; }
      .body-cell { padding: 24px 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F4F6FB;font-family:Arial,Helvetica,sans-serif;">
  ${preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:#F4F6FB;">${preheader}</div>` : ''}
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F4F6FB;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="email-container" cellpadding="0" cellspacing="0" width="580" style="max-width:580px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">

          <!-- HEADER -->
          <tr>
            <td style="background-color:#0D4F4F;" class="header-cell">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding:20px 24px;" valign="middle">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:900;line-height:1;letter-spacing:-0.5px;">
                      <span style="color:#4DD9AC;">KASO</span><span style="color:#FFFFFF;">LIFE</span>
                    </div>
                    <div style="color:#A8C8C8;font-size:10px;font-weight:600;letter-spacing:1px;margin-top:4px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">${subtitle}</div>
                  </td>
                  <td style="padding:20px 24px;" valign="middle" align="right">
                    <span style="display:inline-block;background-color:${badgeBg};color:${badgeColor};font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.5px;padding:4px 12px;border-radius:4px;">${badgeText}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:28px 32px 24px;" class="body-cell">
              ${pseudo
                ? `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;line-height:1.5;">Bonjour <strong style="color:#0F172A;">${pseudo}</strong>,</p>`
                : `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;line-height:1.5;">Bonjour,</p>`
              }
              ${bodyHtml}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:#F8FAFC;border-top:1px solid #E2E8F0;padding:16px 32px;text-align:center;">
              <a href="https://kasolife.com" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#0D4F4F;text-decoration:none;">kasolife.com</a>
              <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#9CA3AF;">© 2026 Kaso&#8203;Life — AFRIQUE</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ── Helper HTML pour emails admin ────────────────────────────────────────────
const buildAdminEmailBase = ({ badgeText, badgeColor, badgeBg, subtitle, rightHeader = '', bodyHtml, preheader = '' }) => `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <title>KasoLife Admin</title>
  <style>
    :root { color-scheme: light only; }
    * { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    body { margin: 0 !important; padding: 0 !important; background-color: #F4F6FB !important; }
    table { border-collapse: collapse !important; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .header-cell { padding: 20px 16px !important; }
      .body-cell { padding: 24px 16px !important; }
      .kpi-cell { display: block !important; width: 100% !important; margin-bottom: 8px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F4F6FB;font-family:Arial,Helvetica,sans-serif;">
  ${preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:#F4F6FB;">${preheader}</div>` : ''}
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F4F6FB;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="email-container" cellpadding="0" cellspacing="0" width="580" style="max-width:580px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">

          <!-- HEADER -->
          <tr>
            <td style="background-color:#0D4F4F;" class="header-cell">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding:20px 24px;" valign="middle">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:900;line-height:1;letter-spacing:-0.5px;">
                      <span style="color:#4DD9AC;">KASO</span><span style="color:#FFFFFF;">LIFE</span>
                    </div>
                    <div style="color:#A8C8C8;font-size:10px;font-weight:600;letter-spacing:1px;margin-top:4px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">${subtitle}</div>
                  </td>
                  <td style="padding:20px 24px;" valign="middle" align="right">
                    ${rightHeader
                      ? rightHeader
                      : `<span style="display:inline-block;background-color:${badgeBg};color:${badgeColor};font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.5px;padding:4px 12px;border-radius:4px;">${badgeText}</span>`
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:28px 32px 24px;" class="body-cell">
              ${bodyHtml}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:#F8FAFC;border-top:1px solid #E2E8F0;padding:16px 32px;text-align:center;">
              <a href="https://kasolife.com/admin" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#0D4F4F;text-decoration:none;">kasolife.com/admin</a>
              <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#9CA3AF;">© 2026 Kaso&#8203;Life — AFRIQUE</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ── Blocs réutilisables ──────────────────────────────────────────────────────
const BLOCKS = {
  otp: (code, label, expiry = 'Valable 10 minutes') => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;border:2px solid #0D4F4F;border-collapse:collapse;overflow:hidden;border-radius:10px;">
      <tr>
        <td style="background-color:#F0FFF8;padding:20px;text-align:center;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;color:#64748B;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">${label}</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:40px;font-weight:900;letter-spacing:12px;color:#0D4F4F;line-height:1;">${code.slice(0,3)}&nbsp;${code.slice(3)}</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9CA3AF;margin-top:10px;">${expiry}</div>
        </td>
      </tr>
    </table>`,

  security: (title, text) => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:12px 0;">
      <tr>
        <td style="background-color:#F1F5F9;border-radius:8px;padding:14px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="36" valign="top" style="padding-right:12px;">
                <div style="width:28px;height:28px;background-color:#0D4F4F;border-radius:50%;text-align:center;line-height:28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:900;color:#4DD9AC;">!</div>
              </td>
              <td valign="top">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#1E293B;margin-bottom:3px;">${title}</div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#64748B;line-height:1.6;">${text}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`,

  info: (title, text) => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:12px 0;">
      <tr>
        <td style="background-color:#F1F5F9;border-radius:8px;padding:14px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="36" valign="top" style="padding-right:12px;">
                <div style="width:28px;height:28px;background-color:#0D4F4F;border-radius:50%;text-align:center;line-height:28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:900;color:#4DD9AC;">i</div>
              </td>
              <td valign="top">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#1E293B;margin-bottom:3px;">${title}</div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#64748B;line-height:1.6;">${text}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`,

  warning: (title, text) => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:12px 0;">
      <tr>
        <td style="background-color:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:14px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="36" valign="top" style="padding-right:12px;">
                <div style="width:28px;height:28px;background-color:#F59E0B;border-radius:50%;text-align:center;line-height:28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:900;color:#FFFFFF;">!</div>
              </td>
              <td valign="top">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#B45309;margin-bottom:3px;">${title}</div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#92400E;line-height:1.6;">${text}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`,

  alert: (title, text) => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:12px 0;">
      <tr>
        <td style="background-color:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:14px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="36" valign="top" style="padding-right:12px;">
                <div style="width:28px;height:28px;background-color:#EF4444;border-radius:50%;text-align:center;line-height:28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:900;color:#FFFFFF;">!</div>
              </td>
              <td valign="top">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#B91C1C;margin-bottom:3px;">${title}</div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#EF4444;line-height:1.6;">${text}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`,

  infoBox: (rows) => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;">
      ${rows.map((r, i) => `
      <tr>
        <td style="padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6B7280;${i < rows.length - 1 ? 'border-bottom:1px solid #F1F5F9;' : ''}">${r.label}</td>
        <td style="padding:10px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:${r.color || '#1E293B'};text-align:right;${i < rows.length - 1 ? 'border-bottom:1px solid #F1F5F9;' : ''}">${r.value}</td>
      </tr>`).join('')}
    </table>`,

  cta: (label, url = 'https://kasolife.com') => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;">
      <tr>
        <td align="center">
          <a href="${url}" style="display:inline-block;background-color:#0D4F4F;color:#4DD9AC;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:900;text-decoration:none;padding:14px 32px;border-radius:8px;letter-spacing:0.3px;">${label}</a>
        </td>
      </tr>
    </table>`,

  msg: (text) => `<p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#4B5563;line-height:1.7;">${text}</p>`,
};

// ── Blocs réutilisables admin ─────────────────────────────────────────────────
const ADMIN_BLOCKS = {
  kpiGrid: (kpis) => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;">
      <tr>
        ${kpis.map(k => `
        <td width="${Math.floor(100/kpis.length)}%" valign="top" style="padding:${kpis.length > 2 ? '0 4px' : '0 6px'};">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="background-color:${k.bg};border:1px solid ${k.border};border-radius:8px;padding:12px 8px;text-align:center;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;color:${k.labelColor};letter-spacing:0.8px;text-transform:uppercase;margin-bottom:4px;">${k.label}</div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:900;color:${k.valColor};line-height:1;">${k.value}</div>
                ${k.sub ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;color:${k.subColor};margin-top:3px;">${k.sub}</div>` : ''}
              </td>
            </tr>
          </table>
        </td>`).join('')}
      </tr>
    </table>`,

  section: (title, contentHtml) => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;">
      <tr>
        <td style="padding:14px 16px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;color:#1E293B;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:10px;">${title}</div>
          ${contentHtml}
        </td>
      </tr>
    </table>`,

  rows: (rows) => rows.map((r, i) => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="${i < rows.length - 1 ? 'border-bottom:1px solid #F1F5F9;' : ''}">
      <tr>
        <td style="font-family:Arial,Helvetica,sans-serif;font-size:9px;color:#6B7280;padding:6px 0;">${r.label}</td>
        <td style="font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;color:${r.color || '#1E293B'};text-align:right;padding:6px 0;">${r.value}</td>
      </tr>
    </table>`).join(''),

  alertBlock: (title, text) => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:12px 0;">
      <tr>
        <td style="background-color:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:14px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="36" valign="top" style="padding-right:12px;">
                <div style="width:28px;height:28px;background-color:#EF4444;border-radius:50%;text-align:center;line-height:28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:900;color:#FFFFFF;">!</div>
              </td>
              <td valign="top">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:#B91C1C;margin-bottom:3px;">${title}</div>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#EF4444;line-height:1.6;">${text}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`,

  cta: (label, url = 'https://kasolife.com/admin') => `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;">
      <tr>
        <td align="center">
          <a href="${url}" style="display:inline-block;background-color:#0D4F4F;color:#4DD9AC;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:900;text-decoration:none;padding:14px 32px;border-radius:8px;letter-spacing:0.3px;">${label}</a>
        </td>
      </tr>
    </table>`,

  msg: (text) => `<p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#4B5563;line-height:1.7;">${text}</p>`,
};

// ── Conversion HTML → texte fallback ─────────────────────────────────────────
const HTML_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', 39: "'", apos: "'",
  nbsp: ' ', rarr: '→', copy: '©', hellip: '…', mdash: '—', ndash: '–',
};

const decodeEntities = (str) => str
  .replace(/&#(\d+);/g, (_, code) => {
    if (Number(code) === 8203) return '';
    return String.fromCodePoint(Number(code));
  })
  .replace(/&(amp|lt|gt|quot|apos|nbsp|rarr|copy|hellip|mdash|ndash);/g, (_, n) => HTML_ENTITIES[n] ?? '');

const stripHtml = (html) => {
  const withBreaks = html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr)>/gi, '\n')
    .replace(/<\/td>/gi, '  ')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(withBreaks)
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
};

const textFallback = (subject, html) => {
  const body = html ? stripHtml(html) : '';
  return body
    ? `${subject}\n\n${body}\n\nkasolife.com`
    : `${subject}\n\nVeuillez consulter cet email dans un client supportant le HTML.\n\nkasolife.com`;
};

// ── Envoi via Resend ──────────────────────────────────────────────────────────
const sendViaResend = async (from, to, subject, text) => {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY absent');
  const payload = { from, to: [to], subject };
  if (isHtml(text)) {
    payload.html = text;
    payload.text = textFallback(subject, text);
  } else {
    payload.text = text;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Resend HTTP ${res.status}`);
  return json;
};

// ── Envoi via PlanetHoster (relais SMTP hébergé sur Next.js/Vercel) ──────────
const sendViaPlanetHoster = async (from, to, subject, text) => {
  if (!process.env.PH_EMAIL_RELAY_URL || !process.env.PH_EMAIL_RELAY_SECRET)
    throw new Error('PH_EMAIL_RELAY_URL / PH_EMAIL_RELAY_SECRET absents');
  const payload = { from, to, subject };
  if (isHtml(text)) {
    payload.html = text;
    payload.text = textFallback(subject, text);
  } else {
    payload.text = text;
  }
  const res = await fetch(`${process.env.PH_EMAIL_RELAY_URL}/api/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Email-Secret': process.env.PH_EMAIL_RELAY_SECRET,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Relais email HTTP ${res.status}`);
  return json;
};

// ── Dispatch : lit EMAIL_PROVIDER, tente provider choisi → fallback ───────────
const dispatchEmail = async (from, to, subject, text, label) => {
  let provider = 'RESEND';
  try {
    const { data } = await supabase
      .from('platform_config').select('value').eq('key', 'EMAIL_PROVIDER').single();
    provider = (data?.value || 'RESEND').toUpperCase();
  } catch { /* défaut RESEND */ }

  const order = provider === 'PLANETHOSTER'
    ? [['PlanetHoster', sendViaPlanetHoster], ['Resend', sendViaResend]]
    : [['Resend', sendViaResend], ['PlanetHoster', sendViaPlanetHoster]];

  let lastErr;
  for (const [name, fn] of order) {
    try {
      return await fn(from, to, subject, text);
    } catch (err) {
      lastErr = err;
      console.error(`[Email] ${label} — échec ${name}: ${err.message}`);
    }
  }
  throw lastErr;
};

// ── sendEmail : terminal utilisateurs ────────────────────────────────────────
const sendEmail = async (to, subject, text) => {
  if (!to || !subject) return;
  try {
    await dispatchEmail(FROM_USERS, to, subject, text, 'USER');
  } catch (err) {
    console.error('[Email] Erreur envoi utilisateur à', to, ':', err.message);
  }
};

// ── sendAdminEmail : terminal admins ─────────────────────────────────────────
const sendAdminEmail = async (to, subject, text) => {
  if (!to || !subject) return;
  try {
    await dispatchEmail(FROM_ADMINS, to, subject, text, 'ADMIN');
  } catch (err) {
    console.error('[Email] Erreur envoi admin à', to, ':', err.message);
  }
};

// ── Vérification préférences notification email ───────────────────────────────
const shouldSendEmailByPreference = async (userId, emailType) => {
  if (emailType === 'otp' || emailType === 'security') return true;
  try {
    const { data: user } = await supabase.from('users')
      .select('email_notifs_results, email_notifs_bonus, email_notifs_marketing')
      .eq('id', userId).single();
    if (!user) return true;
    switch (emailType) {
      case 'results':   return user.email_notifs_results   !== false;
      case 'bonus':     return user.email_notifs_bonus     !== false;
      case 'marketing': return user.email_notifs_marketing !== false;
      default:          return true;
    }
  } catch { return true; }
};

// ── Templates emails HTML ─────────────────────────────────────────────────────
const templates = {
  // 1. OTP vérification inscription
  verificationOTP: (otp) => ({
    subject: '[KasoLife] Votre code de vérification',
    html: buildEmailBase({
      badgeText: 'INSCRIPTION', badgeColor: '#fff', badgeBg: '#1e40af',
      subtitle: 'Vérification compte',
      preheader: 'Votre code de vérification est prêt.',
      pseudo: null,
      bodyHtml: `
        ${BLOCKS.msg('Ce code confirme votre adresse email et votre numéro de téléphone.')}
        ${BLOCKS.otp(otp, 'CODE DE VÉRIFICATION')}
        ${BLOCKS.security('Ne partagez jamais ce code', 'Kaso&#8203;Life ne vous demandera jamais votre code par téléphone, SMS ou email.')}`,
    }),
  }),

  // 2. OTP connexion 2FA
  login2faOTP: (pseudo, otp) => ({
    subject: '[KasoLife] Code de connexion',
    html: buildEmailBase({
      badgeText: '2FA LOGIN', badgeColor: '#fff', badgeBg: '#1e40af',
      subtitle: 'Connexion sécurisée',
      preheader: 'Votre code de connexion est prêt.',
      pseudo,
      bodyHtml: `
        ${BLOCKS.msg('Utilisez ce code pour finaliser votre connexion à Kaso&#8203;Life.')}
        ${BLOCKS.otp(otp, 'CODE DE CONNEXION')}
        ${BLOCKS.security('Ne partagez jamais ce code', 'Kaso&#8203;Life ne vous demandera jamais votre code par téléphone, SMS ou email.')}`,
    }),
  }),

  // 3. OTP retrait
  withdrawOTP: (pseudo, otp) => ({
    subject: '[KasoLife] Code de retrait',
    html: buildEmailBase({
      badgeText: 'RETRAIT', badgeColor: '#fff', badgeBg: '#92400e',
      subtitle: 'Confirmation retrait',
      preheader: 'Confirmez votre retrait avec ce code.',
      pseudo,
      bodyHtml: `
        ${BLOCKS.msg('Utilisez ce code pour confirmer votre demande de retrait.')}
        ${BLOCKS.otp(otp, 'CODE DE RETRAIT')}
        ${BLOCKS.warning('Transaction financière', "Si vous n'avez pas initié ce retrait, contactez le support immédiatement et changez votre mot de passe.")}`,
    }),
  }),

  // 4. OTP changement email
  emailChangeOTP: (pseudo, otp, expiryMin) => ({
    subject: "[KasoLife] Code de confirmation — changement d'email",
    html: buildEmailBase({
      badgeText: 'EMAIL', badgeColor: '#fff', badgeBg: '#1e40af',
      subtitle: 'Changement email',
      preheader: "Code de confirmation pour votre changement d'email.",
      pseudo,
      bodyHtml: `
        ${BLOCKS.msg('Vous avez demandé à associer cette adresse email à votre compte Kaso&#8203;Life.')}
        ${BLOCKS.otp(otp, 'CODE DE CONFIRMATION', `Valable ${expiryMin} minutes`)}
        ${BLOCKS.security('Ne partagez jamais ce code', "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.")}`,
    }),
  }),

  // 5. Connexion suspecte / nouvel appareil
  newDevice: (pseudo, ip, country, revokeUrl) => ({
    subject: '[KasoLife] Connexion inhabituelle détectée',
    html: buildEmailBase({
      badgeText: 'ALERTE', badgeColor: '#fff', badgeBg: '#991b1b',
      subtitle: 'Alerte sécurité',
      preheader: 'Connexion inhabituelle détectée sur votre compte.',
      pseudo,
      bodyHtml: `
        ${BLOCKS.msg('Une connexion inhabituelle a été détectée sur votre compte.')}
        ${BLOCKS.infoBox([
          { label: 'IP', value: ip },
          { label: 'Pays', value: country || 'Inconnu' },
          { label: 'Date', value: new Date().toLocaleString('fr-FR') },
        ])}
        ${BLOCKS.alert('Action requise', "Si ce n'était pas vous, sécurisez votre compte immédiatement.")}
        ${BLOCKS.cta('Sécuriser mon compte', revokeUrl)}`,
    }),
  }),

  // 6. Mot de passe modifié
  passwordChanged: (pseudo) => ({
    subject: '[KasoLife] Mot de passe modifié',
    html: buildEmailBase({
      badgeText: 'MOT DE PASSE', badgeColor: '#fff', badgeBg: '#374151',
      subtitle: 'Sécurité compte',
      preheader: 'Votre mot de passe vient d\'être modifié.',
      pseudo,
      bodyHtml: `
        ${BLOCKS.msg("Le mot de passe de votre compte Kaso&#8203;Life vient d'être modifié.")}
        ${BLOCKS.infoBox([
          { label: 'Date', value: new Date().toLocaleString('fr-FR') },
          { label: 'Sessions actives', value: 'Toutes déconnectées', color: '#b45309' },
        ])}
        ${BLOCKS.warning('Pas vous ?', 'Contactez le support immédiatement sur kasolife.com/support')}`,
    }),
  }),

  // 7. Changement numéro Mobile Money
  phoneChanged: (pseudo, oldPhone, newPhone) => ({
    subject: '[KasoLife] Changement de numéro Mobile Money',
    html: buildEmailBase({
      badgeText: 'MOMO', badgeColor: '#fff', badgeBg: '#92400e',
      subtitle: 'Mobile Money',
      preheader: 'Votre numéro Mobile Money a été modifié.',
      pseudo,
      bodyHtml: `
        ${BLOCKS.msg("Votre numéro Mobile Money Kaso&#8203;Life vient d'être modifié.")}
        ${BLOCKS.infoBox([
          { label: 'Ancien numéro', value: oldPhone },
          { label: 'Nouveau numéro', value: newPhone, color: '#0D4F4F' },
          { label: 'Date', value: new Date().toLocaleString('fr-FR') },
        ])}
        ${BLOCKS.warning('Retraits bloqués 24h', "Les retraits sur le nouveau numéro sont bloqués pendant 24h pour votre sécurité. Les dépôts restent disponibles immédiatement.")}
        ${BLOCKS.security('Pas vous ?', "Si vous n'êtes pas à l'origine de ce changement, contactez le support immédiatement.")}`,
    }),
  }),

  // 8. Email modifié
  emailChanged: (pseudo, oldEmail, newEmail) => ({
    subject: "[KasoLife] Changement d'adresse email",
    html: buildEmailBase({
      badgeText: 'EMAIL', badgeColor: '#fff', badgeBg: '#374151',
      subtitle: 'Sécurité compte',
      preheader: 'Votre adresse email a été modifiée.',
      pseudo,
      bodyHtml: `
        ${BLOCKS.msg("L'adresse email associée à votre compte Kaso&#8203;Life vient d'être modifiée.")}
        ${BLOCKS.infoBox([
          { label: 'Ancienne adresse', value: oldEmail },
          { label: 'Nouvelle adresse', value: newEmail, color: '#0D4F4F' },
          { label: 'Date', value: new Date().toLocaleString('fr-FR') },
        ])}
        ${BLOCKS.warning('Pas vous ?', 'Contactez le support immédiatement sur kasolife.com/support')}`,
    }),
  }),

  // 9. KYC approuvé
  kycApproved: (pseudo) => ({
    subject: '[KasoLife] Identité vérifiée — Vous êtes créateur !',
    html: buildEmailBase({
      badgeText: 'KYC ✓', badgeColor: '#fff', badgeBg: '#166534',
      subtitle: 'Vérification identité',
      preheader: 'Votre identité a été vérifiée avec succès.',
      pseudo,
      bodyHtml: `
        ${BLOCKS.msg('Votre identité a été vérifiée avec succès. Vous pouvez maintenant candidater pour devenir créateur sur Kaso&#8203;Life.')}
        ${BLOCKS.info('Prochaine étape', 'Rendez-vous sur votre profil pour soumettre votre candidature créateur.')}
        ${BLOCKS.cta('Devenir créateur', 'https://kasolife.com/devenir-createur')}`,
    }),
  }),

  // 10. Candidature créateur approuvée
  creatorApproved: (pseudo) => ({
    subject: '[KasoLife] Candidature créateur approuvée !',
    html: buildEmailBase({
      badgeText: 'CRÉATEUR ✓', badgeColor: '#fff', badgeBg: '#166534',
      subtitle: 'Candidature créateur',
      preheader: 'Votre candidature créateur a été approuvée.',
      pseudo,
      bodyHtml: `
        ${BLOCKS.msg('Félicitations ! Votre candidature créateur a été approuvée. Vous pouvez maintenant publier du contenu et monétiser votre audience.')}
        ${BLOCKS.cta('Accéder à mon espace créateur', 'https://kasolife.com/createur')}
        ${BLOCKS.info('Premiers pas', 'Configurez votre profil créateur, fixez votre prix d\'abonnement et publiez votre premier contenu.')}`,
    }),
  }),

  // 11. Suppression de compte programmée
  account_deletion_scheduled: ({ pseudo, deletion_date, days_until_deletion, cancel_url }) => ({
    subject: days_until_deletion === 0
      ? 'KasoLife — Votre compte sera supprimé aujourd\'hui'
      : 'KasoLife — Suppression de compte programmée',
    html: buildEmailBase({
      badgeText: 'SUPPRESSION', badgeBg: '#fed7aa', badgeColor: '#92400e',
      subtitle: days_until_deletion === 0 ? 'IMMÉDIATE' : `${days_until_deletion} JOURS RESTANTS`,
      pseudo,
      bodyHtml: `
        <div style="background:#fef3c7;border-l:4px solid #f59e0b;padding:1rem;border-radius:6px;margin-bottom:1.5rem;">
          <p style="color:#92400e;font-weight:700;font-size:14px;margin:0;">⚠️ Avis important</p>
          <p style="color:#78350f;font-size:13px;margin:0.5rem 0 0;line-height:1.5;">Votre compte est programmé pour suppression définitive le <strong>${deletion_date}</strong>.</p>
        </div>
        ${BLOCKS.msg('Cette action est <strong>irréversible</strong>. Toutes vos données seront supprimées définitivement.')}
        ${BLOCKS.cta('Annuler la suppression', cancel_url)}`,
      preheader: `Votre compte sera supprimé dans ${days_until_deletion} jours`,
    }),
  }),
};

module.exports = {
  sendEmail,
  sendAdminEmail,
  shouldSendEmailByPreference,
  templates,
  buildAdminEmailBase,
  ADMIN_BLOCKS,
  stripHtml,
};
