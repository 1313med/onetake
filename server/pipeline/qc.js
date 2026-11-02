const fs = require('fs');
const { probe } = require('./ffmpeg');

/**
 * Editorial quality gate — expands probe-only checks.
 */
async function runQualityGate(filePath, plan, transcript) {
  const checks = [];
  const warnings = [];

  if (!fs.existsSync(filePath)) {
    return { ok: false, checks: [{ id: 'exists', pass: false, detail: 'missing file' }], warnings };
  }
  const st = fs.statSync(filePath);
  checks.push({ id: 'exists', pass: st.size > 50_000, detail: `${st.size} bytes` });

  let meta;
  try {
    meta = await probe(filePath);
    checks.push({ id: 'probe', pass: true, detail: 'ok' });
  } catch (e) {
    return {
      ok: false,
      checks: [...checks, { id: 'probe', pass: false, detail: String(e.message || e) }],
      warnings,
    };
  }

  const v = meta.streams.find((s) => s.codec_type === 'video');
  const a = meta.streams.find((s) => s.codec_type === 'audio');
  const dur = Number(meta.format.duration || 0);

  checks.push({
    id: 'vertical',
    pass: Boolean(v && Number(v.height) >= Number(v.width)),
    detail: v ? `${v.width}x${v.height}` : 'no video',
  });
  checks.push({ id: 'has_audio', pass: Boolean(a), detail: a ? a.codec_name : 'missing' });

  const sourceHint = Number(plan._sourceDuration) || 0;
  const asrSpeech = Number(plan._asrSpeechSec) || 0;
  // Soft target (100s) must NOT force long-source QC on short takes.
  const longSource = sourceHint >= 90 || asrSpeech >= 70;
  // Prefer 45s on long takes; short EN takes only need a usable pack (~70% of speech).
  const minDur = longSource
    ? asrSpeech > 0
      ? Math.min(45, Math.max(20, asrSpeech * 0.8))
      : 45
    : asrSpeech > 0
      ? Math.min(asrSpeech * 0.7, Math.max(8, asrSpeech * 0.55))
      : 8;
  checks.push({
    id: 'duration_usable',
    pass: dur >= minDur,
    detail: `${dur.toFixed(2)}s (min ${minDur.toFixed(0)}s${asrSpeech ? `, asrSpeech ${asrSpeech.toFixed(0)}s` : ''})`,
  });
  if (dur < 45 && longSource) {
    warnings.push({
      id: 'duration_short',
      detail: `${dur.toFixed(1)}s under 45s target (ASR speech ${asrSpeech.toFixed(0) || '?'}s)`,
    });
  }
  if (dur > 130) {
    warnings.push({ id: 'duration_long', detail: `${dur.toFixed(1)}s exceeds soft 120s guidance` });
  }


  const captionCount = (plan.captions || []).length;
  checks.push({
    id: 'captions_planned',
    pass: captionCount > 0,
    detail: `${captionCount} caption events`,
  });

  checks.push({
    id: 'multi_clip',
    pass: (plan.timeline || []).length >= 2,
    detail: `${(plan.timeline || []).length} timeline clips`,
  });

  const effectBeats = plan.effectBeats || [];
  if (longSource || dur >= 45) {
    checks.push({
      id: 'effect_beats',
      pass: effectBeats.length >= 2,
      detail: `${effectBeats.length} Remotion effectBeats`,
    });
  } else if (effectBeats.length) {
    warnings.push({ id: 'effect_beats', detail: `${effectBeats.length} effectBeats` });
  }

  // Discarded retakes must not reappear in timeline
  let retakeLeak = false;
  for (const d of plan.discardedTakes || []) {
    for (const c of plan.timeline || []) {
      const overlap = Math.min(c.srcEnd, d.srcEnd) - Math.max(c.srcStart, d.srcStart);
      if (overlap > 0.35) {
        retakeLeak = true;
        break;
      }
    }
    if (retakeLeak) break;
  }
  checks.push({
    id: 'retakes_absent',
    pass: !retakeLeak,
    detail: retakeLeak ? 'discarded take overlaps timeline' : 'ok',
  });

  // Idea IDs are advisory — never hard-fail a finished ~100s reel over missing tags
  const must = plan.mustIncludeIdeaIds || [];
  if (must.length) {
    const present = new Set();
    for (const c of plan.timeline || []) {
      for (const id of c.ideaUnitIds || []) present.add(id);
    }
    const missing = must.filter((id) => !present.has(id));
    if (missing.length) {
      warnings.push({
        id: 'idea_coverage',
        detail: `idea tags ${must.length - missing.length}/${must.length} (informational)`,
      });
    }
  }

  // Low-confidence caption density
  const low = transcript?.lowConfidenceSpans || [];
  if (low.length > 20) {
    warnings.push({ id: 'caption_confidence', detail: `${low.length} low-confidence ASR spans` });
  }

  // Effect sanity: zoom bounds
  let zoomOk = true;
  for (const c of plan.timeline || []) {
    for (const k of c.camera || []) {
      const z = Number(k.zoom) || 1;
      if (z < 1 || z > 1.35) zoomOk = false;
    }
  }
  if (!zoomOk) warnings.push({ id: 'effect_sanity', detail: 'zoom outside 1.0–1.35' });

  // Awkward adjacent duplicates
  const tl = plan.timeline || [];
  for (let i = 1; i < tl.length; i++) {
    const aT = (tl[i - 1].text || '').trim();
    const bT = (tl[i].text || '').trim();
    if (aT && aT === bT) {
      checks.push({ id: 'duplicate_adjacent', pass: false, detail: `duplicate text at clip ${i}` });
      break;
    }
  }
  if (!checks.find((c) => c.id === 'duplicate_adjacent')) {
    checks.push({ id: 'duplicate_adjacent', pass: true, detail: 'ok' });
  }

  const ok = checks.every((c) => c.pass);
  return { ok, checks, warnings, duration: dur, size: st.size };
}

module.exports = { runQualityGate };
