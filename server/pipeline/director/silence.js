const fs = require('fs');

/**
 * Silence analysis on 16k mono PCM WAV (our pipeline extract format).
 */

function loadMono16k(wavPath) {
  if (!wavPath || !fs.existsSync(wavPath)) return null;
  const buf = fs.readFileSync(wavPath);
  if (buf.length < 44) return null;
  const data = buf.subarray(44);
  const samples = new Float32Array(Math.floor(data.length / 2));
  for (let i = 0; i < samples.length; i++) {
    samples[i] = data.readInt16LE(i * 2) / 32768;
  }
  return { samples, sampleRate: 16000 };
}

function rmsSeries(audio, hopSec = 0.05) {
  if (!audio) return null;
  const hop = Math.max(1, Math.floor(audio.sampleRate * hopSec));
  const series = [];
  for (let i = 0; i + hop <= audio.samples.length; i += hop) {
    let sum = 0;
    for (let j = 0; j < hop; j++) {
      const v = audio.samples[i + j];
      sum += v * v;
    }
    series.push(Math.sqrt(sum / hop));
  }
  return { series, hopSec };
}

function silenceThreshold(rms) {
  if (!rms?.series?.length) return 0.015;
  const sorted = [...rms.series].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0.02;
  return Math.max(0.012, median * 0.4);
}

/**
 * Tighten a timed segment to spoken audio (trim leading/trailing silence).
 */
function tightenSegment(seg, rms, opts = {}) {
  if (!rms) return { ...seg };
  const thr = opts.threshold ?? silenceThreshold(rms);
  const pad = opts.padSec ?? 0.08;
  let a = Math.max(0, Math.floor(seg.start / rms.hopSec));
  let b = Math.min(rms.series.length - 1, Math.ceil(seg.end / rms.hopSec));
  while (a < b && rms.series[a] < thr) a += 1;
  while (b > a && rms.series[b] < thr) b -= 1;
  const start = Math.max(seg.start, a * rms.hopSec - pad);
  const end = Math.min(seg.end, (b + 1) * rms.hopSec + pad);
  if (end - start < 0.35) return null;
  return { ...seg, start, end, srcStart: start, srcEnd: end };
}

/**
 * Split a segment on internal silence gaps ≥ gapSec.
 */
function splitOnInternalSilence(seg, rms, gapSec = 0.55) {
  if (!rms) return [seg];
  const thr = silenceThreshold(rms);
  const a = Math.max(0, Math.floor(seg.start / rms.hopSec));
  const b = Math.min(rms.series.length - 1, Math.ceil(seg.end / rms.hopSec));
  const parts = [];
  let runStart = null;
  let silentRun = 0;
  const gapHops = Math.max(1, Math.round(gapSec / rms.hopSec));

  const flush = (fromHop, toHop) => {
    const start = Math.max(seg.start, fromHop * rms.hopSec);
    const end = Math.min(seg.end, (toHop + 1) * rms.hopSec);
    if (end - start >= 0.4) {
      parts.push({ ...seg, start, end, srcStart: start, srcEnd: end });
    }
  };

  for (let i = a; i <= b; i++) {
    const silent = rms.series[i] < thr;
    if (!silent) {
      if (runStart == null) runStart = i;
      silentRun = 0;
    } else {
      silentRun += 1;
      if (runStart != null && silentRun >= gapHops) {
        flush(runStart, i - silentRun);
        runStart = null;
      }
    }
  }
  if (runStart != null) flush(runStart, b);
  return parts.length ? parts : [seg];
}

/**
 * Prepare speech-only segments: split internal silence, tighten edges, drop tiny leftovers.
 */
function prepareSpeechSegments(segments, wavPath) {
  const audio = loadMono16k(wavPath);
  const rms = rmsSeries(audio, 0.05);
  const out = [];
  for (const seg of segments) {
    const pieces = splitOnInternalSilence(seg, rms, 0.55);
    for (const p of pieces) {
      const tight = tightenSegment(p, rms);
      if (tight && tight.end - tight.start >= 0.45) out.push(tight);
    }
  }
  return { segments: out, rms };
}

/**
 * Skip leading warmup: drop early low-energy / pre-talk until sustained speech.
 */
function skipWarmup(segments, rms, opts = {}) {
  if (!segments.length) return segments;
  const minStart = opts.minStartSec ?? 0;
  const needSpeechSec = opts.needSpeechSec ?? 2.5;
  if (!rms) return segments.filter((s) => s.start >= minStart);

  const thr = silenceThreshold(rms);
  let spoken = 0;
  let gate = 0;
  for (let i = 0; i < rms.series.length; i++) {
    if (rms.series[i] >= thr) spoken += rms.hopSec;
    else spoken = Math.max(0, spoken - rms.hopSec * 0.5);
    if (spoken >= needSpeechSec) {
      gate = i * rms.hopSec - 0.3;
      break;
    }
  }
  const cut = Math.max(minStart, gate);
  return segments.filter((s) => s.end > cut + 0.2).map((s) => ({
    ...s,
    start: Math.max(s.start, cut),
    srcStart: Math.max(s.start, cut),
  }));
}

module.exports = {
  loadMono16k,
  rmsSeries,
  silenceThreshold,
  tightenSegment,
  splitOnInternalSilence,
  prepareSpeechSegments,
  skipWarmup,
};
