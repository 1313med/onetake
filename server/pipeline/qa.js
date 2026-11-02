const { runQualityGate } = require('./qc');

/** Backward-compatible wrapper */
async function qaOutput(filePath, plan, transcript) {
  return runQualityGate(filePath, plan, transcript);
}

module.exports = { qaOutput, runQualityGate };
