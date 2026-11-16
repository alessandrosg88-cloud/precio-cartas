// =====================================================================
//  IDIOMAS — los textos se escriben en español en el código y T() los traduce.
//  Cada idioma está en i18n-xx.js (TRANS.xx = { número: 'traducción' }),
//  con el mismo número que el texto en i18n-keys.js. Si falta, se muestra en español.
// =====================================================================
const LANGS = [
  ['es', 'Español', '🇪🇸'], ['en', 'English', '🇬🇧'], ['it', 'Italiano', '🇮🇹'],
  ['fr', 'Français', '🇫🇷'], ['nl', 'Nederlands', '🇳🇱'], ['de', 'Deutsch', '🇩🇪'],
  ['ja', '日本語', '🇯🇵'], ['zh', '中文', '🇨🇳'], ['ko', '한국어', '🇰🇷'],
];
const LOCALES = { es: 'es-ES', en: 'en-GB', it: 'it-IT', fr: 'fr-FR', nl: 'nl-NL', de: 'de-DE', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR' };
const TRANS = {};
const KEY_ID = {};
ES_KEYS.forEach((k, i) => KEY_ID[k] = i + 1);

let LANG = (() => {
  try { const s = localStorage.getItem('idioma'); if (s && LOCALES[s]) return s; } catch (e) {}
  const n = (navigator.language || 'es').slice(0, 2).toLowerCase();
  return LOCALES[n] ? n : 'es';
})();
function setLang(l){ LANG = l; try { localStorage.setItem('idioma', l); } catch (e) {} }
const LOCALE = () => LOCALES[LANG] || 'es-ES';
const LANG_NAME = () => ({ es: 'español', en: 'inglés', it: 'italiano', fr: 'francés', nl: 'neerlandés',
  de: 'alemán', ja: 'japonés', zh: 'chino', ko: 'coreano' })[LANG];

// Carga el archivo del idioma solo cuando hace falta
const langLoading = {};
function loadLang(l){
  if (l === 'es' || TRANS[l]) return Promise.resolve();
  return langLoading[l] ||= new Promise(ok => {
    const s = document.createElement('script');
    s.src = `i18n-${l}.js?v=8`; s.onload = ok; s.onerror = ok;
    document.head.appendChild(s);
  });
}

// Traduce un texto. {0}, {1}… se sustituyen por los valores que se pasan.
function T(s, ...a){
  let out = String(s ?? '');
  if (LANG !== 'es') {
    const id = KEY_ID[out];
    const tr = id && TRANS[LANG] && TRANS[LANG][id];
    if (tr) out = tr;
  }
  a.forEach((v, i) => { out = out.split('{' + i + '}').join(v); });
  return out;
}
