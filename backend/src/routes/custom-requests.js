// ============================================================
// KASOLIFE — Custom Requests
// Fan → propose + paye d'avance
// Créateur → accepte / contre-propose / refuse / livre
// Fan → confirme livraison → créateur payé
// Litige → résolution admin manuelle uniquement
// ============================================================

const express        = require('express');
const router         = express.Router();
const { Pool }       = require('pg');
const { authMiddleware, requireMinRole } = require('../middleware/auth');
const configService  = require('../services/configService');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.use(authMiddleware);

// ── Helpers ──────────────────────────────────────────────────
const getConfig = async () => ({
  minPrice:      await configService.get('custom_request_min_price_xcon', 1000),
  maxPrice:      await configService.get('custom_request_max_price_xcon', 500000),
  expiryDays:    await configService.get('custom_request_expiry_days', 7),
  autoConfirmH:  await configService.get('custom_request_auto_confirm_hours', 72),
});

const fetchRequest = async (client, id) => {
  const { rows } = await client.query(
    `SELECT cr.*,
       f.pseudo AS fan_pseudo, f.avatar_url AS fan_avatar,
       c.pseudo AS creator_pseudo, c.display_name AS creator_display_name,
       c.avatar_url AS creator_avatar,
       (SELECT row_to_json(d) FROM custom_request_deliveries d
        WHERE d.request_id = cr.id ORDER BY d.delivered_at DESC LIMIT 1) AS delivery
     FROM custom_requests cr
     JOIN users f ON f.id = cr.fan_id
     JOIN users c ON c.id = cr.creator_id
     WHERE cr.id = $1`,
    [id]
  );
  return rows[0] || null;
};

// ── GET /custom-requests/config ───────────────────────────────
router.get('/config', async (req, res) => {
  try {
    res.json(await getConfig());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /custom-requests — fan crée une demande ──────────────
router.post('/', async (req, res) => {
  const { creator_id, description, budget_xcon } = req.body;
  const fanId = req.user.id;

  if (!creator_id || !description?.trim() || !budget_xcon) {
    return res.status(400).json({ error: 'creator_id, description et budget_xcon requis' });
  }
  if (fanId === creator_id) return res.status(400).json({ error: 'Impossible d\'envoyer à soi-même' });

  const cfg = await getConfig();
  if (budget_xcon < cfg.minPrice || budget_xcon > cfg.maxPrice) {
    return res.status(400).json({ error: `Budget entre ${cfg.minPrice} et ${cfg.maxPrice} XAF` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Vérifier que le créateur existe et est bien créateur
    const { rows: [creator] } = await client.query(
      `SELECT id FROM users WHERE id = $1 AND role IN ('influencer','admin','super_admin','root_admin')`,
      [creator_id]
    );
    if (!creator) return res.status(404).json({ error: 'Créateur introuvable' });

    // Débiter le wallet du fan
    const { rows: [wallet] } = await client.query(
      'SELECT debit_wallet($1, $2, $3, $4, $5) AS ok',
      [fanId, budget_xcon, 'CUSTOM_REQUEST', `Demande contenu personnalisé créateur`, null]
    );
    if (!wallet?.ok) throw new Error('Solde insuffisant');

    const expiresAt = new Date(Date.now() + cfg.expiryDays * 86400000);
    const { rows: [request] } = await client.query(
      `INSERT INTO custom_requests
         (fan_id, creator_id, description, budget_xcon, agreed_price_xcon, expires_at)
       VALUES ($1, $2, $3, $4, $4, $5)
       RETURNING id`,
      [fanId, creator_id, description.trim(), budget_xcon, expiresAt]
    );

    await client.query('COMMIT');
    res.status(201).json({ request: { id: request.id } });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ── GET /custom-requests/my — liste fan ──────────────────────
router.get('/my', async (req, res) => {
  const { page = 1, status } = req.query;
  const limit = 20;
  const offset = (page - 1) * limit;
  const fanId = req.user.id;

  let where = 'cr.fan_id = $1';
  const params = [fanId];
  if (status) { params.push(status); where += ` AND cr.status = $${params.length}`; }

  try {
    const { rows } = await pool.query(
      `SELECT cr.*,
         c.pseudo AS creator_pseudo, c.display_name AS creator_display_name,
         c.avatar_url AS creator_avatar,
         (SELECT row_to_json(d) FROM custom_request_deliveries d
          WHERE d.request_id = cr.id ORDER BY d.delivered_at DESC LIMIT 1) AS delivery
       FROM custom_requests cr
       JOIN users c ON c.id = cr.creator_id
       WHERE ${where}
       ORDER BY cr.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ requests: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /custom-requests/incoming — liste créateur ────────────
router.get('/incoming', async (req, res) => {
  const { page = 1, status } = req.query;
  const limit = 20;
  const offset = (page - 1) * limit;
  const creatorId = req.user.id;

  let where = 'cr.creator_id = $1';
  const params = [creatorId];
  if (status) { params.push(status); where += ` AND cr.status = $${params.length}`; }

  try {
    const { rows } = await pool.query(
      `SELECT cr.*,
         f.pseudo AS fan_pseudo, f.avatar_url AS fan_avatar
       FROM custom_requests cr
       JOIN users f ON f.id = cr.fan_id
       WHERE ${where}
       ORDER BY cr.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ requests: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /custom-requests/:id ──────────────────────────────────
router.get('/:id', async (req, res) => {
  const userId = req.user.id;
  const client = await pool.connect();
  try {
    const request = await fetchRequest(client, req.params.id);
    if (!request) return res.status(404).json({ error: 'Introuvable' });
    if (request.fan_id !== userId && request.creator_id !== userId && !req.isAdminAccess) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    res.json(request);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ── POST /custom-requests/:id/counter — créateur contre-propose
router.post('/:id/counter', async (req, res) => {
  const { counter_price_xcon } = req.body;
  const creatorId = req.user.id;

  if (!counter_price_xcon || counter_price_xcon <= 0) {
    return res.status(400).json({ error: 'counter_price_xcon requis et > 0' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [req_] } = await client.query(
      `UPDATE custom_requests SET status = 'COUNTER_PROPOSED',
         counter_price_xcon = $1, updated_at = NOW()
       WHERE id = $2 AND creator_id = $3 AND status = 'PENDING'
       RETURNING id, fan_id, budget_xcon`,
      [counter_price_xcon, req.params.id, creatorId]
    );
    if (!req_) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Demande introuvable ou déjà traitée' }); }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ── POST /custom-requests/:id/accept-counter — fan accepte contre-offre
router.post('/:id/accept-counter', async (req, res) => {
  const fanId = req.user.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [req_] } = await client.query(
      `SELECT * FROM custom_requests
       WHERE id = $1 AND fan_id = $2 AND status = 'COUNTER_PROPOSED'`,
      [req.params.id, fanId]
    );
    if (!req_) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Introuvable' }); }

    const diff = req_.counter_price_xcon - req_.budget_xcon;
    if (diff > 0) {
      // Fan doit payer la différence
      const { rows: [w] } = await client.query(
        'SELECT debit_wallet($1, $2, $3, $4, $5) AS ok',
        [fanId, diff, 'CUSTOM_REQUEST', 'Supplément contre-offre custom request', null]
      );
      if (!w?.ok) throw new Error('Solde insuffisant pour le supplément');
    }
    // Si counter < budget : la différence reste créditée plus tard (simplification)

    await client.query(
      `UPDATE custom_requests SET status = 'ACCEPTED',
         agreed_price_xcon = counter_price_xcon, updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ── POST /custom-requests/:id/accept — créateur accepte au prix fan
router.post('/:id/accept', async (req, res) => {
  const creatorId = req.user.id;
  try {
    const { rows: [r] } = await pool.query(
      `UPDATE custom_requests
       SET status = 'ACCEPTED', updated_at = NOW()
       WHERE id = $1 AND creator_id = $2 AND status IN ('PENDING','COUNTER_PROPOSED')
       RETURNING id`,
      [req.params.id, creatorId]
    );
    if (!r) return res.status(404).json({ error: 'Introuvable ou déjà traitée' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /custom-requests/:id/reject — créateur refuse + remboursement fan
router.post('/:id/reject', async (req, res) => {
  const { reason } = req.body;
  const creatorId = req.user.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [req_] } = await client.query(
      `UPDATE custom_requests SET status = 'REJECTED',
         rejection_reason = $1, updated_at = NOW()
       WHERE id = $2 AND creator_id = $3 AND status IN ('PENDING','COUNTER_PROPOSED','ACCEPTED')
       RETURNING fan_id, budget_xcon`,
      [reason || null, req.params.id, creatorId]
    );
    if (!req_) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Introuvable' }); }

    // Rembourser le fan
    await client.query(
      'SELECT credit_wallet($1, $2, $3, $4, $5)',
      [req_.fan_id, req_.budget_xcon, 'REFUND', 'Remboursement custom request refusée', null]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ── POST /custom-requests/:id/cancel — fan annule avant ACCEPTED
router.post('/:id/cancel', async (req, res) => {
  const fanId = req.user.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [req_] } = await client.query(
      `UPDATE custom_requests SET status = 'CANCELLED', updated_at = NOW()
       WHERE id = $1 AND fan_id = $2 AND status IN ('PENDING','COUNTER_PROPOSED')
       RETURNING budget_xcon`,
      [req.params.id, fanId]
    );
    if (!req_) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Impossible d\'annuler' }); }

    await client.query(
      'SELECT credit_wallet($1, $2, $3, $4, $5)',
      [fanId, req_.budget_xcon, 'REFUND', 'Annulation custom request', null]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ── POST /custom-requests/:id/deliver — créateur livre le contenu
router.post('/:id/deliver', async (req, res) => {
  const { media_url, thumbnail_url, message } = req.body;
  const creatorId = req.user.id;
  if (!media_url) return res.status(400).json({ error: 'media_url requis' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cfg = await getConfig();
    const autoConfirmAt = new Date(Date.now() + cfg.autoConfirmH * 3600000);

    const { rows: [req_] } = await client.query(
      `UPDATE custom_requests
       SET status = 'DELIVERED', delivered_at = NOW(),
           auto_confirm_at = $1, updated_at = NOW()
       WHERE id = $2 AND creator_id = $3 AND status IN ('ACCEPTED','IN_PROGRESS')
       RETURNING id`,
      [autoConfirmAt, req.params.id, creatorId]
    );
    if (!req_) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Introuvable' }); }

    await client.query(
      `INSERT INTO custom_request_deliveries (request_id, media_url, thumbnail_url, message)
       VALUES ($1, $2, $3, $4)`,
      [req_.id, media_url, thumbnail_url || null, message || null]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ── POST /custom-requests/:id/confirm — fan confirme + paiement créateur
router.post('/:id/confirm', async (req, res) => {
  const fanId = req.user.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [req_] } = await client.query(
      `UPDATE custom_requests
       SET status = 'CONFIRMED', confirmed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND fan_id = $2 AND status = 'DELIVERED'
       RETURNING creator_id, agreed_price_xcon`,
      [req.params.id, fanId]
    );
    if (!req_) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Introuvable' }); }

    // Calcul commission
    const commissionRate = await configService.get('commission_rate', 0.20);
    const commission = Math.floor(req_.agreed_price_xcon * commissionRate);
    const creatorNet = req_.agreed_price_xcon - commission;

    await client.query(
      'SELECT credit_pending_balance($1, $2, $3, $4, $5)',
      [req_.creator_id, creatorNet, 'CUSTOM_REQUEST', 'Custom request confirmée par fan', null]
    );

    await client.query(
      `INSERT INTO platform_revenue (source, amount_xcon, reference_id, created_at)
       VALUES ('custom_request', $1, $2, NOW())`,
      [commission, req.params.id]
    );

    await client.query(
      `UPDATE custom_requests SET commission_xcon = $1 WHERE id = $2`,
      [commission, req.params.id]
    );

    await client.query('COMMIT');
    res.json({ ok: true, creator_net: creatorNet, commission });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ── POST /custom-requests/:id/dispute — ouvrir un litige
router.post('/:id/dispute', async (req, res) => {
  const { reason } = req.body;
  const userId = req.user.id;
  if (!reason?.trim()) return res.status(400).json({ error: 'Motif requis' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [req_] } = await client.query(
      `SELECT id, fan_id, creator_id, status FROM custom_requests WHERE id = $1`,
      [req.params.id]
    );
    if (!req_) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Introuvable' }); }
    if (req_.fan_id !== userId && req_.creator_id !== userId) {
      await client.query('ROLLBACK'); return res.status(403).json({ error: 'Accès refusé' });
    }
    if (!['ACCEPTED','IN_PROGRESS','DELIVERED'].includes(req_.status)) {
      await client.query('ROLLBACK'); return res.status(400).json({ error: 'Litige impossible dans ce statut' });
    }

    const disputedBy = req_.fan_id === userId ? 'fan' : 'creator';
    await client.query(
      `UPDATE custom_requests SET status = 'DISPUTED',
         dispute_reason = $1, disputed_by = $2, updated_at = NOW()
       WHERE id = $3`,
      [reason.trim(), disputedBy, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ── Admin : GET /custom-requests/admin/disputes ───────────────
router.get('/admin/disputes', requireMinRole('admin'), async (req, res) => {
  const { page = 1 } = req.query;
  const limit = 20;
  const offset = (page - 1) * limit;
  try {
    const { rows } = await pool.query(
      `SELECT cr.*,
         f.pseudo AS fan_pseudo, c.pseudo AS creator_pseudo
       FROM custom_requests cr
       JOIN users f ON f.id = cr.fan_id
       JOIN users c ON c.id = cr.creator_id
       WHERE cr.status = 'DISPUTED'
       ORDER BY cr.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ disputes: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin : POST /custom-requests/admin/:id/resolve ───────────
router.post('/admin/:id/resolve', requireMinRole('admin'), async (req, res) => {
  const { resolution, refund_fan } = req.body;
  if (!resolution?.trim()) return res.status(400).json({ error: 'Résolution requise' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [req_] } = await client.query(
      `UPDATE custom_requests
       SET status = $1, admin_resolution = $2,
           resolved_by = $3, resolved_at = NOW(), updated_at = NOW()
       WHERE id = $4 AND status = 'DISPUTED'
       RETURNING fan_id, creator_id, agreed_price_xcon`,
      [refund_fan ? 'REFUNDED' : 'CONFIRMED', resolution.trim(), req.user.id, req.params.id]
    );
    if (!req_) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Introuvable' }); }

    if (refund_fan) {
      await client.query(
        'SELECT credit_wallet($1, $2, $3, $4, $5)',
        [req_.fan_id, req_.agreed_price_xcon, 'REFUND', 'Remboursement litige admin', null]
      );
    } else {
      // Payer le créateur
      const commissionRate = await configService.get('commission_rate', 0.20);
      const commission = Math.floor(req_.agreed_price_xcon * commissionRate);
      await client.query(
        'SELECT credit_pending_balance($1, $2, $3, $4, $5)',
        [req_.creator_id, req_.agreed_price_xcon - commission, 'CUSTOM_REQUEST', 'Résolution litige admin', null]
      );
    }

    // Audit log
    await client.query(
      `INSERT INTO admin_actions (admin_id, action, target_id, details)
       VALUES ($1, 'resolve_dispute', $2, $3)`,
      [req.user.id, req.params.id, JSON.stringify({ resolution, refund_fan })]
    );

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

module.exports = router;
