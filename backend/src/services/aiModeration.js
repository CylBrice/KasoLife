// ============================================================
// KASOLIFE — Service IA v1.0
// Centralise tous les appels à l'API Anthropic (Claude) pour :
//   - Modération de contenu (médias, texte)
//   - Tags automatiques
//   - Triage de signalements
//   - Détection de fraude (analyse de patterns)
//   - Aide créateur (légendes, prix suggéré)
//
// Modèle utilisé : claude-haiku-4-5 (économique, rapide) pour toutes
// les tâches de classification/triage à fort volume.
// ============================================================
'use strict';
const supabase = require('../config/supabase');

const MODEL = 'claude-haiku-4-5';

let _anthropicClient = null;
function getClient() {
  if (!_anthropicClient) {
    const { Anthropic } = require('@anthropic-ai/sdk');
    _anthropicClient = new Anthropic();
  }
  return _anthropicClient;
}

// ── Lecture des toggles de fonctionnalités IA depuis platform_config ────────
// Mise en cache courte (60s) pour éviter une requête DB à chaque upload/message.
const _configCache = { values: {}, expiresAt: 0 };

async function getAIConfig() {
  if (Date.now() < _configCache.expiresAt) return _configCache.values;

  const keys = [
    'AI_CONTENT_MODERATION_ENABLED',
    'AI_TEXT_MODERATION_ENABLED',
    'AI_REPORT_TRIAGE_ENABLED',
    'AI_AUTO_TAGGING_ENABLED',
    'AI_FRAUD_DETECTION_ENABLED',
    'AI_FAN_REMINDERS_ENABLED',
    'AI_CHURN_PREDICTION_ENABLED',
    'AI_CREATOR_DIGEST_ENABLED',
    'AI_TRANSLATION_ENABLED',
    'AI_DISTRESS_DETECTION_ENABLED',
    'AI_CATEGORY_CONSISTENCY_ENABLED',
    'AI_DUPLICATE_CONTENT_ENABLED',
    'AI_THUMBNAIL_AB_TESTING_ENABLED',
    'AI_SENTIMENT_ANALYSIS_ENABLED',
    'AI_KYC_CONSISTENCY_ENABLED',
    'AI_CHARGEBACK_DETECTION_ENABLED',
  ];
  const { data, error } = await supabase.from('platform_config')
    .select('key, value').in('key', keys);
  if (error) return _configCache.values; // en cas d'erreur, conserve la dernière valeur connue

  const values = {};
  for (const row of data || []) {
    values[row.key] = row.value === 'true';
  }
  _configCache.values = values;
  _configCache.expiresAt = Date.now() + 60_000;
  return values;
}

/** Invalide le cache de config IA (à appeler après une modification admin) */
function invalidateAIConfigCache() {
  _configCache.expiresAt = 0;
}

// ── 1. MODÉRATION DE MÉDIAS (images / vignettes vidéo) ──────────────────────
// Retourne { status: 'APPROVED'|'FLAGGED'|'REJECTED', reason?: string }
async function moderateImage(imageBuffer, mimeType) {
  const config = await getAIConfig();
  if (!config.AI_CONTENT_MODERATION_ENABLED) {
    return { status: 'NOT_SCANNED', reason: null };
  }

  try {
    const base64 = imageBuffer.toString('base64');
    const client = getClient();

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64 },
          },
          {
            type: 'text',
            text: `Tu es un modérateur de contenu pour KasoLife, une plateforme de créateurs limitée à des catégories "grand public" : Fitness, Musique, Coaching, Art, Cuisine, Mode, Gaming, Business.

Le contenu sexuel explicite, la nudité, et le contenu violent/choquant sont STRICTEMENT INTERDITS sur cette plateforme.

Analyse cette image et réponds UNIQUEMENT avec un objet JSON (rien d'autre, pas de markdown) :
{
  "status": "APPROVED" | "FLAGGED" | "REJECTED",
  "reason": "courte explication en français, ou null si APPROVED"
}

- APPROVED : contenu conforme aux catégories autorisées, sans ambiguïté.
- FLAGGED : contenu limite (ex: tenue de fitness/maillot de bain ambigu, suggestif sans nudité) — nécessite une revue humaine.
- REJECTED : nudité, contenu sexuel explicite, violence graphique, ou contenu manifestement hors-charte.`,
          },
        ],
      }],
    });

    const text = response.content.find((b) => b.type === 'text')?.text || '{}';
    const parsed = JSON.parse(text.trim());
    if (!['APPROVED', 'FLAGGED', 'REJECTED'].includes(parsed.status)) {
      throw new Error('Réponse IA invalide');
    }
    return { status: parsed.status, reason: parsed.reason || null };
  } catch (err) {
    console.error('[AI] Erreur modération image :', err.message);
    // En cas d'échec de l'IA, on ne bloque jamais l'upload — on marque pour revue humaine
    return { status: 'FLAGGED', reason: 'Scan IA indisponible — en attente de revue manuelle' };
  }
}

// ── 2. MODÉRATION DE TEXTE (messages, commentaires) ──────────────────────────
// Retourne { allowed: boolean, reason?: string, severity?: 'LOW'|'MEDIUM'|'HIGH' }
async function moderateText(text, context = 'message') {
  const config = await getAIConfig();
  if (!config.AI_TEXT_MODERATION_ENABLED) return { allowed: true };

  // Pré-filtre rapide : textes très courts/anodins → pas d'appel IA (économie)
  if (!text || text.trim().length < 3) return { allowed: true };

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Tu es un modérateur automatique pour KasoLife (plateforme de créateurs, Afrique francophone).
Analyse ce ${context === 'comment' ? 'commentaire' : 'message privé'} et détecte : spam, harcèlement, menaces, discours haineux, sollicitation illégale, arnaque.

Texte à analyser (entre balises) :
<texte>
${text.slice(0, 2000)}
</texte>

Réponds UNIQUEMENT avec un objet JSON (rien d'autre) :
{"allowed": true|false, "severity": "LOW"|"MEDIUM"|"HIGH"|null, "reason": "courte raison en français ou null"}

allowed=false uniquement si le contenu est clairement problématique (pas pour de simples critiques ou désaccords).`,
      }],
    });

    const responseText = response.content.find((b) => b.type === 'text')?.text || '{}';
    const parsed = JSON.parse(responseText.trim());
    return {
      allowed: parsed.allowed !== false,
      severity: parsed.severity || null,
      reason: parsed.reason || null,
    };
  } catch (err) {
    console.error('[AI] Erreur modération texte :', err.message);
    return { allowed: true }; // fail-open pour le texte (moins critique que les médias)
  }
}

// ── 3. TAGS AUTOMATIQUES SUR LES POSTS ───────────────────────────────────────
async function generateTags({ caption, imageBuffer, mimeType, categoryName }) {
  const config = await getAIConfig();
  if (!config.AI_AUTO_TAGGING_ENABLED) return [];

  try {
    const client = getClient();
    const content = [];

    if (imageBuffer && mimeType) {
      content.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBuffer.toString('base64') } });
    }
    content.push({
      type: 'text',
      text: `Génère 3 à 6 mots-clés (tags) en français pour ce post de la catégorie "${categoryName}" sur KasoLife.
${caption ? `Légende : "${caption.slice(0, 300)}"` : 'Pas de légende fournie — base-toi sur l\'image.'}

Réponds UNIQUEMENT avec un tableau JSON de chaînes en minuscules, sans accents si possible (ex: ["fitness", "entrainement", "musculation"]). Pas de markdown, pas de commentaire.`,
    });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 150,
      messages: [{ role: 'user', content }],
    });

    const text = response.content.find((b) => b.type === 'text')?.text || '[]';
    const tags = JSON.parse(text.trim());
    if (!Array.isArray(tags)) return [];
    return tags.filter((t) => typeof t === 'string').slice(0, 6).map((t) => t.toLowerCase().trim());
  } catch (err) {
    console.error('[AI] Erreur génération tags :', err.message);
    return [];
  }
}

// ── 4. TRIAGE AUTOMATIQUE DES SIGNALEMENTS ───────────────────────────────────
async function triageReport({ reason, targetType, targetContent }) {
  const config = await getAIConfig();
  if (!config.AI_REPORT_TRIAGE_ENABLED) return { severity: null, summary: null };

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Tu es un modérateur senior pour KasoLife. Un utilisateur a signalé un(e) ${targetType} pour le motif suivant :
"${(reason || '').slice(0, 500)}"

${targetContent ? `Contenu signalé (extrait) : "${String(targetContent).slice(0, 500)}"` : ''}

Évalue la gravité de ce signalement et réponds UNIQUEMENT avec un objet JSON :
{"severity": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "summary": "résumé en une phrase pour l'équipe de modération, en français"}

CRITICAL = danger immédiat (mineur, violence, contenu illégal). HIGH = violation grave des règles (nudité, harcèlement sévère). MEDIUM = violation probable nécessitant une revue. LOW = probablement un désaccord ou signalement abusif.`,
      }],
    });

    const text = response.content.find((b) => b.type === 'text')?.text || '{}';
    const parsed = JSON.parse(text.trim());
    return {
      severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(parsed.severity) ? parsed.severity : null,
      summary: parsed.summary || null,
    };
  } catch (err) {
    console.error('[AI] Erreur triage signalement :', err.message);
    return { severity: null, summary: null };
  }
}

// ── 5. AIDE CRÉATEUR : génération de légende ─────────────────────────────────
async function generateCaption({ imageBuffer, mimeType, categoryName, tone = 'engageant' }) {
  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBuffer.toString('base64') } },
          {
            type: 'text',
            text: `Rédige une courte légende ${tone} en français pour ce post de la catégorie "${categoryName}" sur KasoLife (plateforme de créateurs). Maximum 2 phrases, ton chaleureux et naturel, pas d'emoji excessif (1-2 maximum). Réponds uniquement avec le texte de la légende, sans guillemets ni préambule.`,
          },
        ],
      }],
    });
    return response.content.find((b) => b.type === 'text')?.text?.trim() || '';
  } catch (err) {
    console.error('[AI] Erreur génération légende :', err.message);
    return '';
  }
}

// ── 6. AIDE CRÉATEUR : suggestion de prix d'abonnement ───────────────────────
async function suggestSubscriptionPrice({ categoryName, similarPrices }) {
  // Approche statistique simple (pas d'appel IA nécessaire) :
  // médiane des prix des créateurs similaires, avec garde-fous.
  if (!similarPrices || similarPrices.length === 0) {
    return { suggested_xcon: 1000, basis: 'Prix de départ recommandé pour un nouveau créateur.' };
  }
  const sorted = [...similarPrices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  // Arrondi au 100 le plus proche
  const suggested = Math.max(500, Math.round(median / 100) * 100);
  return {
    suggested_xcon: suggested,
    basis: `Basé sur la médiane de ${similarPrices.length} créateur(s) de la catégorie "${categoryName}".`,
  };
}

// ── 7. RÉSUMÉ HEBDOMADAIRE CRÉATEUR ───────────────────────────────────────────
async function generateCreatorDigest({ displayName, categoryName, stats }) {
  const config = await getAIConfig();
  if (!config.AI_CREATOR_DIGEST_ENABLED) return { summary: null, suggestions: [] };

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Tu es un coach pour créateurs sur KasoLife (plateforme d'abonnements, Afrique francophone).
Rédige un court résumé hebdomadaire chaleureux et motivant pour ${displayName} (catégorie : ${categoryName}), à partir de ces statistiques de la semaine :

${JSON.stringify(stats, null, 2)}

Réponds UNIQUEMENT avec un objet JSON :
{
  "summary": "2-3 phrases résumant la semaine en français, ton positif mais honnête",
  "suggestions": ["1 à 3 suggestions concrètes et actionnables pour la semaine prochaine"]
}`,
      }],
    });

    const text = response.content.find((b) => b.type === 'text')?.text || '{}';
    const parsed = JSON.parse(text.trim());
    return {
      summary: parsed.summary || null,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
    };
  } catch (err) {
    console.error('[AI] Erreur résumé créateur :', err.message);
    return { summary: null, suggestions: [] };
  }
}

// ── 8. ANALYSE DE SENTIMENT (commentaires) ───────────────────────────────────
// Retourne 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
async function analyzeSentiment(text) {
  const config = await getAIConfig();
  if (!config.AI_SENTIMENT_ANALYSIS_ENABLED) return null;
  if (!text || text.trim().length < 2) return 'NEUTRAL';

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 10,
      messages: [{
        role: 'user',
        content: `Analyse le sentiment de ce commentaire (français ou autre langue) : "${text.slice(0, 500)}"
Réponds avec UN SEUL MOT, exactement : POSITIVE, NEUTRAL ou NEGATIVE.`,
      }],
    });
    const result = response.content.find((b) => b.type === 'text')?.text?.trim().toUpperCase();
    return ['POSITIVE', 'NEUTRAL', 'NEGATIVE'].includes(result) ? result : 'NEUTRAL';
  } catch (err) {
    console.error('[AI] Erreur analyse sentiment :', err.message);
    return null;
  }
}

// ── 9. TRADUCTION À LA DEMANDE ────────────────────────────────────────────────
async function translateText(text, targetLang = 'fr') {
  const config = await getAIConfig();
  if (!config.AI_TRANSLATION_ENABLED) return null;
  if (!text || !text.trim()) return null;

  const LANG_NAMES = { fr: 'français', en: 'anglais' };
  const targetName = LANG_NAMES[targetLang] || targetLang;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Traduis ce texte en ${targetName}. Réponds UNIQUEMENT avec la traduction, sans préambule ni guillemets. Si le texte est déjà en ${targetName}, réponds avec le texte original inchangé.

Texte :
${text.slice(0, 1500)}`,
      }],
    });
    return response.content.find((b) => b.type === 'text')?.text?.trim() || null;
  } catch (err) {
    console.error('[AI] Erreur traduction :', err.message);
    return null;
  }
}

// ── 10. DÉTECTION DE LANGAGE DE DÉTRESSE ──────────────────────────────────────
// Retourne { distress: boolean, severity?: 'LOW'|'MEDIUM'|'HIGH' }
async function detectDistress(text) {
  const config = await getAIConfig();
  if (!config.AI_DISTRESS_DETECTION_ENABLED) return { distress: false };
  if (!text || text.trim().length < 5) return { distress: false };

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 80,
      messages: [{
        role: 'user',
        content: `Analyse ce message privé envoyé sur une plateforme de créateurs. Détecte uniquement des signaux clairs de DÉTRESSE PSYCHOLOGIQUE (pensées suicidaires, automutilation, détresse aiguë) — pas de simple tristesse ou frustration normale.

Texte : "${text.slice(0, 1000)}"

Réponds UNIQUEMENT avec un objet JSON : {"distress": true|false, "severity": "LOW"|"MEDIUM"|"HIGH"|null}`,
      }],
    });
    const responseText = response.content.find((b) => b.type === 'text')?.text || '{}';
    const parsed = JSON.parse(responseText.trim());
    return {
      distress: parsed.distress === true,
      severity: parsed.severity || null,
    };
  } catch (err) {
    console.error('[AI] Erreur détection détresse :', err.message);
    return { distress: false };
  }
}

// ── 11. COHÉRENCE CATÉGORIE / CONTENU ─────────────────────────────────────────
// Retourne { consistent: boolean, reason?: string }
async function checkCategoryConsistency({ imageBuffer, mimeType, caption, categoryName }) {
  const config = await getAIConfig();
  if (!config.AI_CATEGORY_CONSISTENCY_ENABLED) return { consistent: true };

  try {
    const client = getClient();
    const content = [];
    if (imageBuffer && mimeType) {
      content.push({ type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBuffer.toString('base64') } });
    }
    content.push({
      type: 'text',
      text: `Ce post est publié dans la catégorie "${categoryName}" sur KasoLife.
${caption ? `Légende : "${caption.slice(0, 300)}"` : ''}

Le contenu (image et/ou légende) correspond-il raisonnablement à cette catégorie ? Sois indulgent — beaucoup de contenus créateur sont polyvalents (ex: une recette peut accompagner du contenu "Cuisine" même si l'image montre la personne plutôt que le plat).

Réponds UNIQUEMENT avec un objet JSON : {"consistent": true|false, "reason": "courte explication en français ou null"}
consistent=false UNIQUEMENT si le contenu est manifestement sans rapport avec la catégorie déclarée.`,
    });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 120,
      messages: [{ role: 'user', content }],
    });
    const text = response.content.find((b) => b.type === 'text')?.text || '{}';
    const parsed = JSON.parse(text.trim());
    return {
      consistent: parsed.consistent !== false,
      reason: parsed.reason || null,
    };
  } catch (err) {
    console.error('[AI] Erreur cohérence catégorie :', err.message);
    return { consistent: true }; // fail-open
  }
}

module.exports = {
  getAIConfig,
  invalidateAIConfigCache,
  moderateImage,
  moderateText,
  generateTags,
  triageReport,
  generateCaption,
  suggestSubscriptionPrice,
  generateCreatorDigest,
  analyzeSentiment,
  translateText,
  detectDistress,
  checkCategoryConsistency,
};
