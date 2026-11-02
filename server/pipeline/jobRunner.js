const fs = require('fs');
const path = require('path');
const { validateSource } = require('./ingest');
const { prepareMedia } = require('./mediaPrep');
const { createTimer } = require('./timing');
const {
  ensureSourceHash,
  canReuseTranscript,
  canReuseEditorial,
  canReusePlans,
  readJson,
  writeJson,
} = require('./artifactCache');
const { transcribe } = require('./asr/adapter');
const { dedupeRepeatedTakes } = require('./transcribe');
const { runDirector } = require('./director');
const { planFiveVersions, validateTimeline } = require('./plan');
const { renderAllParallel } = require('./render');
const { runQualityGate } = require('./qc');

function resolveAsrOptions() {
  const provider = process.env.ASR_PROVIDER;
  if (!provider) {
    throw new Error(
      'ASR_PROVIDER is not set. Set ASR_PROVIDER=openai (recommended) or elevenlabs|gladia|localWhisper.'
    );
  }
  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY is required for Super Editor publish ASR. Add it to .env — local Whisper base is not allowed for Darija publish.'
      );
    }
    return { provider, model: process.env.OPENAI_ASR_MODEL || 'whisper-1' };
  }
  if (provider === 'localWhisper') {
    const model = process.env.WHISPER_MODEL;
    if (!model) {
      throw new Error('WHISPER_MODEL must be set when ASR_PROVIDER=localWhisper (e.g. small|medium).');
    }
    if (String(model).toLowerCase() === 'tiny' || String(model).toLowerCase() === 'base') {
      throw new Error(
        'WHISPER_MODEL tiny/base are blocked for production jobs (Darija hallucinations). Use openai ASR or WHISPER_MODEL=small|medium|large-v3.'
      );
    }
  }
  if ((provider === 'openai' || process.env.DIRECTOR_PROVIDER === 'openai') && !process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required when using OpenAI ASR or Director.');
  }
  return { provider, model: process.env.WHISPER_MODEL || process.env.OPENAI_ASR_MODEL };
}

/** Reject absurdly thin transcripts before we ship 10s garbage reels. */
function assertAsrCoverage(meta, segments) {
  const duration = Number(meta?.duration) || 0;
  const segs = segments || [];
  const speechSec = segs.reduce((a, s) => a + Math.max(0, (s.end || 0) - (s.start || 0)), 0);
  if (duration <= 60) return { speechSec, ok: true };
  const minSpeech = Math.min(45, Math.max(20, duration * 0.08));
  // When speech seconds are healthy, allow fewer (but still multi) segments —
  // Whisper often returns longer Darija spans instead of many short cuts.
  const minSegs = speechSec >= Math.max(minSpeech, 30) ? 8 : 12;
  if (speechSec < minSpeech || segs.length < minSegs) {
    throw new Error(
      `ASR too weak for this recording (${segs.length} segments, ${speechSec.toFixed(1)}s speech of ${duration.toFixed(0)}s source). ` +
        `Need ≥${minSegs} segments and ≥${minSpeech.toFixed(0)}s speech. ` +
        `Whisper likely looped one phrase (common on long Darija). Restart studio + retry (chunked ASR + prompt-leak filter).`
    );
  }
  return { speechSec, ok: true };
}

/** Plans must not ship sub-minute packs from long raw takes. */
function assertPlanDurations(meta, plans, speechSec) {
  const duration = Number(meta?.duration) || 0;
  if (duration < 90) return;
  const available = Number(speechSec) || 0;
  // Can't invent speech — require min(45, ~85% of ASR speech) when ASR is thin.
  const minPlan = available > 0 ? Math.min(45, Math.max(20, available * 0.85)) : 45;
  const tooShort = (plans || []).filter((p) => (p.totalDuration || 0) < minPlan);
  if (tooShort.length) {
    throw new Error(
      `Director produced ${tooShort.length} reel(s) under ${minPlan.toFixed(0)}s ` +
        `from a ${duration.toFixed(0)}s source (${available.toFixed(0)}s ASR speech). ` +
        `Refusing Remotion — improve ASR coverage or record a denser take (target ≥45s kept speech).`
    );
  }
}

async function runJob(job, update) {
  const { id, dir, sourcePath, brief } = job;
  const timer = createTimer(dir);
  const set = (patch) => {
    Object.assign(job, patch, {
      updatedAt: Date.now(),
      timing: timer.snapshot(),
    });
    update?.(job);
  };

  try {
    set({
      phase: 'ingest',
      progress: 0.03,
      message: 'Validating uploaded video…',
      phases: ['ingest', 'media_prep', 'transcribe', 'director', 'render', 'qc'],
    });

    const meta = await timer.time('ingest', 'ingest_ms', () => validateSource(sourcePath));
    set({ meta, progress: 0.08, message: `Source OK · ${meta.duration.toFixed(1)}s` });

    const sourceHash = await ensureSourceHash(dir, sourcePath);

    const media = await timer.time('media_prep', 'media_prep_ms', () =>
      prepareMedia(dir, sourcePath, (msg) => set({ phase: 'media_prep', progress: 0.12, message: msg }))
    );
    if (media.reusedWav) timer.markCache('audio.wav');
    if (media.reusedProxy) timer.markCache('proxy.mp4');
    set({ progress: 0.18, message: 'Media prepared (WAV + proxy)' });

    const transcriptPath = path.join(dir, 'transcript.json');
    let transcript;

    const cachedTx = canReuseTranscript(dir, sourceHash) ? readJson(transcriptPath) : null;
    const cachedModel = String(cachedTx?.model || '').toLowerCase();
    const cachedSegs = Array.isArray(cachedTx?.segments) ? cachedTx.segments.length : 0;
    const cachedSpeech = (cachedTx?.segments || []).reduce(
      (a, s) => a + Math.max(0, (s.end || 0) - (s.start || 0)),
      0
    );
    // Tiny always blocked. Base blocked only when coverage is too thin (hallucination collapse).
    const cachedBlocked =
      cachedTx &&
      meta.duration > 60 &&
      (cachedModel === 'tiny' ||
        cachedSegs < 12 ||
        cachedSpeech < Math.min(45, Math.max(20, meta.duration * 0.08)) ||
        (cachedModel === 'base' && cachedSegs < 20));

    if (cachedTx && !cachedBlocked) {
      timer.markCache('transcript');
      transcript = cachedTx;
      set({
        phase: 'transcribe',
        progress: 0.38,
        message: `Reusing cached transcript (${transcript.provider || 'cached'}/${transcript.model || '?'})`,
      });
    } else {
      if (cachedBlocked) {
        set({
          phase: 'transcribe',
          progress: 0.19,
          message: `Ignoring weak cached transcript (${cachedTx.provider}/${cachedTx.model}, ${cachedTx.segments?.length || 0} segs)…`,
        });
      }
      const asrOpts = resolveAsrOptions();
      set({
        phase: 'transcribe',
        progress: 0.2,
        message: `Transcribing with ${asrOpts.provider}${asrOpts.model ? `/${asrOpts.model}` : ''}…`,
      });
      transcript = await timer.time('asr', 'asr_ms', () =>
        transcribe(media.wav, {
          provider: asrOpts.provider,
          model: asrOpts.model,
          persistPath: transcriptPath,
          onProgress: (msg) => {
            const m = /pct=([0-9.]+)/.exec(msg);
            const pct = m ? Number(m[1]) : null;
            const progress = pct != null ? 0.2 + Math.min(0.18, (pct / 100) * 0.18) : 0.22;
            set({ phase: 'transcribe', progress, message: `Transcribing… ${msg}` });
          },
        })
      );
    }

    const clean = dedupeRepeatedTakes(transcript.segments || []);
    const coverage = assertAsrCoverage(meta, clean);
    fs.writeFileSync(
      path.join(dir, 'transcript_clean.json'),
      JSON.stringify({ ...transcript, segments: clean }, null, 2),
      'utf8'
    );
    set({
      transcript,
      cleanSegments: clean,
      progress: 0.4,
      message: `Transcript ready: ${clean.length} segments · ${coverage.speechSec.toFixed(0)}s speech (${transcript.provider}/${transcript.model})`,
      transcriptSummary: {
        language: transcript.language,
        segments: clean.length,
        words: (transcript.words || []).length,
        speechSec: coverage.speechSec,
        confidence:
          transcript.lowConfidenceSpans && transcript.lowConfidenceSpans.length ? 'mixed' : 'ok',
        lowConfidenceSpans: (transcript.lowConfidenceSpans || []).length,
        provider: transcript.provider,
        model: transcript.model,
      },
    });

    let editorial;
    let plans;

    // Always re-run director when plans look like the old 10s collapse
    const cachedPlans = canReusePlans(dir, sourceHash) ? readJson(path.join(dir, 'plans.json')) : null;
    const cachedTooShort =
      meta.duration > 180 &&
      Array.isArray(cachedPlans) &&
      cachedPlans.some((p) => (p.totalDuration || 0) < 45);

    if (canReuseEditorial(dir, sourceHash) && canReusePlans(dir, sourceHash) && !cachedTooShort) {
      timer.markCache('editorial');
      timer.markCache('plans');
      editorial = readJson(path.join(dir, 'editorial.json'));
      plans = cachedPlans;
      set({ phase: 'director', progress: 0.48, message: 'Reusing cached editorial plans…' });
    } else {
      set({
        phase: 'director',
        progress: 0.42,
        message: 'Super Editor: retakes, continuous spine, 5 variants…',
      });
      const directed = await timer.time('director', 'director_ms', async () => {
        try {
          return await runDirector({
            segments: clean,
            words: transcript.words || [],
            wavPath: media.wav,
            brief,
            meta,
            speechSec: coverage.speechSec,
          });
        } catch (err) {
          console.warn('[director] falling back to localEditorial:', err.message);
          const { runLocalDirector } = require('./director/localEditorial');
          try {
            const local = runLocalDirector({
              segments: clean,
              words: transcript.words || [],
              wavPath: media.wav,
              brief,
              meta,
            });
            local.editorial.engine = `localEditorial(fallback after director error: ${err.message})`;
            return local;
          } catch (err2) {
            console.warn('[director] falling back to heuristic plan.js:', err2.message);
            const p = planFiveVersions(clean, transcript.words || [], meta, brief);
            return {
              editorial: {
                version: 1,
                engine: `plan.js_fallback:${err2.message}`,
                ideaUnits: [],
                takeGroups: [],
                discardedTakes: [],
                coverage: { mustIncludeIdeaIds: [] },
              },
              plans: p,
            };
          }
        }
      });
      editorial = directed.editorial;
      plans = directed.plans;
      assertPlanDurations(meta, plans, coverage.speechSec);
      writeJson(path.join(dir, 'editorial.json'), editorial);
      for (const plan of plans) {
        plan._asrSpeechSec = coverage.speechSec;
        plan._sourceDuration = meta.duration;
        const v = validateTimeline(plan, meta.duration);
        plan.validation = v;
        if (!v.ok) plan.warnings = v.issues;
      }
      writeJson(path.join(dir, 'plans.json'), plans);
    }

    set({
      editorialSummary: {
        engine: editorial.engine,
        ideaUnits: (editorial.ideaUnits || []).length,
        takeGroups: (editorial.takeGroups || []).length,
        discardedTakes: (editorial.discardedTakes || []).length,
      },
      plans,
      progress: 0.5,
      message: `Director ready (${editorial.engine}) — rendering 5 reels`,
    });

    const musicDir = path.join(__dirname, '..', 'assets', 'music');
    const renderSource = media.proxy && fs.existsSync(media.proxy) ? media.proxy : sourcePath;

    const renderStarted = Date.now();
    const results = await timer.time('render_all', null, () =>
      renderAllParallel(
        dir,
        renderSource,
        plans,
        musicDir,
        (plan, idx, p, msg) => {
          const base = 0.5 + (0.4 * idx) / plans.length;
          set({
            phase: 'render',
            progress: base + p * (0.4 / plans.length),
            message: `${plan.name}: ${msg}`,
            currentVersion: plan.id,
          });
        },
        Math.max(1, Math.min(3, Math.floor(require('os').cpus().length / 2) || 1))
      )
    );
    timer.setRenderMs('_all', Date.now() - renderStarted);

    const outputs = [];
    set({ phase: 'qc', progress: 0.92, message: 'Quality gate…' });
    for (const { plan, rendered } of results) {
      plan._sourceDuration = meta.duration;
      plan._asrSpeechSec =
        plan._asrSpeechSec ||
        (transcript.segments || []).reduce((a, s) => a + Math.max(0, (s.end || 0) - (s.start || 0)), 0);
      const qa = await timer.time(`qc_${plan.id}`, 'qc_ms', () =>
        runQualityGate(rendered.path, plan, transcript)
      );
      fs.writeFileSync(path.join(dir, `qa_${plan.id}.json`), JSON.stringify(qa, null, 2), 'utf8');
      outputs.push({
        id: plan.id,
        name: plan.name,
        index: plan.index,
        captionStyle: plan.captionStyle,
        rationale: plan.rationale,
        warnings: [...(plan.warnings || []), ...(qa.warnings || []).map((w) => w.detail || w.id)],
        validation: plan.validation,
        url: `/jobs/${id}/files/${rendered.fileName}`,
        fileName: rendered.fileName,
        duration: rendered.duration,
        size: rendered.size,
        width: rendered.width,
        height: rendered.height,
        qa,
        timelineClips: plan.timeline.length,
        captionEvents: (plan.captions || []).length,
      });
    }

    const hardFails = outputs.filter((o) => o.qa && o.qa.ok === false);
    const usable = outputs.filter((o) => o.duration >= 45 && o.size > 50_000);
    // Never throw away a long successful render over soft QC — deliver what we have
    if (usable.length === 0 && hardFails.length === outputs.length) {
      throw new Error(
        `Quality gate failed for all versions: ${hardFails.map((o) => o.name).join(', ')}`
      );
    }

    set({
      phase: 'done',
      progress: 1,
      message:
        hardFails.length === 0
          ? 'Five finished videos ready'
          : usable.length === outputs.length
            ? `Five finished videos ready (${hardFails.length} soft QC warnings)`
            : `Completed with ${usable.length}/5 usable · ${hardFails.length} QC issues`,
      outputs: usable.length ? usable : outputs,
      status: 'completed',
      timing: timer.snapshot(),
    });
    return job;
  } catch (err) {
    set({
      status: 'failed',
      phase: 'error',
      message: err.message || String(err),
      error: err.stack || String(err),
      timing: timer.snapshot(),
    });
    return job;
  }
}

module.exports = { runJob };
