// ============================================================
// KASOLIFE — Toy Control (4.2)
// Créateur connecte son jouet via Intiface/Buttplug.
// Fan envoie un tip → commande vibration envoyée via Socket.IO
// au créateur. Implémentation serveur : session + dispatch.
// ============================================================

const express        = require('express');
const router         = express.Router();
const { Pool }       = require('pg');
const { authMiddleware } = require('../middleware/auth');
const configService  = require('../services/configService');
const { sendToUser } = require('../services/liveSocket');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.use(authMiddleware);

// Registre en mémoire : creatorId → { active, intensity_min, intensity_max }
const toyRegistry = new Map();

// ── POST /toy-control/session — créateur active son jouet ─────
router.post('/session', async (req, res) => {
  const creatorId = req.user.id;
  const {
    intensity_min = 20,   // % vibration minimum (1-100)
    intensity_max = 80,   // % vibration maximum (1-100)
    tip_min_xcon  = 100,  // tip minimum pour déclencher une vibration
    duration_ms   = 3000, // durée vibration par tip (ms)
  } = req.body;

  toyRegistry.set(creatorId, {
    active: true,
    intensity_min,
    intensity_max,
    tip_min_xcon,
    duration_ms,
    started_at: new Date(),
  });

  res.json({ ok: true, session: toyRegistry.get(creatorId) });
});

// ── DELETE /toy-control/session — créateur désactive ─────────
router.delete('/session', async (req, res) => {
  toyRegistry.delete(req.user.id);
  res.json({ ok: true });
});

// ── GET /toy-control/session/:creatorId — état public ─────────
router.get('/session/:creatorId', async (req, res) => {
  const session = toyRegistry.get(req.params.creatorId);
  if (!session) return res.json({ active: false });
  res.json({ active: true, tip_min_xcon: session.tip_min_xcon });
});

// ── POST /toy-control/tip — fan envoie un tip → vibration ─────
router.post('/tip', async (req, res) => {
  const { creator_id, amount_xcon, live_stream_id } = req.body;
  const fanId = req.user.id;

  if (!creator_id || !amount_xcon) {
    return res.status(400).json({ error: 'creator_id et amount_xcon requis' });
  }

  const session = toyRegistry.get(creator_id);
  if (!session?.active) {
    return res.status(400).json({ error: 'Jouet non actif pour ce créateur' });
  }
  if (amount_xcon < session.tip_min_xcon) {
    return res.status(400).json({
      error: `Tip minimum : ${session.tip_min_xcon} XAF pour déclencher une vibration`,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Débiter le fan
    const { rows: [w] } = await client.query(
      'SELECT debit_wallet($1, $2, $3, $4, $5) AS ok',
      [fanId, amount_xcon, 'TIP', `Tip jouet interactif`, live_stream_id || null]
    );
    if (!w?.ok) throw new Error('Solde insuffisant');

    // Commission
    const commissionRate = await configService.get('commission_rate', 0.20);
    const commission = Math.floor(amount_xcon * commissionRate);
    const creatorNet  = amount_xcon - commission;

    await client.query(
      'SELECT credit_pending_balance($1, $2, $3, $4, $5)',
      [creator_id, creatorNet, 'TIP', 'Recette tip jouet interactif', live_stream_id || null]
    );

    await client.query(
      `INSERT INTO platform_revenue (source, amount_xcon, reference_id, created_at)
       VALUES ('tip', $1, $2, NOW())`,
      [commission, fanId]
    );

    // Calcul intensité proportionnelle au montant
    const tipRatio = Math.min(1, (amount_xcon - session.tip_min_xcon) / (session.tip_min_xcon * 9));
    const intensity = Math.floor(
      session.intensity_min + tipRatio * (session.intensity_max - session.intensity_min)
    );

    // Envoyer la commande WebSocket au créateur (connexion live stream active)
    sendToUser(creator_id, {
      type: 'TOY_VIBRATE',
      intensity,
      duration_ms: session.duration_ms,
      fan_id: fanId,
      amount_xcon,
    });

    await client.query('COMMIT');
    res.json({ ok: true, intensity, duration_ms: session.duration_ms });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
