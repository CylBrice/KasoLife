// ============================================================
// KASOLIFE — Stream Goals Routes
// CRUD : création, modification, suppression goals
// Ledger : accumule tips vers un goal
// ============================================================
'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const configService = require('../services/configService');

const router = express.Router();
router.use(authMiddleware);

// ── POST /stream-goals — créer un goal ──────────────────────
router.post('/', async (req, res) => {
  try {
    const { stream_id, title, target_amount_xcon } = req.body;
    const creatorId = req.user.id;

    if (!stream_id || !title || !target_amount_xcon) {
      return res.status(400).json({ error: 'stream_id, title, target_amount_xcon requis' });
    }

    // Vérifier que le stream appartient au créateur
    const { data: stream } = await supabase
      .from('live_streams')
      .select('id, creator_id')
      .eq('id', stream_id)
      .eq('creator_id', creatorId)
      .single();

    if (!stream) {
      return res.status(403).json({ error: 'Stream non trouvé ou accès refusé' });
    }

    // Vérifier qu'il n'y a qu'un seul goal actif
    const { data: existing } = await supabase
      .from('stream_goals')
      .select('id')
      .eq('stream_id', stream_id)
      .eq('status', 'ACTIVE')
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Un goal actif existe déjà pour ce stream' });
    }

    // Vérifier minimum plateforme
    const minAmount = await configService.get('stream_goal_min_amount_xcon', 1000);
    if (target_amount_xcon < minAmount) {
      return res.status(400).json({ error: `Montant minimum: ${minAmount} XAF` });
    }

    // Créer le goal
    const { data: goal, error } = await supabase
      .from('stream_goals')
      .insert({
        id: uuidv4(),
        stream_id,
        creator_id: creatorId,
        title: String(title).slice(0, 300),
        target_amount_xcon,
        current_amount_xcon: 0,
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ ok: true, goal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /stream-goals/:id — modifier un goal ──────────────
router.patch('/:id', async (req, res) => {
  try {
    const { title, target_amount_xcon } = req.body;
    const goalId = req.params.id;
    const creatorId = req.user.id;

    // Récupérer le goal
    const { data: goal } = await supabase
      .from('stream_goals')
      .select('*')
      .eq('id', goalId)
      .eq('creator_id', creatorId)
      .single();

    if (!goal) {
      return res.status(404).json({ error: 'Goal non trouvé' });
    }

    // Vérifier que le goal n'a pas reçu de tips
    if (!goal.can_edit) {
      return res.status(403).json({ error: 'Impossible de modifier : le goal a reçu des tips' });
    }

    const minAmount = await configService.get('stream_goal_min_amount_xcon', 1000);
    if (target_amount_xcon && target_amount_xcon < minAmount) {
      return res.status(400).json({ error: `Montant minimum: ${minAmount} XAF` });
    }

    // Mettre à jour
    const { data: updated, error } = await supabase
      .from('stream_goals')
      .update({
        title: title ? String(title).slice(0, 300) : goal.title,
        target_amount_xcon: target_amount_xcon || goal.target_amount_xcon,
      })
      .eq('id', goalId)
      .select()
      .single();

    if (error) throw error;

    res.json({ ok: true, goal: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /stream-goals/:id — supprimer un goal ────────────
router.delete('/:id', async (req, res) => {
  try {
    const goalId = req.params.id;
    const creatorId = req.user.id;

    const { data: goal } = await supabase
      .from('stream_goals')
      .select('*')
      .eq('id', goalId)
      .eq('creator_id', creatorId)
      .single();

    if (!goal) {
      return res.status(404).json({ error: 'Goal non trouvé' });
    }

    // Vérifier 0 tips
    if (!goal.can_delete) {
      return res.status(403).json({ error: 'Impossible de supprimer : le goal a reçu des tips' });
    }

    await supabase
      .from('stream_goals')
      .update({ status: 'CANCELLED' })
      .eq('id', goalId);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /stream-goals/:streamId — récupérer goal actif d'un stream
router.get('/stream/:streamId', async (req, res) => {
  try {
    const { data: goal } = await supabase
      .from('stream_goals')
      .select('*')
      .eq('stream_id', req.params.streamId)
      .eq('status', 'ACTIVE')
      .single();

    res.json({ goal: goal || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /stream-goals/:id/tip — ajouter tip vers un goal ────
router.post('/:id/tip', async (req, res) => {
  try {
    const { amount_xcon } = req.body;
    const goalId = req.params.id;
    const fanId = req.user.id;

    if (!amount_xcon || amount_xcon <= 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    // Récupérer le goal
    const { data: goal } = await supabase
      .from('stream_goals')
      .select('*')
      .eq('id', goalId)
      .eq('status', 'ACTIVE')
      .single();

    if (!goal) {
      return res.status(404).json({ error: 'Goal non actif' });
    }

    // Insérer dans ledger
    const ledgerId = uuidv4();
    await supabase
      .from('stream_ledger')
      .insert({
        id: ledgerId,
        stream_id: goal.stream_id,
        fan_id: fanId,
        amount_xcon,
        transaction_type: 'GOAL_TIP',
        goal_id: goalId,
        status: 'PENDING',
      });

    // Mettre à jour le goal current_amount
    const newCurrent = Math.min(goal.current_amount_xcon + amount_xcon, goal.target_amount_xcon);
    const isCompleted = newCurrent >= goal.target_amount_xcon;

    await supabase
      .from('stream_goals')
      .update({
        current_amount_xcon: newCurrent,
        status: isCompleted ? 'COMPLETED' : 'ACTIVE',
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('id', goalId);

    // Locker l'édition si c'est le premier tip
    if (goal.current_amount_xcon === 0) {
      await supabase
        .from('stream_goals')
        .update({ can_edit: false, can_delete: false })
        .eq('id', goalId);
    }

    res.json({
      ok: true,
      goal_id: goalId,
      new_current: newCurrent,
      target: goal.target_amount_xcon,
      completed: isCompleted,
      percentage: Math.floor((newCurrent / goal.target_amount_xcon) * 100),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
