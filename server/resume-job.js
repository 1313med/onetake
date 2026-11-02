/**
 * Resume a job that already has source + audio.wav (skip re-upload).
 * Usage: node server/resume-job.js <jobId>
 */
const path = require('path');
const fs = require('fs');
const { runJob } = require('./pipeline/jobRunner');

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('usage: node server/resume-job.js <jobId>');
    process.exit(1);
  }
  const dir = path.join(__dirname, 'jobs', id);
  const source =
    ['source.mov', 'source.mp4', 'source.MP4', 'source.MOV']
      .map((n) => path.join(dir, n))
      .find((p) => fs.existsSync(p)) || path.join(dir, 'source.mov');

  if (!fs.existsSync(source)) {
    console.error('missing source in', dir);
    process.exit(1);
  }

  const job = {
    id,
    dir,
    sourcePath: source,
    brief: { niche: 'speaking tips', spokenNotes: '', goal: 'views', cta: '', languages: '' },
    status: 'queued',
    phase: 'queued',
    progress: 0,
    message: 'Resuming…',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    outputs: [],
  };

  console.log('Resuming', id, source);
  await runJob(job, (j) => {
    console.log(`[${Math.round((j.progress || 0) * 100)}%] ${j.phase}: ${j.message}`);
  });
  console.log('DONE', job.status, (job.outputs || []).map((o) => o.fileName));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
