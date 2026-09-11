// ============================================================
// KASOLIFE — Stream Finalization Service
// À la fin d'un stream : finalise TOUS les paiements
// Accumule ledger + calcul 80/20 atomique
// ============================================================
'use strict';

const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Finalise tous les paiements d'un stream ──────────────────
const finalizeStreamPayments = async (streamId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Récupérer le créateur et all ledger entries
    const { rows: [stream] } = await client.query(
      'SELECT creator_id FROM live_streams WHERE id = $1',
      [streamId]
    );
    if (!stream) throw new Error('Stream not found');

    const { rows: ledger } = await client.query(
      'SELECT id, fan_id, amount_xcon, goal_id FROM stream_ledger WHERE stream_id = $1 AND status = $2',
      [streamId, 'PENDING']
    );

    if (ledger.length === 0) {
      console.log(`[StreamFinalization] No pending ledger for stream ${streamId}`);
      await client.query('COMMIT');
      return { finalized: false, amount: 0, count: 0 };
    }

    const totalAmount = ledger.reduce((sum, row) => sum + row.amount_xcon, 0);
    const creatorShare = Math.floor(totalAmount * 0.8);
    const platformShare = Math.floor(totalAmount * 0.2);

    // 2. Débiter tous les fans (bulk)
    for (const entry of ledger) {
      await client.query(
        'SELECT debit_wallet($1, $2, $3, $4, $5)',
        [entry.fan_id, entry.amount_xcon, 'STREAM_TIP', 'Stream tip', streamId]
      );
    }

    // 3. Créditer le créateur
    await client.query(
      'SELECT credit_pending_balance($1, $2, $3, $4, $5)',
      [stream.creator_id, creatorShare, 'STREAM_INCOME', 'Stream tips finalization', streamId]
    );

    // 4. Enregistrer platform revenue
    await client.query(
      `INSERT INTO platform_revenue (source, amount_xcon, reference_id, created_at)
       VALUES ('stream_tips', $1, $2, NOW())`,
      [platformShare, streamId]
    );

    // 5. Marquer ledger comme FINALIZED
    const ledgerIds = ledger.map(l => l.id);
    await client.query(
      `UPDATE stream_ledger SET status = 'FINALIZED', finalized_at = NOW()
       WHERE id = ANY($1)`,
      [ledgerIds]
    );

    // 6. Vérifier si un goal a été complété
    const { rows: [goal] } = await client.query(
      `SELECT id FROM stream_goals WHERE stream_id = $1 AND status = 'ACTIVE'
       AND current_amount_xcon >= target_amount_xcon LIMIT 1`,
      [streamId]
    );

    // 7. Log finalization (audit trail)
    await client.query(
      `INSERT INTO stream_finalization_log (stream_id, creator_id, total_amount_xcon, creator_share_xcon,
                                             platform_share_xcon, tip_count, goal_completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [streamId, stream.creator_id, totalAmount, creatorShare, platformShare, ledger.length, !!goal]
    );

    // 8. Transactions DB
    for (const entry of ledger) {
      await client.query(
        `INSERT INTO transactions (id, user_id, type, amount_xcon, balance_after, description, related_user_id)
         VALUES ($1, $2, 'STREAM_TIP_SENT', $3, 0, 'Stream tip finalized', $4)`,
        [uuidv4(), entry.fan_id, -entry.amount_xcon, stream.creator_id]
      );
    }

    await client.query(
      `INSERT INTO transactions (id, user_id, type, amount_xcon, balance_after, description)
       VALUES ($1, $2, 'STREAM_INCOME', $3, 0, 'Stream tips finalized (80% share)')`,
      [uuidv4(), stream.creator_id, creatorShare]
    );

    await client.query('COMMIT');

    console.log(
      `[StreamFinalization] Stream ${streamId}: ${ledger.length} tips, ${totalAmount} XAF total ` +
      `(creator: ${creatorShare}, platform: ${platformShare})`
    );

    return {
      finalized: true,
      streamId,
      totalAmount,
      creatorShare,
      platformShare,
      tipCount: ledger.length,
      goalCompleted: !!goal,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[StreamFinalization] Error finalizing stream ${streamId}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  finalizeStreamPayments,
};
