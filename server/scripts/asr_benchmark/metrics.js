/**
 * Lightweight ASR metrics for Darija benchmarking.
 * CER is primary; WER is secondary (orthography variance).
 */

function normalizeForCer(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function cer(hypothesis, reference) {
  const h = normalizeForCer(hypothesis);
  const r = normalizeForCer(reference);
  if (!r.length) return h.length ? 1 : 0;
  return levenshtein(h, r) / r.length;
}

function wer(hypothesis, reference) {
  const h = normalizeForCer(hypothesis).split(/\s+/).filter(Boolean);
  const r = normalizeForCer(reference).split(/\s+/).filter(Boolean);
  if (!r.length) return h.length ? 1 : 0;
  return levenshtein(h.join('\u0001'), r.join('\u0001')) / r.length;
  // Note: token-level edit on joined tokens with separator approximates word edits poorly;
  // use proper word-level DP below.
}

function werWords(hypothesis, reference) {
  const h = normalizeForCer(hypothesis).split(/\s+/).filter(Boolean);
  const r = normalizeForCer(reference).split(/\s+/).filter(Boolean);
  if (!r.length) return h.length ? 1 : 0;
  const m = h.length;
  const n = r.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = h[i - 1] === r[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n] / n;
}

function inventRate(hypothesis, reference) {
  const h = new Set(normalizeForCer(hypothesis).split(/\s+/).filter(Boolean));
  const r = new Set(normalizeForCer(reference).split(/\s+/).filter(Boolean));
  if (!h.size) return 0;
  let invented = 0;
  for (const tok of h) if (!r.has(tok)) invented += 1;
  return invented / h.size;
}

function keywordRecall(hypothesis, keywords = []) {
  if (!keywords.length) return null;
  const h = normalizeForCer(hypothesis);
  let hit = 0;
  for (const k of keywords) {
    if (h.includes(normalizeForCer(k))) hit += 1;
  }
  return hit / keywords.length;
}

function scoreAgainstReference(hypothesisText, reference) {
  const refText = typeof reference === 'string' ? reference : reference.text || '';
  const keywords = typeof reference === 'object' ? reference.keywords || [] : [];
  return {
    cer: cer(hypothesisText, refText),
    wer: werWords(hypothesisText, refText),
    inventRate: inventRate(hypothesisText, refText),
    keywordRecall: keywordRecall(hypothesisText, keywords),
    hypChars: normalizeForCer(hypothesisText).length,
    refChars: normalizeForCer(refText).length,
  };
}

module.exports = { cer, werWords, inventRate, keywordRecall, scoreAgainstReference, normalizeForCer };
