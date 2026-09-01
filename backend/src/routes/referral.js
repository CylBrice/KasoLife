// ============================================================
// KASOLIFE — Routes /referral v1.0
// Parrainage simple : bonus FCFA versé au filleul lors de la vérification KYC
// (voir routes/kyc.js webhook APPROVED). Pas de commission récurrente.
// ============================================================
'use strict';
const express  = require('express');
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { REFERRAL_BONUS_FCFA } = require('../config/constants');

const router = express.Router();

// ── GET /referral/my — lien et statistiques de parrainage
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const appUrl = process.env.FRONTEND_URL || '';
    const referralLink = `${appUrl}/auth?ref=${userId}`;

    const { count: totalReferrals } = await supabase.from('users')
      .select('*', { count: 'exact', head: true }).eq('referred_by', userId);

    const { count: verifiedReferrals } = await supabase.from('users')
      .select('*', { count: 'exact', head: true }).eq('referred_by', userId).eq('kyc_status', 'VERIFIED');

    res.json({
      referral_link: referralLink,
      total_referrals: totalReferrals || 0,
      verified_referrals: verifiedReferrals || 0,
      bonus_per_verified_referral_fcfa: REFERRAL_BONUS_FCFA,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /referral/referrals — liste des filleuls
router.get('/referrals', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('users')
      .select('id, pseudo, created_at, kyc_status')
      .eq('referred_by', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const enriched = (data || []).map(u => ({
      id: u.id, pseudo: u.pseudo, created_at: u.created_at,
      bonus_unlocked: u.kyc_status === 'VERIFIED',
    }));

    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
