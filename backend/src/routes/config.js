// ============================================================
// KASOLIFE — Route /config/public
// Retourne la configuration publique de la plateforme
// Les taux de commission sont lus depuis platform_config (DB)
// avec fallback sur constants.js si DB indisponible.
// ============================================================
const express = require('express');
const { MIN_PAYOUT_AMOUNT } = require('../config/constants');
const configService  = require('../services/configService');
const currencyService = require('../services/currency');
const router = express.Router();

// ── GET /config/public — configuration publique (sans auth) ──────────────────
router.get('/public', async (req, res) => {
  try {
    const [subscription, tip, ppv, withdrawal] = await Promise.all([
      configService.getCommissionRate('subscription'),
      configService.getCommissionRate('tip'),
      configService.getCommissionRate('ppv'),
      configService.getCommissionRate('withdrawal'),
    ]);

    res.json({
      appName:    'KasoLife',
      appTagline: 'Soutenez vos créateurs préférés',
      appUrl:     process.env.FRONTEND_URL || 'https://kasolife.com',
      currency:   'xcon',
      minDeposit: 500,
      minPayout:  MIN_PAYOUT_AMOUNT,
      commission: { subscription, tip, ppv, withdrawal },
      support: {
        email:    process.env.SUPPORT_EMAIL    || 'support@kasolife.com',
        whatsapp: process.env.SUPPORT_WHATSAPP || 'https://wa.me/237600000000',
        telegram: process.env.SUPPORT_TELEGRAM || 'https://t.me/kasolife_support',
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /config/exchange-rates — taux de change publics (sans auth)
router.get('/exchange-rates', async (req, res) => {
  try {
    const rates = await currencyService.getAllRates();
    res.json({
      base:  'XAF',
      note:  'Arrondi à l\'entier inférieur appliqué à toute conversion',
      rates,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
