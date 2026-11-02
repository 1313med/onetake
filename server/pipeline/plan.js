/**
 * Build THREE complete creative timelines from the FULL transcript.
 * NOT chronological slices of the source.
 */

const STYLES = [
  {
    id: 'variant_a',
    name: 'Variant 1 · Hook punch',
    captionStyle: 'viral',
    grade: 'viral',
    music: 'variant_a.mp3',
    musicVol: 0.14,
    targetSec: 100,
    zoom: 1.12,
    jumpMaxGap: 0.35,
  },
  {
    id: 'variant_b',
    name: 'Variant 2 · Clean story',
    captionStyle: 'documentary',
    grade: 'doc',
    music: 'variant_b.mp3',
    musicVol: 0.07,
    targetSec: 105,
    zoom: 1.06,
    jumpMaxGap: 0.15,
  },
  {
    id: 'variant_c',
    name: 'Variant 3 · Warm cut',
    captionStyle: 'cinematic',
    grade: 'cinematic',
    music: 'variant_c.mp3',
    musicVol: 0.11,
    targetSec: 108,
    zoom: 1.06,
    jumpMaxGap: 0.12,
  },
];

function planFiveVersions(cleanSegments, words, meta, brief = {}) {
  if (!cleanSegments.length) {
    throw new Error('No speech segments found after transcription/dedupe');
  }

  const scored = cleanSegments.map((s, i) => ({
    ...s,
    i,
    score: segmentScore(s, i, cleanSegments.length),
  }));

  const hookPool = [...scored].sort((a, b) => b.score - a.score);
  const bodyPool = [...scored].sort((a, b) => a.start - b.start);

  return STYLES.map((style, idx) => {
    const timeline = assembleTimeline(style, hookPool, bodyPool, scored, idx);
    const captions = buildCaptionsForTimeline(timeline, words, style.captionStyle);
    return {
      ...style,
      index: idx + 1,
      briefTopic: brief.niche || brief.topic || '',
      timeline,
      captions,
      totalDuration: timeline.reduce((a, c) => a + (c.end - c.start), 0),
      rationale: explain(style, timeline),
    };
  });
}

function segmentScore(s, i, n) {
  const dur = s.end - s.start;
  const words = s.text.split(/\s+/).length;
  const midBoost = i > n * 0.15 && i < n * 0.9 ? 0.4 : 0;
  const questionBoost = /[?؟]|why|comment|pourquoi|wach|3lach/i.test(s.text) ? 0.8 : 0;
  const energyBoost = /!|important|never|jamais|jamais|nécessaire|khass/i.test(s.text) ? 0.5 : 0;
  return (
    dur * 0.35 +
    Math.min(words, 18) * 0.12 +
    (s.avg_logprob || 0) * 2 -
    (s.no_speech_prob || 0) * 3 +
    midBoost +
    questionBoost +
    energyBoost
  );
}

/**
 * Each style picks a DIFFERENT opening hook + supporting body from whole video.
 */
function assembleTimeline(style, hookPool, bodyPool, scored, styleIndex) {
  const target = style.targetSec;
  const used = new Set();
  const clips = [];

  // Distinct hook per version (rotate through top hooks)
  const hook = hookPool[styleIndex % hookPool.length];
  clips.push(toClip(hook, 'hook'));
  used.add(hook.i);

  // Body strategy differs by style — NOT sequential file fifths
  let candidates;
  switch (style.id) {
    case 'viral-storytelling':
      // Hook first (even if late), then earliest context, then best proofs, then ending takeaway
      candidates = [
        ...bodyPool.filter((s) => s.start < hook.start && s.i !== hook.i),
        ...[...scored].sort((a, b) => b.score - a.score),
      ];
      break;
    case 'cinematic':
      candidates = [...scored].sort((a, b) => emotionScore(b) - emotionScore(a));
      break;
    case 'documentary':
      candidates = bodyPool; // chronological clarity AFTER a chosen authentic open
      break;
    case 'high-energy':
      candidates = [...scored].sort((a, b) => b.score - a.score);
      break;
    case 'experimental':
      // Start near end payoff, then weave mid + early context
      candidates = [
        ...[...scored].sort((a, b) => b.start - a.start),
        ...bodyPool,
      ];
      break;
    default:
      candidates = bodyPool;
  }

  let total = clips[0].end - clips[0].start;
  for (const seg of candidates) {
    if (used.has(seg.i)) continue;
    const dur = seg.end - seg.start;
    if (dur < 0.6) continue;
    // Soft target only — keep packing important segments past target when needed
    if (total + dur > target * 1.6 && total >= target * 0.85) continue;
    // keep narrative: avoid pure chaos — require some progression for doc
    clips.push(toClip(seg, 'body'));
    used.add(seg.i);
    total += dur;
    if (total >= target) break;
  }

  // Ensure payoff: add best unused high-score segment at end if short
  if (total < target * 0.7) {
    for (const seg of hookPool) {
      if (used.has(seg.i)) continue;
      clips.push(toClip(seg, 'payoff'));
      total += seg.end - seg.start;
      break;
    }
  }

  // Soft chronological sort WITHIN body after hook for documentary only
  if (style.id === 'documentary') {
    const [h, ...rest] = clips;
    rest.sort((a, b) => a.srcStart - b.srcStart);
    return [h, ...rest];
  }

  // For viral: keep hook first, sort rest for comprehension (time order after hook)
  if (style.id === 'viral-storytelling' || style.id === 'cinematic') {
    const [h, ...rest] = clips;
    rest.sort((a, b) => a.srcStart - b.srcStart);
    return [h, ...rest];
  }

  return clips;
}

function toClip(seg, role) {
  return {
    role,
    text: seg.text,
    srcStart: seg.start,
    srcEnd: seg.end,
    start: seg.start,
    end: seg.end,
  };
}

function emotionScore(s) {
  const emo = /(feel|heart|love|peur|حلم|حب|خايف|merci|thank)/i.test(s.text) ? 1.2 : 0;
  return segmentScore(s, s.i || 0, 20) + emo;
}

function buildCaptionsForTimeline(timeline, words, captionStyle) {
  // Rebuild continuous caption clock for finished video (0-based)
  let t = 0;
  const events = [];
  for (const clip of timeline) {
    const clipWords = (words || []).filter(
      (w) => w.start >= clip.srcStart - 0.05 && w.end <= clip.srcEnd + 0.05
    );
    if (clipWords.length) {
      for (const w of clipWords) {
        const localStart = t + Math.max(0, w.start - clip.srcStart);
        const localEnd = t + Math.max(0.04, w.end - clip.srcStart);
        events.push({
          start: localStart,
          end: localEnd,
          text: w.word.trim(),
          style: captionStyle,
        });
      }
    } else {
      // phrase-level fallback
      events.push({
        start: t,
        end: t + (clip.srcEnd - clip.srcStart),
        text: clip.text,
        style: captionStyle,
        phrase: true,
      });
    }
    t += clip.srcEnd - clip.srcStart;
  }
  return events;
}

function explain(style, timeline) {
  const opens = timeline[0];
  return `${style.name} opens on “${(opens?.text || '').slice(0, 60)}…” at ${opens?.srcStart?.toFixed?.(1)}s in the source, then weaves ${timeline.length} selected takes from across the recording (not a chronological slice).`;
}

function validateTimeline(plan, sourceDuration) {
  const issues = [];
  if (!plan.timeline.length) issues.push('empty timeline');
  for (const c of plan.timeline) {
    if (c.srcStart < 0 || c.srcEnd > sourceDuration + 0.5) issues.push('clip out of bounds');
    if (c.srcEnd <= c.srcStart) issues.push('invalid clip range');
  }
  if (plan.totalDuration < 5) issues.push('too short');
  // check not a single contiguous chronological block covering 1/5 of file
  const span =
    Math.max(...plan.timeline.map((c) => c.srcEnd)) -
    Math.min(...plan.timeline.map((c) => c.srcStart));
  const coverage = plan.totalDuration / Math.max(span, 0.01);
  // If they picked sparse clips, coverage of timeline/span is low — good.
  // Flag if timeline is basically one continuous fifth:
  const starts = plan.timeline.map((c) => c.srcStart).sort((a, b) => a - b);
  let contiguous = true;
  for (let i = 1; i < starts.length; i++) {
    const prev = plan.timeline.find((c) => c.srcStart === starts[i - 1]);
    if (starts[i] - prev.srcEnd > 2.5) contiguous = false;
  }
  const fifth = sourceDuration / 5;
  const minStart = Math.min(...plan.timeline.map((c) => c.srcStart));
  if (
    contiguous &&
    span <= fifth * 1.15 &&
    minStart >= fifth * plan.index - fifth * 1.1 &&
    minStart <= fifth * plan.index
  ) {
    issues.push('looks like chronological fifth — reject');
  }
  return { ok: issues.length === 0, issues, coverage };
}

module.exports = { planFiveVersions, validateTimeline, STYLES };
