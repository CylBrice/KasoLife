// ============================================================
// KASOLIFE — Stream Cleanup Service
// Nettoie les données éphémères à la fin d'un live stream.
// Conserve : transactions, tips history, achats.
// Supprime : messages chat, queue Redis.
// ============================================================
'use strict';

const redis = require('../config/redis');
const supabase = require('../config/supabase');

// ── Nettoie tous les résidus d'un stream terminé ─────────────────
const cleanupStream = async (streamId) => {
  try {
    console.log(`[StreamCleanup] Nettoyage du stream ${streamId}`);

    // 1. Supprimer messages chat (données éphémères)
    await supabase
      .from('live_stream_messages')
      .delete()
      .eq('stream_id', streamId);

    // 2. Vider queue Redis pour ce stream
    const queueKey = `toy_queue:${streamId}`;
    await redis.del(queueKey);

    // 3. Marquer session jouet comme terminée
    await supabase
      .from('toy_sessions')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('live_stream_id', streamId);

    // 4. Marquer toy_tip_queue comme CANCELLED (toutes les entrées en attente)
    await supabase
      .from('toy_tip_queue')
      .update({ status: 'CANCELLED', error_message: 'Stream terminé' })
      .eq('live_stream_id', streamId)
      .eq('status', 'PENDING');

    // NOTE: Données conservées intentionnellement:
    // - toy_tip_history (audit trail)
    // - tips table (historique)
    // - transactions (pour le dashboard créateur)
    // - live_stream_purchases (pour l'accès PPV)

    console.log(`[StreamCleanup] Stream ${streamId} nettoyé avec succès`);
    return true;
  } catch (err) {
    console.error(`[StreamCleanup] Erreur nettoyage stream ${streamId}:`, err.message);
    return false;
  }
};

module.exports = {
  cleanupStream,
};
