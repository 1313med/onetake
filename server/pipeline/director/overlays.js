/**
 * Content-driven UGC overlays: emoji + big word pops that explain the beat.
 */

const RULES = [
  { re: /قرآن|quran|coran/i, emoji: '📖', word: 'QURAN', label: 'quran' },
  { re: /الله|allah|rabbi|دين|iman/i, emoji: '🤲', word: 'FAITH', label: 'faith' },
  { re: /ناس|people|monde|مجتمع/i, emoji: '👥', word: 'PEOPLE', label: 'people' },
  { re: /مهم|important|khass|nécessaire|ضروري/i, emoji: '❗', word: 'IMPORTANT', label: 'important' },
  { re: /\?|؟|wach|3lach|pourquoi|why|علاش/i, emoji: '❓', word: 'WHY?', label: 'question' },
  { re: /حب|love|قلب|heart|عشق/i, emoji: '❤️', word: 'LOVE', label: 'emotion' },
  { re: /فلوس|money|argent|business|خدمة|work|رزق/i, emoji: '💡', word: 'IDEA', label: 'idea' },
  { re: /ولد|دراري|child|enfant|طفل/i, emoji: '🧒', word: 'KIDS', label: 'child' },
  { re: /مريض|sick|مرض|health|صحة/i, emoji: '🩺', word: 'HEALTH', label: 'health' },
  { re: /توكل|صبر|sabr|tawakkul/i, emoji: '🌱', word: 'SABR', label: 'patience' },
  { re: /نجاح|success|gagn|win|ربح/i, emoji: '🏆', word: 'WIN', label: 'success' },
  { re: /خوف|fear|peur|رعب/i, emoji: '😰', word: 'FEAR', label: 'fear' },
  { re: /حقيقة|truth|vrai|real/i, emoji: '🎯', word: 'TRUTH', label: 'truth' },
  { re: /تغير|change|changez|بدل/i, emoji: '🔄', word: 'CHANGE', label: 'change' },
];

const STOP = new Set(
  'و في من على إلى هذا هذه التي الذي ما لا إن أن أو يا مع كل عن قبل بعد ذلك لكن إذا كانت كانوا هي هو نحن أنا أنت الـ the a an of to in is are was for on with'.split(
    /\s+/
  )
);

function pickOverlayForText(text) {
  for (const rule of RULES) {
    if (rule.re.test(text || '')) {
      return {
        emoji: rule.emoji,
        word: rule.word,
        label: rule.label,
        reason: `UGC emphasis for ${rule.label}`,
      };
    }
  }
  return null;
}

/** Pull a punchy keyword from the line for mid-frame word pop */
function extractHookWord(text) {
  const words = String(text || '')
    .replace(/[^\p{L}\p{N}\s!?؟]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase()));
  if (!words.length) return null;
  // Prefer longest / emphatic
  const scored = words.map((w) => ({
    w,
    s: w.length + (/[!?؟]/.test(w) ? 4 : 0) + (/\p{Script=Arabic}/u.test(w) ? 2 : 0),
  }));
  scored.sort((a, b) => b.s - a.s);
  const top = scored[0].w.replace(/[!?؟]+$/g, '');
  return top.length > 14 ? top.slice(0, 14) : top;
}

function placeBundle(clip, { emoji, word, reason }, intensity = 1) {
  const dur = Math.max(0.5, clip.srcEnd - clip.srcStart);
  const at = Math.min(dur * 0.32, Math.max(0.12, dur * 0.25));
  const hold = Math.min(2.0, Math.max(1.0, dur * 0.5));
  const overlays = [];

  // Big keyword explaining the beat (center-upper)
  if (word) {
    overlays.push({
      type: 'word_pop',
      word: String(word).toUpperCase(),
      at,
      hold: hold * 0.95,
      x: 0.5,
      y: 0.36,
      size: 88 + intensity * 12,
      reason: reason || 'keyword pop',
    });
  }

  // Emoji bounce slightly lower / offset
  if (emoji) {
    overlays.push({
      type: 'emoji',
      emoji,
      at: at + 0.12,
      hold,
      x: 0.72,
      y: 0.52,
      size: 130 + intensity * 20,
      reason: reason || 'emoji beat',
    });
  }

  clip.overlays = overlays;
}

/**
 * Attach dense-but-tasteful UGC overlays (emoji + word pops) across timeline.
 */
function attachSparseOverlays(timeline, maxOverlays = 8) {
  const usedLabels = new Set();
  let count = 0;

  for (let i = 0; i < timeline.length; i++) {
    if (count >= maxOverlays) break;
    const clip = timeline[i];
    const hit = pickOverlayForText(clip.text);
    const hook = extractHookWord(clip.text);
    const roleBoost = clip.role === 'hook' || clip.role === 'payoff' ? 1 : 0;

    if (hit) {
      if (usedLabels.has(hit.label) && timeline.length > 10 && !roleBoost) continue;
      placeBundle(clip, { emoji: hit.emoji, word: hit.word || hook, reason: hit.reason }, 1 + roleBoost);
      usedLabels.add(hit.label);
      count += 1;
      continue;
    }

    // Every ~Nth clip still gets a keyword pop from speech (explains what was said)
    if (hook && (i % 4 === 0 || roleBoost)) {
      placeBundle(clip, { emoji: i % 8 === 0 ? '✨' : null, word: hook, reason: 'speech keyword pop' }, 1);
      count += 1;
    }
  }

  if (count < 3 && timeline.length) {
    const picks = [
      0,
      Math.floor(timeline.length * 0.4),
      timeline.length - 1,
    ];
    for (const idx of picks) {
      if (count >= Math.min(5, maxOverlays)) break;
      const clip = timeline[idx];
      if (!clip || (clip.overlays && clip.overlays.length)) continue;
      const hook = extractHookWord(clip.text) || (idx === 0 ? 'LISTEN' : idx === timeline.length - 1 ? 'GO' : 'NOTE');
      const emoji = idx === 0 ? '🔥' : idx === timeline.length - 1 ? '🚀' : '💡';
      placeBundle(clip, { emoji, word: hook, reason: 'fallback UGC beat' }, 1.2);
      count += 1;
    }
  }

  return timeline;
}

module.exports = {
  pickOverlayForText,
  attachSparseOverlays,
  extractHookWord,
  RULES,
};
