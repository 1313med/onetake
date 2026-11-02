const fs = require('fs');
const path = require('path');

/** Minimal .env loader (project root + server/). Does not override existing env. */
function loadEnv() {
  const files = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '.env'),
  ];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i < 0) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      // Always take studio routing keys from .env so shell leftovers don't pin localWhisper
      const force =
        key === 'ASR_PROVIDER' ||
        key === 'DIRECTOR_PROVIDER' ||
        key === 'OPENAI_ASR_MODEL' ||
        key === 'OPENAI_ASR_LANGUAGE' ||
        key === 'OPENAI_ASR_CHUNK_SEC' ||
        key === 'OPENAI_ASR_PROMPT' ||
        key === 'DIRECTOR_MODEL' ||
        key === 'EXPO_PUBLIC_STUDIO_API';
      if (force || process.env[key] == null || process.env[key] === '') process.env[key] = val;
    }
  }
}

module.exports = { loadEnv };
