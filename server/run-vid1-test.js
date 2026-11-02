/**
 * Prove Super Editor on references/vid1/vid1_original.mp4
 * Usage: node server/run-vid1-test.js [--reuse-job <id>]
 */
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { loadEnv } = require('./loadEnv');
loadEnv();
process.env.SKIP_PROXY = process.env.SKIP_PROXY || '1';

const { runJob } = require('./pipeline/jobRunner');

async function main() {
  const root = path.join(__dirname, '..');
  const src = path.join(root, 'references', 'vid1', 'vid1_original.mp4');
  const wavSrc = path.join(root, 'references', 'vid1', 'analysis', 'vid1_original_mono.wav');
  if (!fs.existsSync(src)) {
    console.error('Missing', src);
    process.exit(1);
  }

  const reuseArg = process.argv.indexOf('--reuse-job');
  let id =
    reuseArg >= 0 && process.argv[reuseArg + 1]
      ? process.argv[reuseArg + 1]
      : fs.existsSync(path.join(__dirname, 'jobs', '_last_prove_id.txt'))
        ? fs.readFileSync(path.join(__dirname, 'jobs', '_last_prove_id.txt'), 'utf8').trim()
        : `vid1prove-${randomUUID().slice(0, 8)}`;

  const dir = path.join(__dirname, 'jobs', id);
  fs.mkdirSync(dir, { recursive: true });
  const sourcePath = path.join(dir, 'source.mp4');
  if (!fs.existsSync(sourcePath)) fs.copyFileSync(src, sourcePath);
  if (fs.existsSync(wavSrc) && !fs.existsSync(path.join(dir, 'audio.wav'))) {
    fs.copyFileSync(wavSrc, path.join(dir, 'audio.wav'));
  }

  // Prefer a known-good multi-segment transcript for structural prove when OpenAI key missing
  const donor = path.join(__dirname, 'jobs', 'vid1test-5b215e19', 'transcript.json');
  if (!process.env.OPENAI_API_KEY && fs.existsSync(donor) && !fs.existsSync(path.join(dir, 'transcript.json'))) {
    const t = JSON.parse(fs.readFileSync(donor, 'utf8'));
    fs.writeFileSync(path.join(dir, 'transcript.json'), JSON.stringify(t, null, 2));
    console.log('Seeded transcript from vid1test-5b215e19 (no OPENAI_API_KEY)');
    process.env.ASR_PROVIDER = 'localWhisper';
    process.env.WHISPER_MODEL = 'small'; // allow path; cache will hit
    process.env.DIRECTOR_PROVIDER = 'local';
  }

  if (!process.env.OPENAI_API_KEY && process.env.ASR_PROVIDER === 'openai') {
    console.warn('OPENAI_API_KEY missing — falling back to local Super Editor spine for prove');
    process.env.ASR_PROVIDER = 'localWhisper';
    process.env.WHISPER_MODEL = process.env.WHISPER_MODEL || 'small';
    process.env.DIRECTOR_PROVIDER = 'local';
  }

  const job = {
    id,
    dir,
    sourcePath,
    brief: {
      niche: 'faith / motivation Darija',
      spokenNotes: 'Super Editor: silence cleanup, best takes, ~100s continuous, 5 variants',
      goal: 'views',
      cta: '',
      languages: 'Darija / Arabic',
    },
    status: 'queued',
    phase: 'queued',
    progress: 0,
    message: 'Starting vid1 Super Editor prove…',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    outputs: [],
  };

  console.log('JOB', id);
  console.log('ASR', process.env.ASR_PROVIDER, process.env.OPENAI_ASR_MODEL || process.env.WHISPER_MODEL);
  console.log('DIRECTOR', process.env.DIRECTOR_PROVIDER);

  await runJob(job, (j) => {
    const pct = Math.round((j.progress || 0) * 100);
    console.log(`[${pct}%] ${j.phase}: ${j.message}`);
  });

  const summary = {
    id,
    status: job.status,
    error: job.error || null,
    editorial: job.editorialSummary,
    outputs: (job.outputs || []).map((o) => ({
      name: o.name,
      duration: o.duration,
      clips: o.timelineClips,
      captions: o.captionEvents,
      qaOk: o.qa?.ok,
      warnings: o.warnings,
      fileName: o.fileName,
    })),
    timing: job.timing,
    referenceEditedSec: 104,
  };
  const outPath = path.join(dir, 'vid1_test_summary.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log('\n=== VID1 SUPER EDITOR PROVE ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log('Wrote', outPath);

  const okDur = (job.outputs || []).filter((o) => o.duration >= 90 && o.duration <= 120).length;
  if (job.status !== 'completed' || okDur < 3) {
    console.error(`Prove weak: status=${job.status} variants_in_90_120=${okDur}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
