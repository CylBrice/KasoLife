const sanitizeHtml = require('sanitize-html');

/**
 * Whitelist identique au frontend (DOMPurify).
 * 2ème couche de défense côté serveur avant tout INSERT en base.
 *
 * Balises autorisées : mise en forme texte + marquee pour animations
 * Attributs autorisés : style (filtré), direction/behavior/scrollamount pour marquee
 * Toute balise ou attribut absent de la liste est supprimé, pas éscapé.
 */
const SANITIZE_OPTIONS = {
  allowedTags: ['b', 'strong', 'i', 'em', 'u', 's', 'del', 'mark', 'small', 'span', 'br', 'marquee'],
  allowedAttributes: {
    span: ['style'],
    marquee: ['style', 'direction', 'behavior', 'scrollamount'],
    b: ['style'],
    i: ['style'],
    u: ['style'],
    s: ['style'],
    strong: ['style'],
    em: ['style'],
    mark: ['style'],
    small: ['style'],
  },
  allowedStyles: {
    // Propriétés CSS visuelles inoffensives uniquement
    '*': {
      'color':            [/^[a-zA-Z]+$/, /^#[0-9a-fA-F]{3,6}$/, /^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$/],
      'background-color': [/^[a-zA-Z]+$/, /^#[0-9a-fA-F]{3,6}$/, /^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$/],
      'font-size':        [/^\d+(\.\d+)?(px|em|rem|%)$/],
      'font-weight':      [/^(bold|normal|\d{3})$/],
      'font-style':       [/^(italic|normal|oblique)$/],
      'text-decoration':  [/^(underline|line-through|none|overline)$/],
      'text-transform':   [/^(uppercase|lowercase|capitalize|none)$/],
      'letter-spacing':   [/^\d+(\.\d+)?(px|em|rem)$/],
      'animation':        [/^[\w\s,.\-]+$/],  // permet les noms d'animation CSS
      'animation-name':   [/.*/],
      'animation-duration':[/^\d+(\.\d+)?s$/],
      'animation-iteration-count': [/^(\d+|infinite)$/],
    },
  },
  // Interdit explicitement toute URL dans les attributs (pas de href, src, data:)
  allowedSchemes: [],
  disallowedTagsMode: 'discard',
  enforceHtmlBoundary: false,
};

/**
 * Sanitize un titre HTML avant insertion en base.
 * @param {string} raw  — valeur brute reçue du client
 * @returns {string}    — HTML sûr, ou chaîne vide si null/undefined
 */
function sanitizeHtmlTitle(raw) {
  if (!raw || typeof raw !== 'string') return '';
  // Retire les expressions CSS dangereuses même si elles passaient la whitelist
  const preCleaned = raw
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '');
  return sanitizeHtml(preCleaned, SANITIZE_OPTIONS).trim();
}

module.exports = { sanitizeHtmlTitle };
