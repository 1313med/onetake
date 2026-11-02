/**
 * UGC Super Editor — cutaway EDL + dense effect beats + SFX markers.
 * Goal: CapCut/AE-style A-cam ↔ plate rhythm, not sparse face overlays.
 */
const { matchEntity, restoreLatinHybrid } = require('./hybridLexicon');

const EFFECT_CATALOG = [
  'phoneMockup',
  'glassType',
  'checklist',
  'zoomThrough',
  'orbitCrop',
  'paperCut',
  'coverStory',
  'uiWorld',
  'chartGrow',
  'frameBreak',
  'headlineWall',
  'digitalZoom',
  'doodleBoil',
  'pullBackReveal',
  'brandCard',
  'foodPop',
  'freeBurst',
  'stampSlam',
  'docMock',
  'coverStill',
  'topicBlast',
];

/** Cutaway palettes — ONLY opaque / descriptive plates (never transparent overlays). */
const VARIANT_PALETTES = {
  variant_a: ['topicBlast', 'phoneMockup', 'freeBurst', 'brandCard', 'stampSlam', 'checklist'],
  variant_b: ['checklist', 'phoneMockup', 'docMock', 'topicBlast', 'uiWorld'],
  variant_c: ['brandCard', 'coverStill', 'foodPop', 'freeBurst', 'topicBlast', 'stampSlam'],
};

/** Overlay-only accents on face (transparent comps OK here). */
const OVERLAY_PALETTES = {
  variant_a: ['zoomThrough', 'glassType', 'digitalZoom'],
  variant_b: ['glassType', 'pullBackReveal', 'frameBreak'],
  variant_c: ['glassType', 'zoomThrough', 'digitalZoom'],
};

/** How often / how long cutaways replace A-cam (voice continues). */
const CUTAWAY_DENSITY = {
  // card = face stays + kinetic card (never blank black)
  variant_a: { everySec: 5.0, holdMin: 1.35, holdMax: 2.1, mode: 'card', smash: true, maxRatio: 0.3 },
  variant_b: { everySec: 6.5, holdMin: 1.5, holdMax: 2.3, mode: 'pip', smash: false, maxRatio: 0.24 },
  variant_c: { everySec: 5.5, holdMin: 1.4, holdMax: 2.2, mode: 'card', smash: true, maxRatio: 0.28 },
};

const OPAQUE_PLATES = new Set([
  'topicBlast',
  'phoneMockup',
  'checklist',
  'brandCard',
  'foodPop',
  'freeBurst',
  'stampSlam',
  'docMock',
  'coverStill',
  'coverStory',
  'uiWorld',
  'chartGrow',
]);

function toCutawayPlate(effectId, palette) {
  if (OPAQUE_PLATES.has(effectId)) return effectId;
  return palette[0] || 'topicBlast';
}

/** Never leave talking-head crumbs shorter than this after a cutaway split. */
const MIN_FACE_HOLD = 1.05;

const RULES = [
  { re: /\?|؟|wach|3lach|pourquoi|why|علاش|كيفاش|imagine|ready/i, effects: ['checklist', 'topicBlast'] },
  { re: /\d+|٪|%|number|chiffre|عدد/i, effects: ['chartGrow', 'uiWorld'] },
  { re: /مهم|important|khass|never|خطأ|error|مصادق|approuv|simply|join/i, effects: ['stampSlam', 'topicBlast'] },
  { re: /ناس|people|phone|تليفون|app|تطبيق|platform|website|community|register/i, effects: ['phoneMockup', 'topicBlast', 'uiWorld'] },
  { re: /قصة|story|cover|حقيقة|passport|passeport|وثيق|job\s*offer|internet/i, effects: ['docMock', 'coverStill', 'topicBlast'] },
  { re: /visa|فيزا|ireland|أيرلندا|ايرلندا/i, effects: ['phoneMockup', 'docMock'] },
  { re: /free|فابور|مجانا|new\s+platform|catch\s+your\s+wave/i, effects: ['freeBurst', 'stampSlam', 'topicBlast'] },
  { re: /الله|قرآن|دين|iman/i, effects: ['topicBlast', 'coverStill'] },
  { re: /search|help|updated|tell|hello|check/i, effects: ['topicBlast', 'checklist'] },
];

const STOP = new Set(
  'the a an and or but so to of in on at is are was were be been you your we our my me i this that it for with from as not no yes okay ok hello'.split(
    ' '
  )
);

function pickHookWord(text) {
  const hybrid = restoreLatinHybrid(text);
  const words = String(hybrid || '')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase()));
  if (!words.length) return 'LISTEN';
  const emphasis = words.find((w) =>
    /platform|search|community|website|job|offer|free|visa|register|join|internet|help|updated|wave/i.test(w)
  );
  if (emphasis) return emphasis.slice(0, 22);
  words.sort((a, b) => b.length - a.length);
  return words[0].slice(0, 18);
}

function resolveSpeechEffect(text, palette) {
  const entity = matchEntity(text);
  if (entity) {
    return {
      effectId: entity.effectId,
      reason: `entity:${entity.id}`,
      sfx: entity.sfx || 'hit',
      emoji: entity.emoji || null,
      displayText: entity.text || pickHookWord(text),
      assetKey: entity.assetKey || null,
      entity: true,
      motion: entity.effectId === 'freeBurst' || entity.effectId === 'stampSlam' ? 'slam' : 'snap',
    };
  }
  for (const rule of RULES) {
    if (rule.re.test(text)) {
      const candidates = rule.effects.filter((e) => palette.includes(e));
      const effectId = candidates[0] || rule.effects[0] || palette[0];
      return {
        effectId,
        reason: `speech → ${effectId}`,
        sfx:
          effectId === 'zoomThrough' || effectId === 'digitalZoom'
            ? 'riser'
            : effectId === 'stampSlam'
              ? 'stamp'
              : effectId === 'checklist'
                ? 'tick'
                : 'pop',
        emoji: null,
        displayText: pickHookWord(text),
        assetKey: null,
        entity: false,
        motion: effectId === 'stampSlam' ? 'slam' : 'snap',
      };
    }
  }
  return null;
}

function clipDur(c) {
  return Math.max(0.25, (c.srcEnd ?? 0) - (c.srcStart ?? 0));
}

/**
 * Split talking-head clips and insert full/PIP cutaway plates (voice keeps via same src range).
 */
function injectCutaways(plan) {
  const palette = VARIANT_PALETTES[plan.id] || VARIANT_PALETTES.variant_a;
  const density = CUTAWAY_DENSITY[plan.id] || CUTAWAY_DENSITY.variant_a;
  const src = plan.timeline || [];
  const totalDur = src.reduce((a, c) => a + clipDur(c), 0) || 1;
  const maxCutSec = totalDur * (density.maxRatio || 0.3);
  const out = [];
  let since = 99;
  let paletteIdx = 0;
  let cutCount = 0;
  let cutSec = 0;

  for (let i = 0; i < src.length; i++) {
    const clip = src[i];
    if (clip.role === 'cutaway') {
      out.push(clip);
      continue;
    }
    const dur = clipDur(clip);
    const text = restoreLatinHybrid(clip.text || '');
    let resolved = resolveSpeechEffect(text, palette);

    // Hook/payoff can force once timer is warm — never every micro jump-cut
    const forceRole =
      density.mode !== 'pip' &&
      (clip.role === 'hook' || clip.role === 'payoff') &&
      since >= density.everySec * 0.65;
    const underBudget = cutSec < maxCutSec - 0.5;
    const due =
      underBudget &&
      (since >= density.everySec || forceRole || (resolved && resolved.entity && since >= 2.2));
    // Need room for face + plate + face without crumbs
    const canSplit = dur >= MIN_FACE_HOLD * 2 + density.holdMin;
    // Medium clips: whole clip becomes a plate (no face crumbs) — still pro UGC
    const fullClipCutaway = due && !canSplit && dur >= 1.45 && dur <= 3.2;

    if (!due) {
      out.push(clip);
      since += dur;
      continue;
    }

    if (!canSplit && !fullClipCutaway) {
      clip.wantOverlay = true;
      out.push(clip);
      since += dur;
      continue;
    }

    if (fullClipCutaway) {
      if (!resolved) {
        const effectId = palette[paletteIdx % palette.length];
        paletteIdx += 1;
        resolved = {
          effectId,
          reason: `full-clip plate (${clip.role || 'body'})`,
          sfx: 'whoosh',
          emoji: '💡',
          displayText: pickHookWord(text),
          assetKey: null,
          entity: false,
          motion: 'slam',
        };
      }
      const plateId = toCutawayPlate(resolved.effectId, palette);
      out.push({
        id: `${clip.id || `c_${i}`}_cut`,
        role: 'cutaway',
        plateId,
        plateMode: density.mode || 'card',
        motion: resolved.motion || 'slam',
        text: resolved.displayText,
        line: String(text).slice(0, 100),
        emoji: resolved.emoji || '💡',
        assetKey: resolved.assetKey,
        srcStart: clip.srcStart,
        srcEnd: clip.srcEnd,
        start: clip.srcStart,
        end: clip.srcEnd,
        keepVoice: true,
        transitionIn: {
          type: density.smash ? 'smash' : 'cut',
          duration: density.smash ? 0.08 : 0,
          reason: resolved.reason,
        },
        transitionOut: { type: 'cut', reason: 'back to A-cam' },
        camera: clip.camera,
        captions: clip.captions,
        sfx: [resolved.sfx || 'whoosh'],
        overlays: [],
        ideaUnitIds: clip.ideaUnitIds || [],
      });
      cutCount += 1;
      cutSec += dur;
      since = 0;
      continue;
    }

    if (!resolved) {
      const effectId = palette[paletteIdx % palette.length];
      paletteIdx += 1;
      resolved = {
        effectId,
        reason: `palette cutaway (${clip.role || 'body'})`,
        sfx: 'whoosh',
        emoji: '💡',
        displayText: pickHookWord(text),
        assetKey: null,
        entity: false,
        motion: 'slam',
      };
    }

    const hold = Math.min(density.holdMax, Math.max(density.holdMin, dur * 0.38));
    if (cutSec + hold > maxCutSec) {
      clip.wantOverlay = true;
      out.push(clip);
      since += dur;
      continue;
    }
    let pre = Math.min(Math.max(MIN_FACE_HOLD, dur * 0.28), dur - hold - MIN_FACE_HOLD);
    let post = dur - pre - hold;
    if (post < MIN_FACE_HOLD) {
      pre = Math.max(MIN_FACE_HOLD, dur - hold - MIN_FACE_HOLD);
      post = dur - pre - hold;
    }
    if (pre < MIN_FACE_HOLD || post < MIN_FACE_HOLD || hold < 1.0) {
      clip.wantOverlay = true;
      out.push(clip);
      since += dur;
      continue;
    }

    const baseId = clip.id || `c_${i}`;
    out.push({
      ...clip,
      id: `${baseId}_a`,
      srcEnd: clip.srcStart + pre,
      end: clip.srcStart + pre,
      transitionOut: { type: density.smash ? 'smash' : 'cut', reason: 'into cutaway' },
    });

    const plateId = toCutawayPlate(resolved.effectId, palette);
    const mode = density.mode || 'card';

    out.push({
      id: `${baseId}_cut`,
      role: 'cutaway',
      plateId,
      plateMode: mode,
      motion: resolved.motion || 'slam',
      text: resolved.displayText,
      line: String(text).slice(0, 100),
      emoji: resolved.emoji || '💡',
      assetKey: resolved.assetKey,
      srcStart: clip.srcStart + pre,
      srcEnd: clip.srcStart + pre + hold,
      start: clip.srcStart + pre,
      end: clip.srcStart + pre + hold,
      keepVoice: true,
      transitionIn: {
        type: density.smash ? 'smash' : 'cut',
        duration: density.smash ? 0.08 : 0,
        reason: resolved.reason,
      },
      transitionOut: { type: 'cut', reason: 'back to A-cam' },
      camera: [{ t: 0, zoom: 1.08, cx: 0.5, cy: 0.4, reason: 'cutaway hold' }],
      captions: clip.captions,
      sfx: [resolved.sfx || 'whoosh'],
      overlays: [],
      ideaUnitIds: clip.ideaUnitIds || [],
    });
    cutCount += 1;
    cutSec += hold;
    since = 0;

    out.push({
      ...clip,
      id: `${baseId}_b`,
      role: clip.role === 'hook' ? 'body' : clip.role === 'payoff' ? 'payoff' : 'body',
      srcStart: clip.srcStart + pre + hold,
      start: clip.srcStart + pre + hold,
      transitionIn: { type: 'cut', reason: 'return A-cam' },
    });
    since = post;
  }

  plan.timeline = out;
  plan.totalDuration = out.reduce((a, c) => a + clipDur(c), 0);
  plan.cutawayCount = cutCount;
  return plan;
}

/**
 * Overlay / accent beats on top of A-cam (and reinforce cutaway open).
 */
function attachOverlayBeats(plan) {
  const cutPalette = VARIANT_PALETTES[plan.id] || VARIANT_PALETTES.variant_a;
  const overlayPalette = OVERLAY_PALETTES[plan.id] || OVERLAY_PALETTES.variant_a;
  const timeline = plan.timeline || [];
  const beats = [];
  let t = 0;
  let paletteIdx = 0;
  const maxBeats = Math.min(48, Math.max(12, Math.floor(plan.totalDuration / 1.05) + 6));

  for (let i = 0; i < timeline.length; i++) {
    const clip = timeline[i];
    const dur = clipDur(clip);
    const text = restoreLatinHybrid(clip.text || clip.line || '');

    if (clip.role === 'cutaway') {
      // Cutaway already renders its plate — don't stack another effect on black
      t += dur;
      continue;
    }

    if (beats.length >= maxBeats) {
      t += dur;
      continue;
    }

    let resolved = resolveSpeechEffect(text, cutPalette);
    const roleHit =
      clip.role === 'hook' ||
      clip.role === 'payoff' ||
      clip.role === 'host' ||
      clip.wantOverlay ||
      i % 2 === 0;

    if (!resolved && roleHit) {
      const effectId = overlayPalette[paletteIdx % overlayPalette.length];
      paletteIdx += 1;
      resolved = {
        effectId,
        reason: `overlay (${clip.role || 'body'})`,
        sfx: 'pop',
        emoji: null,
        displayText: pickHookWord(text),
        assetKey: null,
        motion: 'bounce',
      };
    } else if (resolved) {
      // Face overlays must stay transparent comps
      resolved = {
        ...resolved,
        effectId: overlayPalette[paletteIdx % overlayPalette.length],
        motion: 'bounce',
        reason: `${resolved.reason} · face overlay`,
      };
      paletteIdx += 1;
    }

    if (!resolved) {
      t += dur;
      continue;
    }

    // Don't stack same heavy plate as a neighboring cutaway
    const prev = timeline[i - 1];
    const next = timeline[i + 1];
    if (
      (prev?.role === 'cutaway' && prev.plateId === resolved.effectId) ||
      (next?.role === 'cutaway' && next.plateId === resolved.effectId)
    ) {
      t += dur;
      continue;
    }

    if (beats.length && beats[beats.length - 1].effectId === resolved.effectId && t - beats[beats.length - 1].atSec < 2.2) {
      resolved = {
        ...resolved,
        effectId:
          overlayPalette[
            (overlayPalette.indexOf(resolved.effectId) + 1 + overlayPalette.length) % overlayPalette.length
          ] || overlayPalette[0],
        reason: `${resolved.reason} · rotated`,
      };
    }

    const hold = Math.min(1.8, Math.max(0.85, dur * 0.45));
    const at = t + Math.min(0.28, dur * 0.12);
    beats.push({
      atSec: Number(at.toFixed(3)),
      durSec: Number(hold.toFixed(3)),
      effectId: resolved.effectId,
      text: resolved.displayText,
      line: String(text).slice(0, 80),
      emoji: resolved.emoji,
      assetKey: resolved.assetKey,
      sfx: resolved.sfx || 'pop',
      intensity: resolved.entity || clip.role === 'hook' ? 1.25 : 1.05,
      reason: resolved.reason,
      clipId: clip.id,
      motion: resolved.motion || 'bounce',
      mode: 'overlay',
    });
    clip.effectBeat = { effectId: resolved.effectId, at: at - t, hold, reason: resolved.reason };
    t += dur;
  }

  if (timeline.length && beats.length < 3) {
    beats.unshift({
      atSec: 0.15,
      durSec: 1.6,
      effectId: overlayPalette[0],
      text: pickHookWord(timeline[0].text),
      line: timeline[0].text,
      sfx: 'riser',
      intensity: 1.3,
      reason: 'forced hook',
      motion: 'bounce',
      mode: 'overlay',
    });
  }

  plan.effectBeats = beats;
  plan.effectPalette = cutPalette;
  return plan;
}

/**
 * Build dense timed SFX list: cutaways, overlay beats, caption pops, jump cuts.
 */
function attachSfxEvents(plan) {
  const events = [];
  const push = (atSec, kind, reason) => {
    if (atSec < 0 || !Number.isFinite(atSec)) return;
    events.push({ atSec: Number(atSec.toFixed(3)), kind, reason });
  };

  let t = 0;
  for (const clip of plan.timeline || []) {
    const dur = clipDur(clip);
    if (clip.role === 'cutaway') {
      push(t, (clip.sfx && clip.sfx[0]) || 'whoosh', 'cutaway in');
      if (clip.plateId === 'stampSlam') push(t + Math.min(0.35, dur * 0.2), 'stamp', 'stamp slam');
      if (clip.plateId === 'checklist') {
        push(t + 0.35, 'tick', 'check 1');
        push(t + 0.7, 'tick', 'check 2');
        push(t + 1.05, 'tick', 'check 3');
      }
      if (clip.transitionIn?.type === 'smash') push(t + 0.04, 'hit', 'smash');
      push(t + dur - 0.05, 'click', 'cutaway out');
    } else if (t > 0.05) {
      push(t, 'click', 'jump cut');
    }
    t += dur;
  }

  for (const beat of plan.effectBeats || []) {
    if (beat.mode === 'accent') continue; // already covered by cutaway
    push(beat.atSec, beat.sfx || 'pop', beat.reason || 'effect');
  }

  // Caption micro-pops (throttled)
  let lastPop = -1;
  for (const c of plan.captions || []) {
    const at = c.start;
    if (at - lastPop < 0.45) continue;
    push(at, 'pop', 'caption');
    lastPop = at;
  }

  // Dedupe near-identical times
  events.sort((a, b) => a.atSec - b.atSec);
  const deduped = [];
  for (const e of events) {
    const prev = deduped[deduped.length - 1];
    if (prev && Math.abs(prev.atSec - e.atSec) < 0.08 && prev.kind === e.kind) continue;
    // keep both if different kinds within 80ms — but collapse if <40ms
    if (prev && Math.abs(prev.atSec - e.atSec) < 0.04) continue;
    deduped.push(e);
  }

  plan.sfxEvents = deduped.slice(0, 48);
  return plan;
}

function attachEffectBeats(plan) {
  injectCutaways(plan);
  attachOverlayBeats(plan);
  // captions timing must be rebuilt by caller after cutaways; sfx caption pops added later
  attachSfxEvents(plan);
  return plan;
}

module.exports = {
  EFFECT_CATALOG,
  VARIANT_PALETTES,
  CUTAWAY_DENSITY,
  attachEffectBeats,
  injectCutaways,
  attachOverlayBeats,
  attachSfxEvents,
  pickHookWord,
  resolveSpeechEffect,
};
