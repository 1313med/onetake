const fs = require('fs');
const path = require('path');

function createTimer(jobDir) {
  fs.mkdirSync(jobDir, { recursive: true });
  const timingPath = path.join(jobDir, 'timing.json');
  const data = {
    ingest_ms: 0,
    media_prep_ms: 0,
    asr_ms: 0,
    director_ms: 0,
    render_ms_by_version: {},
    qc_ms: 0,
    total_ms: 0,
    cache_hits: [],
    stages: [],
    startedAt: Date.now(),
  };

  if (fs.existsSync(timingPath)) {
    try {
      Object.assign(data, JSON.parse(fs.readFileSync(timingPath, 'utf8')));
    } catch {
      /* fresh */
    }
  }

  function persist() {
    data.total_ms = Date.now() - data.startedAt;
    fs.writeFileSync(timingPath, JSON.stringify(data, null, 2), 'utf8');
  }

  async function time(name, key, fn) {
    const t0 = Date.now();
    try {
      return await fn();
    } finally {
      const ms = Date.now() - t0;
      if (key) data[key] = (data[key] || 0) + ms;
      data.stages.push({ name, ms, at: Date.now() });
      persist();
    }
  }

  function markCache(hit) {
    if (!data.cache_hits.includes(hit)) data.cache_hits.push(hit);
    persist();
  }

  function setRenderMs(versionId, ms) {
    data.render_ms_by_version[versionId] = ms;
    persist();
  }

  function snapshot() {
    data.total_ms = Date.now() - data.startedAt;
    return { ...data, render_ms_by_version: { ...data.render_ms_by_version }, cache_hits: [...data.cache_hits] };
  }

  persist();
  return { time, markCache, setRenderMs, snapshot, persist };
}

module.exports = { createTimer };
