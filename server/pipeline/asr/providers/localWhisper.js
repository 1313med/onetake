const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { normalizeTranscript } = require('../normalize');

/**
 * Local faster-whisper via transcribe.py.
 * Model MUST be passed explicitly — never silently downgrade to tiny.
 */
async function transcribeLocalWhisper(audioPath, opts = {}) {
  const model = opts.model || process.env.WHISPER_MODEL;
  if (!model) {
    throw new Error(
      'Local Whisper model not set. Set WHISPER_MODEL (e.g. base|small|medium|large-v3). Tiny is not allowed for publish captions.'
    );
  }
  if (String(model).toLowerCase() === 'tiny' && !opts.allowTiny) {
    throw new Error(
      'Whisper model "tiny" is blocked for production/benchmark publish paths. Pass allowTiny only for explicit anti-benchmark baselines.'
    );
  }

  const outJson = opts.outJsonPath || path.join(path.dirname(audioPath), `transcript_local_${model}.json`);
  const script = path.join(__dirname, '..', '..', '..', 'scripts', 'transcribe.py');

  await new Promise((resolve, reject) => {
    const py = spawn('python', [script, audioPath, outJson, model], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1', WHISPER_MODEL: model },
    });
    let stderr = '';
    let stdout = '';
    py.stdout.on('data', (d) => {
      stdout += d.toString();
      const lines = d.toString().split(/\r?\n/);
      for (const line of lines) {
        if (line.startsWith('PROGRESS') && opts.onProgress) opts.onProgress(line.replace(/^PROGRESS\s+/, ''));
      }
    });
    py.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    py.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Local Whisper (${model}) failed (${code}): ${(stderr || stdout).slice(-800)}`));
        return;
      }
      resolve();
    });
  });

  const raw = JSON.parse(fs.readFileSync(outJson, 'utf8'));
  return normalizeTranscript({
    provider: 'localWhisper',
    model: raw.model || model,
    language: raw.language,
    language_probability: raw.language_probability,
    duration: raw.duration,
    segments: raw.segments,
    words: raw.words,
    rawPath: outJson,
  });
}

module.exports = { transcribeLocalWhisper };
