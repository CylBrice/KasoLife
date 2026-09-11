// ============================================================
// KASOLIFE — Toy Control (6.x)
// Jouets interactifs avec paliers imposés par plateforme.
// Session stockée en DB (remplace Map mémoire).
// Paliers récupérés depuis DB avec cache Redis.
// Fusion gifts + toy tips.
// ============================================================

const express           = require('express');
const router            = express.Router();
const { Pool }          = require('pg');
const { v4: uuidv4 }    = require('uuid');
const supabase          = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const configService     = require('../services/configService');
const toyConfigService  = require('../services/toyConfigService');
const { sendToUser, broadcast } = require('../services/liveSocket');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.use(authMiddleware);

// ── POST /toy-control/session — créateur active son jouet ─────
router.post('/session', async (req, res) => {
  const creatorId = req.user.id;
  const { live_stream_id } = req.body;

  try {
    const { data: session, error } = await supabase
      .from('toy_sessions')
      .insert({
        creator_id: creatorId,
        live_stream_id: live_stream_id || null,
        is_active: true,
        palier_config_version: 1,
      })
      .select('*')
      .single();

    if (error) throw error;

    const paliers = await toyConfigService.getPaliers();
    res.json({
      ok: true,
      session_id: session.id,
      is_active: true,
      paliers: paliers.map(p => ({ palier: p.palier, min: p.min, max: p.max, duration_s: p.duration_s })),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── DELETE /toy-control/session — créateur désactive ─────────
router.delete('/session', async (req, res) => {
  const creatorId = req.user.id;

  try {
    const { error } = await supabase
      .from('toy_sessions')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('creator_id', creatorId)
      .eq('is_active', true);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /toy-control/session/:creatorId — état public ─────────
router.get('/session/:creatorId', async (req, res) => {
  try {
    const { data: session } = await supabase
      .from('toy_sessions')
      .select('is_active, created_at')
      .eq('creator_id', req.params.creatorId)
      .eq('is_active', true)
      .single();

    if (!session) return res.json({ active: false });

    const paliers = await toyConfigService.getPaliers();
    res.json({
      active: true,
      paliers: paliers.map(p => ({ palier: p.palier, min: p.min, max: p.max })),
    });
  } catch (err) {
    res.json({ active: false });
  }
});

// ── POST /toy-control/tip — fan envoie un tip → vibration + broadcast
router.post('/tip', async (req, res) => {
  const { creator_id, amount_xcon, live_stream_id } = req.body;
  const fanId = req.user.id;

  if (!creator_id || !amount_xcon) {
    return res.status(400).json({ error: 'creator_id et amount_xcon requis' });
  }

  try {
    // Vérifier que le jouet est actif
    const { data: toySession, error: sessionErr } = await supabase
      .from('toy_sessions')
      .select('id, is_active')
      .eq('creator_id', creator_id)
      .eq('is_active', true)
      .single();

    if (sessionErr || !toySession) {
      return res.status(400).json({ error: 'Jouet non actif pour ce créateur' });
    }

    // Récupérer le palier
    const palier = await toyConfigService.getPalierForAmount(amount_xcon);
    if (!palier) {
      return res.status(400).json({ error: 'Montant hors plage acceptée' });
    }

    // Récupérer le stream si live_stream_id fourni
    let stream = null;
    if (live_stream_id) {
      const { data: s } = await supabase
        .from('live_streams')
        .select('id, creator_id')
        .eq('id', live_stream_id)
        .single();
      stream = s;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Vérifier solde fan
      const { rows: [wallet] } = await client.query(
        'SELECT balance_xcon FROM wallets WHERE user_id = $1',
        [fanId]
      );
      if (!wallet || wallet.balance_xcon < amount_xcon) {
        throw new Error('Solde insuffisant');
      }

      // Insérer dans stream_ledger (paiement finalisé à la fin du stream)
      const ledgerId = uuidv4();
      await client.query(
        `INSERT INTO stream_ledger (id, stream_id, fan_id, amount_xcon, transaction_type, goal_id, status)
         VALUES ($1, $2, $3, $4, 'TIP', NULL, 'PENDING')`,
        [ledgerId, live_stream_id, fanId, amount_xcon]
      );

      // Enregistrer en tips table (pour historique fan)
      await client.query(
        `INSERT INTO tips (id, sender_id, receiver_id, live_stream_id, amount_xcon, commission_xcon)
         VALUES ($1, $2, $3, $4, $5, 0)`,
        [uuidv4(), fanId, creator_id, live_stream_id || null, amount_xcon]
      );

      // Enregistrer en toy_tip_history (audit trail)
      await client.query(
        `INSERT INTO toy_tip_history (id, live_stream_id, creator_id, fan_id, amount_xcon, palier_id,
                                       duration_seconds, intensity_sent, commission_xcon, creator_net_xcon, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'SENT')`,
        [
          uuidv4(),
          live_stream_id || null,
          creator_id,
          fanId,
          amount_xcon,
          palier.palier,
          palier.duration_s,
          Math.round((palier.intensity_min + palier.intensity_max) / 2),
          0, // Commission calculée à la finalisation
          0, // Net calculé à la finalisation
        ]
      );

      // Enregistrer en toy_tip_queue (métadonnées)
      if (live_stream_id && stream) {
        await client.query(
          `INSERT INTO toy_tip_queue (id, live_stream_id, creator_id, fan_id, amount_xcon, palier_id,
                                       duration_seconds, intensity_min, intensity_max, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')`,
          [uuidv4(), live_stream_id, creator_id, fanId, amount_xcon, palier.palier,
           palier.duration_s, palier.intensity_min, palier.intensity_max]
        );
      }

      await client.query('COMMIT');

      // Calculer intensité au hasard dans la plage du palier
      const intensity = Math.floor(
        palier.intensity_min + Math.random() * (palier.intensity_max - palier.intensity_min)
      );

      // Broadcast GIFT_RECEIVED à tous les viewers
      if (live_stream_id && stream) {
        broadcast(live_stream_id, {
          type: 'GIFT_RECEIVED',
          pseudo: (await supabase.from('users').select('pseudo').eq('id', fanId).single()).data?.pseudo || 'Anonyme',
          amount_xcon,
          ts: Date.now(),
        });
      }

      // Unicast TOY_VIBRATE au créateur
      sendToUser(creator_id, {
        type: 'TOY_VIBRATE',
        intensity,
        duration_seconds: palier.duration_s,
        palier_id: palier.palier,
        fan_id: fanId,
        amount_xcon,
      });

      res.json({
        ok: true,
        palier: palier.palier,
        intensity,
        duration_seconds: palier.duration_s,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: e.message });
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
