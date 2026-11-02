/**
 * Canonical transcript schema used by Director + captions.
 */

function emptyTranscript(provider, model) {
  return {
    provider,
    model,
    language: null,
    language_probability: 0,
    languageHints: ['ary', 'ar', 'fr', 'en'],
    duration: 0,
    segments: [],
    words: [],
    lowConfidenceSpans: [],
    rawPath: null,
  };
}

function normalizeTranscript(partial) {
  const t = {
    ...emptyTranscript(partial.provider || 'unknown', partial.model || 'unknown'),
    ...partial,
  };
  t.segments = (t.segments || []).map((s) => ({
    start: Number(s.start) || 0,
    end: Number(s.end) || 0,
    text: String(s.text || '').trim(),
    avg_logprob: s.avg_logprob != null ? Number(s.avg_logprob) : null,
    no_speech_prob: s.no_speech_prob != null ? Number(s.no_speech_prob) : null,
  }));
  t.words = (t.words || []).map((w) => ({
    start: Number(w.start) || 0,
    end: Number(w.end) || 0,
    word: String(w.word || '').trim(),
    probability: w.probability != null ? Number(w.probability) : null,
  }));
  t.lowConfidenceSpans = t.lowConfidenceSpans || deriveLowConfidence(t);
  return t;
}

function deriveLowConfidence(t) {
  const spans = [];
  for (const w of t.words || []) {
    if (w.probability != null && w.probability < 0.45) {
      spans.push({ start: w.start, end: w.end, reason: 'low_word_probability', word: w.word });
    }
  }
  for (const s of t.segments || []) {
    if (s.avg_logprob != null && s.avg_logprob < -1.2) {
      spans.push({ start: s.start, end: s.end, reason: 'low_segment_logprob' });
    }
  }
  return spans;
}

module.exports = { emptyTranscript, normalizeTranscript, deriveLowConfidence };
