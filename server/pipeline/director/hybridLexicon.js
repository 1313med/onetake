/**
 * Hybrid Darija + Latin glossary: restore FR/EN/brands Whisper arabized,
 * and map spoken entities → Remotion effect beats / SFX.
 */

/** Arabic (or mangled) → preferred Latin / hybrid display */
const LATIN_RESTORE = [
  { re: /تاكوس\s*دو?\s*ليون|تاكوس\s*دي\s*ليون|طاقوس/gi, to: 'Tacos de Lyon' },
  { re: /تاكوس|تاكو/gi, to: 'tacos' },
  { re: /ماركتينج|التسويق|ماركتينغ/gi, to: 'marketing' },
  { re: /ماركت(?!\w)/gi, to: 'market' },
  { re: /فري|مجاناً|مجانا/gi, to: 'FREE' },
  { re: /فيزا/gi, to: 'visa' },
  { re: /أيرلندا|ايرلندا/gi, to: 'Ireland' },
  { re: /بيزنس|أعمال/gi, to: 'business' },
  { re: /أونلاين|الانترنت/gi, to: 'online' },
  { re: /إنستغرام|انستغرام/gi, to: 'Instagram' },
  { re: /تيكتوك|تيك\s*توك/gi, to: 'TikTok' },
  { re: /يوتيوب/gi, to: 'YouTube' },
  { re: /أوكيه|أوكي/gi, to: 'ok' },
  { re: /مرسي|ميرسي/gi, to: 'merci' },
  { re: /فابور/gi, to: 'فابور' }, // keep Darija
];

/** Entity cues → effect + sfx + display */
const ENTITY_LEXICON = [
  {
    id: 'tacos_lyon',
    re: /tacos\s*de\s*lyon|تاكوس\s*دو?\s*ليون|طاقوس/i,
    effectId: 'brandCard',
    sfx: 'hit',
    text: 'Tacos de Lyon',
    emoji: '🌮',
    assetKey: 'tacos',
  },
  {
    id: 'tacos',
    re: /\btacos?\b|تاكوس|تاكو/i,
    effectId: 'foodPop',
    sfx: 'pop',
    text: 'TACOS',
    emoji: '🌮',
    assetKey: 'tacos',
  },
  {
    id: 'free',
    re: /\bfree\b|فابور|مجانا|فري/i,
    effectId: 'freeBurst',
    sfx: 'riser',
    text: 'FREE',
    emoji: '✨',
    assetKey: 'free',
  },
  {
    id: 'visa',
    re: /\bvisa\b|فيزا|ireland|أيرلندا|ايرلندا/i,
    effectId: 'phoneMockup',
    sfx: 'whoosh',
    text: 'VISA',
    emoji: '📱',
    assetKey: 'visa',
  },
  {
    id: 'passport',
    re: /passport|passeport|وثيق|جواز/i,
    effectId: 'docMock',
    sfx: 'whoosh',
    text: 'PASSPORT',
    emoji: '🛂',
    assetKey: 'doc',
  },
  {
    id: 'approved',
    re: /approuv|approved|مصادق|قبول|accepté|accepted|تم/i,
    effectId: 'stampSlam',
    sfx: 'stamp',
    text: 'APPROVED',
    emoji: '✅',
    assetKey: 'stamp',
  },
  {
    id: 'marketing',
    re: /\bmarketing\b|ماركتينج|التسويق/i,
    effectId: 'headlineWall',
    sfx: 'hit',
    text: 'marketing',
    emoji: '📈',
    assetKey: 'marketing',
  },
  {
    id: 'money',
    re: /فلوس|iflous|argent|money|€|\$/i,
    effectId: 'chartGrow',
    sfx: 'pop',
    text: 'FLOUS',
    emoji: '💰',
    assetKey: 'money',
  },
  {
    id: 'phone_app',
    re: /تليفون|تطبيق|\bapp\b|phone/i,
    effectId: 'phoneMockup',
    sfx: 'whoosh',
    text: 'APP',
    emoji: '📱',
    assetKey: 'phone',
  },
  {
    id: 'platform',
    re: /\bplatform\b|website|community|job\s*offer|register/i,
    effectId: 'topicBlast',
    sfx: 'hit',
    text: 'PLATFORM',
    emoji: '🚀',
    assetKey: 'marketing',
  },
  {
    id: 'search',
    re: /\bsearch\b|anymore|updated/i,
    effectId: 'checklist',
    sfx: 'tick',
    text: 'NO SEARCH',
    emoji: '🔎',
    assetKey: 'marketing',
  },
  {
    id: 'community',
    re: /\bcommunity\b|join|register|website/i,
    effectId: 'phoneMockup',
    sfx: 'whoosh',
    text: 'JOIN',
    emoji: '🤝',
    assetKey: 'phone',
  },
];

/** Words worth gold-highlighting in English captions (not every Latin word). */
const EMPHASIS_WORDS = new Set(
  [
    'free',
    'platform',
    'website',
    'community',
    'job',
    'offer',
    'visa',
    'ireland',
    'tacos',
    'marketing',
    'new',
    'join',
    'register',
    'wave',
    'internet',
    'search',
  ].map((w) => w.toLowerCase())
);

function shouldHighlightToken(token) {
  const t = String(token || '').replace(/[^\p{L}\p{N}'-]/gu, '');
  if (!t) return false;
  if (/[\u0600-\u06FF]/.test(t)) return false;
  if (EMPHASIS_WORDS.has(t.toLowerCase())) return true;
  if (/^[A-Z]{2,}$/.test(t)) return true;
  if (/^(Tacos|Lyon|TikTok|Instagram|YouTube|FREE)$/i.test(t)) return true;
  return false;
}

function restoreLatinHybrid(text) {
  let out = String(text || '');
  for (const rule of LATIN_RESTORE) {
    out = out.replace(rule.re, rule.to);
  }
  return out;
}

function matchEntity(text) {
  const t = String(text || '');
  for (const ent of ENTITY_LEXICON) {
    if (ent.re.test(t)) return ent;
  }
  return null;
}

function applyHybridToCaptions(captions) {
  return (captions || []).map((c) => {
    const text = restoreLatinHybrid(c.text);
    const hasArabic = /[\u0600-\u06FF]/.test(text);
    return {
      ...c,
      text,
      // Hybrid Darija: gold Latin brands. Pure English: only emphasis keywords.
      highlightLatin: hasArabic
        ? /\b[A-Za-z][A-Za-z0-9'’\-]{1,24}\b/.test(text)
        : text.split(/\s+/).some((w) => shouldHighlightToken(w)),
      lang: hasArabic ? 'ar' : 'en',
    };
  });
}

function applyHybridToTimeline(timeline) {
  for (const clip of timeline || []) {
    if (clip.text) clip.text = restoreLatinHybrid(clip.text);
  }
  return timeline;
}

module.exports = {
  LATIN_RESTORE,
  ENTITY_LEXICON,
  EMPHASIS_WORDS,
  restoreLatinHybrid,
  matchEntity,
  shouldHighlightToken,
  applyHybridToCaptions,
  applyHybridToTimeline,
};
