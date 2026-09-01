// ============================================================
// KASOLIFE — Service SMS (envoi OTP via CinetPay SMS)
// Utilisé pour la réinitialisation de mot de passe
// ============================================================

/**
 * Génère un code OTP à 6 chiffres
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Envoie un SMS via CinetPay SMS API
 * @param {string} phone   - Numéro de téléphone destinataire
 * @param {string} message - Contenu du SMS
 */
const sendSMS = async (phone, message) => {
  try {
    // CinetPay SMS API
    const response = await fetch('https://api.cinetpay.com/v1/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: process.env.CINETPAY_API_KEY,
        siteId: process.env.CINETPAY_SITE_ID,
        to: phone,
        message,
        sender: 'KASOLIFE',
      }),
    });

    const result = await response.json();

    // Si CinetPay SMS n'est pas disponible, logger le code en développement
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📱 SMS simulé vers ${phone.slice(0,-4)+'****'}: [contenu masqué]`); // F1
    }

    return result;
  } catch (err) {
    console.error('sendSMS error:', err.message);
    // En développement, ne pas bloquer si le SMS échoue
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📱 SMS simulé (fallback) vers ${phone.slice(0,-4)+'****'}: [contenu masqué]`); // F1
      return { status: 'simulated' };
    }
    throw err;
  }
};

/**
 * Envoie un OTP de réinitialisation de mot de passe
 * @param {string} phone  - Numéro du destinataire
 * @param {string} otp    - Code OTP 6 chiffres
 * @param {string} lang   - Langue de l'utilisateur ('fr' ou 'en')
 */
const sendPasswordResetOTP = async (phone, otp, lang = 'fr') => {
  const message = lang === 'en'
    ? `KASOLIFE - Your reset code: ${otp}. Valid for 15 minutes. Do not share it.`
    : `KASOLIFE - Votre code de réinitialisation : ${otp}. Valable 15 minutes. Ne le partagez pas.`;

  return sendSMS(phone, message);
};

module.exports = { generateOTP, sendSMS, sendPasswordResetOTP };
