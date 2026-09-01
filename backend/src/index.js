// ============================================================
// KASOLIFE — Point d'entrée v1.0
// Adapté depuis KasoLife — crons paris/JTON retirés,
// crons abonnements/contenu ajoutés
// ============================================================
'use strict';

const express     = require('express');
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
const webhookRouter       = require('./routes/webhook');
const referralRouter      = require('./routes/referral');
const supportRouter       = require('./routes/support');
const configRouter        = require('./routes/config');
const kycRouter           = require('./routes/kyc');
const docsRouter          = require('./routes/docs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Sécurité ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(hpp());
app.use(compression());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001').split(',').filter(Boolean);
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
app.use('/webhook',       webhookRouter);
app.use('/referral',      referralRouter);
app.use('/support',       supportRouter);
app.use('/config',        configRouter);
app.use('/kyc',           kycRouter);
app.use('/docs',          docsRouter);

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
      .select('id').eq('role', 'SUPERADMIN').eq('is_active', true);
    await Promise.all((admins || []).map(a =>
      sendPushNotification(a.id, title, body, data).catch(() => {})
    ));
  } catch { /* ne jamais bloquer sur une alerte */ }
};


// ============================================================
// CRON #1 — Renouvellement automatique des abonnements (toutes les heures)
// ============================================================
const SUBSCRIPTION_PERIOD_DAYS = 30;
cron.schedule('0 * * * *', async () => {
  try {
    const { SUBSCRIPTION_COMMISSION_RATE } = require('./config/constants');
    const now = new Date().toISOString();

    const { data: dueSubs } = await supabase.from('subscriptions')
      .select('id, fan_id, creator_id, price_xcon')
      .eq('status', 'ACTIVE').eq('auto_renew', true)
      .lte('current_period_end', now);

    for (const sub of dueSubs || []) {
      try {
        const price = sub.price_xcon;
        const commission = Math.round(price * SUBSCRIPTION_COMMISSION_RATE);
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
        await supabase.from('subscriptions').update({
          current_period_end: newPeriodEnd, updated_at: now,
        }).eq('id', sub.id);

        await supabase.rpc('credit_pending_balance', { p_user_id: sub.creator_id, p_amount: creatorShare });

        await supabase.from('transactions').insert([
          {
            id: uuidv4(), user_id: sub.fan_id, type: 'SUBSCRIPTION_PAYMENT', amount_xcon: -price,
            balance_after: newBalance, description: 'Renouvellement abonnement', related_user_id: sub.creator_id,
          },
          {
            id: uuidv4(), user_id: sub.creator_id, type: 'SUBSCRIPTION_INCOME', amount_xcon: creatorShare,
            balance_after: 0, description: 'Renouvellement abonné', related_user_id: sub.fan_id,
          },
        ]);

        await supabase.from('platform_revenue').insert({
          id: uuidv4(), source_type: 'COMMISSION_ABONNEMENT', amount_xcon: commission,
          reference_id: sub.id, user_id: sub.creator_id,
        });
      } catch (e) { captureError('CRON#1-SUB-RENEWAL-ITEM', e); }
    }
    if ((dueSubs || []).length > 0) logger.info('CRON#1', `${dueSubs.length} abonnement(s) traité(s)`);
  } catch (e) { captureError('CRON#1-SUB-RENEWAL', e); }
});


// ============================================================
// CRON #2 — Expiration définitive des abonnements PAST_DUE > 3 jours
// ============================================================
cron.schedule('0 */6 * * *', async () => {
  try {
    const cutoff = new Date(Date.now() - 3 * 24 * 3600000).toISOString();
    const { data: expired } = await supabase.from('subscriptions')
      .select('id, creator_id').eq('status', 'PAST_DUE').lte('updated_at', cutoff);

    for (const sub of expired || []) {
      await supabase.from('subscriptions').update({ status: 'EXPIRED', updated_at: new Date().toISOString() }).eq('id', sub.id);
      await supabase.rpc('increment_subscribers_count', { p_creator_id: sub.creator_id, p_delta: -1 });
    }
    if ((expired || []).length > 0) logger.info('CRON#2', `${expired.length} abonnement(s) expiré(s)`);
  } catch (e) { captureError('CRON#2-SUB-EXPIRY', e); }
});


// ============================================================
// CRON #3 — Nettoyage des tokens expirés (quotidien, 01h00)
// ============================================================
cron.schedule('0 1 * * *', async () => {
  try {
    const now = new Date().toISOString();
    await supabase.from('refresh_tokens').delete().lt('expires_at', now);
    await supabase.from('password_reset_tokens').delete().lt('expires_at', now);
    await supabase.from('phone_verification_tokens').delete().lt('expires_at', now);
    await supabase.from('email_verification_tokens').delete().lt('expires_at', now);
    logger.info('CRON#3', 'Nettoyage des tokens expirés effectué');
  } catch (e) { captureError('CRON#3-CLEAN-TOKENS', e); }
});


// ============================================================
// CRON #4 — Nettoyage des notifications anciennes (> 30 jours)
// ============================================================
cron.schedule('30 1 * * *', async () => {
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600000).toISOString();
    await supabase.from('notifications').delete().lt('created_at', cutoff).eq('is_read', true);
    logger.info('CRON#4', 'Nettoyage notifications effectué');
  } catch (e) { captureError('CRON#4-CLEAN-NOTIFS', e); }
});


// ============================================================
// CRON #5 — Surveillance solvabilité (toutes les heures)
// ============================================================
cron.schedule('0 * * * *', async () => {
  try {
    const { data: wallets } = await supabase.from('wallets').select('balance_xcon, pending_balance_xcon, total_deposited');
    const totalBalances = (wallets || []).reduce((s, w) => s + (w.balance_xcon || 0) + (w.pending_balance_xcon || 0), 0);
    const totalDeposited = (wallets || []).reduce((s, w) => s + (w.total_deposited || 0), 0);
    const solvencyRatio = totalBalances > 0 ? Math.round((totalDeposited / totalBalances) * 100) : 100;

    const { data: solvRed } = await supabase.from('platform_config').select('value').eq('key', 'SOLVENCY_RED').single();
    const threshold = solvRed ? Number(solvRed.value) : 90;

    if (solvencyRatio < threshold) {
      logger.crit('SOLVENCY', `Ratio solvabilité CRITIQUE : ${solvencyRatio}% (seuil: ${threshold}%)`);
      await notifySuperAdminAlert(
        '🔴 Solvabilité critique !',
        `Ratio : ${solvencyRatio}% — seuil rouge : ${threshold}%. Vérifiez le dashboard immédiatement.`,
        { type: 'SOLVENCY_ALERT', ratio: solvencyRatio }
      );
    }
  } catch (e) { captureError('CRON-SOLVENCY-ALERT', e); }
});


// ============================================================
// CRON #6 — Rotation des fichiers logs (> 31 jours)
// ============================================================
cron.schedule('0 4 * * *', async () => {
  try {
    const files = fs.readdirSync(LOGS_DIR).filter(f => f.startsWith('log_') && f.endsWith('.txt'));
    const cutoff = Date.now() - 31 * 24 * 3600 * 1000;
    let deleted = 0;
    for (const file of files) {
      const filePath = path.join(LOGS_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) { fs.unlinkSync(filePath); deleted++; }
    }
    if (deleted > 0) logger.info('CRON-LOGS', `Rotation : ${deleted} fichier(s) log supprimé(s)`);
  } catch (e) { captureError('CRON-LOGS-ROTATION', e); }
});


// ============================================================
// CRON #7 — Détection de fraude (anomalies transactionnelles)
// Toutes les 30 minutes — désactivable via AI_FRAUD_DETECTION_ENABLED
// ============================================================
cron.schedule('*/30 * * * *', async () => {
  try {
    const { runFraudDetection } = require('./services/fraudDetection');
    const result = await runFraudDetection();
    if (!result.skipped) logger.info('CRON#7', 'Détection de fraude exécutée');
  } catch (e) { captureError('CRON#7-FRAUD-DETECTION', e); }
});


// ============================================================
// CRON #8 — Publication automatique des posts programmés (toutes les minutes)
// ============================================================
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date().toISOString();
    const { data: scheduled } = await supabase.from('posts')
      .select('id, creator_id').eq('is_published', false)
      .lte('scheduled_at', now);

    if (!scheduled || scheduled.length === 0) return;

    for (const post of scheduled) {
      await supabase.from('posts')
        .update({ is_published: true, updated_at: now })
        .eq('id', post.id);
    }
    logger.info('CRON#8', `${scheduled.length} post(s) programmé(s) publié(s)`);
  } catch (e) { captureError('CRON#8-PUBLISH-SCHEDULED', e); }
});


// ============================================================
// DÉMARRAGE SERVEUR
// ============================================================
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info('SERVER', `🚀 KASOLIFE Backend v1 démarré sur le port ${PORT}`);
    logger.info('SERVER', `Environnement : ${process.env.NODE_ENV || 'development'}`);
    logger.info('SERVER', `Logs : ${LOGS_DIR}`);
  });
}

module.exports = app;
