/**
 * Darija ASR benchmark harness.
 *
 * Usage:
 *   node server/scripts/asr_benchmark/run.js --clip <wav> [--ref <json>] [--providers localWhisper:base,openai]
 *
 * Without API keys, cloud providers are reported as SKIPPED (not silent tiny fallback).
 * Writes server/scripts/asr_benchmark/out/benchmark_report.md + results.json
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { ffmpegPath } = require('../../pipeline/ffmpeg');
const { scoreAgainstReference } = require('./metrics');
const { listProviders } = require('../../pipeline/asr/adapter');
const { transcribeLocalWhisper } = require('../../pipeline/asr/providers/localWhisper');
const { transcribeOpenAI } = require('../../pipeline/asr/providers/openai');
const { transcribeElevenLabs } = require('../../pipeline/asr/providers/elevenlabs');
const { transcribeGladia } = require('../../pipeline/asr/providers/gladia');

function parseArgs(argv) {
  const out = { clip: null, ref: null, providers: null, maxSec: 90, allowTinyBaseline: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--clip') out.clip = argv[++i];
    else if (a === '--ref') out.ref = argv[++i];
    else if (a === '--providers') out.providers = argv[++i];
    else if (a === '--max-sec') out.maxSec = Number(argv[++i]);
    else if (a === '--allow-tiny-baseline') out.allowTinyBaseline = true;
  }
  return out;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => {
      err += d.toString();
    });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-500)))));
  });
}

async function maybeTrim(clip, maxSec, outDir) {
  if (!maxSec || maxSec <= 0) return clip;
  const trimmed = path.join(outDir, `clip_trim_${maxSec}s.wav`);
  await runFfmpeg(['-y', '-i', clip, '-t', String(maxSec), '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', trimmed]);
  return trimmed;
}

async function runOne(name, fn) {
  const t0 = Date.now();
  try {
    const transcript = await fn();
    const text = (transcript.segments || []).map((s) => s.text).join(' ');
    return {
      name,
      ok: true,
      ms: Date.now() - t0,
      provider: transcript.provider,
      model: transcript.model,
      language: transcript.language,
      segments: (transcript.segments || []).length,
      words: (transcript.words || []).length,
      lowConfidence: (transcript.lowConfidenceSpans || []).length,
      textPreview: text.slice(0, 400),
      text,
      error: null,
    };
  } catch (e) {
    return {
      name,
      ok: false,
      ms: Date.now() - t0,
      error: e.message || String(e),
      text: '',
    };
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const outDir = path.join(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  let clip = args.clip;
  if (!clip) {
    // Prefer real phone job audio
    const jobsRoot = path.join(__dirname, '..', '..', 'jobs');
    const preferred = [
      'adbe833d-40aa-43a3-a00e-2c3b34389c26',
      '6c8086c0-165d-423c-bfe4-23c3518e9e97',
    ];
    for (const id of preferred) {
      const p = path.join(jobsRoot, id, 'audio.wav');
      if (fs.existsSync(p)) {
        clip = p;
        break;
      }
    }
  }
  if (!clip || !fs.existsSync(clip)) {
    console.error('No --clip wav found. Pass --clip path/to/audio.wav');
    process.exit(1);
  }

  console.log('Available providers:', listProviders().join(', '));
  console.log('Clip:', clip);

  const workClip = await maybeTrim(clip, args.maxSec, outDir);
  console.log('Benchmark audio:', workClip, `(max ${args.maxSec}s)`);

  let reference = null;
  if (args.ref && fs.existsSync(args.ref)) {
    reference = JSON.parse(fs.readFileSync(args.ref, 'utf8'));
  } else {
    const defaultRef = path.join(__dirname, 'references', 'sample_ref.json');
    if (fs.existsSync(defaultRef)) reference = JSON.parse(fs.readFileSync(defaultRef, 'utf8'));
  }

  const jobs = [];

  // Local models (explicit). tiny only if opted in as negative baseline.
  jobs.push(() =>
    runOne('localWhisper:base', () =>
      transcribeLocalWhisper(workClip, {
        model: 'base',
        outJsonPath: path.join(outDir, 'hyp_local_base.json'),
      })
    )
  );
  jobs.push(() =>
    runOne('localWhisper:small', () =>
      transcribeLocalWhisper(workClip, {
        model: 'small',
        outJsonPath: path.join(outDir, 'hyp_local_small.json'),
      })
    )
  );
  if (args.allowTinyBaseline) {
    jobs.push(() =>
      runOne('localWhisper:tiny(BASELINE_DO_NOT_PUBLISH)', () =>
        transcribeLocalWhisper(workClip, {
          model: 'tiny',
          allowTiny: true,
          outJsonPath: path.join(outDir, 'hyp_local_tiny.json'),
        })
      )
    );
  }

  jobs.push(() =>
    runOne('openai', () =>
      transcribeOpenAI(workClip, { outJsonPath: path.join(outDir, 'hyp_openai.json') })
    )
  );
  jobs.push(() =>
    runOne('elevenlabs', () =>
      transcribeElevenLabs(workClip, { outJsonPath: path.join(outDir, 'hyp_elevenlabs.json') })
    )
  );
  jobs.push(() =>
    runOne('gladia', () => transcribeGladia(workClip, { outJsonPath: path.join(outDir, 'hyp_gladia.json') }))
  );

  const results = [];
  for (const job of jobs) {
    const r = await job();
    if (r.ok && reference?.text) {
      r.scores = scoreAgainstReference(r.text, reference);
    } else if (!r.ok && /API_KEY is not set/i.test(r.error || '')) {
      r.skipped = true;
    }
    console.log(
      r.ok
        ? `OK  ${r.name} ${r.ms}ms segs=${r.segments} words=${r.words} lang=${r.language}`
        : r.skipped
          ? `SKIP ${r.name} — ${r.error}`
          : `FAIL ${r.name} — ${r.error}`
    );
    results.push(r);
  }

  const report = buildReport(results, { clip, workClip, reference, maxSec: args.maxSec });
  const reportPath = path.join(outDir, 'benchmark_report.md');
  const jsonPath = path.join(outDir, 'results.json');
  fs.writeFileSync(reportPath, report, 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify({ clip, workClip, reference, results }, null, 2), 'utf8');
  console.log('\nWrote', reportPath);
  console.log('Wrote', jsonPath);
}

function buildReport(results, meta) {
  const lines = [];
  lines.push('# Darija ASR benchmark report');
  lines.push('');
  lines.push(`- Source clip: \`${meta.clip}\``);
  lines.push(`- Audio under test: \`${meta.workClip}\` (max ${meta.maxSec}s)`);
  lines.push(`- Reference provided: ${meta.reference?.text ? 'yes' : 'NO — add references/*.json for CER/WER'}`);
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('| Run | Status | Model | ms | segs | words | CER | WER | invent | notes |');
  lines.push('|-----|--------|-------|----|------|-------|-----|-----|--------|-------|');
  for (const r of results) {
    const status = r.ok ? 'ok' : r.skipped ? 'skipped' : 'fail';
    const cer = r.scores ? r.scores.cer.toFixed(3) : '—';
    const wer = r.scores ? r.scores.wer.toFixed(3) : '—';
    const inv = r.scores ? r.scores.inventRate.toFixed(3) : '—';
    const notes = r.ok ? (r.textPreview || '').replace(/\|/g, '/') : (r.error || '').replace(/\|/g, '/').slice(0, 80);
    lines.push(
      `| ${r.name} | ${status} | ${r.model || '—'} | ${r.ms} | ${r.segments ?? '—'} | ${r.words ?? '—'} | ${cer} | ${wer} | ${inv} | ${notes} |`
    );
  }
  lines.push('');
  lines.push('## Rules');
  lines.push('- Whisper **tiny** is never a production candidate.');
  lines.push('- Missing API keys = SKIPPED (not a silent local tiny fallback).');
  lines.push('- Lock `ASR_PROVIDER` only after human review of Darija + FR/EN fidelity on your clips.');
  lines.push('');
  lines.push('## Previews');
  for (const r of results.filter((x) => x.ok)) {
    lines.push(`### ${r.name}`);
    lines.push('```');
    lines.push(r.textPreview || '');
    lines.push('```');
    lines.push('');
  }
  return lines.join('\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
