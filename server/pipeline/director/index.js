const { runLocalDirector } = require('./localEditorial');
const { runLlmDirector } = require('./llmDirector');

/**
 * AI Director entry. Prefer LLM when configured; otherwise local editorial analysis.
 * Never invents transcript text — only rearranges timed speech spans.
 */
async function runDirector(ctx) {
  const provider = (process.env.DIRECTOR_PROVIDER || 'auto').toLowerCase();

  if (provider === 'local') {
    return runLocalDirector(ctx);
  }
  if (provider === 'openai' || provider === 'llm') {
    return runLlmDirector(ctx);
  }

  // auto
  if (process.env.OPENAI_API_KEY) {
    try {
      return await runLlmDirector(ctx);
    } catch (err) {
      // Clear failure path: do not pretend LLM succeeded; fall back to local analysis of real transcript
      console.warn('[director] LLM failed, using localEditorial:', err.message);
      const local = runLocalDirector(ctx);
      local.editorial.engine = `localEditorial(fallback after llm error: ${err.message})`;
      return local;
    }
  }
  return runLocalDirector(ctx);
}

module.exports = { runDirector };
