const fs = require('fs');
const path = require('path');

async function main() {
  const base = 'http://localhost:8787';
  const health = await fetch(`${base}/health`).then((r) => r.json());
  console.log('health', health);

  const form = new FormData();
  const filePath = path.join(__dirname, 'jobs', '_fixture_source.mp4');
  const buf = fs.readFileSync(filePath);
  form.append('video', new Blob([buf], { type: 'video/mp4' }), 'fixture.mp4');
  form.append('niche', 'speaking tips');
  form.append('spokenNotes', 'Say it shorter and clearer');
  form.append('goal', 'views');

  const started = await fetch(`${base}/jobs`, { method: 'POST', body: form }).then((r) => r.json());
  console.log('started', started);
  const id = started.id;

  for (;;) {
    await new Promise((r) => setTimeout(r, 2000));
    const job = await fetch(`${base}/jobs/${id}`).then((r) => r.json());
    console.log(
      `[${Math.round((job.progress || 0) * 100)}%] ${job.phase}: ${job.message}`
    );
    if (job.status === 'completed' || job.status === 'failed') {
      console.log(JSON.stringify(job, null, 2));
      if (job.status === 'failed') process.exit(1);
      for (const o of job.outputs || []) {
        const p = path.join(__dirname, 'jobs', id, o.fileName);
        console.log('output', o.fileName, fs.existsSync(p), o.duration, o.qa?.ok);
      }
      break;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
