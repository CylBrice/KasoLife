// ============================================================
// KASOLIFE — Middleware Auth v1.0
// Access Token 15min (JWT)
// requireKYC : bloque les actions sensibles (devenir créateur, retraits) si kyc_status != VERIFIED
// requireRole : contrôle d'accès USER / CREATOR / ADMIN / SUPERADMIN
// ============================================================
'use strict';
const jwt      = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { MAINTENANCE_BLOCKS_WALLET, MAINTENANCE_BLOCKS_ALL } = require('../config/constants');

// ── Cache léger statut maintenance (rafraîchi toutes les 30s)
let _maintCache = { status: 'ACTIF', ts: 0 };
const getMaintStatus = async () => {
  if (Date.now() - _maintCache.ts < 30000) return _maintCache.status;
  try {
    const { data } = await supabase.from('platform_config')
      .select('value').eq('key', 'MAINTENANCE_STATUS').single();
    _maintCache = { status: data?.value || 'ACTIF', ts: Date.now() };
  } catch { _maintCache.ts = Date.now(); }
  return _maintCache.status;
};

// ── authMiddleware : vérifie le JWT Access Token
const authMiddleware = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
      return res.status(401).json({ error: 'Token manquant' });

    const token = header.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      if (e.name === 'TokenExpiredError')
        return res.status(401).json({ error: 'Token expiré — veuillez vous reconnecter', code: 'TOKEN_EXPIRED' });
      return res.status(401).json({ error: 'Token invalide' });
    }

    const { data: user } = await supabase.from('users')
      .select('id, role, is_active, kyc_status, language')
      .eq('id', decoded.userId).single();

    if (!user)          return res.status(401).json({ error: 'Utilisateur introuvable' });
    if (!user.is_active)return res.status(403).json({ error: 'Compte suspendu — contactez le support' });

    req.user = user;
    next();
  } catch (err) {
    console.error('[Auth] Erreur middleware:', err.message);
    return res.status(500).json({ error: 'Erreur d\'authentification' });
  }
};

// ── requireKYC : bloque si kyc_status != VERIFIED
// Utilisé pour : devenir créateur, créer des retraits
const requireKYC = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  if (req.user.kyc_status === 'VERIFIED') return next();

  const isEn = req.user.language === 'en';
  const messages = {
    PENDING: isEn
      ? 'Please complete identity verification to continue.'
      : 'Veuillez compléter la vérification d\'identité pour continuer.',
    FAILED: isEn
      ? 'Identity verification failed. Please try again.'
      : 'Vérification d\'identité échouée. Veuillez réessayer.',
    SUPPORT: isEn
      ? 'Maximum verification attempts reached. Please contact support.'
      : 'Limite de tentatives atteinte. Contactez le support.',
  };

  return res.status(403).json({
    error: messages[req.user.kyc_status] || messages['PENDING'],
    kyc_status: req.user.kyc_status,
    code: 'KYC_REQUIRED',
    redirect: '/kyc',
  });
};

// ── requireRole : contrôle d'accès par rôle (USER / CREATOR / ADMIN / SUPERADMIN)
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  if (!roles.includes(req.user.role))
    return res.status(403).json({ error: 'Accès non autorisé pour ce rôle' });
  next();
};

// ── requireCreator : vérifie que l'utilisateur est un créateur actif (ou admin)
const requireCreator = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  if (!['CREATOR', 'ADMIN', 'SUPERADMIN'].includes(req.user.role))
    return res.status(403).json({ error: 'Accès réservé aux créateurs' });
  next();
};

// ── requireNotWalletFrozen : vérifie le statut de maintenance pour le wallet
const requireNotWalletFrozen = async (req, res, next) => {
  try {
    const status = await getMaintStatus();
    if (MAINTENANCE_BLOCKS_WALLET.includes(status))
      return res.status(503).json({
        error: 'Les opérations financières sont temporairement suspendues. Vos fonds sont sécurisés.',
        maintenance_status: status,
      });
    next();
  } catch {
    return res.status(503).json({ error: 'Service temporairement indisponible' });
  }
};

// ── requireNotMaintenance : bloque toute action si maintenance totale
const requireNotMaintenance = async (req, res, next) => {
  try {
    const status = await getMaintStatus();
    if (MAINTENANCE_BLOCKS_ALL.includes(status))
      return res.status(503).json({
        error: 'La plateforme est en maintenance. Réessayez plus tard.',
        maintenance_status: status,
      });
    next();
  } catch {
    return res.status(503).json({ error: 'Service temporairement indisponible' });
  }
};

module.exports = {
  authMiddleware,
  requireKYC,
  requireRole,
  requireCreator,
  requireNotWalletFrozen,
  requireNotMaintenance,
  getMaintStatus,
};
