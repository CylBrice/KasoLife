// ============================================================
// KASOLIFE — Route /config/public
// Retourne la configuration publique de la plateforme
// dont l'URL du site web — lue depuis FRONTEND_URL (variable d'env)
// Le mobile l'utilise pour partager le lien sans coder l'URL en dur
// ============================================================
const express = require('express');
const {
  SUBSCRIPTION_COMMISSION_RATE, TIP_COMMISSION_RATE, PPV_COMMISSION_RATE,
  WITHDRAWAL_COMMISSION_RATE, MIN_PAYOUT_AMOUNT,
} = require('../config/constants');
const router  = express.Router();

// ── GET /config/public — configuration publique (sans auth) ──────────────────
router.get('/public', (req, res) => {
  res.json({
    appName:    'KasoLife',
    appTagline: 'Soutenez vos créateurs préférés',
    appUrl:     process.env.FRONTEND_URL || 'https://kasolife.com',
    currency:   'xcon',
    minDeposit: 500,
    minPayout:  MIN_PAYOUT_AMOUNT,
    commission: {
      subscription: SUBSCRIPTION_COMMISSION_RATE,
      tip: TIP_COMMISSION_RATE,
      ppv: PPV_COMMISSION_RATE,
      withdrawal: WITHDRAWAL_COMMISSION_RATE,
    },
    support: {
      email:    process.env.SUPPORT_EMAIL    || 'support@kasolife.com',
      whatsapp: process.env.SUPPORT_WHATSAPP || 'https://wa.me/237600000000',
      telegram: process.env.SUPPORT_TELEGRAM || 'https://t.me/kasolife_support',
    },
  });
});

module.exports = router;
