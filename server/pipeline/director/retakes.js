const fs = require('fs');

/**
 * Retake clustering: pick ONE best delivery when the speaker repeats a line.
 * ASR often writes the same Darija phrase as different Arabic spellings
 * (ويلا حيد / ويلا حايد) — so we use fuzzy char similarity, not exact text.
 */

function normalize(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(t) {
  return new Set(normalize(t).split(/\s+/).filter((w) => w.length > 1));
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function charSim(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) {
    return Math.min(x.length, y.length) / Math.max(x.length, y.length);
  }
  // cheap bigram Dice
  const grams = (s) => {
    const g = new Set();
    for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2));
    return g;
  };
  const A = grams(x.replace(/\s/g, ''));
  const B = grams(y.replace(/\s/g, ''));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter += 1;
  return (2 * inter) / (A.size + B.size);
}

function loadRmsSeries(wavPath, hopSec = 0.25) {
  if (!wavPath || !fs.existsSync(wavPath)) return null;
  const buf = fs.readFileSync(wavPath);
  if (buf.length < 44) return null;
  const data = buf.subarray(44);
  const sampleRate = 16000;
  const hop = Math.floor(sampleRate * hopSec);
  const series = [];
  for (let i = 0; i + hop * 2 <= data.length; i += hop * 2) {
    let sum = 0;
    for (let s = 0; s < hop; s++) {
      const v = data.readInt16LE(i + s * 2) / 32768;
      sum += v * v;
    }
    series.push(Math.sqrt(sum / hop));
  }
  return { series, hopSec };
}

function sliceRms(rms, start, end) {
  if (!rms) return [];
  const a = Math.max(0, Math.floor(start / rms.hopSec));
  const b = Math.min(rms.series.length, Math.ceil(end / rms.hopSec));
  return rms.series.slice(a, b);
}

function cosine(a, b) {
  if (!a.length || !b.length) return 0;
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function deliveryScore(seg) {
  const dur = Math.max(0.1, seg.end - seg.start);
  const words = normalize(seg.text).split(/\s+/).filter(Boolean).length;
  const lp = seg.avg_logprob != null ? seg.avg_logprob : -1;
  const nsp = seg.no_speech_prob != null ? seg.no_speech_prob : 0.2;
  // Strong preference for later takes (speaker usually improves after mistakes)
  return dur * 1.1 + Math.min(words, 40) * 0.2 + lp * 2.5 - nsp * 4 + (seg.start || 0) * 0.01;
}

function sameRetake(a, b, rms, opts) {
  const textThresh = opts.textThresh ?? 0.42;
  const fuzzyThresh = opts.fuzzyThresh ?? 0.62;
  const audioThresh = opts.audioThresh ?? 0.82;
  const maxGap = opts.maxGapSec ?? 90;

  const gap = b.start - a.end;
  if (gap > maxGap || gap < -1) return false;

  const textSim = jaccard(tokenSet(a.text), tokenSet(b.text));
  const fuzzy = charSim(a.text, b.text);
  const ra = sliceRms(rms, a.start, a.end);
  const rb = sliceRms(rms, b.start, b.end);
  const audioSim = cosine(ra, rb);

  return (
    textSim >= textThresh ||
    fuzzy >= fuzzyThresh ||
    (audioSim >= audioThresh && (textSim >= 0.2 || fuzzy >= 0.45))
  );
}

/**
 * @returns {{ takeGroups, discardedTakes, keepSegments }}
 */
function clusterRetakes(segments, wavPath, opts = {}) {
  const rms = loadRmsSeries(wavPath);
  const groups = [];
  const assigned = new Array(segments.length).fill(null);

  for (let i = 0; i < segments.length; i++) {
    if (assigned[i] != null) continue;
    const members = [i];

    for (let j = i + 1; j < segments.length; j++) {
      if (assigned[j] != null) continue;
      const anchor = segments[members[members.length - 1]];
      if (sameRetake(anchor, segments[j], rms, opts) || sameRetake(segments[i], segments[j], rms, opts)) {
        members.push(j);
      }
    }

    const gid = `tg_${groups.length + 1}`;
    for (const m of members) assigned[m] = gid;

    const scored = members.map((idx) => ({
      idx,
      seg: segments[idx],
      score: deliveryScore(segments[idx]),
    }));
    scored.sort((x, y) => y.score - x.score);

    groups.push({
      id: gid,
      memberIndices: members,
      bestIndex: scored[0].idx,
      bestScore: scored[0].score,
      reason:
        members.length > 1
          ? `Clustered ${members.length} retakes (fuzzy Darija/ASR); kept strongest/latest delivery`
          : 'Single take',
    });
  }

  const discardedTakes = [];
  const keepSet = new Set();
  for (const g of groups) {
    keepSet.add(g.bestIndex);
    for (const idx of g.memberIndices) {
      if (idx === g.bestIndex) continue;
      const s = segments[idx];
      discardedTakes.push({
        srcStart: s.start,
        srcEnd: s.end,
        text: s.text,
        reason: 'weaker_or_earlier_retake',
        takeGroupId: g.id,
      });
    }
  }

  let keepSegments = segments
    .map((s, i) => ({ ...s, i, takeGroupId: assigned[i] }))
    .filter((_, i) => keepSet.has(i));

  // Second pass: collapse remaining near-duplicates that slipped (different ASR spellings)
  keepSegments = collapseLingeringDupes(keepSegments, rms, opts);

  return { takeGroups: groups, discardedTakes, keepSegments };
}

function collapseLingeringDupes(keepSegments, rms, opts) {
  if (keepSegments.length < 2) return keepSegments;
  const drop = new Set();
  for (let i = 0; i < keepSegments.length; i++) {
    if (drop.has(i)) continue;
    for (let j = i + 1; j < keepSegments.length; j++) {
      if (drop.has(j)) continue;
      if (!sameRetake(keepSegments[i], keepSegments[j], rms, { ...opts, maxGapSec: opts.maxGapSec ?? 90 })) {
        continue;
      }
      const si = deliveryScore(keepSegments[i]);
      const sj = deliveryScore(keepSegments[j]);
      if (sj >= si) drop.add(i);
      else drop.add(j);
    }
  }
  return keepSegments.filter((_, i) => !drop.has(i));
}

module.exports = { clusterRetakes, deliveryScore, jaccard, cosine, charSim, normalize };
