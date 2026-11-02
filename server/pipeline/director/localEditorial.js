const { VARIANT_DEFS } = require('./schema');
const { buildIdeaUnits } = require('./ideaUnits');
const { clusterRetakes } = require('./retakes');
const { prepareSpeechSegments, skipWarmup, rmsSeries, loadMono16k } = require('./silence');
const { attachSparseOverlays } = require('./overlays');
const { attachEffectBeats, attachSfxEvents } = require('./effectBeats');
const {
  restoreLatinHybrid,
  applyHybridToCaptions,
  applyHybridToTimeline,
} = require('./hybridLexicon');

/**
 * Local Super Editor — continuous talking-head after silence/retake cleanup.
 * Three variants share the spine; hook offset / captions / motion / overlays differ.
 */

const ARABIC_RE = /[\u0600-\u06FF]/;

/**
 * Non-overlapping kinetic captions from word timings (EN + Darija).
 * Never dumps full clip.text into a crumb cut — that caused stacked illegible captions.
 */
function buildCaptionsForTimeline(timeline, words, captionStyle) {
  let t = 0;
  const events = [];
  const maxWords = captionStyle === 'documentary' ? 4 : captionStyle === 'cinematic' ? 3 : 3;
  const minHold = captionStyle === 'viral' || captionStyle === 'kinetic' ? 0.55 : 0.7;

  for (const clip of timeline) {
    const clipDur = Math.max(0.25, clip.srcEnd - clip.srcStart);
    const clipWords = (words || [])
      .filter((w) => {
        const mid = ((w.start || 0) + (w.end || 0)) / 2;
        return mid >= clip.srcStart - 0.02 && mid <= clip.srcEnd + 0.02;
      })
      .map((w) => ({
        word: String(w.word || '').trim(),
        start: w.start,
        end: w.end,
      }))
      .filter((w) => w.word.length);

    if (clipWords.length >= 1) {
      let i = 0;
      let lastEnd = t;
      while (i < clipWords.length) {
        const parts = [clipWords[i].word];
        let wStart = clipWords[i].start;
        let wEnd = clipWords[i].end;
        i += 1;
        while (i < clipWords.length && parts.length < maxWords) {
          const gap = clipWords[i].start - clipWords[i - 1].end;
          if (gap > 0.55) break;
          parts.push(clipWords[i].word);
          wEnd = clipWords[i].end;
          i += 1;
        }
        let start = t + Math.max(0, wStart - clip.srcStart);
        let end = t + Math.max(0.05, wEnd - clip.srcStart);
        // Sequential — never overlap previous caption
        if (start < lastEnd) start = lastEnd;
        end = Math.max(end, start + minHold);
        end = Math.min(end, t + clipDur);
        if (end - start < 0.28) {
          // too tight inside crumb — skip rather than stack
          continue;
        }
        const text = restoreLatinHybrid(parts.join(' '));
        events.push({
          start: Number(start.toFixed(3)),
          end: Number(end.toFixed(3)),
          text,
          style: captionStyle,
          phrase: true,
          pop: true,
          anim: 'pop',
          lang: ARABIC_RE.test(text) ? 'ar' : 'en',
        });
        lastEnd = end;
      }
    } else if (clipDur >= 1.0) {
      // Fallback only on real holds — never on cutaway crumbs
      const raw = restoreLatinHybrid(clip.text || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (raw.length) {
        const chunkSize = captionStyle === 'viral' || captionStyle === 'kinetic' ? 3 : 4;
        const chunks = [];
        for (let i = 0; i < raw.length; i += chunkSize) chunks.push(raw.slice(i, i + chunkSize).join(' '));
        const slice = clipDur / chunks.length;
        let lastEnd = t;
        chunks.forEach((text, idx) => {
          let start = Math.max(lastEnd, t + idx * slice + 0.02);
          let end = Math.min(t + clipDur, start + Math.max(minHold, slice * 0.85));
          if (end - start < 0.3) return;
          events.push({
            start: Number(start.toFixed(3)),
            end: Number(end.toFixed(3)),
            text: restoreLatinHybrid(text),
            style: captionStyle,
            phrase: true,
            pop: true,
            anim: 'pop',
            lang: ARABIC_RE.test(text) ? 'ar' : 'en',
          });
          lastEnd = end;
        });
      }
    }
    t += clipDur;
  }
  return applyHybridToCaptions(events);
}

function findIdeaForSeg(seg, ideaUnits) {
  return ideaUnits.find((u) => seg.start < u.end && seg.end > u.start);
}

/**
 * Split long talking-head segments into punchy jump-cut clips (~2.2–2.8s).
 */
function chopForJumpCuts(seg, role) {
  const dur = seg.end - seg.start;
  if (dur < 3.4) {
    return [{ ...seg, role }];
  }
  const pieces = [];
  let cursor = seg.start;
  let i = 0;
  while (cursor < seg.end - 0.5) {
    const remain = seg.end - cursor;
    const hold = remain <= 3.6 ? remain : Math.min(2.7, Math.max(2.1, remain / Math.ceil(remain / 2.5)));
    const end = Math.min(seg.end, cursor + hold);
    if (end - cursor >= 0.7) {
      pieces.push({
        ...seg,
        start: cursor,
        end,
        text: seg.text,
        role: i === 0 ? role : 'body',
      });
      i += 1;
    }
    cursor = end;
  }
  return pieces.length ? pieces : [{ ...seg, role }];
}

/**
 * Continuous chronological pack to softTarget.
 */
function assembleContinuousReel(variant, ideaUnits, keepSegments, words, styleIndex) {
  const soft = variant.softTargetSec || 100;
  const ordered = [...keepSegments].sort((a, b) => a.start - b.start);
  if (!ordered.length) {
    throw new Error('No speech segments available to assemble reel');
  }

  const availableSec = ordered.reduce((a, s) => a + Math.max(0, s.end - s.start), 0);
  // Short takes: always keep ALL speech. Long takes: pack to soft target.
  const useAllKeep = availableSec < soft * 0.95 || availableSec < 70;
  const target = useAllKeep ? availableSec : soft;

  const ratio = variant.hookOffsetRatio != null ? variant.hookOffsetRatio : styleIndex / 10;
  const startIdx = useAllKeep
    ? 0
    : Math.min(ordered.length - 1, Math.floor(ratio * ordered.length));

  const timeline = [];
  let total = 0;
  const usedIdea = new Set();
  const punch = variant.motion === 'punch';

  const push = (seg, role) => {
    const chops = chopForJumpCuts(seg, role);
    let added = 0;
    for (const piece of chops) {
      const dur = piece.end - piece.start;
      if (dur < 0.45) continue;
      // Localize text to words actually spoken in this chop (avoids every clip matching "platform")
      const localWords = (words || [])
        .filter((w) => {
          const mid = ((w.start || 0) + (w.end || 0)) / 2;
          return mid >= piece.start && mid <= piece.end;
        })
        .map((w) => w.word)
        .filter(Boolean);
      const localText = localWords.length
        ? restoreLatinHybrid(localWords.join(' '))
        : restoreLatinHybrid(piece.text || '');
      const idea = findIdeaForSeg(piece, ideaUnits);
      if (idea) usedIdea.add(idea.id);
      const emphasis = /!|\?|important|never|platform|job|free|فابور|مهم/i.test(localText || '');
      const usePunch = punch || emphasis;
      timeline.push({
        id: `c_${timeline.length + 1}`,
        role: timeline.length === 0 ? 'hook' : piece.role || role,
        text: localText,
        srcStart: piece.start,
        srcEnd: piece.end,
        start: piece.start,
        end: piece.end,
        ideaUnitIds: idea ? [idea.id] : [],
        takeGroupId: piece.takeGroupId,
        transitionIn: { type: 'cut', duration: 0, reason: 'jump cut' },
        transitionOut: { type: 'cut', reason: 'default' },
        camera: usePunch
          ? [
              { t: 0, zoom: 1.08, cx: 0.5, cy: 0.4, reason: 'establish' },
              { t: 0.35, zoom: 1.18, cx: 0.5, cy: 0.38, reason: 'punch-in' },
            ]
          : [{ t: 0, zoom: 1.1, cx: 0.5, cy: 0.42, reason: 'talking-head crop' }],
        captions: {
          mode: 'phrase',
          emphasize: String(piece.text || '')
            .split(/\s+/)
            .filter((w) => w.length >= 5)
            .slice(0, 3),
          animation: 'pop',
        },
        sfx: [],
        overlays: [],
        motionProfile: usePunch ? 'punch' : 'live',
      });
      added += dur;
    }
    return added;
  };

  const used = new Set();
  const walk = (from, role0) => {
    for (let i = from; i < ordered.length; i++) {
      const seg = ordered[i];
      const key = `${seg.start.toFixed(2)}-${seg.end.toFixed(2)}`;
      if (used.has(key)) continue;
      if (!useAllKeep) {
        if (total >= target && timeline.length >= 4) break;
        if (total + (seg.end - seg.start) > soft * 1.35 && total >= soft * 0.85) break;
      }
      used.add(key);
      total += push(seg, timeline.length === 0 ? 'hook' : role0);
    }
  };

  walk(startIdx, 'body');
  if (total < target * 0.95) walk(0, 'body');

  if (!timeline.length) {
    throw new Error('Failed to assemble continuous timeline');
  }

  timeline[timeline.length - 1].role = 'payoff';
  if (timeline[0]) timeline[0].transitionIn = { type: 'cut', duration: 0, reason: 'open' };
  applyHybridToTimeline(timeline);
  attachSparseOverlays(timeline, variant.overlayMax || 6);

  const rankedIdeas = [...ideaUnits].sort((a, b) => b.importance - a.importance);

  const plan = {
    ...variant,
    index: styleIndex + 1,
    targetDurationSec: soft,
    rationale: `${variant.name}: ${variant.chip || 'super editor spine'}. Entry @${ordered[startIdx].start.toFixed(1)}s → ${timeline.length} clips, ~${total.toFixed(0)}s${useAllKeep ? ' · full keep' : ''}.`,
    timeline,
    captions: [],
    totalDuration: total,
    discardedTakes: [],
    mustIncludeIdeaIds: rankedIdeas.slice(0, Math.min(6, rankedIdeas.length)).map((u) => u.id),
    music: { bed: variant.music, voiceDuckDb: -12, musicVol: Math.min(0.28, variant.musicVol || 0.22) },
  };

  attachEffectBeats(plan);
  plan.captions = buildCaptionsForTimeline(plan.timeline, words, variant.captionStyle);
  attachSfxEvents(plan);
  const cuts = plan.cutawayCount || 0;
  plan.rationale += ` · ${cuts} cutaways · ${(plan.effectBeats || []).length} fx · ${(plan.sfxEvents || []).length} sfx · ${plan.captions.length} caps`;
  return plan;
}

function segDur(s) {
  return Math.max(0, (s.end ?? s.srcEnd ?? 0) - (s.start ?? s.srcStart ?? 0));
}

function sumDur(list) {
  return (list || []).reduce((a, s) => a + segDur(s), 0);
}

/**
 * Build the keep-spine for assembly: prefer retake-cleaned speech, but never
 * collapse under ~80% of available speech (short EN takes were getting shredded).
 */
function buildStorySpine(segments, wavPath) {
  const rawDur = sumDur(segments);
  const prepared = prepareSpeechSegments(segments, wavPath);
  const audio = loadMono16k(wavPath);
  const rms = prepared.rms || rmsSeries(audio, 0.05);

  // Short takes: barely trim warmup so we keep the hook ("hello check this out…")
  let speechSegs =
    rawDur < 70
      ? prepared.segments
      : skipWarmup(prepared.segments, rms, { needSpeechSec: 1.2 });

  // If silence splitting ate the story, fall back to original ASR segments
  if (sumDur(speechSegs) < rawDur * 0.75) {
    speechSegs = segments.map((s) => ({ ...s }));
  }
  if (sumDur(speechSegs) < 45 && sumDur(prepared.segments) >= 45) {
    speechSegs = prepared.segments;
  }

  let { takeGroups, discardedTakes, keepSegments } = clusterRetakes(speechSegs, wavPath);
  if (!keepSegments.length) {
    throw new Error('Director found no usable speech segments after silence/retake filtering.');
  }

  const speechDur = sumDur(speechSegs);
  const keepDur = sumDur(keepSegments);
  // Short / medium takes: keep almost everything. Retake clustering is for long Darija takes.
  if (speechDur < 70 || keepDur < speechDur * 0.8 || rawDur < 70) {
    keepSegments = speechSegs;
    discardedTakes = [];
    takeGroups = takeGroups.length
      ? takeGroups
      : [{ id: 'tg_all', memberIndices: speechSegs.map((_, i) => i), bestIndex: 0, reason: 'short_take_full_keep' }];
  }

  const minStory = Math.min(55, Math.max(20, speechDur * 0.85));
  if (sumDur(keepSegments) < minStory && speechDur >= minStory * 0.9) {
    keepSegments = speechSegs;
    discardedTakes = [];
  }

  // Avoid double silence-splitting on short takes (it was deleting the open)
  const spine =
    rawDur < 70
      ? keepSegments.map((s, idx) => ({ ...s, i: s.i ?? idx }))
      : prepareSpeechSegments(keepSegments, wavPath).segments.map((s, idx) => ({
          ...s,
          i: keepSegments[idx]?.i ?? idx,
          takeGroupId: keepSegments[idx]?.takeGroupId,
        }));
  return { spine: spine.length ? spine : keepSegments, takeGroups, discardedTakes, speechSegs };
}

function runLocalDirector({ segments, words, wavPath, brief, meta }) {
  const { spine, takeGroups, discardedTakes } = buildStorySpine(segments, wavPath);
  const ideaUnits = buildIdeaUnits(spine);

  const plans = VARIANT_DEFS.map((variant, idx) => {
    const plan = assembleContinuousReel(variant, ideaUnits, spine, words, idx);
    plan.discardedTakes = discardedTakes;
    plan.briefTopic = brief?.niche || '';
    plan.zoom = variant.motion === 'punch' ? 1.16 : 1.1;
    plan.music = variant.music;
    plan.musicVol = Math.min(0.16, variant.musicVol || 0.1);
    plan.styleProfile = 'super_editor_local';
    plan._sourceDuration = meta?.duration || 0;
    return plan;
  });

  const editorial = {
    version: 2,
    engine: 'superEditor/local',
    ideaUnits,
    takeGroups,
    discardedTakes,
    speechSegmentCount: spine.length,
    coverage: {
      mustIncludeIdeaIds: ideaUnits
        .slice()
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 8)
        .map((u) => u.id),
    },
    meta: { duration: meta?.duration, brief, reference: 'references/vid1' },
  };

  return { editorial, plans };
}

module.exports = {
  runLocalDirector,
  assembleContinuousReel,
  buildCaptionsForTimeline,
  buildStorySpine,
  sumDur,
  segDur,
};
