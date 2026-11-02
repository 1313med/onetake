const { renderEdl, renderAllParallel } = require('./render/executor');

/** Legacy name used by older callers */
async function renderVersion(jobDir, sourcePath, plan, musicPath, onProgress) {
  return renderEdl(jobDir, sourcePath, plan, musicPath, onProgress);
}

module.exports = { renderVersion, renderEdl, renderAllParallel };
