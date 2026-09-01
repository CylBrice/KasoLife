// ============================================================
// KASOLIFE — Constantes v1.0
// Adapté depuis KasoLife — logique paris/JTON/marchés retirée
// ============================================================
'use strict';

// ── Commissions plateforme
const SUBSCRIPTION_COMMISSION_RATE = 0.20; // 20% prélevés sur abonnements
const TIP_COMMISSION_RATE          = 0.20; // 20% sur pourboires
const PPV_COMMISSION_RATE          = 0.20; // 20% sur contenu payant à l'unité (messages/posts)
const WITHDRAWAL_COMMISSION_RATE   = 0.015; // 1.5% sur retraits créateurs

// ── Limites montants (en FCFA)
const SUBSCRIPTION_PRICE_MIN = 500;
const SUBSCRIPTION_PRICE_MAX = 100000;
const TIP_MIN                = 100;
const TIP_MAX                = 500000;
const PPV_PRICE_MIN          = 100;
const PPV_PRICE_MAX          = 200000;
const MIN_PAYOUT_AMOUNT      = 5000; // minimum retrait créateur

// ── Garde-fous wallet
const MIN_WALLET_BALANCE_XCON = 0;
const RETRAIT_MAX_DAY_XCON    = 1000000;

// ── KYC — niveau unique (PENDING = non vérifié / VERIFIED = vérifié)
// Devenir créateur sur KasoLife exige KYC_VERIFIED
const KYC_LIMITS = {
  PENDING:  { depot_max_month: 50000,  retrait_max_month: 0 },
  VERIFIED: { depot_max_month: 0,      retrait_max_month: 0 },
};

// ── Maintenance
const MAINTENANCE_STATUS = {
  ACTIF:             'ACTIF',
  READ_ONLY:         'READ_ONLY',
  MAINTENANCE:       'MAINTENANCE',
  FORCE_MAINTENANCE: 'FORCE_MAINTENANCE',
};
const MAINTENANCE_BLOCKS_BETS   = []; // pas de paris sur KasoLife — conservé pour compat middleware
const MAINTENANCE_BLOCKS_WALLET = ['READ_ONLY','MAINTENANCE','FORCE_MAINTENANCE'];
const MAINTENANCE_BLOCKS_ALL    = ['MAINTENANCE','FORCE_MAINTENANCE'];

// ── Pseudo (identifiant créateur/utilisateur)
const PSEUDO_REGEX      = /^[a-zA-Z0-9._\-]{3,20}$/;
const PSEUDO_MIN_LENGTH = 3;
const PSEUDO_MAX_LENGTH = 20;
const PSEUDO_ERROR_MSG  = 'Pseudonyme invalide — 3 à 20 caractères parmi : a-z A-Z 0-9 . _ -';

// ── Mobile Money
const MOBILE_MONEY_MAX_PER_OPERATOR = 3;
const MOBILE_MONEY_MAX_TOTAL        = 6;

// ── Email
const EMAIL_OTP_EXPIRY_MIN = 30;
const EMAIL_CONFIRM_DAYS   = 10;
const EMAIL_WARN_DAY       = 8;

// ── Refresh tokens (Access 15min + Refresh 30j révocable)
const ACCESS_TOKEN_EXPIRY       = '15m';
const REFRESH_TOKEN_EXPIRY      = '30d';
const REFRESH_TOKEN_EXPIRY_MS   = 30 * 24 * 60 * 60 * 1000;
const SESSION_SOFT_EXPIRY_MS    = 7  * 24 * 60 * 60 * 1000;
const SESSION_HARD_EXPIRY_MS    = 30 * 24 * 60 * 60 * 1000;
const MAX_ACTIVE_SESSIONS       = 5;

// ── Parrainage (optionnel — bonus simple en FCFA, pas de système JTON)
const REFERRAL_BONUS_FCFA     = 500;
const REFERRAL_MAX_DAY        = 25;
const INFLUENCER_CODE_PREFIX  = 'KSL-';
const INFLUENCER_CODE_MIN_SUFFIX_LEN = 5;
const INFLUENCER_CODE_MAX_SUFFIX_LEN = 8;
const INFLUENCER_CODE_RESERVED_WORDS = ['TEST','ADMIN','FREE','ROOT','NULL','CODE','PROMO','BONUS','0000','1234','12345'];

// ── Support
const SUPPORT_MAX_MESSAGES    = 35;
const SUPPORT_MSG_MAX_CHARS   = 500;
const SUPPORT_MSG_EXPIRY_DAYS = 30;

// ── Taux de change (référence FCFA)
const EXCHANGE_RATES = { FCFA: 1, XAF: 1, XOF: 1, EUR: 655.957, USD: 610.0, GBP: 780.0 };

// ── KYC Didit
const KYC_MAX_ATTEMPTS = 5;
const DIDIT_API_URL    = 'https://apx.didit.me/v3';

// ── Validation téléphone (E.164)
const isValidE164 = (phone) => /^\+[1-9]\d{6,14}$/.test(phone);

// ── Détection opérateur Mobile Money à partir du préfixe (Cameroun, +237)
const detectMobileOperator = (phone) => {
  const m = /^\+237(\d{9})$/.exec(phone);
  if (!m) return null;
  const local = m[1];
  const p2 = local.slice(0, 2);
  const p3 = local.slice(0, 3);
  const MTN_3    = ['650','651','652','653','654','680','681','682','683','684'];
  const ORANGE_3 = ['655','656','657','658','659','685','686','687','688','689'];
  if (p2 === '67' || MTN_3.includes(p3))    return 'MTN';
  if (p2 === '69' || ORANGE_3.includes(p3)) return 'ORANGE';
  return null;
};

const isValidPseudo = (p) => PSEUDO_REGEX.test(p);
const toXcon = (amount, currency = 'FCFA') => Math.round(amount * (EXCHANGE_RATES[currency] || 1));

// ── Validation code influenceur / parrainage
const isValidInfluencerCode = (code) => {
  if (!code || !code.startsWith(INFLUENCER_CODE_PREFIX)) return false;
  const suffix = code.slice(INFLUENCER_CODE_PREFIX.length);
  if (suffix.length < INFLUENCER_CODE_MIN_SUFFIX_LEN) return false;
  if (suffix.length > INFLUENCER_CODE_MAX_SUFFIX_LEN) return false;
  if (INFLUENCER_CODE_RESERVED_WORDS.includes(suffix.toUpperCase())) return false;
  if (!/^[A-Z0-9]+$/i.test(suffix)) return false;
  return true;
};

// ── Référence de transaction (préfixe générique)
const TX_PREFIX     = 'KSL-';
const TX_CHARS      = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const TX_SUFFIX_LEN = 8;
const generateTxRef = () => {
  let suffix = '';
  for (let i = 0; i < TX_SUFFIX_LEN; i++)
    suffix += TX_CHARS[Math.floor(Math.random() * TX_CHARS.length)];
  return `${TX_PREFIX}${suffix}`;
};

module.exports = {
  SUBSCRIPTION_COMMISSION_RATE, TIP_COMMISSION_RATE, PPV_COMMISSION_RATE,
  WITHDRAWAL_COMMISSION_RATE,
  SUBSCRIPTION_PRICE_MIN, SUBSCRIPTION_PRICE_MAX,
  TIP_MIN, TIP_MAX, PPV_PRICE_MIN, PPV_PRICE_MAX, MIN_PAYOUT_AMOUNT,
  MIN_WALLET_BALANCE_XCON, RETRAIT_MAX_DAY_XCON,
  KYC_LIMITS,
  MAINTENANCE_STATUS, MAINTENANCE_BLOCKS_BETS,
  MAINTENANCE_BLOCKS_WALLET, MAINTENANCE_BLOCKS_ALL,
  PSEUDO_REGEX, PSEUDO_MIN_LENGTH, PSEUDO_MAX_LENGTH, PSEUDO_ERROR_MSG,
  MOBILE_MONEY_MAX_PER_OPERATOR, MOBILE_MONEY_MAX_TOTAL,
  EMAIL_OTP_EXPIRY_MIN, EMAIL_CONFIRM_DAYS, EMAIL_WARN_DAY,
  ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY_MS,
  SESSION_SOFT_EXPIRY_MS, SESSION_HARD_EXPIRY_MS, MAX_ACTIVE_SESSIONS,
  REFERRAL_BONUS_FCFA, REFERRAL_MAX_DAY,
  INFLUENCER_CODE_PREFIX, INFLUENCER_CODE_MIN_SUFFIX_LEN, INFLUENCER_CODE_MAX_SUFFIX_LEN,
  INFLUENCER_CODE_RESERVED_WORDS,
  SUPPORT_MAX_MESSAGES, SUPPORT_MSG_MAX_CHARS, SUPPORT_MSG_EXPIRY_DAYS,
  EXCHANGE_RATES, KYC_MAX_ATTEMPTS, DIDIT_API_URL,
  detectMobileOperator, isValidE164, isValidPseudo, toXcon,
  isValidInfluencerCode, generateTxRef,
};
