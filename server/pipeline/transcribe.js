const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function runPythonTranscribe(audioPath, outJsonPath, onProgress) {
  return new Promise((resolve, reject) => {
    const script = path.join(__dirname, '..', 'scripts', 'transcribe.py');
    const model = process.env.WHISPER_MODEL || 'tiny';
    const py = spawn('python', [script, audioPath, outJsonPath, model], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1', WHISPER_MODEL: model },
    });
    let stdout = '';
    let stderr = '';

    const handleLine = (line) => {
      const t = line.trim();
      if (!t) return;
      if (t.startsWith('PROGRESS')) {
        onProgress?.(t.replace(/^PROGRESS\s+/, ''));
      }
    };

    let outBuf = '';
    py.stdout.on('data', (d) => {
      const s = d.toString();
      stdout += s;
      outBuf += s;
      const lines = outBuf.split(/\r?\n/);
      outBuf = lines.pop() || '';
      lines.forEach(handleLine);
    });
    py.stderr.on('data', (d) => {
      const s = d.toString();
      stderr += s;
      // faster-whisper sometimes logs to stderr
      s.split(/\r?\n/).forEach(handleLine);
    });
    py.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Whisper failed (${code}): ${stderr.slice(-800) || stdout.slice(-800)}`));
        return;
      }
      try {
        const data = JSON.parse(fs.readFileSync(outJsonPath, 'utf8'));
        resolve({ data, log: stdout });
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Collapse true retakes only (near-identical lines within ~45s).
 * Do NOT wipe distant repeats across a long take — that destroyed Darija timelines
 * when ASR hallucinated one phrase for the whole file.
 */
function dedupeRepeatedTakes(segments, opts = {}) {
  const windowSec = opts.windowSec ?? 45;
  const kept = [];
  for (const seg of segments) {
    const norm = normalize(seg.text);
    if (norm.length < 2) continue;
    const prev = kept[kept.length - 1];
    if (prev && similar(normalize(prev.text), norm) && seg.start - prev.start < windowSec) {
      if (quality(seg) > quality(prev)) kept[kept.length - 1] = seg;
      continue;
    }
    const recent = kept.filter((r) => seg.start - r.start < windowSec).slice(-6);
    const dup = recent.find((r) => similar(normalize(r.text), norm));
    if (dup) {
      if (quality(seg) > quality(dup)) {
        kept[kept.indexOf(dup)] = seg;
      }
      continue;
    }
    kept.push(seg);
  }
  return kept;
}

function normalize(t) {
  return t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function similar(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) {
    const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    return ratio > 0.7;
  }
  return levenshteinRatio(a, b) > 0.82;
}

function levenshteinRatio(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m && !n) return 1;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return 1 - dp[m][n] / Math.max(m, n);
}

function quality(seg) {
  const dur = Math.max(0.1, seg.end - seg.start);
  return dur * 2 + (seg.avg_logprob || 0) * 3 - (seg.no_speech_prob || 0) * 4;
}

module.exports = { runPythonTranscribe, dedupeRepeatedTakes };
