const fs = require('fs');
const { normalizeTranscript } = require('./normalize');
const { transcribeLocalWhisper } = require('./providers/localWhisper');
const { transcribeOpenAI } = require('./providers/openai');
const { transcribeElevenLabs } = require('./providers/elevenlabs');
const { transcribeGladia } = require('./providers/gladia');

const PROVIDERS = {
  localWhisper: transcribeLocalWhisper,
  openai: transcribeOpenAI,
  elevenlabs: transcribeElevenLabs,
  gladia: transcribeGladia,
};

/**
 * Provider-agnostic ASR entry. Never silently falls back to Whisper tiny.
 */
async function transcribe(audioPath, opts = {}) {
  const provider = opts.provider || process.env.ASR_PROVIDER;
  if (!provider) {
    throw new Error(
      'ASR_PROVIDER is not set. Set it to one of: openai | elevenlabs | gladia | localWhisper. Whisper tiny is not a valid production default.'
    );
  }
  if (String(provider).toLowerCase() === 'tiny') {
    throw new Error('ASR_PROVIDER=tiny is forbidden. Use a real provider.');
  }

  const fn = PROVIDERS[provider];
  if (!fn) {
    throw new Error(`Unknown ASR_PROVIDER "${provider}". Valid: ${Object.keys(PROVIDERS).join(', ')}`);
  }

  const result = await fn(audioPath, {
    ...opts,
    allowTiny: Boolean(opts.allowTiny),
  });
  const normalized = normalizeTranscript(result);

  if (opts.persistPath) {
    fs.writeFileSync(opts.persistPath, JSON.stringify(normalized, null, 2), 'utf8');
  }
  return normalized;
}

function listProviders() {
  return Object.keys(PROVIDERS);
}

module.exports = { transcribe, listProviders, PROVIDERS };
