const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { normalizeTranscript } = require('../normalize');
const { ffmpegPath } = require('../../ffmpeg');
const { restoreLatinHybrid } = require('../../director/hybridLexicon');

/**
 * OpenAI transcription. Long takes are split into chunks — full-file whisper-1
 * often loops one Darija phrase and collapses coverage.
 *
 * IMPORTANT: Whisper `prompt` is vocabulary/style priming, NOT instructions.
 * Instructional prompts get echoed as fake transcript (seen in production).
 */
const DEFAULT_STYLE_PROMPT =
  'wach 3lach mzyan bzaf daba flous, merci vraiment ok marketing FREE visa tacos Tacos de Lyon Ireland Instagram TikTok, الله قرآن';

const PROMPT_LEAK_RE =
  /transcribe|modern standard|do not (repeat|translate)|darija as spoken|mixed with french|as spoken casually|whisper|timestamp/i;

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => {
      err += d.toString();
    });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-600) || `ffmpeg ${code}`))));
  });
}

async function getDurationSec(audioPath) {
  try {
    const { probe } = require('../../ffmpeg');
    const meta = await probe(audioPath);
    return Number(meta.format?.duration) || 0;
  } catch {
    return 0;
  }
}

function stylePrompt() {
  const raw = process.env.OPENAI_ASR_PROMPT || DEFAULT_STYLE_PROMPT;
  // If user still has an instructional prompt in .env, replace it.
  if (PROMPT_LEAK_RE.test(raw) || /do not /i.test(raw)) {
    return DEFAULT_STYLE_PROMPT;
  }
  return raw.slice(0, 220);
}

async function callOpenAITranscription(audioPath, key, model, opts = {}) {
  const buf = fs.readFileSync(audioPath);
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'audio/wav' }), path.basename(audioPath) || 'audio.wav');
  form.append('model', model);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('timestamp_granularities[]', 'segment');
  if (opts.language) {
    form.append('language', opts.language);
  }
  if (opts.prompt !== '') {
    form.append('prompt', opts.prompt != null ? opts.prompt : stylePrompt());
  }
  if (opts.temperature != null) {
    form.append('temperature', String(opts.temperature));
  }

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI ASR failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return JSON.parse(text);
}

async function sliceWav(src, outPath, startSec, durSec) {
  await runFfmpeg([
    '-y',
    '-ss',
    String(startSec),
    '-t',
    String(durSec),
    '-i',
    src,
    '-ac',
    '1',
    '-ar',
    '16000',
    '-c:a',
    'pcm_s16le',
    outPath,
  ]);
}

function isJunkSegment(s) {
  const text = String(s.text || '').trim();
  if (!text) return true;
  if (PROMPT_LEAK_RE.test(text)) return true;
  // Collapse Whisper character-loop hallucinations (…نجنجنج…)
  const compact = text.replace(/\s+/g, '');
  if (compact.length >= 8 && /(.)\1{5,}/u.test(compact)) return true;
  const words = text.split(/\s+/).filter(Boolean);
  const dur = Math.max(0, (s.end || 0) - (s.start || 0));
  const nsp = s.no_speech_prob != null ? Number(s.no_speech_prob) : null;
  // Only drop high no_speech when the line is also thin — long Arabic lines are often real.
  if (nsp != null && nsp >= 0.9 && words.length <= 3) return true;
  if (nsp != null && nsp >= 0.78 && words.length <= 2 && dur < 1.5) return true;
  if (dur < 0.25 && words.length <= 2) return true;
  return false;
}

function collectFromRaw(raw, offsetSec, intoSegs, intoWords) {
  for (const s of raw.segments || []) {
    if (isJunkSegment(s)) continue;
    const text = restoreLatinHybrid(String(s.text || '').trim());
    intoSegs.push({
      start: offsetSec + (s.start || 0),
      end: offsetSec + (s.end || s.start || 0),
      text,
      avg_logprob: s.avg_logprob,
      no_speech_prob: s.no_speech_prob,
    });
  }
  for (const w of raw.words || []) {
    const word = restoreLatinHybrid(String(w.word || '').trim());
    if (!word || PROMPT_LEAK_RE.test(word)) continue;
    intoWords.push({
      start: offsetSec + (w.start || 0),
      end: offsetSec + (w.end || w.start || 0),
      word,
      probability: null,
    });
  }
}

function speechStats(segments) {
  const speechSec = segments.reduce((a, s) => a + Math.max(0, (s.end || 0) - (s.start || 0)), 0);
  return { segs: segments.length, speechSec };
}

async function transcribePass(audioPath, key, model, duration, opts, onProgress) {
  const chunkSec = opts.chunkSec;
  const useChunks = duration > chunkSec * 1.15;
  const workDir = path.join(path.dirname(audioPath), '_asr_chunks');
  const allSegments = [];
  const allWords = [];
  let language = opts.language || null;

  const callOpts = {
    language: opts.language || undefined,
    prompt: opts.prompt,
    temperature: opts.temperature ?? 0,
  };

  if (!useChunks) {
    onProgress?.(`openai_single chunk_sec=${chunkSec} lang=${callOpts.language || 'auto'}`);
    let raw;
    try {
      raw = await callOpenAITranscription(audioPath, key, model, callOpts);
    } catch (err) {
      if (model !== 'whisper-1') {
        onProgress?.(`fallback_whisper-1 after ${model} error`);
        raw = await callOpenAITranscription(audioPath, key, 'whisper-1', callOpts);
      } else throw err;
    }
    language = raw.language || language;
    collectFromRaw(raw, 0, allSegments, allWords);
  } else {
    fs.mkdirSync(workDir, { recursive: true });
    const nChunks = Math.ceil(duration / chunkSec);
    onProgress?.(`openai_chunked chunks=${nChunks} chunk_sec=${chunkSec} lang=${callOpts.language || 'auto'}`);
    for (let i = 0; i < nChunks; i++) {
      const start = i * chunkSec;
      const dur = Math.min(chunkSec + 0.4, Math.max(0.5, duration - start));
      if (dur < 0.4) continue;
      const chunkPath = path.join(workDir, `chunk_${String(i).padStart(3, '0')}.wav`);
      await sliceWav(audioPath, chunkPath, start, dur);
      onProgress?.(`chunk ${i + 1}/${nChunks} t=${start.toFixed(0)}s`);
      // Carry last transcript text as continuation prompt (Whisper-recommended), not instructions.
      const carry =
        allSegments.length > 0
          ? allSegments
              .slice(-2)
              .map((s) => s.text)
              .join(' ')
              .slice(0, 180)
          : callOpts.prompt;
      let raw;
      try {
        raw = await callOpenAITranscription(chunkPath, key, model, { ...callOpts, prompt: carry });
      } catch (err) {
        if (model !== 'whisper-1') {
          raw = await callOpenAITranscription(chunkPath, key, 'whisper-1', { ...callOpts, prompt: carry });
        } else throw err;
      }
      language = raw.language || language;
      collectFromRaw(raw, start, allSegments, allWords);
      try {
        fs.unlinkSync(chunkPath);
      } catch {
        /* ignore */
      }
    }
  }

  return { segments: allSegments, words: allWords, language, chunked: useChunks, chunkSec };
}

async function transcribeOpenAI(audioPath, opts = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY is not set. Cannot use OpenAI ASR provider.');
  }

  const model = opts.model || process.env.OPENAI_ASR_MODEL || 'whisper-1';
  const duration = (await getDurationSec(audioPath)) || 0;
  const onProgress = opts.onProgress;
  const envLang = process.env.OPENAI_ASR_LANGUAGE; // 'ar' | 'auto' | empty
  const preferLang = envLang && envLang !== 'auto' ? envLang : null;

  // Pass 1: style prompt + preferred language + 30s chunks (tighter than 45)
  const chunk1 = Number(process.env.OPENAI_ASR_CHUNK_SEC || 30);
  let result = await transcribePass(
    audioPath,
    key,
    model,
    duration,
    {
      chunkSec: chunk1,
      language: preferLang,
      prompt: stylePrompt(),
      temperature: 0,
    },
    onProgress
  );

  let stats = speechStats(result.segments);
  // Aim for ~45%+ of file as speech on long talking-heads (energy often ~70%+).
  const needSpeech = duration > 60 ? Math.min(70, Math.max(45, duration * 0.4)) : 0;
  const needSegs = duration > 60 ? 12 : 0;

  // Pass 2: auto language + shorter chunks + vocabulary-only prompt (no force ar)
  if (duration > 60 && (stats.speechSec < needSpeech || stats.segs < needSegs)) {
    onProgress?.(
      `asr_retry weak_coverage segs=${stats.segs} speech=${stats.speechSec.toFixed(0)}s → auto+20s chunks`
    );
    result = await transcribePass(
      audioPath,
      key,
      'whisper-1',
      duration,
      {
        chunkSec: 20,
        language: null,
        prompt: DEFAULT_STYLE_PROMPT,
        temperature: 0,
      },
      onProgress
    );
    stats = speechStats(result.segments);
  }

  // Pass 3: empty prompt + 15s chunks — keep language auto (forcing ar → MSA)
  if (duration > 60 && (stats.speechSec < needSpeech || stats.segs < needSegs)) {
    onProgress?.(`asr_retry_empty_prompt segs=${stats.segs} speech=${stats.speechSec.toFixed(0)}s`);
    result = await transcribePass(
      audioPath,
      key,
      'whisper-1',
      duration,
      {
        chunkSec: 15,
        language: null,
        prompt: '',
        temperature: 0,
      },
      onProgress
    );
    stats = speechStats(result.segments);
  }

  const outRaw = opts.outJsonPath || path.join(path.dirname(audioPath), 'transcript_openai_raw.json');
  fs.writeFileSync(
    outRaw,
    JSON.stringify(
      {
        model,
        language: result.language,
        duration,
        segments: result.segments,
        words: result.words,
        chunked: result.chunked,
        chunkSec: result.chunkSec,
        speechSec: stats.speechSec,
      },
      null,
      2
    ),
    'utf8'
  );

  return normalizeTranscript({
    provider: 'openai',
    model: result.chunked ? `${model}+chunk${result.chunkSec}` : model,
    language: result.language || preferLang || 'ar',
    language_probability: 1,
    duration,
    segments: result.segments,
    words: result.words,
    rawPath: outRaw,
  });
}

module.exports = { transcribeOpenAI, stylePrompt, isJunkSegment, DEFAULT_STYLE_PROMPT };
