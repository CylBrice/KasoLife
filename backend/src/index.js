// ============================================================
// KASOLIFE — Point d'entrée v1.0
// Adapté depuis KasoLife — crons paris/JTON retirés,
// crons abonnements/contenu ajoutés
// ============================================================
'use strict';

const express     = require('express');
const http        = require('http');
const cors        = require('cors');
const helmet      = require('helmet');
const hpp         = require('hpp');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');
const slowDown    = require('express-slow-down');
const cron        = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const fs   = require('fs');
const path = require('path');
require('dotenv').config();

// ── Système de logs fichiers ──────────────────────────────────────────────────
const LOGS_DIR = path.join(__dirname, '../../logs');
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

const getLogFilePath = () => {
  const now  = new Date();
  const dd   = String(now.getDate()).padStart(2, '0');
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return path.join(LOGS_DIR, `log_${dd}-${mm}-${yyyy}.txt`);
};

const writeLog = (level, context, message, extra = '') => {
  try {
    const now      = new Date().toISOString();
    const extraStr = extra ? ` | ${extra}` : '';
    const line     = `[${now}] [${level}] [${context}] ${message}${extraStr}\n`;
    fs.appendFileSync(getLogFilePath(), line, 'utf8');
  } catch { /* ne jamais bloquer sur une erreur de log */ }
};

const logger = {
  error: (ctx, msg, extra) => { console.error(`[${ctx}]`, msg); writeLog('ERROR', ctx, msg, extra); },
  warn:  (ctx, msg, extra) => { console.warn(`[${ctx}]`, msg);  writeLog('WARN',  ctx, msg, extra); },
  info:  (ctx, msg, extra) => { console.info(`[${ctx}]`, msg);  writeLog('INFO',  ctx, msg, extra); },
  crit:  (ctx, msg, extra) => { console.error(`[CRIT][${ctx}]`, msg); writeLog('CRITICAL', ctx, msg, extra); },
};

let Sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'production' });
    logger.info('SENTRY', 'Sentry initialisé');
  } catch (e) { logger.warn('SENTRY', "Impossible d'initialiser Sentry", e.message); }
}

const captureError = (ctx, err) => {
  logger.error(ctx, err.message, err.stack?.split('\n')[1]?.trim());
  if (Sentry) Sentry.captureException(err, { tags: { context: ctx } });
};

const supabase = require('./config/supabase');
const { sendPushNotification } = require('./services/notifications');

// ── Routers ───────────────────────────────────────────────────────────────────
const authRouter         = require('./routes/auth');
const walletRouter        = require('./routes/wallet');
const creatorsRouter      = require('./routes/creators');
const postsRouter         = require('./routes/posts');
const storiesRouter       = require('./routes/stories');
const subscriptionsRouter = require('./routes/subscriptions');
const messagesRouter      = require('./routes/messages');
const payoutsRouter       = require('./routes/payouts');
const adminRouter         = require('./routes/admin');
const uploadsRouter       = require('./routes/uploads');
const mediaRouter         = require('./routes/media');
const albumsRouter        = require('./routes/albums');
const purchasesRouter     = require('./routes/purchases');
const privateChatRouter   = require('./routes/private-chat');
const privateShowsRouter  = require('./routes/private-shows');
const vipShowsRouter      = require('./routes/vip-shows');
const snapshotsRouter        = require('./routes/snapshots');
const customRequestsRouter   = require('./routes/custom-requests');
const toyControlRouter       = require('./routes/toy-control');
const streamGoalsRouter      = require('./routes/stream-goals');
const webhookRouter          = require('./routes/webhook');
const referralRouter      = require('./routes/referral');
const supportRouter       = require('./routes/support');
const configRouter        = require('./routes/config');
const kycRouter           = require('./routes/kyc');
const docsRouter          = require('./routes/docs');
const promoCodesRouter    = require('./routes/promo-codes');
const broadcastsRouter    = require('./routes/broadcasts');
const analyticsRouter     = require('./routes/analytics');
const liveRouter          = require('./routes/live');
const { attachLiveSocket } = require('./services/liveSocket');

const app  = express();
const PORT = process.env.PORT || 3003;

// Derrière nginx reverse proxy — nécessaire pour express-rate-limit et les IPs réelles
app.set('trust proxy', 1);

// ── Sécurité ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(hpp());
// Compression agressive (niveau 9, tous les types)
app.use(compression({
  level: 9,
  threshold: 1024,  // Compresser seulement > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3004').split(',').filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS origin refusé'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Rate limiting global ──────────────────────────────────────────────────────
const globalLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      300,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Trop de requêtes — réessayez dans 15 minutes' },
});
const slowLimiter = slowDown({
  windowMs:   15 * 60 * 1000,
  delayAfter: 200,
  delayMs:    (used) => (used - 200) * 100,
});
app.use(globalLimit);
app.use(slowLimiter);

// ── Santé ─────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Statut maintenance (public) ───────────────────────────────────────────────
app.get('/maintenance/status', async (req, res) => {
  try {
    const { data } = await supabase.from('platform_maintenance')
      .select('status').order('updated_at', { ascending: false }).limit(1).single();
    res.json({ status: data?.status || 'ACTIF' });
  } catch { res.json({ status: 'ACTIF' }); }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth',         authRouter);
app.use('/wallet',        walletRouter);
app.use('/creators',      creatorsRouter);
app.use('/posts',         postsRouter);
app.use('/stories',       storiesRouter);
app.use('/subscriptions', subscriptionsRouter);
app.use('/messages',      messagesRouter);
app.use('/payouts',       payoutsRouter);
app.use('/admin',         adminRouter);
app.use('/uploads',       uploadsRouter);
app.use('/media',         mediaRouter);
app.use('/albums',        albumsRouter);
app.use('/purchases',     purchasesRouter);
app.use('/private-chat',  privateChatRouter);
app.use('/private-shows', privateShowsRouter);
app.use('/vip-shows',     vipShowsRouter);
app.use('/snapshots',        snapshotsRouter);
app.use('/custom-requests',  customRequestsRouter);
app.use('/toy-control',      toyControlRouter);
app.use('/stream-goals',     streamGoalsRouter);
app.use('/webhook',          webhookRouter);
app.use('/referral',      referralRouter);
app.use('/support',       supportRouter);
app.use('/config',        configRouter);
app.use('/kyc',           kycRouter);
app.use('/docs',          docsRouter);
app.use('/promo-codes',   promoCodesRouter);
app.use('/messages/broadcast', broadcastsRouter);
app.use('/creators/me/analytics', analyticsRouter);
app.use('/live',          liveRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route introuvable' }));

// ── Erreur globale ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  logger.crit('HTTP', `${req.method} ${req.path} — ${err.message}`, err.stack?.split('\n')[1]?.trim());
  if (Sentry) Sentry.captureException(err, { tags: { path: req.path, method: req.method } });
  res.status(500).json({ error: 'Erreur interne', message: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

// ── Helper push SUPERADMIN pour alertes proactives ────────────────────────────
const notifySuperAdminAlert = async (title, body, data = {}) => {
  try {
    const { data: admins } = await supabase.from('users')
      .select('id').in('role', ['super_admin', 'root_admin']).eq('is_active', true);
    await Promise.all((admins || []).map(a =>
      sendPushNotification(a.id, title, body, data).catch(() => {})
    ));
  } catch { /* ne jamais bloquer sur une alerte */ }
};


// ============================================================
// CRON A — Opérations temps réel (toutes les 5 minutes)
// • Publication des posts programmés (tolérance ±5 min acceptable)
// • Réconciliation des directs LiveKit orphelins
// ============================================================
const SUBSCRIPTION_PERIOD_DAYS = 30;
cron.schedule('*/5 * * * *', async () => {
  const now = new Date().toISOString();

  // ── A1 : Posts programmés ──────────────────────────────────
  try {
    const { data: scheduled } = await supabase.from('posts')
      .select('id').eq('is_published', false)
      .not('scheduled_at', 'is', null)
      .lte('scheduled_at', now);

    if (scheduled && scheduled.length > 0) {
      for (const post of scheduled) {
        await supabase.from('posts').update({ is_published: true, updated_at: now }).eq('id', post.id);
      }
      logger.info('CRON-A', `${scheduled.length} post(s) programmé(s) publié(s)`);
    }
  } catch (e) { captureError('CRON-A-POSTS', e); }

  // ── A2 : Directs LiveKit orphelins ─────────────────────────
  try {
    const { data: liveRows } = await supabase.from('live_streams')
      .select('id, room_name').eq('status', 'LIVE');
    if (liveRows && liveRows.length > 0) {
      const { listActiveRooms } = require('./services/livekit');
      const activeRooms = await listActiveRooms();
      const activeNames = new Set((activeRooms || []).map((r) => r.name));
      let closed = 0;
      for (const row of liveRows) {
        if (!activeNames.has(row.room_name)) {
          await supabase.from('live_streams')
            .update({ status: 'ENDED', ended_at: now }).eq('id', row.id);
          closed++;
        }
      }
      if (closed > 0) logger.info('CRON-A', `${closed} direct(s) orphelin(s) clôturé(s)`);
    }
  } catch (e) { captureError('CRON-A-LIVE', e); }
});


// ============================================================
// CRON B — Opérations horaires (toutes les heures)
// • Renouvellement automatique des abonnements
// • Surveillance de solvabilité
// • Détection de fraude (heures paires seulement = toutes les 2h)
// ============================================================
cron.schedule('0 * * * *', async () => {
  const now = new Date().toISOString();
  const hour = new Date().getUTCHours();

  // ── B1 : Renouvellement des abonnements ────────────────────
  try {
    const configService = require('./services/configService');
    const subscriptionRate = await configService.getCommissionRate('subscription');
    const { data: dueSubs } = await supabase.from('subscriptions')
      .select('id, fan_id, creator_id, price_xcon')
      .eq('status', 'ACTIVE').eq('auto_renew', true)
      .lte('current_period_end', now);

    for (const sub of dueSubs || []) {
      try {
        const price = sub.price_xcon;
        const commission = Math.round(price * subscriptionRate);
        const creatorShare = price - commission;
        const { data: newBalance, error: debitErr } = await supabase.rpc('debit_wallet', {
          p_user_id: sub.fan_id, p_amount: price,
        });
        if (debitErr) {
          await supabase.from('subscriptions').update({ status: 'PAST_DUE', updated_at: now }).eq('id', sub.id);
          await supabase.from('notifications').insert({
            id: uuidv4(), user_id: sub.fan_id, title: 'Abonnement en pause',
            message: "Votre abonnement n'a pas pu être renouvelé (solde insuffisant). Rechargez votre wallet pour le réactiver.",
            type: 'SUBSCRIPTION_PAST_DUE',
          });
          continue;
        }
        const newPeriodEnd = new Date(Date.now() + SUBSCRIPTION_PERIOD_DAYS * 24 * 3600000).toISOString();
        await supabase.from('subscriptions').update({ current_period_end: newPeriodEnd, updated_at: now }).eq('id', sub.id);
        await supabase.rpc('credit_pending_balance', { p_user_id: sub.creator_id, p_amount: creatorShare });
        await supabase.from('transactions').insert([
          { id: uuidv4(), user_id: sub.fan_id, type: 'SUBSCRIPTION_PAYMENT', amount_xcon: -price, balance_after: newBalance, description: 'Renouvellement abonnement', related_user_id: sub.creator_id },
          { id: uuidv4(), user_id: sub.creator_id, type: 'SUBSCRIPTION_INCOME', amount_xcon: creatorShare, balance_after: 0, description: 'Renouvellement abonné', related_user_id: sub.fan_id },
        ]);
        await supabase.from('platform_revenue').insert({
          id: uuidv4(), source_type: 'COMMISSION_ABONNEMENT', amount_xcon: commission,
          reference_id: sub.id, user_id: sub.creator_id,
        });
      } catch (e) { captureError('CRON-B-SUB-ITEM', e); }
    }
    if ((dueSubs || []).length > 0) logger.info('CRON-B', `${dueSubs.length} abonnement(s) renouvelé(s)`);
  } catch (e) { captureError('CRON-B-SUBS', e); }

  // ── B2 : Surveillance solvabilité ─────────────────────────
  try {
    const { data: wallets } = await supabase.from('wallets').select('balance_xcon, pending_balance_xcon, total_deposited');
    const totalBalances  = (wallets || []).reduce((s, w) => s + (w.balance_xcon || 0) + (w.pending_balance_xcon || 0), 0);
    const totalDeposited = (wallets || []).reduce((s, w) => s + (w.total_deposited || 0), 0);
    const solvencyRatio  = totalBalances > 0 ? Math.round((totalDeposited / totalBalances) * 100) : 100;
    const { data: solvRed } = await supabase.from('platform_config').select('value').eq('key', 'SOLVENCY_RED').single();
    const threshold = solvRed ? Number(solvRed.value) : 90;
    if (solvencyRatio < threshold) {
      logger.crit('SOLVENCY', `Ratio solvabilité CRITIQUE : ${solvencyRatio}% (seuil: ${threshold}%)`);
      await notifySuperAdminAlert('🔴 Solvabilité critique !',
        `Ratio : ${solvencyRatio}% — seuil rouge : ${threshold}%. Vérifiez le dashboard immédiatement.`,
        { type: 'SOLVENCY_ALERT', ratio: solvencyRatio });
    }
  } catch (e) { captureError('CRON-B-SOLVENCY', e); }

});


// ============================================================
// CRON D — Détection de fraude (toutes les 30 minutes)
// Désactivable via AI_FRAUD_DETECTION_ENABLED
// ============================================================
cron.schedule('*/30 * * * *', async () => {
  try {
    const { runFraudDetection } = require('./services/fraudDetection');
    const result = await runFraudDetection();
    if (!result.skipped) logger.info('CRON-D', 'Détection de fraude exécutée');
  } catch (e) { captureError('CRON-D-FRAUD', e); }
});


// ============================================================
// CRON C — Maintenance nocturne (quotidien à 02h00)
// • Expiration définitive des abonnements PAST_DUE > 3 jours
// • Nettoyage des tokens expirés
// • Nettoyage des notifications lues > 30 jours
// • Rotation des fichiers logs > 31 jours
// ============================================================
cron.schedule('0 2 * * *', async () => {
  const now = new Date().toISOString();

  // ── C1 : Abonnements PAST_DUE → EXPIRED ───────────────────
  try {
    const cutoff = new Date(Date.now() - 3 * 24 * 3600000).toISOString();
    const { data: expired } = await supabase.from('subscriptions')
      .select('id, creator_id').eq('status', 'PAST_DUE').lte('updated_at', cutoff);
    for (const sub of expired || []) {
      await supabase.from('subscriptions').update({ status: 'EXPIRED', updated_at: now }).eq('id', sub.id);
      await supabase.rpc('increment_subscribers_count', { p_creator_id: sub.creator_id, p_delta: -1 });
    }
    if ((expired || []).length > 0) logger.info('CRON-C', `${expired.length} abonnement(s) expiré(s)`);
  } catch (e) { captureError('CRON-C-SUB-EXPIRY', e); }

  // ── C2 : Tokens expirés ────────────────────────────────────
  try {
    await supabase.from('refresh_tokens').delete().lt('expires_at', now);
    await supabase.from('password_reset_tokens').delete().lt('expires_at', now);
    await supabase.from('phone_verification_tokens').delete().lt('expires_at', now);
    await supabase.from('email_verification_tokens').delete().lt('expires_at', now);
    logger.info('CRON-C', 'Tokens expirés nettoyés');
  } catch (e) { captureError('CRON-C-TOKENS', e); }

  // ── C3 : Notifications lues > 30 jours ────────────────────
  try {
    const notifCutoff = new Date(Date.now() - 30 * 24 * 3600000).toISOString();
    await supabase.from('notifications').delete().lt('created_at', notifCutoff).eq('is_read', true);
    logger.info('CRON-C', 'Notifications anciennes nettoyées');
  } catch (e) { captureError('CRON-C-NOTIFS', e); }

  // ── C4 : Rotation des logs > 31 jours ─────────────────────
  try {
    const files = fs.readdirSync(LOGS_DIR).filter(f => f.startsWith('log_') && f.endsWith('.txt'));
    const logCutoff = Date.now() - 31 * 24 * 3600 * 1000;
    let deleted = 0;
    for (const file of files) {
      const filePath = path.join(LOGS_DIR, file);
      if (fs.statSync(filePath).mtimeMs < logCutoff) { fs.unlinkSync(filePath); deleted++; }
    }
    if (deleted > 0) logger.info('CRON-C', `Rotation logs : ${deleted} fichier(s) supprimé(s)`);
  } catch (e) { captureError('CRON-C-LOGS', e); }
});


// ============================================================
// DÉMARRAGE SERVEUR
// ============================================================
const server = http.createServer(app);
attachLiveSocket(server);

if (require.main === module) {
  server.listen(PORT, () => {
    logger.info('SERVER', `🚀 KASOLIFE Backend v1 démarré sur le port ${PORT}`);
    logger.info('SERVER', `Environnement : ${process.env.NODE_ENV || 'development'}`);
    logger.info('SERVER', `Logs : ${LOGS_DIR}`);
  });
}

module.exports = app;
