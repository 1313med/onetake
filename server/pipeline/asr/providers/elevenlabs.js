const fs = require('fs');
const path = require('path');
const { normalizeTranscript } = require('../normalize');

/**
 * ElevenLabs Scribe. Requires ELEVENLABS_API_KEY.
 */
async function transcribeElevenLabs(audioPath, opts = {}) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error('ELEVENLABS_API_KEY is not set. Cannot use ElevenLabs Scribe provider.');
  }

  const model = opts.model || process.env.ELEVENLABS_ASR_MODEL || 'scribe_v1';
  const buf = fs.readFileSync(audioPath);
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'audio/wav' }), path.basename(audioPath) || 'audio.wav');
  form.append('model_id', model);
  form.append('timestamps_granularity', 'word');
  form.append('language_code', opts.languageCode || '');

  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`ElevenLabs ASR failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const raw = JSON.parse(text);
  const outRaw = opts.outJsonPath || path.join(path.dirname(audioPath), 'transcript_elevenlabs_raw.json');
  fs.writeFileSync(outRaw, JSON.stringify(raw, null, 2), 'utf8');

  const words = (raw.words || []).map((w) => ({
    start: w.start,
    end: w.end,
    word: w.text || w.word,
    probability: w.logprob != null ? Math.exp(w.logprob) : null,
  }));

  // Build crude segments from words if needed
  let segments = raw.segments || [];
  if (!segments.length && words.length) {
    segments = chunkWordsToSegments(words);
  }

  return normalizeTranscript({
    provider: 'elevenlabs',
    model,
    language: raw.language_code || raw.language,
    language_probability: raw.language_probability || 1,
    duration: raw.audio_duration || opts.duration || 0,
    segments: segments.map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text,
      avg_logprob: null,
      no_speech_prob: null,
    })),
    words,
    rawPath: outRaw,
  });
}

function chunkWordsToSegments(words, maxSec = 6) {
  const segs = [];
  let cur = [];
  let start = words[0]?.start || 0;
  for (const w of words) {
    if (!cur.length) start = w.start;
    cur.push(w);
    if (w.end - start >= maxSec) {
      segs.push({
        start,
        end: w.end,
        text: cur.map((x) => x.word).join(' '),
      });
      cur = [];
    }
  }
  if (cur.length) {
    segs.push({
      start,
      end: cur[cur.length - 1].end,
      text: cur.map((x) => x.word).join(' '),
    });
  }
  return segs;
}

module.exports = { transcribeElevenLabs };
