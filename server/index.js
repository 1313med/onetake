const { loadEnv } = require('./loadEnv');
loadEnv();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { runJob } = require('./pipeline/jobRunner');

const app = express();
const PORT = process.env.PORT || 8787;
const ROOT = __dirname;
const JOBS = path.join(ROOT, 'jobs');

fs.mkdirSync(JOBS, { recursive: true });
fs.mkdirSync(path.join(ROOT, 'assets', 'music'), { recursive: true });

const jobs = new Map();
const running = new Set();
/** Global heavy-job queue: one pipeline at a time on this machine */
const heavyQueue = [];
let heavyActive = null;

function statusPath(id) {
  return path.join(JOBS, id, 'status.json');
}

function persist(job) {
  try {
    const slim = {
      id: job.id,
      dir: job.dir,
      sourcePath: job.sourcePath,
      brief: job.brief,
      status: job.status,
      phase: job.phase,
      progress: job.progress,
      message: job.message,
      error: job.error,
      meta: job.meta,
      outputs: job.outputs || [],
      timing: job.timing || null,
      phases: job.phases || null,
      transcriptSummary: job.transcriptSummary || null,
      editorialSummary: job.editorialSummary || null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
    fs.writeFileSync(statusPath(job.id), JSON.stringify(slim, null, 2), 'utf8');
  } catch {
    /* ignore */
  }
}

function findSource(dir) {
  const names = ['source.mov', 'source.mp4', 'source.MOV', 'source.MP4', 'source.m4v', 'source.webm'];
  for (const n of names) {
    const p = path.join(dir, n);
    if (fs.existsSync(p)) return p;
  }
  const hit = fs.readdirSync(dir).find((f) => /^source\./i.test(f));
  return hit ? path.join(dir, hit) : null;
}

function loadJobFromDisk(id) {
  const dir = path.join(JOBS, id);
  if (!fs.existsSync(dir)) return null;
  let saved = null;
  try {
    if (fs.existsSync(statusPath(id))) {
      saved = JSON.parse(fs.readFileSync(statusPath(id), 'utf8'));
    }
  } catch {
    saved = null;
  }
  const sourcePath =
    saved && saved.sourcePath && fs.existsSync(saved.sourcePath)
      ? saved.sourcePath
      : findSource(dir);
  if (!sourcePath) return null;
  return {
    id,
    dir,
    sourcePath,
    brief: (saved && saved.brief) || { niche: '', spokenNotes: '', goal: 'views', cta: '', languages: '' },
    status: (saved && saved.status) || 'queued',
    phase: (saved && saved.phase) || 'queued',
    progress: (saved && saved.progress) || 0,
    message: (saved && saved.message) || 'Queued',
    error: saved && saved.error,
    meta: saved && saved.meta,
    outputs: (saved && saved.outputs) || [],
    timing: (saved && saved.timing) || null,
    createdAt: (saved && saved.createdAt) || Date.now(),
    updatedAt: (saved && saved.updatedAt) || Date.now(),
  };
}

function track(job) {
  jobs.set(job.id, job);
  persist(job);
}

function pumpHeavyQueue() {
  if (heavyActive) return;
  const next = heavyQueue.shift();
  if (!next) return;
  heavyActive = next.id;
  running.add(next.id);
  next.status = 'running';
  next.message = next.message || 'Running studio pipeline…';
  track(next);
  Promise.resolve()
    .then(() => runJob(next, (j) => track({ ...j })))
    .catch((err) => {
      console.error(`[job ${next.id}]`, err?.message || err);
      next.status = 'failed';
      next.phase = 'error';
      next.message = err?.message || String(err);
      track(next);
    })
    .finally(() => {
      running.delete(next.id);
      heavyActive = null;
      pumpHeavyQueue();
    });
}

function startJob(job) {
  if (running.has(job.id) || heavyQueue.some((j) => j.id === job.id) || heavyActive === job.id) {
    return false;
  }
  job.status = 'queued';
  job.message = heavyActive ? 'Queued behind another studio job…' : 'Queued';
  track(job);
  heavyQueue.push(job);
  pumpHeavyQueue();
  return true;
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const id = req._jobId;
    const dir = path.join(JOBS, id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.mp4';
    cb(null, `source${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 1024 } });

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'onetake-render-server',
    asrProvider: process.env.ASR_PROVIDER || null,
    whisperModel: process.env.WHISPER_MODEL || null,
    queueDepth: heavyQueue.length,
    activeJob: heavyActive,
  });
});

app.post('/jobs', (req, res) => {
  req._jobId = randomUUID();
  upload.single('video')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: String(err.message || err) });
    if (!req.file) return res.status(400).json({ error: 'video file required' });

    const id = req._jobId;
    const dir = path.join(JOBS, id);
    const brief = {
      niche: req.body.niche || '',
      spokenNotes: req.body.spokenNotes || '',
      goal: req.body.goal || 'views',
      cta: req.body.cta || '',
      languages: req.body.languages || '',
    };

    const job = {
      id,
      dir,
      sourcePath: req.file.path,
      brief,
      status: 'queued',
      phase: 'queued',
      progress: 0,
      message: 'Queued',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      outputs: [],
    };
    track(job);
    res.status(202).json({ id, status: job.status });
    startJob(job);
  });
});

app.post('/jobs/:id/resume', (req, res) => {
  const id = req.params.id;
  let job = jobs.get(id) || loadJobFromDisk(id);
  if (!job) return res.status(404).json({ error: 'job not found' });
  if (running.has(id) || heavyActive === id) {
    return res.json({ id, status: 'running', message: 'already running' });
  }
  job.status = 'queued';
  job.phase = 'queued';
  job.progress = 0.05;
  job.message = 'Resuming studio pipeline…';
  job.error = undefined;
  track(job);
  res.json({ id, status: 'queued' });
  startJob(job);
});

app.get('/jobs/:id', (req, res) => {
  let job = jobs.get(req.params.id);
  if (!job) {
    job = loadJobFromDisk(req.params.id);
    if (job) jobs.set(job.id, job);
  }
  if (!job) return res.status(404).json({ error: 'job not found' });
  res.json(publicJob(job));
});

app.use('/jobs/:id/files', (req, res, next) => {
  const dir = path.join(JOBS, req.params.id);
  if (!fs.existsSync(dir)) return res.status(404).end();
  express.static(dir)(req, res, next);
});

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    phase: job.phase,
    progress: job.progress,
    message: job.message,
    error: job.error,
    meta: job.meta,
    phases: job.phases || null,
    timing: job.timing || null,
    transcriptSummary: job.transcriptSummary
      ? job.transcriptSummary
      : job.transcript
        ? {
            language: job.transcript.language,
            segments: (job.cleanSegments || job.transcript.segments || []).length,
            words: (job.transcript.words || []).length,
            provider: job.transcript.provider,
            model: job.transcript.model,
          }
        : null,
    editorialSummary: job.editorialSummary || null,
    outputs: job.outputs || [],
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err?.message || err);
});
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err?.message || err);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`OneTake render server on http://0.0.0.0:${PORT}`);
  console.log(`ASR_PROVIDER=${process.env.ASR_PROVIDER || '(unset)'} WHISPER_MODEL=${process.env.WHISPER_MODEL || '(unset)'}`);
  // Do not auto-resume on boot during redesign — avoids surprise CPU thrash.
  // Use POST /jobs/:id/resume explicitly.
});
