// ============================================================
// KASOLIFE — Routes /messages/broadcast v1.0
// Mass messaging for creators
// ============================================================
'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /messages/broadcast — créer un broadcast
router.post('/', authMiddleware, requireRole('CREATOR', 'ADMIN'), async (req, res) => {
  try {
    const { title, content, broadcast_type, price_xcon, scheduled_at } = req.body;

    if (!title || !content) return res.status(400).json({ error: 'Title et content requis' });
    if (content.length > 1000) return res.status(400).json({ error: 'Content trop long (max 1000)' });

    const { data: broadcast, error } = await supabase.from('broadcasts').insert({
      id: uuidv4(),
      creator_id: req.user.id,
      title,
      content,
      broadcast_type: broadcast_type || 'FREE',
      price_xcon: (broadcast_type === 'PPV' ? price_xcon : 0) || 0,
      status: scheduled_at ? 'SCHEDULED' : 'DRAFT',
      scheduled_at,
    }).select().single();

    if (error) throw error;
    res.status(201).json(broadcast);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /messages/broadcast — lister mes broadcasts
router.get('/', authMiddleware, requireRole('CREATOR'), async (req, res) => {
  try {
    const { data: broadcasts, error } = await supabase.from('broadcasts')
      .select('id, title, broadcast_type, status, recipient_count, sent_count, created_at')
      .eq('creator_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(broadcasts || []);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /messages/broadcast/:id/send — envoyer un broadcast
router.post('/:id/send', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: broadcast } = await supabase.from('broadcasts').select('creator_id, broadcast_type, status').eq('id', id).single();

    if (!broadcast) return res.status(404).json({ error: 'Broadcast introuvable' });
    if (broadcast.creator_id !== req.user.id) return res.status(403).json({ error: 'Accès refusé' });

    // Get recipients based on type
    let recipients = [];
    if (broadcast.broadcast_type === 'FREE') {
      const { data: subs } = await supabase.from('subscriptions')
        .select('fan_id').eq('creator_id', req.user.id).eq('status', 'ACTIVE');
      recipients = subs?.map(s => s.fan_id) || [];
    } else if (broadcast.broadcast_type === 'SUBSCRIBERS_ONLY') {
      const { data: subs } = await supabase.from('subscriptions')
        .select('fan_id').eq('creator_id', req.user.id).eq('status', 'ACTIVE');
      recipients = subs?.map(s => s.fan_id) || [];
    }

    // Insert recipients
    const recipientRecords = recipients.map(fan_id => ({
      id: uuidv4(),
      broadcast_id: id,
      recipient_id: fan_id,
      status: 'PENDING',
    }));

    if (recipientRecords.length > 0) {
      await supabase.from('broadcast_recipients').insert(recipientRecords);
    }

    // Update broadcast status
    await supabase.from('broadcasts').update({
      status: 'SENT',
      recipient_count: recipients.length,
      sent_count: recipients.length,
      sent_at: new Date().toISOString(),
    }).eq('id', id);

    res.json({ message: `Broadcast envoyé à ${recipients.length} destinataires` });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
