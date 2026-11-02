const fs = require('fs');
const path = require('path');
const { VARIANT_DEFS } = require('./schema');
const {
  buildCaptionsForTimeline,
  assembleContinuousReel,
  buildStorySpine,
} = require('./localEditorial');
const { buildIdeaUnits } = require('./ideaUnits');
const { prepareSpeechSegments } = require('./silence');
const { attachEffectBeats, attachSfxEvents } = require('./effectBeats');
const { attachSparseOverlays } = require('./overlays');
const { applyHybridToTimeline } = require('./hybridLexicon');

/**
 * LLM Super Editor: silence/retake spine locally, then LLM only for variant polish
 * (or full EDL if it returns usable timelines). Falls back to local continuous assemble.
 */
async function runLlmDirector(ctx) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      'OPENAI_API_KEY is not set. Cannot use LLM Director. Set OPENAI_API_KEY in .env.'
    );
  }
  const model = process.env.DIRECTOR_MODEL || 'gpt-4.1-mini';
  const system = fs.readFileSync(path.join(__dirname, 'prompts', 'system.md'), 'utf8');

  // Local speech prep — full-coverage spine (retakes can't collapse under 45s)
  const { spine: spineSegs, takeGroups, discardedTakes } = buildStorySpine(ctx.segments, ctx.wavPath);
  const ideaUnits = buildIdeaUnits(spineSegs);

  // Reliable local spine first (vid1 continuous ~100s)
  const localPlans = VARIANT_DEFS.map((variant, idx) => {
    const plan = assembleContinuousReel(variant, ideaUnits, spineSegs, ctx.words || [], idx);
    plan.discardedTakes = discardedTakes;
    plan.briefTopic = ctx.brief?.niche || '';
    plan.styleProfile = 'super_editor_spine';
    plan.music = variant.music;
    plan.musicVol = variant.musicVol;
    return plan;
  });

  const payload = {
    brief: ctx.brief,
    durationSec: ctx.meta?.duration,
    softTargetSec: 100,
    ideaUnits: ideaUnits.slice(0, 40).map((u) => ({
      id: u.id,
      start: u.start,
      end: u.end,
      text: u.text,
      importance: u.importance,
    })),
    keepSegments: spineSegs.slice(0, 120).map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text,
      takeGroupId: s.takeGroupId,
      avg_logprob: s.avg_logprob,
    })),
    discardedTakes: discardedTakes.slice(0, 40),
    variants: VARIANT_DEFS.map((v) => ({
      id: v.id,
      name: v.name,
      softTargetSec: v.softTargetSec,
      hookOffsetRatio: v.hookOffsetRatio,
      captionStyle: v.captionStyle,
      music: v.music,
      chip: v.chip,
    })),
    // Hint: local spine durations so LLM can polish rather than invent short packs
    localSpineSeconds: localPlans.map((p) => ({
      id: p.id,
      totalDuration: Number(p.totalDuration.toFixed(1)),
      clips: p.timeline.length,
    })),
  };

  const user =
    `Polish three Super Editor variant EDLs. Prefer the continuous ~100s spine from keepSegments. ` +
    `Return exactly 3 plans with ids variant_a..variant_c. Shared story; different hook offset / captions / motion only.\n\n` +
    JSON.stringify(payload).slice(0, 120000);

  let parsed = null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content:
              user +
              '\nReturn JSON: { "plans": [ { "id", "timeline":[{"srcStart","srcEnd","role","text","transitionIn","camera","captions","overlays","sfx"}], "mustIncludeIdeaIds", "rationale", "targetDurationSec" } ] }',
          },
        ],
      }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`LLM Director failed (${res.status}): ${text.slice(0, 500)}`);
    const raw = JSON.parse(text);
    const content = raw.choices?.[0]?.message?.content;
    if (!content) throw new Error('LLM Director returned empty content');
    parsed = JSON.parse(content);
  } catch (err) {
    console.warn('[llmDirector] using local continuous spine:', err.message);
    return {
      editorial: {
        version: 2,
        engine: `superEditor/localSpine(llm_error:${err.message})`,
        ideaUnits,
        takeGroups,
        discardedTakes,
        speechSegmentCount: spineSegs.length,
        coverage: {
          mustIncludeIdeaIds: ideaUnits
            .slice()
            .sort((a, b) => b.importance - a.importance)
            .slice(0, 8)
            .map((u) => u.id),
        },
      },
      plans: localPlans,
    };
  }

  const byId = new Map((parsed.plans || []).map((p) => [p.id, p]));
  const plans = VARIANT_DEFS.map((variant, idx) => {
    const llm = byId.get(variant.id) || parsed.plans?.[idx] || {};
    let timeline = (llm.timeline || [])
      .map((c, i) => normalizeClip(c, i, spineSegs, variant))
      .filter(Boolean);

    const llmDur = timeline.reduce((a, c) => a + (c.srcEnd - c.srcStart), 0);
    const localDur = localPlans[idx].totalDuration || 0;
    const asrSpeech =
      Number(ctx.speechSec) ||
      spineSegs.reduce((a, s) => a + Math.max(0, (s.end || 0) - (s.start || 0)), 0) ||
      localDur;
    // Prefer local whenever LLM drops meaningful speech (esp. short EN takes).
    const llmTooShort =
      !timeline.length ||
      llmDur < localDur * 0.85 ||
      llmDur < Math.max(12, asrSpeech * 0.7) ||
      llmDur + 2 < localDur;
    if (llmTooShort) {
      const locked = {
        ...localPlans[idx],
        rationale:
          (llm.rationale || localPlans[idx].rationale) +
          ' · spine locked locally (LLM timeline too short)',
        engineNote: 'local_spine_preferred',
      };
      // localPlans already went through cutaways + captions + sfx
      if (locked.effectBeats?.length && locked.captions?.length) return locked;
      attachEffectBeats(locked);
      locked.captions = buildCaptionsForTimeline(locked.timeline, ctx.words || [], variant.captionStyle);
      attachSfxEvents(locked);
      return locked;
    }

    // soft-xfade only when variant.allowXfade; others hard cut
    if (!variant.allowXfade) {
      for (const c of timeline) {
        c.transitionIn = { type: 'cut', duration: 0, reason: 'jump cut (super editor)' };
      }
    }

    applyHybridToTimeline(timeline);
    attachSparseOverlays(timeline, variant.overlayMax || 8);
    const plan = attachEffectBeats({
      ...variant,
      index: idx + 1,
      targetDurationSec: llm.targetDurationSec || variant.softTargetSec,
      rationale: llm.rationale || `${variant.name}: ${variant.chip}`,
      timeline,
      captions: [],
      totalDuration: llmDur,
      discardedTakes,
      mustIncludeIdeaIds: llm.mustIncludeIdeaIds || localPlans[idx].mustIncludeIdeaIds,
      music: variant.music,
      musicVol: variant.musicVol,
      zoom: variant.motion === 'punch' ? 1.12 : 1.06,
      briefTopic: ctx.brief?.niche || '',
      styleProfile: 'super_editor_llm',
    });
    plan.captions = buildCaptionsForTimeline(plan.timeline, ctx.words || [], variant.captionStyle);
    attachSfxEvents(plan);
    return plan;
  });

  return {
    editorial: {
      version: 2,
      engine: `superEditor/llm:${model}`,
      ideaUnits,
      takeGroups,
      discardedTakes,
      speechSegmentCount: spineSegs.length,
      coverage: {
        mustIncludeIdeaIds: ideaUnits
          .slice()
          .sort((a, b) => b.importance - a.importance)
          .slice(0, 8)
          .map((u) => u.id),
      },
    },
    plans,
  };
}

function normalizeClip(c, i, keepSegments, variant) {
  const srcStart = Number(c.srcStart);
  const srcEnd = Number(c.srcEnd);
  if (!(srcEnd > srcStart)) return null;
  let text = c.text || '';
  const hit = keepSegments.find(
    (s) => Math.abs(s.start - srcStart) < 0.4 && Math.abs(s.end - srcEnd) < 0.6
  );
  if (hit) text = hit.text;
  const emphasis = /!|\?|مهم|never|khass|important|قرآن|الله/i.test(text || '');
  const punch = variant?.motion === 'punch' || emphasis;
  return {
    id: c.id || `c_${i + 1}`,
    role: c.role || 'body',
    text,
    srcStart,
    srcEnd,
    start: srcStart,
    end: srcEnd,
    ideaUnitIds: c.ideaUnitIds || [],
    takeGroupId: c.takeGroupId || hit?.takeGroupId,
    transitionIn: c.transitionIn || { type: 'cut', duration: 0, reason: 'jump cut' },
    transitionOut: c.transitionOut || { type: 'cut', reason: 'default' },
    // Ignore bloated/flat LLM camera arrays — renderer enforces punch-in
    camera: punch
      ? [
          { t: 0, zoom: 1.06, cx: 0.5, cy: 0.42, reason: 'establish' },
          { t: 0.45, zoom: 1.16, cx: 0.5, cy: 0.4, reason: 'punch-in' },
        ]
      : [
          { t: 0, zoom: 1.05, cx: 0.5, cy: 0.42, reason: 'establish' },
          { t: 0.5, zoom: 1.12, cx: 0.5, cy: 0.41, reason: 'slow push' },
        ],
    captions: c.captions || { mode: 'phrase', emphasize: [], animation: 'pop' },
    sfx: c.sfx || [],
    overlays: c.overlays || [],
  };
}

module.exports = { runLlmDirector };
