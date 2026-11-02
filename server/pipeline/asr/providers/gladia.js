const fs = require('fs');
const path = require('path');
const { normalizeTranscript } = require('../normalize');

/**
 * Gladia pre-recorded transcription. Requires GLADIA_API_KEY.
 */
async function transcribeGladia(audioPath, opts = {}) {
  const key = process.env.GLADIA_API_KEY;
  if (!key) {
    throw new Error('GLADIA_API_KEY is not set. Cannot use Gladia ASR provider.');
  }

  const buf = fs.readFileSync(audioPath);
  const form = new FormData();
  form.append('audio', new Blob([buf], { type: 'audio/wav' }), path.basename(audioPath) || 'audio.wav');

  const uploadRes = await fetch('https://api.gladia.io/v2/upload', {
    method: 'POST',
    headers: { 'x-gladia-key': key },
    body: form,
  });
  const uploadText = await uploadRes.text();
  if (!uploadRes.ok) {
    throw new Error(`Gladia upload failed (${uploadRes.status}): ${uploadText.slice(0, 500)}`);
  }
  const upload = JSON.parse(uploadText);
  const audioUrl = upload.audio_url || upload.result?.audio_url;
  if (!audioUrl) throw new Error('Gladia upload did not return audio_url');

  const initRes = await fetch('https://api.gladia.io/v2/pre-recorded', {
    method: 'POST',
    headers: {
      'x-gladia-key': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      language_config: {
        languages: ['ar', 'fr', 'en'],
        code_switching: true,
      },
      sentences: true,
      punctuation_enhanced: true,
    }),
  });
  const initText = await initRes.text();
  if (!initRes.ok) {
    throw new Error(`Gladia transcribe init failed (${initRes.status}): ${initText.slice(0, 500)}`);
  }
  const init = JSON.parse(initText);
  const resultUrl = init.result_url || init.id;
  if (!resultUrl) throw new Error('Gladia did not return result_url');

  // Poll
  let raw = null;
  const pollUrl = String(resultUrl).startsWith('http')
    ? resultUrl
    : `https://api.gladia.io/v2/pre-recorded/${init.id}`;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const r = await fetch(pollUrl, { headers: { 'x-gladia-key': key } });
    const t = await r.text();
    if (!r.ok) throw new Error(`Gladia poll failed (${r.status}): ${t.slice(0, 400)}`);
    const j = JSON.parse(t);
    const status = j.status || j.result?.status;
    if (status === 'done' || status === 'success' || j.result?.transcription) {
      raw = j.result || j;
      break;
    }
    if (status === 'error' || status === 'failed') {
      throw new Error(`Gladia transcription failed: ${t.slice(0, 400)}`);
    }
    if (opts.onProgress) opts.onProgress(`gladia_poll_${i}_status=${status || 'pending'}`);
  }
  if (!raw) throw new Error('Gladia transcription timed out');

  const outRaw = opts.outJsonPath || path.join(path.dirname(audioPath), 'transcript_gladia_raw.json');
  fs.writeFileSync(outRaw, JSON.stringify(raw, null, 2), 'utf8');

  const transcription = raw.transcription || raw;
  const utterances = transcription.utterances || transcription.sentences || [];
  const words = [];
  const segments = [];
  for (const u of utterances) {
    segments.push({
      start: u.start,
      end: u.end,
      text: u.text,
      avg_logprob: u.confidence != null ? Math.log(Math.max(1e-6, u.confidence)) : null,
      no_speech_prob: null,
    });
    for (const w of u.words || []) {
      words.push({
        start: w.start,
        end: w.end,
        word: w.word || w.text,
        probability: w.confidence != null ? w.confidence : null,
      });
    }
  }

  return normalizeTranscript({
    provider: 'gladia',
    model: process.env.GLADIA_ASR_MODEL || 'solaria',
    language: transcription.languages?.[0] || null,
    language_probability: 1,
    duration: opts.duration || 0,
    segments,
    words,
    rawPath: outRaw,
  });
}

module.exports = { transcribeGladia };
