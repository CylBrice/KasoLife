// ============================================================
// KASOLIFE — Middleware Auth v2.0
// Hiérarchie des rôles :
//   user=1 | influencer=2 | admin=3 | super_admin=4 | root_admin=5
// requireMinRole(minRole) : autorise le rang >= minRole
// requireExactRole(...roles) : autorise uniquement les rôles listés
// ============================================================
'use strict';
const jwt      = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { MAINTENANCE_BLOCKS_WALLET, MAINTENANCE_BLOCKS_ALL } = require('../config/constants');

// ── Hiérarchie des rôles
const ROLE_RANK = {
  user:        1,
  influencer:  2,
  admin:       3,
  super_admin: 4,
  root_admin:  5,
};

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

    if (!user)           return res.status(401).json({ error: 'Utilisateur introuvable' });
    if (!user.is_active) return res.status(403).json({ error: 'Compte suspendu — contactez le support' });

    req.user = user;
    next();
  } catch (err) {
    console.error('[Auth] Erreur middleware:', err.message);
    return res.status(500).json({ error: 'Erreur d\'authentification' });
  }
};

// ── requireMinRole : autorise rang >= minRole
// Exemples :
//   requireMinRole('influencer') → influencer, admin, super_admin, root_admin
//   requireMinRole('admin')      → admin, super_admin, root_admin
//   requireMinRole('super_admin')→ super_admin, root_admin
//   requireMinRole('root_admin') → root_admin uniquement
const requireMinRole = (minRole) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  const userRank = ROLE_RANK[req.user.role] || 0;
  const minRank  = ROLE_RANK[minRole] || 99;
  if (userRank < minRank)
    return res.status(403).json({ error: 'Accès non autorisé pour ce rôle' });
  next();
};

// ── requireKYC : bloque si kyc_status != VERIFIED
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

// ── Helper : vérifie si un acteur peut modifier la cible selon la matrice des rôles
// Retourne true si l'action est autorisée
const canModifyRole = (actorRole, targetRole, newRole) => {
  const actorRank  = ROLE_RANK[actorRole]  || 0;
  const targetRank = ROLE_RANK[targetRole] || 0;
  const newRank    = ROLE_RANK[newRole]    || 0;

  // root_admin peut tout faire
  if (actorRole === 'root_admin') return true;

  // Personne ne touche à un root_admin
  if (targetRole === 'root_admin') return false;

  // Personne ne peut promouvoir vers root_admin (sauf root_admin lui-même, géré au-dessus)
  if (newRole === 'root_admin') return false;

  // super_admin ne peut pas toucher un autre super_admin
  if (actorRole === 'super_admin' && targetRole === 'super_admin') return false;

  // super_admin peut promouvoir jusqu'à admin (pas super_admin)
  if (actorRole === 'super_admin') return newRank <= ROLE_RANK['admin'];

  // admin peut promouvoir uniquement vers influencer, et rétrograder user/influencer
  if (actorRole === 'admin') {
    if (targetRank >= ROLE_RANK['admin']) return false; // ne touche pas aux admins+
    return newRank <= ROLE_RANK['influencer'];
  }

  return false;
};

module.exports = {
  ROLE_RANK,
  authMiddleware,
  requireKYC,
  requireMinRole,
  requireNotWalletFrozen,
  requireNotMaintenance,
  getMaintStatus,
  canModifyRole,
};
