// ============================================================
// KASOLIFE — Routes /auth v1.0
// Adapté depuis KasoLife — JTON/parrainage paris retirés
// Access Token 15min (JWT) + Refresh Token 30j révocable
// ============================================================
'use strict';
const express   = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const { v4: uuidv4 } = require('uuid');
const supabase  = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { encrypt, decrypt, encryptDeterministic } = require('../services/encryption');
const { generateOTP, sendPasswordResetOTP, sendSMS, sendEmailOTP } = require('../services/sms');
const { sendEmail, templates } = require('../services/email');
const {
  isValidE164, isValidPseudo, PSEUDO_ERROR_MSG, EMAIL_OTP_EXPIRY_MIN,
  ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY_MS,
  SESSION_SOFT_EXPIRY_MS, SESSION_HARD_EXPIRY_MS, MAX_ACTIVE_SESSIONS,
  detectMobileOperator, MOBILE_MONEY_MAX_PER_OPERATOR, MOBILE_MONEY_MAX_TOTAL,
  REFERRAL_BONUS_FCFA, INFLUENCER_CODE_PREFIX,
} = require('../config/constants');

const router = express.Router();

// ── Rate limits (anti brute-force / anti spam)
const sendVerifLimit  = rateLimit({ windowMs: 3600000, max: 5,  message: { error: 'Trop de demandes — réessayez dans 1 heure' } });
const forgotPassLimit = rateLimit({ windowMs: 3600000, max: 3,  message: { error: 'Trop de demandes — réessayez dans 1 heure' } });
const phoneChangeLimit= rateLimit({ windowMs: 3600000, max: 3,  message: { error: 'Trop de demandes — réessayez dans 1 heure' } });
const loginLimit      = rateLimit({ windowMs: 900000,  max: 10, message: { error: 'Trop de tentatives — réessayez dans 15 minutes' } });
const pseudoCheckLimit= rateLimit({ windowMs: 60000,   max: 30, message: { error: 'Trop de vérifications — réessayez dans 1 minute' } });
const registerLimit   = rateLimit({ windowMs: 3600000, max: 5,  message: { error: "Trop d'inscriptions depuis cette adresse — réessayez dans 1 heure" } });

// ── Génération de la paire de tokens (access + refresh)
const generateTokens = async (userId, userAgent, ip) => {
  const accessToken  = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const rawRefresh   = crypto.randomBytes(40).toString('hex');
  const tokenHash    = crypto.createHash('sha256').update(rawRefresh).digest('hex');
  const expiresAt    = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS).toISOString();

  // Limiter à MAX_ACTIVE_SESSIONS sessions actives — révoquer les plus anciennes au-delà
  const { data: activeSessions } = await supabase.from('refresh_tokens')
    .select('id, created_at')
    .eq('user_id', userId).eq('revoked', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });
  if (activeSessions && activeSessions.length >= MAX_ACTIVE_SESSIONS) {
    const toRevoke = activeSessions.slice(0, activeSessions.length - MAX_ACTIVE_SESSIONS + 1);
    await supabase.from('refresh_tokens').update({ revoked: true })
      .in('id', toRevoke.map(s => s.id));
  }

  await supabase.from('refresh_tokens').insert({
    id: uuidv4(), user_id: userId, token_hash: tokenHash,
    expires_at: expiresAt, user_agent: userAgent, ip_address: ip,
  });
  return { accessToken, refreshToken: rawRefresh };
};

// Insère le numéro d'inscription (déjà vérifié par OTP) comme 1er numéro Mobile Money
const registerPhoneAsMobileMoney = async (userId, phone) => {
  const operator = detectMobileOperator(phone);
  if (!operator) return;
  try {
    await supabase.from('user_mobile_money').insert({
      user_id: userId, operator, phone: encrypt(phone),
      is_default: true, is_verified: true,
    });
  } catch {}
};

// Réconcilie la liste user_mobile_money (max 6, 3/opérateur) après changement de numéro de connexion
const reconcileMobileMoneyOnPhoneChange = async (userId, oldPhone, newPhone) => {
  try {
    const { data: rows } = await supabase.from('user_mobile_money')
      .select('id, operator, phone, is_default, created_at').eq('user_id', userId);
    const list = (rows || []).map(r => {
      let plain = null; try { plain = decrypt(r.phone); } catch {}
      return { ...r, plain };
    });

    const existingEntry = list.find(r => r.plain === newPhone);
    if (existingEntry) {
      await supabase.from('user_mobile_money').update({ is_default: false })
        .eq('user_id', userId).eq('operator', existingEntry.operator);
      await supabase.from('user_mobile_money').update({ is_default: true }).eq('id', existingEntry.id);
      return;
    }

    const newOperator = detectMobileOperator(newPhone);
    if (!newOperator) return;

    const oldEntry = oldPhone ? list.find(r => r.plain === oldPhone) : null;
    let total   = list.length;
    let opCount = list.filter(r => r.operator === newOperator).length;

    if ((total >= MOBILE_MONEY_MAX_TOTAL || opCount >= MOBILE_MONEY_MAX_PER_OPERATOR) && oldEntry) {
      await supabase.from('user_mobile_money').delete().eq('id', oldEntry.id);
      total--;
      if (oldEntry.operator === newOperator) opCount--;
    }

    if (total >= MOBILE_MONEY_MAX_TOTAL || opCount >= MOBILE_MONEY_MAX_PER_OPERATOR) return;

    await supabase.from('user_mobile_money').update({ is_default: false })
      .eq('user_id', userId).eq('operator', newOperator);
    await supabase.from('user_mobile_money').insert({
      user_id: userId, operator: newOperator, phone: encrypt(newPhone),
      is_default: true, is_verified: true,
    });
  } catch {}
};

// ── GET /auth/check-pseudo — vérification disponibilité pseudonyme (public)
router.get('/check-pseudo', pseudoCheckLimit, async (req, res) => {
  try {
    const { pseudo } = req.query;
    if (!pseudo) return res.status(400).json({ error: 'Pseudo requis' });
    if (!isValidPseudo(pseudo)) return res.status(400).json({ error: PSEUDO_ERROR_MSG, available: false });
    const { data } = await supabase.from('users').select('id').ilike('pseudo', pseudo).single();
    res.json({ available: !data });
  } catch (err) { res.json({ available: true }); }
});

// ── POST /auth/register
router.post('/register', registerLimit, async (req, res) => {
  try {
    const { phone, pseudo, name, password, country_iso, language = 'fr',
            birth_date, ref } = req.body;

    if (!phone || !pseudo || !name || !password)
      return res.status(400).json({ error: 'Champs requis manquants (phone, pseudo, name, password)' });
    if (!country_iso)
      return res.status(400).json({ error: 'Le pays de résidence est obligatoire' });
    if (!birth_date)
      return res.status(400).json({ error: 'La date de naissance est obligatoire' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Mot de passe trop court (min 8 caractères)' });
    if (!isValidPseudo(pseudo))
      return res.status(400).json({ error: PSEUDO_ERROR_MSG });
    if (!isValidE164(phone))
      return res.status(400).json({ error: 'Format de numéro invalide — utilisez le format international (ex: +237690000000)' });

    // Vérification de majorité — obligatoire pour toute la plateforme
    const dob = new Date(birth_date);
    if (isNaN(dob.getTime()))
      return res.status(400).json({ error: 'Date de naissance invalide' });
    if ((Date.now() - dob.getTime()) / 86400000 < 365.25 * 18)
      return res.status(400).json({ error: 'Vous devez avoir au moins 18 ans pour vous inscrire' });

    const { data: existingPhone } = await supabase.from('users').select('id').eq('phone', encryptDeterministic(phone)).single();
    if (existingPhone) return res.status(409).json({ error: 'Numéro déjà utilisé' });

    const { data: existingPseudo } = await supabase.from('users').select('id').ilike('pseudo', pseudo).single();
    if (existingPseudo) return res.status(409).json({ error: 'Ce pseudonyme est déjà pris — choisissez-en un autre' });

    // Vérifier code de parrainage KSL-
    let parrainId = null;
    let influencerCodeId = null;
    if (ref && ref.startsWith(INFLUENCER_CODE_PREFIX)) {
      const { data: iCode } = await supabase.from('influencer_codes')
        .select('id, user_id, uses_today, uses_today_reset, max_uses_day, is_active')
        .eq('code', ref.toUpperCase()).single();
      if (iCode && iCode.is_active) {
        const today = new Date().toISOString().slice(0, 10);
        const usesToday = iCode.uses_today_reset === today ? iCode.uses_today : 0;
        if (usesToday < iCode.max_uses_day) {
          parrainId = iCode.user_id;
          influencerCodeId = iCode.id;
        }
      }
    } else if (ref) {
      const { data: parrain } = await supabase.from('users').select('id').eq('id', ref).single();
      if (parrain) parrainId = parrain.id;
    }

    const password_hash = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    // Chiffrement AES-256-GCM des données personnelles avant stockage
    // phone : chiffrement déterministe (recherche par égalité)
    // name / birth_date : chiffrement aléatoire (jamais recherchés par égalité)
    const phoneEncrypted = encryptDeterministic(phone);
    const nameEncrypted  = encrypt(name);

    const { error: userError } = await supabase.from('users').insert({
      id: userId, phone: phoneEncrypted, pseudo, name: nameEncrypted, password_hash,
      country_iso: country_iso.toUpperCase(), language, birth_date,
      kyc_status: 'PENDING', referred_by: parrainId, role: 'USER',
    });
    if (userError) throw userError;

    await supabase.from('wallets').insert({ user_id: userId, balance_xcon: 0 });

    // Le numéro d'inscription (déjà vérifié par OTP) compte comme l'un des 6 numéros Mobile Money
    await registerPhoneAsMobileMoney(userId, phone);

    // Enregistrer le parrainage en attente si code valide
    if (parrainId) {
      await supabase.from('referral_tracking').insert({
        id: uuidv4(), parrain_id: parrainId, filleul_id: userId,
        code: ref ? ref.toUpperCase() : null, bonus_filleul_given: false,
      });
      if (influencerCodeId) {
        const today = new Date().toISOString().slice(0, 10);
        const { data: iCode } = await supabase.from('influencer_codes')
          .select('uses_today, uses_today_reset, uses_total').eq('id', influencerCodeId).single();
        const usesToday = iCode?.uses_today_reset === today ? (iCode.uses_today || 0) : 0;
        await supabase.from('influencer_codes').update({
          uses_today: usesToday + 1,
          uses_today_reset: today,
          uses_total: (iCode?.uses_total || 0) + 1,
        }).eq('id', influencerCodeId);
      }
    }

    const { accessToken, refreshToken } = await generateTokens(
      userId, req.headers['user-agent'], req.ip
    );
    res.status(201).json({
      accessToken, refreshToken, userId, pseudo,
      kyc_required: true,
      kyc_status: 'PENDING',
      message: "Compte créé — Vérification d'identité requise pour devenir créateur ou retirer des fonds",
      message_en: 'Account created — Identity verification required to become a creator or withdraw funds',
    });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur', details: err.message }); }
});

// ── POST /auth/login
router.post('/login', loginLimit, async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'Champs requis manquants' });

    const { data: user } = await supabase.from('users')
      .select('id, name, pseudo, role, is_active, password_hash, last_active, email_confirmed, created_at, kyc_status')
      .eq('phone', encryptDeterministic(phone)).single();

    if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });
    if (!user.is_active) return res.status(403).json({ error: 'Compte suspendu — contactez le support' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });

    await supabase.from('users').update({ last_active: new Date().toISOString() }).eq('id', user.id);

    const { accessToken, refreshToken } = await generateTokens(
      user.id, req.headers['user-agent'], req.ip
    );

    // ── Détection nouvel appareil / pays suspect (non bloquant) ─────────────
    setImmediate(async () => {
      try {
        const { data: userData } = await supabase.from('users')
          .select('email, pseudo, country_iso').eq('id', user.id).single();
        if (!userData?.email) return;

        const uaHash = crypto.createHash('sha256')
          .update((req.headers['user-agent'] || '') + req.ip).digest('hex').slice(0, 16);

        const { data: knownDevice } = await supabase.from('refresh_tokens')
          .select('id').eq('user_id', user.id)
          .eq('device_hash', uaHash).limit(1).single();

        const revokeUrl = `${process.env.FRONTEND_URL}/auth?action=revoke-all&token=${refreshToken.slice(0, 20)}`;

        if (!knownDevice) {
          const tpl = templates.newDevice(userData.pseudo, req.ip, userData.country_iso, revokeUrl);
          await sendEmail(userData.email, tpl.subject, tpl.text);
        }

        const { data: prevTokens } = await supabase.from('refresh_tokens')
          .select('ip_address').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
        const knownIPs = (prevTokens || []).map(t => t.ip_address).filter(Boolean);
        const ipPrefix = req.ip?.split('.').slice(0, 2).join('.');
        const isKnownIP = knownIPs.some(ip => ip?.startsWith(ipPrefix));

        if (!isKnownIP && knownIPs.length > 3) {
          const tpl = templates.suspiciousCountry(userData.pseudo, 'Pays inconnu', revokeUrl);
          await sendEmail(userData.email, tpl.subject, tpl.text);
        }

        await supabase.from('refresh_tokens')
          .update({ device_hash: uaHash, ip_address: req.ip })
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
      } catch { /* non bloquant */ }
    });

    res.json({
      accessToken, refreshToken,
      user: { id: user.id, name: user.name, pseudo: user.pseudo, role: user.role, kyc_status: user.kyc_status },
      showEmailPrompt: !user.last_active,
      emailConfirmed: user.email_confirmed,
    });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /auth/refresh (Access 15min + Refresh 30j, session glissante)
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token manquant' });

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const { data: stored } = await supabase.from('refresh_tokens')
      .select('*, user:users(id, role, is_active, pseudo, last_active)')
      .eq('token_hash', tokenHash).eq('revoked', false).single();

    if (!stored) return res.status(401).json({ error: 'Refresh token invalide ou révoqué' });
    if (new Date(stored.expires_at) < new Date())
      return res.status(401).json({ error: 'Refresh token expiré — reconnectez-vous' });
    if (!stored.user?.is_active)
      return res.status(403).json({ error: 'Compte suspendu' });

    const lastActive = stored.user?.last_active ? new Date(stored.user.last_active).getTime() : 0;
    const inactiveMs = Date.now() - lastActive;

    if (inactiveMs > SESSION_HARD_EXPIRY_MS) {
      await supabase.from('refresh_tokens').update({ revoked: true }).eq('id', stored.id);
      return res.status(401).json({ error: 'Session expirée — reconnectez-vous', session_expired: true });
    }

    if (inactiveMs > SESSION_SOFT_EXPIRY_MS) {
      return res.status(401).json({
        error: 'Vérification requise',
        reauth_required: true,
        message_fr: 'Veuillez confirmer votre identité pour continuer',
        message_en: 'Please verify your identity to continue',
      });
    }

    // Session active : rotation normale du token
    await supabase.from('refresh_tokens').update({ revoked: true }).eq('id', stored.id);
    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(
      stored.user_id, req.headers['user-agent'], req.ip
    );
    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await supabase.from('refresh_tokens').update({ revoked: true })
        .eq('token_hash', tokenHash).eq('user_id', req.user.id);
    }
    res.json({ message: 'Déconnecté avec succès' });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /auth/logout-all — déconnexion de tous les appareils
router.post('/logout-all', authMiddleware, async (req, res) => {
  try {
    await supabase.from('refresh_tokens').update({ revoked: true })
      .eq('user_id', req.user.id).eq('revoked', false);
    res.json({ message: 'Tous les appareils déconnectés' });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── GET /auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data: user } = await supabase.from('users')
      .select('id, phone, pseudo, name, country_iso, language, role, avatar_url, banner_url, bio, created_at, email, email_confirmed, email_notifs, kyc_status')
      .eq('id', req.user.id).single();
    const { data: wallet } = await supabase.from('wallets')
      .select('balance_xcon, pending_balance_xcon, total_deposited, total_withdrawn, total_earned')
      .eq('user_id', req.user.id).single();

    const namePlain = user?.name ? (() => { try { return decrypt(user.name); } catch { return user.name; } })() : '';
    const phoneMasked = user?.phone ? (() => {
      try { const raw = decrypt(user.phone); return raw.slice(0, -4).replace(/./g, '*') + raw.slice(-4); }
      catch { return null; }
    })() : null;
    const { phone, ...userWithoutPhone } = user || {};

    // Profil créateur si applicable
    let creatorProfile = null;
    if (user?.role === 'CREATOR') {
      const { data: cp } = await supabase.from('creator_profiles')
        .select('*, category:categories(name, slug)').eq('user_id', req.user.id).single();
      creatorProfile = cp;
    }

    res.json({
      ...userWithoutPhone,
      phone_masked: phoneMasked,
      name: namePlain,
      wallet: {
        balance_xcon:         wallet?.balance_xcon         ?? 0,
        pending_balance_xcon: wallet?.pending_balance_xcon ?? 0,
        total_deposited:      wallet?.total_deposited      ?? 0,
        total_withdrawn:      wallet?.total_withdrawn      ?? 0,
        total_earned:         wallet?.total_earned         ?? 0,
      },
      creator_profile: creatorProfile,
    });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── PUT /auth/pseudo
router.put('/pseudo', authMiddleware, async (req, res) => {
  try {
    const { pseudo } = req.body;
    if (!pseudo) return res.status(400).json({ error: 'Pseudo requis' });
    if (!isValidPseudo(pseudo)) return res.status(400).json({ error: PSEUDO_ERROR_MSG });
    const { data: existing } = await supabase.from('users')
      .select('id').ilike('pseudo', pseudo).neq('id', req.user.id).single();
    if (existing) return res.status(409).json({ error: 'Ce pseudonyme est déjà pris' });
    await supabase.from('users').update({ pseudo }).eq('id', req.user.id);
    res.json({ message: 'Pseudonyme mis à jour', pseudo });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── PUT /auth/name
const NAME_PART_REGEX = /^[A-Za-z]+$/;
const formatNamePart  = (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();

router.put('/name', authMiddleware, async (req, res) => {
  try {
    const { prenom, nom } = req.body;
    if (!prenom || !nom) return res.status(400).json({ error: 'Prénom et nom requis' });

    const prenomTrimmed = prenom.trim();
    const nomTrimmed    = nom.trim();
    if (!NAME_PART_REGEX.test(prenomTrimmed) || !NAME_PART_REGEX.test(nomTrimmed))
      return res.status(400).json({ error: 'Le prénom et le nom ne doivent contenir que des lettres (a-z, A-Z)' });
    if (prenomTrimmed.length < 2 || prenomTrimmed.length > 30 || nomTrimmed.length < 2 || nomTrimmed.length > 30)
      return res.status(400).json({ error: 'Le prénom et le nom doivent contenir entre 2 et 30 caractères' });

    const fullName = `${formatNamePart(prenomTrimmed)} ${formatNamePart(nomTrimmed)}`;
    await supabase.from('users').update({ name: encrypt(fullName) }).eq('id', req.user.id);
    res.json({ message: 'Nom mis à jour', name: fullName });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── PUT /auth/profile — bio, avatar, bannière (utilisateur ou créateur)
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { bio, avatar_url, banner_url, language } = req.body;
    const updates = {};
    if (bio !== undefined) {
      if (bio.length > 500) return res.status(400).json({ error: 'Bio trop longue (max 500 caractères)' });
      updates.bio = bio;
    }
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (banner_url !== undefined) updates.banner_url = banner_url;
    if (language !== undefined) {
      if (!['fr', 'en'].includes(language)) return res.status(400).json({ error: 'Langue invalide (fr ou en)' });
      updates.language = language;
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });

    updates.updated_at = new Date().toISOString();
    await supabase.from('users').update(updates).eq('id', req.user.id);
    res.json({ message: 'Profil mis à jour', ...updates });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /auth/send-verification
router.post('/send-verification', sendVerifLimit, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Numéro requis' });
    if (!isValidE164(phone)) return res.status(400).json({ error: 'Format invalide' });
    const { data: existing } = await supabase.from('users').select('id').eq('phone', encryptDeterministic(phone)).single();
    if (existing) return res.status(409).json({ error: 'Numéro déjà utilisé' });
    await supabase.from('phone_verification_tokens').update({ used: true }).eq('phone', phone).eq('used', false);
    const otp        = Math.floor(100000 + Math.random() * 900000).toString();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from('phone_verification_tokens').insert({ phone, token: otp, expires_at });
    await sendSMS(phone, `KASOLIFE - Code de vérification : ${otp}. Valable 10 minutes.`);
    res.json({ message: 'Code envoyé par SMS' });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /auth/verify-phone
router.post('/verify-phone', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'Champs requis manquants' });
    const { data: token } = await supabase.from('phone_verification_tokens')
      .select('*').eq('phone', phone).eq('token', otp).eq('used', false)
      .gt('expires_at', new Date().toISOString()).single();
    if (!token) return res.status(400).json({ error: 'Code invalide ou expiré' });
    await supabase.from('phone_verification_tokens').update({ used: true }).eq('id', token.id);
    res.json({ verified: true, message: 'Numéro vérifié avec succès' });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /auth/forgot-password
router.post('/forgot-password', forgotPassLimit, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Numéro requis' });
    const { data: user } = await supabase.from('users').select('id, language, is_active').eq('phone', encryptDeterministic(phone)).single();
    if (!user || !user.is_active) return res.json({ message: 'Si ce numéro est enregistré, un code vous a été envoyé' });
    await supabase.from('password_reset_tokens').update({ used: true }).eq('user_id', user.id).eq('used', false);
    const otp = generateOTP();
    await supabase.from('password_reset_tokens').insert({ user_id: user.id, token: otp, expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
    await sendPasswordResetOTP(phone, otp, user.language || 'fr');
    res.json({ message: 'Si ce numéro est enregistré, un code vous a été envoyé' });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { phone, otp, new_password } = req.body;
    if (!phone || !otp || !new_password) return res.status(400).json({ error: 'Champs requis manquants' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Mot de passe trop court (min 8 caractères)' });
    const { data: user } = await supabase.from('users').select('id').eq('phone', encryptDeterministic(phone)).single();
    if (!user) return res.status(400).json({ error: 'Code invalide ou expiré' });
    const { data: tok } = await supabase.from('password_reset_tokens')
      .select('*').eq('user_id', user.id).eq('token', otp).eq('used', false)
      .gt('expires_at', new Date().toISOString()).single();
    if (!tok) return res.status(400).json({ error: 'Code invalide ou expiré' });
    await supabase.from('password_reset_tokens').update({ used: true }).eq('id', tok.id);
    await supabase.from('users').update({ password_hash: await bcrypt.hash(new_password, 12) }).eq('id', user.id);
    // Sécurité : révoquer toutes les sessions actives après réinitialisation
    await supabase.from('refresh_tokens').update({ revoked: true }).eq('user_id', user.id);
    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── PUT /auth/push-token
router.put('/push-token', authMiddleware, async (req, res) => {
  try {
    const { expo_push_token } = req.body;
    if (!expo_push_token) return res.status(400).json({ error: 'Token requis' });
    if (!expo_push_token.startsWith('ExponentPushToken[') && !expo_push_token.startsWith('ExpoPushToken['))
      return res.status(400).json({ error: 'Format de token invalide' });
    await supabase.from('users').update({ expo_push_token }).eq('id', req.user.id);
    res.json({ message: 'Token push enregistré' });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── PUT /auth/mobile-money
router.put('/mobile-money', authMiddleware, async (req, res) => {
  try {
    const { phone, operator } = req.body;
    if (!phone || !operator) return res.status(400).json({ error: 'Champs requis manquants' });
    await supabase.from('users').update({ mobile_money_phone: encrypt(phone), mobile_money_op: operator }).eq('id', req.user.id);
    res.json({ message: 'Mobile Money mis à jour' });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /auth/email/submit
router.post('/email/submit', authMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Email invalide' });
    await supabase.from('email_verification_tokens').update({ used: true }).eq('user_id', req.user.id).eq('used', false);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await supabase.from('email_verification_tokens').insert({
      user_id: req.user.id, email, token: otp,
      expires_at: new Date(Date.now() + EMAIL_OTP_EXPIRY_MIN * 60000).toISOString(),
    });
    await supabase.from('users').update({ email, email_confirmed: false }).eq('id', req.user.id);
    if (typeof sendEmailOTP === 'function') await sendEmailOTP(email, otp);
    res.json({ message: `Code envoyé à ${email}` });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /auth/email/confirm
router.post('/email/confirm', authMiddleware, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'Code requis' });
    const { data: tok } = await supabase.from('email_verification_tokens')
      .select('*').eq('user_id', req.user.id).eq('token', otp).eq('used', false)
      .gt('expires_at', new Date().toISOString()).single();
    if (!tok) return res.status(400).json({ error: 'Code invalide ou expiré' });
    await supabase.from('email_verification_tokens').update({ used: true }).eq('id', tok.id);
    await supabase.from('users').update({ email: tok.email, email_confirmed: true, email_confirmed_at: new Date().toISOString(), is_active: true }).eq('id', req.user.id);
    res.json({ message: 'Email confirmé avec succès' });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── GET /auth/sessions — Liste des sessions actives
router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('refresh_tokens')
      .select('id, user_agent, ip_address, device_hash, created_at, expires_at')
      .eq('user_id', req.user.id).eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: 'Erreur interne' }); }
});

// ── DELETE /auth/sessions/:id — Révoquer une session
router.delete('/sessions/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: tok } = await supabase.from('refresh_tokens')
      .select('user_id').eq('id', id).single();
    if (!tok || tok.user_id !== req.user.id)
      return res.status(403).json({ error: 'Accès refusé' });
    await supabase.from('refresh_tokens').update({ revoked: true }).eq('id', id);
    res.json({ message: 'Session révoquée' });
  } catch (err) { res.status(500).json({ error: 'Erreur interne' }); }
});

// ── POST /auth/2fa/setup — Configurer la double authentification
router.post('/2fa/setup', authMiddleware, async (req, res) => {
  try {
    const { method } = req.body; // 'sms' | 'email'
    if (!['sms', 'email'].includes(method))
      return res.status(400).json({ error: 'Méthode invalide — sms ou email' });
    await supabase.from('users').update({ twofa_method: method, twofa_enabled: true }).eq('id', req.user.id);
    res.json({ message: `Double authentification configurée : ${method}` });
  } catch (err) { res.status(500).json({ error: 'Erreur interne' }); }
});

// ── POST /auth/2fa/send — Envoyer OTP 2FA
router.post('/2fa/send', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Téléphone requis' });

    const { data: user } = await supabase.from('users')
      .select('id, pseudo, email, twofa_method').eq('phone', encryptDeterministic(phone)).single();
    if (!user) return res.status(200).json({ message: 'Si ce compte existe, un code a été envoyé' });

    const otp     = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase.from('otp_tokens').insert({
      id: uuidv4(), user_id: user.id, token: otp, type: '2FA', expires_at: expires,
    });

    if (user.twofa_method === 'email' && user.email) {
      await sendEmail(user.email, '[KasoLife] Code de connexion',
        `Votre code de connexion KasoLife : ${otp}\nValable 10 minutes.\n\nNe partagez jamais ce code.`);
    } else {
      await sendSMS(phone, `KASOLIFE — Code de connexion : ${otp}. Valable 10 min.`);
    }
    res.json({ message: 'Code envoyé', method: user.twofa_method || 'sms' });
  } catch (err) { res.status(500).json({ error: 'Erreur interne' }); }
});

// ── POST /auth/2fa/verify — Vérifier OTP 2FA
router.post('/2fa/verify', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'Téléphone et code requis' });

    const { data: user } = await supabase.from('users')
      .select('id').eq('phone', encryptDeterministic(phone)).single();
    if (!user) return res.status(400).json({ error: 'Code invalide' });

    const { data: tok } = await supabase.from('otp_tokens')
      .select('*').eq('user_id', user.id).eq('token', otp).eq('type', '2FA')
      .eq('used', false).gt('expires_at', new Date().toISOString()).single();
    if (!tok) return res.status(400).json({ error: 'Code invalide ou expiré' });

    await supabase.from('otp_tokens').update({ used: true }).eq('id', tok.id);
    res.json({ valid: true });
  } catch (err) { res.status(500).json({ error: 'Erreur interne' }); }
});

// ── PUT /auth/change-phone — Demander un changement de numéro
router.put('/change-phone', authMiddleware, phoneChangeLimit, async (req, res) => {
  try {
    const { new_phone, password } = req.body;
    if (!new_phone || !isValidE164(new_phone))
      return res.status(400).json({ error: 'Format de numéro invalide — utilisez le format international (ex: +237690000000)' });
    if (!password) return res.status(400).json({ error: 'Mot de passe requis' });

    const { data: user } = await supabase.from('users')
      .select('phone, password_hash').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe incorrect' });

    const newPhoneEnc = encryptDeterministic(new_phone);
    if (user.phone === newPhoneEnc)
      return res.status(400).json({ error: 'Ce numéro est déjà associé à votre compte' });

    const { data: existing } = await supabase.from('users')
      .select('id').eq('phone', newPhoneEnc).neq('id', req.user.id).single();
    if (existing) return res.status(409).json({ error: 'Ce numéro est déjà utilisé par un autre compte' });

    await supabase.from('phone_verification_tokens').update({ used: true }).eq('phone', new_phone).eq('used', false);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await supabase.from('phone_verification_tokens').insert({
      phone: new_phone, token: otp,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    await sendSMS(new_phone, `KASOLIFE — Code de confirmation changement de numéro : ${otp}. Valable 10 minutes.`);

    res.json({ message: `Code de confirmation envoyé au ${new_phone}` });
  } catch (err) { res.status(500).json({ error: 'Erreur interne' }); }
});

// ── POST /auth/change-phone/confirm — Confirmer le changement de numéro
router.post('/change-phone/confirm', authMiddleware, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'Code requis' });

    const { data: tok } = await supabase.from('phone_verification_tokens')
      .select('*').eq('token', otp).eq('used', false)
      .gt('expires_at', new Date().toISOString()).single();
    if (!tok) return res.status(400).json({ error: 'Code invalide ou expiré' });

    const newPhone    = tok.phone;
    const newPhoneEnc = encryptDeterministic(newPhone);

    const { data: existing } = await supabase.from('users')
      .select('id').eq('phone', newPhoneEnc).neq('id', req.user.id).single();
    if (existing) return res.status(409).json({ error: 'Ce numéro est déjà utilisé par un autre compte' });

    const { data: user } = await supabase.from('users')
      .select('phone, email, pseudo').eq('id', req.user.id).single();
    const oldPhoneEnc = user?.phone;
    let oldPhonePlain = null;
    try { oldPhonePlain = oldPhoneEnc ? decrypt(oldPhoneEnc) : null; } catch {}

    await supabase.from('phone_verification_tokens').update({ used: true }).eq('id', tok.id);

    await supabase.from('users').update({
      phone: newPhoneEnc, phone_changed_at: new Date().toISOString(),
    }).eq('id', req.user.id);

    await reconcileMobileMoneyOnPhoneChange(req.user.id, oldPhonePlain, newPhone);

    if (oldPhonePlain) {
      await sendSMS(oldPhonePlain,
        `KASOLIFE — Le numéro de connexion de votre compte vient d'être modifié. Si ce n'est pas vous, contactez le support immédiatement.`
      ).catch(() => {});
    }
    await sendSMS(newPhone,
      `KASOLIFE — Ce numéro est désormais votre numéro de connexion KasoLife.`
    ).catch(() => {});
    if (user?.email) {
      const tpl = templates.phoneChanged(user.pseudo, oldPhonePlain || '—', newPhone);
      await sendEmail(user.email, tpl.subject, tpl.text).catch(() => {});
    }

    res.json({ message: 'Numéro de téléphone mis à jour avec succès', phone: newPhone });
  } catch (err) { res.status(500).json({ error: 'Erreur interne' }); }
});

// ── PUT /auth/change-password
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis' });
    if (new_password.length < 8)
      return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });

    const { data: user } = await supabase.from('users')
      .select('password_hash, email, pseudo').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

    const samePassword = await bcrypt.compare(new_password, user.password_hash);
    if (samePassword) return res.status(400).json({ error: 'Le nouveau mot de passe doit être différent de l\'ancien' });

    const newHash = await bcrypt.hash(new_password, 12);
    await supabase.from('users').update({ password_hash: newHash }).eq('id', req.user.id);

    // Sécurité : déconnexion de toutes les sessions après changement de mot de passe
    await supabase.from('refresh_tokens').update({ revoked: true }).eq('user_id', req.user.id);

    if (user.email) {
      const tpl = templates.passwordChanged(user.pseudo);
      await sendEmail(user.email, tpl.subject, tpl.text).catch(() => {});
    }

    res.json({ message: 'Mot de passe mis à jour. Vous allez être déconnecté de tous vos appareils.' });
  } catch (err) { res.status(500).json({ error: 'Erreur interne' }); }
});

// ── PUT /auth/change-email — Demander un changement d'email
router.put('/change-email', authMiddleware, async (req, res) => {
  try {
    const { new_email, password } = req.body;
    if (!new_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(new_email))
      return res.status(400).json({ error: 'Adresse email invalide' });
    if (!password) return res.status(400).json({ error: 'Mot de passe requis' });

    const { data: user } = await supabase.from('users')
      .select('email, pseudo, password_hash').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe incorrect' });

    if (user.email === new_email)
      return res.status(400).json({ error: 'Cette adresse est déjà associée à votre compte' });

    const { data: existing } = await supabase.from('users')
      .select('id').eq('email', new_email).neq('id', req.user.id).single();
    if (existing) return res.status(409).json({ error: 'Cette adresse email est déjà utilisée' });

    await supabase.from('email_verification_tokens').update({ used: true }).eq('user_id', req.user.id).eq('used', false);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await supabase.from('email_verification_tokens').insert({
      user_id: req.user.id, email: new_email, token: otp,
      expires_at: new Date(Date.now() + EMAIL_OTP_EXPIRY_MIN * 60000).toISOString(),
    });

    const tpl = templates.emailChangeOTP(user.pseudo, otp, EMAIL_OTP_EXPIRY_MIN);
    await sendEmail(new_email, tpl.subject, tpl.text);

    res.json({ message: `Code de confirmation envoyé à ${new_email}` });
  } catch (err) { res.status(500).json({ error: 'Erreur interne' }); }
});

// ── POST /auth/change-email/confirm
router.post('/change-email/confirm', authMiddleware, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: 'Code requis' });

    const { data: tok } = await supabase.from('email_verification_tokens')
      .select('*').eq('user_id', req.user.id).eq('token', otp).eq('used', false)
      .gt('expires_at', new Date().toISOString()).single();
    if (!tok) return res.status(400).json({ error: 'Code invalide ou expiré' });

    const { data: user } = await supabase.from('users')
      .select('email, pseudo').eq('id', req.user.id).single();
    const oldEmail = user?.email;

    await supabase.from('email_verification_tokens').update({ used: true }).eq('id', tok.id);
    await supabase.from('users').update({
      email: tok.email, email_confirmed: true, email_confirmed_at: new Date().toISOString(),
    }).eq('id', req.user.id);

    if (oldEmail) {
      const tpl = templates.emailChanged(user.pseudo, oldEmail, tok.email);
      await sendEmail(oldEmail, tpl.subject, tpl.text).catch(() => {});
    }

    res.json({ message: 'Email mis à jour avec succès', email: tok.email });
  } catch (err) { res.status(500).json({ error: 'Erreur interne' }); }
});

module.exports = router;
