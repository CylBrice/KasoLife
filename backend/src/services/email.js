// ============================================================
// KASOLIFE — Service Email v1
// Envoi d'emails transactionnels via SMTP ou Resend API
// Env : EMAIL_FROM, EMAIL_SMTP_HOST, EMAIL_SMTP_PORT,
//       EMAIL_SMTP_USER, EMAIL_SMTP_PASS
//       ou RESEND_API_KEY (prioritaire si défini)
// ============================================================
'use strict';

const supabase = require('../config/supabase');

// ── Tentative avec Resend (API simple) ───────────────────────────────────────
const sendViaResend = async (to, subject, text) => {
  const { data, error } = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    process.env.EMAIL_FROM || 'KasoLife <noreply@kasolife.com>',
      to:      [to],
      subject,
      text,
    }),
  }).then(r => r.json());
  if (error) throw new Error(error.message || 'Resend error');
  return data;
};

// ── Tentative avec Nodemailer (SMTP) ─────────────────────────────────────────
const sendViaSMTP = async (to, subject, text) => {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_SMTP_HOST,
    port:   parseInt(process.env.EMAIL_SMTP_PORT || '587'),
    secure: process.env.EMAIL_SMTP_PORT === '465',
    auth: {
      user: process.env.EMAIL_SMTP_USER,
      pass: process.env.EMAIL_SMTP_PASS,
    },
  });
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || 'KasoLife <noreply@kasolife.com>',
    to,
    subject,
    text,
  });
};

// ── sendEmail : point d'entrée principal ─────────────────────────────────────
const sendEmail = async (to, subject, text) => {
  if (!to || !subject) return;
  try {
    if (process.env.RESEND_API_KEY) {
      await sendViaResend(to, subject, text);
    } else if (process.env.EMAIL_SMTP_HOST) {
      await sendViaSMTP(to, subject, text);
    } else {
      // Mode développement — log en console uniquement
      console.log(`[Email DEV] To: ${to} | Subject: ${subject}\n${text}`);
    }
  } catch (err) {
    console.error('[Email] Erreur envoi:', err.message);
    // Non bloquant — l'email échoue silencieusement
  }
};

// ── Templates emails ─────────────────────────────────────────────────────────
const templates = {
  newDevice: (pseudo, ip, country, revokeUrl) => ({
    subject: '[KasoLife] Nouvelle connexion détectée sur votre compte',
    text: `Bonjour ${pseudo},

Une connexion à votre compte KasoLife a été détectée depuis un nouvel appareil.

IP : ${ip}
Pays : ${country || 'Inconnu'}
Date : ${new Date().toLocaleString('fr-FR')}

Si c'est vous, ignorez ce message.

Si ce n'est PAS vous, sécurisez immédiatement votre compte en cliquant sur ce lien :
${revokeUrl}

Ce lien révoque toutes vos sessions actives.

L'équipe KasoLife — 18+ uniquement !`,
  }),

  suspiciousCountry: (pseudo, country, revokeUrl) => ({
    subject: '[KasoLife] Connexion depuis un pays inhabituel',
    text: `Bonjour ${pseudo},

Une connexion à votre compte KasoLife a été détectée depuis : ${country}.

Si vous êtes en déplacement, ignorez ce message — votre compte reste actif.

Si ce n'est pas vous, cliquez sur ce lien pour révoquer tous vos accès :
${revokeUrl}

L'équipe KasoLife — 18+ uniquement !`,
  }),

  phoneChanged: (pseudo, oldPhone, newPhone) => ({
    subject: '[KasoLife] Changement de numéro Mobile Money',
    text: `Bonjour ${pseudo},

Votre numéro Mobile Money KasoLife vient d'être modifié.

Ancien numéro : ${oldPhone}
Nouveau numéro : ${newPhone}
Date : ${new Date().toLocaleString('fr-FR')}

Les retraits sur le nouveau numéro sont bloqués pendant 24h pour votre sécurité.
Les dépôts restent disponibles immédiatement.

Si vous n'êtes pas à l'origine de ce changement, contactez le support immédiatement.

L'équipe KasoLife — 18+ uniquement !`,
  }),

  emailChangeOTP: (pseudo, otp, expiryMin) => ({
    subject: '[KasoLife] Code de confirmation — changement d\'email',
    text: `Bonjour ${pseudo},

Vous avez demandé à associer cette adresse email à votre compte KasoLife.

Code de confirmation : ${otp}
Ce code est valable ${expiryMin} minutes.

Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.

L'équipe KasoLife — 18+ uniquement !`,
  }),

  passwordChanged: (pseudo) => ({
    subject: '[KasoLife] Mot de passe modifié',
    text: `Bonjour ${pseudo},

Le mot de passe de votre compte KasoLife vient d'être modifié.
Date : ${new Date().toLocaleString('fr-FR')}

Toutes vos sessions actives ont été déconnectées par sécurité.

Si vous n'êtes pas à l'origine de ce changement, contactez le support immédiatement.

L'équipe KasoLife — 18+ uniquement !`,
  }),

  emailChanged: (pseudo, oldEmail, newEmail) => ({
    subject: '[KasoLife] Changement d\'adresse email',
    text: `Bonjour ${pseudo},

L'adresse email associée à votre compte KasoLife vient d'être modifiée.

Ancienne adresse : ${oldEmail}
Nouvelle adresse : ${newEmail}
Date : ${new Date().toLocaleString('fr-FR')}

Si vous n'êtes pas à l'origine de ce changement, contactez le support immédiatement.

L'équipe KasoLife — 18+ uniquement !`,
  }),
};

module.exports = { sendEmail, templates };
