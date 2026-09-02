// ============================================================
// KASOLIFE — Service Notifications Push V4
// Expo Push uniquement (même architecture que KasoPlex)
// ============================================================
const supabase = require('../config/supabase');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Envoie une notification push à un utilisateur via son expo_push_token
 * Utilise le pseudo pour personnaliser le message si disponible
 */
const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('expo_push_token, pseudo')
      .eq('id', userId)
      .single();

    if (!user?.expo_push_token) return;
    const token = user.expo_push_token;
    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) return;

    // Remplacer [pseudo] dans les messages si présent
    const pseudoName = user.pseudo || 'joueur';
    const finalBody  = body.replace(/\[pseudo\]/g, pseudoName);
    const finalTitle = title.replace(/\[pseudo\]/g, pseudoName);

    const message = {
      to: token,
      sound: 'default',
      title: finalTitle,
      body: finalBody,
      data,
      priority: 'high',
      channelId: 'kasolife',
    };

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    if (result?.data?.status === 'error') {
      console.warn(`Push error for user ${userId}:`, result.data.message);
    }

    // Persister en DB pour l'historique
    await supabase.from('notifications').insert({
      user_id: userId,
      title: finalTitle,
      message: finalBody,
      type: data.type || 'GENERAL',
    }).catch(() => {});

  } catch (err) {
    console.error('sendPushNotification error (non-bloquant):', err.message);
  }
};

/**
 * Envoie à plusieurs utilisateurs en parallèle
 */
const sendPushToMany = async (userIds, title, body, data = {}) => {
  if (!userIds || userIds.length === 0) return;
  await Promise.allSettled(
    userIds.map(uid => sendPushNotification(uid, title, body, data))
  );
};

// ── Notifications maintenance ─────────────────────────────────────────────────

/**
 * BETS_FROZEN — Paris suspendus (icône pause, couleur orange)
 */
const notifyBetsFrozen = async (activeUserIds) => {
  await sendPushToMany(
    activeUserIds,
    '⏸ Paris suspendus',
    'Maintenance en cours. Vos paris actifs sont sécurisés.',
    { type: 'MAINTENANCE_BETS_FROZEN' }
  );
};

/**
 * MAINTENANCE / FORCE — Plateforme indisponible
 */
const notifyMaintenanceStart = async (activeUserIds, isEmergency = false) => {
  if (isEmergency) {
    await sendPushToMany(
      activeUserIds,
      '🔴 Maintenance d\'urgence',
      'Plateforme indisponible. Vos fonds et paris sont sécurisés.',
      { type: 'MAINTENANCE_FORCE' }
    );
  } else {
    await sendPushToMany(
      activeUserIds,
      '🔧 Plateforme en maintenance',
      'Plateforme en maintenance. Vos fonds sont sécurisés.',
      { type: 'MAINTENANCE_START' }
    );
  }
};

/**
 * Notification admin : zéro paris actifs → maintenance possible
 */
const notifyAdminsZeroBets = async (adminIds) => {
  await sendPushToMany(
    adminIds,
    '✅ Maintenance possible',
    'Plus aucun pari actif. Vous pouvez activer la maintenance.',
    { type: 'MAINTENANCE_ZERO_BETS' }
  );
};

/**
 * Reprise de service
 */
const notifyServiceRestored = async (activeUserIds) => {
  await sendPushToMany(
    activeUserIds,
    '🔧 Plateforme rétablie',
    'KasoLife est de nouveau disponible. Bonne chance !',
    { type: 'MAINTENANCE_RESTORED' }
  );
};

module.exports = {
  sendPushNotification,
  sendPushToMany,
  notifyBetsFrozen,
  notifyMaintenanceStart,
  notifyAdminsZeroBets,
  notifyServiceRestored,
};
