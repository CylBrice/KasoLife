// ============================================================
// KASOLIFE — Routes /payouts v1.0
// Demandes de retrait des revenus créateur (pending_balance_xcon)
// Validation manuelle par un admin (voir routes/admin.js /payouts/:id/approve)
// ============================================================
'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authMiddleware, requireKYC, requireRole, requireNotWalletFrozen } = require('../middleware/auth');
const { decrypt } = require('../services/encryption');
const { MIN_PAYOUT_AMOUNT, WITHDRAWAL_COMMISSION_RATE } = require('../config/constants');

const router = express.Router();

// ── GET /payouts/me — historique des demandes de retrait du créateur
router.get('/me', authMiddleware, requireRole('CREATOR', 'ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    const { data, error } = await supabase.from('payouts')
      .select('*').eq('creator_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

// ── POST /payouts — demander un retrait depuis le solde en attente
router.post('/', authMiddleware, requireRole('CREATOR', 'ADMIN', 'SUPERADMIN'), requireKYC, requireNotWalletFrozen, async (req, res) => {
  try {
    const { amount_xcon, mobile_money_id } = req.body;

    const amount = Number(amount_xcon);
    if (!amount || amount < MIN_PAYOUT_AMOUNT)
      return res.status(400).json({ error: `Montant minimum de retrait : ${MIN_PAYOUT_AMOUNT} FCFA` });

    if (!mobile_money_id) return res.status(400).json({ error: 'Sélectionnez un numéro Mobile Money depuis votre profil' });
    const { data: mm } = await supabase.from('user_mobile_money')
      .select('phone, operator, is_verified').eq('id', mobile_money_id).eq('user_id', req.user.id).single();
    if (!mm) return res.status(404).json({ error: 'Numéro Mobile Money introuvable' });
    if (!mm.is_verified) return res.status(403).json({ error: "Ce numéro n'est pas encore vérifié" });

    let phone; try { phone = decrypt(mm.phone); } catch { phone = mm.phone; }

    const { data: pendingPayout } = await supabase.from('payouts')
      .select('id').eq('creator_id', req.user.id).eq('status', 'PENDING').single();
    if (pendingPayout) return res.status(409).json({ error: 'Vous avez déjà une demande de retrait en attente' });

    const { data: wallet } = await supabase.from('wallets')
      .select('pending_balance_xcon').eq('user_id', req.user.id).single();
    if (!wallet || wallet.pending_balance_xcon < amount)
      return res.status(400).json({ error: `Solde disponible insuffisant — solde en attente : ${wallet?.pending_balance_xcon ?? 0} FCFA` });

    const commission = Math.round(amount * WITHDRAWAL_COMMISSION_RATE);
    const netAmount  = amount - commission;

    // Réserve le montant : transfert pending -> disponible puis débit immédiat (montant "gelé" en attente de validation admin)
    const { error: releaseErr } = await supabase.rpc('release_pending_balance', {
      p_user_id: req.user.id, p_amount: amount,
    });
    if (releaseErr) throw releaseErr;
    await supabase.rpc('debit_wallet', { p_user_id: req.user.id, p_amount: amount });

    const { data: payout, error } = await supabase.from('payouts').insert({
      id: uuidv4(), creator_id: req.user.id, amount_xcon: amount,
      commission_xcon: commission, net_amount_xcon: netAmount,
      method: 'MOBILE_MONEY', operator: mm.operator, phone,
      status: 'PENDING',
    }).select().single();
    if (error) throw error;

    res.status(201).json({
      message: 'Demande de retrait envoyée — en attente de validation',
      payout,
    });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur', details: err.message }); }
});

// ── DELETE /payouts/:id — annuler une demande en attente
router.delete('/:id', authMiddleware, requireRole('CREATOR', 'ADMIN', 'SUPERADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { data: payout } = await supabase.from('payouts').select('*').eq('id', id).single();
    if (!payout) return res.status(404).json({ error: 'Demande introuvable' });
    if (payout.creator_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });
    if (payout.status !== 'PENDING') return res.status(400).json({ error: 'Cette demande ne peut plus être annulée' });

    await supabase.from('payouts').update({ status: 'REJECTED', rejection_reason: 'Annulé par le créateur' }).eq('id', id);
    await supabase.rpc('credit_pending_balance', { p_user_id: req.user.id, p_amount: payout.amount_xcon });

    res.json({ message: 'Demande de retrait annulée et solde recrédité' });
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

module.exports = router;
