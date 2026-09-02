// ============================================================
// KASOLIFE — Routes /promo-codes v1.0
// Promo codes management pour créateurs
// ============================================================
'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authMiddleware, requireMinRole } = require('../middleware/auth');

const router = express.Router();

// ── POST /promo-codes — créer un code promo (créateur)
router.post('/', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const {
      code, discount_percent, discount_amount, max_uses, applies_to, expires_at
    } = req.body;

    if (!code || code.length < 3 || code.length > 20) {
      return res.status(400).json({ error: 'Code invalide (3-20 caractères)' });
    }

    if (discount_percent && discount_amount) {
      return res.status(400).json({ error: 'Spécifiez soit discount_percent, soit discount_amount, pas les deux' });
    }

    if (!discount_percent && !discount_amount) {
      return res.status(400).json({ error: 'Réduction requise (discount_percent ou discount_amount)' });
    }

    if (discount_percent && (discount_percent <= 0 || discount_percent > 100)) {
      return res.status(400).json({ error: 'discount_percent doit être entre 1 et 100' });
    }

    if (discount_amount && discount_amount <= 0) {
      return res.status(400).json({ error: 'discount_amount doit être > 0' });
    }

    const { data: promo, error } = await supabase.from('promo_codes').insert({
      id: uuidv4(),
      creator_id: req.user.id,
      code: code.toUpperCase(),
      discount_percent: discount_percent || null,
      discount_amount: discount_amount || null,
      max_uses: max_uses || null,
      applies_to: applies_to || 'SUBSCRIBERS',
      expires_at: expires_at || null,
    }).select().single();

    if (error) {
      if (error.message.includes('duplicate')) {
        return res.status(409).json({ error: 'Ce code existe déjà' });
      }
      throw error;
    }

    res.status(201).json(promo);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── GET /promo-codes — lister mes codes promo
router.get('/', authMiddleware, requireMinRole('influencer'), async (req, res) => {
  try {
    const { data: codes, error } = await supabase.from('promo_codes')
      .select('id, code, discount_percent, discount_amount, max_uses, uses_count, is_active, applies_to, expires_at, created_at')
      .eq('creator_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(codes || []);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── GET /promo-codes/:id — détail d'un code
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: code, error } = await supabase.from('promo_codes')
      .select('id, creator_id, code, discount_percent, discount_amount, max_uses, uses_count, is_active, applies_to, expires_at, created_at')
      .eq('id', id).single();

    if (error || !code) return res.status(404).json({ error: 'Code introuvable' });

    // Si ce n'est pas le créateur et ce n'est pas un admin, on ne montre que les infos publiques
    if (code.creator_id !== req.user.id && !['admin', 'super_admin', 'root_admin'].includes(req.user.role)) {
      return res.json({ code: code.code, discount_percent: code.discount_percent, discount_amount: code.discount_amount });
    }

    res.json(code);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── PUT /promo-codes/:id — modifier un code (créateur seulement)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active, max_uses, expires_at } = req.body;

    const { data: code } = await supabase.from('promo_codes').select('creator_id').eq('id', id).single();
    if (!code) return res.status(404).json({ error: 'Code introuvable' });
    if (code.creator_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });

    const updates = { updated_at: new Date().toISOString() };
    if (is_active !== undefined) updates.is_active = !!is_active;
    if (max_uses !== undefined) updates.max_uses = max_uses;
    if (expires_at !== undefined) updates.expires_at = expires_at;

    const { data, error } = await supabase.from('promo_codes').update(updates).eq('id', id).select().single();
    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── DELETE /promo-codes/:id — supprimer un code
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: code } = await supabase.from('promo_codes').select('creator_id').eq('id', id).single();
    if (!code) return res.status(404).json({ error: 'Code introuvable' });
    if (code.creator_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });

    await supabase.from('promo_codes').delete().eq('id', id);
    res.json({ message: 'Code supprimé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST /promo-codes/validate/:code — valider et appliquer un code
router.post('/validate/:code', authMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    const { data, error } = await supabase.rpc('validate_promo_code', {
      p_code: code.toUpperCase(),
      p_user_id: req.user.id,
      p_amount: amount,
    });

    if (error) throw error;

    const result = data[0];
    if (!result.is_valid) {
      return res.status(400).json({ error: 'Code invalide ou déjà utilisé' });
    }

    res.json({
      valid: true,
      discount_amount: result.discount_amount,
      final_amount: result.final_amount,
      promo_id: result.promo_id,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
