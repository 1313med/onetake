const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

/**
 * Per-job artifact helpers. Cache validity is tied to source sha256.
 */
async function ensureSourceHash(jobDir, sourcePath) {
  const metaPath = path.join(jobDir, 'source_hash.json');
  const existing = readJson(metaPath);
  if (existing?.sha256 && existing.sourcePath === sourcePath && fs.existsSync(sourcePath)) {
    const st = fs.statSync(sourcePath);
    if (existing.size === st.size && existing.mtimeMs === st.mtimeMs) {
      return existing.sha256;
    }
  }
  const sha256 = await sha256File(sourcePath);
  const st = fs.statSync(sourcePath);
  writeJson(metaPath, {
    sha256,
    sourcePath,
    size: st.size,
    mtimeMs: st.mtimeMs,
    hashedAt: Date.now(),
  });
  return sha256;
}

function canReuseTranscript(jobDir, sourceHash) {
  const t = readJson(path.join(jobDir, 'transcript.json'));
  const meta = readJson(path.join(jobDir, 'source_hash.json'));
  if (!t || !meta) return false;
  if (meta.sha256 !== sourceHash) return false;
  if (!Array.isArray(t.segments) || t.segments.length === 0) return false;
  // Never reuse a publish-path transcript produced by tiny
  if (String(t.model || '').toLowerCase() === 'tiny') return false;
  return true;
}

function canReuseEditorial(jobDir, sourceHash) {
  const e = readJson(path.join(jobDir, 'editorial.json'));
  const meta = readJson(path.join(jobDir, 'source_hash.json'));
  return Boolean(e && meta && meta.sha256 === sourceHash && e.ideaUnits);
}

function canReusePlans(jobDir, sourceHash) {
  const p = readJson(path.join(jobDir, 'plans.json'));
  const meta = readJson(path.join(jobDir, 'source_hash.json'));
  return Boolean(p && Array.isArray(p) && p.length >= 1 && meta && meta.sha256 === sourceHash);
}

function canReuseWav(jobDir) {
  const wav = path.join(jobDir, 'audio.wav');
  return fs.existsSync(wav) && fs.statSync(wav).size > 1000;
}

function canReuseProxy(jobDir) {
  const proxy = path.join(jobDir, 'proxy.mp4');
  return fs.existsSync(proxy) && fs.statSync(proxy).size > 10_000;
}

module.exports = {
  sha256File,
  ensureSourceHash,
  canReuseTranscript,
  canReuseEditorial,
  canReusePlans,
  canReuseWav,
  canReuseProxy,
  readJson,
  writeJson,
};
